import { useState, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import LockScreen from './components/LockScreen';
import VaultDashboard from './components/VaultDashboard';
import ShaderBG from './components/ShaderBG';
import {
  encryptData, decryptData, saveVault, loadVault, saveVaultToFile,
  fsAccessSupported, pickVaultFile, createVaultFile, writeToHandle,
  readFromHandle, verifyPermission, rememberHandle, recallHandle, forgetHandle,
} from './lib/crypto';
import {
  googleConfigured, signInWithGoogle as signInWithGoogleDrive, getGoogleProfile, googleSignOut,
  listVaultFiles, downloadVaultFile, createVaultOnDrive, updateVaultOnDrive,
} from './lib/googleDrive';
import { AnimatePresence } from 'framer-motion';

const emptyState = {
  settings: { theme: 'dark', color: '#7c3aed', autoLock: true, lockTimeout: 15 },
  items: [],
  projects: [],
  mindmaps: [],
  workflows: [],
  gallery: [],
};

const deriveTelegramPassword = async (telegramUser) => {
  const seed = `${telegramUser?.id ?? 'telegram'}:${telegramUser?.username || telegramUser?.first_name || 'user'}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
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
    case 'ADD_CHAT_SESSION':
      return { ...state, chatSessions: [...(state.chatSessions || []), { id: action.payload?.id || Date.now(), name: 'Новый чат', created: new Date().toISOString(), messages: [] }] };
    case 'DELETE_CHAT_SESSION':
      return { ...state, chatSessions: (state.chatSessions || []).filter(s => s.id !== action.payload) };
    case 'ADD_MSG_TO_SESSION':
      return {
        ...state,
        chatSessions: (state.chatSessions || []).map(s =>
          s.id !== action.payload.sessionId ? s : {
            ...s,
            name: s.name === 'Новый чат' && action.payload.msg.role === 'user'
              ? action.payload.msg.content.slice(0, 28) + (action.payload.msg.content.length > 28 ? '…' : '')
              : s.name,
            messages: [...s.messages, action.payload.msg],
          }
        ),
      };
    case 'APPEND_MSG_TO_SESSION':
      return {
        ...state,
        chatSessions: (state.chatSessions || []).map(s => {
          if (s.id !== action.payload.sessionId) return s;
          const messages = [...s.messages];
          if (messages.length === 0) return s;
          const lastMsg = { ...messages[messages.length - 1] };
          lastMsg.content = lastMsg.content + action.payload.chunk;
          if (action.payload.actions) {
            lastMsg.actions = action.payload.actions;
          }
          messages[messages.length - 1] = lastMsg;
          return { ...s, messages };
        }),
      };
    case 'RENAME_CHAT_SESSION':
      return { ...state, chatSessions: (state.chatSessions || []).map(s => s.id === action.payload.id ? { ...s, name: action.payload.name } : s) };
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };
    case 'ADD_MINDMAP':
      return { ...state, mindmaps: [...(state.mindmaps || []), { id: Date.now(), created: new Date().toISOString(), ...action.payload }] };
    case 'UPDATE_MINDMAP':
      return { ...state, mindmaps: (state.mindmaps || []).map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) };
    case 'DELETE_MINDMAP':
      return { ...state, mindmaps: (state.mindmaps || []).filter(m => m.id !== action.payload) };
    case 'ADD_WORKFLOW':
      return { ...state, workflows: [...(state.workflows || []), { id: Date.now(), created: new Date().toISOString(), ...action.payload }] };
    case 'UPDATE_WORKFLOW':
      return { ...state, workflows: (state.workflows || []).map(w => w.id === action.payload.id ? { ...w, ...action.payload } : w) };
    case 'DELETE_WORKFLOW':
      return { ...state, workflows: (state.workflows || []).filter(w => w.id !== action.payload) };
    case 'ADD_IMAGE':
      return { ...state, gallery: [{ id: Date.now(), created: new Date().toISOString(), ...action.payload }, ...(state.gallery || [])] };
    case 'DELETE_IMAGE':
      return { ...state, gallery: (state.gallery || []).filter(img => img.id !== action.payload) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'LOAD': {
      const loaded = action.payload;
      if (loaded.cerberHistory?.length > 0 && !(loaded.chatSessions?.length > 0)) {
        return { ...loaded, chatSessions: [{ id: Date.now(), name: 'История', created: loaded.cerberHistory[0]?.timestamp || new Date().toISOString(), messages: loaded.cerberHistory }] };
      }
      return loaded;
    }
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
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  // Файл-БД, с которым ведётся работа в текущей сессии.
  const supportsFS = fsAccessSupported();
  const vaultHandleRef = useRef(null);          // активный FS-хэндл (если есть)
  const [vaultName, setVaultName] = useState('');// имя активного файла
  const [pendingFile, setPendingFile] = useState(null); // { content, name, handle, drive } выбран, но не разблокирован
  const [canReopen, setCanReopen] = useState(false);    // есть запомненный последний файл
  const saveTimer = useRef(null);
  const savedTimer = useRef(null);
  const telegramAuthConfig = useMemo(() => import.meta.env.VITE_TELEGRAM_BOT_USERNAME ? {
    enabled: true,
    botUsername: import.meta.env.VITE_TELEGRAM_BOT_USERNAME,
    callbackUrl: import.meta.env.VITE_TELEGRAM_CALLBACK_URL || (import.meta.env.DEV ? 'http://localhost:3001/api/auth/telegram/callback' : `${window.location.origin}/api/auth/telegram/callback`),
  } : { enabled: false, botUsername: '', callbackUrl: '' }, []);

  // Google Drive: контекст активного файла на диске и профиль пользователя.
  const driveFileRef = useRef(null);                    // { fileId, name } активного файла на Drive
  const [googleProfile, setGoogleProfile] = useState(null);
  const [createTarget, setCreateTarget] = useState('local'); // 'local' | 'drive'
  const [storageLocation, setStorageLocation] = useState('localStorage'); // 'drive' | 'local' | 'localStorage'

  // На старте: ищем запомненный файл (FS API) либо vault в localStorage (fallback).
  useEffect(() => {
    (async () => {
      if (supportsFS) {
        const remembered = await recallHandle();
        if (remembered?.handle) {
          setCanReopen(true);
          setVaultName(remembered.name || remembered.handle.name || '');
          setMode('unlock');
          setHasVault(true);
          return;
        }
      }
      const data = await loadVault();
      if (data) {
        setHasVault(true);
        setMode('unlock');
      }
    })();
  }, [supportsFS]);

  // Запись текущего состояния обратно в выбранный файл (или localStorage).
  // Дебаунс, чтобы не писать на каждый кейстрок.
  const persist = useCallback(async (nextState) => {
    if (!password) return;
    setSaveStatus('saving');
    try {
      const payload = await encryptData(nextState, password);
      // 1. Активный файл на Google Drive
      if (driveFileRef.current?.fileId) {
        await updateVaultOnDrive(driveFileRef.current.fileId, payload);
      } else {
        // 2. Локальный файл через File System Access API
        const handle = vaultHandleRef.current;
        if (supportsFS && handle) {
          const ok = await verifyPermission(handle, true);
          if (ok) {
            await writeToHandle(handle, payload);
          } else {
            await saveVault(payload);
          }
        } else {
          // 3. Fallback: localStorage
          await saveVault(payload);
        }
      }
      setSaveStatus('saved');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      console.error('Не удалось сохранить базу', e);
      setSaveStatus('error');
    }
  }, [password, supportsFS]);

  useEffect(() => {
    if (locked || !password) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(state), 600);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [state, locked, password, persist]);

  // Создание новой базы: выбираем, КУДА сохранить зашифрованный файл.
  const handleCreate = async (pw) => {
    try {
      setError('');
      const fileName = `omni_${new Date().toISOString().split('T')[0]}.vault`;
      const payload = await encryptData(emptyState, pw);

      if (createTarget === 'drive') {
        // Создаём зашифрованный файл базы на Google Drive
        const created = await createVaultOnDrive(fileName, payload);
        driveFileRef.current = { fileId: created.id, name: created.name };
        setVaultName(created.name);
        setStorageLocation('drive');
      } else if (supportsFS) {
        const created = await createVaultFile(payload, fileName);
        if (!created) return; // пользователь отменил выбор файла
        vaultHandleRef.current = created.handle;
        setVaultName(created.name);
        await rememberHandle(created.handle, created.name);
        setStorageLocation('local');
      } else {
        await saveVault(payload);
        setStorageLocation('localStorage');
      }
      setPassword(pw);
      dispatch({ type: 'LOAD', payload: emptyState });
      setHasVault(true);
      setLocked(false);
    } catch (e) {
      setError(createTarget === 'drive' ? 'Ошибка при создании файла на Google Drive' : 'Ошибка при создании файла базы');
      console.error(e);
    }
  };

  // Вход через Google: авторизация → поиск файла базы на Drive.
  const handleGoogleLogin = async () => {
    setError('');
    try {
      const token = await signInWithGoogleDrive();
      const profile = await getGoogleProfile(token);
      setGoogleProfile(profile);

      const files = await listVaultFiles(token);
      if (files.length > 0) {
        // Нашли существующий файл — скачиваем самый свежий и просим пароль.
        const f = files[0];
        const content = await downloadVaultFile(f.id, token);
        if (!content.startsWith('BASE1:')) { setError('Файл базы на Google Drive повреждён'); return; }
        setPendingFile({ content, name: f.name, handle: null, drive: { fileId: f.id, name: f.name } });
        setVaultName(f.name);
        setCanReopen(false);
        setMode('unlock');
      } else {
        // Файла ещё нет — создаём новый на Drive.
        setCreateTarget('drive');
        setMode('create');
      }
    } catch (e) {
      setError(e.message || 'Не удалось войти через Google');
      console.error(e);
    }
  };

  // Выбор существующего файла базы (до ввода пароля).
  const handlePickFile = async () => {
    setError('');
    setCreateTarget('local');
    if (supportsFS) {
      try {
        const picked = await pickVaultFile();
        if (!picked) return;
        if (!picked.content.startsWith('BASE1:')) {
          setError('Неверный формат файла базы');
          return;
        }
        setPendingFile(picked);
        setVaultName(picked.name);
        setCanReopen(false);
        setMode('unlock');
      } catch (e) {
        setError('Не удалось открыть файл базы');
        console.error(e);
      }
    }
  };

  // Fallback для браузеров без FS API: загрузка файла через <input type=file>.
  const handleOpenFileFallback = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        if (!content.startsWith('BASE1:')) throw new Error('Invalid format');
        setPendingFile({ content, name: file.name, handle: null });
        setVaultName(file.name);
        setMode('unlock');
        setError('');
      } catch {
        setError('Неверный формат файла базы');
      }
    };
    reader.readAsText(file);
  };

  // Переоткрыть последний использованный файл (запрашивает разрешение).
  const handleReopenLast = async () => {
    setError('');
    try {
      const remembered = await recallHandle();
      if (!remembered?.handle) { setCanReopen(false); return; }
      const ok = await verifyPermission(remembered.handle, true);
      if (!ok) { setError('Нет доступа к файлу базы'); return; }
      const content = await readFromHandle(remembered.handle);
      if (!content.startsWith('BASE1:')) { setError('Файл базы повреждён'); return; }
      setPendingFile({ content, name: remembered.name, handle: remembered.handle });
      setVaultName(remembered.name || remembered.handle.name);
      setMode('unlock');
    } catch (e) {
      setError('Не удалось переоткрыть файл базы');
      console.error(e);
    }
  };

  // Разблокировка: расшифровываем выбранный файл (или localStorage-fallback).
  const handleUnlock = async (pw) => {
    try {
      let encryptedData = pendingFile?.content;
      if (!encryptedData) encryptedData = await loadVault();
      if (!encryptedData) throw new Error('Файл базы не выбран');

      const data = await decryptData(encryptedData, pw);

      // Закрепляем активный файл за сессией.
      if (pendingFile?.drive) {
        driveFileRef.current = pendingFile.drive;
        setStorageLocation('drive');
      } else if (pendingFile?.handle) {
        vaultHandleRef.current = pendingFile.handle;
        await rememberHandle(pendingFile.handle, pendingFile.name);
        setStorageLocation('local');
      } else {
        setStorageLocation('localStorage');
      }
      dispatch({ type: 'LOAD', payload: { ...emptyState, ...data } });
      setPassword(pw);
      setPendingFile(null);
      setLocked(false);
      setError('');
    } catch (e) {
      setError('Неверный пароль или файл повреждён');
      console.error(e);
    }
  };

  // Блокировка сессии. signOutGoogle=false сохраняет вход в Google
  // (нужно при переключении файлов на Drive).
  const lockSession = async ({ signOutGoogle = true } = {}) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (password) {
      try { await persist(state); } catch { /* ignore */ }
    }
    setLocked(true);
    setPassword('');
    vaultHandleRef.current = null;
    driveFileRef.current = null;
    setCreateTarget('local');
    setStorageLocation('localStorage');
    if (signOutGoogle) {
      setGoogleProfile(null);
      googleSignOut();
    }
    dispatch({ type: 'LOAD', payload: emptyState });
    if (supportsFS) {
      const remembered = await recallHandle();
      setCanReopen(Boolean(remembered?.handle));
    }
    setMode('unlock');
  };

  const handleTelegramLogin = async (telegramUser) => {
    if (!telegramUser?.id) throw new Error('Не удалось получить данные Telegram');
    const telegramPassword = await deriveTelegramPassword(telegramUser);
    if (mode === 'create') {
      await handleCreate(telegramPassword);
    } else {
      await handleUnlock(telegramPassword);
    }
  };

  const handleLock = () => lockSession({ signOutGoogle: true });

  // Список файлов базы на Google Drive (для панели настроек).
  const handleListDriveFiles = async () => {
    try {
      return await listVaultFiles();
    } catch (e) {
      console.error('Не удалось получить список файлов Drive', e);
      return [];
    }
  };

  // Переключение на другой файл базы на Drive: блокируем сессию (Google вход
  // сохраняется) и отправляем на ввод пароля для выбранного файла.
  const handleSwitchDriveFile = async (file) => {
    try {
      const content = await downloadVaultFile(file.id);
      if (!content.startsWith('BASE1:')) { setError('Файл базы повреждён'); return; }
      await lockSession({ signOutGoogle: false });
      setPendingFile({ content, name: file.name, handle: null, drive: { fileId: file.id, name: file.name } });
      setVaultName(file.name);
      setMode('unlock');
    } catch (e) {
      console.error('Не удалось переключить файл базы', e);
    }
  };

  // Отвязать Google: выйти из аккаунта и заблокировать сессию.
  const handleDisconnectGoogle = async () => {
    await lockSession({ signOutGoogle: true });
  };

  const handleExportVault = async () => {
    if (!password) return;
    try {
      const payload = await encryptData(state, password);
      const success = await saveVaultToFile(payload, vaultName || `vault_${new Date().toISOString().split('T')[0]}.vault`);
      if (success) alert('База успешно экспортирована!');
    } catch (e) {
      alert('Ошибка при экспорте базы');
      console.error(e);
    }
  };

  const handleSaveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persist(state);
  }, [persist, state]);

  const handleImportVault = useCallback(async (file) => {
    if (!password || !file) return;
    try {
      const content = await file.text();
      const decrypted = await decryptData(content, password);
      dispatch({ type: 'LOAD', payload: decrypted });
      // persist immediately so the imported data is saved
      const payload = await encryptData(decrypted, password);
      if (driveFileRef.current?.fileId) {
        await updateVaultOnDrive(driveFileRef.current.fileId, payload);
      } else if (supportsFS && vaultHandleRef.current) {
        const ok = await verifyPermission(vaultHandleRef.current, true);
        if (ok) await writeToHandle(vaultHandleRef.current, payload);
        else await saveVault(payload);
      } else {
        await saveVault(payload);
      }
      setSaveStatus('saved');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: e.message };
    }
  }, [password, supportsFS]);

  // Ctrl+S — немедленное сохранение
  useEffect(() => {
    if (locked) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveNow();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [locked, handleSaveNow]);

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
            onPickFile={handlePickFile}
            onOpenFile={handleOpenFileFallback}
            onReopenLast={handleReopenLast}
            onForgetLast={async () => { await forgetHandle(); setCanReopen(false); setVaultName(''); }}
            onGoogleLogin={handleGoogleLogin}
            hasVault={hasVault}
            supportsFS={supportsFS}
            googleEnabled={googleConfigured()}
            googleProfile={googleProfile}
            createTarget={createTarget}
            pendingFileName={pendingFile?.name || (canReopen ? vaultName : '')}
            canReopen={canReopen}
            error={error}
            onTelegramLogin={handleTelegramLogin}
            telegramAuthConfig={telegramAuthConfig}
          />
        ) : (
          <VaultDashboard
            key="dashboard"
            state={state}
            dispatch={dispatch}
            onLock={handleLock}
            onExportVault={handleExportVault}
            onSaveNow={handleSaveNow}
            onImportVault={handleImportVault}
            saveStatus={saveStatus}
            vaultName={vaultName}
            storageLocation={storageLocation}
            googleProfile={googleProfile}
            onListDriveFiles={handleListDriveFiles}
            onSwitchDriveFile={handleSwitchDriveFile}
            onDisconnectGoogle={handleDisconnectGoogle}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
