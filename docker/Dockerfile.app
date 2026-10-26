# syntax=docker/dockerfile:1.20

# Builds the app with Vite and Nitro; the runtime image holds only the Nitro output.

ARG BUN_IMAGE=oven/bun:1.4.4-slim

# -------------------------
# Build stage
# -------------------------
FROM ${BUN_IMAGE} AS builder
WORKDIR /app

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

RUN bun run build

# -------------------------
# Runtime stage
# -------------------------
# Nitro bundles the server with its dependencies into .output.
FROM ${BUN_IMAGE} AS runtime
WORKDIR /app/apps/app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=bun:bun /app/apps/app/.output ./.output

USER bun

EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
