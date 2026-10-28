/* Leaflet choropleth at province or health-zone level: a model's median cases in the mapped week,
   or its probability of at least one case in that week. The zone boundaries (~1.4 MB) load on first
   use. Province outlines stay on top of the zone layer for orientation. The selected location is
   marked by a heavier border only; nothing else is dimmed. */
const SEL_W = { prov: 3.5, hz: 3 }, OUTLINE_W = 1.6;
let map, provLayer, hzLayer, provOutline, mapFitted = false;
let base = null, baseKind = null, zoomCtl = null, pendingFit;   // fit requested while the map panel was hidden
/* Basemaps: Esri light grey (English labels) by default. A French-labelled basemap can be set in FR_TILES
   (e.g. CARTO Positron, which needs a free API key tied to the site's domain:
   'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?api_key=…' with attribution
   '© OpenStreetMap contributors © CARTO'); until then French keeps the Esri tiles. Same maxZoom on both so
   zoom behaviour does not change with the language. */
const FR_TILES = null;   // { url, options } or null
const BASEMAPS = {
  en: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 12, attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors' }),
  fr: () => L.tileLayer(FR_TILES.url, Object.assign({ maxZoom: 12 }, FR_TILES.options || {})),
};
/** tile layer and zoom-control titles for a language; a no-op until the map exists */
function setBasemap(lang) {
  if (!map) return;
  const kind = lang === 'fr' && FR_TILES ? 'fr' : 'en';
  if (kind !== baseKind) { if (base) map.removeLayer(base); base = BASEMAPS[kind]().addTo(map); base.bringToBack(); baseKind = kind; }
  if (zoomCtl) map.removeControl(zoomCtl);
  zoomCtl = L.control.zoom({ zoomInTitle: t('map.zoomIn'), zoomOutTitle: t('map.zoomOut') }).addTo(map);
}

function initMap() {
  map = L.map('map', { zoomControl: false, attributionControl: true }).setView([0.5, 28.5], 6);
  map.attributionControl.setPrefix('');
  setBasemap(LANG);
  provLayer = L.geoJSON(S.geoProv, { style: f => featStyle(f, 'prov'), onEachFeature: (f, l) => onFeat(f, l, 'prov') }).addTo(map);
}
/* zone polygons plus province outlines dissolved from them (so the borders coincide exactly) */
async function ensureHZ() {
  if (hzLayer) return;
  const [hz, outline] = await Promise.all([getJSON('data/geo/health-zones.json'), getJSON('data/geo/hz-provinces.json')]);
  S.geoHZ = hz;
  hzLayer = L.geoJSON(hz, { style: f => featStyle(f, 'hz'), onEachFeature: (f, l) => onFeat(f, l, 'hz') });
  provOutline = L.geoJSON(outline, { style: f => outlineStyle(f), interactive: false });
}
/** switch the map level; optionally refocus on a province once the layer is ready */
function setLayer(layer, fitProv) {
  S.mapLayer = layer;
  setToggle('layerToggle', 'l', layer);
  const done = () => {
    if (layer === 'hz') {
      if (map.hasLayer(provLayer)) map.removeLayer(provLayer);
      if (!map.hasLayer(hzLayer)) hzLayer.addTo(map);
      if (!map.hasLayer(provOutline)) provOutline.addTo(map);
      provOutline.bringToFront();
    } else {
      if (hzLayer && map.hasLayer(hzLayer)) map.removeLayer(hzLayer);
      if (provOutline && map.hasLayer(provOutline)) map.removeLayer(provOutline);
      if (!map.hasLayer(provLayer)) provLayer.addTo(map);
    }
    if (fitProv) fitProvince(fitProv);
    sync();
  };
  if (layer === 'hz') ensureHZ().then(done).catch(e => { console.error(e); S.mapLayer = 'prov'; setToggle('layerToggle', 'l', 'prov'); });
  else done();
}
function layerBounds(layer, pred) {
  let b = null;
  // copy before extending: getBounds() returns the layer's cached bounds object, which must not be mutated
  layer.eachLayer(l => { if (pred(l.feature)) { const lb = l.getBounds(); b = b ? b.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast()); } });
  return b;
}
/** zoom to a province, or (null) to the provinces with reported cases */
function fitProvince(prov) {
  if (S.layout.hidden.has('map')) { pendingFit = { prov }; return; }   // a 0-size map cannot be fitted
  const b = prov ? layerBounds(provLayer, f => f.properties.location === prov)
                 : layerBounds(provLayer, f => (locInfo(f.properties.location) || {}).total > 0);
  if (b) map.fitBounds(b, { padding: [10, 10] });
}
function onFeat(f, layer, level) {
  layer.on('mousemove', e => showTip(featTip(f, level), e.originalEvent.clientX, e.originalEvent.clientY));
  layer.on('mouseover', e => { if (f.properties.location && f.properties.location !== S.location) e.target.setStyle({ weight: 2.5, color: '#1b2430' }); });
  // restore the computed choropleth style (not Leaflet's resetStyle, which would reapply the initial style)
  layer.on('mouseout', e => { hideTip(); e.target.setStyle(featStyle(f, level)); });
  layer.on('click', () => {
    const code = f.properties.location; if (!code) return;
    if (level === 'prov') selectLocation(code === S.location ? NATIONAL : code);
    else selectLocation(code === S.location ? locProvince(code) : code);
  });
}

