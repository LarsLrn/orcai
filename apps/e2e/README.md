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

## Two things retry

Comments in fixtures and specs name these by these two words.

**Late hydration.** The app is server rendered. A value typed or a click made
before React hydrates is lost. `open` waits for the network to settle;
`submitForm` and the dialog helpers retry the whole fill-and-submit, and stay
idempotent by returning as soon as the page already sits on the target.

**Snapshot lag.** SpiceDB serves permission checks from a quantized snapshot,
so a grant written a moment ago can be invisible for a second or two: an API
call answers FORBIDDEN, a route guard redirects to the dashboard, a menu entry
is missing. `untilAllowed` from `fixtures/authorization.ts` retries a call that
is safe to repeat; each slice's `open*` helper retries the navigation while the
guard still redirects; `expect.poll` and `toPass` cover the rest.

## Layout

`fixtures/*.ts` and `playwright.config.ts` are the foundation. `fixtures/<area>/`
and `tests/<area>/` belong to that slice, which stops and reports when it needs
a foundation file changed.
