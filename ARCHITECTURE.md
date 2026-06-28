# OMNI-TODO App: Complete Architecture & Data Structure

## 1. VIEWS/SECTIONS (VaultDashboard.jsx)

The app has **6 main sections** accessed via tabs in the left sidebar:

### View Components:
1. **BaseView** - Knowledge Base (Items Management)
   - Sections: All, Ideas, Tasks, Interesting, Links
   - Item types: `idea`, `task`, `interesting`, `link`

2. **ProjectsView** - Project Management
   - Create/manage projects
   - Track issues per project
   - View progress status

3. **MindmapView** - Visual Mapping
   - Network visualization
   - Node-based organization

4. **OmniView** - Personal AI Assistant
   - Multi-session chat interface
   - Integrated with multiple AI providers
   - Auto-extraction of tasks/projects from conversations

5. **GalleryView** - Image/Media Management
   - Display and manage uploaded images

6. **SettingsView** - Configuration & Sync
   - Export/Import vault
   - Google Drive integration
   - Theme/appearance settings
   - AI provider configuration

---

## 2. DATA STRUCTURE (appReducer & State)

### Initial State:
```javascript
const emptyState = {
  settings: { 
    theme: 'dark',        // Theme preference
    color: '#7c3aed',     // Accent color
    autoLock: true,       // Auto-lock on inactivity
    lockTimeout: 15       // Minutes before auto-lock
  },
  items: [],             // All knowledge base items
  projects: [],          // All projects
  mindmaps: [],          // All mind maps
  gallery: [],           // All images
  cerberHistory: [],     // Legacy chat history (deprecated)
  chatSessions: []       // Chat sessions with messages
};
```

### Item Schema:
```javascript
{
  id: number,                    // Timestamp
  created: string,               // ISO 8601 date
  pinned: boolean,               // Whether pinned/starred
  title: string,                 // Item title
  description: string,           // Main content text
  type: 'idea'|'task'|'interesting'|'link',
  
  // Task-specific fields:
  status?: 'open'|'closed',     // For tasks
  priority?: 'low'|'medium'|'high',  // For tasks
  
  // Link-specific fields:
  url?: string                   // URL for links
}
```

### Project Schema:
```javascript
{
  id: number,                    // Timestamp
  created: string,               // ISO 8601 date
  name: string,                  // Project name
  description: string,           // Project description
  status: 'planning'|'active'|'completed',
  progress: number,              // 0-100 percentage
  issues: array                  // Issue objects (see below)
}
```

### Issue Schema (Project Issues):
```javascript
// Issues array stored in project.issues[]
// Currently displayed but structure not fully fleshed out
// Shows count: "Issues: {project.issues?.length || 0}"
```

### Chat Session Schema:
```javascript
{
  id: number,                    // Timestamp
  name: string,                  // Session name/title
  created: string,               // ISO 8601 date
  messages: [
    {
      role: 'user'|'assistant',
      content: string,           // Message text
      timestamp: string,         // ISO 8601 date
      actions?: array            // Extracted actions (tasks/projects)
    }
  ]
}
```

### Gallery Image Schema:
```javascript
{
  id: number,                    // Timestamp
  created: string,               // ISO 8601 date
  ...other fields                // Additional metadata
}
```

### Mindmap Schema:
```javascript
{
  id: number,                    // Timestamp
  created: string,               // ISO 8601 date
  ...other fields                // Node structure/visualization data
}
```

### Settings Schema:
```javascript
{
  theme: string,                 // Theme name
  color: string,                 // Hex color
  autoLock: boolean,
  lockTimeout: number
}
```

---

## 3. IMPORT/EXPORT FUNCTIONALITY

### Export:
```javascript
// From App.jsx line 417-427
const handleExportVault = async () => {
  if (!password) return;
  try {
    const payload = await encryptData(state, password);
    const success = await saveVaultToFile(
      payload, 
      vaultName || `vault_${new Date().toISOString().split('T')[0]}.vault`
    );
    if (success) alert('База успешно экспортирована!');
  } catch (e) {
    alert('Ошибка при экспорте базы');
  }
};
```

**Encryption Process** (crypto.js line 35-42):
```javascript
export async function encryptData(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = enc.encode(JSON.stringify(orderForSerialization(obj)));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `BASE1:${toB64(salt)}:${toB64(iv)}:${toB64(ciphertext)}`;
}
```

