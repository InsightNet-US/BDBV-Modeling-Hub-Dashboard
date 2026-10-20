"""Build data/ from a hub checkout (plus synthetic submissions when MOCK_MODE=on)."""
from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

import config
import hub_io
import mock
from summarize import d, iso, last_complete_week, samples_matrix, select_as_of, summarize_location, \
    validate_submission


NATIONAL = "CD"   # the hub's national location code


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))


def saturdays(first: str, last: str) -> list[str]:
    out, cur = [], d(first)
    while cur <= d(last):
        out.append(iso(cur))
        cur += timedelta(days=7)
    return out


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    s = s.lower().replace("-", " ").replace("'", " ").replace("’", " ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------- locations
def location_table(locs: pd.DataFrame) -> list[dict]:
    """[{code, name, type, parent}] with `parent` as a code (country -> None)."""
    prov = locs[locs["location_type"] == "province"]
    name2code = dict(zip(prov["location_name"], prov["location"]))
    out = []
    for _, r in locs.iterrows():
        t = r["location_type"]
        parent = None if t == "country" else (NATIONAL if t == "province" else name2code.get(r["parent"], r["parent"]))
        out.append({"code": r["location"], "name": r["location_name"], "type": t, "parent": parent})
    return out


# ---------------------------------------------------------------- observed
def build_observed(target: pd.DataFrame, out_dir: Path) -> dict:
    versions = sorted(target["as_of"].unique())
    all_weeks = sorted(target["target_end_date"].unique())
    weeks = saturdays(all_weeks[0], all_weeks[-1])
    for v in versions:
        t = target[target["as_of"] == v]
        by_loc = {}
        for loc, g in t.groupby("location"):
            m = dict(zip(g["target_end_date"], g["observation"]))
            by_loc[loc] = [float(m.get(w, 0)) for w in weeks]
        write_json(out_dir / "observed" / f"{v}.json", {
            "as_of": v, "weeks": weeks, "last_complete_week": last_complete_week(v),
            "by_location": by_loc})
    return {"versions": versions, "weeks": weeks}


# ---------------------------------------------------------------- geo
def load_aliases() -> dict[tuple[str, str], tuple[str, str]]:
    """HDX (norm name, norm province) -> hub (name, parent name)."""
    path = config.GEO_SRC / "hz-aliases.csv"
    out = {}
    if path.exists():
        with path.open() as fh:
            for r in csv.DictReader(fh):
                if r.get("hdx_name"):
                    out[(norm(r["hdx_name"]), norm(r.get("hdx_province", "")))] = (r["hub_name"], r["hub_parent"])
    return out


def stamp_geo_codes(locs: pd.DataFrame, out_dir: Path) -> None:
    """Attach hub location codes to the committed boundary files.

    Provinces: the geoBoundaries shapeISO (CD-XX) is the hub code. Health zones: HDX name + province
    matched to locations.csv by normalised name (with data/geo/hz-aliases.csv for spelling differences).
    """
    geo = out_dir / "geo"
    prov = locs[locs["location_type"] == "province"]
    name2code = dict(zip(prov["location_name"], prov["location"]))
    pfile = geo / "provinces.json"
    if pfile.exists():
        gj = json.loads(pfile.read_text())
        for f in gj["features"]:
            p = f["properties"]
            code = p.get("location") or ""
            if code and not code.startswith("CD-"):
                code = f"CD-{code}"
            if code not in set(prov["location"]):
                code = name2code.get(p.get("name"), code)
            p["location"] = code
        write_json(pfile, gj)

    zfile = geo / "health-zones.json"
    if zfile.exists():
        gj = json.loads(zfile.read_text())
        hz = locs[locs["location_type"] == "health zone"]
        by_np = {(norm(r["location_name"]), norm(r["parent"])): (r["location"], r["location_name"], name2code.get(r["parent"], r["parent"]))
                 for _, r in hz.iterrows()}
        by_name: dict[str, list] = {}
        for k, v in by_np.items():
            by_name.setdefault(k[0], []).append(v)
        aliases = load_aliases()
        used, unmatched = set(), []
        for f in gj["features"]:
            p = f["properties"]
            hn, hp = p.get("hdx_name") or p.get("name"), p.get("hdx_province") or p.get("parent")
            nn, np_ = norm(hn), norm(hp)
            cands = []
            a = aliases.get((nn, np_)) or aliases.get((nn, ""))
            if a:
                cands.append(by_np.get((norm(a[0]), norm(a[1]))))
            cands.append(by_np.get((nn, np_)))
            same = by_name.get(nn, [])
            if len(same) == 1:
                cands.append(same[0])
            elif len(same) > 1:
                loose = [c for c in same if norm(c[2]) and (norm(c[2]) in np_ or np_ in norm(c[2]))]
                cands.append(loose[0] if len(loose) == 1 else None)
            hit = next((c for c in cands if c), None)
            if hit:
                used.add(hit[0])
                f["properties"] = {"location": hit[0], "name": hit[1], "parent": hit[2], "hdx_name": hn,
                                   "hdx_province": hp, "pcode": p.get("pcode"), "matched": True}
            else:
                unmatched.append((hn, hp))
                f["properties"] = {"location": None, "name": hn, "parent": name2code.get(hp, hp), "hdx_name": hn,
                                   "hdx_province": hp, "pcode": p.get("pcode"), "matched": False}
        write_json(zfile, gj)
        missing = sorted(set(hz["location"]) - used)
        print(f"health-zone boundaries: {len(gj['features']) - len(unmatched)}/{len(gj['features'])} polygons "
              f"carry a hub code; {len(missing)} hub zones without a polygon: "
              f"{[(m, hz.set_index('location').loc[m, 'location_name']) for m in missing][:12]}")
        if unmatched:
            print(f"  polygons without a hub zone (add rows to data/geo/hz-aliases.csv): {unmatched[:12]}")


# ---------------------------------------------------------------- main
def main() -> int:
    hub = config.hub_dir()
    info = hub_io.describe(hub)
    print(f"hub: {hub} ({info.branch} @ {info.commit}); MOCK_MODE={config.MOCK_MODE}")
    rc = hub_io.read_round_config(hub)
    locs = hub_io.read_locations(hub)
    loc_table = location_table(locs)
    allowed = set(rc.locations)
    target = hub_io.read_target_data(hub)
    target = target[target["location"].isin(allowed)]
    delays = hub_io.read_delays(hub)
    metadata = hub_io.read_model_metadata(hub)

    out_dir = config.DATA_DIR
    if out_dir != config.GEO_SRC.parent.resolve():   # building outside the repo's data/: bring the boundaries along
        out_dir.mkdir(parents=True, exist_ok=True)
        shutil.copytree(config.GEO_SRC, out_dir / "geo", dirs_exist_ok=True)
    for sub in ("observed", "rounds"):
        shutil.rmtree(out_dir / sub, ignore_errors=True)
    obs_info = build_observed(target, out_dir)
    stamp_geo_codes(locs, out_dir)
    versions = obs_info["versions"]

    # ---- collect submissions: {(model_id, reference_date): DataFrame}
    subs: dict[tuple[str, str], pd.DataFrame] = {}
    real_files = hub_io.list_model_output_files(hub)
    n_real = 0
    for model_id, ref, path in real_files:
        df = hub_io.read_sample_submission(path)
        if df is None:
            continue
        n_real += 1
        if config.MOCK_MODE == "on":
            continue
        problems = validate_submission(df, ref, model_id, allowed)
        if problems:
            print(f"WARN {path.name}: {'; '.join(problems[:5])}")
        subs[(model_id, ref)] = df
    if config.MOCK_MODE == "on":
        if n_real:
            print(f"!!! WARNING: MOCK_MODE=on but {n_real} real round-2 submission file(s) exist on the hub. "
                  f"They are being IGNORED. Set MOCK_MODE=off to show real data. !!!")
        subs = mock.generate(target, delays, locs)
        metadata.update(mock.mock_metadata())
        for (mid, ref), df in subs.items():
            problems = validate_submission(df, ref, mid, allowed)
            if problems:
                raise RuntimeError(f"mock {mid} {ref} fails hub validation: {problems}")
    else:
        print(f"real round-2 submissions: {n_real}")

    # ---- ensemble id
    flagged = [m for m, meta in metadata.items() if meta.get("ensemble_of_hub_models")]
    ensemble_id = config.ENSEMBLE_MODEL_ID or (flagged[0] if len(flagged) == 1 else None)
    if len(flagged) > 1 and not config.ENSEMBLE_MODEL_ID:
        print(f"WARN several models flagged as ensembles {flagged}; set ENSEMBLE_MODEL_ID")

    # ---- per round summaries
    rounds_out = []
    by_round: dict[str, dict[str, pd.DataFrame]] = {}
    for (mid, ref), df in subs.items():
        by_round.setdefault(ref, {})[mid] = df
    obs_cache: dict[str, dict] = {}
    for ref in sorted(by_round):
        as_of, fallback = select_as_of(ref, versions)
        if as_of not in obs_cache:
            obs_cache[as_of] = json.loads((out_dir / "observed" / f"{as_of}.json").read_text())
        ov = obs_cache[as_of]
        obs_weeks = ov["weeks"]
        models_out = {}
        week_union: set[str] = set(obs_weeks)
        n_loc_type = {"country": 0, "province": 0, "health zone": 0}
        type_of = {l["code"]: l["type"] for l in loc_table}
        for mid, df in sorted(by_round[ref].items()):
            locs_out = {}
            for loc, g in df.groupby("location"):
                mat, weeks = samples_matrix(g)
                observed = dict(zip(obs_weeks, ov["by_location"].get(loc, [0] * len(obs_weeks))))
                locs_out[loc] = summarize_location(mat, weeks, ref, observed)
                week_union.update(weeks)
                n_loc_type[type_of.get(loc, "province")] += 1
            models_out[mid] = {"locations": locs_out}
            if mid not in metadata:
                metadata[mid] = {"model_id": mid, "team_name": mid.split("-")[0], "team_abbr": mid.split("-")[0],
                                 "model_name": mid, "model_abbr": mid, "methods": "", "data_inputs": "",
                                 "website_url": "", "repo_url": "", "license": "",
                                 "ensemble_of_hub_models": False, "mock": False}
        weeks_all = saturdays(min(week_union), max(week_union))
        write_json(out_dir / "rounds" / f"{ref}.json", {
            "reference_date": ref, "as_of": as_of, "as_of_fallback": fallback,
            "weeks": weeks_all, "horizons": config.HORIZONS, "quantile_levels": config.QUANTILE_LEVELS,
            "models": models_out})
        rounds_out.append({"reference_date": ref, "as_of": as_of, "as_of_fallback": fallback,
                           "models": sorted(models_out), "n_models": len(models_out),
                           "n_zone_models": sum(1 for m in models_out.values()
                                                if any(type_of.get(l) == "health zone" for l in m["locations"]))})
        size_kb = (out_dir / "rounds" / f"{ref}.json").stat().st_size // 1024
        print(f"round {ref}: {len(models_out)} models, data as of {as_of}{' (fallback)' if fallback else ''}; "
              f"model x location summaries: {n_loc_type}; {size_kb} KB")

    used = {m for r in rounds_out for m in r["models"]}
    write_json(out_dir / "models.json", {m: metadata[m] for m in sorted(used)})

    # location table with cumulative cases in the latest data version; provinces and zones sorted by cases
    latest = versions[-1]
    lv = json.loads((out_dir / "observed" / f"{latest}.json").read_text())
    for l in loc_table:
        l["total"] = float(sum(lv["by_location"].get(l["code"], [0])))
    order = {"country": 0, "province": 1, "health zone": 2}
    loc_table.sort(key=lambda l: (order.get(l["type"], 3), -l["total"], l["name"]))

    write_json(out_dir / "manifest.json", {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hub": {"repo": config.HUB_REPO, "branch": info.branch, "commit": info.commit},
        "mock": config.MOCK_MODE == "on",
        "mock_gate": (hashlib.sha256(config.MOCK_PASSPHRASE.encode()).hexdigest()
                      if config.MOCK_MODE == "on" and config.MOCK_PASSPHRASE else None),
        "target": config.TARGET, "horizons": config.HORIZONS, "quantile_levels": config.QUANTILE_LEVELS,
        "locations": loc_table, "national_code": NATIONAL,
        "as_of_versions": versions, "latest_as_of": latest,
        "ensemble_model_id": ensemble_id,
        "rounds": sorted(rounds_out, key=lambda r: r["reference_date"], reverse=True),
        "accepted_reference_dates": rc.reference_dates,
    })
    print(f"wrote {out_dir} — {len(rounds_out)} rounds, {len(used)} models, {len(versions)} data versions, "
          f"{len(loc_table)} locations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
