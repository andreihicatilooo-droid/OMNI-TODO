import React, { useState, useRef, useEffect } from 'react';
import LockScreen from './components/LockScreen';
import VaultDashboard from './components/VaultDashboard';
import ShaderBG from './components/ShaderBG';
import { AnimatePresence } from 'framer-motion';

const DURESS_PIN = "6666";

// ── Inline Web Worker (CRDT · Tombstones · AES-GCM · HMAC) ──────────────────
const workerCode = `
  const DB_NAME = 'VaultDB'; const DB_VERSION = 2;
  const META_STORE = 'meta'; const CONTENT_STORE = 'content'; const SYSTEM_STORE = 'system';
  let dbInstance = null; let sessionKeys = null;

  const initDB = async () => {
    if (dbInstance) return dbInstance;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(CONTENT_STORE)) db.createObjectStore(CONTENT_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(SYSTEM_STORE)) db.createObjectStore(SYSTEM_STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  };

  const getSysVar = (db, key) => new Promise(r => { const req = db.transaction(SYSTEM_STORE, 'readonly').objectStore(SYSTEM_STORE).get(key); req.onsuccess = () => r(req.result?.value); });
  const setSysVar = (db, key, value) => new Promise(r => { const req = db.transaction(SYSTEM_STORE, 'readwrite').objectStore(SYSTEM_STORE).put({ key, value }); req.onsuccess = () => r(); });

  const deriveSessionKeys = async (password) => {
    const db = await initDB();
    let salt = await getSysVar(db, 'masterSalt');
    if (!salt) { salt = crypto.getRandomValues(new Uint8Array(16)); await setSysVar(db, 'masterSalt', salt); }
    const enc = new TextEncoder(); const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const hmacSalt = new Uint8Array(salt); hmacSalt[0] ^= 0xFF;
    const hmacKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: hmacSalt, iterations: 100000, hash: 'SHA-256' }, keyMat, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
    sessionKeys = { aesKey, hmacKey };
  };

  const cryptoShred = async (db) => {
    const tx = db.transaction([META_STORE, CONTENT_STORE, SYSTEM_STORE], 'readwrite');
    const cStore = tx.objectStore(CONTENT_STORE);
    const allContent = await new Promise(r => { const req = cStore.getAllKeys(); req.onsuccess = () => r(req.result); });
    for (let id of allContent) { const garbage = crypto.getRandomValues(new Uint8Array(1024 * 10)); cStore.put({ id, data: garbage.buffer }); }
    await new Promise(r => { tx.oncomplete = r; });
    const txDel = db.transaction([META_STORE, CONTENT_STORE, SYSTEM_STORE], 'readwrite');
    txDel.objectStore(META_STORE).clear(); txDel.objectStore(CONTENT_STORE).clear(); txDel.objectStore(SYSTEM_STORE).clear();
  };

  const encryptData = async (dataBuffer) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKeys.aesKey, dataBuffer);
    const dataToSign = new Uint8Array(iv.length + ciphertext.byteLength); dataToSign.set(iv); dataToSign.set(new Uint8Array(ciphertext), iv.length);
    const signature = await crypto.subtle.sign('HMAC', sessionKeys.hmacKey, dataToSign);
    const payload = new Uint8Array(12 + 32 + ciphertext.byteLength);
    payload.set(iv, 0); payload.set(new Uint8Array(signature), 12); payload.set(new Uint8Array(ciphertext), 44);
    return payload.buffer;
  };

  const decryptData = async (payloadBuffer) => {
    const payload = new Uint8Array(payloadBuffer);
    if (payload.length < 44) throw new Error('CORRUPTED_PAYLOAD');
    const iv = payload.slice(0, 12), signature = payload.slice(12, 44), ciphertext = payload.slice(44);
    const dataToVerify = new Uint8Array(iv.length + ciphertext.length); dataToVerify.set(iv); dataToVerify.set(ciphertext, iv.length);
    const isValid = await crypto.subtle.verify('HMAC', sessionKeys.hmacKey, signature, dataToVerify);
    if (!isValid) throw new Error('INTEGRITY_COMPROMISED');
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sessionKeys.aesKey, ciphertext);
  };

  self.onmessage = async (e) => {
    const { id, action, payload, password } = e.data;
    try {
      const db = await initDB();

      if (action === 'LOGIN') {
        if (password === '${DURESS_PIN}') { await cryptoShred(db); throw new Error('DURESS_TRIGGERED'); }
        await deriveSessionKeys(password);
        const req = db.transaction(META_STORE, 'readonly').objectStore(META_STORE).getAll();
        req.onsuccess = () => self.postMessage({ id, result: req.result.filter(m => !m.deleted) });
      }
      else if (action === 'LOCK') {
        sessionKeys = null; self.postMessage({ id, result: 'LOCKED' });
      }
      else if (action === 'LOAD_CONTENT') {
        if (!sessionKeys) throw new Error('NO_SESSION');
        const req = db.transaction(CONTENT_STORE, 'readonly').objectStore(CONTENT_STORE).get(payload.noteId);
        req.onsuccess = async () => {
          if (!req.result) return self.postMessage({ id, result: '' });
          try {
            const decBuffer = await decryptData(req.result.data);
            self.postMessage({ id, result: new TextDecoder().decode(decBuffer) });
          } catch (err) { self.postMessage({ id, error: err.message }); }
        };
      }
      else if (action === 'SAVE_NOTE') {
        if (!sessionKeys) throw new Error('NO_SESSION');
        db.transaction(META_STORE, 'readwrite').objectStore(META_STORE).put(payload.meta);
        const encBuffer = await encryptData(new TextEncoder().encode(payload.content));
        db.transaction(CONTENT_STORE, 'readwrite').objectStore(CONTENT_STORE).put({ id: payload.meta.id, data: encBuffer });
        self.postMessage({ id, result: 'OK' });
      }
      else if (action === 'DELETE_NOTE') {
        if (!sessionKeys) throw new Error('NO_SESSION');
        const tx = db.transaction([META_STORE, CONTENT_STORE], 'readwrite');
        const req = tx.objectStore(META_STORE).get(payload.noteId);
        req.onsuccess = () => {
          if (req.result) {
            const meta = req.result;
            meta.deleted = true; meta.updated = Date.now();
            tx.objectStore(META_STORE).put(meta);
            tx.objectStore(CONTENT_STORE).delete(payload.noteId);
          }
          self.postMessage({ id, result: 'OK' });
        };
      }
      else if (action === 'EXPORT_VAULT') {
        if (!sessionKeys) throw new Error('NO_SESSION');
        const allMeta = await new Promise(r => { const req = db.transaction(META_STORE).objectStore(META_STORE).getAll(); req.onsuccess = () => r(req.result); });
        const allContent = await new Promise(r => { const req = db.transaction(CONTENT_STORE).objectStore(CONTENT_STORE).getAll(); req.onsuccess = () => r(req.result); });
        const dump = { meta: allMeta, notes: [] };
        for (const item of allContent) {
          try {
            const decBuffer = await decryptData(item.data);
            dump.notes.push({ id: item.id, content: new TextDecoder().decode(decBuffer) });
          } catch(e) { }
        }
        const dumpEncBuffer = await encryptData(new TextEncoder().encode(JSON.stringify(dump)));
        self.postMessage({ id, result: dumpEncBuffer }, [dumpEncBuffer]);
      }
      else if (action === 'IMPORT_VAULT') {
        if (!sessionKeys) throw new Error('NO_SESSION');
        const decBuffer = await decryptData(payload.fileBuffer);
        const dump = JSON.parse(new TextDecoder().decode(decBuffer));
        const tx = db.transaction([META_STORE, CONTENT_STORE], 'readwrite');
        const mStore = tx.objectStore(META_STORE); const cStore = tx.objectStore(CONTENT_STORE);
        const localMetaReq = mStore.getAll();
        localMetaReq.onsuccess = async () => {
          const localMap = new Map(localMetaReq.result.map(m => [m.id, m]));
          for (const incomingMeta of dump.meta) {
            const localMeta = localMap.get(incomingMeta.id);
            if (!localMeta || incomingMeta.updated > localMeta.updated) {
              mStore.put(incomingMeta);
              if (incomingMeta.deleted) {
                cStore.delete(incomingMeta.id);
              } else {
                const incomingNote = dump.notes.find(n => n.id === incomingMeta.id);
                if (incomingNote) {
                  const encBuffer = await encryptData(new TextEncoder().encode(incomingNote.content));
                  cStore.put({ id: incomingMeta.id, data: encBuffer });
                }
              }
            }
          }
          const finalReq = mStore.getAll();
          finalReq.onsuccess = () => self.postMessage({ id, result: finalReq.result.filter(m => !m.deleted) });
        };
      }
    } catch (error) { self.postMessage({ id, error: error.message }); }
  };
`;

