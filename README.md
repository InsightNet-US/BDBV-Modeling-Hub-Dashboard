# BDBV Modeling Hub Dashboard

Interactive dashboard for the [BDBV Modeling Hub](https://github.com/InsightNet-US/BDBV-Modeling-Hub)
nowcasting and forecasting round: weekly confirmed Bundibugyo virus disease cases by week of symptom
onset in the 26 provinces of the Democratic Republic of the Congo.

The site is static (vanilla HTML/JS/SVG + Leaflet, no build step). A Python pipeline turns hub files into
small JSON summaries under `data/`, and a GitHub Action rebuilds and deploys to GitHub Pages daily.

## What it shows

- **Models** (one menu in the toolbar) chooses the models every panel shows: tick the ensemble and any team
  models, and the weekly chart, Trend, Cumulative and the map all use the same set. The weekly chart always
  draws the ensemble median; ticking the ensemble adds its intervals there and puts it in the other panels.
  A **Models ribbon** above the footer, always shown whatever panels are open, lists every model of the
  round with its colour: unticked models are greyed, a ticked model without output for the selected
  location is in italics. Click a model there to tick or untick it, double-click to put it on the map
  (keys: Space ticks/unticks, Enter maps); the hover text says so. It wraps to more lines when needed and sticks to the bottom of
  the window on narrow screens.
  The map shows one of the ticked models: pick it in the map's model selector (ticked models only), double-click
  it in the ribbon, or click a model name in the Trend tab or a box in the Cumulative tab; the mapped
  model is bold with a pin in the ribbon. By default the map shows the ensemble when ticked, otherwise the
  ticked model covering the most locations. Ticks carry over between rounds (a model missing from a round
  is simply not shown there) and are remembered per browser and in copied links. The menu ends with
  "About the models…", the model descriptions.
- **Weekly confirmed cases** for the selected location: reported counts from the latest target-data release
  (when an older round is shown, the part known at round time is blue and cases reported since the round are
  stacked on top in a lighter blue; "week in progress" hatching follows the latest release), the ensemble's nowcast
  and forecast medians (dotted bars, optional 50% and 95% intervals: thick and thin whiskers) and selected
  team models (points + 50% and 95% intervals; their colours are in the Models ribbon, the chart's own legend
  keys the bars and the ensemble). The week shown on the map is highlighted; clicking a week column maps that week.
  A brush strip under the chart shows the whole outbreak faintly (current counts) with a band over the weeks that have model
  output; drag its window or handles to choose the weeks shown (default: the 24 weeks ending three weeks
  after the reference date), drag on empty strip for a new window, double-click to go back to the default.
- **Trend** (first tab of the lower-left panel, shown by default): for weeks 0 to +3, the chance that
  weekly confirmed cases fall (by more than 10%), stay within ±10% or rise (by more than 10%) compared
  with week −1, for the ensemble and the ticked team models. Each cell is a
  fan: a dot with three arrows, up (increase, orange), level (stable, grey) and down (decrease, teal),
  each arrow's width and shading growing with its probability; the percentages sit beside the arrows
  when there is room, and in the tooltip. The legend gives each class's threshold. The map's week is highlighted.
- **Cumulative confirmed cases** (second tab, same models): reported to date (latest release; for an older round a blue dot marks the
  total known at round time and a lighter bar the cases reported since), each model's nowcast of the eventual total through the
  reference date, and forecast cumulative totals through weeks 0 (the reference week) to +3; the ensemble's
  name carries how many models it pools for the location shown. The figures
  form a right-aligned column: median, then the 95% interval in parentheses (dropped when the panel is
  very narrow).
- **Map** at province or health-zone level, coloured by a model's median cases in a chosen week, or by
  P(at least one case) in that week. Cases use a continuous log scale from 0 to the largest median on the
  layer in ColorBrewer YlOrRd (pale yellow to dark red), close to the reds of the
  [INRB epidemic dashboard](https://inrb-umie.github.io/BDBV2026-Epidemic_Dashboard/); unlike there, 0 is
  the start of the scale rather than a separate grey. Countries outside the DRC are veiled in grey. The week control (arrows, or click the date to pick) steps through
  every week with model output in the round, labelled with the date and its offset from the
  projections-from date: nowcast weeks (-1 wk and earlier) and forecast weeks 0 (the reference week) to
  +3. Clicking a province or zone selects it; selecting a zone switches the map to the zone layer and
  zooms to its province. Zones without output from the chosen model are dashed.
- **Locations** follow the hub's hierarchy: country `CD`, provinces `CD-XX`, health zones `CD-XX-NN`
  (548 locations in `auxiliary-data/locations.csv`). The header has a country/province selector and,
  for a province, a zone selector. Every panel works at any level; models that did not submit a location
  are greyed out in the Models menu (they stay tickable for other locations). With an ensemble (the hub's,
  or the one the dashboard computes, see [Ensemble](#ensemble)) the panels start on the ensemble alone;
  without one every model is ticked and the map starts on the model covering the most locations. The
  selection goes back to this default whenever a new round is published.
- **"Projections from" control** (arrows, or click the date) to move between rounds, by the week the
  projections were made (reference date). Each round is paired with the latest target-data release on or before the Tuesday
  closing its submission window (`reference_date - 4 days`). Models are summarised against that version
  (nowcast cumulative fill, header "data as of"), while reported counts in the charts always come from the
  latest release; the weekly-chart legend names both dates when they differ (its subtitle is just the location).

## Live and preview copies

The Action always runs from `main` (the Pages environment deploys only the default branch) and stages
the site twice with `scripts/assemble-site.sh`:

- **Live** (site root): `main`'s code; its `data/` is built from the hub and committed back to this repo.
- **Preview** (`/preview/`): the `preview` branch's code with its own pipeline output from the same hub
  snapshot. It carries a "Preview" badge, a banner naming the branch commit it was built from and linking
  back to the live site, and asks for a test phrase once per browser (repository variable
  `PREVIEW_PASSPHRASE`, falling back to `MOCK_PASSPHRASE`, default `testme`; only its SHA-256 is written
  into the page). The gate just keeps people from stumbling onto unfinished work: a static site has no
  secrets. Pages caches HTML for about ten minutes, so a changed phrase or a preview push takes effect
  with a short delay (the `?v=` stamp keeps old HTML paired with its own assets meanwhile).

### Working with the preview branch

The flow is enforced by two repository rulesets and three small workflows:

- **Features go to `preview`.** Build a feature on a branch, verify it locally, then merge it into
  `preview` (merge commits are fine there; the branch has no rules beyond deletion protection). A push
  to `preview` runs `.github/workflows/preview-push.yml`, which dispatches the main workflow; testers see
  the change at `/preview/` minutes later. No feature flag is needed on the branch.
- **Releases are pull requests from `preview` into `main`, squash-merged.** The `main` ruleset allows
  no direct pushes, no force pushes, no deletion, squash merges only, and requires the status check
  `release-source` (`.github/workflows/release-check.yml`, `scripts/release-check.sh`): it passes only
  when the PR comes from `preview` and the live `/preview/` already shows that very commit built
  successfully, i.e. it was deployed and testers could look at it. The check polls for up to 20 minutes
  while the preview deploy is in flight; re-run it if it timed out. A preview that failed to build
  blocks the release until fixed.
- **The branch resets itself.** When a release PR is merged, `.github/workflows/reset-preview.yml`
  force-pushes `main` onto `preview`, so the two histories never drift, and `/preview/` is rebuilt as a
  copy of the new `main`.
- **The Action pushes with a deploy key.** The daily data commit and the reset use the write deploy key
  stored as the Actions secret `DEPLOY_KEY`; the key is a bypass actor of the `main` ruleset, so those
  pushes pass the pull-request-only rule. To rotate it, replace the deploy key and the secret together.
  Pushes made with the key are real push events, so the main workflow ignores anything under `data/`
  and its own "data: refresh from hub" commits to avoid re-triggering itself.
- **Emergencies.** Repository admins can bypass the rules only through a pull request: open the hotfix
  PR, let the check fail, and merge with "bypass rules". That is also how a broken `release-check.yml`
  gets fixed. Nobody can push to `main` directly.
- **Fail-soft preview:** the preview build (its tests and pipeline) never blocks the live site. If the
  branch fails to build, `/preview/` is staged from `main` and its banner says so, with a link to the
  Actions run; the Action opens an issue labelled `preview-build` (or comments on the open one on later
  runs) and closes it automatically once the branch builds again (`scripts/preview-alert.sh`). The
  record of each build is `preview/status.json` next to the page.
- Anything a preview feature persists (localStorage keys, extra layout fields, URL parameters) must be
  ignored harmlessly by the live code, because browser storage is shared between `/` and `/preview/`;
  strings exist in both languages (`node scripts/i18n-table.js --check` scans the whole page).
- The older in-code mechanism is still available for a partial reveal on `main`: JavaScript may check
  `S.preview` and markup may carry a `data-preview` attribute (hidden unless `body.preview`), and
  `?preview=1` on the live root switches that flag on for one page load (not stored, dropped from copied
  layout links). It reveals only such pieces present on `main`, not the branch.
- If a Dependabot configuration is ever added, its `target-branch` must be `preview`; PRs against
  `main` from any other branch are blocked by design.

Currently on the preview branch: the Trend tab (issue #2): the chance of a decrease, no change or an
increase over weeks 0 to +3, in a tab beside the cumulative panel. Synthetic ("mock") model output was removed
on 2026-11-05 once real submissions had been flowing for weeks; the generator (`pipeline/mock.py`) is in
the git history up to commit `24d9cd5`.

## Panel layout

Drag the gutter between the charts and the map, or between the two charts, to resize the panels
(double-click a gutter, or press Home/End on it, to reset that axis; arrow keys nudge it). Each panel
header has a × that hides it; the **Panels** menu in the toolbar lists the three
panels, resets the layout and copies a link that reproduces it (`?panels=weekly,cum,map` lists the panels
to show, `none` hides all, `cum` being the lower-left Trend / cumulative panel; `?split=0.55` or
`?split=0.55,0.7` sets the column share and the weekly chart's share of the column; `?tab=trend` or
`?tab=cum` picks the lower-left tab, which is remembered with the layout and set back to Trend by Reset
layout; `?models=ensemble,TEAM-model` (or `none`) gives the ticked models, `ensemble` standing for the
round's ensemble, and `?mapmodel=` the model on the map; Reset layout also returns the models to the
defaults). Sizes, hidden panels and ticked models are remembered per browser (the models under their own
key, `bdbv-models`, together with the newest round at the time, so a new round starts from the default
again; a linked selection is kept as linked); a layout given in the
URL only seeds the page and is not stored until the visitor changes something (unlike `?lang=`, which is
stored); once the visitor does change something, the layout parameters are dropped from the address bar so
a reload shows the stored layout. The weekly chart's week window travels with the layout:
`?weeks=2026-07-04,2026-11-21` (ISO Saturdays, or the sentinels `first` / `last` for a side that should
follow the data as weeks are added; `weeks=first,last` shows the whole outbreak). Reset layout clears it
too. The live and preview copies share the browser storage, so a window chosen on one applies to the other
(anything outside the available weeks is clamped). Below
1000 px the panels stack and the gutters disappear, but hiding and the brush still work.

## Languages

The interface is in English and French (EN | FR switch in the toolbar, or a `?lang=fr` link); the choice
is remembered per browser. Strings live in `assets/i18n.js`; the terminology is documented in
`docs/fr/glossary.md` and every string with an example in `docs/fr/strings.md` (generated by
`node scripts/i18n-table.js`; `--check` fails when the two languages or the page and the dictionary
disagree, or when the table is stale). The basemap labels stay English in both
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
  rounds/<reference_date>.json  per model x location: weekly quantiles and P(>=1), horizon sums, cumulative,
                             trend probabilities;
                             the dashboard ensemble also lists its members and models per week
  geo/                       simplified GRID3 health-zone boundaries (one-off, see below) stamped with hub
                             codes at build time, province outlines dissolved from them (provinces.json,
                             hz-provinces.json), and health-zone name aliases (GRID3 spelling -> hub spelling)
pipeline/                    Python pipeline (build.py, summarize.py, hub_io.py, geo.py, tests/)
scripts/assemble-site.sh     stages the Pages artifact: live site at the root, gated preview copy under preview/
scripts/preview-alert.sh     opens, updates or closes the preview-build issue (run by the Action)
scripts/release-check.sh     gate of a pull request into main (from preview, commit live at /preview/)
scripts/i18n-table.js        regenerates docs/fr/strings.md from assets/i18n.js (--check for CI-style validation)
docs/fr/                     French glossary, string table and EN/FR screenshots for the translation review
.github/workflows/           daily build + Pages deploy (build-deploy.yml), the preview-branch trigger (preview-push.yml),
                             the release check (release-check.yml) and the post-release reset (reset-preview.yml)
```

## Running locally

```sh
python3.12 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
git clone --depth 1 https://github.com/InsightNet-US/BDBV-Modeling-Hub.git hub
.venv/bin/python pipeline/build.py                    # data/ from the hub checkout (or HUB_DIR=/path/to/hub ...)
.venv/bin/python -m http.server 8000                   # open http://localhost:8000/ (add ?preview=1 to see preview features)
.venv/bin/python -m pytest pipeline/tests
```

To reproduce the deployed layout (live at `/`, gated preview at `/preview/`, test phrase `testme`):

```sh
.venv/bin/python pipeline/build.py
scripts/assemble-site.sh /tmp/site && (cd /tmp/site && python3 -m http.server 8000)
# with a second checkout of the preview branch (its data/ built the same way) staged at /preview/:
scripts/assemble-site.sh /tmp/site local /path/to/preview-checkout
```

Environment variables: `HUB_DIR` (hub checkout; defaults to `./hub` or `~/Development/BDBV-Modeling-Hub`),
`DATA_DIR` (output folder, default `data/`; the committed boundary files are copied in when it differs),
`PREVIEW_PASSPHRASE` (read by the assembler, default `testme`), `ENSEMBLE_SOURCE`
(`hub`, `auto` or `dashboard`, default `auto`; see [Ensemble](#ensemble)), `ENSEMBLE_MODEL_ID` (the hub's
ensemble model; optional, otherwise the single model with `ensemble_of_hub_models: true`),
`ENSEMBLE_MIN_MODELS` (default 2) and `ENSEMBLE_EXCLUDE` (comma-separated model ids never pooled).

## Pipeline notes

- Only round-2 files are used: target `wk inc confirmed cases`, `output_type == sample`. Files failing the
  model-output README rules (100 samples per location, Saturdays, shared week sets) are reported but still
  summarised.
- Models whose hub metadata sets `designated_model: false` (the hub's convention for models that are
  neither shown publicly nor pooled, such as its `BDBVHub-baseline`) are skipped entirely: not displayed,
  not listed and never a member of the dashboard ensemble. A missing field means designated. Skipped
  models are reported as `NOTE` lines in the build log.
- Resubmissions: the hub's `forecast_date` column (the date a model was run; a team resubmits by appending
  a complete new forecast with a later date to the same file) is honoured by keeping only the latest
  forecast date per location. Dropped earlier forecasts are reported as `NOTE` lines in the build log.
- Summaries per model x location: quantiles 0.025/0.1/0.25/0.5/0.75/0.9/0.975 per week; quantiles of the
  per-trajectory sum over forecast windows from week 0 (the reference week, not yet finished at submission) through +h, h = 0..3; share of trajectories with at least one case in each window;
  nowcast cumulative through the last closed week (filling closed weeks the model did not submit with the
  round's reported counts) and forecast cumulative through weeks 0..+3 (which must be submitted). Samples are never summed across provinces (they are joint only across weeks).
- Trend (`trend`: per horizon h = 0..3, `[P(decrease), P(stable), P(increase)]`): each trajectory's
  week R+h value is compared with the same trajectory's week R−7 value (its own nowcast of the last
  closed week; the reported count for that week is still far from complete at round time): increase
  above 1.1 × baseline, decrease below 0.9 × baseline (`TREND_THRESHOLD` = 0.10 in `pipeline/config.py`),
  stable otherwise; a zero baseline counts as stable when the week is also 0 and as an increase
  otherwise. No case minimum, so in places with very few cases a change of one case is a trend. A
  trajectory counts for horizon h only when its model submitted both weeks; a model without week R−7
  gets `null`. The dashboard ensemble pools the trajectories of its members, each against its own
  baseline.
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
model is listed among the round's models (`n_models` in the manifest includes it) and is described in the Models drawer with its member list; its metadata entry carries `computed_by: "dashboard"`. Setting the repository
variable `ENSEMBLE_SOURCE` to `hub` turns it off without a code change.

## Boundaries (one-off)

The map uses the DRC Ministry of Health's 519 health zones from
[GRID3 COD Health Zones v8.0](https://data.grid3.org/datasets/GRID3::grid3-cod-health-zones-v8-0)
(CIESIN / GRID3; free to use with attribution), the boundaries of the
[INRB epidemic dashboard](https://inrb-umie.github.io/BDBV2026-Epidemic_Dashboard/) and of the INSP and WHO
situation reports, so the two maps match zone for zone. `pipeline/geo.py` downloads the copy in
[INRB-UMIE/BDBV2026-Data](https://github.com/INRB-UMIE/BDBV2026-Data/tree/main/data/shapefiles) at a pinned
commit (checked by SHA256) into the git-ignored `pipeline/geo-src/`, and simplifies it with mapshaper (via
`npx`), lightly for zones under 300 km² (the urban zones of Kinshasa or Lubumbashi are a few km²) and more
for rural ones. Zones are matched to hub codes by DHIS2 id (`ZSCode` against `Code_DHIS2` in the hub's
`auxiliary-data/health-zone-code-mapping.csv`; ids that are missing or shared by two zones are skipped), then
by normalised name within province plus `data/geo/hz-aliases.csv`; the build fails unless all 519 hub zones
get a polygon. Province outlines are dissolved from the zones by GRID3's own province, so province and zone
borders coincide. Manika (`CD-HK-19`), a Kolwezi zone, sits in Lualaba as in GRID3, INRB and the INSP (the
hub moved it from Haut Katanga on 2026-11-08; the code is unchanged). Rerun with `.venv/bin/pip install -r pipeline/requirements-geo.txt &&
.venv/bin/python pipeline/geo.py`; the outputs in `data/geo/` are committed. Until 2026-11-08 the zones came
from DSNIS via HDX (2022) and the provinces from geoBoundaries; those shapes differed noticeably from INRB's.

## Design

Follows the motifs of the Insight Net interface prototype (light theme, reported/nowcast/forecast bar
grammar, boxplot cumulative panel, choropleth showing one of the ticked models). Team colours use one ColorBrewer
Paired pair per team, as in the hub's own plotting scripts; blue is reserved for reported data and the
ensemble (hub or dashboard).

## Partners

The hub is a joint effort of the DRC's [Institut National de Santé Publique](https://insp.cd/) (INSP), the
[Kinshasa School of Public Health](https://espkinshasa.net/), the
[Agence Nationale d'Ingénierie Clinique et du Numérique de la Santé](https://anicns.gouv.cd/) (ANICNS) and
[Insight Net](https://insightnet.us/) centers
([ACCIDDA](https://accidda.org/) and [epiENGAGE](https://epiengage.org/)), built on the
[hubverse](https://hubverse.io/). The KSPH mark combines the school's shield (`esp-shield.png`: the greyscale rendering on the Bailey Lab site, coloured from the smaller colour copy on the PREACTS partner page) with the lettering cut from the school's own logo (kept as `esp-kinshasa.png`, lettering alone as `ksph-letters.png`); the ANICNS mark is the agency's own site logo (`anicns.png`, only a 150 x 80 raster is published, trimmed of its transparent margins); the UNIKIN crest and white ACCIDDA wordmark also stay in `assets/brand/`, unused. Their marks in `assets/brand/` are shown in the footer; they remain the
property of their owners and are used here to identify the hub's partners.
