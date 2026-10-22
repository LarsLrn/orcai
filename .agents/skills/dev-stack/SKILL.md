---
name: dev-stack
description: Run OrcAI against real infrastructure in this worktree. Use when starting the app, workers, or docs site, running end-to-end or integration tests, writing Playwright specs, resetting data, applying migrations or the SpiceDB schema, diagnosing an unreachable service, or verifying a change in the browser or with curl. Lint, unit tests, and pure code edits do not need this skill.
---

# Dev stack

Use `bun run stack` as the only entry point for this worktree's isolated
Docker Compose stack. Do not call Compose directly. The stack owns PostgreSQL,
Valkey, SeaweedFS, Qdrant, SpiceDB, and the generated `.env` ports.

## Run the stack

1. Check it with `bun run stack status`.
2. If it is down or `.env` is missing, run `bun run stack up`. This waits for
   health and applies migrations and the SpiceDB schema.
3. Run services with `bun run stack dev`, `workers`, `web`, or `dev --all`.
   Run other commands through `bun run stack exec -- <command>` so they get
   the stack environment.
4. Verify a running app through the `BETTER_AUTH_URL` in `.env`; allow at least 60
   seconds for the first request.
5. Leave a healthy stack running. Use `bun run stack down --volumes --yes`
   only when the user explicitly wants its data removed.

`bun run stack reset` is destructive and has no undo. It clears every store
while leaving containers and `.env` in place, and refuses to run while an
   app is listening on the stack port. Use `bun run stack env --reset` only to
   regenerate ports and secrets after a collision.

Every destructive command asks for confirmation, and refuses outright when
nothing can answer. You have no terminal, so pass `--yes` to `reset`, to `e2e`
without `--no-reset`, and to `down --volumes`. Treat that flag as the point
where you decide the data is expendable, not as boilerplate.

Machine-wide model endpoints belong in the configured development env file;
do not install OCR or other software on the shared machine. Report missing
dependencies instead.

## End-to-end tests

The suite runs Playwright on the host against this worktree's stack:

```bash
bun run stack e2e --yes                   # reset, then the full suite
bun run stack e2e --yes -- --grep auth    # one area
bun run stack e2e --yes -- --ui           # Playwright UI mode
bun run stack e2e --no-reset -- --grep smoke   # no reset, so no confirmation
bun run stack e2e --yes --no-integration  # Playwright only
bun run stack e2e --yes --no-build        # reuse the images already built
bun run stack e2e --yes --pipeline        # the pipeline specs, with workers
```

Everything after `--` is passed to Playwright. After Playwright the run
executes the integration tier on the same stack and fails if either fails. A run without `--no-reset`
clears this worktree's database, authorisation store, object storage, vector
store, and cache. Use a second named stack when development data must remain.

The app under test is the production image. Each run first builds the app and
docs images (app and workers with `--pipeline`) with `docker buildx bake` from
the Compose build definitions, tagged `<stack>-app`, `<stack>-web`, and
`<stack>-workers`; Playwright runs them on the host network with the stack
environment. `--no-build` skips the build. A `bun run stack dev` or
`bun run stack web` already listening is reused instead of its image. The
images run with `NODE_ENV=production`; the run turns off Better Auth's rate
limit (`BETTER_AUTH_RATE_LIMIT=false`) because all requests come from loopback.

The setup project initialises a reset instance through the first-run UI with
the well-known admin. Each parallel worker creates and mutates only its own
organisations through the public API. Instance-level specs run serially before
parallel specs. The mock inference server is used for e2e; do not call a real
provider. Playwright also runs the docs image on `WEB_PORT` for the
assistant, reusing a running `bun run stack web`. Email delivery and OCR
are outside the suite.

Only `--pipeline` runs the background workers, polling every half second (in
place of the docs site), and only the specs in `apps/e2e/tests/pipeline/`;
every other run has no pg-boss
queues, so queueing fails and uploads end up failed, which other specs rely
on. Put a spec that needs a document processed, indexed, or searched there,
with txt or md content; the mock serves the embeddings. A pipeline run leaves
queues behind, so the next other run must reset. CI runs the pipeline specs
in their own job; a full local run is `bun run stack e2e --yes`, then
`bun run stack e2e --yes --pipeline`.

Import the shared fixtures from `apps/e2e/fixtures/index.ts`; use the
inference fixture for specs that need a provider endpoint. Open pages and
submit forms with the core fixture helpers so server-rendered hydration is
handled consistently.

An e2e slice owns `apps/e2e/tests/<area>/` and may add
`apps/e2e/fixtures/<area>/`. The Playwright config, core fixtures, stack
script, this skill, `AGENTS.md`, `README.md`, and public development docs are
foundation files. Stop and report when a slice needs one of them changed.
Create test data through fixtures. There are two direct-store exceptions,
because no public API can produce their data: the serial outbox
failure-injection spec, and the chat migration spec, which seeds legacy rows
in a throwaway database. Keep such setup isolated and clean it up reliably.

Locate elements by role and accessible English name; add a test id only when
no accessible name exists. Pin a current defect with `test.fail()` while
asserting the intended behaviour. Finish an area with
`bun run stack e2e --yes -- --grep <area>` and then a full suite run.

## Integration tests

Test a module that needs PostgreSQL or SpiceDB through its interface in a
`*.integration.ts` file alongside its unit tests. Run the tier with
`bun run test:integration`, or one file with
`bun run stack exec -- bun test ./path/to/file.integration.ts`. It needs no
reset, but `integrationRuntime()` fails before the instance is initialised;
run `bun run stack e2e --yes -- --grep <area>` once on a fresh stack.

Use `integrationRuntime()` from `@orcai/testing` for the app's DB and SpiceDB
layers, and `createUser` and `createOrganization` for data. Create everything
under fresh ids, never rely on or mutate rows you did not create, and leave
the data in place.
