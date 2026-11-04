# SkillSwap

SkillSwap is a peer-to-peer student learning platform for specific, urgent tasks. Product context, scope, UX, engineering rules and build prompts live at the repository root and in `docs/`.

The Next.js application lives in `apps/web/`. This keeps the product specification and historical context at the repository root without colliding with generated app files.

## Команде и ИИ-агентам — начать здесь

Актуальные задания с именами, порядок параллельной работы и границы файлов:
**[docs/launch/README.md](docs/launch/README.md)**.
Codex: правила в `AGENTS.md`. Claude Code: `CLAUDE.md` импортирует те же правила.
Перед изменениями выберите назначение своего участника; не выполняйте все задачи
одновременно и не меняйте общие файлы без их владельца.

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

The app includes accounts, domain tables and migrations, request/private-link
flows, and a partly demo workspace. It is not yet ready for real-user launch.
Follow `docs/launch/PLAN.md` for the current team work; `docs/PROMPTS.md` is the
earlier screen-by-screen build sequence. Do not treat hypotheses as findings.
See `apps/web/README.md` for database/auth setup. Run migrations before local use,
and verify a separate test database before commands that create fixtures or seeds.
