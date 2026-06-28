import { useState, useRef, useEffect } from 'react';
import { Lock, Shield, KeyRound, Eye, EyeOff, AlertTriangle, Upload, Unlock, FileText, RotateCcw, X, FilePlus2 } from 'lucide-react';
import { motion } from 'framer-motion';

const LockScreen = ({
  mode, setMode, onUnlock, onCreate, onPickFile, onOpenFile, onReopenLast, onForgetLast,
  hasVault, supportsFS, pendingFileName, canReopen, error,
  onTelegramLogin, telegramAuthConfig,
}) => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState('');
  const fileRef = useRef(null);
  const telegramWidgetRef = useRef(null);

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

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.source !== 'omni-telegram-auth') return;
      if (event.data.ok) {
        setTelegramBusy(true);
        setTelegramMessage('');
        Promise.resolve(onTelegramLogin?.(event.data.user))
          .catch((e) => setTelegramMessage(e?.message || 'Не удалось выполнить вход через Telegram'))
          .finally(() => setTelegramBusy(false));
      } else {
        setTelegramMessage(event.data.error || 'Не удалось выполнить вход через Telegram');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTelegramLogin]);

  useEffect(() => {
    if (!telegramAuthConfig?.enabled || !telegramWidgetRef.current || typeof window === 'undefined') {
      return undefined;
    }

    const container = telegramWidgetRef.current;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', telegramAuthConfig.botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', telegramAuthConfig.callbackUrl);
    script.setAttribute('data-request-access', 'write');
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [telegramAuthConfig?.enabled, telegramAuthConfig?.botUsername, telegramAuthConfig?.callbackUrl]);

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
            <button
              onClick={onPickFile}
              className="w-full bg-theme-text hover:bg-theme-text/90 text-theme-bg font-semibold py-3 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
            >
              <Upload size={18} /> Выбрать файл базы (.vault)
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
                ? <><FilePlus2 size={18} /> Создать файл базы</>
                : <><Unlock size={18} /> Войти</>}
            </button>

            <div className="flex items-center gap-2 text-theme-muted">
              <div className="h-px flex-1 bg-theme-border" />
              <span className="text-[11px] uppercase tracking-[0.2em]">или</span>
              <div className="h-px flex-1 bg-theme-border" />
            </div>

            {telegramAuthConfig?.enabled ? (
              <div className="space-y-2">
                <div ref={telegramWidgetRef} className="flex justify-center" />
                {telegramBusy && <p className="text-center text-sm text-theme-muted">Выполняем вход через Telegram…</p>}
                {telegramMessage && (
                  <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <AlertTriangle size={16} /> {telegramMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-theme-border bg-theme-bg/60 px-3 py-2 text-center text-[11px] leading-relaxed text-theme-muted">
                Вход через Telegram будет доступен после настройки <span className="font-mono">VITE_TELEGRAM_BOT_USERNAME</span> и <span className="font-mono">TELEGRAM_BOT_TOKEN</span>.
              </div>
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
