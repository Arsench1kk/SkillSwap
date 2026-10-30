"""Event ledger schema constants shared by validator and docs."""
REQUIRED = ["event_id", "participant_id", "role", "event_name", "timestamp_utc", "experiment", "data_origin"]
OPTIONAL = ["brief_type", "task_category", "source_channel", "reason_code", "value",
            "missing_reason", "actor", "corrects_event_id", "note"]
COLUMNS = REQUIRED + OPTIONAL

# Names 1-12 come from IMPLEMENTATION_ROADMAP.md; the rest are additions, see docs/DATA_DICTIONARY.md
EVENT_NAMES = {
    "request_submitted", "brief_sent", "mentor_viewed", "mentor_accepted", "slot_proposed",
    "match_accepted", "session_started", "session_completed", "usefulness_submitted",
    "trust_submitted", "no_show", "decline_reason",
    "mentor_no_reply", "eligibility_checked", "match_proposed", "safety_flag", "followup_48h",
}
ROLES = {"learner", "mentor", "operator"}
EXPERIMENTS = {"E1", "E2", "E3"}
ORIGINS = {"real_pilot", "constructed", "rehearsal"}
BRIEF_TYPES = {"P", "S"}
MISSING_REASONS = {"no_reply", "declined", "no_skill_match", "incomplete", "excluded"}
NEEDS_REASON = {"decline_reason", "no_show", "safety_flag"}
PARTICIPANT_ID_RE = r"^[LMO]-[0-9a-f]{10}$"
