# OrcAI documentation site

This TanStack Start and Fumadocs application serves the OrcAI landing page and documentation in `content/docs`.

From the repository root:

```bash
bun run --filter @orcai/web dev
bun run --filter @orcai/web types:check
bun run build:web
```

The development server listens on <http://localhost:3001> by default. See the root [README](../../README.md) for workspace setup and contribution guidance.
