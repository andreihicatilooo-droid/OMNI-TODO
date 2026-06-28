const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));

export async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Сериализуем состояние так, чтобы НАСТРОЙКИ шли первыми, затем данные.
// Внутри зашифрованного файла порядок: meta -> settings -> данные.
function orderForSerialization(obj) {
  const { settings, items, projects, mindmaps, gallery, ...rest } = obj || {};
  return {
    _meta: { format: 'OMNI-VAULT', version: 1, updatedAt: new Date().toISOString() },
    settings: settings || {},
    items: items || [],
    projects: projects || [],
    mindmaps: mindmaps || [],
    gallery: gallery || [],
    ...rest,
  };
}

export async function encryptData(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = enc.encode(JSON.stringify(orderForSerialization(obj)));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `BASE1:${toB64(salt)}:${toB64(iv)}:${toB64(ciphertext)}`;
}

export async function decryptData(payload, password) {
  const parts = payload.split(':');
  if (parts[0] !== 'BASE1' || parts.length !== 4) throw new Error('Bad format');
  const salt = fromB64(parts[1]);
  const iv = fromB64(parts[2]);
  const ciphertext = fromB64(parts[3]);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(dec.decode(plaintext));
}

// PERSISTENT STORAGE
const VAULT_KEY = 'encrypted_vault';

export async function saveVault(payload) {
  try {
    localStorage.setItem(VAULT_KEY, payload);
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}

export async function loadVault() {
  try {
    const res = localStorage.getItem(VAULT_KEY);
    return res;
  } catch {
    return null;
  }
}

// FILE SYSTEM ACCESS
// Поддерживается ли File System Access API (Chromium). Если нет — используется
// fallback на localStorage + ручной экспорт/импорт.
export function fsAccessSupported() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

export async function pickVaultFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'Crypto Vault File',
        accept: { 'application/octet-stream': ['.vault'] }
      }],
      multiple: false
    });
    const file = await handle.getFile();
    const content = await file.text();
    return { content, name: file.name, handle };
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

// Создаёт новый файл базы (диалог "Сохранить как") и записывает в него
// зашифрованное содержимое. Возвращает { handle, name } или null при отмене.
export async function createVaultFile(content, suggestedName = 'omni.vault') {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{
        description: 'OMNI Encrypted Database',
        accept: { 'application/octet-stream': ['.vault'] }
      }]
    });
    await writeToHandle(handle, content);
    return { handle, name: handle.name };
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

// Запись зашифрованного содержимого обратно в выбранный файл.
export async function writeToHandle(handle, content) {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return true;
}

// Чтение содержимого по сохранённому хэндлу (для переоткрытия последнего файла).
export async function readFromHandle(handle) {
  const file = await handle.getFile();
  return file.text();
}

// Проверка/запрос разрешения на чтение-запись для хэндла.
export async function verifyPermission(handle, readWrite = true) {
  const opts = { mode: readWrite ? 'readwrite' : 'read' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

// --- Запоминание последнего открытого файла (IndexedDB хранит FS-хэндлы) ---
const HANDLE_DB = 'omni-vault-db';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'last';

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function rememberHandle(handle, name) {
  try {
    const db = await openHandleDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite');
      tx.objectStore(HANDLE_STORE).put({ handle, name }, HANDLE_KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function recallHandle() {
  try {
    const db = await openHandleDB();
    return await new Promise((res) => {
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const r = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

export async function forgetHandle() {
  try {
    const db = await openHandleDB();
    await new Promise((res) => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite');
      tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch { /* ignore */ }
}

export async function saveVaultToFile(content, filename = 'data.vault') {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Crypto Vault File',
          accept: { 'application/octet-stream': ['.vault'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } else {
      // Fallback to traditional download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (err) {
    if (err.name === 'AbortError') return false;
    throw err;
  }
}

