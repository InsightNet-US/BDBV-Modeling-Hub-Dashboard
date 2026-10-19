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


def summarize_location(mat: np.ndarray, weeks: list[str], reference_date: str,
                       observed: dict[str, float], horizons=config.HORIZONS) -> dict:
    """Summaries for one model/location.

    mat: samples x weeks (aligned to `weeks`, ISO Saturdays). observed: week -> reported count in the
    round's data version (used to fill weeks <= reference_date the model did not submit).
    """
    if np.isnan(mat).any():
        # trajectories must cover the same weeks; drop incomplete samples rather than fail
        keep = ~np.isnan(mat).any(axis=1)
        mat = mat[keep]
    R = d(reference_date)
    widx = {w: i for i, w in enumerate(weeks)}
    # Nowcast weeks have closed (Saturday before the reference date) but are incompletely reported.
    # The reference week itself (horizon 0) has not finished when submissions are made, so it is a
    # forecast horizon like +1..+3 and is never filled from reported data.
    nowcast_weeks = [w for w in weeks if d(w) < R]
    fc_week = {h: iso(R + timedelta(days=7 * h)) for h in horizons}

    out: dict = {
        "weeks": weeks,
        "q": [qvals(mat[:, i]) for i in range(mat.shape[1])],
        # per-week probability of at least one case (drives the map's P(>=1 case) metric)
        "presence_wk": [round(float(np.mean(mat[:, i] >= 1)), 3) for i in range(mat.shape[1])],
        "n_samples": int(mat.shape[0]),
        "n_nowcast_weeks": len(nowcast_weeks),
        "horizon_sum": {}, "presence": {}, "cum_through_h": {},
    }

    # nowcast cumulative through the last closed week (R - 7): reported counts for unsubmitted
    # closed weeks, trajectory values for submitted ones
    obs_fixed = sum(v for w, v in observed.items() if d(w) < R and w not in widx)
    cum_now = np.full(mat.shape[0], float(obs_fixed))
    for w in nowcast_weeks:
        cum_now += mat[:, widx[w]]
    out["cum_nowcast"] = qvals(cum_now)
    out["nowcast_through"] = iso(R - timedelta(days=7))
    out["observed_fixed"] = round(float(obs_fixed), 1)

    # Forecast windows run from the reference week (h=0) through R+h; every week in the window must
    # be submitted, and a gap makes that horizon and all longer ones unavailable.
    run = np.zeros(mat.shape[0])
    cum_h = cum_now.copy()
    have_all = True
    for h in sorted(horizons):
        w = fc_week[h]
        if w not in widx:
            have_all = False
        if have_all:
            col = mat[:, widx[w]]
            run = run + col
            cum_h = cum_h + col
            out["horizon_sum"][str(h)] = qvals(run)
            out["presence"][str(h)] = round(float(np.mean(run >= 1)), 3)
            out["cum_through_h"][str(h)] = qvals(cum_h)
        else:
            out["horizon_sum"][str(h)] = None
            out["presence"][str(h)] = None
            out["cum_through_h"][str(h)] = None
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
