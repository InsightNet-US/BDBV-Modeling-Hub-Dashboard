# BDBV Modeling Hub Dashboard

Interactive dashboard for the [BDBV Modeling Hub](https://github.com/InsightNet-US/BDBV-Modeling-Hub)
nowcasting and forecasting round: weekly confirmed Bundibugyo virus disease cases by week of symptom
onset in the 26 provinces of the Democratic Republic of the Congo.

The site is static (vanilla HTML/JS/SVG + Leaflet, no build step). A Python pipeline turns hub files into
small JSON summaries under `data/`, and a GitHub Action rebuilds and deploys to GitHub Pages daily.

## What it shows

- **Weekly confirmed cases** for the selected location: reported counts in the target-data version used
  for the selected round, the latest release overlaid when it differs (backfill), the ensemble's nowcast
  and forecast medians (dotted bars, optional 95% interval) and selected team models (points + 95%
  intervals). The week shown on the map is highlighted; clicking a week column maps that week.
- **Cumulative confirmed cases**: reported to date, each model's nowcast of the eventual total through the
  reference date, and forecast cumulative totals through weeks 0 (the reference week) to +3.
- **Map** at province or health-zone level, coloured by a model's median cases in a chosen week, or by
  P(at least one case) in that week. The week control (arrows, or click the date to pick) steps through
  every week with model output in the round, labelled with the date and its offset from the
  projections-from date: nowcast weeks (-1 wk and earlier) and forecast weeks 0 (the reference week) to
  +3. Clicking a province or zone selects it; selecting a zone switches the map to the zone layer and
  zooms to its province. Zones without output from the chosen model are dashed.
- **Locations** follow the hub's hierarchy: country `CD`, provinces `CD-XX`, health zones `CD-XX-NN`
  (548 locations in `auxiliary-data/locations.csv`). The header has a country/province selector and,
  for a province, a zone selector. Every panel works at any level; models that did not submit a location
  are greyed out in the model menus. With an ensemble (the hub's, or the one the dashboard computes, see
  [Ensemble](#ensemble)) the panels start on the ensemble alone; without one every model is selected and
  the map starts on the model covering the most locations.
- **"Projections from" control** (arrows, or click the date) to move between rounds, by the week the
  projections were made (reference date). Each round is paired with the latest target-data release on or before the Tuesday
  closing its submission window (`reference_date - 4 days`); the data version used is always labelled.

## Live and mock dashboards

The Action builds the site twice from the same hub checkout:

- **Live** (site root): real submissions only (`MOCK_MODE=off`); its `data/` is committed to this repo. Until
  the hub receives submissions (first accepted reference date 2026-10-31) it shows reported cases with a
  "no submissions yet" note.
- **Mock** (`/mock/`): **synthetic model output** generated in hub format from the real target data, for
  development and demonstrations. It is marked with a header badge, an orange banner, a dense "SYNTHETIC"
  watermark on every panel and the map, and a note in every tooltip, and a test phrase is asked for once per
  browser (repository variable `MOCK_PASSPHRASE`, default `testme`; its SHA-256 is in the mock manifest).
  The gate only keeps people from stumbling onto synthetic output: a static site has no secrets. The mock
  build is not committed; it is assembled into the Pages artifact by `scripts/assemble-site.sh`.

The synthetic teams submit the country and all provinces; two of the three also submit health zones in
every province with at least 10 reported cases, and the synthetic `hub-ensemble` pools whatever was
submitted for each location (so the mock copy exercises the hub-ensemble path; `ENSEMBLE_SOURCE=dashboard`
makes it compute its own instead). `manifest.json` records `mock: true/false`.

## Panel layout

Drag the gutter between the charts and the map, or between the two charts, to resize the panels
(double-click a gutter, or press Home/End on it, to reset that axis; arrow keys nudge it). Each panel
header has a × that hides it; the **Panels** menu in the toolbar lists the three
panels, resets the layout and copies a link that reproduces it (`?panels=weekly,cum,map` lists the panels
to show, `none` hides all; `?split=0.55` or `?split=0.55,0.7` sets the column share and the weekly
chart's share of the column). Sizes and hidden panels are remembered per browser; a layout given in the
URL only seeds the page and is not stored until the visitor changes something (unlike `?lang=`, which is
stored). Below 1000 px the panels stack and the gutters disappear, but hiding still works.

## Languages

The interface is in English and French (EN | FR switch in the toolbar, or a `?lang=fr` link); the choice
is remembered per browser. Strings live in `assets/i18n.js`; the terminology is documented in
`docs/fr/glossary.md` and every string with an example in `docs/fr/strings.md` (generated by
`node scripts/i18n-table.js`; `--check` fails when the two languages or the page and the dictionary
disagree, or when the table is stale). `I18N_LIVE` in `assets/app.js` enables the switch on the live site;
set it to `false` to confine French to the mock copy again. The basemap labels stay English in both
languages for now: a French-labelled basemap can be configured in `FR_TILES` in `assets/map.js` (CARTO
Positron needs a free API key registered for the site's domain). Hub location names and the teams' model
metadata are shown as provided and are not translated.

## Layout

```
index.html, assets/          dashboard
data/                        generated by the pipeline (committed by the Action)
  manifest.json              rounds (each with its ensemble id and source), locations, data versions, provenance
  models.json                model metadata from the hub's model-metadata/*.yml
  observed/<as_of>.json      weekly reported cases per location (country, provinces, zones) per release
  rounds/<reference_date>.json  per model x location: weekly quantiles and P(>=1), horizon sums, cumulative;
                             the dashboard ensemble also lists its members and models per week
  geo/                       simplified boundaries (one-off, see below) stamped with hub codes at build
                             time, province outlines dissolved from the zone polygons (hz-provinces.json),
                             and health-zone name aliases (HDX spelling -> hub spelling)
pipeline/                    Python pipeline (build.py, summarize.py, mock.py, geo.py, tests/)
scripts/assemble-site.sh     stages the Pages artifact: live site at the root, mock copy under mock/
scripts/i18n-table.js        regenerates docs/fr/strings.md from assets/i18n.js (--check for CI-style validation)
docs/fr/                     French glossary, string table and EN/FR screenshots for the translation review
.github/workflows/           daily build + Pages deploy
```

## Running locally

```sh
python3.12 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
git clone --depth 1 https://github.com/InsightNet-US/BDBV-Modeling-Hub.git hub
MOCK_MODE=on .venv/bin/python pipeline/build.py       # synthetic output into data/ (or HUB_DIR=/path/to/hub ...)
.venv/bin/python -m http.server 8000                   # open http://localhost:8000/ (the gate asks for "testme")
.venv/bin/python -m pytest pipeline/tests
```

To reproduce the deployed layout (live at `/`, mock at `/mock/`):

```sh
MOCK_MODE=off .venv/bin/python pipeline/build.py
MOCK_MODE=on DATA_DIR=/tmp/mock/data .venv/bin/python pipeline/build.py
scripts/assemble-site.sh /tmp/site /tmp/mock/data && (cd /tmp/site && python3 -m http.server 8000)
```

Environment variables: `HUB_DIR` (hub checkout; defaults to `./hub` or `~/Development/BDBV-Modeling-Hub`),
`MOCK_MODE` (`on`/`off`, default `off`), `DATA_DIR` (output folder, default `data/`; the committed boundary
files are copied in when it differs), `MOCK_PASSPHRASE` (mock gate, default `testme`), `ENSEMBLE_SOURCE`
(`hub`, `auto` or `dashboard`, default `auto`; see [Ensemble](#ensemble)), `ENSEMBLE_MODEL_ID` (the hub's
ensemble model; optional, otherwise the single model with `ensemble_of_hub_models: true`),
`ENSEMBLE_MIN_MODELS` (default 2) and `ENSEMBLE_EXCLUDE` (comma-separated model ids never pooled).

## Pipeline notes

- Only round-2 files are used: target `wk inc confirmed cases`, `output_type == sample`. Files failing the
  model-output README rules (100 samples per location, Saturdays, shared week sets) are reported but still
  summarised.
- Summaries per model x location: quantiles 0.025/0.1/0.25/0.5/0.75/0.9/0.975 per week; quantiles of the
  per-trajectory sum over forecast windows from week 0 (the reference week, not yet finished at submission) through +h, h = 0..3; share of trajectories with at least one case in each window;
  nowcast cumulative through the last closed week (filling closed weeks the model did not submit with the
  round's reported counts) and forecast cumulative through weeks 0..+3 (which must be submitted). Samples are never summed across provinces (they are joint only across weeks).
- National view: reported provincial counts summed; model output appears only if the hub adds a national
  location (`CD`) to `tasks.json`.

### Ensemble

The ensemble shown in blue is either the hub's own ensemble submission or one the pipeline computes,
decided per round by `ENSEMBLE_SOURCE`:

- `hub`: the hub's ensemble model (`ENSEMBLE_MODEL_ID`, or the single model flagged
  `ensemble_of_hub_models` in `model-metadata/`) when it submitted the round; otherwise the round has no
  ensemble.
- `dashboard`: the pipeline's `BDBV-dashboard-ensemble`; a hub ensemble, if any, is listed as an ordinary
  model and never pooled.
- `auto` (default): the hub's ensemble when it submitted the round, the dashboard ensemble otherwise. A
  round keeps its dashboard ensemble when later rounds get a hub one.

The dashboard ensemble is a linear pool in the sense of `hubEnsemble::linear_pool` on sample output: for
each location, every trajectory of every model that submitted it is kept, with equal weight per model
(100 samples each; unequal counts are pooled with a warning and then weigh models by their sample count).
Models cover different week sets, so the pool is built on the union of weeks with a per-trajectory
presence mask: weekly quantiles and P(>=1 case) use the trajectories of the models that submitted that
week (the count is stored as `n_models_wk` and shown in the chart tooltip), while the nowcast cumulative
and the forecast windows are computed trajectory by trajectory, as for a single model, each trajectory
filling the closed weeks its own model did not submit with the round's reported counts, and a trajectory
dropping out of a forecast window its model does not cover entirely. Only then are quantiles taken over
the pool. Locations with fewer than `ENSEMBLE_MIN_MODELS` (2) members get no ensemble entry. The computed
model counts as a model in the round (`n_models`, the header "n models") and is described in the Models
drawer with its member list; its metadata entry carries `computed_by: "dashboard"`. Setting the repository
variable `ENSEMBLE_SOURCE` to `hub` turns it off without a code change.

## Boundaries (one-off)

`pipeline/geo.py` downloads and simplifies (mapshaper via `npx`) the province boundaries from
[geoBoundaries](https://www.geoboundaries.org/) (COD ADM1, ODbL; `shapeISO` matches the hub codes) and the
health-zone boundaries from [DSNIS via HDX](https://data.humdata.org/dataset/drc-health-data) (519 zones,
2022, ODbL). Health zones are matched to the hub's `locations.csv` names by normalised name within province
plus `data/geo/hz-aliases.csv`. Rerun with `.venv/bin/pip install -r pipeline/requirements-geo.txt &&
.venv/bin/python pipeline/geo.py`; the outputs in `data/geo/` are committed.

## Design

Follows the motifs of the Insight Net interface prototype (light theme, reported/nowcast/forecast bar
grammar, boxplot cumulative panel, choropleth with model selector). Team colours use one ColorBrewer
Paired pair per team, as in the hub's own plotting scripts; blue is reserved for reported data and the
ensemble (hub or dashboard).

## Partners

The hub is a joint effort of the DRC's [Institut National de Santé Publique](https://insp.cd/) (INSP), the
[Kinshasa School of Public Health](https://espkinshasa.net/) and [Insight Net](https://insightnet.us/) centers
([ACCIDDA](https://accidda.org/) and [epiENGAGE](https://epiengage.org/)), built on the
[hubverse](https://hubverse.io/). The KSPH mark combines the school's shield (`esp-shield.png`: the greyscale rendering on the Bailey Lab site, coloured from the smaller colour copy on the PREACTS partner page) with the lettering cut from the school's own logo (kept as `esp-kinshasa.png`, lettering alone as `ksph-letters.png`); the UNIKIN crest and white ACCIDDA wordmark also stay in `assets/brand/`, unused. Their marks in `assets/brand/` are shown in the footer; they remain the
property of their owners and are used here to identify the hub's partners.
