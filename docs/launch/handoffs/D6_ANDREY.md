# D6 — Андрей: исходящие передачи

Файл ведут Андрей и его агент. [Общий протокол](../HANDOFFS.md).
Перед работой прочитать все авторские журналы и записи с адресатом `D6` или
«все». Свой журнал не является единственным источником входящих изменений.

## Исходящие передачи

<a id="d6-h001"></a>

## D6-H001 — безопасная тестовая БД и полный CI

- Автор: D6 / Андрей. Адресаты: все (D1–D5).
- Проверено: 16 ноября 2026. Статус: **ветка опубликована, PR ещё не открыт**
  (открыть через GitHub по ссылке ниже). Код в `main` не входит до merge.
  Это основание стека веток D6: H003–H006 построены поверх неё.
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

<a id="d6-h003"></a>

## D6-H003 — единый i18n resolver, язык без JS и письма

- Автор: D6 / Андрей. Адресаты: D1 (письма, event locale), D2–D5 (свои страницы).
- Проверено: 16 ноября 2026. Статус: **ветка опубликована, PR не открыт**.
- Ветка: `codex/andrey-d6-i18n`, head `f9b8404390fb47f85f50177753525d031552979a`.
  PR: <https://github.com/Arsench1kk/SkillSwap/compare/codex/andrey-d6-test-ci...codex/andrey-d6-i18n>.
- Base: `codex/andrey-d6-test-ci` (D6-H001). Объединять после него.
- Контракт (`apps/web/src/i18n/`):
  - `config.ts` — `locales`, `Locale`, `localeCookieName` (`skillswap-locale`),
    `intlLocale` для `Intl`/`formatKazakhstanTime`.
  - `resolve.ts` — `resolveLocale` (explicit → cookie → Accept-Language → `en`),
    `localeFromHeaders(headers)` для route handlers и auth callbacks.
  - `translate.ts` — `createTranslator(locale)`; per-key fallback на EN до R09.
  - `server.ts` — `getServerTranslator()` для **динамических** server components.
  - `auth-email.ts` — `authEmailContent("verify-email" | "reset-password", locale, {url, name})`;
    тексты перенесены в каталог дословно из `src/lib/auth.ts`.
  - `POST /api/locale` — без JS сохраняет cookie и возвращает на тот же путь.
  - `npm run i18n:check` (в CI report-only), `-- --worksheet kk` — CSV для переводчика.
- **Действие получателей:**
  - D1: в `src/lib/auth.ts` заменить inline-тексты на
    `authEmailContent(kind, localeFromHeaders(request?.headers), { url, name })`
    (callback Better Auth получает `request`). `ui_locale` в событиях по-прежнему
    задаёт сервер по R10 — cookie не копировать в event context; CHECK не трогать.
  - D2–D5: на своих страницах приватных ссылок заменить `import { t } from "@/messages/en"`
    на `const { locale, t } = await getServerTranslator()` внутри уже динамического
    компонента; даты — `formatKazakhstanTime(date, intlLocale[locale])`. Новые
    строки — заявкой D6 (ключ + ссылка на утверждённый текст).
- Ограничения: RU/KK не хватает по 202 production-ключа (+127 workspace); перевод
  и проверка человеком — по R09, машинный перевод не добавлялся. Клиентские
  страницы без JS остаются на EN (layout не читает cookie, чтобы не делать все
  страницы динамическими); privacy читается без JS.
- Проверки: 18 unit (resolver, Accept-Language, open-redirect, fallback, CSV,
  письма, `/api/locale`), `e2e/i18n.spec.ts` с JS и без JS; полный прогон ниже (H005).

<a id="d6-h004"></a>

## D6-H004 — проверки доступности на 360 px и найденные проблемы

- Автор: D6 / Андрей. Адресаты: D1, D2 (исправления); все (новая проверка).
- Проверено: 16 ноября 2026. Статус: **ветка опубликована, PR не открыт**.
- Ветка: `codex/andrey-d6-a11y`, head `b863182b5af78d9db3ba576e86eafa11640b0eb5`.
  PR: <https://github.com/Arsench1kk/SkillSwap/compare/codex/andrey-d6-i18n...codex/andrey-d6-a11y>. Base: D6-H003.
- Контракт: `apps/web/e2e/accessibility.spec.ts` — axe WCAG 2.1 A/AA, 360 px без
  горизонтального скролла, tap targets ≥ 44 px (с учётом связанных label),
  видимый focus, покрытие кириллицы/казахских букв шрифтом. Новая зависимость
  `@axe-core/playwright` 4.14.0 (MPL-2.0, dev).
- Исправлено D6: кнопки языка были 40 px → 44 px (`app/globals.css`).
- **Действие получателей** (временно в allowlist `knownIssues`, удалить запись в своём PR):
  - D2 `app/page.tsx` и D1 `components/auth-concept.tsx`: у wordmark-ссылки
    убрать `aria-label={t("brand")}` — видимый текст уже даёт имя, а знак «s»
    скрыт `aria-hidden` (axe `label-content-name-mismatch`).
  - D2 `app/request/request-form.tsx`: кнопка «Open date picker» 40×40 → ≥ 44 px.
  - Все: новые маршруты добавлять в `routes` этой spec.
- Ограничения: Impeccable critique/detector не запускался — не установлен в этом
  checkout (`.agents/skills/impeccable` отсутствует); загрузка пакета в сессии
  агента была запрещена. Ручная проверка клавиатурой/скринридером не заменена.

<a id="d6-h005"></a>

## D6-H005 — release journey на реальных сервисах и общие fixtures

