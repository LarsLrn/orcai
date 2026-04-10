<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/app/src/static/branding/text_white.svg">
    <source media="(prefers-color-scheme: light)" srcset="apps/app/src/static/branding/text_black.svg">
    <img src="apps/app/src/static/branding/text_black.svg" alt="OrcAI" width="320">
  </picture>
</p>

# OrcAI

> [!WARNING]
> OrcAI is still in active development and is not yet ready for production use.

OrcAI is the current product name of the AI-assisted educational platform in this repository. The codebase, package name, Docker service names, storage buckets, and some contact addresses still use legacy `sokratest` identifiers for compatibility. This will eventually change.

## Overview

OrcAI is a research-oriented platform developed at Rhine-Waal University for AI-supported learning workflows. Instructors upload course material, the platform processes and indexes it, and students interact with an AI tutor that can ground responses in those materials via retrieval-augmented generation (RAG).

## Core Capabilities

- AI-assisted chat grounded in course content
- Document ingestion and processing for PDFs, Office files, and images
- Semantic retrieval with Qdrant-backed vector search
- Course and invitation-based access control
- Background job processing for ingestion workflows
- S3-compatible object storage for uploaded and processed assets
- Optional observability with Langfuse, Umami, and OpenTelemetry
- German and English localisation support

## Stack

### Application
- React 19
- TanStack Start
- TanStack Router / Query / Form
- Tailwind CSS 4
- Base UI (shadcn)
- TipTap

### Backend
- Bun
- oRPC
- Better Auth
- Drizzle ORM
- PostgreSQL
- Valkey
- SpiceDB
- Qdrant
- pg-boss

### AI and Processing
- AI SDK
- OpenAI-compatible model endpoint
- Docling document processing service
- PgBoss workers

## Development Workflows

### Devcontainer (recommended)

The repository ships with a VS Code devcontainer based on `.devcontainer/devcontainer.json` and `.devcontainer/docker-compose.dev.yaml`.

Prerequisites:
- Docker
- VS Code with the Dev Containers extension

