# Agent Development Guide

## Sparse checkout — not every folder is on disk

This clone uses git sparse-checkout (cone mode). Only these directories are materialized, plus root files:

- `.github`
- `apps/api`
- `apps/live`
- `apps/web`
- `packages`

Everything else in the repo (`apps/space`, `apps/admin`, `apps/proxy`, `deployments`, ...) **exists in git history and on GitHub but is NOT in the working directory**. Implications:

- A folder "missing" locally is not missing from the repo — check with `git ls-tree HEAD <path>` before concluding anything.
- To work on an excluded folder, materialize it first: `git sparse-checkout add <dir>` (never edit `.git/info/sparse-checkout` by hand).
- CI builds on GitHub runners use a full checkout, so workflows can reference paths that don't exist locally (e.g. `apps/space/Dockerfile.space`).
- After `git sparse-checkout add` or pnpm installs, `git status` may show `package.json`/lockfile entries as modified with an **empty content diff** (LF→CRLF noise on Windows). Restore them with `git checkout -- <paths>`; don't commit them.

## Commands

- `pnpm dev` - Start all dev servers (web:3000, admin:3001)
- `pnpm build` - Build all packages and apps
- `pnpm check` - Run all checks (format, lint, types)
- `pnpm check:lint` - OxLint across all packages
- `pnpm check:types` - TypeScript type checking
- `pnpm fix` - Auto-fix format and lint issues
- `pnpm turbo run <command> --filter=<package>` - Target specific package/app
- `pnpm --filter=@plane/ui storybook` - Start Storybook on port 6006

## Code Style

- **Imports**: Use `workspace:*` for internal packages, `catalog:` for external deps
- **TypeScript**: Strict mode enabled, all files must be typed
- **Formatting**: oxfmt, run `pnpm fix:format`
- **Linting**: OxLint with shared `.oxlintrc.json` config
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Error Handling**: Use try-catch with proper error types, log errors appropriately
- **State Management**: MobX stores in `packages/shared-state`, reactive patterns
- **Testing**: All features require unit tests, use existing test framework per package
- **Components**: Build in `@plane/ui` with Storybook for isolated development

## Backend tests (Docker)

The Django/pytest suite for `apps/api` runs in an isolated stack defined by `docker-compose-test.yml` at the repo root.

Prereq (once): `./setup.sh` — generates `apps/api/.env` from `.env.example`.

- Full suite: `docker compose -f docker-compose-test.yml up --build --abort-on-container-exit --exit-code-from api-tests`
- Subset: `docker compose -f docker-compose-test.yml run --rm api-tests pytest -m unit`
- Teardown: `docker compose -f docker-compose-test.yml down -v`

See `apps/api/tests/RUNNING_TESTS.md` for the full walkthrough and troubleshooting; see `apps/api/tests/TESTING_GUIDE.md` for test conventions and fixtures.
