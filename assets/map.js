/* Leaflet choropleth with two layers: provinces (model output for the active horizon) and
   health zones (observed confirmed cases from auxiliary data). */
let map, provLayer, hzLayer, mapFitted = false;
const AFFECTED = ['IT', 'NK', 'HU', 'TO', 'BU', 'SK'];
const normName = s => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-'’]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function initMap() {
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([0.5, 28.5], 6);
  map.attributionControl.setPrefix('');
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 12, attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors' }).addTo(map);
  provLayer = L.geoJSON(S.geoProv, { style: () => ({ color: '#0b0f14', weight: 1, fillColor: '#ddd', fillOpacity: 0.6 }), onEachFeature: onProv });
  hzLayer = L.geoJSON(S.geoHz, { style: () => ({ color: '#0b0f14', weight: 0.6, fillColor: '#ddd', fillOpacity: 0.6 }), onEachFeature: onHz });
  // index health-zone case data by normalised name for the join
  S.hzIndex = {};
  Object.entries(S.hz.zones).forEach(([name, z]) => { S.hzIndex[normName(name)] = z; });
}
function provBounds(codes) {
  let b = null;
  provLayer.eachLayer(l => { if (codes.includes(l.feature.properties.location)) b = b ? b.extend(l.getBounds()) : l.getBounds(); });
  return b;
}
function onProv(f, layer) {
  layer.on('mousemove', e => showTip(provTip(f), e.originalEvent.clientX, e.originalEvent.clientY));
  layer.on('mouseover', e => e.target.setStyle({ weight: 2.5, color: '#1b2430' }));
  layer.on('mouseout', e => { hideTip(); provLayer.resetStyle(e.target); });
  layer.on('click', () => selectLocation(f.properties.location === S.location ? NATIONAL : f.properties.location));
}
function onHz(f, layer) {
  layer.on('mousemove', e => showTip(hzTip(f), e.originalEvent.clientX, e.originalEvent.clientY));
  layer.on('mouseover', e => e.target.setStyle({ weight: 2, color: '#1b2430' }));
  layer.on('mouseout', e => { hideTip(); hzLayer.resetStyle(e.target); });
  layer.on('click', () => { const code = parentCode(f.properties.parent); if (code) selectLocation(code === S.location ? NATIONAL : code); });
}
function parentCode(name) { const l = S.manifest.locations.find(x => x.name === name || normName(x.name) === normName(name)); return l ? l.code : null; }

/* ---- province values ---- */
function provValue(code) {
  const m = S.mapModel ? modelLoc(S.mapModel, code) : null;
  if (!m) return null;
  const h = String(S.horizon);
  if (S.mapMetric === 'presence') return m.presence[h];
  const q = m.horizon_sum[h]; return q ? q[QI.med] : null;
}
function provTip(f) {
  const code = f.properties.location, v = provValue(code), obs = obsMap(S.obsRound, code);
  const upTo = S.roundRef || S.obsRound.last_complete_week;
  const recent = Object.keys(obs).filter(w => w <= upTo).sort().slice(-4).reduce((a, w) => a + obs[w], 0);
  const total = Object.keys(obs).filter(w => w <= upTo).reduce((a, w) => a + obs[w], 0);
  const m = S.mapModel ? modelLoc(S.mapModel, code) : null, h = String(S.horizon);
  let rows = '';
  if (m) {
    const q = m.horizon_sum[h];
    rows += `<div class="row"><span>Median cases, next ${S.horizon} wk</span><b>${q ? fmtN(q[QI.med]) : '–'} ${q ? `<span class="sm">(${fmtRange(q)})</span>` : ''}</b></div>`;
    rows += `<div class="row"><span>P(≥1 case) within ${S.horizon} wk</span><b>${m.presence[h] == null ? '–' : Math.round(m.presence[h] * 100) + '%'}</b></div>`;
  } else rows += `<div class="row"><span>${modelLabel(S.mapModel || '')}</span><b>no submission</b></div>`;
  rows += `<div class="row"><span>Reported, last 4 wk</span><b>${fmtN(recent)}</b></div><div class="row"><span>Reported to date</span><b>${fmtN(total)}</b></div>`;
  return `<b>${f.properties.name}</b> <span class="sm">· ${code}</span>${rows}<div class="sm" style="margin-top:4px">click to ${S.location === code ? 'clear selection' : 'select'}</div>`;
}
/* ---- health-zone values ---- */
function hzWindowWeeks() {
  const weeks = S.hz.weeks, upTo = S.obsRound ? S.obsRound.as_of : weeks[weeks.length - 1];
  const inRange = weeks.filter(w => w <= addDays(upTo, 6));
  return S.hzWindow === 'recent' ? inRange.slice(-4) : inRange;
}
function hzValue(f) {
  const z = S.hzIndex[normName(f.properties.name)] || S.hzIndex[normName(f.properties.hdx_name)];
  if (!z) return { total: 0, imp: 0, known: false };
  const ws = new Set(hzWindowWeeks()); let total = 0, imp = 0;
  S.hz.weeks.forEach((w, i) => { if (ws.has(w)) { total += z.obs[i] + z.imp[i]; imp += z.imp[i]; } });
  return { total, imp, known: true };
}
function hzTip(f) {
  const v = hzValue(f), p = f.properties, ws = hzWindowWeeks();
  const label = S.hzWindow === 'recent' ? `Confirmed, ${fmtDate(ws[0])}–${fmtDate(ws[ws.length - 1])}` : 'Confirmed to date';
  return `<b>${p.name}</b> <span class="sm">· ${p.parent}${p.matched ? '' : ' · not in hub list'}</span>
    <div class="row"><span>${label}</span><b>${fmtN(v.total)}</b></div>
    ${v.total ? `<div class="row"><span>onset date imputed</span><b>${Math.round(100 * v.imp / v.total)}%</b></div>` : ''}
    <div class="sm" style="margin-top:4px">${v.known ? '' : 'no cases reported · '}click to select ${p.parent}</div>`;
}

