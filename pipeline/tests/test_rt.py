"""R_t (optional hub target `wk R_t`): reading, quantile summary, P(R_t > 1) and attaching to rounds."""
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402
import hub_io  # noqa: E402
from build import attach_rt  # noqa: E402
from summarize import rt_p_above, rt_quantiles, rt_summary  # noqa: E402

R = "2026-11-28"
HUB_LEVELS = [0.01, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
              0.75, 0.8, 0.85, 0.9, 0.95, 0.975, 0.99]
# MOBS-GLEAM_BDBV, CD, 2026-11-28 (hub model-output)
MOBS = [0.818, 0.849, 0.856, 0.885, 0.909, 0.93, 0.948, 0.963, 0.976, 0.994, 1.005, 1.01, 1.018, 1.027,
        1.047, 1.063, 1.072, 1.083, 1.094, 1.123, 1.149, 1.163, 1.168]


def rt_rows(values=MOBS, loc="CD", date=R, fd="2026-11-24", levels=HUB_LEVELS):
    return [dict(reference_date=R, forecast_date=fd, target=config.RT_TARGET, target_end_date=date, location=loc,
                 output_type="quantile", output_type_id=str(lv), value=str(v)) for lv, v in zip(levels, values)]


def case_rows(fd="2026-11-24", loc="CD", n=3):
    return [dict(reference_date=R, forecast_date=fd, target=config.TARGET, target_end_date=R, location=loc,
                 output_type="sample", output_type_id=str(s), value=str(s)) for s in range(1, n + 1)]


def write(tmp_path, rows):
    p = tmp_path / f"{R}-team-model.csv"
    pd.DataFrame(rows).to_csv(p, index=False)
    return p


def test_quantiles_and_p_gt1_match_mobs():
    q = rt_quantiles(HUB_LEVELS, MOBS)
    assert q == [0.849, 0.948, 1.01, 1.072, 1.163]          # all five levels are hub levels: exact
    assert rt_p_above(HUB_LEVELS, MOBS) == pytest.approx(1 - (0.4 + 0.05 * 0.006 / 0.011))   # ~0.573


def test_interpolation_ties_tails_and_zero():
    assert rt_quantiles([0.1, 0.5, 0.9], [1.0, 2.0, 4.0], at=[0.3, 0.7]) == [1.5, 3.0]
    assert rt_p_above([0.25, 0.5, 0.75], [0.8, 1.0, 1.0]) == pytest.approx(1 - 0.625)   # tied at 1: midpoint
    assert rt_p_above([0.01, 0.5, 0.99], [1.2, 1.5, 2.0]) == pytest.approx(0.99)   # 1 below the lowest quantile
    assert rt_p_above([0.01, 0.5, 0.99], [0.0, 0.3, 0.6]) == pytest.approx(0.01)   # zero values are fine
    assert rt_p_above([0.25, 0.75], [0.5, 1.5]) == pytest.approx(0.5)


def test_read_keeps_each_targets_latest_forecast(tmp_path):
    # R_t resubmitted alone with a later forecast date: the case rows (older date) survive, and vice versa
    p = write(tmp_path, case_rows("2026-11-23") + rt_rows(fd="2026-11-23") + rt_rows([v + 1 for v in MOBS], fd="2026-11-24"))
    raw = hub_io.read_submission_file(p)
    cases = hub_io.read_sample_submission(p, raw=raw)
    rt = hub_io.read_rt_submission(p, raw=raw)
    assert len(cases) == 3 and set(cases["forecast_date"]) == {"2026-11-23"}
    assert len(rt) == 23 and set(rt["forecast_date"]) == {"2026-11-24"}
    p = write(tmp_path, case_rows("2026-11-23") + case_rows("2026-11-24") + rt_rows(fd="2026-11-23"))
    assert len(hub_io.read_sample_submission(p)) == 3 and len(hub_io.read_rt_submission(p)) == 23
    assert hub_io.read_rt_submission(write(tmp_path, case_rows())) is None


def test_summary_several_dates_bad_rows_and_json(tmp_path):
    rows = rt_rows(date="2026-11-21") + rt_rows(date=R) + rt_rows(loc="CD-IT")
    rows[0]["value"] = "NA"                                        # dropped, not NaN in the output
    rows.append(dict(rows[5]))                                     # duplicate row: first kept
    rows += rt_rows(loc="XX")                                      # not a hub location
    swapped = rt_rows(loc="CD-NK"); swapped[3]["value"], swapped[4]["value"] = swapped[4]["value"], swapped[3]["value"]
    rows += swapped                                                # not increasing: sorted
    warns = []
    out = rt_summary(hub_io.read_rt_submission(write(tmp_path, rows)), {"CD", "CD-IT", "CD-NK"}, warns.append, "f")
    assert set(out) == {"CD", "CD-IT", "CD-NK"}
    assert out["CD"]["dates"] == ["2026-11-21", R]
    assert out["CD"]["q"][1] == [0.849, 0.948, 1.01, 1.072, 1.163] and out["CD"]["p_gt1"][1] == 0.573
    assert out["CD-NK"]["q"][0] == out["CD"]["q"][1]
    assert len(warns) == 4
    json.dumps(out, allow_nan=False)


def test_attach_rt_adds_rt_only_models():
    models_out = {"A": {"locations": {"CD": {}}}, "B": {"locations": {}}}
    assert attach_rt(models_out, {"A": {"CD": {"dates": [R]}}, "C": {"CD": {"dates": [R]}}, "B": {}})
    assert "rt" in models_out["A"] and "rt" not in models_out["B"]
    assert models_out["C"] == {"locations": {}, "rt": {"CD": {"dates": [R]}}}   # R_t only: listed, no case output
    assert not attach_rt({"A": {"locations": {}}}, {})