// ── CryptoDBClient ────────────────────────────────────────────────────────────
export class CryptoDBClient {
  constructor() {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.msgId = 0;
    this.callbacks = new Map();
    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      if (this.callbacks.has(id)) {
        const { resolve, reject } = this.callbacks.get(id);
        this.callbacks.delete(id);
        if (error) reject(new Error(error)); else resolve(result);
      }
    };
  }
  exec(action, payload = {}, password = null) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({ id, action, payload, password });
    });
  }
  terminate() { this.worker.terminate(); }
}

// ── Duress screen ─────────────────────────────────────────────────────────────
const DuressScreen = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="text-6xl select-none">💀</div>
      <h1 className="text-2xl font-bold text-red-500 font-mono tracking-widest">VAULT DESTROYED</h1>
      <p className="text-zinc-600 text-sm font-mono">All data has been cryptographically shredded.</p>
    </div>
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const clientRef = useRef(null);
  const [locked, setLocked] = useState(true);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState('');
  const [duress, setDuress] = useState(false);

  useEffect(() => {
    clientRef.current = new CryptoDBClient();
    return () => clientRef.current?.terminate();
  }, []);

  const handleUnlock = async (password) => {
    try {
      const metaList = await clientRef.current.exec('LOGIN', {}, password);
      setNotes(metaList || []);
      setLocked(false);
      setError('');
    } catch (e) {
      if (e.message === 'DURESS_TRIGGERED') setDuress(true);
      else setError('Неверный пароль или данные повреждены');
    }
  };

  const handleLock = async () => {
    await clientRef.current?.exec('LOCK');
    setNotes([]);
    setLocked(true);
    setError('');
  };

  if (duress) return <DuressScreen />;

  return (
    <div data-theme="dark" className="min-h-screen bg-theme-bg font-sans text-theme-text overflow-hidden relative">
      <ShaderBG type="noise" color="#c084fc" opacity={0.1} />
      <AnimatePresence mode="wait">
        {locked ? (
          <LockScreen key="lock" onUnlock={handleUnlock} error={error} />
        ) : (
          <VaultDashboard
            key="vault"
            client={clientRef.current}
            initialNotes={notes}
            onLock={handleLock}
            onNotesChange={setNotes}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
import React, { useState, useReducer, useEffect } from 'react';
import LockScreen from './components/LockScreen';
import VaultDashboard from './components/VaultDashboard';
import ShaderBG from './components/ShaderBG';
import { encryptData, decryptData, saveVault, loadVault, saveVaultToFile } from './lib/crypto';
import { AnimatePresence, motion } from 'framer-motion';

const emptyState = {
  items: [],
  projects: [],
  mindmaps: [],
  gallery: [],
  settings: { theme: 'dark', color: '#7c3aed', autoLock: true, lockTimeout: 15 }
};

const appReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, { id: Date.now(), created: new Date().toISOString(), pinned: false, ...action.payload }] };
    case 'UPDATE_ITEM':
      return { ...state, items: state.items.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case 'DELETE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, { id: Date.now(), created: new Date().toISOString(), issues: [], ...action.payload }] };
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'ADD_CERBER_MSG':
      return { ...state, cerberHistory: [...(state.cerberHistory || []), action.payload] };
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'ADD_MINDMAP':
      return { ...state, mindmaps: [...(state.mindmaps || []), { id: Date.now(), created: new Date().toISOString(), ...action.payload }] };
    case 'UPDATE_MINDMAP':
      return { ...state, mindmaps: (state.mindmaps || []).map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) };
    case 'DELETE_MINDMAP':
      return { ...state, mindmaps: (state.mindmaps || []).filter(m => m.id !== action.payload) };
    case 'ADD_IMAGE':
      return { ...state, gallery: [{ id: Date.now(), created: new Date().toISOString(), ...action.payload }, ...(state.gallery || [])] };
    case 'DELETE_IMAGE':
      return { ...state, gallery: (state.gallery || []).filter(img => img.id !== action.payload) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'LOAD':
      return action.payload;
    default:
      return state;
  }
};