function drawMap(layerSwitched) {
  if (!map || !S.obsRound) return;
  const prov = S.mapLayer === 'prov';
  if (prov) { if (map.hasLayer(hzLayer)) map.removeLayer(hzLayer); if (!map.hasLayer(provLayer)) provLayer.addTo(map); }
  else { if (map.hasLayer(provLayer)) map.removeLayer(provLayer); if (!map.hasLayer(hzLayer)) hzLayer.addTo(map); }
  const selName = S.location === NATIONAL ? null : locName(S.location);

  if (prov) {
    const vals = S.manifest.locations.map(l => provValue(l.code)).filter(v => v != null);
    const vmax = S.mapMetric === 'presence' ? 1 : Math.max(1, ...vals);
    const norm = v => S.mapMetric === 'presence' ? v : Math.log1p(v) / Math.log1p(vmax);
    provLayer.eachLayer(l => {
      const code = l.feature.properties.location, v = provValue(code);
      const dim = S.location !== NATIONAL && S.location !== code;
      l.setStyle(v == null
        ? { color: '#6b7684', weight: 1, dashArray: '3 3', fillColor: '#e6e9ee', fillOpacity: dim ? 0.1 : 0.5 }
        : { color: '#0b0f14', weight: S.location === code ? 2.5 : 1, dashArray: null, fillColor: colorFor(norm(v)), fillOpacity: dim ? 0.15 : 0.75 });
      if (S.location === code) l.bringToFront();
    });
    const mt = S.mapMetric === 'presence' ? `P(≥1 case) within <span class="horizonval">${S.horizon}</span> wk` : `Median cases, next <span class="horizonval">${S.horizon}</span> wk`;
    document.getElementById('mapSub').innerHTML = `${mt} · ${S.mapModel ? modelLabel(S.mapModel) : 'no model'}${vals.length < S.manifest.locations.length ? ` · ${S.manifest.locations.length - vals.length} province${S.manifest.locations.length - vals.length === 1 ? '' : 's'} without output (dashed)` : ''}`;
    document.getElementById('legLo').textContent = '0';
    document.getElementById('legHi').textContent = S.mapMetric === 'presence' ? '100%' : fmtN(vmax);
    if (!mapFitted || layerSwitched) { const b = provBounds(AFFECTED); if (b) map.fitBounds(b, { padding: [10, 10] }); mapFitted = true; }
  } else {
    let vmax = 1; const cache = new Map();
    hzLayer.eachLayer(l => { const v = hzValue(l.feature); cache.set(l, v); vmax = Math.max(vmax, v.total); });
    hzLayer.eachLayer(l => {
      const v = cache.get(l), p = l.feature.properties;
      const dim = selName && normName(p.parent) !== normName(selName);
      l.setStyle(v.total > 0
        ? { color: '#0b0f14', weight: 0.6, dashArray: null, fillColor: colorFor(Math.log1p(v.total) / Math.log1p(vmax)), fillOpacity: dim ? 0.15 : 0.8 }
        : { color: '#8a94a3', weight: 0.4, dashArray: null, fillColor: p.matched ? '#f1f3f6' : '#d9dde3', fillOpacity: dim ? 0.1 : 0.55 });
    });
    const ws = hzWindowWeeks();
    document.getElementById('mapSub').innerHTML = `Confirmed cases by health zone · ${S.hzWindow === 'recent' ? `weeks ending ${fmtDate(ws[0])}–${fmtDate(ws[ws.length - 1])}` : 'outbreak to date'} · as of ${S.hz.as_of}${selName ? ` · ${selName} highlighted` : ''}`;
    document.getElementById('legLo').textContent = '0';
    document.getElementById('legHi').textContent = fmtN(vmax);
    if (layerSwitched) { const b = S.location !== NATIONAL ? provBounds([S.location]) : provBounds(AFFECTED); if (b) map.fitBounds(b, { padding: [10, 10] }); }
  }
}
