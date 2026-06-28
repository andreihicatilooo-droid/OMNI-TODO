// ==========================================================================
// Google Drive интеграция для входа и хранения зашифрованного файла базы.
// Использует Google Identity Services (token model) — в браузере нужен только
// Client ID (без client secret). Scope drive.file даёт доступ только к файлам,
// созданным самим приложением.
// ==========================================================================

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const USERINFO_SCOPE = 'openid email profile';
const VAULT_MIME = 'application/octet-stream';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let gisLoaded = null;
let tokenClient = null;
let accessToken = null;

export function googleConfigured() {
  return Boolean(CLIENT_ID);
}

// Динамически подгружаем скрипт Google Identity Services.
function loadGis() {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Не удалось загрузить Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoaded;
}

// Запрос access token (открывает окно выбора аккаунта Google).
export async function signInWithGoogle() {
  if (!CLIENT_ID) throw new Error('Google Client ID не задан (VITE_GOOGLE_CLIENT_ID)');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: `${DRIVE_SCOPE} ${USERINFO_SCOPE}`,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        accessToken = resp.access_token;
        resolve(accessToken);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function getAccessToken() {
  return accessToken;
}

export function googleSignOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(accessToken, () => {}); } catch { /* ignore */ }
  }
  accessToken = null;
}

// Получаем профиль пользователя (email/имя) для отображения.
export async function getGoogleProfile(token = accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data.email, name: data.name, picture: data.picture };
  } catch {
    return null;
  }
}

// Список файлов базы (.vault), созданных приложением на Google Drive.
export async function listVaultFiles(token = accessToken) {
  const params = new URLSearchParams({
    q: "name contains '.vault' and trashed = false",
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Не удалось получить список файлов с Google Drive');
  const data = await res.json();
  return data.files || [];
}

// Скачиваем зашифрованное содержимое файла по его ID.
export async function downloadVaultFile(fileId, token = accessToken) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Не удалось скачать файл базы с Google Drive');
  return res.text();
}

// Создаём новый зашифрованный файл базы на Google Drive (multipart upload).
export async function createVaultOnDrive(name, content, token = accessToken) {
  const metadata = { name, mimeType: VAULT_MIME };
  const boundary = 'omni_boundary_' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${VAULT_MIME}\r\n\r\n` +
    `${content}\r\n--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error('Не удалось создать файл базы на Google Drive');
  return res.json(); // { id, name }
}

// Обновляем содержимое существующего файла базы на Google Drive.
export async function updateVaultOnDrive(fileId, content, token = accessToken) {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': VAULT_MIME,
    },
    body: content,
  });
  if (!res.ok) throw new Error('Не удалось сохранить файл базы на Google Drive');
  return res.json();
}
