import { useState, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import LockScreen from './components/LockScreen';
import VaultDashboard from './components/VaultDashboard';
import ShaderBG from './components/ShaderBG';
import {
  encryptData, decryptData, saveVault, loadVault, saveVaultToFile,
  fsAccessSupported, pickVaultFile, createVaultFile, writeToHandle,
  readFromHandle, verifyPermission, rememberHandle, recallHandle, forgetHandle,
} from './lib/crypto';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './components/AuthProviders';

const emptyState = {
  settings: { theme: 'dark', color: '#7c3aed', autoLock: true, lockTimeout: 15 },
  items: [],
  projects: [],
  mindmaps: [],
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
  const { user, isAuthenticated, loading: authLoading, error: authError, signInWithGoogle, signOutGoogle } = useAuth();

  const [locked, setLocked] = useState(true);
  const [mode, setMode] = useState('create');
  const [hasVault, setHasVault] = useState(false);
  const [error, setError] = useState('');
  const [state, dispatch] = useReducer(appReducer, emptyState);
  const [password, setPassword] = useState('');

  // Файл-БД, с которым ведётся работа в текущей сессии.
  const supportsFS = fsAccessSupported();
  const vaultHandleRef = useRef(null);          // активный FS-хэндл (если есть)
  const [vaultName, setVaultName] = useState('');// имя активного файла
  const [pendingFile, setPendingFile] = useState(null); // { content, name, handle } выбран, но не разблокирован
  const [canReopen, setCanReopen] = useState(false);    // есть запомненный последний файл
  const saveTimer = useRef(null);
  const telegramAuthConfig = useMemo(() => import.meta.env.VITE_TELEGRAM_BOT_USERNAME ? {
    enabled: true,
    botUsername: import.meta.env.VITE_TELEGRAM_BOT_USERNAME,
    callbackUrl: import.meta.env.VITE_TELEGRAM_CALLBACK_URL || (import.meta.env.DEV ? 'http://localhost:3001/api/auth/telegram/callback' : `${window.location.origin}/api/auth/telegram/callback`),
  } : { enabled: false, botUsername: '', callbackUrl: '' }, []);

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
    try {
      const payload = await encryptData(nextState, password);
      const handle = vaultHandleRef.current;
      if (supportsFS && handle) {
        const ok = await verifyPermission(handle, true);
        if (ok) {
          await writeToHandle(handle, payload);
          return;
        }
        // нет разрешения — подстрахуемся localStorage
      }
      await saveVault(payload);
    } catch (e) {
      console.error('Не удалось сохранить базу', e);
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
      const payload = await encryptData(emptyState, pw);
      if (supportsFS) {
        const created = await createVaultFile(payload, `omni_${new Date().toISOString().split('T')[0]}.vault`);
        if (!created) return; // пользователь отменил выбор файла
        vaultHandleRef.current = created.handle;
        setVaultName(created.name);
        await rememberHandle(created.handle, created.name);
      } else {
        await saveVault(payload);
      }
      setPassword(pw);
      dispatch({ type: 'LOAD', payload: emptyState });
      setHasVault(true);
      setLocked(false);
    } catch (e) {
      setError('Ошибка при создании файла базы');
      console.error(e);
    }
  };

  // Выбор существующего файла базы (до ввода пароля).
  const handlePickFile = async () => {
    setError('');
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
      if (pendingFile?.handle) {
        vaultHandleRef.current = pendingFile.handle;
        await rememberHandle(pendingFile.handle, pendingFile.name);
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

  const handleLock = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (password) {
      try { await persist(state); } catch { /* ignore */ }
    }
    setLocked(true);
    setPassword('');
    vaultHandleRef.current = null;
    setPendingFile(null);
    dispatch({ type: 'LOAD', payload: emptyState });
    // Предлагаем переоткрыть последний файл при следующем входе.
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

  return (
    <div data-theme={state.settings?.theme || 'liwood'} className="min-h-screen bg-theme-bg font-sans text-theme-text overflow-hidden relative transition-colors duration-500">
      <ShaderBG type="noise" color={state.settings?.theme === 'cyberpunk' ? '#06B6D4' : state.settings?.theme === 'dark' ? '#CBA57A' : '#B89B72'} opacity={0.15} />

      {/* New UI for Auth Status */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px', color: 'white' }}>
        {authLoading ? (
          <p>Loading Auth...</p>
        ) : isAuthenticated ? (
          <div>
            <p>Welcome, {user?.name}!</p>
            <button onClick={signOutGoogle} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}>Sign Out</button>
          </div>
        ) : (
          <div>
            <p>Not authenticated.</p>
            <button onClick={signInWithGoogle} style={{ background: '#008CBA', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}>Sign In with Google</button>
          </div>
        )}
        {authError && <p style={{ color: 'red' }}>Auth Error: {authError}</p>}
      </div>
      {/* End New UI */}

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
            hasVault={hasVault}
            supportsFS={supportsFS}
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
            vaultName={vaultName}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
