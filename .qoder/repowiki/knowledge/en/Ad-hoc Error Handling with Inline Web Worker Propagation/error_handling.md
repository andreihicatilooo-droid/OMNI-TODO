The repository employs a decentralized, ad-hoc error handling strategy typical of small-scale React applications, relying on native JavaScript `try/catch` blocks, inline error state management, and message-passing for asynchronous boundaries.

### 1. Core Approach: Message-Passing & State Flags
- **Web Worker Boundary**: The most complex error logic resides in an inline Web Worker (`src/App.jsx`). Errors occurring inside the worker (e.g., cryptographic failures, session timeouts) are caught and serialized into a `{ id, error: string }` message. The main thread's `CryptoDBClient` then re-throws these as standard `Error` objects.
- **UI State Management**: Components use local `useState` hooks (e.g., `error`, `saveStatus`) to track operation outcomes. These flags drive conditional rendering of error banners or status indicators (e.g., "saved", "error").
- **Server-Side Proxy**: The Express server (`server.js`) uses standard middleware-style `try/catch` blocks at the route level, returning JSON payloads with `error` fields and appropriate HTTP status codes (400, 500).

### 2. Key Patterns
- **Cryptographic Integrity Checks**: In `src/lib/crypto.js` and the Web Worker, specific string-based errors like `'Bad format'`, `'CORRUPTED_PAYLOAD'`, and `'INTEGRITY_COMPROMISED'` are thrown when HMAC verification or payload parsing fails.
- **Duress Protocol**: A specialized error flow exists where entering a specific PIN triggers a `'DURESS_TRIGGERED'` error, which is caught in the main `App` component to render a "Vault Destroyed" screen instead of a standard error message.
- **Silent Failures**: Several non-critical operations (e.g., `saveVault` in `crypto.js`, reading OMNI instructions in `server.js`) catch errors and either return `false`/`null` or log to `console.warn`, allowing the application to continue in a degraded state.
- **User Feedback**: Errors are presented to users via:
  - Inline red banners in `LockScreen.jsx`.
  - Browser `alert()` dialogs for immediate validation feedback (e.g., password mismatch).
  - Status text in the dashboard toolbar (e.g., "saved", "error").

### 3. Conventions & Rules
- **No Custom Error Classes**: The codebase does not define custom `Error` subclasses. Error identification relies on comparing `error.message` strings (e.g., `if (e.message === 'DURESS_TRIGGERED')`).
- **Async/Await Consistency**: All asynchronous operations (IndexedDB, Crypto API, Fetch) are wrapped in `try/catch` blocks. 
- **Worker Error Serialization**: When communicating across the Web Worker boundary, only the `error.message` string is passed back to the main thread, losing the original stack trace.
- **Validation**: Input validation is performed at the UI layer (e.g., checking for empty prompts or short passwords) before triggering asynchronous actions.

### 4. Limitations
- **Lack of Centralized Logging**: Errors are logged via `console.error` or `console.warn` without a unified logging service or error tracking integration.
- **Fragile Error Matching**: Relying on exact string matching for error types (especially across the Worker boundary) is brittle and prone to breaking if error messages are localized or changed.