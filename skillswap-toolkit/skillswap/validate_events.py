"""Validate an events CSV before any analysis. Exit code 1 if there are errors.

python -m skillswap.validate_events events.csv
"""
import csv
import re
import sys
from collections import Counter
from datetime import datetime

from . import events as E

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
PHONE = re.compile(r"\+?\d[\d\s\-()]{8,}\d")
HANDLE = re.compile(r"(?<!\w)@[A-Za-z0-9_]{4,}")


def _parse_ts(s):
    try:
        dt = datetime.fromisoformat(s.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else False  # False = naive, which we reject


def validate(rows, fieldnames):
    errors, warnings = [], []
    missing_cols = [c for c in E.REQUIRED if c not in (fieldnames or [])]
    if missing_cols:
        return [f"missing required columns: {missing_cols}"], [], {}
    unknown = [c for c in fieldnames if c not in E.COLUMNS]
    if unknown:
        warnings.append(f"unknown columns ignored: {unknown}")

    ids = Counter(r["event_id"] for r in rows)
    known_ids = set(ids)
    for i, r in enumerate(rows, start=2):  # header is line 1
        where = f"line {i} ({r.get('event_id') or '?'})"
        if not r["event_id"].strip():
            errors.append(f"{where}: empty event_id")
        elif ids[r["event_id"]] > 1:
            errors.append(f"{where}: duplicate event_id")
        if not re.match(E.PARTICIPANT_ID_RE, r["participant_id"]):
            errors.append(f"{where}: participant_id must look like L-0123456789")
        if r["role"] not in E.ROLES:
            errors.append(f"{where}: bad role {r['role']!r}")
        if r["event_name"] not in E.EVENT_NAMES:
            errors.append(f"{where}: unknown event_name {r['event_name']!r}")
        if r["experiment"] not in E.EXPERIMENTS:
            errors.append(f"{where}: bad experiment {r['experiment']!r}")
        if r["data_origin"] not in E.ORIGINS:
            errors.append(f"{where}: data_origin must be one of {sorted(E.ORIGINS)}")
        ts = _parse_ts(r["timestamp_utc"])
        if ts is None:
            errors.append(f"{where}: unparseable timestamp")
        elif ts is False:
            errors.append(f"{where}: timestamp has no timezone")
        bt = (r.get("brief_type") or "").strip()
        if bt and bt not in E.BRIEF_TYPES:
            errors.append(f"{where}: brief_type must be P or S")
        if r["event_name"] == "brief_sent" and not bt:
            errors.append(f"{where}: brief_sent needs brief_type")
        if r["event_name"] in E.NEEDS_REASON and not (r.get("reason_code") or "").strip():
            errors.append(f"{where}: {r['event_name']} needs reason_code")
        mr = (r.get("missing_reason") or "").strip()
        if mr and mr not in E.MISSING_REASONS:
            errors.append(f"{where}: bad missing_reason {mr!r}")
        c = (r.get("corrects_event_id") or "").strip()
        if c and c not in known_ids:
            errors.append(f"{where}: corrects_event_id points to unknown event")
        note = r.get("note") or ""
        if EMAIL.search(note) or PHONE.search(note) or HANDLE.search(note):
            errors.append(f"{where}: note looks like it contains contact data (PII)")

    summary = {
        "rows": len(rows),
        "by_origin": dict(Counter(r["data_origin"] for r in rows)),
        "by_experiment": dict(Counter(r["experiment"] for r in rows)),
    }
    if len({r["data_origin"] for r in rows} - {"rehearsal"}) > 1 and "rehearsal" in summary["by_origin"]:
        warnings.append("rehearsal rows are present: make sure they are excluded from analysis")
    return errors, warnings, summary


def main(argv=None) -> int:
    path = (argv or sys.argv[1:])[0]
    with open(path, newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        rows = list(rd)
        errors, warnings, summary = validate(rows, rd.fieldnames)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"{summary}  errors={len(errors)} warnings={len(warnings)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
