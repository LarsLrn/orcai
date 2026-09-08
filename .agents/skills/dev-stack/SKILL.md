---
name: dev-stack
description: Run OrcAI against real infrastructure in this worktree. Use when starting the app, workers, or docs site, running end-to-end tests, writing Playwright specs, resetting data, applying migrations or the SpiceDB schema, diagnosing an unreachable service, or verifying a change in the browser or with curl. Lint, unit tests, and pure code edits do not need this skill.
---

# Dev stack

Use `bun run stack` as the only entry point for this worktree's isolated
Docker Compose stack. Do not call Compose directly. The stack owns PostgreSQL,
Valkey, MinIO, Qdrant, SpiceDB, and the generated `.env` ports.

## Run the stack

1. Check it with `bun run stack status`.
2. If it is down or `.env` is missing, run `bun run stack up`. This waits for
   health and applies migrations and the SpiceDB schema.
3. Run services with `bun run stack dev`, `workers`, `web`, or `dev --all`.
   Run other commands through `bun run stack exec -- <command>` so they get
   the stack environment.
4. Verify a running app through the `BASE_URL` in `.env`; allow at least 60
   seconds for the first request.
5. Leave a healthy stack running. Use `bun run stack down --volumes` only when
   the user explicitly wants its data removed.

`bun run stack reset` is destructive and has no undo. It clears every store
while leaving containers and `.env` in place, and refuses to run while an
   app is listening on the stack port. Use `bun run stack env --reset` only to
   regenerate ports and secrets after a collision.

Machine-wide model endpoints belong in the configured development env file;
do not install OCR or other software on the shared machine. Report missing
dependencies instead.

## End-to-end tests

The suite runs Playwright on the host against this worktree's stack:

```bash
bun run stack e2e                         # reset, then the full suite
bun run stack e2e -- --grep auth          # one area
bun run stack e2e -- --ui                 # Playwright UI mode
bun run stack e2e --no-reset -- --grep smoke
```

Everything after `--` is passed to Playwright. A run without `--no-reset`
clears this worktree's database, authorisation store, object storage, vector
store, and cache. Use a second named stack when development data must remain;
run the two stacks of one checkout one after another because they share the
production build output.

The setup project initialises a reset instance through the first-run UI with
the well-known admin. Each parallel worker creates and mutates only its own
organisations through the public API. Instance-level specs run serially before
parallel specs. The mock inference server is used for e2e; do not call a real
provider. Workers, email delivery, and OCR are outside the suite unless a task
explicitly adds them.

Import the shared fixtures from `apps/e2e/fixtures/index.ts`; use the
inference fixture for specs that need a provider endpoint. Open pages and
submit forms with the core fixture helpers so server-rendered hydration is
handled consistently.

An e2e slice owns `apps/e2e/tests/<area>/` and may add
`apps/e2e/fixtures/<area>/`. The Playwright config, core fixtures, stack
script, this skill, `AGENTS.md`, `README.md`, and public development docs are
foundation files. Stop and report when a slice needs one of them changed.
Create test data through fixtures. The only direct-database exception is the
serial outbox failure-injection spec, because no public API can produce that
failure; keep its setup isolated and clean it up reliably.

Locate elements by role and accessible English name; add a test id only when
no accessible name exists. Pin a current defect with `test.fail()` while
asserting the intended behaviour. Finish an area with
`bun run stack e2e -- --grep <area>` and then a full suite run.
