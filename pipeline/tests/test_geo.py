"""Health-zone polygons -> hub codes (build.match_zones): DHIS2 id first, then aliases and names."""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build  # noqa: E402


LOCS = pd.DataFrame([
    ("CD-KN", "Kinshasa", "province", "DRC"),
    ("CD-KE", "Kasai Oriental", "province", "DRC"),
    ("CD-HK", "Haut Katanga", "province", "DRC"),
    ("CD-KN-01", "Bandalungwa", "health zone", "Kinshasa"),
    ("CD-KN-15", "Kinshasa", "health zone", "Kinshasa"),
    ("CD-KN-16", "Kintambo", "health zone", "Kinshasa"),
    ("CD-KE-19", "Tshitenge", "health zone", "Kasai Oriental"),
    ("CD-HK-19", "Manika", "health zone", "Haut Katanga"),
], columns=["location", "location_name", "location_type", "parent"])


def feat(nom, prov, code):
    return {"type": "Feature", "properties": {"Nom": nom, "PROVINCE": prov, "ZSCode": code}, "geometry": None}


def test_match_zones_dhis2_first_then_names_and_aliases(monkeypatch):
    monkeypatch.setattr(build, "load_aliases", lambda: {("citenge", "kasai oriental"): ("Tshitenge", "Kasai Oriental")})
    # the hub mapping as read by hub_io.read_hz_dhis2: Bandalungwa/Kinshasa share a code and Tshitenge/Kintambo
    # have NA, so none of them is in it; Manika's code is (GRID3 puts it in Lualaba, the hub in Haut Katanga)
    dhis2 = {"xMdqjEKgZLw": "CD-HK-19"}
    fs = [feat("Manika", "Lualaba", "xMdqjEKgZLw"), feat("Kinshasa", "Kinshasa", "xZy8t34pvs6"),
          feat("Bandalungwa", "Kinshasa", "xZy8t34pvs6"), feat("Kintambo", "Kinshasa", "abc"),
          feat("Citenge", "Kasaï-Oriental", "def"), feat("Nowhere", "Kinshasa", "ghi")]
    used, unmatched = build.match_zones(fs, LOCS, dhis2)
    got = {f["properties"]["src_name"]: (f["properties"]["location"], f["properties"]["parent"]) for f in fs}
    assert got["Manika"] == ("CD-HK-19", "CD-HK")            # by DHIS2 id despite the other province
    assert got["Kinshasa"] == ("CD-KN-15", "CD-KN")          # the zone, not the province of the same name
    assert got["Bandalungwa"] == ("CD-KN-01", "CD-KN")
    assert got["Kintambo"] == ("CD-KN-16", "CD-KN")
    assert got["Citenge"] == ("CD-KE-19", "CD-KE")           # alias
    assert got["Nowhere"] == (None, None) and unmatched == [("Nowhere", "Kinshasa")]
    assert used == {"CD-HK-19", "CD-KN-15", "CD-KN-01", "CD-KN-16", "CD-KE-19"}


def test_match_zones_restamp_is_idempotent_and_one_polygon_per_zone(monkeypatch):
    monkeypatch.setattr(build, "load_aliases", lambda: {})
    dhis2 = {"k1": "CD-KN-16"}
    fs = [feat("Kintambo", "Kinshasa", "k1"), feat("Kintambo", "Kinshasa", "k2")]   # a duplicate polygon
    build.match_zones(fs, LOCS, dhis2)
    first = [dict(f["properties"]) for f in fs]
    assert first[0]["location"] == "CD-KN-16" and first[1]["location"] is None   # the zone goes to one polygon
    build.match_zones(fs, LOCS, dhis2)   # second stamp reads src_name / src_province / dhis2
    assert [f["properties"] for f in fs] == first

