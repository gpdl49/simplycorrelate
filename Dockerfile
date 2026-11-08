# syntax=docker/dockerfile:1

# ---- build: install all deps, build the SPA and a fully bundled server ----
FROM node:24-alpine AS build
WORKDIR /app
ARG AUBE_VERSION=2.9.0
RUN apk add --no-cache wget \
  && wget -qO- "https://github.com/aubepkg/aube/releases/download/v${AUBE_VERSION}/aube-v${AUBE_VERSION}-$(uname -m)-unknown-linux-musl.tar.gz" \
    | tar xz -C /usr/local/bin aube aubr
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN aube ci
COPY . .
RUN aube run --no-install build

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
