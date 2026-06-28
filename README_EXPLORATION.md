# OMNI-TODO App: Complete Codebase Exploration

## 📚 Documentation Files

This folder contains comprehensive documentation of the OMNI-TODO codebase:

### 1. **ARCHITECTURE.md** (17 KB)
   Complete architectural breakdown with code snippets:
   - Views/sections structure (6 main components)
   - Full data structure definitions
   - Import/export encryption mechanisms
   - Server.js API routes and external calls
   - Crypto.js implementation details
   - Project & issue schemas
   
   **Best for:** Understanding the complete system architecture, detailed code examples

### 2. **QUICK_REFERENCE.md** (7.4 KB)
   Visual quick-lookup guide:
   - Directory structure overview
   - Views comparison table
   - Data flow diagram
   - Security specifications
   - Storage hierarchy
   - API routes summary
   - Reducer actions checklist
   - Environment variables
   
   **Best for:** Quick lookups, high-level overview, API reference

### 3. **EXPLORATION_SUMMARY.txt** (9.9 KB)
   This file - complete written summary with all findings

---

## 🎯 Quick Facts

| Aspect | Details |
|--------|---------|
| **Views** | 6 main tabs (Base, Projects, Mindmap, OMNI, Gallery, Settings) |
| **Item Types** | idea, task, interesting, link |
| **Encryption** | AES-256-GCM with PBKDF2 (250k iterations) |
| **Storage** | Google Drive → FS API → localStorage |
| **AI Providers** | 7+ (Gemini, Claude, Ollama, HuggingFace, etc.) |
| **Sync** | 600ms debounce auto-save |
| **Main Files** | App.jsx (560), VaultDashboard.jsx (2006), server.js (1668) |

---

## 🔍 What You'll Find

### Complete Data Structures
- Item schema (with type-specific properties)
- Project schema (with issues array)
- Chat session schema
- Settings schema

### Key Patterns
- Client-side encryption with zero server-side storage
- Multi-storage fallback system
- Real-time auto-save with debouncing
- Chat-driven task/project extraction
- Multi-provider OAuth integration

### API Documentation
- 30+ server endpoints documented
- SSE streaming protocol details
- CORS protection strategy
- Session management

### Security
- Encryption algorithm specs
- Key derivation details
- Format specifications
- Storage hierarchy

---

## 🚀 Start Here

1. **For Overview:** Read the summary below, then check QUICK_REFERENCE.md
2. **For Details:** See ARCHITECTURE.md sections
3. **For Implementation:** Look at code snippets in ARCHITECTURE.md

---

## 📋 App Overview

### 6 Main Views:
1. **Base** - Knowledge base with 5 sub-sections (All, Ideas, Tasks, Interesting, Links)
2. **Projects** - Project management with progress tracking and issues
3. **Mindmap** - Visual node-based organization
4. **OMNI** - AI assistant with multi-session chat and auto-extraction
5. **Gallery** - Image/media storage
6. **Settings** - Configuration, export/import, sync controls

### Data Types:
- **Items**: Notes, tasks, bookmarks, links (4 types)
- **Projects**: With progress tracking (0-100%) and issues
- **Chat Sessions**: Multi-session with message history and action extraction
- **Mindmaps**: Visual networks
- **Gallery**: Images with metadata

### Key Features:
✓ Client-side AES-256-GCM encryption  
✓ Password-protected vault  
✓ Auto-save with 600ms debounce  
✓ Multi-storage support (Drive/FS/localStorage)  
✓ 7+ AI provider integration  
✓ Chat-driven task/project creation  
✓ Offline-ready  
✓ Theme customization  

---

## 📁 File Structure

```
OMNI-TODO/
├── src/
│   ├── App.jsx (Main component, auth, persistence)
│   ├── components/
│   │   └── VaultDashboard.jsx (6 views + navbar)
│   └── lib/
│       ├── crypto.js (Encryption, file I/O)
│       ├── googleDrive.js (Google Drive integration)
│       ├── aiClient.js (AI provider abstraction)
│       └── aiProviders.js (Model configuration)
│
├── server.js (Backend API + OAuth)
│
├── ARCHITECTURE.md (Complete breakdown)
├── QUICK_REFERENCE.md (Visual reference)
├── EXPLORATION_SUMMARY.txt (This document)
└── README_EXPLORATION.md (This guide)
```

---

## 🔐 Security Model

**Encryption:**
- Algorithm: AES-256-GCM
- Key Derivation: PBKDF2-SHA256 (250,000 iterations)
- Salt: 16 random bytes
- IV: 12 random bytes
- Format: `BASE1:salt(b64):iv(b64):ciphertext(b64)`

**Storage:**
1. **Google Drive** - If authenticated
   - Scope: `drive.file` (app-created files only)
   - OAuth flow for authentication
   
2. **File System Access API** - Chromium browsers
   - `.vault` files via file picker
   - Handle persisted in IndexedDB
   
3. **localStorage** - Fallback (~5-10MB)

---

## 🤖 AI Integration

**Supported Providers:**
- Google Gemini (text + image)
- OpenAI (via GitHub Models)
- Anthropic Claude
- Ollama (local LLM)
- HuggingFace Inference
- Inception Labs (diffusion)
- Google Vertex AI

**Features:**
- Real-time streaming (SSE protocol)
- Multi-session chat
- Auto-extraction of tasks and projects
- Provider health checking
- Model availability detection

---

## 🔄 Sync Mechanism

**Auto-save:**
```
State Change → Debounce (600ms) → Encrypt → Save to Storage
```

**Priority:**
1. Google Drive (if connected)
2. File System API (Chromium)
3. localStorage (fallback)

**Manual Controls:**
- Ctrl+S / Cmd+S → Immediate save
- Export button → Download encrypted file
- Import button → Decrypt and merge

---

## 📊 Reducer Actions

**Items:** ADD_ITEM, UPDATE_ITEM, DELETE_ITEM  
**Projects:** ADD_PROJECT, UPDATE_PROJECT, DELETE_PROJECT  
**Chat:** ADD_CHAT_SESSION, DELETE_CHAT_SESSION, ADD_MSG_TO_SESSION, APPEND_MSG_TO_SESSION, RENAME_CHAT_SESSION  
**Mindmaps:** ADD_MINDMAP, UPDATE_MINDMAP, DELETE_MINDMAP  
**Gallery:** ADD_IMAGE, DELETE_IMAGE  
**Global:** UPDATE_SETTINGS, LOAD  

---

## 🌟 Highlights

- ✓ Client-side encryption (server never sees plaintext)
- ✓ Intelligent storage fallback system
- ✓ Real-time sync without frequent writes
- ✓ AI-native design (chat-driven operations)
- ✓ Multi-provider OAuth isolation
- ✓ Offline capability
- ✓ Responsive UI (Tailwind CSS)
- ✓ Russian internationalization

---

## 📚 Further Reading

For more details:
- **ARCHITECTURE.md** - Complete code examples and specifications
- **QUICK_REFERENCE.md** - Tabular reference and quick lookups
- Source files: App.jsx, VaultDashboard.jsx, server.js, crypto.js

---

Generated: June 28, 2024 | Comprehensive Exploration Complete ✅
