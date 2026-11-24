# Working in this repository

OrcAI is a Bun monorepo: `apps/app` (TanStack Start web app), `apps/workers`
(pg-boss background jobs), `apps/web` (docs site), and `packages/*` (shared
Effect-based services).

## Verification

`bun run verify` runs Biome, the Effect-aware TypeScript check, the Drizzle
migration check, Knip,
and the unit tests without any infrastructure. `bun run ci` adds the docs type
check and the production build; it is what GitHub Actions runs.

Need the running app, workers, databases, or migrations? Use the `dev-stack`
skill. It owns this worktree's isolated Docker Compose stack; nothing else in
the repo starts containers.

End-to-end tests are Playwright specs in `apps/e2e`, run with
`bun run stack e2e` against this worktree's stack. A run resets the stack's
data first. The `dev-stack` skill carries the workflow, the fixtures, and the
slice rules.

## Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

## Conventions

- Conventional Commits.
- Biome owns formatting and linting, including the Drizzle and TanStack Query
  rules. Markdown is linted but not formatted, because Biome pads table
  columns.
- When a workflow or configuration changes, update `README.md` and
  `apps/web/content/docs` in the same change.
- An e2e slice owns `apps/e2e/tests/<area>/` and may add
  `apps/e2e/fixtures/<area>/`; the Playwright config and the shared fixtures
  belong to the foundation. A slice needing one of them changed stops and
  reports.
- The app and workers ship as bundles. A dependency that loads native
  bindings, reads its own files by path, or imports a computed name breaks
  only at runtime: keep it external (`apps/app/vite.config.ts`,
  `apps/workers/build.ts`).
- Never install software or change configuration outside the repository on
  the users machine. Report what is needed instead.
