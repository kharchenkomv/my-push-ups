# my-push-ups

Migrated from Replit (synced via GitHub) to local dev on macOS on 2026-07-09. Offline, no-login push-up trainer: pnpm monorepo whose only real artifact is the Expo app (`artifacts/my-push-ups`). No database, no env vars, no secrets — AsyncStorage only. The `api-server` and `mockup-sandbox` artifacts are unused scaffolding. See `replit.md` for architecture and where things live.

## Running locally

```bash
# Expo web preview (the package's `dev` script is Replit-specific — don't use it locally)
cd artifacts/my-push-ups && pnpm exec expo start --web --port 21401

# Training-engine test suite (41 tests, pure functions)
cd artifacts/my-push-ups && pnpm run test

# Typecheck everything
pnpm run typecheck
```

## macOS-specific fixes applied

Same pattern as the other migrated Replit projects — the lockfile pins native binaries to Linux only via `overrides: '-'` entries in `pnpm-workspace.yaml`; don't remove those (deployment target).

- `pnpm-workspace.yaml`: `allowBuilds.esbuild` fixed from the literal unfilled placeholder string (`"set this to true or false"`) to `true`. Committed 2026-07-10 (harmless on Linux/Replit: it only permits esbuild's postinstall).
- Vendored `lightningcss-darwin-arm64@1.32.0` (note: 1.32.0 here, not the 1.31.1 the sibling projects use — always match `pnpm-lock.yaml`) via `npm pack` into `node_modules/.pnpm/`: the `.node` file goes inside `lightningcss@1.32.0/node_modules/lightningcss/`, plus a resolvable package dir + symlink under `.pnpm/node_modules/`. Without it, Metro's web CSS transform crashes. Gitignored — re-vendor after a clean `pnpm install`. Copy real dirs (`cp -RL`), not the `.pnpm/node_modules/*` symlinks.
- esbuild's darwin binary self-heals via its postinstall (allowed by `allowBuilds`), no manual vendoring needed.

## Verified working (2026-07-09)

- `pnpm install` clean, Expo web bundles 1491 modules, page serves "My Push Ups" on :21401
- All training-engine tests pass (41 as of 2026-07-10)
