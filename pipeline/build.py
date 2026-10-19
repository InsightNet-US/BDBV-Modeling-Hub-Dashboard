"""Build data/ from a hub checkout (plus synthetic submissions when MOCK_MODE=on)."""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

import config
import hub_io
import mock
from summarize import d, iso, last_complete_week, samples_matrix, select_as_of, summarize_location, \
    validate_submission


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))


def saturdays(first: str, last: str) -> list[str]:
    out, cur = [], d(first)
    while cur <= d(last):
        out.append(iso(cur))
        cur += timedelta(days=7)
    return out


def build_observed(target: pd.DataFrame, locations: list[str], out_dir: Path) -> dict:
    versions = sorted(target["as_of"].unique())
    all_weeks = sorted(target["target_end_date"].unique())
    weeks = saturdays(all_weeks[0], all_weeks[-1])
    for v in versions:
        t = target[target["as_of"] == v]
        by_loc = {}
        for loc, g in t.groupby("location"):
            m = dict(zip(g["target_end_date"], g["observation"]))
            by_loc[loc] = [float(m.get(w, 0)) for w in weeks]
        # national total = sum of provinces (observed only)
        prov = [by_loc[l] for l in locations if l in by_loc]
        if prov:
            by_loc["CD_total"] = [float(sum(col)) for col in zip(*prov)]
        write_json(out_dir / "observed" / f"{v}.json", {
            "as_of": v, "weeks": weeks, "last_complete_week": last_complete_week(v),
            "by_location": by_loc})
    return {"versions": versions, "weeks": weeks}


def build_health_zones(hz: pd.DataFrame, locs: pd.DataFrame, out_dir: Path) -> None:
    latest = sorted(hz["as_of"].unique())[-1]
    h = hz[hz["as_of"] == latest].copy()
    h["day"] = pd.to_datetime(h["target_end_date"])
    # epi week ending Saturday: shift so Sunday starts the week
    h["week"] = (h["day"] + pd.to_timedelta((5 - h["day"].dt.weekday) % 7, unit="D")).dt.strftime("%Y-%m-%d")
    weeks = saturdays(h["week"].min(), h["week"].max())
    parents = {}
    for _, r in locs[locs["location_type"] == "health zone"].iterrows():
        parents.setdefault(r["location_name"], []).append(r["parent"])
    zones = {}
    for name, g in h.groupby("location"):
        obs = g[~g["imputed"]].groupby("week")["observation"].sum()
        imp = g[g["imputed"]].groupby("week")["observation"].sum()
        cand = parents.get(name, [])
        zones[name] = {
            "parent": cand[0] if len(cand) == 1 else (cand[0] if cand else None),
            "ambiguous_parent": cand if len(cand) > 1 else None,
            "obs": [float(obs.get(w, 0)) for w in weeks],
            "imp": [float(imp.get(w, 0)) for w in weeks],
        }
    write_json(out_dir / "observed" / "health-zones.json", {"as_of": latest, "weeks": weeks, "zones": zones})


def main() -> int:
    hub = config.hub_dir()
    info = hub_io.describe(hub)
    print(f"hub: {hub} ({info.branch} @ {info.commit}); MOCK_MODE={config.MOCK_MODE}")
    rc = hub_io.read_round_config(hub)
    locs = hub_io.read_locations(hub)
    loc_names = dict(zip(locs["location"], locs["location_name"]))
    target = hub_io.read_target_data(hub)
    target = target[target["location"].isin(rc.locations)]
    delays = hub_io.read_delays(hub)
    hz = hub_io.read_health_zone_daily(hub)
    metadata = hub_io.read_model_metadata(hub)

    out_dir = config.DATA_DIR
    for sub in ("observed", "rounds"):
        shutil.rmtree(out_dir / sub, ignore_errors=True)
    obs_info = build_observed(target, rc.locations, out_dir)
    build_health_zones(hz, locs, out_dir)
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
        problems = validate_submission(df, ref, model_id, set(rc.locations))
        if problems:
            print(f"WARN {path.name}: {'; '.join(problems[:5])}")
        subs[(model_id, ref)] = df
    if config.MOCK_MODE == "on":
        if n_real:
            print(f"!!! WARNING: MOCK_MODE=on but {n_real} real round-2 submission file(s) exist on the hub. "
                  f"They are being IGNORED. Set MOCK_MODE=off to show real data. !!!")
        subs = mock.generate(target, delays, rc.locations)
        metadata.update(mock.mock_metadata())
        for (mid, ref), df in subs.items():
            problems = validate_submission(df, ref, mid, set(rc.locations))
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
        for mid, df in sorted(by_round[ref].items()):
            locs_out = {}
            for loc, g in df.groupby("location"):
                mat, weeks = samples_matrix(g)
                observed = dict(zip(obs_weeks, ov["by_location"].get(loc, [0] * len(obs_weeks))))
                locs_out[loc] = summarize_location(mat, weeks, ref, observed)
                week_union.update(weeks)
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
                           "models": sorted(models_out), "n_models": len(models_out)})
        print(f"round {ref}: {len(models_out)} models, data as of {as_of}{' (fallback)' if fallback else ''}")

    used = {m for r in rounds_out for m in r["models"]}
    write_json(out_dir / "models.json", {m: metadata[m] for m in sorted(used)})

    # location ordering: by cumulative cases in the latest data version
    latest = versions[-1]
    lv = json.loads((out_dir / "observed" / f"{latest}.json").read_text())
    totals = {l: sum(lv["by_location"].get(l, [0])) for l in rc.locations}
    locations = [{"code": l, "name": loc_names.get(l, l), "total": totals[l]}
                 for l in sorted(rc.locations, key=lambda l: (-totals[l], loc_names.get(l, l)))]

    write_json(out_dir / "manifest.json", {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hub": {"repo": config.HUB_REPO, "branch": info.branch, "commit": info.commit},
        "mock": config.MOCK_MODE == "on",
        "target": config.TARGET, "horizons": config.HORIZONS, "quantile_levels": config.QUANTILE_LEVELS,
        "locations": locations, "national_code": "CD_total",
        "national_in_tasks": "CD" in rc.locations,
        "as_of_versions": versions, "latest_as_of": latest,
        "ensemble_model_id": ensemble_id,
        "rounds": sorted(rounds_out, key=lambda r: r["reference_date"], reverse=True),
        "accepted_reference_dates": rc.reference_dates,
    })
    print(f"wrote {out_dir} — {len(rounds_out)} rounds, {len(used)} models, {len(versions)} data versions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
