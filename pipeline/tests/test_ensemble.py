"""Dashboard ensemble: linear pool of trajectories (summarize.pool_members) and the source flag (build)."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402
from build import pool_round, resolve_ensemble  # noqa: E402
from summarize import pool_members, qvals, summarize_location  # noqa: E402
from test_summarize import fixture_inputs  # noqa: E402

R = "2026-10-31"
W_ALL = ["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21"]
W_SHORT = W_ALL[1:]          # no 10-17
OBS = {"2026-10-03": 20.0, "2026-10-10": 10.0, "2026-10-17": 7.0, "2026-10-24": 3.0}


def const(n, weeks, v):
    return np.full((n, len(weeks)), float(v))


def test_single_member_equals_summarize_location():
    mat, weeks, obs = fixture_inputs()["full"]
    pooled = pool_members({"a": (mat, weeks)}, R, obs)
    assert pooled.pop("n_models") == 1 and pooled.pop("members") == ["a"]
    assert pooled.pop("n_models_wk") == [1] * len(weeks)
    single = summarize_location(mat, weeks, R, obs)
    single.pop("observed_fixed")
    assert json.dumps(pooled) == json.dumps(single)


def test_same_weeks_pool_is_concatenation():
    rng = np.random.default_rng(1)
    a, b = rng.gamma(2, 5, (100, len(W_ALL))), rng.gamma(3, 2, (100, len(W_ALL)))
    out = pool_members({"b": (b, W_ALL), "a": (a, W_ALL)}, R, OBS)
    both = np.vstack([a, b])
    assert out["n_samples"] == 200 and out["members"] == ["a", "b"] and out["n_models"] == 2
    assert out["n_models_wk"] == [2] * len(W_ALL)
    for i in range(len(W_ALL)):
        assert out["q"][i] == qvals(both[:, i])
    # cumulative through the last closed week: fixed reported weeks + each trajectory's own nowcast weeks
    fixed = OBS["2026-10-03"] + OBS["2026-10-10"]
    assert out["cum_nowcast"] == qvals(fixed + both[:, 0] + both[:, 1])
    assert out["horizon_sum"]["1"] == qvals(both[:, 2] + both[:, 3])
    assert out["cum_through_h"]["3"] == qvals(fixed + both.sum(axis=1))


def test_different_weeks_per_trajectory_fill_and_counts():
    a = const(100, W_ALL, 1.0)        # submitted 10-17 (nowcast) .. 11-21
    b = const(50, W_SHORT, 4.0)       # did not submit 10-17: its rows take the reported 7.0 for that week
    out = pool_members({"a": (a, W_ALL), "b": (b, W_SHORT)}, R, OBS)
    assert out["weeks"] == W_ALL
    assert out["n_models_wk"] == [1, 2, 2, 2, 2, 2]
    assert out["n_nowcast_weeks"] == 2 and out["n_samples"] == 150
    assert "observed_fixed" not in out
    # week 10-17: only a's rows -> all 1.0
    assert out["q"][0] == [1.0] * len(config.QUANTILE_LEVELS)
    # cum_nowcast: a rows = 30 + 1 + 1 = 32; b rows = 30 + 7 (reported) + 4 = 41
    fixed = OBS["2026-10-03"] + OBS["2026-10-10"]
    cum = np.concatenate([np.full(100, fixed + 2.0), np.full(50, fixed + 7.0 + 4.0)])
    assert out["cum_nowcast"] == qvals(cum)
    assert out["presence_wk"][0] == 1.0
    assert out["horizon_sum"]["0"] == qvals(np.concatenate([np.full(100, 1.0), np.full(50, 4.0)]))


def test_window_coverage_and_null_horizons():
    a = const(100, W_ALL, 2.0)
    b = const(100, W_ALL[:-1], 5.0)   # b stops at 11-14: horizon 3 from a's rows only
    out = pool_members({"a": (a, W_ALL), "b": (b, W_ALL[:-1])}, R, OBS)
    assert out["horizon_sum"]["2"] == qvals(np.concatenate([np.full(100, 6.0), np.full(100, 15.0)]))
    assert out["horizon_sum"]["3"] == [8.0] * len(config.QUANTILE_LEVELS)
    assert out["presence"]["3"] == 1.0
    # nobody covers 11-21 -> horizon 3 is null for all three summaries
    out2 = pool_members({"a": (a[:, :-1], W_ALL[:-1]), "b": (b, W_ALL[:-1])}, R, OBS)
    assert out2["horizon_sum"]["3"] is None and out2["presence"]["3"] is None and out2["cum_through_h"]["3"] is None
    assert out2["horizon_sum"]["2"] is not None


def test_incomplete_member_rows_are_dropped_and_json_is_finite():
    a = const(100, W_ALL, 2.0)
    a[3, 1] = np.nan
    b = const(100, W_SHORT, 1.0)
    out = pool_members({"a": (a, W_ALL), "b": (b, W_SHORT)}, R, OBS)
    assert out["n_samples"] == 199
    json.dumps(out, allow_nan=False)   # raises on NaN/inf


def test_pool_round_membership_rules(capsys):
    mats = {
        "A": {"CD": (const(100, W_ALL, 1), W_ALL), "CD-IT": (const(100, W_ALL, 1), W_ALL), "CD-NK": (const(100, W_ALL, 1), W_ALL)},
        "B": {"CD": (const(100, W_ALL, 2), W_ALL), "CD-IT": (const(100, W_ALL, 2), W_ALL)},
        "hub-ens": {"CD": (const(100, W_ALL, 9), W_ALL), "CD-IT": (const(100, W_ALL, 9), W_ALL), "CD-NK": (const(100, W_ALL, 9), W_ALL)},
        "X": {"CD": (const(99, W_ALL, 3), W_ALL)},
    }
    obs = {"CD": OBS, "CD-IT": OBS}
    out = pool_round(mats, R, obs, exclude={"hub-ens", "X"}, min_models=2)
    assert out["members"] == ["A", "B"]
    assert set(out["locations"]) == {"CD", "CD-IT"}        # CD-NK has one member only
    assert out["locations"]["CD"]["members"] == ["A", "B"]
    assert out["locations"]["CD"]["q"][0] == qvals(np.array([1.0] * 100 + [2.0] * 100))
    # unequal sample counts are pooled with a warning
    out = pool_round(mats, R, obs, exclude={"hub-ens"}, min_models=2)
    assert out["locations"]["CD"]["n_samples"] == 299
    assert "unequal sample counts" in capsys.readouterr().out


def test_resolve_ensemble():
    warns = []
    w = warns.append
    did = config.DASHBOARD_ENSEMBLE_ID
    # hub ensemble submitted this round
    assert resolve_ensemble("auto", "hub-ens", ["A", "hub-ens"], w) == ("hub", "hub-ens")
    assert resolve_ensemble("hub", "hub-ens", ["A", "hub-ens"], w) == ("hub", "hub-ens")
    assert resolve_ensemble("dashboard", "hub-ens", ["A", "hub-ens"], w) == ("dashboard", did)
    assert warns == []
    # hub ensemble known but absent from the round
    assert resolve_ensemble("auto", "hub-ens", ["A", "B"], w) == ("dashboard", did)
    assert resolve_ensemble("hub", "hub-ens", ["A", "B"], w) == (None, None)
    assert len(warns) == 2 and "no submission" in warns[0]
    # no hub ensemble at all
    assert resolve_ensemble("auto", None, ["A", "B"], w) == ("dashboard", did)
    assert resolve_ensemble("hub", None, ["A", "B"], w) == (None, None)
    assert resolve_ensemble("dashboard", None, ["A", "B"], w) == ("dashboard", did)
    assert len(warns) == 2


def test_source_flag_validation(monkeypatch):
    import importlib
    monkeypatch.setenv("ENSEMBLE_SOURCE", "sometimes")
    with pytest.raises(ValueError):
        importlib.reload(config)
    monkeypatch.setenv("ENSEMBLE_SOURCE", "")
    importlib.reload(config)
    assert config.ENSEMBLE_SOURCE == "auto"
