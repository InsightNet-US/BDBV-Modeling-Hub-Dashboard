/* Leaflet choropleth at province or health-zone level: a model's median cases in the mapped week,
   or its probability of at least one case in that week. The zone boundaries (~1.4 MB) load on first
   use. Province outlines stay on top of the zone layer for orientation. */
let map, provLayer, hzLayer, provOutline, mapFitted = false;

function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([0.5, 28.5], 6);
  map.attributionControl.setPrefix('');
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 12, attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors' }).addTo(map);
  provLayer = L.geoJSON(S.geoProv, { style: f => featStyle(f, 'prov'), onEachFeature: (f, l) => onFeat(f, l, 'prov') }).addTo(map);
}
/* zone polygons plus province outlines dissolved from them (so the borders coincide exactly) */
async function ensureHZ() {
  if (hzLayer) return;
  const [hz, outline] = await Promise.all([getJSON('data/geo/health-zones.json'), getJSON('data/geo/hz-provinces.json')]);
  S.geoHZ = hz;
  hzLayer = L.geoJSON(hz, { style: f => featStyle(f, 'hz'), onEachFeature: (f, l) => onFeat(f, l, 'hz') });
  provOutline = L.geoJSON(outline, { style: { fill: false, color: '#1b2430', weight: 1.6, opacity: 0.75 }, interactive: false });
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
  const b = prov ? layerBounds(provLayer, f => f.properties.location === prov)
                 : layerBounds(provLayer, f => (locInfo(f.properties.location) || {}).total > 0);
  if (b) map.fitBounds(b, { padding: [10, 10] });
}
function onFeat(f, layer, level) {
  layer.on('mousemove', e => showTip(featTip(f, level), e.originalEvent.clientX, e.originalEvent.clientY));
  layer.on('mouseover', e => { if (f.properties.location) e.target.setStyle({ weight: 2.5, color: '#1b2430' }); });
  // restore the computed choropleth style (not Leaflet's resetStyle, which would reapply the initial style)
  layer.on('mouseout', e => { hideTip(); e.target.setStyle(featStyle(f, level)); });
  layer.on('click', () => {
    const code = f.properties.location; if (!code) return;
    if (level === 'prov') selectLocation(code === S.location ? NATIONAL : code);
    else selectLocation(code === S.location ? locProvince(code) : code);
  });
}

/* label for the mapped week: "week ending 7 Nov (forecast +1 wk)" */
const wkLabel = () => S.mapWeek ? `week ending ${fmtDate(S.mapWeek)} (${weekKind(S.mapWeek)})` : 'no week';

