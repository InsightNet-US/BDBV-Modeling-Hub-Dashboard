"""One-off geo build: health-zone boundaries and the province outlines dissolved from them -> data/geo/*.json
(committed).

Source: GRID3 COD Health Zones v8.0, the DRC Ministry of Health's 519 zones de sante (CIESIN / GRID3,
free to use with attribution), as used by the INRB epidemic dashboard: the copy in the INRB-UMIE
BDBV2026-Data repository at a pinned commit, checked by SHA256. Provinces are dissolved from the zones so
that province and zone borders coincide, as on that dashboard.

Simplification uses mapshaper (topology preserving) via npx. Run:
    .venv/bin/python pipeline/geo.py     # downloads into pipeline/geo-src (git-ignored)
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import config
import hub_io
from build import match_zones

SRC = config.ROOT / "pipeline" / "geo-src"
OUT = config.GEO_SRC
INRB_COMMIT = "c00b8843e6ebae8f0cd846bc43cb564a3893bfd9"
HZ_URL = ("https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/" + INRB_COMMIT
          + "/data/shapefiles/DRC_Health_zones.{ext}")
HZ_SHA256 = {
    "shp": "0804a0522c9e61255a32cdfb10ef2ba8463065cba91766e113c0f1c98d396901",
    "dbf": "016b9185b78c7783161f51c51bb9b71ff8a76d02beca9208fdeff9257d66e45b",
    "shx": "ed44573a7efde39e56c5e87a2092fb8243239b1b954040709ed1de77df701598",
    "prj": "a02a27b1d1982c8516d83398e85a3c8b1aef1713c13ef4d84d7bde17430c07c4",   # WGS 84, no reprojection
    "cpg": "3ad3031f5503a4404af825262ee8232cc04d4ea6683d42c5dd0a2f2a27ac9824",
}
# simplification by zone size: 700 m tolerance for rural zones, 15 m for zones under 300 km2 (urban zones
# in Kinshasa or Lubumbashi are only a few km2 and would lose their shape); coordinates kept to ~20 m.
# Every zone keeps an overlap (IoU) of at least 0.94 with the source; health-zones.json ~1.7 MB, ~410 KB gzipped
SIMPLIFY = "interval=this.area < 3e8 ? 15 : 700"
PRECISION = "precision=0.0002"
SLIVER = 1e-4   # square degrees (~1 km2): province parts and holes smaller than this are dropped (GRID3 has
                # detached bits of zones across province lines, e.g. pieces of Vangu inside Lualaba)
MAPSHAPER = ["npx", "-y", "mapshaper@0.6.102"]


def download_hz() -> Path:
    """The pinned shapefile in pipeline/geo-src/grid3, downloaded once and checked by SHA256."""
    import requests
    dest = SRC / "grid3"
    dest.mkdir(parents=True, exist_ok=True)
    for ext, want in HZ_SHA256.items():
        f = dest / f"DRC_Health_zones.{ext}"
        if not f.exists():
            r = requests.get(HZ_URL.format(ext=ext), timeout=600)
            r.raise_for_status()
            f.write_bytes(r.content)
        got = hashlib.sha256(f.read_bytes()).hexdigest()
        if got != want:
            raise RuntimeError(f"{f.name}: SHA256 {got} differs from the pinned {want}")
    return dest / "DRC_Health_zones.shp"


def mapshaper(args: list[str]) -> None:
    subprocess.run(MAPSHAPER + args, check=True)


def build_health_zones(tmp: Path) -> None:
    shp = download_hz()
    out = tmp / "hz.geojson"
    mapshaper(["-i", str(shp), "encoding=utf8", "-simplify", "variable", SIMPLIFY, "keep-shapes", "-clean", "gap-fill-area=2km2",
               "-filter-fields", "Nom,PROVINCE,ZSCode", "-o", PRECISION, "format=geojson", str(out)])
    gj = json.loads(out.read_text())
    hub = config.hub_dir()
    locs = hub_io.read_locations(hub)
    hz = locs[locs["location_type"] == "health zone"]
    used, unmatched = match_zones(gj["features"], locs, hub_io.read_hz_dhis2(hub))
    missing = sorted(set(hz["location"]) - used)
    if unmatched or missing:
        raise RuntimeError(f"health zones: polygons without a hub zone {unmatched} (add rows to "
                           f"data/geo/hz-aliases.csv); hub zones without a polygon {missing}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "health-zones.json").write_text(json.dumps(gj, separators=(",", ":"), ensure_ascii=False))
    print(f"health zones: {len(used)}/{len(gj['features'])} polygons matched to hub zones, "
          f"{(OUT / 'health-zones.json').stat().st_size // 1024} KB")


def build_provinces(tmp: Path) -> None:
    """Province outlines dissolved from the zones by their GRID3 province (src_province), so the outlines
    follow the map as INRB draws it: provinces.json (location, name) for the province layer and
    hz-provinces.json (location) for the outlines over the zone layer."""
    from shapely.geometry import mapping, shape
    from shapely.geometry.multipolygon import MultiPolygon
    from shapely.geometry.polygon import Polygon
    from build import norm
    locs = hub_io.read_locations(config.hub_dir())
    prov = locs[locs["location_type"] == "province"]
    names = dict(zip(prov["location"], prov["location_name"]))
    by_norm = {norm(n): c for c, n in names.items()}
    zones = json.loads((OUT / "health-zones.json").read_text())
    for f in zones["features"]:
        sp = f["properties"]["src_province"]
        if norm(sp) not in by_norm:
            raise RuntimeError(f"GRID3 province {sp!r} has no hub province")
        f["properties"] = {"location": by_norm[norm(sp)]}
    src = tmp / "zones-by-province.geojson"
    src.write_text(json.dumps(zones))
    out = tmp / "prov.geojson"
    mapshaper(["-i", str(src), "-dissolve", "location", "-o", PRECISION, "format=geojson", str(out)])
    gj = json.loads(out.read_text())
    for f in gj["features"]:
        g = shape(f["geometry"])
        parts = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
        keep = [q for q in parts if q.area >= SLIVER]
        n_holes = sum(len(q.interiors) for q in keep)
        keep = [Polygon(q.exterior, [h for h in q.interiors if Polygon(h).area >= SLIVER]) for q in keep]
        holes = sum(len(q.interiors) for q in keep)
        code = f["properties"]["location"]
        if len(keep) != len(parts) or len(keep) > 1 or n_holes:
            print(f"  {code}: {len(parts)} parts ({len(parts) - len(keep)} slivers dropped), "
                  f"{n_holes} holes ({n_holes - holes} filled)")
        f["geometry"] = mapping(keep[0] if len(keep) == 1 else MultiPolygon(keep))
    codes = {f["properties"]["location"] for f in gj["features"]}
    if codes != set(prov["location"]):
        raise RuntimeError(f"provinces: dissolved {sorted(codes)} != hub {sorted(prov['location'])}")
    hzp = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"location": f["properties"]["location"]}, "geometry": f["geometry"]}
        for f in gj["features"]]}
    for f in gj["features"]:
        f["properties"] = {"location": f["properties"]["location"], "name": names[f["properties"]["location"]]}
    (OUT / "provinces.json").write_text(json.dumps(gj, separators=(",", ":"), ensure_ascii=False))
    (OUT / "hz-provinces.json").write_text(json.dumps(hzp, separators=(",", ":"), ensure_ascii=False))
    print(f"provinces: {len(gj['features'])} dissolved outlines, {(OUT / 'provinces.json').stat().st_size // 1024} KB")


def main() -> int:
    tmp = SRC / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    build_health_zones(tmp)
    build_provinces(tmp)
    return 0


if __name__ == "__main__":
    sys.exit(main())
