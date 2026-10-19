/* State, data loading and wiring for the BDBV hub dashboard. Panels live in timeseries.js,
   cumulative.js and map.js and read the shared state object S. */
const S = {
  manifest: null, models: {}, colors: {}, ensembleId: null,
  roundRef: null, round: null, obsRound: null, obsLatest: null, hz: null, geoProv: null, geoHz: null,
  location: 'CD_total', horizon: 3, showLatest: true, range: 'recent',
  tsSelected: new Set(), cumSelected: new Set(),
  mapLayer: 'prov', mapMetric: 'median', mapModel: null, hzWindow: 'recent',
  cache: {},
};
const NATIONAL = 'CD_total';
const $ = id => document.getElementById(id);
const QI = { lo95: 0, lo80: 1, lo50: 2, med: 3, hi50: 4, hi80: 5, hi95: 6 };

/* ---------- helpers shared by panels ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso, withYear) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
function addDays(iso, n) {
  const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const fmtN = v => v == null ? '–' : Math.round(v).toLocaleString();
const fmtRange = q => q ? `${fmtN(q[QI.lo95])}–${fmtN(q[QI.hi95])}` : '';
const tt = $('tt');
function showTip(html, x, y) {
  tt.innerHTML = html; tt.style.opacity = 1;
  const w = tt.offsetWidth, h = tt.offsetHeight;
  tt.style.left = Math.min(x + 14, window.innerWidth - w - 8) + 'px';
  tt.style.top = Math.min(y + 14, window.innerHeight - h - 8) + 'px';
}
function hideTip() { tt.style.opacity = 0; }
/** footer line appended to any tooltip that shows model output while synthetic data are loaded */
function synNote() { return S.manifest && S.manifest.mock ? '<div class="syn">SYNTHETIC MODEL OUTPUT · not a team submission</div>' : ''; }

function locName(code) {
  if (code === NATIONAL) return 'DRC (national)';
  const l = S.manifest.locations.find(x => x.code === code); return l ? l.name : code;
}
const modelKey = loc => loc === NATIONAL ? 'CD' : loc;
function modelName(id) { const m = S.models[id]; return m ? (m.model_name && m.model_name !== id ? `${m.team_abbr}-${m.model_abbr}` : id) : id; }
function modelLabel(id) { return id === S.ensembleId ? 'Hub ensemble' : modelName(id); }
function modelColor(id) { return S.colors[id] || '#888'; }
/** observed counts {week: n} for a location in an observed-data version object */
function obsMap(ov, loc) {
  const arr = ov && ov.by_location[loc]; const out = {};
  if (arr) ov.weeks.forEach((w, i) => { out[w] = arr[i]; });
  return out;
}
/** model summary for (model, location) in the current round, or null */
function modelLoc(mid, loc) {
  const m = S.round && S.round.models[mid]; return m ? (m.locations[modelKey(loc)] || null) : null;
}
function roundModels() { return S.round ? Object.keys(S.round.models).sort(sortModels) : []; }
function sortModels(a, b) { if (a === S.ensembleId) return -1; if (b === S.ensembleId) return 1; return a.localeCompare(b); }
function modelsForLocation(loc) { return roundModels().filter(m => modelLoc(m, loc)); }

