# Working in this repository

OrcAI is a Bun monorepo: `apps/app` (TanStack Start web app), `apps/workers`
(pg-boss background jobs), `apps/web` (docs site), and `packages/*` (shared
Effect-based services).

## Verification

`bun run verify` runs Biome, TypeScript, and the unit tests without any
infrastructure. `bun run ci` adds ESLint, the docs type check, and the
production build; it is what GitHub Actions runs.

Need the running app, workers, databases, or migrations? Use the `dev-stack`
skill. It owns this worktree's isolated Docker Compose stack; nothing else in
the repo starts containers.

End-to-end tests are Playwright specs in `apps/e2e`, run with
`bun run stack e2e` against this worktree's stack. A run resets the stack's
data first. The `dev-stack` skill carries the workflow, the fixtures, and the
slice rules.

## Conventions

- Conventional Commits.
- Biome owns formatting and general linting; ESLint carries only the
  package-specific TanStack and Drizzle rules.
- When a workflow or configuration changes, update `README.md` and
  `apps/web/content/docs` in the same change.
- An e2e slice owns `apps/e2e/tests/<area>/`; the Playwright config and the
  shared fixtures belong to the foundation. A slice needing one of them
  changed stops and reports.
- Never install software or change configuration outside the repository on
  the shared development machine; report what is needed instead.
