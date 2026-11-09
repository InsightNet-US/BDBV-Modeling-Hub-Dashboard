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
    assert out["n_nowcast_weeks"] == 3                       # 10-10, 10-17, 10-24; the reference week is a forecast
    assert out["nowcast_through"] == "2026-10-24"
    assert out["observed_fixed"] == 30                       # 10-10 is submitted, so only 09-26 + 10-03 fixed
    # nowcast cumulative through 10-24 for sample s = 30 + 3s ; median over s=1..100 -> 30 + 3*50.5
    assert out["cum_nowcast"][3] == pytest.approx(30 + 3 * 50.5)
    # forecast windows start at the reference week: h=0 -> s, h=2 -> 3s
    assert out["horizon_sum"]["0"][3] == pytest.approx(50.5)
    assert out["horizon_sum"]["2"][3] == pytest.approx(3 * 50.5)
    assert out["presence"]["1"] == 1.0
    assert out["presence_wk"] == [1.0] * 7
    assert out["cum_through_h"]["0"][3] == pytest.approx(30 + 4 * 50.5)
    assert out["cum_through_h"]["3"][3] == pytest.approx(30 + 7 * 50.5)


def test_summary_forecast_only_and_gaps():
    df = make_df(WEEKS_FC, value=lambda s, w: 0.0)
    mat, weeks = samples_matrix(df)
    observed = {"2026-10-03": 20, "2026-10-10": 5}
    out = summarize_location(mat, weeks, R, observed)
    assert out["n_nowcast_weeks"] == 0
    assert out["presence_wk"] == [0.0] * 3
    assert out["cum_nowcast"] == [25.0] * 7                # observed only
    # the reference week (horizon 0) was not submitted: it is a forecast week, never filled from
    # reported data, so horizon 0 and everything beyond it are unavailable
    assert out["horizon_sum"]["0"] is None and out["cum_through_h"]["3"] is None
    out_r = summarize_location(mat, weeks, R, {**observed, R: 4})
    assert out_r["horizon_sum"]["0"] is None
    # gap: model submits R, +1 and +3 but skips +2 -> horizons 0 and 1 fine, 2 and 3 unavailable
    df2 = make_df([R, WEEKS_FC[0], WEEKS_FC[2]], value=lambda s, w: 1.0)
    mat2, weeks2 = samples_matrix(df2)
    out2 = summarize_location(mat2, weeks2, R, observed)
    assert out2["horizon_sum"]["0"][3] == 1.0 and out2["horizon_sum"]["1"][3] == 2.0
    assert out2["horizon_sum"]["2"] is None and out2["presence"]["3"] is None
    assert out2["presence"]["1"] == 1.0


def test_validator():
    good = make_df(WEEKS_NOW + WEEKS_FC)
    assert validate_submission(good, R, "x-y", {"IT"}) == []
    bad = make_df(WEEKS_NOW + ["2026-11-08"], n=99)
    problems = validate_submission(bad, R, "x-y", {"IT"})
    assert any("Saturday" in p for p in problems)
    assert any("99 samples" in p for p in problems)
    assert validate_submission(make_df(WEEKS_NOW, locs=("CD",)), R, "x-y", {"IT"})


# ---------------------------------------------------------------- regression fixture
def fixture_inputs():
    """The matrices behind tests/fixtures/summarize_location.json (generated from the pre-pool code)."""
    rng = np.random.default_rng(7)
    weeks = ["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21"]
    obs = {"2026-09-26": 12, "2026-10-03": 15.0, "2026-10-10": 9, "2026-10-17": 11, "2026-10-24": 4}
    mat = rng.gamma(2.0, 6.0, size=(100, len(weeks)))
    mat[:, 1] = np.round(mat[:, 1])
    weeks2 = ["2026-10-31", "2026-11-07", "2026-11-21"]
    mat2 = rng.poisson(1.2, size=(100, 3)).astype(float)
    mat3 = mat.copy()
    mat3[5, 2] = np.nan
    mat3[40, 0] = np.nan
    return {"full": (mat, weeks, obs), "gap": (mat2, weeks2, obs), "nan": (mat3, weeks, obs)}