/* ---------- loading ---------- */
async function getJSON(path) {
  if (S.cache[path]) return S.cache[path];
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (S.cache[path] = await r.json());
}
async function init() {
  const [manifest, models, geoProv, geoHz, hz] = await Promise.all([
    getJSON('data/manifest.json'), getJSON('data/models.json'), getJSON('data/geo/provinces.json'),
    getJSON('data/geo/health-zones.json'), getJSON('data/observed/health-zones.json')]);
  S.manifest = manifest; S.models = models; S.geoProv = geoProv; S.geoHz = geoHz; S.hz = hz;
  S.ensembleId = manifest.ensemble_model_id && models[manifest.ensemble_model_id] ? manifest.ensemble_model_id : null;
  S.colors = assignColors(models, S.ensembleId);
  S.obsLatest = await getJSON(`data/observed/${manifest.latest_as_of}.json`);
  $('mockBadge').classList.toggle('hidden', !manifest.mock);
  document.body.classList.toggle('mock', !!manifest.mock);

  // header selectors
  const rs = $('roundSel');
  rs.innerHTML = manifest.rounds.map(r =>
    `<option value="${r.reference_date}">${fmtDate(r.reference_date, true)} · ${r.n_models} model${r.n_models === 1 ? '' : 's'} · data as of ${fmtDate(r.as_of)}</option>`).join('')
    || '<option value="">no rounds yet</option>';
  const ls = $('locSel');
  ls.innerHTML = `<option value="${NATIONAL}">DRC · national · CD${manifest.national_total ? ` (${fmtN(manifest.national_total)})` : ''}</option>` +
    manifest.locations.map(l => `<option value="${l.code}">${l.name} · ${l.code}${l.total ? ` (${fmtN(l.total)})` : ''}</option>`).join('');
  $('footProv').innerHTML = `Hub ${manifest.hub.repo}@${manifest.hub.branch} (${manifest.hub.commit}) · latest target data as of <b>${manifest.latest_as_of}</b> · built ${manifest.generated_at.replace('T', ' ').replace('Z', ' UTC')}` +
    (manifest.mock ? ' · <b style="color:#9a5b00">model output is synthetic</b>' : '');

  initMap();
  wire();
  if (manifest.rounds.length) await loadRound(manifest.rounds[0].reference_date);
  else { S.round = null; S.obsRound = S.obsLatest; afterRound(); }
}
async function loadRound(ref) {
  S.roundRef = ref;
  const info = S.manifest.rounds.find(r => r.reference_date === ref);
  const [round, obs] = await Promise.all([getJSON(`data/rounds/${ref}.json`), getJSON(`data/observed/${info.as_of}.json`)]);
  S.round = round; S.obsRound = obs;
  afterRound();
}
function afterRound() {
  // default model selections: ensemble backbone (+CI) or first team
  const ms = roundModels();
  for (const set of [S.tsSelected, S.cumSelected]) {
    [...set].forEach(id => { if (!ms.includes(id) && id !== 'ensembleCI') set.delete(id); });
    if (!set.size && ms.length) {
      if (S.ensembleId && ms.includes(S.ensembleId)) { set.add(S.ensembleId); }
      else set.add(ms[0]);
    }
  }
  if (!S.mapModel || !ms.includes(S.mapModel)) S.mapModel = (S.ensembleId && ms.includes(S.ensembleId)) ? S.ensembleId : ms[0] || null;
  buildModelDropdown('tsModelBtn', 'tsModelPanel', S.tsSelected, true);
  buildModelDropdown('cumModelBtn', 'cumModelPanel', S.cumSelected, false);
  const sel = $('mapModelSel');
  sel.innerHTML = ms.map(id => `<option value="${id}">${modelLabel(id)}</option>`).join('') || '<option value="">no models</option>';
  sel.value = S.mapModel || '';
  buildDrawer();
  sync();
}