Steps:
1. Open the repository in VS Code.
2. Run `Dev Containers: Reopen in Container`.
3. Wait for `bun install --frozen-lockfile` to finish.
4. Start the app with `bun run dev`.
5. Open [http://localhost:3000](http://localhost:3000).

What starts automatically:
- PostgreSQL
- Valkey
- MinIO
- Qdrant
- SpiceDB
- Background workers
- Workspace dependency install
- Database migrations
- MinIO bucket bootstrap
- SpiceDB schema migration
- A Bun workspace container with the repository mounted

Notes:
- The devcontainer fixes internal service addresses on the Compose network.
- A one-shot `deps` service runs `bun install --frozen-lockfile` before the `workspace` and `workers` containers start.
- It defaults to an Ollama-compatible endpoint at `http://localhost:11434/v1` for `OPENAI_COMPATIBLE_BASE_URL`.
- `DOCLING_URL` defaults to `http://localhost:8080`, but no Docling container is included in this repo. You must provide that service separately if you want document processing to work.
- Email delivery stays in log-only mode unless `SMTP_HOST` and `SMTP_FROM` are both configured.
- `docker-compose.local.yaml` and `.devcontainer/docker-compose.dev.yaml` are development-only overrides and are not deployment manifests.

### Local Docker Compose app stack

If you want a runnable local stack outside the devcontainer, use:

```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml up -d --build
```

This starts:
- the main app container on `localhost:3000`
- a dedicated workers container for scheduled and background jobs
- PostgreSQL on `localhost:5432`
- Valkey on `localhost:6379`
- MinIO API on `localhost:9000`
- MinIO Console on `localhost:9001`
- Qdrant HTTP on `localhost:6333`
- Qdrant gRPC on `localhost:6334`
- SpiceDB gRPC on `localhost:50051`

Stop it with:

```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml down
```

Notes:
- The local override injects development defaults for required application variables.
- For actual chat completions and document ingestion, you still need reachable `OPENAI_COMPATIBLE_*` and `DOCLING_*` endpoints.
- MinIO buckets and the SpiceDB schema are initialized automatically by one-shot services.

### Manual host setup

Use this when you want to run the Bun app directly on your machine instead of through Compose.

Prerequisites:
- Bun `>=1.3.10`
- PostgreSQL
- Valkey
- Qdrant
- SpiceDB
- S3-compatible object storage
- An OpenAI-compatible inference endpoint
- A Docling service
- Optional SMTP server

Steps:

```bash
cp .env.example .env
bun install --frozen-lockfile
```

Edit `.env`, then run:

```bash
bun run --filter @orcai/db migrate
bun run --filter @orcai/spice-db up
bun run dev
bun run workers:dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

Use `bun run build && bun run start` for the app and `bun run workers:start` for the workers.

## Configuration

The authoritative runtime config is loaded from [config.ts](apps/app/src/lib/effect/services/config.ts).

### Required core variables

- `BASE_URL`: Public base URL for the app. Keep this aligned with `BETTER_AUTH_URL`.
- `BETTER_AUTH_URL`: Public auth callback base URL.
- `VITE_BASE_URL`: Public frontend base URL used in client-side links.
- `BETTER_AUTH_SECRET`: Better Auth signing secret.
- `ENCRYPTION_KEY`: 32 to 64 character application encryption key.

### Required infrastructure variables

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `VALKEY_URL`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `SPICEDB_ENDPOINT`
- `SPICEDB_TOKEN`

### Required AI variables

- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `DOCLING_URL`
- `DOCLING_API_KEY`

### Optional variables

- `S3_REGION`: Defaults to `eu-central-1`.
- `S3_PUBLIC_ENDPOINT`: Optional public endpoint for presigned URLs.
- `QDRANT_ENABLE_SPARSE_VECTORS`: Defaults to `false`. Enable only on a fresh or reindexed collection.
- `SMTP_*`: Optional. If you enable SMTP delivery, `SMTP_HOST` and `SMTP_FROM` must both be set. `SMTP_USERNAME` and `SMTP_PASSWORD` must either both be set or both be omitted.
- `LANGFUSE_*`: Optional Langfuse tracing and observability.
- `VITE_UMAMI_*`: Optional Umami analytics injection.
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`: Optional OpenTelemetry export configuration.

See [.env.example](.env.example) for a current baseline.

## Common Commands

- `bun run dev`: start the development server
- `bun run build`: build the app
- `bun run start`: run the production server from `dist`
- `bun run workers:dev`: start worker process directly on the host
- `bun run workers:start`: run worker process in production mode
- `bun run lint`: run Biome and TypeScript checks
- `bun run --filter @orcai/db migrate`: apply SQL migrations
- `bun run --filter @orcai/db generate`: generate a new Drizzle migration
- `bun run --filter @orcai/db studio`: open Drizzle Studio
- `bun run --filter @orcai/spice-db up`: apply the SpiceDB schema
- `bun run --filter @orcai/spice-db status`: inspect SpiceDB schema migration status

## Architecture Summary

1. Instructors upload course material.
2. Background jobs process files and extract content.
3. Processed content is stored in S3-compatible buckets and indexed in Qdrant.
4. Students interact with the OrcAI chat interface.
5. Relevant course context is retrieved and sent to the configured model endpoint.
6. Responses and optional observability signals are returned through the app.

## Research Context

OrcAI remains part of the Sokratesᵗ research initiative at Rhine-Waal University and is currently restricted to invited participants.

Important constraints:
- This is still an experimental platform.
- Regular backups are not guaranteed during testing.
- Chat quality depends on the configured model endpoint and indexed course material.

## Contact

For collaboration or project questions, contact [sokratest@hochschule-rhein-waal.de](mailto:sokratest@hochschule-rhein-waal.de).

## Funding Notice

OrcAI continues the work of the Sokratesᵗ project at Rhine-Waal University.

Project links:
- [About Sokratesᵗ](https://www.hochschule-rhein-waal.de/de/fakultaeten/kommunikation-und-umwelt/forschungsprojekte/sokratest)
- [About KI:edu.nrw](https://ki-edu-nrw.ruhr-uni-bochum.de/ueber-das-projekt/phase-2/praxis-transferprojekte/aktuelle-praxisprojekte/#sokratest)

Supported by:
- KI:edu.nrw
- DH.nrw
- MKW NRW
