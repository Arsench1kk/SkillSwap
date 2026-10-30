# SkillSwap A6 toolkit

Небольшой набор скриптов для валидации SkillSwap (фаза 0). Это не приложение: сами эксперименты E1/E2/E3 идут через Telegram, Google Forms, Sheets и Meet.

Что здесь есть:

- `thresholds/frozen_thresholds.json` — пороги решений. Закоммитить до старта E1 и не менять после начала сбора данных.
- `skillswap/thresholds.py` — калькулятор решений E1/E2/E3, включая G1/G2. Пропуски показываются отдельно, rehearsal-данные исключаются.
- `skillswap/validate_events.py` — проверка CSV журнала событий (часовые пояса, `data_origin`, дубли, контактные данные в заметках).
- `skillswap/anonymise.py` — стабильные анонимные ID из контактов (HMAC с секретом).
- `docs/ENGINEERING_PLAN.md` — инженерный план, решения и открытые вопросы. **Начни с него.**
- `docs/context/` — исходные md-файлы проекта без изменений.

Запуск (нужен только Python 3.10+):

```bash
pip install pytest
python -m pytest                                  # 35 тестов
python -m skillswap.validate_events events.csv    # проверить выгрузку
python -m skillswap.report e1 records.json        # решение по E1 (e2, e3 аналогично)
SKILLSWAP_SALT=<длинный секрет> python -m skillswap.anonymise people.csv private_map.csv
```

Форматы входных записей для `report` описаны в докстрингах функций `evaluate_e1/e2/e3`.

Чего пока нет: сборки записей для `report` из журнала событий. Сейчас записи по ментору/кейсу/запросу собираются вручную или из листов Sheets. Это следующий небольшой шаг, когда схема событий проверится на репетиции.