function App() {
  const [locked, setLocked] = useState(true);
  const [mode, setMode] = useState('create');
  const [hasVault, setHasVault] = useState(false);
  const [error, setError] = useState('');
  const [state, dispatch] = useReducer(appReducer, emptyState);
  const [password, setPassword] = useState('');

  // Check if vault exists on mount
  useEffect(() => {
    loadVault().then(data => {
      if (data) {
        setHasVault(true);
        setMode('unlock');
      }
    });
  }, []);

  // Save changes to encrypted storage automatically
  useEffect(() => {
    if (!locked && password) {
      const save = async () => {
        try {
          const payload = await encryptData(state, password);
          await saveVault(payload);
          setHasVault(true);
        } catch (e) {
          console.error("Auto-save failed", e);
        }
      };
      save();
    }
  }, [state, locked, password]);

  const handleCreate = async (pw) => {
    try {
      const payload = await encryptData(emptyState, pw);
      await saveVault(payload);
      setPassword(pw);
      dispatch({ type: 'LOAD', payload: emptyState });
      setHasVault(true);
      setLocked(false);
      setError('');
    } catch (e) {
      setError('Ошибка при создании хранилища');
      console.error(e);
    }
  };

  const handleUnlock = async (pw) => {
    try {
      const encryptedData = await loadVault();
      if (!encryptedData) throw new Error('Хранилище не найдено');
      const data = await decryptData(encryptedData, pw);
      dispatch({ type: 'LOAD', payload: data });
      setPassword(pw);
      setLocked(false);
      setError('');
    } catch (e) {
      setError('Неверный пароль или данные повреждены');
      console.error(e);
    }
  };

  const handleOpenFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        // Basic validation before attempting unlock
        if (!content.startsWith('BASE1:')) throw new Error('Invalid format');
        await saveVault(content);
        setHasVault(true);
        setMode('unlock');
        setError('');
        alert('Файл базы успешно загружен. Введите пароль для разблокировки.');
      } catch (e) {
        setError('Неверный формат файла базы');
      }
    };
    reader.readAsText(file);
  };

  const handleLock = () => {
    setLocked(true);
    setPassword('');
    dispatch({ type: 'LOAD', payload: emptyState });
  };

  const handleExportVault = async () => {
    if (!password) return;
    try {
      const payload = await encryptData(state, password);
      const success = await saveVaultToFile(payload, `vault_${new Date().toISOString().split('T')[0]}.vault`);
      if (success) alert('База успешно экспортирована!');
    } catch (e) {
      alert('Ошибка при экспорте базы');
      console.error(e);
    }
  };


  return (
    <div data-theme={state.settings?.theme || 'liwood'} className="min-h-screen bg-theme-bg font-sans text-theme-text overflow-hidden relative transition-colors duration-500">
      <ShaderBG type="noise" color={state.settings?.theme === 'cyberpunk' ? '#06B6D4' : state.settings?.theme === 'dark' ? '#CBA57A' : '#B89B72'} opacity={0.15} />
      
      <AnimatePresence mode="wait">
        {locked ? (
          <LockScreen 
            key="lock"
            mode={mode} 
            setMode={setMode} 
            onUnlock={handleUnlock} 
            onCreate={handleCreate} 
            onOpenFile={handleOpenFile}
            hasVault={hasVault}
            error={error}
          />
        ) : (
          <VaultDashboard 
            key="dashboard"
            state={state} 
            dispatch={dispatch} 
            onLock={handleLock}
            onExportVault={handleExportVault}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
