/* State, data loading and wiring for the BDBV hub dashboard. Panels live in timeseries.js,
   cumulative.js and map.js and read the shared state object S. */
const S = {
  manifest: null, models: {}, colors: {}, ensembleId: null,
  roundRef: null, round: null, obsRound: null, obsLatest: null, geoProv: null,
  location: 'CD', range: 'recent', locIndex: {},
  mapWeek: null, mapRel: 0,   // week shown on the map and its offset in weeks from the reference date
  tsSelected: new Set(), cumSelected: new Set(),
  mapMetric: 'median', mapModel: null, mapLayer: 'prov', geoHZ: null,
  cache: {},
};
const NATIONAL = 'CD';
const $ = id => document.getElementById(id);
const QI = { lo95: 0, lo80: 1, lo50: 2, med: 3, hi50: 4, hi80: 5, hi95: 6 };

/* ---------- helpers shared by panels ---------- */
function fmtDate(iso, withYear) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${t('months')[m - 1]}${withYear ? ' ' + y : ''}`;
}
function addDays(iso, n) {
  const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
// explicit locales so the output does not depend on the browser; French groups thousands with U+202F
const fmtN = v => v == null ? '–' : LANG === 'fr' ? Math.round(v).toLocaleString('en-US').replace(/,/g, '\u202f') : Math.round(v).toLocaleString('en-US');
const fmtPct = p => `${Math.round(p * 100)}${LANG === 'fr' ? '\u202f%' : '%'}`;
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
function synNote() { return S.manifest && S.manifest.mock ? `<div class="syn">${t('tip.syn')}</div>` : ''; }

function locInfo(code) { return S.locIndex[code] || null; }
function locName(code) {
  if (code === NATIONAL) return t('loc.national');
  const l = locInfo(code); if (!l) return code;
  return l.type === 'health zone' ? `${l.name} · ${l.parent === NATIONAL ? t('loc.nationalShort') : locName(l.parent)}` : l.name;
}
/** province code giving the geographic context of a location (null for the country) */
function locProvince(code) { const l = locInfo(code); return !l || l.type === 'country' ? null : l.type === 'province' ? code : l.parent; }
const isZone = code => (locInfo(code) || {}).type === 'health zone';
const provinces = () => S.manifest.locations.filter(l => l.type === 'province');
const zonesOf = p => S.manifest.locations.filter(l => l.type === 'health zone' && l.parent === p);
function modelName(id) { const m = S.models[id]; return m ? (m.model_name && m.model_name !== id ? `${m.team_abbr}-${m.model_abbr}` : id) : id; }
function modelLabel(id) { return id === S.ensembleId ? t('model.ensemble') : modelName(id); }
function modelColor(id) { return S.colors[id] || '#888'; }
/** observed counts {week: n} for a location in an observed-data version object */
function obsMap(ov, loc) {
  const arr = ov && ov.by_location[loc]; const out = {};
  if (arr) ov.weeks.forEach((w, i) => { out[w] = arr[i]; });
  return out;
}
/** model summary for (model, location) in the current round, or null */
function modelLoc(mid, loc) {
  const m = S.round && S.round.models[mid]; return m ? (m.locations[loc] || null) : null;
}
function roundModels() { return S.round ? Object.keys(S.round.models).sort(sortModels) : []; }
function sortModels(a, b) { if (a === S.ensembleId) return -1; if (b === S.ensembleId) return 1; return a.localeCompare(b); }
function modelsForLocation(loc) { return roundModels().filter(m => modelLoc(m, loc)); }
/** the model that submitted the most locations in the current round (ties: first in menu order) */
function widestModel(ms) {
  let best = null, n = -1;
  ms.forEach(id => { const k = Object.keys(S.round.models[id].locations).length; if (k > n) { best = id; n = k; } });
  return best;
}
/** weeks with model output from any model/location in the current round, oldest first */
function roundWeeks() {
  const set = new Set();
  roundModels().forEach(id => Object.values(S.round.models[id].locations).forEach(l => l.weeks.forEach(w => set.add(w))));
  return [...set].sort();
}
/** offset of a week from the reference date, in weeks (negative = nowcast week) */
function weekRel(w) { return S.roundRef && w ? Math.round((Date.parse(w) - Date.parse(S.roundRef)) / 6048e5) : null; }
function weekKind(w) { const r = weekRel(w); return r == null ? '' : r < 0 ? t('week.nowcastKind', { rel: weekRelLabel(w) }) : r === 0 ? t('week.fc0') : t('week.fcPos', { n: r }); }
/** "+1 wk", "wk 0", "−2 wk": offset of a week from the projections-from date */
function weekRelLabel(w) { const r = weekRel(w); return r == null ? '' : r === 0 ? t('week.h0') : t(r > 0 ? 'week.hPos' : 'week.hNeg', { n: Math.abs(r) }); }
/* ---- arrow steppers: prev/next buttons around a select, stepping over its enabled options ---- */
function wireStepper(selId) {
  const sel = $(selId), wrap = $(selId + 'Step'); if (!wrap || wrap.dataset.wired) return;
  wrap.dataset.wired = '1';
  wrap.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => {
    const opts = [...sel.options].filter(o => !o.disabled && o.value), i = opts.indexOf(sel.selectedOptions[0]);
    const j = i + (+b.dataset.dir); if (j < 0 || j >= opts.length) return;
    sel.value = opts[j].value; sel.dispatchEvent(new Event('change', { bubbles: true }));
  }));
  sel.addEventListener('change', () => refreshStepper(selId));
  refreshStepper(selId);
}
function refreshStepper(selId) {
  const sel = $(selId), wrap = $(selId + 'Step'); if (!wrap) return;
  const opts = [...sel.options].filter(o => !o.disabled && o.value), i = opts.indexOf(sel.selectedOptions[0]);
  wrap.querySelector('[data-dir="-1"]').disabled = i <= 0;
  wrap.querySelector('[data-dir="1"]').disabled = i < 0 || i >= opts.length - 1;
}
function setMapWeek(w) {
  S.mapWeek = w; S.mapRel = weekRel(w) ?? 0;
  const sel = $('mapWeekSel'); if (sel.value !== w) sel.value = w;
  sync();
}

/* ---------- loading ---------- */
async function getJSON(path) {
  if (S.cache[path]) return S.cache[path];
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (S.cache[path] = await r.json());
}
/* Mock-dashboard gate: a phrase whose SHA-256 is in the manifest, remembered per browser. It only keeps
   people from stumbling onto synthetic output; nothing on a static site is secret. */
const GATE_KEY = 'bdbv-mock-unlocked';
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function gate(hash) {
  let have = null; try { have = localStorage.getItem(GATE_KEY); } catch (e) { /* storage blocked: ask every time */ }
  if (have === hash) return Promise.resolve();
  const g = $('gate'), inp = $('gateInput'), err = $('gateErr');
  g.classList.remove('hidden'); inp.focus();
  return new Promise(resolve => {
    const go = async () => {
      if (!(crypto && crypto.subtle)) { err.textContent = t('gate.https'); return; }
      if (await sha256(inp.value.trim()) === hash) {
        try { localStorage.setItem(GATE_KEY, hash); } catch (e) { /* fine */ }
        g.classList.add('hidden'); resolve();
      } else { err.textContent = t('gate.wrong'); inp.select(); }
    };
    $('gateBtn').addEventListener('click', go);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}
/* Language: English and French. I18N_LIVE enables the switch on the live site (set false to confine it to
   the mock copy again). The choice is remembered per browser; ?lang=xx in the URL overrides it. */
const I18N_LIVE = true;
const LANG_KEY = 'bdbv-lang';
function langEnabled() { return !!(S.manifest && (S.manifest.mock || I18N_LIVE)); }
function setLang(lang, store) {
  if (!langEnabled()) lang = 'en';
  LANG = I18N[lang] ? lang : 'en';
  if (store) { try { localStorage.setItem(LANG_KEY, LANG); } catch (e) { /* fine */ } }
  setToggle('langToggle', 'lang', LANG);
  applyStatic();
  if (S.manifest) buildHeader();
  setBasemap(LANG);
  if (S.obsRound) afterRound();
}
/** header selectors and footer provenance; re-run on a language change, keeping the current selection */
function buildHeader() {
  const manifest = S.manifest, rs = $('roundSel');
  rs.innerHTML = manifest.rounds.slice().reverse().map(r =>
    `<option value="${r.reference_date}">${fmtDate(r.reference_date, true)}</option>`).join('')
    || `<option value="">${t('hdr.noRounds')}</option>`;
  rs.value = S.roundRef || '';
  wireStepper('roundSel'); refreshStepper('roundSel');
  const ls = $('locSel'), nat = locInfo(NATIONAL) || { total: 0 };
  ls.innerHTML = `<option value="${NATIONAL}">${t('loc.nationalOpt')}${nat.total ? ` (${fmtN(nat.total)})` : ''}</option>` +
    provinces().map(l => `<option value="${l.code}">${l.name}${l.total ? ` (${fmtN(l.total)})` : ''}</option>`).join('');
  ls.value = locProvince(S.location) || NATIONAL;
  buildZoneSelect(locProvince(S.location));
  // separate spans so the footer wraps between items, not mid-sentence
  $('footProv').innerHTML = [t('foot.hub', { repo: manifest.hub.repo, branch: manifest.hub.branch, commit: manifest.hub.commit }),
    t('foot.latest', { d: `<b>${manifest.latest_as_of}</b>` }), t('foot.built', { d: manifest.generated_at.replace('T', ' ').replace('Z', ' UTC') }),
    manifest.mock ? `<b style="color:#9a5b00">${t('foot.synthetic')}</b>` : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('');
}
async function init() {
  const [manifest, models, geoProv] = await Promise.all([
    getJSON('data/manifest.json'), getJSON('data/models.json'), getJSON('data/geo/provinces.json')]);
  S.manifest = manifest; S.models = models; S.geoProv = geoProv;
  manifest.locations.forEach(l => { S.locIndex[l.code] = l; });
  S.ensembleId = manifest.ensemble_model_id && models[manifest.ensemble_model_id] ? manifest.ensemble_model_id : null;
  S.colors = assignColors(models, S.ensembleId);
  S.obsLatest = await getJSON(`data/observed/${manifest.latest_as_of}.json`);
  $('mockBadge').classList.toggle('hidden', !manifest.mock);
  document.body.classList.toggle('mock', !!manifest.mock);
  if (manifest.mock) {
    $('mockBanner').classList.remove('hidden');
    $('liveLink').classList.toggle('hidden', !/\/mock\/?$/.test(location.pathname.replace(/index\.html$/, '')));
  }
  // language (before the gate so the gate card is already translated)
  let lang = 'en';
  if (langEnabled()) {
    $('langToggle').classList.remove('hidden');
    const q = new URLSearchParams(location.search).get('lang');
    let stored = null; try { stored = localStorage.getItem(LANG_KEY); } catch (e) { /* fine */ }
    lang = q || stored || 'en';
    document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); setLang(b.dataset.lang, true); }));
  }
  setLang(lang, langEnabled() && !!new URLSearchParams(location.search).get('lang'));   // a ?lang= link is remembered like a click
  if (manifest.mock && manifest.mock_gate) await gate(manifest.mock_gate);

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
  // default model selections: the hub ensemble when there is one, otherwise every model; the map
  // starts on the ensemble or, failing that, the model covering the most locations
  const ms = roundModels(), hasEns = S.ensembleId && ms.includes(S.ensembleId);
  for (const set of [S.tsSelected, S.cumSelected]) {
    [...set].forEach(id => { if (!ms.includes(id) && id !== 'ensembleCI') set.delete(id); });
    if (!set.size && ms.length) {
      if (hasEns) set.add(S.ensembleId);
      else ms.forEach(id => set.add(id));
    }
  }
  if (!S.mapModel || !ms.includes(S.mapModel)) S.mapModel = hasEns ? S.ensembleId : widestModel(ms);
  buildModelDropdown('tsModelBtn', 'tsModelPanel', S.tsSelected, true);
  buildModelDropdown('cumModelBtn', 'cumModelPanel', S.cumSelected, false);
  const sel = $('mapModelSel');
  sel.innerHTML = ms.map(id => `<option value="${id}">${modelLabel(id)}</option>`).join('') || `<option value="">${t('map.noModels')}</option>`;
  sel.value = S.mapModel || '';
  // mapped week: keep the same offset from the reference date across rounds, default week 0
  const ws = roundWeeks(), R = S.roundRef, want = R ? addDays(R, 7 * S.mapRel) : null;
  S.mapWeek = ws.includes(want) ? want : ws.includes(R) ? R : ws[ws.length - 1] || null;
  // chronological, so the arrows step backwards/forwards in time; label = date plus offset from R
  const fc = ws.filter(w => weekRel(w) >= 0), nc = ws.filter(w => weekRel(w) < 0);
  const opt = w => `<option value="${w}">${fmtDate(w, true)} · ${weekRelLabel(w)}</option>`;
  $('mapWeekSel').innerHTML = (nc.length ? `<optgroup label="${t('map.nowcastWeeks')}">${nc.map(opt).join('')}</optgroup>` : '')
    + (fc.length ? `<optgroup label="${t('map.forecastWeeks')}">${fc.map(opt).join('')}</optgroup>` : '') || `<option value="">${t('map.noWeeks')}</option>`;
  $('mapWeekSel').value = S.mapWeek || '';
  wireStepper('mapWeekSel'); refreshStepper('mapWeekSel');
  const ri = S.manifest.rounds.find(r => r.reference_date === S.roundRef);
  $('roundInfo').textContent = ri ? tn('hdr.roundInfo', ri.n_models, { d: fmtDate(ri.as_of) }) : '';
  $('roundSel').value = S.roundRef || ''; refreshStepper('roundSel');
  buildDrawer();
  sync();
}

/* ---------- controls ---------- */
function buildModelDropdown(btnId, panelId, selSet, isTS) {
  const btn = $(btnId), panel = $(panelId), ms = roundModels();
  const avail = new Set(modelsForLocation(S.location));
  const hint = S.ensembleId && ms.includes(S.ensembleId) && isTS ? `<div class="hint">${t('dd.hintEns')}</div>` : '';
  panel.innerHTML = hint + ms.map(id => {
    const isEns = id === S.ensembleId, dis = !avail.has(id);
    const sw = isEns ? `<span class="sw" style="border:1.5px dashed ${modelColor(id)};background:transparent"></span>`
                     : `<span class="sw" style="background:${modelColor(id)}"></span>`;
    const label = isEns && isTS ? t('dd.ensCI') : modelLabel(id);
    return `<label class="${dis ? 'disabled' : ''}" title="${dis ? t('dd.noSub', { loc: locName(S.location) }) : ''}"><input type="checkbox" value="${id}" ${selSet.has(id) ? 'checked' : ''} ${dis ? 'disabled' : ''}>${sw}${label}</label>`;
  }).join('') || `<div class="hint">${t('dd.none')}</div>`;
  // label: models selected AND submitted for the location (the ensemble median is always drawn on the chart)
  const refresh = () => {
    const hasEns = S.ensembleId && avail.has(S.ensembleId), ensOn = hasEns && selSet.has(S.ensembleId);
    const teams = [...selSet].filter(id => id !== S.ensembleId && avail.has(id));
    const plus = tn('dd.plus', teams.length);
    let label;
    if (isTS && hasEns) label = teams.length ? plus : ensOn ? t('dd.ensInterval') : t('dd.ens');
    else if (ensOn) label = teams.length ? plus : t('dd.ens');
    else label = teams.length === 0 ? t('dd.noneSel') : teams.length === 1 ? modelLabel(teams[0]) : teams.length === ms.length ? t('dd.all') : tn('dd.nModels', teams.length);
    btn.textContent = label + ' ▾';
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
  $('hzSel').addEventListener('change', e => { S.location = e.target.value || locProvince(S.location) || NATIONAL; onLocationChange(); });
  document.querySelectorAll('#layerToggle button').forEach(b => b.addEventListener('click', () => setLayer(b.dataset.l, b.dataset.l === 'hz' ? locProvince(S.location) : null)));
  $('mapWeekSel').addEventListener('change', e => setMapWeek(e.target.value));
  document.querySelectorAll('#rangeToggle button').forEach(b => b.addEventListener('click', () => { S.range = b.dataset.r; setToggle('rangeToggle', 'r', S.range); drawTS(); }));
  document.querySelectorAll('#metricToggle button').forEach(b => b.addEventListener('click', () => { S.mapMetric = b.dataset.m; setToggle('metricToggle', 'm', S.mapMetric); drawMap(); }));
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
/** zone dropdown: hidden for the country, otherwise "whole province" plus its zones by cumulative cases */
function buildZoneSelect(prov) {
  const sel = $('hzSel');
  if (!prov) { sel.classList.add('hidden'); sel.innerHTML = ''; return; }
  const zs = zonesOf(prov);
  sel.innerHTML = `<option value="">${t('loc.wholeProvince')}</option>` +
    zs.map(z => `<option value="${z.code}">${z.name}${z.total ? ` (${fmtN(z.total)})` : ''}</option>`).join('');
  sel.classList.toggle('hidden', !zs.length);
  sel.value = isZone(S.location) ? S.location : '';
}
let lastProv = null;
function onLocationChange() {
  const prov = locProvince(S.location);
  $('locSel').value = prov || NATIONAL;
  buildZoneSelect(prov);
  buildModelDropdown('tsModelBtn', 'tsModelPanel', S.tsSelected, true);
  buildModelDropdown('cumModelBtn', 'cumModelPanel', S.cumSelected, false);
  // a zone selection switches the map to the zone layer and zooms to its province; on the zone layer a
  // change of province refocuses the map
  const provChanged = prov !== lastProv; lastProv = prov;
  if (isZone(S.location) && S.mapLayer !== 'hz') { setLayer('hz', prov); return; }
  if (provChanged && S.mapLayer === 'hz') fitProvince(prov);
  sync();
}
function selectLocation(code) { S.location = code; onLocationChange(); }
function sync() { drawTS(); drawCum(); drawMap(); }

/* ---------- models drawer ---------- */
function toggleDrawer(open) { $('drawer').classList.toggle('open', open); $('drawerBg').classList.toggle('open', open); }
function buildDrawer() {
  const ms = roundModels();
  const note = t('drawer.englishNote');   // metadata texts come from the hub in English
  $('drawerSub').innerHTML = (S.roundRef ? tn('drawer.sub', ms.length, { d: fmtDate(S.roundRef, true) }) : t('drawer.noRound')) + (note && ms.length ? `<br><i>${note}</i>` : '');
  $('drawerBody').innerHTML = ms.map(id => {
    const m = S.models[id] || {}, nloc = Object.keys((S.round.models[id] || {}).locations || {}).length;
    const links = [m.website_url && `<a href="${m.website_url}" target="_blank" rel="noopener">${t('drawer.website')}</a>`, m.repo_url && `<a href="${m.repo_url}" target="_blank" rel="noopener">${t('drawer.code')}</a>`].filter(Boolean).join(' · ');
    return `<div class="model"><h3><i style="background:${modelColor(id)}"></i>${m.model_name || id} <span class="tag">${id}</span>${m.ensemble_of_hub_models ? `<span class="tag">${t('drawer.tagEns')}</span>` : ''}${m.mock ? `<span class="tag" style="color:#9a5b00;border-color:#f0c889">${t('drawer.tagSyn')}</span>` : ''}</h3>
      <div class="team">${m.team_name || ''}</div>
      ${m.methods ? `<p>${m.methods}</p>` : ''}
      ${m.data_inputs ? `<p class="sm" style="color:var(--muted)">${t('drawer.data', { s: m.data_inputs })}</p>` : ''}
      <p style="color:var(--muted)">${tn('drawer.nloc', nloc)}${m.license ? ` · ${m.license}` : ''}${links ? ' · ' + links : ''}</p></div>`;
  }).join('') || `<p style="color:var(--muted)">${t('drawer.empty')}</p>`;
}

init().catch(e => { console.error(e); const msg = typeof t === 'function' ? t('err.load', { msg: e.message }) : 'Failed to load dashboard data: ' + e.message; document.body.insertAdjacentHTML('afterbegin', `<div style="background:#fde8e8;color:#8a1c1c;padding:10px 20px;font-size:13px">${msg}</div>`); });
