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

export async function encryptData(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = enc.encode(JSON.stringify(obj));
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
      document.body.appendChild(link);
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (err) {
    if (err.name === 'AbortError') return false;
    throw err;
  }
}

