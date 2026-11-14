# D1 — Арсен: исходящие передачи

Файл ведут Арсен и его агент. [Общий протокол](../HANDOFFS.md).
Статусы D1-H001–H008 сверены в GitHub **14 ноября 2026**.
Перед использованием сверяйте статус PR и head SHA.

<a id="d1-h001"></a>

## D1-H001 — аккаунт, активная роль и anonymised participant

- **Адресаты:** D2 Руслан, D3 Амир, D4 Нурлан, D5 Тогжан, D6 Андрей.
- **Статус:** объединён в `main` коммитом `aa2cd48528cf701504a0f6913f2f8d64131b358b`. [PR №1](https://github.com/Arsench1kk/SkillSwap/pull/1).
- **Ветка:** `codex/arsen-platform`; **head SHA:** `1ff09c4d1ab904cf3216a890aeb7c4005a94198b`.
- **Base:** `main`; после объединения PR №7 получен коммит `3bb48a496eb586eeaf880dcf411342a2abc9b119`.
- **Контракт:** `apps/web/src/lib/account-session.ts` → `requireAccountSession`;
  `apps/web/src/domain/account-participants.ts` → `findAccountParticipant`,
  `ensureAccountParticipant`, `AccountAccessError`; `apps/web/src/db/types.ts` →
  `ApplicationDatabase`, `DatabaseTransaction`, `DatabaseExecutor`.
- **Действие:** D2/D3 использовать server auth context и общий mapping вместо
  второй реализации. `find` читает без создания; `ensure` вызывается после
  принятого согласия внутри caller transaction вместе с действием/событием.
  D4/D5 использовать эти типы/контекст при интеграции. D6 учитывать реальные
  auth/DB regression tests и их изоляцию.
- **Ограничения:** account email/name/session token не передаются в participant
  context. Operator-доступ не выдаётся. Старые endpoints ещё не переведены на
  helper; правила R05/R06/R08 не решены этим PR. При withdrawn повторный `ensure`
  не создаёт замену и не восстанавливает согласие.
- **Проверки:** 69 unit/integration, lint, typecheck и build на отдельной локальной
  БД на исходной версии. На обновлённой базе локально прошли 108 тестов, миграции, format:check, lint, typecheck и сборка. [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/43595749671) прошёл. Реальная
  доставка писем не проверялась; production не менялся. Зависимостей/миграций нет.

<a id="d1-h002"></a>

## D1-H002 — атомарный переход состояния с событием

- **Адресаты:** D2, D3; также D4, D5, D6 для event context и транзакций.
- **Статус:** в `main`, merge `b1428835b7bdf5afc186dc44d1f28fbdefc6981f`. [PR №2](https://github.com/Arsench1kk/SkillSwap/pull/2).
- **Ветка:** `codex/arsen-recorded-transitions`; **head SHA:** `16568fc35bd5aa385fe6046f5e65ba459483bcbb`.
- **Base:** `main` на `aa2cd48528cf701504a0f6913f2f8d64131b358b`.
  PR №1 входит в базу. [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/43596076989) прошёл.
- **Контракт:** `apps/web/src/domain/state-machines.ts` → необязательный пятый
  аргумент `{ input: EventInput }` в `transitionLearnerRequest`/
  `transitionMentorBrief`; `events.ts` → строгий `validateEventContext`;
  `event-context.ts` → общий `currentDataOrigin`.
- **Действие:** D2/D3 при подключении передавать утверждённое событие в transition
  и убрать отдельную запись **того же** события. State, audit и event откатываются
  вместе. Проверять `result.ok`. Brief получает template version из своей строки
  БД; versioned request events требуют версии, загруженной сервером.
- **Ограничения:** A08 в `mentor-brief-page.ts` ещё требует подключения Амиром;
  этот PR сам feature-файл не меняет. Существующие вызовы без пятого аргумента
  остаются прежними и автоматически не становятся атомарными с внешним event.
  Сервер задаёт actor/participant/origin/time; не передавать их из JSON. R10 и
  общая политика origin/locale ещё открыты. Само имя события выбирает domain caller.
- **Проверки:** 100 unit/integration, 55 E2E, lint, typecheck, build; SQL failure
  после audit, retry, подмена actor и конкурентная отмена. Зависимостей/миграций нет.

<a id="d1-h003"></a>

## D1-H003 — приватные ссылки и повторный отзыв

- **Адресаты:** D2, D3, D4, D5, D6.
- **Статус:** в `main`, merge `8ec5e3858ef6485891607080fd9c36814f9ed74c`. [PR №3](https://github.com/Arsench1kk/SkillSwap/pull/3).
- **Ветка:** `codex/arsen-private-links`; **head SHA:** `ffc108aab5d007750b606d5c3aaed35a31fb2546`.
- **Base:** `main` на `aa2cd48528cf701504a0f6913f2f8d64131b358b`.
  PR №1 входит в базу. [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/43596077060) прошёл.
- **Контракт:** `apps/web/src/domain/private-links.ts` → прежние
  `createPrivateLink`, `verifyPrivateLink`, `revokePrivateLink` с общей валидацией.
- **Действие:** передавать реальные UUID сущностей либо anonymised participant ID
  и корректные Date; повторный revoke сохраняет первое `revokedAt`. D2/D3/D5 не
  дублировать token helpers. D4 сохранить совместимость старых participant-based
  session links, пока команда не решит R07. D6 использовать валидные fixtures и
  проверить rollback при подключении к полному сценарию.
- **Ограничения:** helper не авторизует вызывающего; права проверяет endpoint.
  R07, выдача/доставка/сроки и точная привязка ссылки к session не реализованы
  этим PR. Хранятся только хеши, raw token не попадает в журналы/события/эту заметку.
- **Проверки:** 91 unit/integration этой ветки (22 новых), 55 E2E, lint, typecheck,
  build; expiry boundary, повтор/конкуренция revoke и rollback. Без новых зависимостей.

<a id="d1-h004"></a>

## D1-H004 — валидация общего лимитера запросов

- **Адресаты:** D2, D3, D4, D5, D6.
- **Статус:** в `main`, merge `8f9e01ec0cfc792ef6623850d4c3b45c48ebc536`. [PR №4](https://github.com/Arsench1kk/SkillSwap/pull/4).
- **Ветка:** `codex/arsen-rate-limit`; **head SHA:** `6278edb1a24b2f83cc49ae43b8c373793aeeda92`.
- **Base:** `main` на `aa2cd48528cf701504a0f6913f2f8d64131b358b`.
  PR №1 входит в базу. [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/43596076994) прошёл.
- **Контракт:** `apps/web/src/domain/rate-limit.ts` →
  `allowRateLimitedAttempt`, общий `RateLimitScope`.
- **Действие:** использовать существующие scope, непустой серверный ключ,
  положительный целый maximum и корректное время. Лимитер вызывать до business
  transaction: её откат не должен обнулять попытку. Новые scope согласовать с D1.
  Ошибки конфигурации/БД — ошибка выполнения; исчерпание квоты — `false`.
- **Ограничения:** действующие лимиты, алгоритм и окно 15 минут сохранены;
  это не новый сервис и не изменение продуктового SLA. Не хранить сырые ключи.
- **Проверки:** 93 unit/integration этой ветки (24 новых), 55 E2E, lint, typecheck,
  build. 5 разрешений из 24 одновременных попыток, границы окна, изоляция scope,
  integer ceiling и hash-only хранение. Новых зависимостей/миграций нет.

<a id="d1-h005"></a>

## D1-H005 — общий протокол передачи для всей команды

- **Адресаты:** все D1–D6 и их агенты; правило установлено Арсеном 4 ноября 2026.
- **Тип/статус:** координационная документация, разрешённая публикация отдельно
  от feature PR. К работе приложения не относится.
- **Версия инструкции:** [commit](https://github.com/Arsench1kk/SkillSwap/commit/7d55e458fdb4dfe4c1907581caf2cfd1b4ccd51c)
  `7d55e458fdb4dfe4c1907581caf2cfd1b4ccd51c`, ветка `codex/team-handoffs`.
  Это версия самих правил; последующая запись об их передаче — отдельная метадата.
- **Контракт:** `AGENTS.md`, `CLAUDE.md`, app-specific инструкции,
  `docs/launch/HANDOFFS.md`, шесть журналов, блоки передач во всех персональных
  заданиях и `.github/pull_request_template.md`.
- **Действие:** перед реализацией читать адресованные своему D-коду записи;
  после полезного коллегам результата обновлять свой журнал и ссылаться на ID
  в PR/отчёте. Отправитель не принимает передачу за получателя. Для доставки
  заметки не требуется объединять исходный Draft-код.
- **Ограничения:** инструкции нужно получить из актуального репозитория и
  перечитать в уже открытой сессии. Журналы не рассылают уведомления сами и не
  заменяют проверку реального PR/его head SHA. Актуальные статусы PR указаны в соответствующих записях.
- **Проверки:** ссылки/anchors, импорты, все шесть точек входа и Prettier.
  Приложение, зависимости и БД не менялись; его тесты для документации не повторялись.

<a id="d1-h006"></a>

## D1-H006 — подтверждение почты и восстановление доступа

- **Автор:** D1 / Арсен. **Адресаты:** D2–D6; D6 — auth/email runbook и проверки выпуска.
- **Проверено:** 14 ноября 2026. **Статус:** в `main`, merge `e7e813c7a9a16198ada84ac9f29a73047698d17b`.
- **PR:** [№5](https://github.com/Arsench1kk/SkillSwap/pull/5).
  Ветка `codex/arsen-auth-recovery`, полный head SHA
  `3d14aa3e2eddec702ec1c7c5f71b0a8db5d6d4c0`.
- **Base:** `main` на `aa2cd48528cf701504a0f6913f2f8d64131b358b`.
  PR №1 входит в базу. [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/43596078031) прошёл.
- **Контракт:** `apps/web/src/lib/auth.ts` — `auth` по-прежнему использует Better
  Auth и Drizzle. Явно задан `advanced.disableOriginCheck: false`, включая тестовый
  режим библиотеки; production-политика доверенных URL прежняя. Ошибка HTTP Resend
  содержит только статус, без полного provider body, где могли быть контакты/ссылки.
  Новый `apps/web/src/lib/auth-recovery.integration.test.ts` проверяет настоящий
  Better Auth/Postgres; заглушка заменяет только исходящий HTTP почты.
- **Действие получателя:** не отключать origin checks ради прохождения теста;
  проверять внешние redirect через HTTP handler с Request, а не только server API.
  Использовать проверенные auth endpoints; не писать собственные токены/пароли.
  D6: сохранить обязательные env `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
  `RESEND_API_KEY`, `AUTH_EMAIL_FROM` в runbook без значений секретов. Для проверки
  доставки нужны отдельные реальные provider/domain проверки перед запуском.
- **Важное ограничение:** установленный Better Auth перехватывает mail callback
  failure в `runInBackgroundOrAwait`, пишет в серверный лог, но сохраняет generic
  success `requestPasswordReset`. HTTP 200 не доказывает отправку; существующий
  UI error-state не получает этот сбой. Не обещать доставку по одному HTTP-ответу.
  Это поведение библиотеки данным PR не изменено; наблюдаемость доставки и
  согласование с AUTH-3 остаются открытой работой D1/D6. Проверки одноразовости
  reset выполнены последовательно; конкурентное погашение этим PR не проверялось.
- **Проверки:** отдельная локальная synthetic БД
  `skillswap_d1_recovery_20261104`, чистые миграции; 81 unit/integration тест,
  включая 12 новых; 55 Playwright тестов; lint, typecheck, production build,
  Prettier изменённых файлов и `git diff --check` прошли. Счётчик 81 относится
  только к этой ветке, не к совокупности всех Draft PR. Dev E2E выдаёт существующее
  предупреждение Turbopack о `@theme` в `globals.css`; shared CSS не менялся.
  Реальных писем нет; доставка, DNS и production secrets не проверялись.
- **Совместимость/пропуски:** сроки токенов, политика отзыва сессий, тексты,
  participant mapping, schema и events не менялись. Новых зависимостей нет.
  UI не изменён; визуальная проверка не требовалась. Это не завершение всего
  AUTH-1–4, G0 или решений R05/R06/R08/R10. Запись публикуется отдельно в main;
  прикладной код остаётся в Draft PR №5.

<a id="d1-h007"></a>

## D1-H007 — контакты в метаданных событий

- **Автор:** D1 / Арсен. **Адресаты:** D2–D6.
- **Проверено:** 14 ноября 2026. **Статус:** в `main`, merge `f3e107aed83cdcc735ab579972cfb354c5ec4a45`.
- **PR:** [№6](https://github.com/Arsench1kk/SkillSwap/pull/6).
  Ветка `codex/arsen-event-privacy`, полный head SHA
  `f868986cd5df507c1fc03b47b9a0c88ba217142d`.
- **Base:** `main` на `e7e813c7a9a16198ada84ac9f29a73047698d17b`.
  PR №2 и остальные зависимости входят в базу.
  [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/43596313467) прошёл.
- **Контракт:** `apps/web/src/domain/events.ts` — `validateEventInput` проверяет
  контакты в `note`, `reasonCode`, `sourceChannel` до SQL внутри `recordEvent`.
  `containsContactData` дополнительно распознаёт handle после пунктуации и прямые
  ссылки `t.me`, `telegram.me`, `wa.me`. Сигнатуры и действующие коды не менялись.
- **Действие получателя:** передавать только неидентифицирующие коды; не помещать
  контакт в `reasonCode` или номер телефона в `sourceChannel`. Обработать ошибку
  валидации обычным механизмом своего endpoint; `recordEvent` вызывать в транзакции
  действия, чтобы отказ откатывал его состояние. Не дублировать фильтр в фичах.
  D3/D4/D5: общий predicate уже вызывается в `app/api/brief/action/route.ts`,
  `app/api/rating/route.ts`, `app/api/report/route.ts`; новые форматы отклоняются
  и этими существующими проверками. Реализация чужих endpoints не редактировалась.
- **Проверки:** отдельная локальная synthetic БД
  `skillswap_d1_event_privacy_20261104`, чистые миграции, все 138 unit/integration
  тестов (38 новых), lint, typecheck, Prettier изменённых файлов и
  `git diff --check` прошли. Проверены отказ до SQL, отсутствие события и откат
  domain write в общей транзакции. В полном E2E — 52/55; три сценария упали по
  таймауту загрузки, затем все три прошли отдельным последовательным прогоном
  (7.8 секунды), без изменения кода или таймаутов. Это не стабильный зелёный
  полный прогон/CI. В dev остаётся предупреждение Turbopack о `@theme`.
  Production build не повторялся: Next/UI и зависимости не менялись.
- **Ограничения:** эвристика не гарантирует обнаружения имён, замаскированных
  контактов, произвольных URL и всех форм PII. `templateVersion`, прямые SQL-вставки
  и отдельный `stateTransitions.reasonCode` данным PR не защищаются. Для metadata
  сохраняется прежняя эвристика телефона; числовые коды, похожие на телефон,
  отклоняются. Новые enum/закрытые reason codes не вводятся: R10 остаётся открытым.
  Старые append-only события не переписываются. Нет новых зависимостей/миграций/UI.
  G0 и остальные продуктовые решения не закрыты. Передача опубликована отдельно
  в main; код объединён через PR №6.

<a id="d1-h008"></a>

## D1-H008 — форматирование общей базы G0

- **Автор:** D1 / Арсен. **Адресаты:** D6 для ревью, D2–D5 и D1 для обновления веток.
- **Проверено:** 14 ноября 2026. **Статус:** объединён в `main` коммитом `3bb48a496eb586eeaf880dcf411342a2abc9b119`.
  [PR №7](https://github.com/Arsench1kk/SkillSwap/pull/7).
  Ветка `codex/g0-format`, head SHA `c8876c51549a9aa0ff37b089b76cfe8e7236b48a`.
- **Base:** `main`, SHA `435344c1e09b3fa09f99b82e90ed5c7064dbab64`.
  Prettier применён к 27 файлам `apps/web` поверх коммита D2.
  Правки Руслана сохранены. Предыдущий head `c5ddf02` входит в историю ветки.
- **Действие:** PR №1–5 объединены в `main`. Конфликт PR №5
  в `apps/web/src/lib/auth.ts` разрешён с сохранением исправлений почты.
  PR №6 прошёл CI на актуальной базе и объединён.
- **Проверки:** Prettier debug-check, полный format:check, lint, typecheck,
  diff-check, миграции и 89 тестов на временном PostgreSQL прошли. Один сценарий
  помечен TODO. Содержимое JSON метаданных Drizzle совпадает после парсинга.
  Новых зависимостей нет. [GitHub CI для PR №7](https://github.com/Arsench1kk/SkillSwap/pull/7/checks).
- **Подготовка D1 на предыдущей базе:** локально PR №1 объединился с PR №7
  на `c5ddf02` без конфликтов.
  Прошли миграции на отдельном PostgreSQL, 69 тестов, форматирование, lint,
  typecheck и production build. В общей локальной сборке PR №1–6 поверх PR №7
  прошли миграции, 196 тестов, форматирование, lint и typecheck. Единственный
  конфликт был в `apps/web/src/lib/auth.ts`. Форматирование G0 совпадает с
  форматированием PR №5, поэтому в локальной проверке сохранён вариант PR №5
  с его правками проверки origin и ошибок почты. Эти объединения были локальными.
  Актуальные статусы PR указаны в соответствующих записях.

## Совместная проверка и общие ограничения

Четыре блока объединены только в локальной ветке `codex/arsen-integration-check`:
146 unit/integration тестов, lint и typecheck прошли, конфликтов не было. Ветка
проверки не опубликована и не заменяет порядок реального объединения PR.
Счётчики 69/100/91/93 относятся к разным веткам и не складываются.

Форматирование общей базы объединено в PR №7. Этап G0 ещё открыт. Это не блокирует всю работу
каждого участника: отделять зависимые части от независимых. Изменения контрактов
сверять по head SHA; локальные результаты не являются результатом GitHub CI.

## Прочитанные и применённые передачи

- [D4-H001](https://github.com/Arsench1kk/SkillSwap/pull/9) — reviewed 13 ноября 2026. Проверен [PR №8](https://github.com/Arsench1kk/SkillSwap/pull/8) на
  `de5b05bbec9c91787bf1ae106c5b25f2e47a2c3f`. Страница и API L5 используют
  `isRatingWindowOpen({ endsAt, completionState }, now)`. При интеграции D1
  передавать оба поля. Для допуска нужны завершённая встреча и время окончания.
  Expiry возвращает число обновлённых строк, повтор без новой работы возвращает 0.
  D1 проверил контракт локально с PR №1–6 и форматированием №7. PR №8
  объединился с этой сборкой без конфликта. Миграции и 213 тестов на отдельном
  PostgreSQL 16, включая opt-in SQL тест expiry, прошли без пропусков.
  Прошли семь браузерных сценариев L5, format:check, lint и typecheck.
  Конкуренция между отправкой отзыва и expiry, scheduler и полный E2E
  остаются вне этого прогона. Код в PR №8 остаётся Draft. После объединения
  форматирования №7 D4 может обновить свою ветку и повторить CI. A04 и R07
  остаются отдельным этапом.
