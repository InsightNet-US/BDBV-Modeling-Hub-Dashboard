"""Synthetic submissions in exact hub format, generated in memory (never committed).

Three teams with different growth/dispersion assumptions plus a 'hub-ensemble' that is an equal-weight
linear pool of their trajectories. Values are anchored to the real target data: the eventual count for
each recently observed week is the reported count inflated by the empirical reporting-delay CDF, and
weeks beyond the data are extrapolated from the recent log-linear trend.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

import config
from summarize import d, iso

MOCK_REFERENCE_DATES = ["2026-10-17", "2026-10-24", "2026-10-31"]
N_NOWCAST_WEEKS = 8
N_SAMPLES = 100

TEAMS = {
    # growth multiplier per week relative to the fitted trend, trajectory-level growth sd, NB dispersion
    "mockA-renewal": dict(g=1.00, g_sd=0.06, k=12.0, spread_prov=0.9, name="Renewal-process nowcast",
                          methods="Renewal equation with time-varying Rt and province-specific reporting delays."),
    "mockB-growth":  dict(g=1.06, g_sd=0.10, k=6.0, spread_prov=0.6, name="Log-linear growth",
                          methods="Negative-binomial log-linear growth model fitted to the last six weeks."),
    "mockC-spatial": dict(g=0.96, g_sd=0.05, k=20.0, spread_prov=1.6, name="Spatial metapopulation",
                          methods="Gravity-model metapopulation with importation hazard to unaffected provinces."),
}
ENSEMBLE_ID = "hub-ensemble"
NATIONAL_CODE = "CD"   # the hub's national location; mock always submits it alongside the provinces

# provinces adjacent to the affected ones (used by mockC to seed a small importation hazard)
NEIGHBOURS = {"IT": ["HU", "NK", "TO"], "NK": ["SK", "MA", "TO", "IT"], "HU": ["BU", "TO", "IT"],
              "TO": ["MA", "SA", "MO", "BU", "HU", "IT", "NK"], "BU": ["MO", "NU", "HU", "TO"],
              "SK": ["MA", "TA", "NK"]}


def mock_metadata() -> dict[str, dict]:
    out = {}
    for mid, t in TEAMS.items():
        team, model = mid.split("-", 1)
        out[mid] = dict(model_id=mid, team_name=f"Synthetic team {team[-1].upper()}", team_abbr=team,
                        model_name=t["name"], model_abbr=model, methods=t["methods"],
                        data_inputs="Hub target data and auxiliary reporting delays (synthetic demo).",
                        website_url="", repo_url="", license="CC-BY-4.0",
                        ensemble_of_hub_models=False, mock=True)
    out[ENSEMBLE_ID] = dict(model_id=ENSEMBLE_ID, team_name="BDBV Modeling Hub", team_abbr="hub",
                            model_name="Hub ensemble (linear pool)", model_abbr="ensemble",
                            methods="Equal-weight linear pool of all submitted sample trajectories; "
                                    "100 trajectories resampled from the pooled set.",
                            data_inputs="Team submissions.", website_url="", repo_url="",
                            license="CC-BY-4.0", ensemble_of_hub_models=True, mock=True)
    return out


def delay_cdf(delays: pd.DataFrame) -> dict[str, np.ndarray]:
    """Empirical CDF of days from onset to report, per province, pooled where sparse."""
    pooled = delays["days_sym_to_report"].to_numpy(dtype=float)
    out = {"_pooled": pooled}
    for loc, g in delays.groupby("location"):
        v = g["days_sym_to_report"].to_numpy(dtype=float)
        out[loc] = v if len(v) >= 30 else pooled
    return out


def completeness(cdf: dict[str, np.ndarray], loc: str, days: float) -> float:
    v = cdf.get(loc, cdf["_pooled"])
    return float(np.clip(np.mean(v <= days), 0.15, 1.0))


def _eventual_series(obs: dict[str, float], weeks: list[str], as_of: str, loc: str,
                     cdf: dict[str, np.ndarray]) -> np.ndarray:
    """Point estimate of the eventual count per week (the mock models' shared 'truth' anchor)."""
    a = d(as_of)
    ev = np.zeros(len(weeks))
    observed_weeks = [w for w in weeks if d(w) <= a]
    for i, w in enumerate(weeks):
        wd = d(w)
        if wd <= a:
            days = (a - wd).days + 3  # mid-week onset
            c = completeness(cdf, loc, days)
            ev[i] = obs.get(w, 0.0) / c
    # log-linear trend on the last 6 complete-ish observed weeks (eventual scale) for extrapolation
    hist_idx = [weeks.index(w) for w in observed_weeks[-7:-1]] if len(observed_weeks) >= 7 else \
               [weeks.index(w) for w in observed_weeks[:-1]]
    y = np.log(np.maximum(ev[hist_idx], 0.5)) if hist_idx else np.array([0.0])
    if len(hist_idx) >= 3 and ev[hist_idx].sum() > 5:
        x = np.arange(len(hist_idx))
        slope, intercept = np.polyfit(x, y, 1)
        slope = float(np.clip(slope, -0.25, 0.25))
        level = float(np.exp(intercept + slope * (len(hist_idx) - 1)))
    else:
        slope, level = 0.0, float(np.mean(ev[hist_idx])) if hist_idx else 0.0
    last_hist = hist_idx[-1] if hist_idx else -1
    for i, w in enumerate(weeks):
        if d(w) > a or (i > last_hist and ev[i] < level * 0.5 and d(w) >= a - timedelta(days=7)):
            steps = i - last_hist
            ev[i] = level * np.exp(slope * steps)
    return ev


def generate(target: pd.DataFrame, delays: pd.DataFrame, locations: list[str],
             reference_dates: list[str] = MOCK_REFERENCE_DATES,
             seed: int = config.MOCK_SEED) -> dict[tuple[str, str], pd.DataFrame]:
    """Return {(model_id, reference_date): hub-format DataFrame} for all mock models.

    Each team submits every province in `locations` plus the national series `CD` (the per-sample
    sum of its provincial trajectories, so each national trajectory is internally coherent).
    """
    rng = np.random.default_rng(seed)
    latest = sorted(target["as_of"].unique())[-1]
    t = target[target["as_of"] == latest]
    obs_by_loc = {loc: dict(zip(g["target_end_date"], g["observation"])) for loc, g in t.groupby("location")}
    cdf = delay_cdf(delays)
    out: dict[tuple[str, str], pd.DataFrame] = {}

    locations = [l for l in locations if l != NATIONAL_CODE]
    for R in reference_dates:
        Rd = d(R)
        weeks = [iso(Rd - timedelta(days=7 * k)) for k in range(N_NOWCAST_WEEKS - 1, -1, -1)]
        weeks += [iso(Rd + timedelta(days=7 * h)) for h in config.HORIZONS]
        nw = len(weeks)
        team_rows: dict[str, list[pd.DataFrame]] = {m: [] for m in TEAMS}
        pooled: dict[str, list[np.ndarray]] = {}
        national: dict[str, np.ndarray] = {m: np.zeros((N_SAMPLES, nw)) for m in TEAMS}
        for loc in locations:
            obs = obs_by_loc.get(loc, {})
            ev = _cached_ev(obs_by_loc, loc, weeks, latest, cdf)
            reported = np.array([obs.get(w, 0.0) if d(w) <= d(latest) else 0.0 for w in weeks])
            # importation pressure from affected neighbours (for the spatial model's unaffected provinces)
            neighbour_ev = np.zeros(nw)
            for src, nbs in NEIGHBOURS.items():
                if loc in nbs and src in obs_by_loc:
                    neighbour_ev += _cached_ev(obs_by_loc, src, weeks, latest, cdf)
            for mid, tp in TEAMS.items():
                mats = np.zeros((N_SAMPLES, nw))
                # per-trajectory growth deviation keeps samples jointly coherent across weeks
                gdev = rng.normal(0, tp["g_sd"], N_SAMPLES)
                k = tp["k"]
                for j, w in enumerate(weeks):
                    steps = max(0, j - (N_NOWCAST_WEEKS - 1))  # weeks beyond the reference date
                    recent = 1.0 if j >= N_NOWCAST_WEEKS - 3 else 0.0  # nowcast weeks share some uncertainty
                    mean = ev[j] * (tp["g"] ** steps) * np.exp(gdev * (steps + 0.5 * recent))
                    if ev[j] < 0.05 and mid == "mockC-spatial":
                        mean = np.full(N_SAMPLES, 0.002 * neighbour_ev[j] * tp["spread_prov"])
                    extra = np.maximum(mean - reported[j], 0.0)
                    draw = np.zeros(N_SAMPLES)
                    pos = extra > 1e-9
                    if pos.any():
                        p = k / (k + extra[pos])
                        draw[pos] = rng.negative_binomial(k, p)
                    mats[:, j] = reported[j] + draw
                pooled.setdefault(loc, []).append(mats)
                team_rows[mid].append(_to_rows(mats, weeks, R, loc))
                national[mid] += mats          # national trajectory = per-sample sum over provinces
        for mid in TEAMS:
            team_rows[mid].append(_to_rows(national[mid], weeks, R, NATIONAL_CODE))
            pooled.setdefault(NATIONAL_CODE, []).append(national[mid])
            out[(mid, R)] = pd.concat(team_rows[mid], ignore_index=True)
        ens_rows = []
        for loc, mats in pooled.items():
            allm = np.vstack(mats)
            pick = rng.choice(allm.shape[0], N_SAMPLES, replace=False)
            ens_rows.append(_to_rows(allm[pick], weeks, R, loc))
        out[(ENSEMBLE_ID, R)] = pd.concat(ens_rows, ignore_index=True)
    return out


_EV_CACHE: dict[tuple, np.ndarray] = {}


def _cached_ev(obs_by_loc, loc, weeks, as_of, cdf):
    key = (loc, tuple(weeks), as_of)
    if key not in _EV_CACHE:
        _EV_CACHE[key] = _eventual_series(obs_by_loc.get(loc, {}), weeks, as_of, loc, cdf)
    return _EV_CACHE[key]


def _to_rows(mats: np.ndarray, weeks: list[str], R: str, loc: str) -> pd.DataFrame:
    n, nw = mats.shape
    return pd.DataFrame({
        "reference_date": R,
        "target": config.TARGET,
        "target_end_date": np.tile(weeks, n),
        "location": loc,
        "output_type": "sample",
        "output_type_id": np.repeat(np.arange(1, n + 1), nw).astype(str),
        "value": np.round(mats.reshape(-1), 0),
    })