def test_summarize_location_matches_fixture():
    import json
    fx = json.loads((Path(__file__).with_name("fixtures") / "summarize_location.json").read_text())
    for name, (mat, weeks, obs) in fixture_inputs().items():
        got = json.loads(json.dumps(summarize_location(mat, weeks, fx["reference_date"], obs)))
        got.pop("trend"); got.pop("trend_grid")   # newer fields, tested in test_trend_* (the fixture pins the pre-trend output)
        assert got == fx["cases"][name]["out"], name
        assert list(got) == list(fx["cases"][name]["out"]), f"{name}: key order"


# ---------------------------------------------------------------- forecast_date (resubmissions)

def test_validator_forecast_date():
    df = make_df(WEEKS_NOW + WEEKS_FC)
    df["forecast_date"] = "2026-10-27"
    assert validate_submission(df, R, "x-y", {"IT"}) == []
    late = df.copy(); late["forecast_date"] = "2026-11-01"
    assert any("after the reference_date" in p for p in validate_submission(late, R, "x-y", {"IT"}))
    two = pd.concat([df, df.assign(forecast_date="2026-10-29")])
    problems = validate_submission(two, R, "x-y", {"IT"})
    assert any("more than one forecast_date" in p for p in problems)
    assert any("duplicate (sample, target_end_date)" in p for p in problems)


def test_loader_keeps_latest_forecast_per_location(tmp_path):
    import hub_io
    old = make_df(WEEKS_NOW + WEEKS_FC, locs=("IT", "NK"))
    old["forecast_date"] = "2026-10-27"
    # resubmission covers IT only, with doubled values and reused sample ids
    new = make_df(WEEKS_NOW + WEEKS_FC, locs=("IT",), value=lambda s, w: 2 * (s + 1))
    new["forecast_date"] = "2026-10-29"
    p = tmp_path / "2026-10-31-x-y.csv"
    pd.concat([old, new]).to_csv(p, index=False)
    notes = []
    df = hub_io.read_sample_submission(p, warn=notes.append)
    assert validate_submission(df, R, "x-y", {"IT", "NK"}) == []
    it, nk = df[df.location == "IT"], df[df.location == "NK"]
    assert set(it.forecast_date) == {"2026-10-29"} and set(nk.forecast_date) == {"2026-10-27"}
    assert len(it) == len(nk) == 100 * 7
    assert it[it.output_type_id == "1"].value.iloc[0] == 4.0 and nk[nk.output_type_id == "1"].value.iloc[0] == 2.0
    assert len(notes) == 1 and "700 rows" in notes[0] and "2026-10-27" in notes[0]
    # unique sample ids in the resubmission behave the same way
    new2 = new.copy(); new2["output_type_id"] = (new2["output_type_id"].astype(int) + 100).astype(str)
    pd.concat([old, new2]).to_csv(p, index=False)
    df2 = hub_io.read_sample_submission(p)
    assert df2[df2.location == "IT"].output_type_id.nunique() == 100
    assert validate_submission(df2, R, "x-y", {"IT", "NK"}) == []
    # a file without the column is untouched
    old.drop(columns="forecast_date").to_csv(p, index=False)
    df3 = hub_io.read_sample_submission(p, warn=notes.append)
    assert "forecast_date" not in df3.columns and len(df3) == 1400 and len(notes) == 1


def test_non_designated_models_are_dropped(tmp_path):
    import hub_io
    md = tmp_path / "model-metadata"; md.mkdir()
    (md / "hub-baseline.yml").write_text("team_name: hub\nmodel_name: baseline\ndesignated_model: false\n")
    (md / "team-a.yml").write_text("team_name: team\nmodel_name: a\ndesignated_model: true\n")
    (md / "team-b.yml").write_text("team_name: team\nmodel_name: b\n")   # field omitted: designated
    meta = hub_io.read_model_metadata(tmp_path)
    assert [meta[m]["designated_model"] for m in ("hub-baseline", "team-a", "team-b")] == [False, True, True]
    files = [("hub-baseline", R, tmp_path / "x1.csv"), ("hub-baseline", "2026-11-07", tmp_path / "x2.csv"),
             ("team-a", R, tmp_path / "a.csv"), ("team-b", R, tmp_path / "b.csv"), ("team-c", R, tmp_path / "c.csv")]
    notes = []
    kept = hub_io.drop_non_designated(files, meta, warn=notes.append)
    assert [f[0] for f in kept] == ["team-a", "team-b", "team-c"]   # team-c has no metadata at all: kept
    assert len(notes) == 1 and notes[0].startswith("NOTE hub-baseline") and "2 submission" in notes[0]


