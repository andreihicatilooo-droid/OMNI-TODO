import React, { useState, useRef } from 'react';
import { Lock, Shield, KeyRound, Eye, EyeOff, AlertTriangle, Upload, Unlock } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthProviders from './AuthProviders';

const LockScreen = ({ mode, setMode, onUnlock, onCreate, onOpenFile, onLogin, hasVault, error, authConfigured }) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'create') {
        if (pw.length < 4) throw new Error('Пароль слишком короткий (мин. 4 символа)');
        if (pw !== pw2) throw new Error('Пароли не совпадают');
        await onCreate(pw);
      } else {
        if (!pw) throw new Error('Пароль не может быть пустым');
        await onUnlock(pw);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onOpenFile(file);
    e.target.value = '';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="min-h-screen flex items-center justify-center px-4 relative z-10"
    >
      <div className="w-full max-w-md bg-theme-panel border border-theme-border rounded-2xl p-8 shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-theme-accent flex items-center justify-center shadow-md mb-4 animate-float">
            {mode === 'create' ? <Shield size={40} className="text-theme-bg" /> : <Lock size={40} className="text-theme-bg" />}
          </div>
          <h1 className="text-2xl font-serif font-bold text-theme-text">
            {mode === 'create' ? 'Создать Локальный сейф' : 'Разблокировать Сейф'}
          </h1>
          <p className="text-theme-muted text-sm text-center mt-2 italic font-serif leading-relaxed">
            {mode === 'create'
              ? 'Придумайте мастер-пароль для шифрования данных на этом устройстве. Пароль нельзя восстановить!'
              : 'Введите пароль для доступа к локально зашифрованным данным.'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <KeyRound size={18} className="absolute left-3 top-3.5 text-theme-accent" />
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (mode === 'unlock' ? submit() : null)}
              placeholder="Мастер-пароль"
              className="w-full bg-theme-bg border border-theme-border rounded-lg pl-10 pr-10 py-3 text-theme-text placeholder-theme-muted/40 focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent/20 transition-all shadow-sm"
            />
            <button onClick={() => setShow(!show)} className="absolute right-3 top-3 text-theme-muted hover:text-theme-text transition-colors">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {mode === 'create' && (
            <div className="relative">
              <KeyRound size={18} className="absolute left-3 top-3.5 text-theme-accent" />
              <input
                type={show ? 'text' : 'password'}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Повторите пароль"
                className="w-full bg-theme-bg border border-theme-border rounded-lg pl-10 pr-4 py-3 text-theme-text placeholder-theme-muted/40 focus:outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent/20 transition-all shadow-sm"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="w-full bg-theme-text hover:bg-theme-text/90 disabled:opacity-50 text-theme-bg font-semibold py-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            {busy ? 'Обработка...' : mode === 'create' ? <><Shield size={18} /> Создать Сейф</> : <><Unlock size={18} /> Войти</>}
          </button>
        </div>
        
        <AuthProviders onLogin={onLogin} busy={busy} configured={authConfigured} />

        <div className="mt-6 border-t border-theme-border pt-4 space-y-3">
          <input ref={fileRef} type="file" accept=".vault,.txt" onChange={pickFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="w-full bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm text-sm">
            <Upload size={16} className="text-theme-accent" /> Открыть файл базы (.vault)
          </button>

          <div className="flex gap-2">
            {mode === 'unlock' && !hasVault && (
               <button onClick={() => setMode('create')}
                className="flex-1 text-theme-muted hover:text-theme-text text-xs py-2 transition flex items-center justify-center gap-1 font-medium">
                Создать новый локальный сейф
              </button>
            )}
             {hasVault && (
              <button onClick={() => setMode(mode === 'create' ? 'unlock' : 'create')}
                className="flex-1 text-theme-muted hover:text-theme-text text-xs py-2 transition flex items-center justify-center gap-1 font-medium">
                {mode === 'create' ? 'Войти в локальный сейф' : 'Создать новый сейф'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LockScreen;
