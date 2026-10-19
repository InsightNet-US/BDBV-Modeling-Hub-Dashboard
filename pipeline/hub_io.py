"""Read hub files from a local checkout (tasks.json, target data, auxiliary data, metadata, model output)."""
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd
import yaml

import config

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass
class HubInfo:
    path: Path
    branch: str
    commit: str


def describe(path: Path) -> HubInfo:
    def git(*args: str) -> str:
        try:
            return subprocess.check_output(["git", "-C", str(path), *args], text=True,
                                           stderr=subprocess.DEVNULL).strip()
        except Exception:
            return ""
    return HubInfo(path=path, branch=git("rev-parse", "--abbrev-ref", "HEAD") or "?",
                   commit=git("rev-parse", "--short", "HEAD") or "?")


@dataclass
class RoundConfig:
    reference_dates: list[str]
    locations: list[str]
    target_end_dates: list[str]
    targets: list[str] = field(default_factory=list)


def read_round_config(hub: Path) -> RoundConfig:
    tasks = json.loads((hub / "hub-config" / "tasks.json").read_text())
    rounds = [r for r in tasks["rounds"] if r.get("round_name") == config.ROUND_NAME]
    if not rounds:
        raise RuntimeError(f"Round '{config.ROUND_NAME}' not found in tasks.json")
    mt = rounds[0]["model_tasks"][0]["task_ids"]

    def vals(k: str) -> list[str]:
        v = mt[k]
        return sorted(set((v.get("required") or []) + (v.get("optional") or [])))

    return RoundConfig(reference_dates=vals("reference_date"), locations=vals("location"),
                       target_end_dates=vals("target_end_date"), targets=vals("target"))


def read_locations(hub: Path) -> pd.DataFrame:
    df = pd.read_csv(hub / "auxiliary-data" / "locations.csv", dtype=str, keep_default_na=False)
    return df


def read_target_data(hub: Path) -> pd.DataFrame:
    df = pd.read_csv(hub / "target-data" / "time-series.csv", dtype={"location": str, "as_of": str,
                                                                      "target_end_date": str})
    df = df[df["target"] == config.TARGET].copy()
    if "location_type" not in df.columns:
        df["location_type"] = ""
    df["observation"] = pd.to_numeric(df["observation"], errors="coerce").fillna(0)
    return df


def read_health_zone_daily(hub: Path) -> pd.DataFrame:
    df = pd.read_csv(hub / "auxiliary-data" / "daily-confirmed-case-by-hz.csv",
                     dtype={"as_of": str, "target_end_date": str, "location": str})
    df["observation"] = pd.to_numeric(df["observation"], errors="coerce").fillna(0)
    df["imputed"] = df["imputed"].astype(str).str.upper().eq("TRUE")
    return df


def read_delays(hub: Path) -> pd.DataFrame:
    """Reporting delays with `location` normalised to the hub's province code.

    The file has carried either province codes or province names; names are mapped through
    locations.csv so downstream code can always key on the code.
    """
    df = pd.read_csv(hub / "auxiliary-data" / "weekly-reporting-delays-by-province.csv", dtype=str)
    df["days_sym_to_report"] = pd.to_numeric(df["days_sym_to_report"], errors="coerce")
    locs = read_locations(hub)
    prov = locs[locs["location_type"] == "province"]
    name2code = dict(zip(prov["location_name"], prov["location"]))
    codes = set(prov["location"])
    # the file has carried a `location` column (codes or names) and, since 2026-10-19, `location_name`
    src = df["location"] if "location" in df.columns else df["location_name"]
    df["location"] = [l if l in codes else name2code.get(l, l) for l in src.astype(str)]
    return df.dropna(subset=["days_sym_to_report"])


def read_model_metadata(hub: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for f in sorted((hub / "model-metadata").glob("*.y*ml")):
        try:
            meta = yaml.safe_load(f.read_text()) or {}
        except Exception as e:  # pragma: no cover - defensive
            print(f"WARN could not parse {f.name}: {e}")
            continue
        model_id = f.stem
        details = meta.get("model_details") or {}
        out[model_id] = {
            "model_id": model_id,
            "team_name": meta.get("team_name", ""),
            "team_abbr": meta.get("team_abbr", model_id.split("-")[0]),
            "model_name": meta.get("model_name", model_id),
            "model_abbr": meta.get("model_abbr", "-".join(model_id.split("-")[1:])),
            "methods": details.get("methods", ""),
            "data_inputs": details.get("data_inputs", ""),
            "website_url": meta.get("website_url", ""),
            "repo_url": meta.get("repo_url", ""),
            "license": meta.get("license", ""),
            "ensemble_of_hub_models": bool(meta.get("ensemble_of_hub_models", False)),
            "mock": False,
        }
    return out


FILE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-(.+)\.(csv|parquet)$")


def list_model_output_files(hub: Path) -> list[tuple[str, str, Path]]:
    """Return (model_id, reference_date, path) for every model-output file."""
    out = []
    for d in sorted((hub / "model-output").iterdir()):
        if not d.is_dir():
            continue
        for f in sorted(d.iterdir()):
            m = FILE_RE.match(f.name)
            if m and m.group(2) == d.name:
                out.append((d.name, m.group(1), f))
    return out


def read_sample_submission(path: Path) -> pd.DataFrame | None:
    """Read a model-output file and keep only round-2 sample rows. Returns None if none."""
    if path.suffix == ".parquet":
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path, dtype=str, keep_default_na=False)
    needed = {"reference_date", "target", "target_end_date", "location", "output_type",
              "output_type_id", "value"}
    if not needed.issubset(df.columns):
        return None
    df = df[(df["target"] == config.TARGET) & (df["output_type"] == "sample")].copy()
    if df.empty:
        return None
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df["reference_date"] = df["reference_date"].astype(str)
    df["target_end_date"] = df["target_end_date"].astype(str)
    df["location"] = df["location"].astype(str)
    df["output_type_id"] = df["output_type_id"].astype(str)
    return df
