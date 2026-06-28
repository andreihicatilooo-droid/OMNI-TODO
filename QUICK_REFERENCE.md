# OMNI-TODO: Quick Reference

## 📋 STRUCTURE OVERVIEW

```
OMNI-TODO
├── src/
│   ├── App.jsx (550+ lines)
│   │   ├── appReducer: State management (items, projects, chat)
│   │   ├── emptyState: Initial data structure
│   │   ├── Authentication: Google Drive, Telegram, OAuth
│   │   ├── Persistence: Auto-save with 600ms debounce
│   │   └── Encryption: AES-256-GCM with PBKDF2
│   │
│   ├── components/
│   │   └── VaultDashboard.jsx (2000+ lines)
│   │       ├── BaseView: Notes/Tasks/Ideas/Links management
│   │       ├── ProjectsView: Project + issues tracking
│   │       ├── MindmapView: Network visualization
│   │       ├── OmniView: AI chat + auto-extraction
│   │       ├── GalleryView: Image management
│   │       └── SettingsView: Config & sync
│   │
│   └── lib/
│       ├── crypto.js: Encryption/decryption, file handling
│       ├── googleDrive.js: Google Drive OAuth + sync
│       ├── aiClient.js: AI provider abstraction
│       └── aiProviders.js: Model configuration
│
└── server.js (1600+ lines)
    ├── OAuth flows (Google, GitHub, Telegram)
    ├── AI endpoints (Gemini, Ollama, Claude, etc.)
    ├── Config management (.env)
    └── SSE streaming for chat
```

---

## 🗂️ VIEWS (6 Main Tabs)

| View | Purpose | Key Features |
|------|---------|--------------|
| **Base** | Knowledge base | Ideas, Tasks, Interesting links, full-text search |
| **Projects** | Project management | Create projects, track progress (0-100%), manage issues |
| **Mindmap** | Visual organization | Network-based node mapping |
| **OMNI** | AI Assistant | Multi-session chat, auto-extract tasks/projects |
| **Gallery** | Media storage | Image management |
| **Settings** | Configuration | Export/import, Google Drive sync, theme, AI config |

---

## 📊 DATA FLOW

```
User Input
    ↓
Dispatch Action (appReducer)
    ↓
Update State
    ↓
Auto-save (600ms debounce)
    ↓
Encrypt with password
    ↓
Storage (Google Drive → FS API → localStorage)
```

---

## 🔐 SECURITY

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 (250,000 iterations, SHA-256)
- **Format**: `BASE1:salt:iv:ciphertext` (all base64)
- **Storage**: Encrypted file (.vault)

---

## 💾 STORAGE HIERARCHY

1. **Google Drive** (if connected)
   - OAuth: scope `drive.file` (only app-created files)
   - Multipart upload via Google Drive API v3
   - Auto-sync via `updateVaultOnDrive()`

2. **File System Access API** (Chromium browsers)
   - `.vault` files via `showSaveFilePicker()`
   - Last file remembered in IndexedDB
   - Verification via `verifyPermission()`

3. **localStorage** (fallback)
   - Browser-local storage
   - Limited to ~5-10MB

---

## 🤖 AI INTEGRATION

### Supported Providers:
- Google Gemini (text + image generation)
- OpenAI (via GitHub Models)
- Anthropic Claude
- Ollama (local)
- HuggingFace Inference
- Inception Labs (diffusion)

### Server Endpoints:
```
POST /api/gemini/chat          → Stream chat responses
POST /api/ollama               → Local LLM
POST /api/anthropic/chat       → Claude
POST /api/vertex-ai/chat       → Vertex AI
GET  /api/ai/status            → Provider availability
GET  /api/ai/models            → List available models
```

### Chat Features:
- Multi-session support
- Auto-extraction of:
  - Tasks (pattern: `☑️ Task Name | Details`)
  - Projects (pattern: `project "Name"`)
- Real-time streaming (SSE)
- Message history per session

---

## 📝 ITEM TYPES

