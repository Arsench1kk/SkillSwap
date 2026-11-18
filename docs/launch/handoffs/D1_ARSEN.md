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
  до исправления защиты назначения. [Draft PR №13](https://github.com/Arsench1kk/SkillSwap/pull/13).
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

<a id="d1-h015"></a>

## D1-H015 — E0: пруд в первом экране, 3D-swap во втором

- **Автор:** D1 / Арсен. **Адресаты:** D2, D3, D6.
- **Проверено:** 18 ноября 2026. **Статус:** локальный визуальный прототип; интеграция не выполнена. [Docs PR №16](https://github.com/Arsench1kk/SkillSwap/pull/16) открыт, доставка записи в main ожидает объединения. Предварительный номер D1-H009 из прерванной сессии не используется: он уже принадлежит разделу встреч.
- **Код:** локальная ветка `codex/arsen-landing-design`, полный HEAD базы `47cd6cfc4b7a0c08c11252b1b1d2b0c8102dcf81` плюс незакоммиченный `output/skillswap-exchange-3d/`. Feature PR и опубликованного SHA прототипа нет. Наличие этой записи не означает доступность моделей в GitHub. Документация идёт отдельно в ветке `codex/arsen-e0-3d-handoff-20261118`.
- **Base/зависимости:** независимый standalone E0 по прямому запросу пользователя; G0/G1 остаются открытыми. Старый fish-прототип сохранён отдельно. Серверные helpers и соседние feature-модули не используются.
- **Текущая компоновка, явно заданная пользователем:** `index.html` помещает воду/двух koi только в `.hero-screen`, модели — в следующий `#how .exchange-scroll`. `pond.css`/`water.js` ограничивают фон и рябь первым экраном, без fixed-слоя по странице. Pointer за пределами hero игнорируется, offscreen-water останавливается; shader рыб использует согласованные hero-local координаты.
- **3D-контракт:** `scene.js` объединяет модели в два cluster pivot и связывает native scroll progress 0–1 со сменой их мест, противоположными полными Y-поворотами и разнесёнными depth-paths. Камера стабильна; движение обратимо. `window.skillSwap3D` предоставляет `progress` (отображённую позу), `targetProgress`, `poses`, `clusters`, `roots`, `setPaused` для визуального smoke. Это debug API прототипа, не общий production-контракт.
- **Доступность/fallback:** две синхронные кнопки pause используют существующие строки. Pause фиксирует позу; resume приводит её к текущему scroll. Reduced motion даёт читаемую статичную фронтальную композицию без длинного sticky runway; явный Play включает движение. Статичные `assets/koi-poster.png`/`exchange-poster.png` независимы. Без JS и при отказе модели нет пустого длинного участка прокрутки.
- **Артефакты:** общая сцена `models/exchange.glb`, 19 отдельных GLB в `models/manifest.json`, `source/exchange.blend` и `source/build_models.py`. Все пути выше относительно локального `output/skillswap-exchange-3d/`. Геометрия экспортов не менялась; две рыбы, их плавники, мелководные тени и подводный материал сохранены. Карточки/имена/поля — реконструкция вымышленной иллюстрации, не утверждённый контракт public profiles.
- **Fingerprints локальной версии (SHA-256, не Git SHA):** `models/exchange.glb` — `9afde90ef42a9d6a91cf116d6ddeb1c6e56ab29b7da8f517faa4d0458ebae058`; `scene.js` — `8ec010644e3107af037a9a3f31de8d9d5d5f5f1dfd69056cdeedb4dad9f2d7e7`; `koi-rig.js` — `ca829d727dc743429b3bccf9ac5bf82e90d40dd5c3f8d6f3d322843998375cd4`; `water.js` — `e4132645d5ef65472b112d8519669ae2ef16a739572249aedcb52b18bb10f5c0`.
- **Действие получателя:** D2/D6 получить локальный bundle у D1 до интеграции, согласовать production tokens/строки/точки подключения, scroll/fallback и GPU-бюджет; не импортировать отсутствующий в main путь. D3 не принимать иллюстрацию за спецификацию полей/видимости профиля. Принятие за получателей не отмечалось.
- **Зависимость:** уже используемый локальный Three.js 0.181.2, MIT, для GLB/PBR, license сохранён. Для scroll-swap новых пакетов нет; package/lockfiles приложения не менялись.
- **Базовая проверка экрана до орбиты стрелок:** Chromium 1440/720/360 — hero-only water/reflections, остановка offscreen clocks, отсутствие ripple вне hero, pause рыб, пять фаз реальных world-поз, обратный X-порядок карточек, front/edge/back Y-ракурсы, обратная прокрутка и фиксация позы на pause прошли. Нет overflow/page/HTTP errors. No-JS/reduced motion, отсутствие длинного static-runway, keyboard/CTA и model-error fallback прошли. Исправлен обнаруженный zero-area IntersectionObserver случай на точной границе hero, после чего полный указанный прогон прошёл. Desktop/mobile и несколько ракурсов просмотрены вручную, posters регенерированы. `source/verify.cjs` и `source/make_poster.cjs` воспроизводят проверки/ассеты; снимки остаются вне Git.
- **Орбита стрелок, 18 ноября:** по прямому запросу пользователя `exchange_arrows` помещены в отдельный `arrow_orbit` в центре реальной геометрии. Общий scroll progress задаёт абсолютный Z-поворот 0→π: синяя и жёлтая стрелки проходят по окружности и меняют верхнюю/нижнюю позиции. Начальная поза сохранена; reverse/pause/reduced motion используют тот же `applyPose`. Debug: `arrowPivot` и `arrowPose.rotationZ`. Новых пакетов, экспортов геометрии, строк или изменений рыб/воды/карточек нет.
- **Проверки орбиты:** новый полный указанный прогон Chromium1440/360 прошёл: пять фаз, смена порядка стрелок, противоположные стороны в середине, постоянные 3D-радиусы орбит, half-turn endpoint, pause всей позы и обратная прокрутка; прежние hero/no-JS/reduced-motion/keyboard/model-error проверки тоже прошли. Desktop/mobile кадры просмотрены. Начальная поза не изменилась, новые fallback-ассеты не потребовались.
- **Ограничения:** модель по одному изображению приблизительная; водный эффект художественный. Реальные мобильные GPU не профилированы, software Chromium медленный. Impeccable отсутствует в checkout, detector недоступен; evaluator другого провайдера недоступен, выполнена ручная критика. App lint/typecheck/unit suites не запускались: приложение не менялось. Нет изменений schema/events/auth/API/production deployment.
