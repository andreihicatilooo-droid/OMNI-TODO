## Build System Overview
The project utilizes a modern JavaScript build stack centered around **Vite** for frontend development and bundling, combined with **Express.js** for backend proxy services. Containerization is handled via **Docker** and **Docker Compose**, providing a consistent environment for both development and deployment.

## Key Tools and Frameworks
- **Vite**: Used as the primary build tool and development server for the React frontend. It handles module bundling, HMR (Hot Module Replacement), and asset optimization.
- **npm**: Package manager for dependency resolution and script execution.
- **Docker**: Containerizes the entire application (frontend + backend) into a single image based on `node:20-slim`.
- **Docker Compose**: Orchestrates the container, mapping ports and mounting volumes for local development.
- **Express.js**: A lightweight Node.js server (`server.js`) that acts as a proxy for AI API calls (Google Cloud Vertex AI and CES), bypassing CORS issues and managing authentication tokens.

## Build and Development Workflow
1. **Development**: 
   - Run `npm run dev` to start the Vite dev server on port 1337.
   - The Express proxy server runs independently or within the Docker container on port 3001.
   - Vite is configured to proxy `/api` requests to `http://localhost:3001`, seamlessly integrating frontend and backend during development.
2. **Building**: 
   - `npm run build` triggers Vite to produce optimized static assets in the `dist/` directory.
3. **Containerization**: 
   - The `Dockerfile` installs the Google Cloud SDK, dependencies, and runs both the Express server and Vite dev server concurrently using `sh -c "node server.js & npx vite --host 0.0.0.0"`.
   - `docker-compose.yml` mounts the local source code into the container, enabling live-reload development within a Dockerized environment.

## Architecture and Conventions
- **Monolithic Container Approach**: Both the frontend dev server and backend proxy are housed in a single Docker container. This simplifies deployment for development but may require separation for production-grade scaling.
- **Proxy Pattern**: The backend (`server.js`) is strictly a proxy layer. It does not serve static files but handles secure API interactions with Google Cloud services, keeping API keys and tokens server-side.
- **Environment Configuration**: 
  - `NODE_ENV=development` is set in Docker Compose.
  - Vite config (`vite.config.js`) explicitly allows all hosts (`allowedHosts: 'all'`) and binds to `0.0.0.0` to ensure accessibility from outside the container or local network.

## Rules for Developers
- **Port Consistency**: Ensure ports 1337 (Vite) and 3001 (Express) are available and correctly mapped in `docker-compose.yml` and `vite.config.js`.
- **API Proxying**: All AI-related requests must go through the `/api` prefix to be caught by the Vite proxy and forwarded to the Express server. Direct client-side calls to external AI APIs should be avoided to prevent CORS and security issues.
- **Docker Development**: When using Docker, rely on volume mounts (`.`:/app) for code changes to reflect immediately. Restart the container only when changing dependencies (`package.json`) or Docker configuration.
- **No Makefile/CI**: The project currently lacks a `Makefile` or dedicated CI/CD pipelines (e.g., GitHub Actions). Builds and deployments are manual or script-based via npm and Docker commands.