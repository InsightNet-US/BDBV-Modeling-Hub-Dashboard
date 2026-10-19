/* Leaflet choropleth of the 26 provinces: a model's median cases in the mapped week, or its
   probability of at least one case in that week. */
let map, provLayer, mapFitted = false;
const AFFECTED = ['IT', 'NK', 'HU', 'TO', 'BU', 'SK'];

function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([0.5, 28.5], 6);
  map.attributionControl.setPrefix('');
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 12, attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors' }).addTo(map);
  provLayer = L.geoJSON(S.geoProv, { style: f => provStyle(f), onEachFeature: onProv }).addTo(map);
}
function provBounds(codes) {
  let b = null;
  provLayer.eachLayer(l => { if (codes.includes(l.feature.properties.location)) b = b ? b.extend(l.getBounds()) : l.getBounds(); });
  return b;
}
function onProv(f, layer) {
  layer.on('mousemove', e => showTip(provTip(f), e.originalEvent.clientX, e.originalEvent.clientY));
  layer.on('mouseover', e => e.target.setStyle({ weight: 2.5, color: '#1b2430' }));
  // restore the computed choropleth style (not Leaflet's resetStyle, which would reapply the initial style)
  layer.on('mouseout', e => { hideTip(); e.target.setStyle(provStyle(f)); });
  layer.on('click', () => selectLocation(f.properties.location === S.location ? NATIONAL : f.properties.location));
}

/* label for the mapped week: "week ending 7 Nov (forecast +1 wk)" */
const wkLabel = () => S.mapWeek ? `week ending ${fmtDate(S.mapWeek)} (${weekKind(S.mapWeek)})` : 'no week';

/* ---- values and styles ---- */
function provValue(code) {
  const m = S.mapModel && S.mapWeek ? modelLoc(S.mapModel, code) : null;
  if (!m) return null;
  const i = m.weeks.indexOf(S.mapWeek);
  if (i < 0) return null;
  return S.mapMetric === 'presence' ? m.presence_wk[i] : m.q[i][QI.med];
}
let provScale = { vmax: 1 };
function provStyle(f) {
  const code = f.properties.location, v = S.round ? provValue(code) : null;
  const dim = S.location !== NATIONAL && S.location !== code;
  if (v == null) return { color: '#6b7684', weight: 1, dashArray: '3 3', fillColor: '#e6e9ee', fillOpacity: dim ? 0.1 : 0.5 };
  const norm = S.mapMetric === 'presence' ? v : Math.log1p(v) / Math.log1p(provScale.vmax);
  return { color: '#0b0f14', weight: S.location === code ? 2.5 : 1, dashArray: null, fillColor: colorFor(norm), fillOpacity: dim ? 0.15 : 0.75 };
}
function provTip(f) {
  const code = f.properties.location, obs = obsMap(S.obsRound, code);
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
  return `<b>${f.properties.name}</b> <span class="sm">· ${code}</span>${rows}<div class="sm" style="margin-top:4px">click to ${S.location === code ? 'clear selection' : 'select'}</div>${m && i >= 0 ? synNote() : ''}`;
}

function drawMap() {
  if (!map || !S.obsRound) return;
  const vals = S.manifest.locations.map(l => S.round ? provValue(l.code) : null).filter(v => v != null);
  const vmax = S.mapMetric === 'presence' ? 1 : Math.max(1, ...vals);
  provScale = { vmax };
  provLayer.eachLayer(l => {
    l.setStyle(provStyle(l.feature));
    if (S.location === l.feature.properties.location) l.bringToFront();
  });
  const n = S.manifest.locations.length, missing = n - vals.length;
  const mt = `${S.mapMetric === 'presence' ? 'P(≥1 case)' : 'Median cases'}, <span class="horizonval">${wkLabel()}</span>`;
  document.getElementById('mapSub').innerHTML = `${mt} · ${S.mapModel ? modelLabel(S.mapModel) : 'no model'}`
    + (S.manifest.mock && S.mapModel ? ' <b style="color:#9a5b00">(synthetic)</b>' : '')
    + (missing ? ` · ${missing} province${missing === 1 ? '' : 's'} without output (dashed)` : '');
  document.getElementById('legLo').textContent = '0';
  document.getElementById('legHi').textContent = S.mapMetric === 'presence' ? '100%' : fmtN(vmax);
  if (!mapFitted) { const b = provBounds(AFFECTED); if (b) map.fitBounds(b, { padding: [10, 10] }); mapFitted = true; }
}
