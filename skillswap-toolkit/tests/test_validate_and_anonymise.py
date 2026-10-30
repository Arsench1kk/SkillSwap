import pytest
from skillswap.anonymise import participant_id
from skillswap.validate_events import validate

COLS = ["event_id", "participant_id", "role", "event_name", "timestamp_utc", "experiment",
        "data_origin", "brief_type", "reason_code", "missing_reason", "corrects_event_id", "note"]


def row(**kw):
    base = dict(event_id="e1", participant_id="M-0123456789", role="mentor", event_name="brief_sent",
                timestamp_utc="2026-10-20T09:00:00+00:00", experiment="E1", data_origin="constructed",
                brief_type="S", reason_code="", missing_reason="", corrects_event_id="", note="")
    base.update(kw)
    return base


def errs(rows):
    return validate(rows, COLS)[0]


def test_clean_row_passes():
    assert errs([row()]) == []


def test_naive_timestamp_rejected():
    assert any("timezone" in e for e in errs([row(timestamp_utc="2026-10-20T09:00:00")]))


def test_missing_origin_rejected():
    assert any("data_origin" in e for e in errs([row(data_origin="")]))


def test_duplicate_ids():
    assert any("duplicate" in e for e in errs([row(), row()]))


def test_decline_needs_reason():
    assert any("reason_code" in e for e in errs([row(event_name="decline_reason")]))


def test_brief_needs_type():
    assert any("brief_type" in e for e in errs([row(brief_type="")]))


def test_pii_in_note():
    assert any("PII" in e for e in errs([row(note="write me @someone_nick")]))
    assert any("PII" in e for e in errs([row(note="a@b.kz")]))


def test_correction_must_reference_existing_event():
    assert any("corrects" in e for e in errs([row(corrects_event_id="nope")]))


def test_raw_participant_id_rejected():
    assert any("participant_id" in e for e in errs([row(participant_id="Aigerim")]))


def test_anonymise_is_stable_and_salted():
    a = participant_id("mentor", "@Nick", "secret-secret-secret")
    assert a == participant_id("mentor", "nick", "secret-secret-secret")
    assert a != participant_id("mentor", "nick", "other-secret-secret")
    assert a.startswith("M-") and len(a) == 12
