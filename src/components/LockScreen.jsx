import { useState, useRef } from 'react';
import { Lock, Shield, KeyRound, Eye, EyeOff, AlertTriangle, Upload, Unlock, FileText, RotateCcw, X, FilePlus2, Cloud, HardDrive } from 'lucide-react';
import { motion } from 'framer-motion';

// Иконка Google (официальные цвета).
const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001 6.19 5.238 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

const LockScreen = ({
  mode, setMode, onUnlock, onCreate, onPickFile, onOpenFile, onReopenLast, onForgetLast, onGoogleLogin,
  hasVault, supportsFS, googleEnabled, googleProfile, createTarget, pendingFileName, canReopen, error,
}) => {
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

  const pickFileFallback = (e) => {
    const file = e.target.files?.[0];
    if (file) onOpenFile(file);
    e.target.value = '';
  };

  // В режиме разблокировки сначала нужно выбрать файл базы (для FS API).
  const needsFileSelection = mode === 'unlock' && supportsFS && !pendingFileName;

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
              ? 'Придумайте мастер-пароль. Файл базы шифруется AES-256. Пароль нельзя восстановить!'
              : needsFileSelection
                ? 'Выберите зашифрованный файл базы для входа'
                : 'Введите мастер-пароль для доступа к выбранному файлу базы'}
          </p>
        </div>

        {/* Выбранный/последний файл базы */}
        {mode === 'unlock' && pendingFileName && (
          <div className="mb-4 flex items-center justify-between gap-2 bg-theme-bg border border-theme-border rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={16} className="text-theme-accent shrink-0" />
              <span className="text-sm text-theme-text truncate">{pendingFileName}</span>
            </div>
            {canReopen && onForgetLast && (
              <button onClick={onForgetLast} title="Забыть файл" className="text-theme-muted hover:text-theme-text transition-colors shrink-0">
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* Кнопка выбора файла (если файл ещё не выбран в режиме разблокировки) */}
        {needsFileSelection ? (
          <div className="space-y-3">
            {googleEnabled && (
              <button
                onClick={onGoogleLogin}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2.5 active:scale-95 border border-gray-200"
              >
                <GoogleIcon /> Войти через Google
              </button>
            )}
            <button
              onClick={onPickFile}
              className="w-full bg-theme-text hover:bg-theme-text/90 text-theme-bg font-semibold py-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <HardDrive size={18} /> Выбрать локальный файл (.vault)
            </button>
            {canReopen && (
              <button
                onClick={onReopenLast}
                className="w-full bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <RotateCcw size={18} className="text-theme-accent" /> Открыть последний файл
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Профиль Google / цель создания на Drive */}
            {googleProfile && (
              <div className="flex items-center gap-2 bg-theme-bg border border-theme-border rounded-lg px-3 py-2.5">
                <Cloud size={16} className="text-theme-accent shrink-0" />
                <span className="text-sm text-theme-text truncate">
                  {googleProfile.email || googleProfile.name}
                </span>
              </div>
            )}
            {mode === 'create' && createTarget === 'drive' && (
              <p className="text-xs text-theme-muted flex items-center gap-1.5">
                <Cloud size={13} className="text-theme-accent" /> Файл базы будет создан на вашем Google Drive
              </p>
            )}
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
              {busy ? 'Обработка...' : mode === 'create'
                ? (createTarget === 'drive'
                    ? <><Cloud size={18} /> Создать на Google Drive</>
                    : <><FilePlus2 size={18} /> Создать файл базы</>)
                : <><Unlock size={18} /> Войти</>}
            </button>

            {/* В режиме создания: альтернатива — создать на Google Drive */}
            {mode === 'create' && createTarget !== 'drive' && googleEnabled && (
              <>
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-theme-border" />
                  <span className="text-xs text-theme-muted">или</span>
                  <div className="flex-1 h-px bg-theme-border" />
                </div>
                <button
                  onClick={onGoogleLogin}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2.5 active:scale-95 border border-gray-200"
                >
                  <GoogleIcon /> Создать на Google Drive
                </button>
              </>
            )}
          </div>
        )}

        {error && needsFileSelection && (
          <div className="mt-4 flex items-center gap-2 text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {/* Fallback для браузеров без File System Access API */}
          {!supportsFS && mode === 'unlock' && (
            <>
              <input ref={fileRef} type="file" accept=".vault,.txt" onChange={pickFileFallback} className="hidden" />
              <button onClick={() => fileRef.current?.click()}
                className="w-full bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm">
                <Upload size={18} className="text-theme-accent" /> Открыть файл базы (.vault)
              </button>
            </>
          )}

          {/* Переключение между созданием и входом */}
          {!needsFileSelection && (
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
          )}
          {needsFileSelection && (
            <button onClick={() => setMode('create')}
              className="w-full text-theme-muted hover:text-theme-text text-xs py-2 transition flex items-center justify-center gap-1 font-medium">
              <FilePlus2 size={12} /> Создать новый файл базы
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default LockScreen;
