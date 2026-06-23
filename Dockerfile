# Use node as the base image
FROM node:20-slim

# Install dependencies for gcloud
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install Google Cloud SDK
RUN curl -sSL https://sdk.cloud.google.com | bash
ENV PATH $PATH:/root/google-cloud-sdk/bin

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the ports
# 5173 for Vite
# 3001 for the Express server
EXPOSE 5173
EXPOSE 3001

# Run both the proxy server and the vite dev server
# Note: --host 0.0.0.0 is required for Vite to be accessible from outside the container
CMD ["sh", "-c", "node server.js & npx vite --host 0.0.0.0"]
