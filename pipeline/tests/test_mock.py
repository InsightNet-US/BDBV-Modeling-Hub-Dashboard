import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402
import mock  # noqa: E402
from summarize import validate_submission  # noqa: E402

# hub-style hierarchy: country, provinces (two affected, several not), zones in every province
PROV = {"CD-IT": "Ituri", "CD-NK": "Nord Kivu", "CD-HU": "Haut Uele", "CD-TO": "Tshopo", "CD-BU": "Bas Uele",
        "CD-SK": "Sud Kivu", "CD-MA": "Maniema", "CD-KN": "Kinshasa"}
ZONES = {p: [f"{p}-0{i}" for i in (1, 2, 3)] for p in PROV}
ZONE_SHARE = [0.6, 0.3, 0.1]
BASE = {"CD-IT": 300, "CD-NK": 100, "CD-HU": 20, "CD-TO": 3, "CD-BU": 1, "CD-SK": 0, "CD-MA": 0, "CD-KN": 0}


def fake_locs():
    rows = [dict(location="CD", location_name="DRC", location_type="country", parent="")]
    for p, name in PROV.items():
        rows.append(dict(location=p, location_name=name, location_type="province", parent="DRC"))
        for z in ZONES[p]:
            rows.append(dict(location=z, location_name=f"Zone {z[-2:]} {name}", location_type="health zone", parent=name))
    return pd.DataFrame(rows)


def fake_target():
    weeks = pd.date_range("2026-05-02", "2026-10-10", freq="W-SAT").strftime("%Y-%m-%d")
    rows = []
    for p, base in BASE.items():
        for i, w in enumerate(weeks):
            v = base * (1 + 0.02 * i)
            if i == len(weeks) - 1:
                v *= 0.1
            zv = [round(v * s) for s in ZONE_SHARE]
            for z, zz in zip(ZONES[p], zv):
                rows.append(dict(location=z, location_type="health zone", as_of="2026-10-09", target_end_date=w,
                                 target=config.TARGET, observation=zz))
            rows.append(dict(location=p, location_type="province", as_of="2026-10-09", target_end_date=w,
                             target=config.TARGET, observation=sum(zv)))
    nat = pd.DataFrame(rows).query("location_type=='province'").groupby("target_end_date").observation.sum()
    for w, v in nat.items():
        rows.append(dict(location="CD", location_type="country", as_of="2026-10-09", target_end_date=w,
                         target=config.TARGET, observation=v))
    return pd.DataFrame(rows)


def fake_delays():
    rng = np.random.default_rng(1)
    return pd.DataFrame({"location": ["CD-IT"] * 200 + ["CD-NK"] * 50 + ["CD-BU"] * 3,
                         "days_sym_to_report": np.concatenate([rng.integers(0, 20, 200), rng.integers(0, 30, 50),
                                                               [5, 6, 7]])})


ALL = {"CD"} | set(PROV) | {z for zs in ZONES.values() for z in zs}


def test_mock_passes_hub_validation_and_shape():
    subs = mock.generate(fake_target(), fake_delays(), fake_locs(), reference_dates=["2026-10-31"], seed=1)
    assert set(m for m, _ in subs) == set(mock.TEAMS) | {mock.ENSEMBLE_ID}
    tot = fake_target().query("location_type=='province'").groupby("location").observation.sum()
    zone_provs = {p for p in PROV if tot[p] >= mock.ZONE_MIN_CASES}
    zone_codes = {z for p in zone_provs for z in ZONES[p]}
    for (mid, ref), df in subs.items():
        assert validate_submission(df, ref, mid, ALL) == [], mid
        want = {"CD"} | set(PROV)
        if mid == mock.ENSEMBLE_ID or mock.TEAMS[mid]["zones"]:
            want |= zone_codes
        assert set(df.location) == want, mid
        assert df.target_end_date.nunique() == mock.N_NOWCAST_WEEKS + len([h for h in config.HORIZONS if h > 0])
        assert "2026-10-31" in set(df.target_end_date) and "2026-11-21" in set(df.target_end_date)
    a = subs[("mockA-renewal", "2026-10-31")]
    # affected province gets substantial counts, unaffected one is (mostly) zero
    assert a.query("location=='CD-IT'").value.mean() > 50
    assert a.query("location=='CD-KN'").value.sum() == 0
    # zones sum to their province and provinces to the country, sample by sample
    idx = ["output_type_id", "target_end_date"]
    zsum = a[a.location.isin(ZONES["CD-IT"])].groupby(idx).value.sum().sort_index()
    prov = a[a.location == "CD-IT"].set_index(idx).value.sort_index()
    assert np.allclose(zsum, prov)
    psum = a[a.location.isin(PROV)].groupby(idx).value.sum().sort_index()
    nat = a[a.location == "CD"].set_index(idx).value.sort_index()
    assert np.allclose(psum, nat)
    # the biggest zone carries most of its province
    big = a[a.location == "CD-IT-01"].value.sum()
    assert big > 0.45 * a[a.location == "CD-IT"].value.sum()


def test_mock_is_deterministic():
    a = mock.generate(fake_target(), fake_delays(), fake_locs(), reference_dates=["2026-10-24"], seed=7)
    b = mock.generate(fake_target(), fake_delays(), fake_locs(), reference_dates=["2026-10-24"], seed=7)
    k = ("mockB-growth", "2026-10-24")
    assert a[k].value.equals(b[k].value)
