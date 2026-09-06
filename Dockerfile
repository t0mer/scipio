# syntax=docker/dockerfile:1

# --- Build stage: compile TypeScript, prune to production deps ---
FROM node:22-bookworm-slim AS build
ENV PUPPETEER_SKIP_DOWNLOAD=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# --- Runtime stage: system Chromium + Hebrew fonts, non-root ---
FROM node:22-bookworm-slim AS runtime

# System Chromium (do NOT let puppeteer download its own — unreliable on arm64)
# plus Noto fonts so Hebrew renders in the scraped pages.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        fonts-noto \
        fonts-noto-cjk \
        ca-certificates \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    CHROMIUM_PATH=/usr/bin/chromium \
    TZ=Asia/Jerusalem \
    PORT=8080

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Build-time version/commit injection surfaced by GET /version.
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ENV SCIPIO_VERSION=${VERSION} \
    GIT_COMMIT=${GIT_COMMIT}

# Non-root user; /data is writable for optional failure screenshots.
RUN groupadd -r scipio && useradd -r -g scipio -u 10001 scipio \
    && mkdir -p /data \
    && chown -R scipio:scipio /app /data
USER scipio

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
