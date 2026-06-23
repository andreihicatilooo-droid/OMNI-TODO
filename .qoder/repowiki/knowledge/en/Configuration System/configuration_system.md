## Overview

This repository uses a **minimal, convention-based configuration approach** typical of small Vite + React applications. Configuration is distributed across several tool-specific config files rather than centralized in a dedicated configuration management system.

## Configuration Layers

### 1. Build Tool Configuration (Vite)
- **File**: `vite.config.js`
- Uses Vite's `defineConfig` pattern with the React plugin
- Hardcoded development server settings:
  - Port: `1337`
  - Host binding: `true` (accessible from network)
  - Proxy: `/api` routes forwarded to `http://localhost:3001`
- No environment variable interpolation or conditional configuration

### 2. Backend Server Configuration (Express)
- **File**: `server.js`
- Hardcoded port: `3001`
- Hardcoded Google Cloud project IDs and API endpoints embedded directly in code
- Hardcoded file path for OMNI instructions (`C:/Users/G6E6N/Downloads/...`) — this is a developer-specific absolute path that would break in other environments
- Uses `google-auth-library` for authentication (relies on ambient GCP credentials via `GoogleAuth()` with no explicit key file path)

### 3. Environment Variables
- **dotenv** package is installed (`^17.4.2`) but **not actively used** in any source file
- `.env` files are listed in `.dockerignore`, suggesting they may exist locally but are excluded from container builds
- No `.env.example` or documented environment variables found
- `docker-compose.yml` sets only `NODE_ENV=development`

### 4. Container/Deployment Configuration
- **Files**: `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Docker Compose exposes ports `1337` (Vite) and `3001` (Express)
- Volume mounts enable hot-reload during development
- No secret management; GCP credentials expected to be mounted via volume or ambient auth

### 5. Styling Configuration
- **Files**: `tailwind.config.js`, `postcss.config.js`
- Tailwind configured with CSS custom properties (`var(--bg-primary)`, etc.) for theming
- PostCSS uses Tailwind and Autoprefixer plugins

### 6. Linting Configuration
- **File**: `eslint.config.js`
- Flat config format with React Hooks and React Refresh plugins
- Ignores `dist/` directory

## Key Observations

1. **No centralized config module**: Each tool manages its own configuration independently
2. **Hardcoded values dominate**: Ports, API endpoints, GCP project IDs, and file paths are hardcoded rather than externalized
3. **dotenv unused despite installation**: The dependency exists but no `import dotenv from 'dotenv'` or `process.env` usage was found in source files
4. **Ambient credential reliance**: GCP authentication depends on ambient credentials (mounted gcloud config or service account), not explicit key files or env vars
5. **Developer-specific paths**: The OMNI instructions path is an absolute Windows path tied to a specific user's machine

## Recommendations for Developers

- Externalize all hardcoded values (ports, API URLs, GCP project IDs) into environment variables
- Use the installed `dotenv` package to load `.env` files in `server.js`
- Replace the absolute Windows path with a configurable relative path or env var
- Create a `.env.example` documenting required environment variables
- Consider a centralized config module if configuration complexity grows