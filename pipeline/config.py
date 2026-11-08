"""Pipeline configuration. Everything here can be overridden with environment variables."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Output folder: the committed ROOT/data unless DATA_DIR says otherwise.
DATA_DIR = Path(os.environ.get("DATA_DIR") or ROOT / "data").resolve()
GEO_SRC = ROOT / "data" / "geo"   # committed boundary files + alias table, copied into DATA_DIR when it differs

HUB_REPO = os.environ.get("HUB_REPO", "InsightNet-US/BDBV-Modeling-Hub")
HUB_BRANCH = os.environ.get("HUB_BRANCH", "main")
HUB_BRANCH_FALLBACK = os.environ.get("HUB_BRANCH_FALLBACK", "main")


def hub_dir() -> Path:
    """Local checkout of the hub. CI clones into ./hub; locally we fall back to a sibling checkout."""
    env = os.environ.get("HUB_DIR")
    candidates = [Path(env)] if env else []
    candidates += [ROOT / "hub", Path.home() / "Development" / "BDBV-Modeling-Hub"]
    for c in candidates:
        if (c / "hub-config" / "tasks.json").exists():
            return c
    raise FileNotFoundError(
        "No hub checkout found. Set HUB_DIR or clone the hub into ./hub "
        f"(tried: {', '.join(str(c) for c in candidates)})"
    )


# Explicit hub ensemble model id; if empty, the single model flagged ensemble_of_hub_models wins.
ENSEMBLE_MODEL_ID = os.environ.get("ENSEMBLE_MODEL_ID", "").strip() or None

# Where the ensemble shown on the dashboard comes from, decided per round:
#   hub       - the hub's ensemble model when it submitted the round, otherwise none;
#   dashboard - a linear pool of the round's submissions computed by this pipeline;
#   auto      - the hub's ensemble when it submitted the round, else the dashboard pool.
ENSEMBLE_SOURCE = os.environ.get("ENSEMBLE_SOURCE", "auto").strip().lower() or "auto"
if ENSEMBLE_SOURCE not in ("hub", "auto", "dashboard"):
    raise ValueError("ENSEMBLE_SOURCE must be 'hub', 'auto' or 'dashboard'")
DASHBOARD_ENSEMBLE_ID = "BDBV-dashboard-ensemble"
# A location gets a dashboard ensemble only when at least this many models submitted it.
ENSEMBLE_MIN_MODELS = int(os.environ.get("ENSEMBLE_MIN_MODELS", "2"))
# Model ids never pooled into the dashboard ensemble (comma-separated), on top of any hub ensemble.
ENSEMBLE_EXCLUDE = [m.strip() for m in os.environ.get("ENSEMBLE_EXCLUDE", "").split(",") if m.strip()]

# Corrections to the province (parent) of hub health zones, applied when locations.csv is read; an entry is a
# no-op once the hub's own file agrees. Manika (CD-HK-19) is a Kolwezi zone in Lualaba (GRID3, INRB, INSP);
# the hub lists it under Haut Katanga, a leftover of the former Katanga province. The code is unchanged.
PARENT_OVERRIDES = {"CD-HK-19": "Lualaba"}

ROUND_NAME = "BDBV 2026 nowcasting and forecasting"
TARGET = "wk inc confirmed cases"
QUANTILE_LEVELS = [0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975]
# Trend classes: a trajectory's week-h value against its own value for the last closed week (R-7)
# is an increase above (1 + T) x, a decrease below (1 - T) x, stable otherwise.
TREND_THRESHOLD = 0.10
HORIZONS = [0, 1, 2, 3]   # horizon 0 = the reference week itself; windows run from week R through R+h
# A round's data version is the latest as_of on or before reference_date minus this many days
# (the Tuesday closing the submission window; the Monday 5 pm ET release qualifies).
AS_OF_LAG_DAYS = 4
