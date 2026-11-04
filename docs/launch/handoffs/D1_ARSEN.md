# D1 — Арсен: исходящие передачи

Файл ведут Арсен и его агент. [Общий протокол](../HANDOFFS.md).
Статусы ниже проверены в GitHub **4 ноября 2026**; перед использованием сверять
текущий PR и head SHA. Получение этой документации не добавляет feature-код в main.

<a id="d1-h001"></a>

## D1-H001 — аккаунт, активная роль и anonymised participant

- **Адресаты:** D2 Руслан, D3 Амир, D4 Нурлан, D5 Тогжан, D6 Андрей.
- **Статус:** open / draft, не merged. [PR №1](https://github.com/Arsench1kk/SkillSwap/pull/1).
- **Ветка:** `codex/arsen-platform`; **head SHA:** `f447bd349ee73ff668ee405fa9f6e5b7fc5692e6`.
- **Base:** `main`; основа кода `26ed37dcf25752564365db3cf857993dfb526cf5`.
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
  БД; настоящие Better Auth sessions, одновременное создание и rollback. Реальная
  доставка писем не проверялась; production не менялся. Зависимостей/миграций нет.

<a id="d1-h002"></a>

## D1-H002 — атомарный переход состояния с событием

- **Адресаты:** D2, D3; также D4, D5, D6 для event context и транзакций.
- **Статус:** open / draft, не merged. [PR №2](https://github.com/Arsench1kk/SkillSwap/pull/2).
- **Ветка:** `codex/arsen-recorded-transitions`; **head SHA:** `95a4aa0ddbb005fb679e8fb2b9654421e02f3f32`.
- **Base/зависимость:** `codex/arsen-platform`, PR №1 / D1-H001. После объединения
  №1 перенаправить PR и повторить проверки; не считать его уже направленным в main.
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
- **Статус:** open / draft, не merged. [PR №3](https://github.com/Arsench1kk/SkillSwap/pull/3).
- **Ветка:** `codex/arsen-private-links`; **head SHA:** `8f53d2de9ffb46e95b50472f7bf4df60f9ad7275`.
- **Base/зависимость:** PR №1 / D1-H001. От PR №2 не зависит.
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
- **Статус:** open / draft, не merged. [PR №4](https://github.com/Arsench1kk/SkillSwap/pull/4).
- **Ветка:** `codex/arsen-rate-limit`; **head SHA:** `e0437f9625bb5b8fcf9fc5fcc8637f144b67841e`.
- **Base/зависимость:** PR №1 / D1-H001. От PR №2/№3 не зависит.
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
  заменяют проверку реального PR/его head SHA. Код PR №1–4 остаётся в их ветках.
- **Проверки:** ссылки/anchors, импорты, все шесть точек входа и Prettier.
  Приложение, зависимости и БД не менялись; его тесты для документации не повторялись.

## Совместная проверка и общие ограничения

Четыре блока объединены только в локальной ветке `codex/arsen-integration-check`:
146 unit/integration тестов, lint и typecheck прошли, конфликтов не было. Ветка
проверки не опубликована и не заменяет порядок реального объединения PR.
Счётчики 69/100/91/93 относятся к разным веткам и не складываются.

Общий долг форматирования 26 файлов и G0 не закрыты. Это не блокирует всю работу
каждого участника: отделять зависимые части от независимых. Изменения контрактов
сверять по head SHA; локальные результаты не являются результатом GitHub CI.

## Прочитанные и применённые передачи

Пока нет отметок о применении передач других участников. Это не подтверждение,
что коллеги прочитали или подключили D1-H001–D1-H004.
