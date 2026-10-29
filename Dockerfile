# syntax=docker/dockerfile:1

# ---- build: install all deps, build the SPA and a fully bundled server ----
FROM node:24-alpine AS build
WORKDIR /app
# Newer corepack so it knows the signing keys of current pnpm releases.
RUN npm install -g corepack@latest && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- runtime: node + the build output only ----
# The server is bundled into a single file (esbuild, no --packages=external),
# so no node_modules are needed at runtime. node:sqlite is built into Node 24.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    WEB_DIR=/app/dist/web \
    PORT=8080
COPY --from=build --chown=0:0 /app/dist ./dist
# /data is the PVC (or `-v ./data:/data`); owned by the runtime user when not mounted.
RUN mkdir -p /data && chown 1000:1000 /data
# uid 1000 is the `node` user in the official image.
USER 1000:1000
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
# Nothing is written outside $DATA_DIR, so a read-only root filesystem works.
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server/index.js"]
