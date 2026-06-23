# Logging System Analysis

## Overview

This repository does **not** implement a dedicated logging system. All logging is performed using bare `console` methods (`console.log`, `console.error`, `console.warn`) scattered across application code without any abstraction layer, structured format, or centralized configuration.

## What System/Approach Is Used

- **No logging framework**: The project uses zero third-party logging libraries (no Winston, Pino, Bunyan, Log4js, or similar).
- **Native console API only**: All log output relies exclusively on browser/server native `console` methods:
  - `console.log()` — startup messages, general information
  - `console.error()` — error conditions and exceptions
  - `console.warn()` — non-critical warnings
- **No structured logging**: Log messages are plain strings with no JSON structure, no correlation IDs, no timestamps beyond what the runtime provides, and no standardized fields.
- **No log level management**: There is no mechanism to configure log verbosity at runtime or per-environment.

## Key Files Where Logging Occurs

### Backend (`server.js`)
- Line 34: `console.warn("Could not read OMNI instructions, using default.")`
- Line 70: `console.error("API Error Response:", data)`
- Line 78: `console.error("OMNI Proxy Server Error:", error)`
- Line 119: `console.error("Vertex AI Error Response:", data)`
- Line 126: `console.error("Image Generation Server Error:", error)`
- Line 132: `console.log(\`OMNI Cloud Proxy Server is running on http://0.0.0.0:${port}\`)`

### Frontend (`src/App.jsx`)
- Line 335: `console.error("Auto-save failed", e)`
- Line 353: `console.error(e)`
- Line 368: `console.error(e)`
- Line 405: `console.error(e)`

### Frontend Components
- `src/components/MindmapView.jsx` line 148: `console.error(err)`
- `src/lib/crypto.js` line 48: `console.error('Save failed', e)`

## Architecture and Conventions

### Current State
- **Decentralized**: Each module logs independently with no shared logger instance or utility.
- **Inconsistent formatting**: Some messages include context labels (e.g., `"API Error Response:"`), others just pass the error object directly.
- **No log routing**: All output goes to stdout/stderr (Node.js) or browser DevTools console (frontend). No file sinks, no remote aggregation.
- **No production considerations**: There is no mechanism to suppress debug output in production, nor any log sampling or rate-limiting.

### Implicit Patterns
- Errors caught in `try/catch` blocks are logged via `console.error` before being re-thrown or handled.
- Startup/initialization events use `console.log` for visibility.
- Non-fatal issues use `console.warn`.

## Rules Developers Should Follow

Since no formal logging system exists, developers currently follow these implicit conventions:

1. **Use `console.error` for exceptions**: When catching errors that need visibility, log them with `console.error(err)` or `console.error("Context:", err)`.
2. **Use `console.log` for lifecycle events**: Server startup, major state transitions.
3. **Use `console.warn` for recoverable issues**: Missing optional files, degraded functionality.
4. **Include context in messages**: Prefix error logs with a descriptive label (e.g., `"API Error Response:"`) to aid debugging.
5. **Do not log sensitive data**: Given this is an encrypted vault application, avoid logging plaintext content, passwords, or cryptographic keys.

## Recommendations for Improvement

If a proper logging system were to be introduced:

- **Backend**: Introduce a structured logger (e.g., Pino or Winston) with JSON output, log levels, and file/remote sinks.
- **Frontend**: Consider a lightweight logger wrapper that respects environment variables (e.g., disable debug logs in production builds).
- **Centralize**: Create a shared logger module to enforce consistent formatting and enable future enhancements (correlation IDs, request tracing).
- **Structured fields**: Adopt a standard schema (timestamp, level, message, context, stack trace) for machine-parseable logs.