**Serialization Order** (crypto.js line 22-33):
```javascript
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
```

### Import:
```javascript
// From App.jsx line 434-459
const handleImportVault = useCallback(async (file) => {
  if (!password || !file) return;
  try {
    const content = await file.text();
    const decrypted = await decryptData(content, password);
    dispatch({ type: 'LOAD', payload: decrypted });
    // persist immediately
    const payload = await encryptData(decrypted, password);
    if (driveFileRef.current?.fileId) {
      await updateVaultOnDrive(driveFileRef.current.fileId, payload);
    } else if (supportsFS && vaultHandleRef.current) {
      const ok = await verifyPermission(vaultHandleRef.current, true);
      if (ok) await writeToHandle(vaultHandleRef.current, payload);
      else await saveVault(payload);
    } else {
      await saveVault(payload);
    }
    setSaveStatus('saved');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}, [password, supportsFS]);
```

### Decryption:
```javascript
// crypto.js line 44-53
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
```

### Storage Locations (Priority Order):
1. **Google Drive** - If connected and available
2. **File System Access API** - Local .vault file (Chromium browsers)
3. **localStorage** - Browser fallback

### Sync Mechanism:
```javascript
// Auto-save with debounce (App.jsx line 189-194)
useEffect(() => {
  if (locked || !password) return;
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => persist(state), 600);  // 600ms debounce
  return () => saveTimer.current && clearTimeout(saveTimer.current);
}, [state, locked, password, persist]);
```

---

## 4. SERVER.JS - API ROUTES & EXTERNAL CALLS

### Main Endpoints:

#### Authentication Routes:
```
GET  /auth/status                      - Check OAuth status
GET  /auth/google                      - Google OAuth flow
GET  /auth/google/callback             - Google callback
GET  /auth/github                      - GitHub OAuth flow
GET  /auth/github/callback             - GitHub callback
GET  /auth/copilot                     - GitHub Copilot auth
GET  /auth/copilot/callback            - Copilot callback
POST /auth/logout                      - Generic logout
POST /auth/logout/:provider            - Provider-specific logout
POST /api/auth/telegram/callback       - Telegram bot callback
POST /api/auth/:provider/disconnect    - Disconnect provider
```

#### AI/Model Providers:
```
GET  /api/ai/status                    - Check all AI provider status
GET  /api/ai/models                    - List available models
POST /api/gemini                       - Google Gemini generation
POST /api/gemini/chat                  - Gemini chat streaming
POST /api/ollama                       - Ollama local LLM
GET  /api/ollama/models                - List Ollama models
POST /api/vertex-ai/chat               - Google Vertex AI chat
POST /api/anthropic/chat               - Anthropic Claude chat
POST /api/huggingface/chat             - HuggingFace inference
POST /api/github-models/chat           - GitHub Models API
POST /api/inception/chat               - Inception Labs API
```

#### Utilities:
```
GET  /api/config/oauth                 - Get OAuth config
POST /api/config/oauth                 - Update OAuth config
POST /api/github/repos                 - Query GitHub repos
POST /api/generate_image               - Generate images
```

### Server Architecture (Lines 1-90):

```javascript
// CORS with allowlist validation
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:1337,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

const ALLOWED_ORIGIN_SUFFIXES = ['.app.github.dev', '.githubpreview.dev', '.gitpod.io', '.github.dev'];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return ALLOWED_ORIGIN_SUFFIXES.some(suffix => hostname.endsWith(suffix));
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
}));
```

### Session Management (Lines 49-60):
```javascript
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('[WARN] SESSION_SECRET not set — using random secret');
  return generated;
})();

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, sameSite: 'lax' }
}));
```

### AI Client Configuration (Lines 62-78):
- **GitHub Models** - OpenAI-compatible at `https://models.github.ai/inference`
- **Inception Labs** - Diffusion LLM at `https://api.inceptionlabs.ai/v1`
- **Google Vertex AI** - Gemini models
- **OpenAI / Anthropic / HuggingFace** - Third-party APIs

### Stream Response Format (Lines 208-221):
```javascript
// SSE contract for streaming endpoints
const beginSSE = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
};

const sendSSEText = (res, text) => {
  res.write(`data: ${JSON.stringify({ text })}\n\n`);
};

const endSSE = (res) => {
  res.write('data: [DONE]\n\n');
  res.end();
};
```

