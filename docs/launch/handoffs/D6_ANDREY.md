# D6 — Андрей: исходящие передачи

Файл ведут Андрей и его агент. [Общий протокол](../HANDOFFS.md).
Перед работой прочитать все авторские журналы и записи с адресатом `D6` или
«все». Свой журнал не является единственным источником входящих изменений.

## Исходящие передачи

<a id="d6-h001"></a>

## D6-H001 — безопасная тестовая БД и полный CI

- Автор: D6 / Андрей. Адресаты: все (D1–D5).
- Проверено: 15 ноября 2026. Статус: **ветка опубликована, PR ещё не открыт**
  (открыть через GitHub по ссылке ниже). Код в `main` не входит до merge.
- Ветка: `codex/andrey-d6-test-ci`. Полный head SHA:
  `4fe8c0867e6532544a3a60302b553607705b2253`.
  PR: <https://github.com/Arsench1kk/SkillSwap/compare/main...codex/andrey-d6-test-ci>.
- Base и зависимости: `main` на `edf8135`; от Draft PR других участников не зависит.
- Контракт (пути от корня):
  - `apps/web/testing/database-target.ts` — `resolveTestDatabase`,
    `requireTestDatabase`, `assertSafeTestDatabaseUrl`. Цель берётся из явного env:
    `TEST_DATABASE_URL`, затем `DATABASE_URL`; `.env*` не читаются. Отказ, если
    хост не localhost или имя БД без отдельного сегмента `test`.
  - `apps/web/e2e/support/database.ts` — `createFixturePool()` для fixtures E2E.
  - Скрипты: `npm run db:test:prepare`, `db:test:reset`, `test:db`.
  - `.github/workflows/ci.yml`: jobs static / test-and-build / migrations-upgrade / e2e.
- **Действие получателей:**
  - Все: локальные тестовые БД называть с сегментом `test`
    (например `skillswap_d1_recovery_test`, а не `skillswap_d1_recovery_20261104`),
    иначе Vitest/Playwright откажутся стартовать. `DATABASE_URL` на dev-БД
    `skillswap` теперь вызывает ошибку при `npm test`, а не запись в неё.
  - Все: в CI DB-тесты обязательны (`CI=true`); `describe.skipIf(!DATABASE_URL)`
    больше не скрывает пропуск. Новые integration-тесты подключаются без настройки.
  - D2–D5: новые `e2e/<owner>/**` уже входят в прогон (testDir `./e2e`); для
    fixtures использовать `createFixturePool()`, не свой fallback URL.
    Это закрывает просьбу D2-H001 о подключении `e2e/learner/**` в CI.
  - D1: `src/db/seed-rehearsal.ts` и `src/db/client.ts` по-прежнему имеют fallback
    на dev-БД; предлагаю, чтобы seed вызывал `requireTestDatabase` либо отдельный
    guard назначения (файлы D1, не менялись). Новые миграции проверяются в CI
    дважды: на чистой БД и upgrade с миграций base PR.
- Совместимость/ограничения: `npm test` без БД по-прежнему работает локально и
  печатает предупреждение о пропуске. Скрипты `test:db` используют синтаксис env
  POSIX-shell (macOS/Linux/CI). Run на GitHub для этой ветки ещё не наблюдался.
- Проверки (локально, Docker Postgres 17, БД `skillswap_test`, `CI=true`):
  format/lint/typecheck; чистые миграции; 252 unit/integration без пропусков
  (на `main` без БД было 146 passed / 89 skipped); production build с нуля;
  63 Playwright. Upgrade с миграций `a2664b5` до текущих прошёл. Отказы guard для
  dev-БД, удалённого хоста и CI без БД проверены. Новых зависимостей нет.

<a id="d6-h002"></a>

## D6-H002 — найдено: Tailwind не обрабатывает `globals.css` ни в dev, ни в build

- Автор: D6 / Андрей. Адресаты: все; решение — D6 с D1 и дизайн-проверкой.
- Проверено: 15 ноября 2026 на `main` `edf8135`. Статус: **находка, исправление не сделано**.
- Причина предупреждения `Unknown at rule: @theme`: правило `turbopack.rules` в
  `apps/web/next.config.ts` (loader `@tailwindcss/turbopack`) не применяется к
  `app/globals.css`, а `npm run build` идёт через `--webpack`, где PostCSS-конфига
  нет. В обоих режимах в браузер уходит сырой CSS Tailwind: блоки `@theme`
  остаются необработанными (браузер их игнорирует), preflight подключается
  частично. Dev и production при этом **совпадают** (проверено по отданным CSS).
- Utility-классы Tailwind в коде не используются; стили идут из CSS-модулей и
  переменных `:root`. Поэтому видимой поломки нет, но конфиг вводит в заблуждение.
- Варианты (нужно согласование, оба меняют визуал и требуют проверки 360 px):
  (а) стандартная связка `@tailwindcss/postcss` + `postcss.config.mjs` для обоих
  бандлеров; (б) убрать `@import "tailwindcss"`/`@theme` и Tailwind-зависимости,
  оставив свои tokens. До решения не менять `globals.css` в feature PR.

## Прочитанные и применённые передачи

Отметок пока нет. При использовании контракта или обнаружении блокера записать
ID передачи, проверенный SHA, reviewed/adopted/blocked и свой PR/причину.
Автор другого журнала не ставит эту отметку за вас.
