This repository uses **npm** as its primary package manager for dependency management, orchestrated within a **Node.js** environment. The project relies on standard npm workflows (`npm install`, `package.json`, `package-lock.json`) to declare and lock third-party libraries.

### Key Systems and Tools
- **Package Manager**: npm (Node Package Manager).
- **Lockfile Strategy**: Uses `package-lock.json` (lockfileVersion 3) to ensure deterministic builds and consistent dependency resolution across environments.
- **Build Tooling**: **Vite** is used as the build tool and dev server, managing frontend dependencies and module bundling.
- **Containerization**: Dependencies are installed via `npm install` inside a Docker container based on `node:20-slim`. The `Dockerfile` copies `package*.json` first to leverage Docker layer caching for dependency installation.

### Dependency Structure
- **Production Dependencies**: Include core UI libraries like `react`, `react-dom`, `framer-motion`, `three` (for 3D graphics), and backend utilities like `express` and `cors`.
- **Development Dependencies**: Include tooling for linting (`eslint`), styling (`tailwindcss`, `autoprefixer`, `postcss`), and type definitions (`@types/react`).

### Conventions and Rules
1. **Lockfile Commitment**: The `package-lock.json` file is committed to version control to guarantee that all developers and CI/CD pipelines install the exact same dependency tree.
2. **Docker Layer Caching**: The `Dockerfile` is structured to copy `package.json` and `package-lock.json` before the rest of the source code. This ensures that `npm install` only re-runs when dependencies change, not on every code modification.
3. **Volume Mapping**: In `docker-compose.yml`, the `node_modules` directory is excluded from host volume mounting (`/app/node_modules`) to prevent host OS incompatibilities with native modules installed inside the Linux-based container.
4. **Private Repository**: The `package.json` marks the project as `"private": true`, preventing accidental publication to the public npm registry.