def test_trend_probs_classes_zero_baseline_and_missing_weeks():
    from summarize import trend_probs
    R = "2026-10-31"
    weeks = ["2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21"]   # R-7 .. R+21
    mat = np.zeros((10, 5))
    mat[:8, 0] = 100                                     # rows 8-9 have a zero baseline
    # h=0: 2 decreases (<90), 3 stable (90, 100 and 110 are on or inside the band), 3 increases;
    # zero baseline: 0 stays stable, 1 is an increase
    mat[:8, 1] = [50, 89, 90, 100, 110, 111, 150, 200]
    mat[8:, 1] = [0, 1]
    # h=1: all zero -> 8 decreases, 2 stable
    present = np.ones(mat.shape, dtype=bool)
    out = trend_probs(mat, present, weeks, R, horizons=[0, 1, 2, 3], threshold=0.10)
    assert out["0"] == [0.2, 0.4, 0.4]
    assert out["1"] == [0.8, 0.2, 0.0]
    # a horizon week nobody submitted -> None; the rest keep their rows
    present[:, 4] = False
    assert trend_probs(mat, present, weeks, R)["3"] is None
    # rows without the baseline week drop out of every horizon
    present[:5, 0] = False
    out = trend_probs(mat, present, weeks, R)
    assert out["0"] == [0.0, 0.2, 0.8]                   # rows 5-9: 111, 150, 200 and 0 -> 1 up; 0 -> 0 stable
    # no baseline at all -> None; baseline week outside the matrix -> None
    present[:, 0] = False
    assert trend_probs(mat, present, weeks, R) is None
    assert trend_probs(mat[:, 1:], np.ones((10, 4), dtype=bool), weeks[1:], R) is None


def test_trend_grid_presets_cases_rule_and_missing_weeks():
    from summarize import trend_grid, trend_probs
    R = "2026-10-31"
    weeks = ["2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21"]
    mat = np.zeros((10, 5))
    mat[:8, 0] = 100
    mat[:8, 1] = [50, 89, 90, 100, 110, 111, 150, 200]
    mat[8:, 1] = [0, 1]
    present = np.ones(mat.shape, dtype=bool)
    g = trend_grid(mat, present, weeks, R)
    assert set(g) == {f"p{round(x * 100)}" for x in config.TREND_PCT} | {f"c{n}" for n in config.TREND_CASES}
    p = trend_probs(mat, present, weeks, R)
    assert g["p10"] == [[round(p[h][0] * 1000), round(p[h][2] * 1000)] for h in "0123"]
    assert g["p50"][0] == [0, 200]                       # 50 is not below 50; above 150: 200 and the 0 -> 1 row
    # cases: h=0 changes are -50, -11, -10, 0, +10, +11, +50, +100 and 0, +1
    assert g["c10"][0] == [200, 300]                     # -50, -11 down; +11, +50, +100 up (not -10, +10, +1)
    assert g["c1"][0] == [300, 400]                      # 0 -> +1 is not more than 1 case
    assert g["c100"][0] == [0, 0]
    assert g["c5"][1] == [800, 0]                        # h=1: all zero -> the 100s fall by 100, zeros stay
    present[:, 4] = False
    assert all(v[3] is None for v in trend_grid(mat, present, weeks, R).values())
    present[:, 0] = False
    assert trend_grid(mat, present, weeks, R) is None


def test_trend_in_single_model_summary():
    mat, weeks, obs = fixture_inputs()["full"]
    out = summarize_location(mat, weeks, "2026-10-31", obs)
    assert set(out["trend"]) == {"0", "1", "2", "3"}
    for h, p in out["trend"].items():
        assert p is not None and len(p) == 3 and abs(sum(p) - 1) <= 0.002 and min(p) >= 0