/* ---- values and styles ---- */
function locValue(code) {
  const m = S.mapModel && S.mapWeek && code ? modelLoc(S.mapModel, code) : null;
  if (!m) return null;
  const i = m.weeks.indexOf(S.mapWeek);
  if (i < 0) return null;
  return S.mapMetric === 'presence' ? m.presence_wk[i] : m.q[i][QI.med];
}
/** is this feature outside the current geographic focus (the selected province)? */
function dimmed(f, level) {
  const prov = locProvince(S.location), code = f.properties.location;
  if (!prov) return false;
  return level === 'prov' ? code !== prov : f.properties.parent !== prov;
}
let scale = { vmax: 1 };
function featStyle(f, level) {
  const code = f.properties.location, v = S.round ? locValue(code) : null;
  const dim = dimmed(f, level), selected = code && code === S.location;
  const w = level === 'hz' ? 0.6 : 1;
  if (!code) return { color: '#9aa3ad', weight: 0.5, dashArray: '2 3', fillColor: '#eceff3', fillOpacity: 0.3 };
  if (v == null) return { color: '#6b7684', weight: selected ? 2.5 : w, dashArray: selected ? null : '3 3', fillColor: '#e6e9ee', fillOpacity: dim ? 0.1 : 0.5 };
  const fill = S.mapMetric === 'presence' ? colorForP(v) : colorFor(Math.log1p(v) / Math.log1p(scale.vmax));
  return { color: '#0b0f14', weight: selected ? 2.5 : w, dashArray: null, fillColor: fill, fillOpacity: dim ? 0.15 : 0.8 };
}
function featTip(f, level) {
  const code = f.properties.location;
  if (!code) return `<b>${f.properties.name}</b><div class="sm">zone not in the hub's location list</div>`;
  const obs = obsMap(S.obsRound, code);
  const upTo = S.roundRef || S.obsRound.last_complete_week;
  const recent = Object.keys(obs).filter(w => w <= upTo).sort().slice(-4).reduce((a, w) => a + obs[w], 0);
  const total = Object.keys(obs).filter(w => w <= upTo).reduce((a, w) => a + obs[w], 0);
  const m = S.mapModel && S.mapWeek ? modelLoc(S.mapModel, code) : null, i = m ? m.weeks.indexOf(S.mapWeek) : -1;
  let rows = '';
  if (m && i >= 0) {
    const q = m.q[i];
    rows += `<div class="row"><span>Median cases, ${wkLabel()}</span><b>${fmtN(q[QI.med])} <span class="sm">(${fmtRange(q)})</span></b></div>`;
    rows += `<div class="row"><span>P(≥1 case), same week</span><b>${Math.round(m.presence_wk[i] * 100)}%</b></div>`;
    if (obs[S.mapWeek] != null) rows += `<div class="row"><span>Reported so far, same week <span class="sm">(as of ${fmtDate(S.obsRound.as_of)})</span></span><b>${fmtN(obs[S.mapWeek])}</b></div>`;
  } else rows += `<div class="row"><span>${S.mapModel ? modelLabel(S.mapModel) : 'Model output'}</span><b>${m ? 'week not submitted' : 'no submission'}</b></div>`;
  rows += `<div class="row"><span>Reported, last 4 wk</span><b>${fmtN(recent)}</b></div><div class="row"><span>Reported to date</span><b>${fmtN(total)}</b></div>`;
  const ctx = level === 'hz' ? ` <span class="sm">· health zone, ${locName(f.properties.parent)}</span>` : ` <span class="sm">· ${code}</span>`;
  const act = code === S.location ? (level === 'hz' ? 'back to the province' : 'clear selection') : 'select';
  return `<b>${f.properties.name}</b>${ctx}${rows}<div class="sm" style="margin-top:4px">click to ${act}</div>${m && i >= 0 ? synNote() : ''}`;
}

function drawMap() {
  if (!map || !S.obsRound) return;
  const level = S.mapLayer, layer = level === 'hz' ? hzLayer : provLayer;
  if (!layer) return;
  // colour scale over the features in focus (whole country, or the selected province)
  const feats = []; layer.eachLayer(l => { if (l.feature.properties.location && !dimmed(l.feature, level)) feats.push(l.feature); });
  const vals = feats.map(f => S.round ? locValue(f.properties.location) : null).filter(v => v != null);
  scale = { vmax: S.mapMetric === 'presence' ? 1 : Math.max(1, ...vals) };
  layer.eachLayer(l => { l.setStyle(featStyle(l.feature, level)); if (l.feature.properties.location === S.location) l.bringToFront(); });
  if (level === 'hz' && map.hasLayer(provOutline)) provOutline.bringToFront();
  const missing = feats.length - vals.length, unit = level === 'hz' ? 'zone' : 'province';
  const where = locProvince(S.location) && level === 'hz' ? ` in ${locName(locProvince(S.location))}` : '';
  const mt = `${S.mapMetric === 'presence' ? 'P(≥1 case)' : 'Median cases'}, <span class="horizonval">${wkLabel()}</span>`;
  document.getElementById('mapSub').innerHTML = `${mt} · ${S.mapModel ? modelLabel(S.mapModel) : 'no model'}`
    + (S.manifest.mock && S.mapModel ? ' <b style="color:#9a5b00">(synthetic)</b>' : '')
    + (missing ? ` · ${missing} ${unit}${missing === 1 ? '' : 's'}${where} without output (dashed)` : '');
  document.getElementById('legLo').textContent = S.mapMetric === 'presence' ? '0%' : '0';
  document.getElementById('legHi').textContent = S.mapMetric === 'presence' ? '100%' : fmtN(scale.vmax);
  document.querySelector('.map .legend .bar').style.background = S.mapMetric === 'presence' ? P_GRADIENT : N_GRADIENT;
  if (!mapFitted) { fitProvince(null); mapFitted = true; }
}
