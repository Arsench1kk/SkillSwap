"""E1/E2/E3 decision rules from A6_VALIDATION_PLAN.md, with frozen thresholds in JSON.

Records are plain dicts. Rehearsal data is excluded and counted separately.
Missing data is reported, never converted to zero.
"""
from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "thresholds" / "frozen_thresholds.json"


def load_thresholds(path=None) -> dict:
    return json.loads(Path(path or DEFAULT_PATH).read_text(encoding="utf-8"))


@dataclass
class Result:
    experiment: str
    decision: str
    counts: dict = field(default_factory=dict)
    missing: dict = field(default_factory=dict)
    notes: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _split(records, cfg):
    bad = set(cfg.get("excluded_origins", []))
    kept = [r for r in records if r.get("data_origin") not in bad]
    return kept, len(records) - len(kept)


# ---------------------------------------------------------------- E1

E1_USABLE = {"accepted", "declined", "no_reply"}


def evaluate_e1(records, cfg=None) -> Result:
    """records: {mentor_id, brief_type P|S, outcome accepted|declined|no_reply|no_skill_match|incomplete}"""
    cfg = cfg or load_thresholds()
    t = cfg["e1"]
    recs, n_excl = _split(records, cfg)
    s_all = [r for r in recs if r["brief_type"] == "S"]
    p_all = [r for r in recs if r["brief_type"] == "P"]
    s = [r for r in s_all if r["outcome"] in E1_USABLE]
    p = [r for r in p_all if r["outcome"] in E1_USABLE]
    n = len(s)
    s_acc = sum(r["outcome"] == "accepted" for r in s)
    p_acc = sum(r["outcome"] == "accepted" for r in p)
    s_nr = sum(r["outcome"] == "no_reply" for r in s)
    no_reply_share = s_nr / n if n else None

    if t["threshold_mode"] == "count":
        support_min, weaken_max = t["support_min_accepts"], t["weaken_max_accepts"]
    else:
        support_min = math.ceil(t["support_share"] * n)
        weaken_max = math.floor(t["weaken_share"] * n)

    counts = {
        "usable_mentors_S": n, "S_accepted": s_acc, "P_usable": len(p), "P_accepted": p_acc,
        "gap_S_minus_P": s_acc - p_acc, "S_no_reply": s_nr,
        "support_min": support_min, "weaken_max": weaken_max,
        "excluded_rehearsal": n_excl,
    }
    missing = {
        "S_no_skill_match": sum(r["outcome"] == "no_skill_match" for r in s_all),
        "S_incomplete": sum(r["outcome"] == "incomplete" for r in s_all),
        "P_no_skill_match": sum(r["outcome"] == "no_skill_match" for r in p_all),
        "P_incomplete": sum(r["outcome"] == "incomplete" for r in p_all),
    }
    notes = [f"threshold_mode={t['threshold_mode']}"]

    if n < t["min_usable_mentors"]:
        d = "inconclusive"
        notes.append(f"fewer than {t['min_usable_mentors']} usable mentors: recruit 2 more days, rerun once")
    elif no_reply_share > t["max_no_reply_share"]:
        d = "inconclusive"
        notes.append(f"no-reply share {no_reply_share:.0%} above {t['max_no_reply_share']:.0%}: recruit 2 more days, rerun once")
    elif s_acc >= support_min:
        if s_acc - p_acc >= t["min_gap_s_minus_p"]:
            d = "support"
            notes.append("run E3 unchanged")
        else:
            d = "iterate"
            notes.append("S passes but gap over P is too small: simplify package, study decline reasons")
    elif s_acc <= weaken_max:
        d = "weaken"
        notes.append("reconsider free mentor supply and incentives")
    else:
        d = "inconclusive"
        notes.append("S between weaken and support thresholds: recruit 2 more days, rerun once")
    return Result("E1", d, counts, missing, notes)


# ---------------------------------------------------------------- E2

