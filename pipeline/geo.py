"""One-off geo build: province and health-zone boundaries -> data/geo/*.json (committed).

Sources
- Provinces: geoBoundaries gbOpen COD ADM1 (ODbL). shapeISO (CD-XX) matches the hub's 2-letter codes.
- Health zones: HDX "DRC Health Zone and Health Area boundaries" (DSNIS, ODbL), 519 zones, 2022.

Simplification uses mapshaper (topology preserving) via npx. Run:
    .venv/bin/python pipeline/geo.py            # expects downloads in pipeline/geo-src (see README)
"""
from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
import unicodedata
import zipfile
from pathlib import Path

import config
import hub_io

SRC = config.ROOT / "pipeline" / "geo-src"
OUT = config.DATA_DIR / "geo"
ALIASES = OUT / "hz-aliases.csv"
ADM1_URL = ("https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/COD/ADM1/"
            "geoBoundaries-COD-ADM1_simplified.geojson")
HZ_URL = ("https://data.humdata.org/dataset/cecb0d2f-331f-45be-a613-58aa506844f9/resource/"
          "32e9c52a-2be0-45a1-9372-33d0dab2c08a/download/rdc_zones-de-sante.zip")
MAPSHAPER = ["npx", "-y", "mapshaper@0.6.102"]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    s = s.lower().replace("-", " ").replace("'", " ").replace("’", " ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def download(url: str, dest: Path) -> None:
    if dest.exists():
        return
    import requests
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    dest.write_bytes(r.content)


def extract_hz_zip(zpath: Path, dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            ext = Path(info.filename).suffix.lower()
            if ext == ".xml":
                ext = ".xml"
            (dest / f"hz{ext}").write_bytes(z.read(info))
    return dest / "hz.shp"


def mapshaper(args: list[str]) -> None:
    subprocess.run(MAPSHAPER + args, check=True)


def build_provinces(tmp: Path) -> None:
    src = SRC / "cod_adm1.geojson"
    download(ADM1_URL, src)
    out = tmp / "adm1.geojson"
    mapshaper(["-i", str(src), "-simplify", "15%", "keep-shapes", "-filter-fields", "shapeName,shapeISO",
               "-o", "precision=0.0005", "format=geojson", str(out)])
    gj = json.loads(out.read_text())
    hub = config.hub_dir()
    locs = hub_io.read_locations(hub)
    prov = {r["location"]: r["location_name"] for _, r in locs[locs["location_type"] == "province"].iterrows()}
    seen = set()
    for f in gj["features"]:
        code = (f["properties"].get("shapeISO") or "").replace("CD-", "")
        if code not in prov:
            raise RuntimeError(f"province code {code!r} ({f['properties']}) not in hub locations")
        f["properties"] = {"location": code, "name": prov[code]}
        seen.add(code)
    missing = set(prov) - seen
    if missing:
        raise RuntimeError(f"provinces missing from boundaries: {missing}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "provinces.json").write_text(json.dumps(gj, separators=(",", ":")))
    print(f"provinces: {len(gj['features'])}/26 mapped, {(OUT / 'provinces.json').stat().st_size // 1024} KB")


def load_aliases() -> dict[str, tuple[str, str]]:
    """HDX (norm name, norm province) -> hub (name, parent)."""
    out = {}
    if ALIASES.exists():
        with ALIASES.open() as fh:
            for r in csv.DictReader(fh):
                if r.get("hdx_name"):
                    out[(norm(r["hdx_name"]), norm(r.get("hdx_province", "")))] = (r["hub_name"], r["hub_parent"])
    return out


def build_health_zones(tmp: Path) -> None:
    zpath = SRC / "rdc_zones-de-sante.zip"
    download(HZ_URL, zpath)
    shp = extract_hz_zip(zpath, SRC / "hz")
    out = tmp / "hz.geojson"
    mapshaper(["-i", str(shp), "encoding=utf8", "-simplify", "4%", "keep-shapes",
               "-filter-fields", "Nom,PROVINCE,Pcode,Code_DHIS2",
               "-o", "precision=0.001", "format=geojson", str(out)])
    gj = json.loads(out.read_text())
    hub = config.hub_dir()
    locs = hub_io.read_locations(hub)
    hz = locs[locs["location_type"] == "health zone"]
    by_name_parent = {(norm(r["location_name"]), norm(r["parent"])): (r["location_name"], r["parent"])
                      for _, r in hz.iterrows()}
    by_name: dict[str, list[tuple[str, str]]] = {}
    for _, r in hz.iterrows():
        by_name.setdefault(norm(r["location_name"]), []).append((r["location_name"], r["parent"]))
    aliases = load_aliases()
    matched, unmatched, used = 0, [], set()
    for f in gj["features"]:
        p = f["properties"]
        nn, np_ = norm(p.get("Nom")), norm(p.get("PROVINCE"))
        hit = aliases.get((nn, np_)) or aliases.get((nn, "")) or by_name_parent.get((nn, np_))
        if not hit:
            cands = by_name.get(nn, [])
            if len(cands) == 1:
                hit = cands[0]
            elif len(cands) > 1:
                # same name in several provinces: prefer the one whose parent matches loosely
                loose = [c for c in cands if norm(c[1]) in np_ or np_ in norm(c[1])]
                hit = loose[0] if len(loose) == 1 else None
        if hit:
            matched += 1
            used.add(hit)
            f["properties"] = {"name": hit[0], "parent": hit[1], "hdx_name": p.get("Nom"),
                               "hdx_province": p.get("PROVINCE"), "pcode": p.get("Pcode"), "matched": True}
        else:
            unmatched.append((p.get("Nom"), p.get("PROVINCE")))
            f["properties"] = {"name": p.get("Nom"), "parent": p.get("PROVINCE"), "hdx_name": p.get("Nom"),
                               "hdx_province": p.get("PROVINCE"), "pcode": p.get("Pcode"), "matched": False}
    (OUT / "health-zones.json").write_text(json.dumps(gj, separators=(",", ":")))
    hub_unused = sorted(set(zip(hz["location_name"], hz["parent"])) - used)
    print(f"health zones: {matched}/{len(gj['features'])} HDX polygons matched to hub names; "
          f"{len(hub_unused)} hub zones without a polygon; "
          f"{(OUT / 'health-zones.json').stat().st_size // 1024} KB")
    if unmatched:
        print("UNMATCHED HDX polygons (add rows to data/geo/hz-aliases.csv):")
        for n, pr in unmatched:
            print(f"  {n!r} ({pr})")
    if hub_unused:
        print("hub health zones with no polygon:", hub_unused[:60])


def main() -> int:
    tmp = config.ROOT / "pipeline" / "geo-src" / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "provinces"):
        build_provinces(tmp)
    if which in ("all", "hz"):
        build_health_zones(tmp)
    return 0


if __name__ == "__main__":
    sys.exit(main())
