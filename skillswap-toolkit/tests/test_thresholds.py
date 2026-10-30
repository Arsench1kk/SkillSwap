import pytest
from skillswap.thresholds import evaluate_e1, evaluate_e2, evaluate_e3, load_thresholds


def e1_recs(s_out, p_out):
    recs = []
    for i, o in enumerate(s_out):
        recs.append({"mentor_id": f"M{i}", "brief_type": "S", "outcome": o})
    for i, o in enumerate(p_out):
        recs.append({"mentor_id": f"M{i}", "brief_type": "P", "outcome": o})
    return recs


A, D, N = "accepted", "declined", "no_reply"


def test_e1_support():
    r = evaluate_e1(e1_recs([A] * 6 + [D] * 4, [A] * 2 + [D] * 8))
    assert r.decision == "support"


def test_e1_iterate_when_gap_small():
    r = evaluate_e1(e1_recs([A] * 5 + [D] * 5, [A] * 4 + [D] * 6))
    assert r.decision == "iterate"


def test_e1_weaken():
    r = evaluate_e1(e1_recs([A] * 2 + [D] * 8, [D] * 10))
    assert r.decision == "weaken"


def test_e1_middle_is_inconclusive():
    r = evaluate_e1(e1_recs([A] * 3 + [D] * 7, [D] * 10))
    assert r.decision == "inconclusive"


def test_e1_too_few_usable():
    r = evaluate_e1(e1_recs([A] * 4 + [D] * 3, [D] * 7))
    assert r.decision == "inconclusive"


def test_e1_no_reply_over_40_percent_is_inconclusive_even_if_many_accept():
    r = evaluate_e1(e1_recs([A] * 5 + [N] * 5, [D] * 10))
    assert r.decision == "inconclusive"


def test_e1_missing_data_reported_not_counted_as_decline():
    recs = e1_recs([A] * 6 + [D] * 4 + ["no_skill_match"] * 2, [D] * 10)
    r = evaluate_e1(recs)
    assert r.counts["usable_mentors_S"] == 10
    assert r.missing["S_no_skill_match"] == 2


def test_e1_share_mode_scales_with_n():
    # 8 usable mentors: support needs ceil(0.5*8)=4
    r = evaluate_e1(e1_recs([A] * 4 + [D] * 4, [D] * 8))
    assert r.decision == "support"


def test_e1_count_mode_needs_five_even_with_eight():
    cfg = load_thresholds()
    cfg["e1"]["threshold_mode"] = "count"
    r = evaluate_e1(e1_recs([A] * 4 + [D] * 4, [D] * 8), cfg)
    assert r.decision == "inconclusive"


def test_rehearsal_is_excluded():
    recs = e1_recs([A] * 6 + [D] * 4, [D] * 10)
    recs += [{"mentor_id": "R", "brief_type": "S", "outcome": A, "data_origin": "rehearsal"}] * 5
    r = evaluate_e1(recs)
    assert r.counts["excluded_rehearsal"] == 5
    assert r.counts["S_accepted"] == 6


# ---------------- E2

def e2_recs(matched, minutes, stem=4, creative=4):
    cats = ["STEM"] * stem + ["creative"] * creative
    return [{"case_id": i, "category": c, "matched_24h": i < matched, "minutes": minutes}
            for i, c in enumerate(cats)]


def test_e2_pass():
    assert evaluate_e2(e2_recs(6, 12)).decision == "pass"


def test_e2_restrict_on_partial_match():
    assert evaluate_e2(e2_recs(4, 12)).decision == "restrict"


def test_e2_restrict_on_effort_16_to_25():
    assert evaluate_e2(e2_recs(7, 20)).decision == "restrict"


def test_e2_hold_on_low_match_or_high_effort():
    assert evaluate_e2(e2_recs(2, 10)).decision == "hold"
    assert evaluate_e2(e2_recs(7, 30)).decision == "hold"


def test_e2_needs_coverage_and_eight_cases():
    assert evaluate_e2(e2_recs(7, 10, stem=6, creative=2)).decision == "inconclusive"
    assert evaluate_e2(e2_recs(7, 10)[:6]).decision == "inconclusive"


def test_e2_missing_minutes_not_zero():
    recs = e2_recs(6, 14)
    recs[0]["minutes"] = None
    r = evaluate_e2(recs)
    assert r.missing["cases_without_minutes"] == 1
    assert r.counts["avg_minutes"] == 14


# ---------------- E3

def e3(useful=True, rating=5, safety=False, no_show=False, m24=True, held=True):
    return {"request_id": "x", "eligible": True, "held": held and not no_show, "no_show": no_show,
            "minutes": 45 if useful else 20, "unblocked": 5 if useful else 2,
            "outcome_line": "can export" if useful else "", "usefulness": rating, "trust": rating,
            "safety_flag": safety, "matched_24h": m24}


def test_e3_continue():
    recs = [e3()] * 3 + [e3(useful=False, rating=3)] * 2
    assert evaluate_e3(recs).decision == "continue"


def test_e3_iterate_two_of_five():
    recs = [e3()] * 2 + [e3(useful=False, rating=3)] * 3
    assert evaluate_e3(recs).decision == "iterate"


def test_e3_reconsider_one_of_five():
    recs = [e3()] + [e3(useful=False, rating=3)] * 4
    assert evaluate_e3(recs).decision == "reconsider"


def test_e3_guardrail_breach_overrides_pass():
    recs = [e3()] * 3 + [e3(useful=False, rating=1)] * 2  # 2/5 ratings negative -> 60% < 70%
    r = evaluate_e3(recs)
    assert r.decision == "iterate"


def test_e3_safety_flag_breaches():
    recs = [e3()] * 3 + [e3(safety=True)] + [e3(useful=False, rating=3)]
    assert evaluate_e3(recs).decision == "iterate"


def test_e3_two_no_shows_is_inconclusive():
    recs = [e3()] * 3 + [e3(no_show=True)] * 2
    assert evaluate_e3(recs).decision == "inconclusive"


def test_e3_too_few_requests():
    assert evaluate_e3([e3()] * 3).decision == "inconclusive"


def test_e3_missing_guardrail_data_blocks_continue():
    recs = [e3(m24=None)] * 5
    r = evaluate_e3(recs)
    assert r.decision == "inconclusive"
    assert r.missing["G1_matched_24h_unknown"] == 5


def test_e3_g1_breach():
    recs = [e3(m24=True)] + [e3(m24=False)] * 4
    assert evaluate_e3(recs).decision == "iterate"
