# SkillSwap

SkillSwap is a peer-to-peer student learning platform for specific, urgent tasks. Product context, scope, UX, engineering rules and build prompts live at the repository root and in `docs/`.

The Next.js application lives in `apps/web/`. This keeps the product specification and historical context at the repository root without colliding with generated app files.

## Run locally

```sh
cd apps/web
cp .env.example .env
docker compose up -d db
npm run dev
```

Useful checks from the repository root:

```sh
npm --prefix apps/web run format:check
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run e2e
```

The app is currently a bootstrap shell. Follow `docs/PROMPTS.md` for the planned sequence; do not treat unvalidated hypotheses as findings.

The Drizzle configuration and commands are present, but domain tables and migrations are intentionally deferred to P2. Until then, `db:migrate` has no migration set to apply.