function applyPendingFit() { if (pendingFit) { const p = pendingFit.prov; pendingFit = undefined; fitProvince(p); } }
/* label for the mapped week: "week ending 7 Nov (forecast +1 wk)" */
const wkLabel = () => S.mapWeek ? t('map.wkLabel', { d: fmtDate(S.mapWeek), kind: weekKind(S.mapWeek) }) : t('map.noWeek');

/* ---- values and styles ---- */
function locValue(code) {
  const m = S.mapModel && S.mapWeek && code ? modelLoc(S.mapModel, code) : null;
  if (!m) return null;
  const i = m.weeks.indexOf(S.mapWeek);
  if (i < 0) return null;
  return S.mapMetric === 'presence' ? m.presence_wk[i] : m.q[i][QI.med];
}
let scale = { vmax: 1 };
function featStyle(f, level) {
  const code = f.properties.location, v = S.round ? locValue(code) : null;
  const selected = code && code === S.location;
  const w = selected ? SEL_W[level] : level === 'hz' ? 0.6 : 1;
  if (!code) return { color: '#9aa3ad', weight: 0.5, dashArray: '2 3', fillColor: '#eceff3', fillOpacity: 0.3 };
  if (v == null) return { color: selected ? '#0b0f14' : '#6b7684', weight: w, dashArray: selected ? null : '3 3', fillColor: '#e6e9ee', fillOpacity: 0.5 };
  const fill = S.mapMetric === 'presence' ? colorForP(v) : colorFor(Math.log1p(v) / Math.log1p(scale.vmax));
  return { color: '#0b0f14', weight: w, dashArray: null, fillColor: fill, fillOpacity: 0.8 };
}
/* dissolved province outline on the zone layer: heavier for the province in focus */
function outlineStyle(f) {
  const sel = f.properties.location === locProvince(S.location) && !isZone(S.location);
  return { fill: false, color: sel ? '#0b0f14' : '#1b2430', weight: sel ? SEL_W.prov : OUTLINE_W, opacity: sel ? 1 : 0.75 };
}
function featTip(f, level) {
  const code = f.properties.location;
  if (!code) return `<b>${f.properties.name}</b><div class="sm">${t('map.tipNotInHub')}</div>`;
  const obs = obsMap(S.obsRound, code);
  const upTo = S.roundRef || S.obsRound.last_complete_week;
  const recent = Object.keys(obs).filter(w => w <= upTo).sort().slice(-4).reduce((a, w) => a + obs[w], 0);
  const total = Object.keys(obs).filter(w => w <= upTo).reduce((a, w) => a + obs[w], 0);
  const m = S.mapModel && S.mapWeek ? modelLoc(S.mapModel, code) : null, i = m ? m.weeks.indexOf(S.mapWeek) : -1;
  let rows = '';
  if (m && i >= 0) {
    const q = m.q[i];
    rows += `<div class="row"><span>${t('map.tipMedian', { wk: wkLabel() })}</span><b>${fmtN(q[QI.med])} <span class="sm">(${fmtRange(q)})</span></b></div>`;
    rows += `<div class="row"><span>${t('map.tipPresence')}</span><b>${fmtPct(m.presence_wk[i])}</b></div>`;
    if (obs[S.mapWeek] != null) rows += `<div class="row"><span>${t('map.tipReportedSame')} <span class="sm">${t('map.tipAsOf', { d: fmtDate(S.obsRound.as_of) })}</span></span><b>${fmtN(obs[S.mapWeek])}</b></div>`;
  } else rows += `<div class="row"><span>${S.mapModel ? modelLabel(S.mapModel) : t('map.tipOutput')}</span><b>${t(m ? 'map.tipWeekNotSub' : 'map.tipNoSub')}</b></div>`;
  rows += `<div class="row"><span>${t('map.tipLast4')}</span><b>${fmtN(recent)}</b></div><div class="row"><span>${t('map.tipToDate')}</span><b>${fmtN(total)}</b></div>`;
  const ctx = level === 'hz' ? ` <span class="sm">${t('map.ctxZone', { prov: locName(f.properties.parent) })}</span>` : ` <span class="sm">· ${code}</span>`;
  const act = t(code === S.location ? (level === 'hz' ? 'map.actBack' : 'map.actClear') : 'map.actSelect');
  return `<b>${f.properties.name}</b>${ctx}${rows}<div class="sm" style="margin-top:4px">${act}</div>${m && i >= 0 ? synNote() : ''}`;
}

