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

<a id="d1-h009"></a>

## D1-H009 — раздел встреч в кабинете

- **Автор:** D1 / Арсен. **Адресаты:** D4 и D6.
- **Проверено:** 14 ноября 2026. **Статус:** объединён в `main` коммитом `0997553ad1626cd9e66a40a73b0f86527d836576`. [PR №10](https://github.com/Arsench1kk/SkillSwap/pull/10).
- **Ветка:** `codex/arsen-extract-prototype-sessions`.
  **Head:** `0dd0a42e171a4b2ea23df89298603a186b2d33b6`.
  **Base:** `main` на `06656d38bf2a9cede76e75ad24d83b8c9227620f`.
- **Контракт:** `apps/web/features/sessions/prototype-sessions.tsx`
  экспортирует `PrototypeSessions` и `PrototypeSessionTab`. Локальные стили
  находятся рядом в `prototype-sessions.module.css`. Оболочка передаёт демо-режим,
  выбранную вкладку и обработчики. Выбранная вкладка сохраняется при навигации.
- **Действие:** после объединения D4 развивает раздел и его тест в
  `apps/web/e2e/sessions/prototype-sessions.spec.ts`. Изменения навигации
  согласуются с D1. D6 проверяет регрессии оболочки. Подключение реального списка
  зависит от контракта встреч и утверждённых правил R07. PR №8 не требуется
  для этого переноса.
- **Проверки:** форматирование, lint, typecheck, миграции, 235 тестов на
  PostgreSQL (один существующий TODO) и 7 Playwright сценариев кабинета.
  Новый сценарий проверяет демо-режим, открытие встречи и переключение вкладки
  клавиатурой, сохранение вкладки и ширину 360 px. Существующий сценарий
  проверяет пустой раздел для аккаунта. Impeccable отсутствует в рабочей копии.
  Новых зависимостей нет.

<a id="d1-h010"></a>

## D1-H010 — список заявок ученика в кабинете

- **Автор:** D1 / Арсен. **Адресаты:** D2 и D6.
- **Проверено:** 14 ноября 2026. **Статус:** объединён в `main` коммитом `73ca3387cc65541ca9a859036f2cf9f3b706daa0`. [PR №11](https://github.com/Arsench1kk/SkillSwap/pull/11).
- **Ветка:** `codex/arsen-extract-prototype-requests`.
  **Head:** `22523f1af6b1eeae0121dc756fe9df0d937737c9`.
  **Base:** `main` на `0997553ad1626cd9e66a40a73b0f86527d836576`.
- **Контракт:** `apps/web/features/learner/prototype-requests.tsx` экспортирует
  `PrototypeRequests` и `PrototypeRequest`. Стили списка и статусов находятся
  рядом в `prototype-requests.module.css`. Оболочка передаёт данные, признак
  аккаунта, загрузку, ошибку и обработчики открытия, создания и повтора.
  Загрузка списка и форма создания остаются в прежних местах.
- **Действие:** после объединения D2 развивает список и
  `apps/web/e2e/learner/prototype-requests.spec.ts`. Навигация и передача данных
  согласуются с D1. D6 проверяет переходы в кабинете.
- **Совместимость:** PR №11 обновлён поверх объединённого PR №10.
  Конфликт в `prototype-app.tsx` и `prototype.module.css` разрешён, оба модуля
  подключены к оболочке. R08, поиск и новые экраны остаются отдельными задачами.
- **Проверки:** форматирование, lint, typecheck, миграции, 235 тестов PostgreSQL
  (один существующий TODO) и девять браузерных сценариев для обоих модулей. Новые тесты на 360 px
  проверяют демо, клавиатуру, загрузку, ошибку, повтор и заполненный список.
  Существующий сценарий проверяет пустой список. Impeccable отсутствует в копии.
  Новых зависимостей нет. [GitHub CI обновлённого PR](https://github.com/Arsench1kk/SkillSwap/actions/runs/43597878397) прошёл.

<a id="d1-h011"></a>

## D1-H011 — поиск наставников в кабинете

- **Автор:** D1 / Арсен. **Адресаты:** D2, D3 и D6.
- **Проверено:** 14 ноября 2026. **Статус:** объединён в `main` коммитом `632ade9d7b66481690fca294a956ed46183d72b3`. [PR №12](https://github.com/Arsench1kk/SkillSwap/pull/12).
- **Ветка:** `codex/arsen-extract-prototype-discovery`.
  **Head:** `88fd7f76b25be96fdf5075e77c1adcb49f3294c0`.
  **Base:** `main` на `90e3a95136a32ac0bd6a3d62de99653bb19c18ab` с PR №10 и №11.
- **Контракт:** `apps/web/features/discovery/prototype-discovery.tsx`
  экспортирует `PrototypeDiscovery` и общий `MentorSkills` для карточки профиля.
  Поисковые стили в `prototype-discovery.module.css`, демо-данные и локализация
  в `prototype-mentors.ts`. Оболочка управляет фильтрами, сохранёнными профилями
  и переходом к профилю или созданию заявки.
- **Действие:** D2 развивает поиск и его Playwright-тест
  `apps/web/e2e/learner/prototype-discovery.spec.ts`. D3 учитывает общий
  `MentorSkills` и демо-данные при выделении профилей. D6 проверяет кабинет
  и переводы. Реальный поиск ждёт утверждения R01–R02.
- **Проверки:** форматирование, lint, typecheck, миграции, 235 тестов PostgreSQL
  (один существующий TODO), десять сценариев Playwright. Новый сценарий проверяет
  фильтр навыка, сохранение и удаление профиля, пустую выдачу и сброс фильтров
  на 360 px с клавиатуры. Существующие сценарии проверяют поиск на 360 и 1440 px
  и пустую выдачу для аккаунта. Impeccable отсутствует. Новых зависимостей нет.
  [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/43598462432) прошёл.

<a id="d1-h012"></a>

## D1-H012 — ревью тестовой инфраструктуры D6

- **Автор:** D1 / Арсен. **Адресаты:** D6, D2–D5 для учёта статуса тестовой базы.
- **Проверено:** 18 ноября 2026. **Статус:** reviewed, принятие D6-H001 отложено
  до исправления защиты назначения. Блокер снят 19 ноября через D1-H016. [PR №13](https://github.com/Arsench1kk/SkillSwap/pull/13).
- **Код:** ветка Андрея `codex/andrey-d6-test-ci`, head
  `4fe8c0867e6532544a3a60302b553607705b2253`. Base
  `edf813505718cbe8d8f709c3cf2fd3de5b8ea47c`.
- **Дефект P1:** `apps/web/testing/database-target.ts` проверяет hostname
  через URL, но возвращает исходный connection string. Для строки
  `postgres://synthetic:synthetic@localhost/skillswap_test?host=remote.example.test&port=6543`
  guard видит localhost:5432, а фактическая конфигурация `pg.Client` —
  remote.example.test:6543. Воспроизведено без подключения к удалённому серверу.
  `testing/prepare-database.ts` использует тот же URL для административного
  Client, включая DROP DATABASE при --reset.
- **Действие D6:** согласовать проверку с реальным разбором pg либо запрещать
  переопределения назначения через query до открытия соединения. Регрессии
  должны включать host/port, socket path, encoded и повторяющиеся параметры.
  Проверка должна сработать до reset, fixtures и миграций.
- **Проверки:** format:check, lint, typecheck, 252 теста на отдельном временном
  PostgreSQL 16 с одним существующим TODO, prepare/reset, --migrations-dir
  с текущими миграциями и 63 Playwright сценария прошли. Первый запуск
  dev-сервера остановился на одноразовом уведомлении Next.js, повтор прошёл.
  Upgrade со старой схемы и production build в этом ревью локально не повторены.
  Их выполняет новый GitHub CI. Новых зависимостей нет.
- **Доставка:** эта запись публикуется в main отдельно. Изменение guard принадлежит
  D6. Ветка Андрея открыта для ревью через PR №13.

<a id="d1-h013"></a>

## D1-H013 — приглашения наставника в кабинете

- **Автор:** D1 / Арсен. **Адресаты:** D3 / Амир и D6.
- **Проверено:** 18 ноября 2026. **Статус:** объединён в main коммитом `657253919a3c565133b9a4c93ec8bf5252e6e12b`. [PR №14](https://github.com/Arsench1kk/SkillSwap/pull/14).
- **Ветка:** `codex/arsen-extract-prototype-invitations`.
  **Head:** `6abc00416dc450156f07c0f843a6479376473ee7`.
  **Base:** `main` на `0d9eb2502f1faf65674a2c1fe4f2db1a334fb7cb`.
- **Контракт:** `apps/web/features/mentor/prototype-invitations.tsx`
  экспортирует `PrototypeMentorHome`, `PrototypeInvitations`,
  `PrototypeInvitationStatus`. Локальные стили карточек и списка находятся
  рядом. Оболочка передаёт демо-режим, ответы и обработчики. Ответы сохраняются
  при переходах между главной и списком.
- **Действие:** после объединения D3 развивает модуль и тесты
  `apps/web/e2e/mentor/prototype-invitations.spec.ts`. Навигация остаётся
  в ведении D1. D6 проверяет общие стили и локализацию. Реальные приглашения
  и права доступа подключает D3 по согласованному контракту.
- **Проверки:** format:check, lint, typecheck, миграции и 235 тестов на
  PostgreSQL 16 (один существующий TODO). Двенадцать Playwright сценариев
  кабинета прошли, включая два новых на 360 px. Проверены принятие, отказ,
  отмена ответа, независимость двух карточек, сохранение при навигации и пустой
  аккаунт. Выполнен React best practices review. Impeccable отсутствует.
  Production build проверяет GitHub CI. Новых зависимостей нет.
- **Доставка:** запись публикуется в main; код объединён через PR №14.
  [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/44249966468) прошёл.

<a id="d1-h014"></a>

## D1-H014 — собственный профиль в кабинете

- **Автор:** D1 / Арсен. **Адресаты:** D3 / Амир и D6.
- **Проверено:** 18 ноября 2026. **Статус:** объединён в main коммитом `fae8ceaae6ac6fb8443902b4fb395821e41b57cf`. [PR №15](https://github.com/Arsench1kk/SkillSwap/pull/15).
- **Ветка:** `codex/arsen-extract-prototype-profile`.
  **Head:** `091ea0cb489f45e9e3f73c9efc789c9a92f1b4c0`.
  **Base:** `main` на `657253919a3c565133b9a4c93ec8bf5252e6e12b`.
- **Контракт:** `apps/web/features/profile/prototype-profile.tsx` экспортирует
  `PrototypeProfile`. Стили просмотра и формы находятся рядом. Оболочка
  передаёт отображаемые данные, признаки аккаунта/редактирования и callbacks.
  Состояние демо-профиля, snapshot отмены и навигация остаются в оболочке.
- **Действие:** после объединения D3 развивает компонент и
  `apps/web/e2e/mentor/prototype-profile.spec.ts`. D6 проверяет переводы
  и общие стили. Реальное изменение профиля ждёт правил R01–R05.
- **Совместимость:** PR №15 обновлён поверх объединённого PR №14.
  Сохранены импорты обоих модулей, удалён неиспользуемый импорт Check.
  Карточка публичного наставника ещё в оболочке.
- **Проверки:** format:check, lint, typecheck, миграции и 235 тестов на PostgreSQL
  с одним существующим TODO. Общая сборка приглашений и профиля прошла
  14 браузерных сценариев при повторе. Первый прогон дал 12 passed / 2 failed
  из-за остановки dev-сервера и ERR_CONNECTION_REFUSED. Новый тест на 360 px
  проверяет добавление навыка, сохранение, отмену и уход с черновиком.
  React best practices review выполнен, Impeccable отсутствует.
  [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/44251052869)
  прошёл при повторе без изменения кода: первая сборка упала в загрузчике
  next/font для Google Fonts, повторная production-сборка успешна.
  Новых зависимостей нет.
- **Доставка:** запись публикуется в main; код объединён через PR №15.

<a id="d1-h016"></a>

## D1-H016 — исправление защиты назначения тестовой БД D6

- **Автор:** D1 / Арсен, по явному разрешению владельца продукта выполнять
  блокирующие задачи коллег. **Адресаты:** D6 и все D1–D5.
- **Проверено:** 19 ноября 2026. **Статус:** исправление опубликовано в
  [PR №17](https://github.com/Arsench1kk/SkillSwap/pull/17) объединён в ветку D6,
  [PR №13](https://github.com/Arsench1kk/SkillSwap/pull/13) объединён в main
  коммитом `9f68817ed95b43d4a95f833ff052d8141ea76df0`. Блокер D1-H012 снят.
- **Код:** `codex/arsen-test-database-guard`, head
  `1573c92fe492bb50bccc2d70fc4467143283c23f`; base — ветка D6
  `codex/andrey-d6-test-ci` на `4fe8c0867e6532544a3a60302b553607705b2253`.
  PR №17 направлен в ветку D6, а не напрямую в main. Перед merge PR №13
  ветка обновлена текущим main без конфликтов; проверен head
  `23f6028e1aed4646532d86bb89c7edf1411f9a7f`.
- **Контракт:** `apps/web/testing/database-target.ts` теперь отклоняет все query
  параметры URL до создания pg.Client. Хост и порт задаются только в authority;
  SSL query options тоже не поддерживаются для тестовой БД. Отсутствующий порт
  явно нормализуется к 5432, поэтому PGPORT не меняет проверенное назначение.
  Имя БД декодируется так же, как pg; ошибки encoding не выводят credentials.
  Публичные функции и порядок выбора env сохранены.
- **Тесты:** `apps/web/testing/database-target.test.ts`: 18 новых регрессий,
  включая encoded/duplicate host и port, socket path, nested connectionString,
  PGPORT, совпадение цели с pg и отказ subprocess reset до создания клиента.
  Отрицательные сценарии не подключаются к удалённым серверам.
- **Действие D6:** после объединения принять исправление во все последующие
  stacked-ветки H003–H006/H008 перед их merge. Не возвращать исходный URL вместо
  нормализованного. Владение инфраструктурой остаётся D6. Все агенты: использовать
  host/port в authority и отдельный сегмент test в имени БД; не передавать query.
- **Проверки:** format:check, lint, typecheck; 270 unit/integration passed и один
  существующий TODO на отдельном PostgreSQL 16. prepare/reset и чистые миграции
  прошли. [CI исправления](https://github.com/Arsench1kk/SkillSwap/actions/runs/44426823024)
  прошёл: 63 E2E и production build.
  [CI итоговой интеграции](https://github.com/Arsench1kk/SkillSwap/actions/runs/44427298823)
  прошёл: 270 unit/integration и один существующий TODO, 66 E2E, production build,
  чистые миграции и upgrade от base. Дополнительных зависимостей, миграций,
  экранов, строк или событий в исправлении нет.
- **Доставка:** код и эта запись доступны в main. D6-H001 принят D1
  с исправлением D1-H016; остальные stacked-передачи D6 этим не приняты.
  G0/G1 целиком не закрываются.

<a id="d1-h017"></a>

## D1-H017 — выделение демо-карточки наставника

- **Автор:** D1 / Арсен. **Адресаты:** D2 / Руслан, D3 / Амир, D6 / Андрей.
- **Проверено:** 19 ноября 2026. **Статус:** [PR №18](https://github.com/Arsench1kk/SkillSwap/pull/18) объединён в main
  коммитом `fc5ea6e7382ef1a04bf694ea0a0dbbbf75db7ceb`.
- **Код:** `codex/arsen-extract-mentor-card`, head
  `4c947690dcba09962bc815cb5664bfc681163336`; base main
  `4d5baab9a905eed83e10640508fcc598f2844510` (включает PR №13/D1-H016).
- **Контракт:** `apps/web/features/profile/prototype-mentor-card.tsx` экспортирует
  `PrototypeMentorCard({ mentor, onBack, onRequest })`. Локальные стили рядом
  в `prototype-mentor-card.module.css`. Оболочка хранит selectedMentor и навигацию.
  Тип Mentor, localizeMentor и MentorSkills переиспользуются из D2 discovery;
  их реализация и контракт не менялись. Shared buttons/avatar/backLink остаются
  в shell CSS. Стили перенесены с прежним каскадом и значениями.
- **Действие:** после merge D3 развивает выделенный компонент и
  `apps/web/e2e/mentor/prototype-mentor-card.spec.ts`. D2 сохраняет экспорт
  переиспользованных helpers либо координирует изменение с D3/D1. D6 проверяет
  общие стили/переводы. D1 отвечает за переходы и выбранного наставника.
- **Граница:** G0 refactor существующего экрана концепта /prototype;
  отдельного approved screen ID публичного профиля в UX нет. Реальные профили,
  API, persistence, privacy/moderation и поля не добавлялись: R01–R05 открыты.
  Пустая выдача аккаунта сохранена. Availability на карточке, общие стили
  backLink и прежние числовые CSS значения не исправляются этим переносом;
  это остаётся работой владельцев, а не новым дизайн-контрактом.
- **Проверки:** format:check, lint, typecheck; миграции и 270 unit/integration
  passed, один существующий TODO на отдельном PostgreSQL 16. Все 67 Playwright
  сценариев прошли при финальном прогоне (37.5 s). Два предыдущих прерваны
  остановкой dev-сервера Next.js на upgrade reminder; эти результаты не зелёные.
  Новый 360 px smoke проверяет выбор не первого наставника, сведения/правило
  контактов, клавиатурный переход к заявке, отмену и возврат к результатам.
  Визуально проверены 360/1440 px без overflow. React review выполнен;
  Impeccable и agent-browser отсутствуют, использован Playwright/manual critique.
  Новых зависимостей, строк, событий или миграций нет.
  [GitHub CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/44474584239)
  прошёл полностью, включая production build, Playwright и upgrade миграций.
- **Доставка:** код и запись доступны в main. G0/G1 целиком не завершены.

<a id="d1-h018"></a>

## D1-H018 — надёжная сессия и действия аккаунта в кабинете

- **Автор:** D1 / Арсен. **Адресаты:** все D2–D6.
- **Проверено:** 19 ноября 2026. **Статус:** [PR №19](https://github.com/Arsench1kk/SkillSwap/pull/19) объединён в main
  коммитом `e3540df84fa47bcdb516e1808f373efe3a6bceea`.
- **Код:** `codex/arsen-workspace-auth-state`, head
  `cda749326f2ca00140f06414fec499d24f591db2`; base main
  `407adc8564f4e7df4ff73b3d7d80d4431f9ad06d`.
- **Поведение:** `apps/web/app/prototype/prototype-app.tsx` разделяет проверку
  сессии и PrototypeWorkspace. Pending не показывает демо; error показывает
  существующее authRequestError и retry через Better Auth refetch. Если библиотека
  сохранила прежнюю сессию при временном сбое, workspace остаётся смонтированным,
  но скрытым, чтобы сохранить локальные черновики. Другая account identity
  получает новый экземпляр workspace. Только успешный signed-out открывает демо.
- **Действия:** activeRole меняется в UI после успешного Better Auth updateUser.
  До подтверждения остаётся прежняя роль. Role-save и signout используют общий
  in-flight guard, отключают конкурирующие кнопки и обрабатывают returned/thrown
  errors существующими сообщениями. Не отключать guard и не возвращать
  оптимистичное переключение до server confirmation: запросы зависят от роли БД.
- **Действие получателей:** D2–D5 учитывать, что feature-компоненты монтируются
  после разрешения начальной сессии. Временная auth error не является пустой
  выдачей или demo. D6 сохранить auth regression в общем CI. Новых API/DTO,
  схемы, событий, строк, CSS или зависимостей нет; серверные guards не менялись.
- **Проверки:** lint/typecheck/format; 10 целевых unit/integration тестов
  account-session на отдельном PostgreSQL 16. Пять выбранных UI сценариев прошли:
  три новых в `apps/web/e2e/account/workspace-auth.spec.ts` и существующие demo
  journey/account request. После уточнения alert-селектора повторён только один
  сценарий, остальные не повторялись. Первый старт dev-сервера был остановлен
  Next.js; результаты того прогона не засчитаны. UI на 360 px, keyboard retry,
  busy/disabled и error recovery проверены. Shared copy/styles переиспользованы,
  React/manual accessibility review выполнен; Impeccable отсутствует.
  [Полный CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/44476912559)
  прошёл с первого прогона: 270 unit/integration и один существующий TODO,
  70 Playwright сценариев, production build, чистые миграции и upgrade от base.
- **Темп работы:** в AGENTS.md публикуется согласованное Арсеном правило
  соразмерных проверок: focused local checks, полный suite один раз в CI,
  повтор только после изменения/конкретного сбоя/неразрешённого риска.
- **Граница:** интеграция AUTH-1–4 с /prototype; G0 ещё открыт, новых экранов
  и продуктовых правил G1 нет. Реальная доставка email этим шагом не проверялась.
- **Доставка:** код, эта передача и правило проверок доступны в main.

<a id="d1-h019"></a>

## D1-H019 — создание встречи при подтверждении учеником

- **Автор:** D1 / Арсен, по разрешению выполнять блокирующие задачи коллег.
  **Адресаты:** D2, D3, D4, D5, D6.
- **Проверено:** 19 ноября 2026. **Статус:** [PR №20](https://github.com/Arsench1kk/SkillSwap/pull/20) объединён в main
  коммитом `9f5a96a5cbc24532df50b93716e1ce29587f8987`.
- **Код:** `codex/arsen-confirm-session`, head
  `e68cc155f1ca0ed31d88a25e6d527f43b113a6b5`; base main
  `cbb4f523bd917c1f2bc5047bfd496bd799762c7b`.
- **Решение:** Арсен 19 ноября выбрал автоматическое создание встречи после
  подтверждения предложенного времени учеником; оператор добавляет Meet позже.
  Решение записано в docs/UX_SPEC.md, «L3 → L4 creation rule», и DECISIONS.md.
  Остальные вопросы R07 не утверждены этим выбором.
- **Контракт D4:** `apps/web/src/services/sessions/schedule-session.ts` —
  `ensureScheduledSession(tx: DatabaseTransaction, matchId: string)` и
  `SESSION_TEMPLATE_VERSION` (`l4-v1`, существующий план L4 без изменения copy).
  Сервис принимает caller transaction, проверяет принятую оператором/обоими
  участниками пару и slot, блокирует match и создаёт/возвращает одну sessions row.
  На повторе не перезаписывает данные оператора или lifecycle-состояние.
  Это внутренняя серверная команда; авторизацию выполняет caller до вызова.
- **Подключение D2:** `apps/web/src/services/learner/request-actions.ts`,
  `confirmLearnerMatch` вызывает сервис после принятия match, до match_accepted,
  в той же транзакции. HTTP/result контракт сохранён; неполное предложение без
  slot возвращает state_changed. Порядок locks: brief → request → match → session.
  Существующий unique index sessions.match_id сохранён; новой миграции нет.
- **Данные:** scheduled, startsAt из предложенного времени, endsAt/meetUrl null.
  Длительность не выдумывается; контактные данные и новые события не добавлены.
  match_accepted сохраняет version brief; будущие L4 события берут version session.
- **Действие:** D2 сохранить вызов в общей транзакции. D4 владеет сервисом и
  продолжает lifecycle/ссылки; D5 использует его после проверки прав вместо
  второго INSERT sessions. D6 учитывает интеграционные регрессии. Никаких adopted
  отметок за получателей нет; их реализация не переписывалась целиком.
- **Проверки:** lint/typecheck, форматирование app sources; 21 целевой PostgreSQL
  integration test passed, включая гонки confirm/decline, повтор, откат при
  отказе recordEvent, missing slot и сохранение Meet при повторном ensure.
  Один существующий L3 smoke на 360 px прошёл после dev-server shutdown retry.
  [Полный CI](https://github.com/Arsench1kk/SkillSwap/actions/runs/44478548007)
  прошёл с первого прогона: 273 unit/integration и один существующий TODO,
  70 Playwright сценариев, production build и проверки миграций.
  Существующее форматирование старых таблиц
  root UX_SPEC сохранено. Новых зависимостей, UI, строк или схемы нет.
- **Ограничения:** закрыта часть A03 о создании sessions, не весь путь встреч.
  Нет backfill старых подтверждений, новых links/feedback, completion/no-show,
  cancellation/rematching или доставки. A04 session-scoped links и остальные
  части R07 остаются открытыми; наличие записи не означает готовую participant URL.
- **Доставка:** код, утверждённая часть R07 и эта передача доступны в main.

<a id="d1-h020"></a>

## D1-H020 — отзывы, Google Meet и персональные ссылки на встречи

- **Автор:** D1 / Арсен. **Адресаты:** D2–D6, особенно D4 и D5.
- **25 ноября 2026:** [PR №8](https://github.com/Arsench1kk/SkillSwap/pull/8)
  Нурлана объединён в main коммитом `6ae80bc0a91af3b1c8f748e57a82950ab8327fe7`.
  Проверенный head `58479978c34d555fc7b3de846ebc879770844898` обновлён от
  `6a3d92bd138d85f37254341a8e05060e3fbbc0e6`. Тесты отзыва и expiry подключены
  к стандартному Vitest, а L4/L5 используют общий Playwright fixture pool.
  [CI PR №8](https://github.com/Arsench1kk/SkillSwap/actions/runs/45631461991)
  прошёл. D4-H001–H005 прочитаны. Отдельный авторский
  [docs PR №9](https://github.com/Arsench1kk/SkillSwap/pull/9) остаётся открытым.
- **Доступ к встрече:** [PR №21](https://github.com/Arsench1kk/SkillSwap/pull/21),
  ветка `codex/arsen-session-links`, head `10a89257b1966f8f915fe9c49a7e31cd1c632f3e`,
  base `6ae80bc0a91af3b1c8f748e57a82950ab8327fe7`. Зависит от PR №8 и №20.
  Объединён в main коммитом `94090e93c6a2d6535c670e7c5604a85d1bb1aa1e`.
  [CI PR №21](https://github.com/Arsench1kk/SkillSwap/actions/runs/45632875327)
  прошёл полностью, включая переход со старых миграций.
- **D1 и D4:** миграция `apps/web/drizzle/0008_session_link_recipient.sql` добавляет
  nullable FK участника к `link_tokens`. `createPrivateLink` принимает
  `recipientParticipantId` для пары purpose=session и subjectType=session.
  В `src/domain/session-page.ts` чтение и действия разрешены для получателя,
  участвующего в указанной встрече. Прежняя participant-ссылка на L4
  открывает встречу только при однозначном результате.
- **D4 и D5:** `apps/web/src/services/sessions/publish-session.ts` проверяет
  подтверждения, время, статус и Google Meet. Обновление Meet и выдача двух
  ссылок проходят в одной транзакции. Срок до 24 часов после назначенного
  начала. В X2 для новых ссылок сохраняется проверка участника по встрече.
- **Действие D5:** из `apps/web` с операторским доступом к БД запустить
  `npx tsx scripts/operator/publish-session.ts --list`. Для выдачи установить
  `NEXT_PUBLIC_APP_URL` и запустить ту же команду с UUID встречи и URL
  Google Meet в приватном терминале. Отправить каждому его ссылку вручную.
  В БД хранятся хеши. D4 переиспользует проверку участия и порядок блокировок
  match → session. D6 сохраняет миграцию и тесты L4/L5 в релизных проверках.
- **Проверки №21:** lint, typecheck, Prettier, чистая миграция PostgreSQL 16,
  24 целевых теста по ссылкам и выдаче, один браузерный L4/X2 smoke на 360 px
  и список встреч CLI на синтетических данных. Новых зависимостей и типов
  событий нет. Правило R07 записано в UX и DECISIONS. Правила завершения,
  автоматическая выдача отзывов, отмена и повторный подбор остаются открыты.
- **Доставка:** код и эта передача доступны в main.

<a id="d1-h021"></a>

## D1-H021 — завершение встречи оператором и выдача ссылки на отзыв

- **Автор:** D1 / Арсен. **Адресаты:** D2–D6, особенно D4 и D5. Проверено
  25 ноября 2026. [PR №22](https://github.com/Arsench1kk/SkillSwap/pull/22).
  Объединён в main коммитом `53e76a566ba832d7e79df61abe8a141ab6c96a89`.
  [CI PR №22](https://github.com/Arsench1kk/SkillSwap/actions/runs/45634993822)
  прошёл полностью. Код и передача доступны в main.
- **Код:** ветка `codex/arsen-complete-session`, head
  `ccba587e3747020b84f8c77dd32d115569625d3e`, base
  `d4f661e7b98547ae3ca887b973819f0650b11a1d`. Опирается на №8, №20 и №21.
- **D1/D4:** миграция `apps/web/drizzle/0009_session_actual_start.sql` добавляет
  `actual_starts_at`. Запланированное время остаётся в `starts_at`.
  `apps/web/src/services/sessions/complete-session.ts` экспортирует
  `completeSession(database, { sessionId, operatorId, actualStart, actualEnd })`.
  Команда проверяет активного оператора, принятую пару и время. Завершает
  сессию и заявку через существующий переход, записывает `session_completed`
  с фактическим окончанием, длительностью и версией шаблона. При открытом окне
  выдаёт ссылку на единственную запись отзыва ученика в той же транзакции.
  Повтор с тем же временем может выдать ссылку на тот же незавершённый отзыв.
- **D5:** из `apps/web` запустить
  `npx tsx scripts/operator/complete-session.ts <session UUID> <operator ID> <actual start> <actual end>`
  с доступом к нужной БД, настроенными `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` и
  `SKILLSWAP_DATA_ORIGIN`. Время в формате `YYYY-MM-DDTHH:mm` по Алматы.
  Указывать свой активный ID оператора. Ссылку из приватного терминала оператор
  передаёт ученику вручную. Ответы принимаются два часа, просмотр доступен
  сутки от фактического конца. При поздней записи встреча завершается без
  нового приглашения к отзыву.
- **D2/D6:** заявка после подтверждённого оператором завершения переходит
  в существующий `completed`. Учесть миграцию и CLI в релизном прогоне.
  Проверки: миграция на временной PostgreSQL 16, 18 целевых тестов, lint,
  typecheck, один сценарий L5 на 360 px и запуск самой команды в терминале
  на синтетической БД с проверкой записи и обоих сроков.
- **Граница:** решение R07 записано в UX и DECISIONS. No-show, отмена и
  повторный подбор остаются отдельными решениями. Новых зависимостей,
  экранов или типов событий нет. Результат относится к проверенному
  тестовому окружению.

<a id="d1-h022"></a>

## D1-H022 — очередь и первое приглашение проверенного наставника

- **Автор:** D1 / Арсен, работа в D3 и D5. **Адресаты:** D2, D3, D4, D5, D6.
  Код объединён в main коммитом `a59ca45ad15352aa7434db37046e4f66a79568df` через
  [PR №23](https://github.com/Arsench1kk/SkillSwap/pull/23).
  Ветка `codex/arsen-first-mentor-invite`, head
  `d19c3df1f117d59ba2a985ef7c315b587e11589e`, base
  `5ed885100e1ec1dcc5c0d3f4ec84051f8bb5c3bf`. Использует сценарии
  подтверждения и создания встречи из PR №20 и ранее объединённый M2.
- **D5:** из `apps/web` в приватном терминале с доступом к нужной БД
  запустить `npx tsx scripts/operator/match-request.ts` с аргументами
  `queue <operator ID>`, `skills <operator ID> <request UUID>`, затем
  `invite <operator ID> <request UUID> <skill UUID> <reason>`. Лимит каждого
  списка 50 записей. Нужны `DATABASE_URL`, а для выдачи ссылки также
  `NEXT_PUBLIC_APP_URL` и `SKILLSWAP_DATA_ORIGIN`. Указывать свой активный
  ID оператора. Передать ссылку вручную одному выбранному наставнику.
  Она действует до 48 часов, с ограничением по дедлайну заявки. Токен
  показывается при выдаче и хранится в БД в виде хеша.
- **D3/D5:** `src/services/operator/matching-queue.ts` выдаёт свежие заявки
  без пары и список подходящих проверенных навыков активных наставников.
  `src/services/mentor/issue-first-brief.ts` выдаёт первое приглашение
  `issueFirstBrief` с проверкой статусов, категории, срока и окна. Смена
  статуса, создание пары, приглашения и запись `brief_sent` атомарны.
  Обработчик M2 сверяет текущий дедлайн и окно. Дальнейшая операторская
  верификация навыков и повторный подбор ведутся отдельно.
- **D2/D4:** до предложения времени заявка в `matching`, существующее
  ожидание и редактирование остаются доступными. Успешный M2 POST переводит
  её в `matched`. L3 подтверждает слот и создаёт встречу обычной командой.
- **D6:** новых миграций, каталожных строк и зависимостей нет. В релизном
  сценарии CI учитывать `first-invitation.integration.test.ts`, где проверены
  сроки, запрет непроверенного навыка, повторная выдача и связка M2 → L3 →
  встреча. Локально пройдены Prettier, lint, typecheck, 23 целевых проверки
  на временной PostgreSQL 16 и три команды CLI в терминале на синтетических
  данных. [CI PR №23](https://github.com/Arsench1kk/SkillSwap/actions/runs/45637617276)
  прошёл полностью.

<a id="d1-h023"></a>

## D1-H023 — ручное решение по навыку наставника

- **Автор:** D1 / Арсен, работа в D3 и D5. **Адресаты:** D2, D3, D4, D5, D6.
  [PR №24](https://github.com/Arsench1kk/SkillSwap/pull/24) объединён в main
  коммитом `96cb70cdc0d1297cf36d4357a580bc08e2b42db1`. Ветка `codex/arsen-skill-verification`, head
  `15fc84a65939d69029e93e2edbebeadf4e0d1764`, base
  `072da0519e82b4c57f1148069352c5b33407721d`. Опирается на PR №23.
- **D5:** из `apps/web` в приватном терминале с активным ID оператора и
  `DATABASE_URL` запустить `npx tsx scripts/operator/verify-skill.ts` с
  аргументами `queue <operator ID>`, `proof <operator ID> <skill UUID>` и
  `decide <operator ID> <skill UUID> <verified|rejected>`. Для решения также
  указать `SKILLSWAP_DATA_ORIGIN`. Очередь выдаёт 50 старейших ожидающих
  навыков без ссылок. По одному UUID команда показывает тип и ссылку на работу.
  Оператор проверяет заявленный навык и принадлежность работы наставнику.
- **D3:** `src/domain/skill-verification.ts` принимает решения по
  `pending` записи активного наставника. Статус, оператор, время и событие
  пишутся в одной транзакции. Повторное решение возвращает `null`.
  `src/services/operator/verification-queue.ts` требует активного оператора
  и отделяет чтение ссылки от очереди. Существующая форма `/mentor/join`
  создаёт ожидающие записи. Подключение из кабинета и политика хранения
  доказательств остаются в работе по R01/R04/R05.
- **D2/D5:** после подтверждения `match-request.ts skills` возвращает навык
  для заявки той же категории. Не переносить ссылку на работу в публичный
  профиль, поиск, приглашение или сообщение участнику.
- **D6:** миграция `0010_skill_verification_decided.sql` добавляет значение
  в журнал событий. `skill_verification_decided` записывает ID наставника и
  оператора, дату и результат `verified` либо `rejected`. В журнале нет
  ссылки, имени или контактов. Новых зависимостей и UI нет. Пройдены 25
  целевых тестов, upgrade временной PostgreSQL 16, запуск трёх команд CLI на
  синтетических данных и [CI PR №24](https://github.com/Arsench1kk/SkillSwap/actions/runs/45641410581).
- **D4/D6:** два браузерных сценария L5 получают собственные тестовые
  данные после обработки просрочки. Не запускать общий job expiry в
  параллельных Playwright-тестах на общей БД. SQL-тест и тесты
  конкурентности job сохранены; серверная логика отзывов не менялась.

## Совместная проверка и общие ограничения

Четыре блока объединены только в локальной ветке `codex/arsen-integration-check`:
146 unit/integration тестов, lint и typecheck прошли, конфликтов не было. Ветка
проверки не опубликована и не заменяет порядок реального объединения PR.
Счётчики 69/100/91/93 относятся к разным веткам и не складываются.

Форматирование общей базы объединено в PR №7. Этап G0 ещё открыт. Это не блокирует всю работу
каждого участника: отделять зависимые части от независимых. Изменения контрактов
сверять по head SHA; локальные результаты не являются результатом GitHub CI.

## Прочитанные и применённые передачи

- D6-H001 — adopted 19 ноября 2026 через PR №13 с исправлением D1-H016.
  Исходный head `4fe8c0867e6532544a3a60302b553607705b2253`, принятый head
  `23f6028e1aed4646532d86bb89c7edf1411f9a7f`. Общие fixtures и test runner
  теперь используют проверенный нормализованный TEST_DATABASE_URL.
  Следующие ветки D6 должны включить это исправление; принятие за D6 не отмечено.

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
