# @orcai/e2e

Playwright specs against this worktree's stack. The `dev-stack` skill owns
the workflow (`bun run stack e2e`), the fixture table, and the slice rules;
`apps/web/content/docs/development/testing.mdx` is the user-facing copy. The
config throws when the stack environment is missing.

## Writing a spec

- Import `test` and `expect` from `fixtures/index.ts`. A spec that needs an
  inference endpoint that answers imports them from
  `fixtures/inference/fixture.ts` instead; see `fixtures/inference/README.md`.
- Locate by role and accessible English name; the browser locale is `en`.
- Mutate only inside your worker's organisations. Lists paginate and
  `--no-reset` reruns accumulate rows, so find your own rows by a unique name.
- Instance-wide state belongs in `tests/instance/`, which runs alone and
  serially before everything else.

## Waiting

- `open` waits until React has hydrated the whole page, every Suspense
  boundary included. After a reload `open` did not make, call
  `awaitHydration` before interacting.
- Permission changes can lag a second or two behind writes. After writing over
  the API, call `seedZedToken(page)` before the browser reads; retry calls that
  are safe to repeat with `untilAllowed`, `expect.poll` or `toPass`.

## Servers

`playwright.config.ts` starts three `webServer` entries in order: the mock
inference server (`fixtures/inference/serve.ts`), the app's production build
on `PORT`, and the docs site's production build on `WEB_PORT`. The assistant
reads that docs site through `WEB_INTERNAL_URL`, so assistant specs fetch what
it serves rather than pinning docs text. The app and the docs site reuse a
server already listening on their port, such as `bun run stack dev` or
`bun run stack web`.

## Layout

`fixtures/*.ts` and `playwright.config.ts` are the foundation. `fixtures/<area>/`
and `tests/<area>/` belong to that slice, which stops and reports when it needs
a foundation file changed.
