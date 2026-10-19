import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402
import mock  # noqa: E402
from summarize import validate_submission  # noqa: E402

LOCS = ["IT", "NK", "HU", "TO", "BU", "SK", "MA", "KN"]


def fake_target():
    weeks = pd.date_range("2026-05-02", "2026-10-10", freq="W-SAT").strftime("%Y-%m-%d")
    rows = []
    for loc, base in [("IT", 300), ("NK", 100), ("HU", 20), ("TO", 3), ("BU", 1), ("SK", 0), ("MA", 0), ("KN", 0)]:
        for i, w in enumerate(weeks):
            v = base * (1 + 0.02 * i)
            if i == len(weeks) - 1:
                v *= 0.1
            rows.append(dict(location=loc, as_of="2026-10-09", target_end_date=w, target=config.TARGET,
                             observation=round(v)))
    return pd.DataFrame(rows)


def fake_delays():
    rng = np.random.default_rng(1)
    return pd.DataFrame({"location": ["IT"] * 200 + ["NK"] * 50 + ["BU"] * 3,
                         "days_sym_to_report": np.concatenate([rng.integers(0, 20, 200), rng.integers(0, 30, 50),
                                                               [5, 6, 7]])})


def test_mock_passes_hub_validation_and_shape():
    subs = mock.generate(fake_target(), fake_delays(), LOCS, reference_dates=["2026-10-31"], seed=1)
    assert set(m for m, _ in subs) == set(mock.TEAMS) | {mock.ENSEMBLE_ID}
    for (mid, ref), df in subs.items():
        assert validate_submission(df, ref, mid, set(LOCS)) == [], mid
        assert set(df.location) == set(LOCS)
        assert "CD" not in set(df.location)
        assert df.target_end_date.nunique() == mock.N_NOWCAST_WEEKS + len(config.HORIZONS)
        # the reference date itself and three forecast Saturdays are present
        assert "2026-10-31" in set(df.target_end_date) and "2026-11-21" in set(df.target_end_date)
    # affected province gets substantial counts, unaffected one is (mostly) zero
    it = subs[("mockA-renewal", "2026-10-31")].query("location=='IT'")
    assert it.value.mean() > 50
    kn = subs[("mockA-renewal", "2026-10-31")].query("location=='KN'")
    assert kn.value.sum() == 0


def test_mock_is_deterministic():
    a = mock.generate(fake_target(), fake_delays(), LOCS, reference_dates=["2026-10-24"], seed=7)
    b = mock.generate(fake_target(), fake_delays(), LOCS, reference_dates=["2026-10-24"], seed=7)
    k = ("mockB-growth", "2026-10-24")
    assert a[k].value.equals(b[k].value)
