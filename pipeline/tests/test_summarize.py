import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402
from summarize import (last_complete_week, qvals, samples_matrix, select_as_of,  # noqa: E402
                       summarize_location, validate_submission)

R = "2026-10-31"
WEEKS_NOW = ["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"]
WEEKS_FC = ["2026-11-07", "2026-11-14", "2026-11-21"]


def make_df(weeks, locs=("IT",), n=100, ref=R, value=lambda s, w: s + 1):
    rows = []
    for loc in locs:
        for s in range(1, n + 1):
            for w in weeks:
                rows.append(dict(reference_date=ref, target=config.TARGET, target_end_date=w,
                                 location=loc, output_type="sample", output_type_id=str(s),
                                 value=float(value(s, w))))
    return pd.DataFrame(rows)


def test_select_as_of_rules():
    versions = ["2026-10-09", "2026-10-26", "2026-10-27", "2026-10-28"]
    # Monday 10-26 and Tuesday 10-27 releases qualify for R=10-31; Wednesday 10-28 does not
    assert select_as_of("2026-10-31", versions) == ("2026-10-27", False)
    assert select_as_of("2026-10-24", versions) == ("2026-10-09", False)
    # nothing qualifies -> earliest version, flagged
    assert select_as_of("2026-10-10", versions) == ("2026-10-09", True)
    assert select_as_of("2026-10-10", []) == (None, True)


def test_last_complete_week():
    assert last_complete_week("2026-10-09") == "2026-10-03"   # Friday release: week ending 10-10 in progress
    assert last_complete_week("2026-10-10") == "2026-10-03"   # Saturday itself is not complete
    assert last_complete_week("2026-10-11") == "2026-10-10"


def test_quantiles_known():
    arr = np.arange(1, 101, dtype=float)
    q = qvals(arr)
    assert q[3] == 50.5
    assert q[0] == 3.5  # 3.475 rounded to 1 dp
    assert qvals(arr, nd=3)[0] == pytest.approx(3.475, abs=0.001)


def test_summary_full_submission():
    df = make_df(WEEKS_NOW + WEEKS_FC, value=lambda s, w: s)   # sample s has value s every week
    mat, weeks = samples_matrix(df[df.location == "IT"])
    observed = {"2026-09-26": 10, "2026-10-03": 20, "2026-10-10": 5}
    out = summarize_location(mat, weeks, R, observed)
    assert out["n_nowcast_weeks"] == 4
    assert out["observed_fixed_through_ref"] == 30          # 10-10 is submitted, so only 09-26 + 10-03 fixed
    # cumulative through R for sample s = 30 + 4s ; median over s=1..100 -> 30 + 4*50.5
    assert out["cum_through_ref"][3] == pytest.approx(30 + 4 * 50.5)
    # horizon sums: h=2 -> 2s, median 101
    assert out["horizon_sum"]["2"][3] == pytest.approx(101)
    assert out["presence"]["1"] == 1.0
    assert out["cum_through_h"]["3"][3] == pytest.approx(30 + 7 * 50.5)


def test_summary_forecast_only_and_gaps():
    df = make_df(WEEKS_FC, value=lambda s, w: 0.0)
    mat, weeks = samples_matrix(df)
    observed = {"2026-10-03": 20, "2026-10-10": 5}
    out = summarize_location(mat, weeks, R, observed)
    assert out["n_nowcast_weeks"] == 0
    assert out["cum_through_ref"] == [25.0] * 7            # observed only
    assert out["presence"]["3"] == 0.0
    # gap: model skips the +2 week -> horizon 2 and 3 unavailable, horizon 1 fine
    df2 = make_df([WEEKS_FC[0], WEEKS_FC[2]], value=lambda s, w: 1.0)
    mat2, weeks2 = samples_matrix(df2)
    out2 = summarize_location(mat2, weeks2, R, observed)
    assert out2["horizon_sum"]["1"] is not None and out2["horizon_sum"]["2"] is None
    assert out2["presence"]["1"] == 1.0 and out2["presence"]["3"] is None


def test_validator():
    good = make_df(WEEKS_NOW + WEEKS_FC)
    assert validate_submission(good, R, "x-y", {"IT"}) == []
    bad = make_df(WEEKS_NOW + ["2026-11-08"], n=99)
    problems = validate_submission(bad, R, "x-y", {"IT"})
    assert any("Saturday" in p for p in problems)
    assert any("99 samples" in p for p in problems)
    assert validate_submission(make_df(WEEKS_NOW, locs=("CD",)), R, "x-y", {"IT"})