- Автор: D6 / Андрей. Адресаты: все; особенно D4 (A04) и D5 (операторские шаги).
- Проверено: 16 ноября 2026. Статус: **ветка опубликована, PR не открыт**.
- Ветка: `codex/andrey-d6-release-e2e`, head `05b563d7ed3480e7cdc78410ba41267be7683a1e`.
  PR: <https://github.com/Arsench1kk/SkillSwap/compare/codex/andrey-d6-a11y...codex/andrey-d6-release-e2e>. Base: D6-H004.
- Контракт:
  - `e2e/support/accounts.ts` — `createAccount(baseURL, role)`: настоящий аккаунт
    через Better Auth HTTP (origin checks включены); E2E-сервер на localhost
    использует существующий dev-флаг `AUTH_DEV_SKIP_EMAIL_VERIFICATION`.
  - `e2e/support/fixtures.ts` — `createVerifiedMentor`, `createLearner`,
    `createScheduledMeeting`, `createLearnerWithMeetings(pool, n)`, `createLinkToken`.
    Только для отдельных состояний; release journey их не использует.
  - `e2e/release/journey.spec.ts` — регистрация обеих ролей, заявка через
    `/api/account/requests`, доступы (401/403/чужой ученик), повтор ошибки.
    Остаток пути — `test.fixme` с перечнем блокеров.
- **Действие получателей:**
  - D4: регрессию A04 писать на `createLearnerWithMeetings(pool, 2)` в `e2e/sessions/**`.
  - D2/D3/D4/D5: по мере merge своих сервисов D6 добавляет шаги в journey;
    сообщите endpoint/UI-шаг и ожидаемый статус в своём журнале.
- Проверки: полный Playwright 101 passed + 1 fixme на чистой `skillswap_test`.

<a id="d6-h006"></a>

## D6-H006 — runbook эксплуатации и ручной запуск jobs

- Автор: D6 / Андрей. Адресаты: D1 (почта/секреты), D4/D5 (jobs), все.
- Проверено: 16 ноября 2026. Статус: **ветка опубликована, PR не открыт**.
- Ветка: `codex/andrey-d6-ops`, head `5523c378ff7e6fb9752ca4e198a5ac7ac4137e75`.
  PR: <https://github.com/Arsench1kk/SkillSwap/compare/codex/andrey-d6-release-e2e...codex/andrey-d6-ops>. Base: D6-H005.
- Контракт: `docs/operations/RUNBOOK.md` (окружения, инвентарь секретов без
  значений, порядок migrate → deploy, backup/restore, rollback, мониторинг);
  `.github/workflows/ops-jobs.yml` — `db:expire-feedback` вручную в GitHub
  Environment `staging`/`production` с его секретом `DATABASE_URL`.
- **Действие получателей:** D4/D5 — согласовать cadence и доступы (R11), затем
  D6 добавит расписание. Команда — создать Environments и required reviewers
  для production, отдельную Neon-ветку staging, ключ Resend staging.
- Проверки: pg_dump/pg_restore локально (PostgreSQL 17.10) — счётчики совпали,
  триггер append-only на `events` сохранился. Staging и Neon не проверялись.

<a id="d6-h007"></a>

## D6-H007 — найдено: страницы приватных ссылок не читаются без JavaScript

- Автор: D6 / Андрей. Адресаты: D2 (`request/[token]`), D3 (`brief/[token]`),
  D4 (`session`, `rate`), D5 (`report`); D1 — общий шаблон.
- Проверено: 16 ноября 2026 на `main` `edf8135`. Статус: **находка**.
- Суть: при `cacheComponents` эти страницы рендерят данные внутри `<Suspense>`.
  Потоковый контент приходит скрытым и показывается скриптом; при выключенном
  JS пользователь видит только `PublicPageLoading`. AGENTS требует читаемость
  без JS «где практично». Подтверждено на privacy в E2E без JS до перевода её
  на клиентский перевод.
- Варианты для обсуждения с D1: принять ограничение и указать в UX; либо
  отдавать основное содержимое без Suspense (блокирующий рендер маршрута),
  если Next 16 это позволяет для этих сегментов. Решение — общее, не по одной странице.

<a id="d6-h008"></a>

## D6-H008 — документы A11, протокол пробы и release checklist

- Автор: D6 / Андрей. Адресаты: все; утверждение — команда/владелец продукта.
- Проверено: 16 ноября 2026. Статус: **ветка опубликована, PR не открыт**.
- Ветка: `codex/andrey-d6-docs`, head `3c0d271ebbe517087269206619be2e4c1bc8ab51`.
  PR: <https://github.com/Arsench1kk/SkillSwap/compare/codex/andrey-d6-ops...codex/andrey-d6-docs>. Base: D6-H006.
- Изменения: `docs/UX_SPEC.md` (§1 модель account-participant, §7 cancelled ≠
  no_show, §12 разрешённый кабинет, §13 ссылки на R09/R07/R11), строка
  `experiment` в словаре помечена R10; `docs/launch/USABILITY_UX11.md`,
  `docs/launch/RELEASE_CHECKLIST.md`.
- **Действие:** проверить формулировки на ревью — это редакция по уже принятым
  решениям, новых продуктовых решений нет. R01–R11 не утверждены, поэтому
  в спецификации ничего не «сведено» сверх ссылок.

## Прочитанные и применённые передачи

- D2-H001 (просьба D6 подключить `e2e/learner/**` в CI) — adopted 16.11.2026:
  testDir `./e2e` включает подкаталоги, job `e2e` в D6-H001; 3 spec D2 проходят.
  Ключи строк D2-H001 не добавлены: нет ссылки на утверждённый текст.
- D1-H006 @ `3d14aa3e2eddec702ec1c7c5f71b0a8db5d6d4c0` — adopted: env auth/почты
  перечислены без значений в runbook (D6-H006); ограничение «HTTP 200 ≠ доставка»
  отражено в проверке почты.