def evaluate_e2(records, cfg=None) -> Result:
    """records: {case_id, category STEM|creative, matched_24h bool, minutes number|None}"""
    cfg = cfg or load_thresholds()
    t = cfg["e2"]
    recs, n_excl = _split(records, cfg)
    n = len(recs)
    passed = sum(bool(r.get("matched_24h")) for r in recs)
    mins = [r["minutes"] for r in recs if r.get("minutes") is not None]
    avg = sum(mins) / len(mins) if mins else None
    stem = sum(r.get("category") == "STEM" for r in recs)
    creative = sum(r.get("category") == "creative" for r in recs)
    counts = {"cases": n, "matched_24h": passed, "avg_minutes": avg, "stem": stem,
              "creative": creative, "excluded_rehearsal": n_excl}
    missing = {"cases_without_minutes": n - len(mins)}
    notes = []

    if n != t["cases"]:
        d = "inconclusive"
        notes.append(f"expected {t['cases']} cases, got {n}")
    elif stem < t["min_stem"] or creative < t["min_creative"]:
        d = "inconclusive"
        notes.append("coverage requirement not met (3 STEM and 3 creative-software)")
    elif avg is None:
        d = "inconclusive"
        notes.append("no effort data recorded")
    elif passed <= t["hold_max_matched"] or avg > t["hold_min_avg_minutes"]:
        d = "hold"
        notes.append("hold E3")
    elif passed >= t["pass_min_matched"] and avg <= t["pass_max_avg_minutes"]:
        d = "pass"
    else:
        d = "restrict"
        notes.append("restrict the promise to covered skills and recruit")
    if missing["cases_without_minutes"]:
        notes.append("average minutes computed only over cases that have it")
    notes.append("E2 tests operational feasibility only, not mentor acceptance or value")
    return Result("E2", d, counts, missing, notes)


# ---------------------------------------------------------------- E3

def is_useful(r, t) -> bool:
    return bool(
        r.get("held")
        and (r.get("minutes") or 0) >= t["useful_min_minutes"]
        and (r.get("unblocked") or 0) >= t["useful_min_unblocked"]
        and str(r.get("outcome_line") or "").strip()
    )


def evaluate_e3(records, cfg=None) -> Result:
    """records: {request_id, eligible, excluded, held, no_show, minutes, unblocked,
    outcome_line, usefulness, trust, safety_flag, matched_24h(bool|None)}"""
    cfg = cfg or load_thresholds()
    t = cfg["e3"]
    recs, n_excl = _split(records, cfg)
    usable = [r for r in recs if not r.get("excluded") and r.get("eligible", True)]
    n = len(usable)
    no_shows = sum(bool(r.get("no_show")) for r in usable)
    held = sum(bool(r.get("held")) for r in usable)
    useful = sum(is_useful(r, t) for r in usable)

    g1_known = [r for r in usable if r.get("matched_24h") is not None]
    g1_hit = sum(bool(r["matched_24h"]) for r in g1_known)
    g1_share = g1_hit / len(g1_known) if g1_known else None
    g1_breach = g1_share is not None and g1_share < t["g1_min_share"]

    returned = [r for r in usable if r.get("usefulness") is not None or r.get("trust") is not None]
    def negative(r):
        vals = [v for v in (r.get("usefulness"), r.get("trust")) if v is not None]
        return any(v <= t["negative_rating_max"] for v in vals)
    nonneg = sum(not negative(r) for r in returned)
    safety = sum(bool(r.get("safety_flag")) for r in usable)
    g2_share = nonneg / len(returned) if returned else None
    g2_breach = safety > 0 or (g2_share is not None and g2_share < t["g2_min_nonnegative_share"])

    counts = {
        "usable_requests": n, "held": held, "no_shows": no_shows, "useful": useful,
        "useful_share": useful / n if n else None,
        "G1_share": g1_share, "G1_known": len(g1_known),
        "G2_nonnegative_share": g2_share, "G2_returned": len(returned), "safety_flags": safety,
        "excluded_rehearsal": n_excl,
    }
    missing = {"G1_matched_24h_unknown": n - len(g1_known), "ratings_not_returned": n - len(returned)}
    notes = []

    if n < t["min_usable_requests"] or no_shows > t["max_no_shows"]:
        d = "inconclusive"
        notes.append("fewer than 4 usable requests or at least 2 no-shows")
    elif held > 0 and useful <= t["reconsider_max_useful"]:
        d = "reconsider"
    elif g1_breach or g2_breach:
        d = "iterate"
        notes.append("guardrail breach overrides a superficial pass")
    elif g1_share is None or g2_share is None:
        d = "inconclusive"
        notes.append("guardrail data missing: cannot confirm G1/G2")
    elif useful >= t["continue_min_useful"] and useful / n >= t["continue_min_share"]:
        d = "continue"
    else:
        d = "iterate"
    return Result("E3", d, counts, missing, notes)


EVALUATORS = {"e1": evaluate_e1, "e2": evaluate_e2, "e3": evaluate_e3}