```javascript
// Items can be one of:
'idea'        // 💡 Brainstorm/note
'task'        // ✅ Task (has status, priority)
'interesting' // 🔖 Bookmark/reference
'link'        // �� URL reference

// Task-specific properties:
status: 'open' | 'closed'
priority: 'low' | 'medium' | 'high'

// Link-specific:
url: string
```

---

## 🚀 API ROUTES (server.js)

### Auth
```
GET  /auth/status                    → Current OAuth state
GET  /auth/google                    → Start Google OAuth
GET  /auth/github                    → Start GitHub OAuth
POST /auth/logout/:provider          → Disconnect provider
POST /api/auth/telegram/callback     → Telegram bot webhook
```

### AI
```
POST /api/gemini                     → Generate text
POST /api/gemini/chat                → Stream chat
POST /api/ollama                     → Local LLM chat
POST /api/anthropic/chat             → Claude
GET  /api/ai/status                  → Provider health
```

### Config
```
GET  /api/config/oauth               → Get OAuth credentials
POST /api/config/oauth               → Update .env
```

---

## 🔄 SYNC MECHANISM

### Auto-save:
```javascript
// Debounced 600ms
useEffect(() => {
  if (locked || !password) return;
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => persist(state), 600);
}, [state, locked, password, persist]);
```

### Manual save:
- **Ctrl+S** / **Cmd+S** → Immediate save
- **Export** → Download encrypted file
- **Import** → Decrypt + merge + re-encrypt

---

## 🗄️ PROJECT/ISSUES SCHEMA

```javascript
// Project
{
  id: timestamp,
  created: ISO8601,
  name: string,
  description: string,
  status: 'planning' | 'active' | 'completed',
  progress: 0-100,
  issues: []  // Array of issue objects
}

// Issue (basic)
{
  id: timestamp,
  title: string,
  description?: string,
  status?: string
}
```

---

## 🔗 REDUCER ACTIONS

```javascript
// Items
'ADD_ITEM'          → New item
'UPDATE_ITEM'       → Modify item
'DELETE_ITEM'       → Remove item

// Projects
'ADD_PROJECT'       → New project
'UPDATE_PROJECT'    → Modify project
'DELETE_PROJECT'    → Remove project

// Chat
'ADD_CHAT_SESSION'  → New session
'ADD_MSG_TO_SESSION' → Add message
'APPEND_MSG_TO_SESSION' → Stream message chunk
'DELETE_CHAT_SESSION' → Remove session
'RENAME_CHAT_SESSION' → Update session name

// Mindmaps
'ADD_MINDMAP'       → New mindmap
'UPDATE_MINDMAP'    → Modify mindmap
'DELETE_MINDMAP'    → Remove mindmap

// Gallery
'ADD_IMAGE'         → New image
'DELETE_IMAGE'      → Remove image

// Global
'UPDATE_SETTINGS'   → Theme/config
'LOAD'              → Bulk load (import)
```

---

## 🔑 KEY FILES

| File | Lines | Purpose |
|------|-------|---------|
| `App.jsx` | 560 | Main React component, auth, persistence |
| `VaultDashboard.jsx` | 2006 | 6 view components + navbar |
| `server.js` | 1668 | Backend API + OAuth flows |
| `crypto.js` | 232 | Encryption, file I/O, IndexedDB |
| `googleDrive.js` | 140+ | Google Drive OAuth + sync |

---

## 💡 PATTERNS & BEST PRACTICES

1. **Password-First**: All data encrypted client-side
2. **Real-time Sync**: Auto-save ensures no data loss
3. **Multi-Provider**: Pluggable AI backends
4. **Offline-Ready**: Works without network (localStorage)
5. **CORS Protected**: Allowlist validation
6. **SSE Streaming**: Efficient chat streaming
7. **Debounced Saves**: Prevents excessive disk writes
8. **Session Isolation**: Separate OAuth sessions per provider

---

## 🌍 ENVIRONMENT VARIABLES

```env
# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# AI APIs
GOOGLE_GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
HUGGINGFACE_API_KEY=...

# Infrastructure
FRONTEND_URL=http://localhost:5173
OLLAMA_BASE_URL=http://localhost:11434
SESSION_SECRET=...
PORT=3001
```

