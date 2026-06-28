# OMNI TODO Vault — Copilot Instructions

## Commands

```bash
# Frontend dev server (runs on port 1337)
npm run dev

# API proxy server (runs on port 3001) — must be started separately
node server.js

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

No test suite is configured.

## Architecture

Two-process architecture:

- **Frontend**: React 19 SPA built with Vite, served on `http://localhost:1337`
- **Backend proxy** (`server.js`): Express server on `http://localhost:3001` — handles OAuth, OMNI proxy calls, Vertex AI / Imagen, and local Ollama text models

Vite proxies `/api` and `/auth` routes to `http://localhost:3001` in dev. In production, `VITE_API_URL` controls the API base URL (defaults to `http://localhost:3001` at runtime).

The assistant surface now supports two text backends:

- **OMNI** via `/api/omni`
- **Free local models** via Ollama through `/api/ollama` and `/api/ollama/models`

### Data flow

All user data lives **client-side only**, encrypted in `localStorage` under the key `encrypted_vault`. The vault format is:

```
BASE1:<salt_b64>:<iv_b64>:<ciphertext_b64>
```

Encryption uses AES-GCM 256 with a PBKDF2-derived key (250,000 iterations, SHA-256). `src/lib/crypto.js` owns all encrypt/decrypt/export/import logic.

### State management

`App.jsx` holds a single `useReducer` (`appReducer`) as the source of truth for all vault data. The state shape is:

```js
{
  items: [],       // notes, tasks, links, ideas
  projects: [],    // projects with issues[]
  mindmaps: [],    // @xyflow/react graph data (nodes + edges)
  gallery: [],     // AI-generated images
  settings: { theme, color, autoLock, lockTimeout, assistantProvider, freeTextModel },
  cerberHistory: [] // AI assistant chat history
}
```

Every state change triggers an auto-save effect that re-encrypts and writes to `localStorage`. IDs are generated with `Date.now()`.

Assistant settings live inside `state.settings`, not a separate store. In particular, `assistantProvider` and `freeTextModel` persist the selected AI backend and local model between sessions.

### Auth flow (`useAuth.js`)

Optional Google/GitHub OAuth via `server.js`. The hook polls `/auth/status` on mount and listens for `postMessage` events from the OAuth popup window. The app can be used without any OAuth credentials — the vault lock/unlock screen is always available.

## Key Conventions

### Theming

Themes are applied via `data-theme` attribute on the root `<div>` in `App.jsx`. Three themes are defined in `src/index.css`:

- `liwood` (default) — warm cream/paper
- `dark` — dark charcoal
- `cyberpunk` — dark with cyan accent

All components use Tailwind `theme-*` utility classes (`bg-theme-bg`, `text-theme-text`, `text-theme-accent`, `text-theme-muted`, `text-theme-border`, `bg-theme-panel`) which map to CSS variables. **Never hardcode colors** — always use these aliases.

### Component structure

`VaultDashboard.jsx` is the main UI container and defines several internal components (e.g., `BaseView`, `ElegantTitle`) that are not exported separately. `MindmapView.jsx` uses `@xyflow/react` for the graph canvas.

The assistant UI is also inside `VaultDashboard.jsx`. If you change chat/model behavior, update both the **OmniView** chat controls and the **SettingsView** AI configuration panel so the selected backend, health checks, and config fields stay aligned.

### Environment configuration

`server.js` re-reads `.env` on every request via its own parser (not just at startup), so config changes take effect without restarting the server. Copy `.env` and fill in OAuth credentials to enable Google/GitHub login and Imagen image generation. The same runtime config endpoint also persists `OLLAMA_BASE_URL` for local free models.

Required `.env` keys for full functionality:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `GOOGLE_GEMINI_PROJECT` — Vertex AI project for Imagen
- `OLLAMA_BASE_URL` — base URL for local Ollama models (defaults to `http://localhost:11434`)

### Animations

UI transitions use `framer-motion`'s `AnimatePresence` with `mode="wait"`. Follow existing patterns when adding new views or modal transitions.