---

## 5. CRYPTO.JS - ENCRYPTION & FILE HANDLING

### Key Derivation (Lines 7-18):
```javascript
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
```

**Encryption Algorithm**: AES-256-GCM with PBKDF2 key derivation (250,000 iterations)

### File Storage Options (Lines 80-196):

1. **File System Access API** (Modern Chromium):
```javascript
export async function pickVaultFile() {
  const [handle] = await window.showOpenFilePicker({
    types: [{
      description: 'Crypto Vault File',
      accept: { 'application/octet-stream': ['.vault'] }
    }]
  });
  const file = await handle.getFile();
  return { content: await file.text(), name: file.name, handle };
}
```

2. **IndexedDB Handle Persistence** (Lines 143-196):
```javascript
// Remember last opened file
export async function rememberHandle(handle, name) {
  const db = await openHandleDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put({ handle, name }, HANDLE_KEY);
    tx.oncomplete = () => res();
  });
}

export async function recallHandle() {
  const db = await openHandleDB();
  return await new Promise((res) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const r = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
    r.onsuccess = () => res(r.result || null);
  });
}
```

3. **localStorage Fallback** (Lines 56-75):
```javascript
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
    return localStorage.getItem(VAULT_KEY);
  } catch {
    return null;
  }
}
```

### Google Drive Integration (googleDrive.js):
```javascript
// List vault files on Drive
export async function listVaultFiles(token = accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=mimeType='application/octet-stream' and name contains '.vault'&spaces=drive&pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

// Create new vault on Drive
export async function createVaultOnDrive(name, content, token = accessToken) {
  const metadata = { name, mimeType: 'application/octet-stream' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content]));
  
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  return res.json();
}

// Update vault on Drive
export async function updateVaultOnDrive(fileId, content, token = accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: content }
  );
  return res.json();
}
```

---

## 6. PROJECT & ISSUE STRUCTURE

### Project Schema (Full):
```javascript
{
  id: number,                          // Date.now() - unique ID
  created: string,                     // ISO 8601 timestamp
  name: string,                        // "Project Name"
  description: string,                 // Optional description
  status: 'planning'|'active'|'completed',
  progress: number,                    // 0-100 percentage
  issues: Array<Issue>                 // Array of issue objects
}
```

### Issue Schema (Basic):
```javascript
// Current implementation shows:
// - Count displayed: project.issues?.length || 0
// - Created by OMNI orchestrator when user says "create project"
// - Structure not fully detailed in code
// Likely structure:
{
  id: number,
  title: string,
  description?: string,
  status?: string,
  createdAt?: string
}
```

### Reducer Actions for Projects:
```javascript
// ADD_PROJECT
dispatch({
  type: 'ADD_PROJECT',
  payload: {
    name: 'Project Name',
    description: 'Description',
    status: 'planning',
    progress: 0
  }
});

// UPDATE_PROJECT
dispatch({
  type: 'UPDATE_PROJECT',
  payload: {
    id: projectId,
    name: 'New Name',
    progress: 50,
    // ... other fields
  }
});

// DELETE_PROJECT
dispatch({
  type: 'DELETE_PROJECT',
  payload: projectId
});
```

### OMNI Auto-Extraction (Lines 629-638):
The AI can extract projects from chat messages:
```javascript
if (text.toLowerCase().includes('создать проект') || text.toLowerCase().includes('create project')) {
  const projectMatch = text.match(/(?:проект|project)\s*["']([^"']+)["']/i);
  if (projectMatch) {
    actions.push({
      type: 'ADD_PROJECT',
      payload: {
        name: projectMatch[1],
        description: 'Инициировано OMNI Orchestrator'
      }
    });
  }
}
```

---

## KEY PATTERNS & HIGHLIGHTS

1. **Password-Protected**: All data encrypted with AES-256-GCM at rest
2. **Multi-Storage**: Supports Drive, FS API, and localStorage
3. **Real-time Sync**: Auto-saves with 600ms debounce
4. **Multi-AI Support**: Pluggable AI providers (Gemini, Claude, Ollama, etc.)
5. **Chat-driven Operations**: AI can create tasks/projects from natural language
6. **Serverless Ready**: OAuth flows for Google/GitHub/Telegram
7. **Russian UI**: Internationalized interface (mostly Russian)
8. **Theme System**: Dark/light with configurable accent colors

