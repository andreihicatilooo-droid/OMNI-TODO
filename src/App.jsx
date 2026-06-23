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
