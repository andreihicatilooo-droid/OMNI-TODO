import React, { useState, useEffect } from 'react';
import { Database, Unlink, Link2, Loader2, AlertCircle, CheckCircle, Copy } from 'lucide-react';

const AnytypePanel = ({ state, dispatch }) => {
  const [isAvailable, setIsAvailable] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('check'); // check, challenge, spaces, connected

  // Check if AnyType is available on startup
  useEffect(() => {
    checkAnytypeAvailability();
  }, []);

  const checkAnytypeAvailability = async () => {
    try {
      const res = await fetch('/api/anytype/check', { method: 'POST' });
      const data = await res.json();
      setIsAvailable(data.available);
      if (data.available) {
        checkConnectionStatus();
      }
    } catch (e) {
      setIsAvailable(false);
      setError('Cannot reach AnyType API. Make sure AnyType app is running on localhost:31009');
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const res = await fetch('/api/anytype/spaces', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setConnected(true);
          setSpaces(data.spaces);
          setStep('connected');
          return;
        }
      }
    } catch (e) {
      // Not connected yet
    }
    setConnected(false);
    setStep('challenge');
  };

  const handleStartChallenge = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/anytype/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: 'OMNI-TODO' })
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to create challenge');
        return;
      }

      setChallengeId(data.challengeId);
      setShowChallenge(true);
      setStep('challenge');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExchangeCode = async () => {
    if (!code || code.length !== 4) {
      setError('Code must be exactly 4 digits');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/anytype/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          code: parseInt(code)
        })
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Code exchange failed');
        return;
      }

      // Fetch spaces after authentication
      const spacesRes = await fetch('/api/anytype/spaces');
      const spacesData = await spacesRes.json();
      if (spacesData.ok) {
        setSpaces(spacesData.spaces);
        setConnected(true);
        setShowChallenge(false);
        setCode('');
        setStep('connected');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await fetch('/api/anytype/disconnect', { method: 'POST' });
      setConnected(false);
      setSpaces([]);
      setSelectedSpace(null);
      setShowChallenge(false);
      setCode('');
      setChallengeId('');
      setStep('challenge');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToAnytype = async () => {
    if (!selectedSpace) {
      setError('Please select a space');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Sync vault data
      const res = await fetch('/api/anytype/vault/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceId: selectedSpace,
          vaultData: state
        })
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Sync failed');
        return;
      }

      setError('');
      alert(`✅ Vault synced to AnyType! Object ID: ${data.objectId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Not available
  if (isAvailable === false) {
    return (
      <div className="glass-panel p-6 sm:p-8">
        <h3 className="text-xl font-serif font-bold text-theme-text mb-4 flex items-center gap-2 border-b border-theme-border pb-4">
          <Database className="text-theme-accent" /> AnyType Integration
        </h3>
        <div className="flex items-start gap-3 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">AnyType API не доступен</p>
            <p className="text-xs opacity-75">Убедитесь, что приложение AnyType запущено (API должен быть доступен на localhost:31009)</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading check
  if (isAvailable === null) {
    return (
      <div className="glass-panel p-6 sm:p-8">
        <h3 className="text-xl font-serif font-bold text-theme-text mb-4 flex items-center gap-2">
          <Database className="text-theme-accent" /> AnyType Integration
        </h3>
        <div className="flex items-center gap-2 text-sm text-theme-muted">
          <Loader2 size={16} className="animate-spin" /> Проверка доступности...
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 sm:p-8">
      <h3 className="text-xl font-serif font-bold text-theme-text mb-6 flex items-center gap-2 border-b border-theme-border pb-4">
        <Database className="text-theme-accent" /> AnyType Integration
      </h3>

      {error && (
        <div className="mb-4 flex items-start gap-2 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {!connected ? (
        <div className="space-y-4">
          <p className="text-sm text-theme-muted">
            Синхронизируйте данные вашего хранилища OMNI с локальным AnyType через безопасную challenge-based аутентификацию.
          </p>

          {!showChallenge ? (
            <button
              onClick={handleStartChallenge}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-all"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Инициализация...
                </>
              ) : (
                <>
                  <Link2 size={16} /> Подключить AnyType
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3 bg-theme-panel/40 rounded-lg p-4">
              <p className="text-sm font-medium text-theme-text">Введите 4-значный код из приложения AnyType</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength="4"
                  placeholder="0000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-text placeholder-theme-muted focus:outline-none focus:border-theme-accent"
                />
                <button
                  onClick={handleExchangeCode}
                  disabled={loading || code.length !== 4}
                  className="bg-theme-accent hover:bg-theme-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Подтвердить'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">Подключено к AnyType</span>
          </div>

          {spaces.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-theme-text">
                Выберите пространство для синхронизации
              </label>
              <select
                value={selectedSpace || ''}
                onChange={(e) => setSelectedSpace(e.target.value)}
                className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-text focus:outline-none focus:border-theme-accent"
              >
                <option value="">-- Выберите пространство --</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name || 'Untitled Space'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSyncToAnytype}
              disabled={loading || !selectedSpace}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-all"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Синхронизация...
                </>
              ) : (
                <>
                  <Copy size={16} /> Синхронизировать
                </>
              )}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-theme-panel border border-theme-border hover:bg-theme-panel/80 disabled:opacity-50 disabled:cursor-not-allowed text-theme-text font-medium py-2.5 px-4 rounded-lg transition-all"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Unlink size={16} /> Отключить
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-theme-muted bg-theme-panel/40 rounded-lg p-3">
            <p className="font-medium mb-1">ℹ️ О синхронизации</p>
            <p>Ваши данные будут сохранены в виде объекта в выбранном пространстве AnyType. Все операции выполняются локально на вашем устройстве и полностью зашифрованы.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnytypePanel;
