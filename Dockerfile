# === Stage 1: Build ===
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency manifests first for better cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/
COPY tsconfig.base.json ./

# Build all packages (server tsc + client vite)
# Increase memory limit for Vite build
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN pnpm build

# === Stage 2: Production ===
FROM node:22-slim AS production

# Create non-root user (Claude CLI refuses to run as root)
RUN groupadd -r darkboss && useradd -r -m -g darkboss darkboss

WORKDIR /app

# Copy workspace manifests (needed for workspace resolution at runtime)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install production dependencies only
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --frozen-lockfile --prod

# Copy built artifacts FROM builder
COPY --from=builder /app/packages/server/dist/ packages/server/dist/
COPY --from=builder /app/packages/shared/ packages/shared/
COPY --from=builder /app/packages/client/dist/ packages/client/dist/

# Create data directory and claude mount point, set ownership
RUN mkdir -p /home/darkboss/.dark-boss /host-claude \
    && chown -R darkboss:darkboss /app /home/darkboss /host-claude \
    # Pre-create claude symlink as root (the mounted dir may not exist yet at build time)
    && ln -sf /host-claude/node_modules/@anthropic-ai/claude-code/bin/claude.exe /usr/local/bin/claude

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/packages/server
USER darkboss
CMD ["node", "dist/index.js"]
