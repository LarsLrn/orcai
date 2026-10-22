# syntax=docker/dockerfile:1.20

# Optimized multi-stage build for TanStack Start (React) + Vite
# Produces a minimal runtime image that runs the Node server

ARG BUN_IMAGE=oven/bun:1.4.3-slim

# -------------------------
# Production dependencies stage
# -------------------------
FROM ${BUN_IMAGE} AS prod-deps
WORKDIR /app

COPY --parents package.json bun.lock bunfig.toml apps/*/package.json packages/*/package.json ./
RUN bun install --frozen-lockfile --production --ignore-scripts --filter @orcai/app

# -------------------------
# Build stage
# -------------------------
FROM ${BUN_IMAGE} AS builder
WORKDIR /app

# Build-time public envs used by Vite/TanStack Start
ARG VITE_BASE_URL=http://localhost:3000
ARG VITE_WEB_URL=http://localhost:3001
ARG VITE_UMAMI_SCRIPT_URL=
ARG VITE_UMAMI_WEBSITE_ID=

# Copy package files for dependency installation
COPY --parents package.json bun.lock bunfig.toml apps/*/package.json packages/*/package.json ./

# Install all dependencies
RUN bun install --frozen-lockfile --ignore-scripts --filter @orcai/app --filter @orcai/notifications

# Copy the sources the build reads and build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/app ./apps/app

WORKDIR /app/apps/app

ENV NODE_ENV=production
ENV VITE_BASE_URL=${VITE_BASE_URL}
ENV VITE_WEB_URL=${VITE_WEB_URL}
ENV VITE_UMAMI_SCRIPT_URL=${VITE_UMAMI_SCRIPT_URL}
ENV VITE_UMAMI_WEBSITE_ID=${VITE_UMAMI_WEBSITE_ID}

RUN bun run build

# -------------------------
# Runtime stage
# -------------------------
FROM ${BUN_IMAGE} AS runtime
WORKDIR /app/apps/app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# The server bundle inlines the workspace packages and resolves every other
# import through apps/app/node_modules, so the app's dependencies list exactly
# what the bundle leaves external (and their required peers).
COPY --from=prod-deps --chown=bun:bun /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=bun:bun /app/apps/app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/apps/app/package.json /app/apps/app/start-server.ts ./
COPY --from=builder --chown=bun:bun /app/apps/app/dist ./dist

# Switch to non-root user
USER bun

EXPOSE 3000

# Start the Nitro Node server
CMD ["bun", "run", "start"]
