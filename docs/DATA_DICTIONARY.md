# Словарь данных: журнал событий

Одна строка = одно событие. Строки не редактируются; исправление это новая строка с `corrects_event_id`.
Лист с контактами (`participants_pii`) хранится отдельно, с ограниченным доступом, и не коммитится.

| Поле | Обязательно | Значения / формат |
|---|---|---|
| event_id | да | уникальный |
| participant_id | да | `L-`/`M-`/`O-` + 10 hex (см. anonymise.py) |
| role | да | learner, mentor, operator |
| event_name | да | см. список ниже |
| timestamp_utc | да | ISO 8601 с часовым поясом, например `2026-10-20T09:00:00+00:00` |
| experiment | да | E1, E2, E3 |
| data_origin | да | real_pilot, constructed, rehearsal |
| brief_type | для brief_sent | P или S |
| task_category | нет | STEM, creative |
| source_channel | нет | например чат или клуб (кодовое имя, не название группы с людьми) |
| reason_code | для decline_reason, no_show, safety_flag | закрытый список, фиксируется на днях 1–2 |
| value | нет | оценка 1–5, минуты, и т.п. |
| missing_reason | нет | no_reply, declined, no_skill_match, incomplete, excluded |
| actor | нет | кто сделал запись (оператор) |
| corrects_event_id | нет | id исправляемого события |
| note | нет | без контактов и имён |

## События

Из дорожной карты: request_submitted, brief_sent, mentor_viewed, mentor_accepted, slot_proposed, match_accepted, session_started, session_completed, usefulness_submitted, trust_submitted, no_show, decline_reason.

Для пользовательских потоков платформы добавлены события: `request_cancelled` (учащийся отменил запрос), `request_updated` (учащийся изменил срок или доступность), `match_declined` (учащийся не принимает предложенное время), `session_cancelled` (участник заранее сообщил, что не сможет прийти) и `mentor_join_submitted` (ментор отправил анкету). Они не заменяют `no_show`: фактическое отсутствие записывается отдельно.

X2 пишет категорию в событие `safety_flag`, а необязательное описание хранится отдельно в таблице `reports` с доступом только серверного приложения. Категории пилота: `safety_concern`, `mentor_conduct`, `scheduling`, `privacy_contact`, `other`. Описание не копируется в журнал событий.

Для M2 добавлено событие `mentor_withdrew`: ментор отозвал предложенное время до подтверждения учащимся. Запись добавляется в журнал; прежние события не меняются.

Добавлены мной (в документах их нет, но без них не собрать метрики): mentor_no_reply (явная запись молчания, чтобы оно не терялось), eligibility_checked, match_proposed, safety_flag, followup_48h.

## data_origin

- `real_pilot`: реальный учащийся с реальной задачей.
- `constructed`: выдуманная задача, но реальный ментор (так устроен E1 и E2). Не выдавать за реальный спрос.
- `rehearsal`: репетиция процедуры. Исключается из анализа всегда.
