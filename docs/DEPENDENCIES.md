# Direct dependency inventory

Generated from the installed package manifests for `apps/web` on 2026-10-19. Versions are locked by `apps/web/package-lock.json`; licenses below are the packages' declared SPDX/license values. Review transitive licenses separately before distribution.

| Group | Package | Installed version | License | Purpose |
|---|---|---:|---|---|
| Runtime | `next` | 16.4.2 | MIT | App Router and server rendering |
| Runtime | `react` | 19.3.0 | MIT | UI runtime |
| Runtime | `react-dom` | 19.3.0 | MIT | React DOM renderer |
| Runtime | `drizzle-orm` | 0.45.4 | Apache-2.0 | PostgreSQL ORM, used in P2 |
| Runtime | `pg` | 8.23.1 | MIT | PostgreSQL driver, used in P2 |
| Runtime | `zod` | 4.6.7 | MIT | Runtime schema validation, used in P2 |
| Development | `@tailwindcss/turbopack` | 4.3.3 | MIT | Tailwind integration in the Next dev/build pipeline |
| Development | `@types/node` | 24.19.2 | MIT | Node.js TypeScript declarations |
| Development | `@types/pg` | 8.23.1 | MIT | PostgreSQL driver declarations |
| Development | `@types/react` | 19.3.0 | MIT | React TypeScript declarations |
| Development | `@types/react-dom` | 19.3.0 | MIT | React DOM TypeScript declarations |
| Development | `tailwindcss` | 4.3.3 | MIT | Utility CSS; created by the official app scaffold |
| Development | `typescript` | 5.9.3 | Apache-2.0 | Type checking and compilation |
| Development | `eslint` | 9.39.5 | MIT | Linting |
| Development | `eslint-config-next` | 16.4.2 | MIT | Next.js lint rules |
| Development | `prettier` | 3.9.10 | MIT | Formatting |
| Development | `vitest` | 5.0.5 | MIT | Unit tests |
| Development | `@playwright/test` | 1.64.1 | Apache-2.0 | Browser end-to-end tests |
| Development | `drizzle-kit` | 0.31.11 | MIT | Database migration tooling, used in P2 |

## Audit note

On 2026-10-19, `npm audit --omit=dev` reported **zero production advisories** (38 production dependency entries). Full `npm audit` reported 9 advisories (5 high, 4 moderate), all reachable only through development tooling: the `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` chain, plus `drizzle-kit` → `@esbuild-kit/*` → `esbuild`. A non-forced `npm audit fix` was attempted earlier; it did not clear them. npm only offered fixes requiring breaking downgrades (`eslint-config-next` to 14.2.35 and `drizzle-kit` to 0.18.1), so no `--force` downgrade was applied. Recheck after upstream releases and before exposing tooling to untrusted inputs; production dependencies are currently clear.

The standard `npm run build` (Turbopack) was also retried locally and failed while spawning/binding a Turbopack process (`Operation not permitted`), consistent with this execution environment's process restrictions. The CI workflow now includes that exact build command on a standard GitHub-hosted runner, so CI is the acceptance check for whether this is environment-only. A local `npm run build -- --webpack` had passed during P0.
