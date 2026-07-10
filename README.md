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

## Overview

OrcAI is a self-hostable platform for building governed AI assistants around curated knowledge. Individuals, specialist teams, educators, and research groups can upload source material, process and index it, compose reusable assistants, control access, and ground responses through retrieval-augmented generation (RAG).

## Core Capabilities

- AI-assisted chat grounded in course content
- Document ingestion and processing for PDFs, Office files, and images
- Semantic retrieval with Qdrant-backed vector search
- Course and invitation-based access control
- Background job processing for ingestion workflows
- S3-compatible object storage for uploaded and processed assets
- Optional observability with Umami and OpenTelemetry
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
- Kreuzberg document processing
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
- OCR-backed asset processing runs in the worker process and requires Tesseract plus the `eng` and `deu` language packs when you run workers outside Docker.
- OCR language defaults to `eng` on host setups. Set `KREUZBERG_OCR_LANGUAGE=eng+deu` only where both Tesseract packs are installed.
- Email delivery stays in log-only mode unless `SMTP_HOST` and `SMTP_FROM` are both configured.
- Log-only email mode writes complete messages, including authentication and invitation links, to application logs for local testing. Configure SMTP in production and treat log-only output as sensitive.
- `docker-compose.local.yaml` and `.devcontainer/docker-compose.dev.yaml` are development-only overrides and are not deployment manifests.

### Local Docker Compose app stack

If you want a runnable local stack outside the devcontainer, use:

```bash
docker compose -f docker-compose.yaml -f docker-compose.local.yaml up -d --build
```

This starts:
- the main app container on `localhost:3000`
- the docs/web container on `localhost:3001`
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
- For embeddings and image processing, you still need a configured `OPENAI_COMPATIBLE_*` endpoint.
- `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` must match across the app, workers, and Qdrant collection. Changing them on an existing deployment is not supported right now.
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
- Tesseract with `eng` and `deu` language packs if workers run on the host
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

Runtime configuration is loaded across app and package config modules:

- [apps/app/src/lib/effect/services/config.ts](apps/app/src/lib/effect/services/config.ts)
- [packages/ai/src/config.ts](packages/ai/src/config.ts)
- [packages/db/src/config.ts](packages/db/src/config.ts)
- [packages/notifications/src/config.ts](packages/notifications/src/config.ts)
- [packages/qdrant/src/config.ts](packages/qdrant/src/config.ts)
- [packages/s3/src/server/config.ts](packages/s3/src/server/config.ts)
- [packages/spice-db/src/config.ts](packages/spice-db/src/config.ts)
- [packages/valkey/src/config.ts](packages/valkey/src/config.ts)

### Core URL and auth variables

- `BASE_URL`: Compatibility fallback used by some auth tooling. Keep this aligned with `BETTER_AUTH_URL` when set.
- `BETTER_AUTH_URL`: Public auth callback base URL.
- `VITE_BASE_URL`: Public frontend base URL used in client-side links.
- `VITE_WEB_URL`: Public docs site base URL used by the app dashboard (optional).
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

SpiceDB optional:

- `SPICEDB_SECURITY`: Transport mode for SpiceDB client. Valid values: `secure`, `insecure-localhost`, `insecure-plaintext` (default).

### Required AI variables

- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `EMBEDDING_MODEL`: Embedding model exposed by your configured OpenAI-compatible endpoint.
- `EMBEDDING_DIMENSIONS`: Positive integer output size of `EMBEDDING_MODEL` and Qdrant dense vector size.
- `GENERAL_MODEL`: General-purpose text/image-capable model used by the worker image-description step.

Model-scope note:

- Custom embedding and image-processing model definitions are supported only in self-hosted deployments.

### Optional variables

- `KREUZBERG_OCR_LANGUAGE`: OCR languages for background asset processing. Defaults to `eng`; use `eng+deu` only where both Tesseract packs are available.
- `S3_REGION`: Defaults to `eu-central-1`.
- `S3_PUBLIC_ENDPOINT`: Optional public endpoint for presigned URLs.
- `SMTP_*`: Optional. If you enable SMTP delivery, `SMTP_HOST` and `SMTP_FROM` must both be set. `SMTP_USERNAME` and `SMTP_PASSWORD` must either both be set or both be omitted. If `SMTP_SECURE` is unset, it is derived from port (`true` for 465, otherwise `false`).
- `VITE_UMAMI_*`: Optional Umami analytics injection.
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`: Optional OpenTelemetry export configuration.

Embedding note:
- Changing `EMBEDDING_MODEL` or `EMBEDDING_DIMENSIONS` after assets have already been indexed is not supported right now. Recreate the Qdrant collection and reprocess assets instead of mixing old and new embeddings.

See [.env.example](.env.example) for a current baseline.

## Common Commands

- `bun run dev`: start the development server
- `bun run build`: build the app and documentation site
- `bun run build:app`: build only the main app
- `bun run build:web`: build only the documentation site
- `bun run start`: run the production server from `dist`
- `bun run workers:dev`: start worker process directly on the host
- `bun run workers:start`: run worker process in production mode
- `bun run lint`: run Biome and TypeScript checks
- `bun run ci`: run the same lint, test, docs type-check, and build suite used by GitHub Actions
- `bun run --filter @orcai/db migrate`: apply SQL migrations
- `bun run --filter @orcai/db generate`: generate a new Drizzle migration
- `bun run --filter @orcai/db studio`: open Drizzle Studio
- `bun run --filter @orcai/spice-db up`: apply the SpiceDB schema
- `bun run --filter @orcai/spice-db status`: inspect SpiceDB schema migration status

## Contributing

Contributions to the main repository should follow this workflow:

1. Create a branch from the latest `main`.
2. Implement your change with focused scope.
3. Run local checks.
4. Commit with Conventional Commit format.
5. Open a pull request with validation notes.

Recommended validation before opening a PR:

```bash
bun run ci
```

Additional useful checks:

```bash
bun run test
bun run --filter @orcai/web types:check
```

Repository hooks and rules:

- `pre-commit` runs `lint-staged`.
- `commit-msg` runs commitlint with `@commitlint/config-conventional`.
- `pre-push` runs `bun run prepush`.

For contributor docs on branch naming, PR content, and documentation expectations, see [Development docs: Contributing To The Main Repo](apps/web/content/docs/development/contributing.mdx).

Security issues should be reported privately according to [SECURITY.md](SECURITY.md). General contribution guidance is also available in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

OrcAI is free software licensed under the [GNU Affero General Public License, version 3 only](LICENSE) (`AGPL-3.0-only`). If you modify OrcAI and make the modified version available to users over a network, you must offer those users access to the corresponding source code under the same license.

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