/* ---------- controls ---------- */
function buildModelDropdown(btnId, panelId, selSet, isTS) {
  const btn = $(btnId), panel = $(panelId), ms = roundModels();
  const avail = new Set(modelsForLocation(S.location));
  const hint = S.ensembleId && ms.includes(S.ensembleId) && isTS ? '<div class="hint">Ensemble median always shown</div>' : '';
  panel.innerHTML = hint + ms.map(id => {
    const isEns = id === S.ensembleId, dis = !avail.has(id);
    const sw = isEns ? `<span class="sw" style="border:1.5px dashed ${modelColor(id)};background:transparent"></span>`
                     : `<span class="sw" style="background:${modelColor(id)}"></span>`;
    const label = isEns && isTS ? 'Ensemble 95% interval' : modelLabel(id);
    return `<label class="${dis ? 'disabled' : ''}" title="${dis ? 'No submission for ' + locName(S.location) : ''}"><input type="checkbox" value="${id}" ${selSet.has(id) ? 'checked' : ''} ${dis ? 'disabled' : ''}>${sw}${label}</label>`;
  }).join('') || '<div class="hint">No submissions in this round</div>';
  const refresh = () => {
    const teams = [...selSet].filter(id => id !== S.ensembleId && avail.has(id));
    const ens = S.ensembleId && selSet.has(S.ensembleId);
    btn.textContent = (isTS
      ? (teams.length ? `Ensemble + ${teams.length} model${teams.length > 1 ? 's' : ''}` : (ens ? 'Ensemble + interval' : (S.ensembleId ? 'Ensemble' : 'none')))
      : (selSet.size === 0 ? 'none' : selSet.size === 1 ? modelLabel([...selSet][0]) : `${selSet.size} models`)) + ' ▾';
  };
  refresh();
  panel.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => {
    cb.checked ? selSet.add(cb.value) : selSet.delete(cb.value); refresh(); isTS ? drawTS() : drawCum();
  }));
  if (!btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', e => { e.stopPropagation(); document.querySelectorAll('.ddpanel.open').forEach(p => { if (p !== panel) p.classList.remove('open'); }); panel.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open'); });
  }
}
function setToggle(groupId, attr, value) {
  document.querySelectorAll(`#${groupId} button`).forEach(b => b.classList.toggle('active', b.dataset[attr] === value));
}
function wire() {
  $('roundSel').addEventListener('change', e => loadRound(e.target.value));
  $('locSel').addEventListener('change', e => { S.location = e.target.value; onLocationChange(); });
  $('horizon').addEventListener('input', e => { S.horizon = +e.target.value; $('horizonLabel').textContent = S.horizon; sync(); });
  $('latestToggle').addEventListener('change', e => { S.showLatest = e.target.checked; drawTS(); drawCum(); });
  document.querySelectorAll('#rangeToggle button').forEach(b => b.addEventListener('click', () => { S.range = b.dataset.r; setToggle('rangeToggle', 'r', S.range); drawTS(); }));
  document.querySelectorAll('#layerToggle button').forEach(b => b.addEventListener('click', () => { S.mapLayer = b.dataset.l; setToggle('layerToggle', 'l', S.mapLayer);
    $('provCtrls').style.display = S.mapLayer === 'prov' ? 'contents' : 'none'; $('hzCtrls').style.display = S.mapLayer === 'hz' ? 'contents' : 'none'; drawMap(true); }));
  document.querySelectorAll('#metricToggle button').forEach(b => b.addEventListener('click', () => { S.mapMetric = b.dataset.m; setToggle('metricToggle', 'm', S.mapMetric); drawMap(); }));
  document.querySelectorAll('#hzWindowToggle button').forEach(b => b.addEventListener('click', () => { S.hzWindow = b.dataset.w; setToggle('hzWindowToggle', 'w', S.hzWindow); drawMap(); }));
  $('mapModelSel').addEventListener('change', e => { S.mapModel = e.target.value; drawMap(); });
  $('modelsBtn').addEventListener('click', () => toggleDrawer(true));
  $('drawerClose').addEventListener('click', () => toggleDrawer(false));
  $('drawerBg').addEventListener('click', () => toggleDrawer(false));
  window.addEventListener('resize', () => { drawTS(); drawCum(); });
  // panels change height when their headers wrap; redraw charts when their drawing area resizes
  let raf = null;
  const ro = new ResizeObserver(() => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; drawTS(); drawCum(); if (map) map.invalidateSize(); }); });
  ro.observe(document.querySelector('.ts .bd')); ro.observe(document.querySelector('.cum .bd')); ro.observe(document.getElementById('map'));
}
function onLocationChange() {
  $('locSel').value = S.location;
  buildModelDropdown('tsModelBtn', 'tsModelPanel', S.tsSelected, true);
  buildModelDropdown('cumModelBtn', 'cumModelPanel', S.cumSelected, false);
  sync();
}
function selectLocation(code) { S.location = code; onLocationChange(); }
function sync() { drawTS(); drawCum(); drawMap(); }

/* ---------- models drawer ---------- */
function toggleDrawer(open) { $('drawer').classList.toggle('open', open); $('drawerBg').classList.toggle('open', open); }
function buildDrawer() {
  const ms = roundModels();
  $('drawerSub').textContent = S.roundRef ? `Reference date ${fmtDate(S.roundRef, true)} · ${ms.length} model${ms.length === 1 ? '' : 's'}` : 'No round loaded';
  $('drawerBody').innerHTML = ms.map(id => {
    const m = S.models[id] || {}, nloc = Object.keys((S.round.models[id] || {}).locations || {}).length;
    const links = [m.website_url && `<a href="${m.website_url}" target="_blank" rel="noopener">website</a>`, m.repo_url && `<a href="${m.repo_url}" target="_blank" rel="noopener">code</a>`].filter(Boolean).join(' · ');
    return `<div class="model"><h3><i style="background:${modelColor(id)}"></i>${m.model_name || id} <span class="tag">${id}</span>${m.ensemble_of_hub_models ? '<span class="tag">ensemble</span>' : ''}${m.mock ? '<span class="tag" style="color:#9a5b00;border-color:#f0c889">synthetic</span>' : ''}</h3>
      <div class="team">${m.team_name || ''}</div>
      ${m.methods ? `<p>${m.methods}</p>` : ''}
      ${m.data_inputs ? `<p class="sm" style="color:var(--muted)">Data: ${m.data_inputs}</p>` : ''}
      <p style="color:var(--muted)">${nloc} location${nloc === 1 ? '' : 's'} submitted${m.license ? ` · ${m.license}` : ''}${links ? ' · ' + links : ''}</p></div>`;
  }).join('') || '<p style="color:var(--muted)">No submissions yet for this round.</p>';
}

init().catch(e => { console.error(e); document.body.insertAdjacentHTML('afterbegin', `<div style="background:#fde8e8;color:#8a1c1c;padding:10px 20px;font-size:13px">Failed to load dashboard data: ${e.message}</div>`); });
