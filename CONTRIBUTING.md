# Contributing to OrcAI

Thanks for helping improve OrcAI. The project is still evolving, so please open an issue before starting a large architectural change.

## Development

Use Bun 1.3.10 or newer. The recommended environment is the included VS Code devcontainer; manual and Compose setup instructions are available in the [README](README.md).

Create a focused branch from `main`, use Conventional Commits, and include tests and documentation when behaviour changes. Before opening a pull request, run:

```sh
bun install --frozen-lockfile
bun run ci
```

Do not commit credentials, `.env` files, private data, or generated build output. Report vulnerabilities according to [SECURITY.md](SECURITY.md), not through public issues.

## Contribution License

OrcAI is licensed under the GNU Affero General Public License, version 3 only (`AGPL-3.0-only`). By submitting a contribution, you agree to license it under the same terms and confirm that you have the right to do so. Do not submit code or assets whose licence is incompatible with the AGPL.

For the detailed repository workflow, see the [contributor documentation](apps/web/content/docs/development/contributing.mdx).