function drawMap() {
  if (!map || !S.obsRound || S.layout.hidden.has('map')) return;
  const level = S.mapLayer, layer = level === 'hz' ? hzLayer : provLayer;
  if (!layer) return;
  // colour scale over every hub location on the active layer
  const feats = []; layer.eachLayer(l => { if (l.feature.properties.location) feats.push(l.feature); });
  const vals = feats.map(f => S.round ? locValue(f.properties.location) : null).filter(v => v != null);
  scale = { vmax: S.mapMetric === 'presence' ? 1 : Math.max(1, ...vals) };
  layer.eachLayer(l => { l.setStyle(featStyle(l.feature, level)); if (l.feature.properties.location === S.location) l.bringToFront(); });
  if (level === 'hz' && provOutline && map.hasLayer(provOutline)) {
    const sel = locProvince(S.location);
    provOutline.bringToFront();
    provOutline.eachLayer(l => { l.setStyle(outlineStyle(l.feature)); if (l.feature.properties.location === sel) l.bringToFront(); });
  }
  const missing = feats.length - vals.length;
  const mt = `${t(S.mapMetric === 'presence' ? 'map.subPresence' : 'map.subMedian')}, <span class="horizonval">${wkLabel()}</span>`;
  document.getElementById('mapSub').innerHTML = `${mt} · ${S.mapModel ? modelLabel(S.mapModel) : t('map.noModel')}`
    + (S.manifest.mock && S.mapModel ? ` <b style="color:#9a5b00">${t('map.synthetic')}</b>` : '')
    + (missing ? ` · ${tn(level === 'hz' ? 'map.missingZones' : 'map.missingProvinces', missing)}` : '');
  document.getElementById('legLo').textContent = S.mapMetric === 'presence' ? fmtPct(0) : '0';
  document.getElementById('legHi').textContent = S.mapMetric === 'presence' ? fmtPct(1) : fmtN(scale.vmax);
  document.querySelector('.map .legend .bar').style.background = S.mapMetric === 'presence' ? P_GRADIENT : N_GRADIENT;
  if (!mapFitted) { fitProvince(null); mapFitted = true; }
}
