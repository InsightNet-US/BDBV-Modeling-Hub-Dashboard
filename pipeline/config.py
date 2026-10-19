"""Pipeline configuration. Everything here can be overridden with environment variables."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

HUB_REPO = os.environ.get("HUB_REPO", "InsightNet-US/BDBV-Modeling-Hub")
HUB_BRANCH = os.environ.get("HUB_BRANCH", "hub-additions")
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


# "on": synthetic submissions replace any real round-2 files; "off": real files only.
MOCK_MODE = os.environ.get("MOCK_MODE", "off").strip().lower()
if MOCK_MODE not in ("on", "off"):
    raise ValueError("MOCK_MODE must be 'on' or 'off'")

# Explicit ensemble model id; if empty, the single model flagged ensemble_of_hub_models wins.
ENSEMBLE_MODEL_ID = os.environ.get("ENSEMBLE_MODEL_ID", "").strip() or None

ROUND_NAME = "BDBV 2026 nowcasting and forecasting"
TARGET = "wk inc confirmed cases"
QUANTILE_LEVELS = [0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975]
HORIZONS = [0, 1, 2, 3]   # horizon 0 = the reference week itself; windows run from week R through R+h
# A round's data version is the latest as_of on or before reference_date minus this many days
# (the Tuesday closing the submission window; the Monday 5 pm ET release qualifies).
AS_OF_LAG_DAYS = 4
MOCK_SEED = 20261031
