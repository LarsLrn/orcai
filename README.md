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
- Bot features: Generative UI for structured results such as checklists in the answer, web search, and questions and quizzes the bot asks in the conversation
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

### Per-worktree dev stack (recommended)

`bun run stack` gives every checkout, including each git worktree, its own Docker Compose project for PostgreSQL, Valkey, SeaweedFS, Qdrant, and SpiceDB. Ports are chosen per worktree and written to a gitignored `.env`, so several checkouts and agents can run side by side without colliding.

Prerequisites:
- Bun `>=1.3.10`
- Docker with Compose v2

Steps:

```bash
bun install --frozen-lockfile
bun run stack up      # start infrastructure, write .env, apply migrations and SpiceDB schema
bun run stack dev     # app dev server on the port stored in .env
```

Useful commands:
- `bun run stack status`: container state and a probe per service
- `bun run stack reset`: empty every store of the stack, leaving containers and `.env` in place (asks first; refuses while an app is listening on the stack's port)
- `bun run stack e2e`: install the pinned Chromium, build the production images, reset, then run the end-to-end suite against them and the integration tier (`bun run e2e` is an alias, asks first)
- `bun run stack build`: build the app, docs, and workers production images for this stack
- `bun run test:integration`: run the integration tier against the stack
- `bun run stack dev --all`: app, workers, and docs together
- `bun run stack workers` / `bun run stack web`: workers or docs site only
- `bun run stack migrate`: reapply migrations and the SpiceDB schema
- `bun run stack exec -- <command>`: run anything with the stack environment, for example `bun run stack exec -- bun run --filter @orcai/db generate`
- `bun run stack logs [service]`: follow infrastructure logs
- `bun run stack env --reset`: regenerate `.env` with fresh ports and secrets
- `bun run stack down --volumes`: stop the stack and delete its data (asks first)

Notes:
- `stack up` is idempotent and reuses an existing `.env`.
- `stack reset`, `stack e2e` without `--no-reset`, and `stack down --volumes` are potentially destructive in the current environment and ask for confirmation first.
- Machine-wide overrides such as a real `OPENAI_COMPATIBLE_*` endpoint belong in `~/.config/orcai/dev.env` (or the file named by `ORCAI_DEV_ENV_FILE`). They are merged whenever `.env` is created.
- `bun run stack --name <name> --env-file <path> up` starts an additional independent stack, which is how you run end-to-end tests without touching this worktree's dev data.
- [Paseo](https://github.com/getpaseo/paseo) workspaces run `bun install` and `bun run stack up` automatically on creation and `bun run stack down --volumes --yes` when archived, see `paseo.json`.
- Workers on the host need Tesseract with the `eng` (and optionally `deu`) language packs for OCR.
- Unit tests (`bun run test`) never touch the stack. Each test file runs isolated in a pool of worker processes (`bun test --parallel`), so `mock.module` and DOM globals stay within their file.
- Integration tests (`*.integration.ts`, `bun run test:integration`) test modules against the stack's real PostgreSQL and SpiceDB. They create their own organisations and users under unique ids and coexist with dev data, so they need no reset. `@orcai/testing` provides `integrationRuntime()` with the app's DB and SpiceDB layers and the `createUser` and `createOrganization` factories; it refuses to start before the instance is initialised (through `/init` or a `stack e2e` run), because test rows would lock first-run setup.

### End-to-end tests

The end-to-end suite is Playwright Test on the host, Chromium only, in the `apps/e2e` workspace package. It runs against this worktree's stack and resets that stack's data before a full run, so a run wipes the worktree's database, object storage, vector collections, authorisation relationships, and cache.

```bash
bun run stack e2e                              # reset, then the whole suite
bun run e2e                                    # root alias
bun run stack e2e -- --grep auth               # one area
bun run stack e2e -- --ui                      # Playwright UI mode
bun run stack e2e --no-reset -- --grep smoke   # fast iteration on existing data
bun run stack e2e --no-integration             # Playwright only
bun run stack e2e --no-build                   # reuse the images already built
bun run stack e2e --pipeline                   # pipeline specs, with workers
```

Everything after `--` is passed to Playwright. After Playwright, whatever its result, the run executes the integration tier on the same stack; the run fails if either does.

Notes:
- The application under test is the production images. `stack e2e` builds the app and docs images (app and workers for `--pipeline`) from the `docker-compose.yaml` build definitions with `docker buildx bake` and this stack's `VITE_*` values, tags them `<stack>-app`, `<stack>-web`, and `<stack>-workers`, and Playwright runs them on the host network with the stack environment. The run sets `BETTER_AUTH_RATE_LIMIT=false`, because every request comes from loopback. With `--no-reset`, a `bun run stack dev` already listening on the stack's port is reused, so local iteration needs no rebuild. A reset refuses while an app is listening, because a running server keeps stale state in memory; stop it first or pass `--no-reset`.
- A Playwright `setup` project initialises the reset instance through the first-run UI with a well-known admin. There is no separate seed step.
- Locators use roles and accessible names read from `apps/app/messages/en.json` through `apps/e2e/fixtures/messages.ts`, so specs follow the copy. See [Development docs: Localisation](apps/web/content/docs/development/localisation.mdx).
- Each Playwright worker creates its own organisations and users through the public API, so specs run in parallel without sharing data.
- A mock OpenAI-compatible inference server (`apps/e2e/fixtures/inference`) runs on `E2E_INFERENCE_PORT` for the whole suite; `stack e2e` points the app's global endpoint at it, and specs that configure a provider start their own on an ephemeral port. No run reaches a real provider.
- To keep your dev data, run the suite against a second stack: `bun run stack --name <name>-e2e --env-file .env.e2e up`, then the same command with those flags.
- Only `bun run stack e2e --pipeline` starts the background workers (polling every 0.5 s) and runs the upload-to-citation specs in `apps/e2e/tests/pipeline`; every other run has no pg-boss queues, so uploads end up failed. A full local run is `bun run stack e2e`, then `bun run stack e2e --pipeline`.
- GitHub Actions builds the images once in an `e2e images` job, with layers cached in the GitHub Actions cache, and every shard loads and runs them. It uses the pinned workspace Playwright, splits the suite across three shards with the integration tier on the first, runs the pipeline specs in a fourth job, fails on flaky retries, and uploads each failing shard's report. Pull requests that only change `apps/web/content`, the root `LICENSE`, or Markdown outside `apps/app`, `apps/workers`, and `packages` skip the shards; the required `e2e` check still passes.

For the e2e workflow and fixture contract, see [Development docs: End-To-End Tests](apps/web/content/docs/development/testing.mdx).

### Devcontainer

The repository ships with a VS Code devcontainer based on `.devcontainer/devcontainer.json` and `.devcontainer/docker-compose.dev.yaml`.

Prerequisites:
- Docker
- VS Code with the Dev Containers extension

Steps:
1. Open the repository in VS Code.
2. Run `Dev Containers: Reopen in Container`.
3. Wait for `bun install --frozen-lockfile` and the post-create step, which writes `.devcontainer/.env` once.
4. Start the app, documentation site, and workers with `bun run dev:all`. The app listens on port 3000 and the docs on 3001.
5. Open [http://localhost:3000](http://localhost:3000).

What starts automatically:
- PostgreSQL
- Valkey
- SeaweedFS
- Qdrant
- SpiceDB
- Workspace dependency install
- Database migrations
- SpiceDB schema migration
- A Bun workspace container with the repository mounted

Notes:
- The container never reads the checkout's `.env`, which belongs to `bun run stack`. Service addresses and dev credentials are fixed in the Compose override.
- `.devcontainer/.env` holds the secrets, the ports and the inference settings, and overrides Compose values. Put a real `OPENAI_COMPATIBLE_*` endpoint, `SMTP_*` and `OTEL_*` there, then restart `bun run dev:all`. If VS Code forwards SeaweedFS to a port other than 8333, set `S3_PUBLIC_ENDPOINT` there.
- Deleting `.devcontainer/.env` and running `bun scripts/devcontainer-env.ts` makes new secrets. Stored provider keys become unreadable and sessions end.
- `bun run dev`, `dev:all` and `bun run stack workers|web|exec|migrate` work in the container. The Docker-driven stack commands are host-only, and `bun run stack env --reset` must not run in the container, because it would write host-stack values into `.devcontainer/.env`.
- A one-shot `deps` service runs `bun install --frozen-lockfile` before the workspace container starts.
- Application services are started manually in the workspace, so changing them does not require rebuilding or restarting the devcontainer.
- `.devcontainer/.env` defaults `OPENAI_COMPATIBLE_BASE_URL` to an Ollama-compatible endpoint on the Docker host at `http://host.docker.internal:11434/v1`.
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
- SeaweedFS S3 API on `localhost:8333`
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
- SeaweedFS creates the buckets on startup, and a one-shot service applies the SpiceDB schema.

### Manual host setup

Use this only when you cannot run Docker. Provide PostgreSQL, Valkey, Qdrant, SpiceDB, S3-compatible storage, and an OpenAI-compatible endpoint yourself, then:

```bash
cp .env.example .env
bun install --frozen-lockfile
```

Edit `.env`, then run:

```bash
bun run stack migrate
bun run stack dev
bun run stack workers
```

The stack subcommands only load `.env` and run the workspace scripts; they do not start containers unless you call `bun run stack up`.

Use `bun run build && bun run start` for the app and `bun run workers:start` for the workers.

The e2e inference mock starts fresh and its worker-local scenarios reset before
and after each test. Playwright also runs the docs image on `WEB_PORT`, or
reuses a running `bun run stack web`, which the assistant reads through
`WEB_INTERNAL_URL` during `bun run stack e2e`. Admin browser pages use sessions separate from API clients.
Stack flags before `--` are validated; delegated flags belong after `--`.

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
- `VITE_WEB_URL`: Public docs site base URL used by the app dashboard and the assistant's docs links (optional). The assistant also reads the docs from it unless `WEB_INTERNAL_URL` is set; without it the assistant cannot read the docs.
- `WEB_INTERNAL_URL`: Docs site origin the app server fetches for the assistant (optional, defaults to `VITE_WEB_URL`; Docker Compose sets `http://web:3001`).
- `BETTER_AUTH_SECRET`: Better Auth signing secret.
- `BETTER_AUTH_RATE_LIMIT`: `false` turns off Better Auth's rate limiting (optional; on in production by default). It keys clients by `X-Forwarded-For`; requests without exactly one address in it share one limit.
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
- `WORKER_POLLING_INTERVAL_SECONDS`: Replaces how often every background worker polls its queue (pg-boss minimum 0.5). Unset, each worker keeps its own interval of 2 to 30 seconds; the e2e pipeline run uses 0.5.
- `S3_REGION`: Defaults to `eu-central-1`.
- `S3_PUBLIC_ENDPOINT`: Optional public endpoint for presigned URLs.
- `SMTP_*`: Optional. If you enable SMTP delivery, `SMTP_HOST` and `SMTP_FROM` must both be set. `SMTP_USERNAME` and `SMTP_PASSWORD` must either both be set or both be omitted. If `SMTP_SECURE` is unset, it is derived from port (`true` for 465, otherwise `false`).
- `VITE_UMAMI_*`: Optional Umami analytics injection.
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`: Optional OpenTelemetry export configuration. Traces, logs and metrics are exported once the endpoint is set.
- `OTEL_RESOURCE_ATTRIBUTES`: Optional resource attributes such as `deployment.environment=production`, attached to every exported signal of the app and the workers.

Embedding note:
- Changing `EMBEDDING_MODEL` or `EMBEDDING_DIMENSIONS` after assets have already been indexed is not supported right now. Recreate the Qdrant collection and reprocess assets instead of mixing old and new embeddings.

See [.env.example](.env.example) for a current baseline.

## Common Commands

- `bun run stack up`: start this checkout's infrastructure and apply migrations
- `bun run dev`: start the development server (alias for `bun run stack dev`)
- `bun run verify`: run lint, the migration check, and unit tests
- `bun run test:integration`: run the integration tier against the stack
- `bun run e2e`: reset the stack and run the end-to-end suite and the integration tier
- `bun run build`: build the app and documentation site
- `bun run build:app`: build only the main app
- `bun run build:web`: build only the documentation site
- `bun run start`: run the production server from `dist`
- `bun run workers:dev`: start worker process directly on the host
- `bun run workers:start`: run worker process in production mode
- `bun run lint`: run Biome, TypeScript checks, and the migration check
- `bun run ci`: run the same lint, migration check, test, docs type-check, and build suite used by GitHub Actions
- `bun run stack migrate`: apply SQL migrations and the SpiceDB schema
- `bun run stack exec -- bun run --filter @orcai/db generate`: generate a new Drizzle migration
- `bun run --filter @orcai/db check`: fail when two migrations branch from the same parent and change the same entity; after a rebase onto `main`, regenerate the branch's migration
- `bun run stack exec -- bun run --filter @orcai/db studio`: open Drizzle Studio
- `bun run stack exec -- bun run --filter @orcai/spice-db status`: inspect SpiceDB schema migration status

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

- `pre-commit` runs `lint-staged`, which applies Biome's safe fixes and formatting to the staged files and fails on remaining errors.
- `commit-msg` runs commitlint with `@commitlint/config-conventional`.
- `pre-push` runs `bun run prepush`, which is `bun run lint-full`.

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
