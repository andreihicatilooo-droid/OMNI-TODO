import React, { useState } from 'react';
import { Eye, EyeOff, AlertTriangle, Shield, Skull } from 'lucide-react';
import { motion } from 'framer-motion';

const LockScreen = ({ onUnlock, error }) => {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !pw) return;
    setBusy(true);
    await onUnlock(pw);
    setBusy(false);
    setPw('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen flex items-center justify-center px-4 relative z-10"
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-theme-accent/15 border border-theme-accent/25 flex items-center justify-center">
            <Shield size={28} className="text-theme-accent" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-serif font-bold text-theme-text tracking-[0.2em] uppercase">OMNI Vault</h1>
            <p className="text-theme-muted text-xs mt-1 font-mono">AES-GCM-256 · HMAC-SHA-256</p>
          </div>
        </div>

        {/* Input card */}
        <div className="bg-theme-panel border border-theme-border rounded-2xl p-6 space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Мастер-пароль..."
              autoFocus
              className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 pr-11 py-3 text-theme-text placeholder-theme-muted/40 focus:outline-none focus:border-theme-accent transition-all text-sm"
            />
            <button
              onClick={() => setShow(!show)}
              className="absolute right-3 top-3 text-theme-muted hover:text-theme-text transition-colors"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy || !pw}
            className="w-full bg-theme-accent hover:bg-theme-accent-hover disabled:opacity-40 text-theme-bg font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-theme-bg/40 border-t-theme-bg rounded-full animate-spin" />
                Дешифровка...
              </span>
            ) : (
              <><Shield size={15} /> Открыть хранилище</>
            )}
          </button>
        </div>

        {/* Duress warning */}
        <div className="flex items-start gap-2 text-[11px] text-theme-muted/50 px-1">
          <Skull size={11} className="mt-0.5 shrink-0 text-red-500/40" />
          <span>
            Тревожный PIN активирует необратимое криптографическое уничтожение данных.
            Пароль восстановлению не подлежит.
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default LockScreen;
import React, { useState, useRef } from 'react';
import { Lock, Shield, KeyRound, Eye, EyeOff, AlertTriangle, Upload, Unlock } from 'lucide-react';
import { motion } from 'framer-motion';

const LockScreen = ({ mode, setMode, onUnlock, onCreate, onOpenFile, hasVault, error }) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const submit = async () => {
    if (busy) return;
    if (mode === 'create') {
      if (pw.length < 4) return alert('Пароль слишком короткий (мин. 4 символа)');
      if (pw !== pw2) return alert('Пароли не совпадают');
      setBusy(true);
      await onCreate(pw);
      setBusy(false);
    } else {
      if (!pw) return;
      setBusy(true);
      await onUnlock(pw);
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
            {mode === 'create' ? 'Создать хранилище' : 'Разблокировать'}
          </h1>
          <p className="text-theme-muted text-sm text-center mt-2 italic font-serif leading-relaxed">
            {mode === 'create'
              ? 'Придумайте мастер-пароль. Данные шифруются AES-256. Пароль нельзя восстановить!'
              : 'Введите мастер-пароль для доступа к зашифрованным данным'}
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
            {busy ? 'Обработка...' : mode === 'create' ? <><Shield size={18} /> Создать</> : <><Unlock size={18} /> Войти</>}
          </button>
        </div>
        
        <div className="mt-6 space-y-3">
          <input ref={fileRef} type="file" accept=".vault,.txt" onChange={pickFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="w-full bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm">
            <Upload size={18} className="text-theme-accent" /> Открыть файл базы (.vault)
          </button>

          <div className="flex gap-2">
            {hasVault && mode === 'create' && (
              <button onClick={() => setMode('unlock')}
                className="flex-1 text-theme-muted hover:text-theme-text text-xs py-2 transition flex items-center justify-center gap-1 font-medium">
                <Unlock size={12} /> Войти в существующую
              </button>
            )}
            <button onClick={() => setMode(mode === 'create' ? 'unlock' : 'create')}
              className="flex-1 text-theme-muted hover:text-theme-text text-xs py-2 transition flex items-center justify-center gap-1 font-medium">
              {mode === 'create' ? 'Уже есть база?' : 'Создать новую'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LockScreen;
