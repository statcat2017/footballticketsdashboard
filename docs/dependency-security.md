# Dependency security and runtime policy

## Supported runtime

Use the Node.js version pinned in `.nvmrc`. `package.json` and `.npmrc` reject npm installs outside the supported Node 24 line. CI and deployment read the same `.nvmrc` value. The deploy workflow checks the VPS version before upload, then checks the standalone bundle's native SQLite binding before migration or restart.

## Update routine

Dependabot opens weekly npm and GitHub Actions update pull requests. For dependency changes, review the full and production audit output, run `npm run audit:dependencies`, and run the standard lint, typecheck, test, build, isolated SQLite/import smoke, and standalone browser checks. Do not use forced audit fixes or accept automatic major downgrades.

## Temporary development-only audit exception

As of 2026-10-19, the full audit reports one high-severity development-tool advisory chain: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces@3.0.3`, reported under [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The production-only audit is clean. The affected packages are used by ESLint and are not included in the standalone runtime; the dashboard does not pass untrusted request data into this build-time glob processing.

- Owner: `statcat2017`
- Expiry: 2026-11-19
- Follow-up: review the advisory and upstream dependency versions through weekly Dependabot updates; remove this exception as soon as a patched compatible chain is available.

The audit check permits only this high-severity development chain until its expiry. It fails for production findings, critical findings, unrelated vulnerabilities, or an expired exception.

## Temporary lint-tool compatibility exception

ESLint 9.39.5 is the newest version accepted by the peer ranges of the React, JSX accessibility, and import plugins bundled by `eslint-config-next@16.4.2`. ESLint 9 is no longer supported upstream, while ESLint 10 installation would require overriding those peer ranges. Keep the latest ESLint 9 patch until the Next.js plugin set declares ESLint 10 support; do not force the peer override.

- Owner: `statcat2017`
- Expiry: 2026-11-19
- Follow-up: check weekly dependency updates and move to a compatible supported ESLint release as soon as the plugin set allows it.
