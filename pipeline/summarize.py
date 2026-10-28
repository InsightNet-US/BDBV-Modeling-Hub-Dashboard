"""Pure functions turning sample trajectories into the compact summaries the dashboard reads."""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

import config


def d(s: str) -> date:
    return date.fromisoformat(s)


def iso(x: date) -> str:
    return x.isoformat()


def select_as_of(reference_date: str, as_of_versions: list[str],
                 lag_days: int = config.AS_OF_LAG_DAYS) -> tuple[str | None, bool]:
    """Latest as_of on or before reference_date - lag_days; else earliest version (fallback=True)."""
    if not as_of_versions:
        return None, True
    cutoff = d(reference_date) - timedelta(days=lag_days)
    ok = sorted(v for v in as_of_versions if d(v) <= cutoff)
    if ok:
        return ok[-1], False
    return sorted(as_of_versions)[0], True


def last_complete_week(as_of: str) -> str:
    """Last Saturday on or before as_of minus... a week ending on/after as_of is still in progress.
    A week is complete only if its Saturday is strictly before the release date."""
    a = d(as_of)
    # Saturday = weekday 5
    back = (a.weekday() - 5) % 7
    sat = a - timedelta(days=back)
    if sat >= a:
        sat -= timedelta(days=7)
    return iso(sat)


def qvals(arr: np.ndarray, levels=config.QUANTILE_LEVELS, nd: int = 1) -> list[float]:
    q = np.quantile(np.asarray(arr, dtype=float), levels)
    return [round(float(v), nd) for v in q]


def samples_matrix(sub: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """sub: rows for ONE (model, reference_date, location). Returns (n_samples x n_weeks matrix, weeks)."""
    piv = sub.pivot_table(index="output_type_id", columns="target_end_date", values="value",
                          aggfunc="first")
    piv = piv.sort_index(axis=1)
    weeks = [str(c) for c in piv.columns]
    mat = piv.to_numpy(dtype=float)
    return mat, weeks


def _complete_rows(mat: np.ndarray) -> np.ndarray:
    """Trajectories must cover the same weeks; drop incomplete samples rather than fail."""
    if np.isnan(mat).any():
        mat = mat[~np.isnan(mat).any(axis=1)]
    return mat


def _summaries(mat: np.ndarray, weeks: list[str], reference_date: str, present: np.ndarray,
               obs_fixed_rows: np.ndarray, horizons, observed_fixed: float | None = None) -> dict:
    """Shared core for one model and for a pool of models.

    mat: rows x weeks (aligned to `weeks`, ISO Saturdays); present: boolean rows x weeks, True where the
    row's model submitted that week (all True for a single model); obs_fixed_rows: per-row reported total
    for the closed weeks the row's model did not submit. Every derived quantity (per-week values, nowcast
    cumulative, forecast windows, presence) is computed trajectory by trajectory and summarised afterwards.
    """
    R = d(reference_date)
    widx = {w: i for i, w in enumerate(weeks)}
    n = mat.shape[0]
    # Nowcast weeks have closed (Saturday before the reference date) but are incompletely reported.
    # The reference week itself (horizon 0) has not finished when submissions are made, so it is a
    # forecast horizon like +1..+3 and is never filled from reported data.
    nowcast_weeks = [w for w in weeks if d(w) < R]
    fc_week = {h: iso(R + timedelta(days=7 * h)) for h in horizons}

    def col(i: int) -> np.ndarray:   # a week's values, 0 for rows whose model did not submit it
        return np.where(present[:, i], mat[:, i], 0.0)

    out: dict = {
        "weeks": weeks,
        "q": [qvals(mat[present[:, i], i]) for i in range(len(weeks))],
        # per-week probability of at least one case (drives the map's P(>=1 case) metric)
        "presence_wk": [round(float(np.mean(mat[present[:, i], i] >= 1)), 3) for i in range(len(weeks))],
        "n_samples": int(n),
        "n_nowcast_weeks": len(nowcast_weeks),
        "horizon_sum": {}, "presence": {}, "cum_through_h": {},
    }

    # nowcast cumulative through the last closed week (R - 7): reported counts for unsubmitted
    # closed weeks, trajectory values for submitted ones
    cum_now = np.asarray(obs_fixed_rows, dtype=float).copy()
    for w in nowcast_weeks:
        cum_now += col(widx[w])
    out["cum_nowcast"] = qvals(cum_now)
    out["nowcast_through"] = iso(R - timedelta(days=7))
    if observed_fixed is not None:
        out["observed_fixed"] = observed_fixed

    # Forecast windows run from the reference week (h=0) through R+h; every week in the window must
    # be submitted, and a gap makes that horizon and all longer ones unavailable. In a pool, a row
    # whose model misses a week of the window drops out of that horizon and the longer ones.
    run = np.zeros(n)
    cum_h = cum_now.copy()
    mask = np.ones(n, dtype=bool)
    have_all = True
    for h in sorted(horizons):
        w = fc_week[h]
        if w not in widx:
            have_all = False
        if have_all:
            i = widx[w]
            mask = mask & present[:, i]
            have_all = bool(mask.any())
        if have_all:
            c = col(i)
            run = run + c
            cum_h = cum_h + c
            out["horizon_sum"][str(h)] = qvals(run[mask])
            out["presence"][str(h)] = round(float(np.mean(run[mask] >= 1)), 3)
            out["cum_through_h"][str(h)] = qvals(cum_h[mask])
        else:
            out["horizon_sum"][str(h)] = None
            out["presence"][str(h)] = None
            out["cum_through_h"][str(h)] = None
    return out


def summarize_location(mat: np.ndarray, weeks: list[str], reference_date: str,
                       observed: dict[str, float], horizons=config.HORIZONS) -> dict:
    """Summaries for one model/location.

    mat: samples x weeks (aligned to `weeks`, ISO Saturdays). observed: week -> reported count in the
    round's data version (used to fill weeks <= reference_date the model did not submit).
    """
    mat = _complete_rows(mat)
    R = d(reference_date)
    obs_fixed = sum(v for w, v in observed.items() if d(w) < R and w not in set(weeks))
    present = np.ones(mat.shape, dtype=bool)
    return _summaries(mat, weeks, reference_date, present, np.full(mat.shape[0], float(obs_fixed)),
                      horizons, observed_fixed=round(float(obs_fixed), 1))


def pool_members(members: dict[str, tuple[np.ndarray, list[str]]], reference_date: str,
                 observed: dict[str, float], horizons=config.HORIZONS) -> dict:
    """Linear-pool ensemble of several models for one location (hubEnsemble::linear_pool on samples).

    members: model_id -> (samples x weeks matrix, weeks). Every trajectory of every member is kept
    (equal weight per model when sample counts are equal). Rows are stacked on the union of weeks with a
    per-row presence mask, so per-week values use the models that submitted the week, while cumulative
    and forecast-window quantities are computed per trajectory (reported counts filling the closed weeks
    a row's own model did not submit) and summarised over the pool.
    """
    R = d(reference_date)
    weeks = sorted({w for _, wk in members.values() for w in wk})
    widx = {w: i for i, w in enumerate(weeks)}
    blocks, pres, fixed, n_models_wk = [], [], [], np.zeros(len(weeks), dtype=int)
    for mid in sorted(members):
        mat, wk = members[mid]
        mat = _complete_rows(np.asarray(mat, dtype=float))
        full = np.zeros((mat.shape[0], len(weeks)))
        p = np.zeros((mat.shape[0], len(weeks)), dtype=bool)
        for j, w in enumerate(wk):
            full[:, widx[w]] = mat[:, j]
            p[:, widx[w]] = True
            n_models_wk[widx[w]] += 1
        obs_fixed = sum(v for w, v in observed.items() if d(w) < R and w not in set(wk))
        blocks.append(full)
        pres.append(p)
        fixed.append(np.full(mat.shape[0], float(obs_fixed)))
    out = _summaries(np.vstack(blocks), weeks, reference_date, np.vstack(pres), np.concatenate(fixed),
                     horizons)
    out["n_models"] = len(members)
    out["members"] = sorted(members)
    out["n_models_wk"] = [int(x) for x in n_models_wk]
    return out


def validate_submission(df: pd.DataFrame, reference_date: str, model_id: str,
                        allowed_locations: set[str] | None = None) -> list[str]:
    """Checks from model-output/README.md. Returns a list of problems (empty = valid)."""
    problems: list[str] = []
    if (df["reference_date"] != reference_date).any():
        problems.append("reference_date column does not match the file's reference_date")
    if (df["output_type"] != "sample").any():
        problems.append("output_type must be 'sample'")
    if (df["target"] != config.TARGET).any():
        problems.append(f"target must be '{config.TARGET}'")
    if (df["value"] < 0).any() or df["value"].isna().any():
        problems.append("values must be non-negative numbers")
    R = d(reference_date)
    for w in df["target_end_date"].unique():
        wd = d(w)
        if wd.weekday() != 5:
            problems.append(f"target_end_date {w} is not a Saturday")
        if wd > R + timedelta(days=21) or wd < d("2026-02-14"):
            problems.append(f"target_end_date {w} outside the allowed range")
    if allowed_locations is not None:
        bad = sorted(set(df["location"]) - allowed_locations)
        if bad:
            problems.append(f"locations not in tasks.json: {bad}")
    for loc, g in df.groupby("location"):
        n = g["output_type_id"].nunique()
        if n != 100:
            problems.append(f"{loc}: {n} samples (need exactly 100)")
        weeks_per_sample = g.groupby("output_type_id")["target_end_date"].apply(
            lambda s: tuple(sorted(s)))
        if weeks_per_sample.nunique() != 1:
            problems.append(f"{loc}: samples do not share the same set of target_end_dates")
        if g.duplicated(["output_type_id", "target_end_date"]).any():
            problems.append(f"{loc}: duplicate (sample, target_end_date) rows")
    return problems
