/* Rt view (header toggle Cases | Rt): estimates of the effective reproduction number (hub target `wk R_t`,
   optional) from the models that sent it, with their own ticks and map model (app.js selection block,
   v = 'rt'). Data: models[mid].rt[loc] = {dates, q: [[2.5, 25, 50, 75, 97.5%]], p_gt1} in the round file
   (pipeline/summarize.py rt_summary); models that sent only Rt are in the round with no case output.
   - Rt over time (upper left, drawRtTime): each ticked Rt model's estimates for the selected location at
     every target end date it gave (week 0 and, for some teams, earlier weeks). Consecutive weeks are a median
     line with shaded 50% and 95% bands; a week standing alone a vertical interval (thin 95% bar, 50% box,
     median dot), side by side when several models give it. A dark line marks Rt = 1, the growing side
     tinted orange and the declining side teal. The mapped week is highlighted; clicking a week maps it,
     clicking a model's band or interval (or legend chip) puts that model on the map.
   - Rt by location (lower left, drawRtLoc): the map model's estimates for the mapped week, one row per
     location (the country and provinces, or the zones of the selected province on the zone layer), sorted
     by median, with the same Rt = 1 line; a click selects the location. */
const RI = { lo95: 0, lo50: 1, med: 2, hi50: 3, hi95: 4 };
const RT_UP = '#e07b39', RT_DOWN = '#2a9d8f';   // trend tab's increase / decrease colours
/** {dates, q, p_gt1} for a model and location in the current round, or null */
function rtLoc(id, loc) { const m = S.round && S.round.models[id]; return (m && m.rt && m.rt[loc]) || null; }
/** models of the current round with Rt for some location */
function rtModels() { return S.round ? Object.keys(S.round.models).filter(id => Object.keys(S.round.models[id].rt || {}).length).sort(sortModels) : []; }
/** weeks with Rt from any model or location in the current round, oldest first */
function rtWeeks() { const set = new Set(); rtModels().forEach(id => Object.values(S.round.models[id].rt).forEach(d => d.dates.forEach(w => set.add(w)))); return [...set].sort(); }
function roundHasRt() { const info = S.roundRef && S.manifest.rounds.find(r => r.reference_date === S.roundRef); return !!(info && info.rt); }
/** 1.01 / 1,01 */
const fmtR = v => { const s = v.toFixed(2); return LANG === 'fr' ? s.replace('.', ',') : s; };
/** P(Rt > 1) with the clamped tails (pipeline stores 0.99 / 0.01 beyond the submitted quantiles) */
const fmtRtP = p => p >= 0.99 ? `>${fmtPct(0.99)}` : p <= 0.01 ? `<${fmtPct(0.01)}` : fmtPct(p);
/** step of 1, 2, 2.5 or 5 x 10^k at least raw */
function rtStep(raw) {
  const k = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map(f => f * k).find(s => s >= raw - 1e-12);
}

const rtEsc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** y (or x) range for Rt values: from 0 at the lowest, always including 1; very wide upper intervals are
    cut at twice the highest 50% top. Returns {lo, hi, step, fmt} with round tick steps. */
function rtRange(qs) {
  const hi50 = Math.max(1.1, ...qs.map(q => q[RI.hi50])), hi95 = Math.max(...qs.map(q => q[RI.hi95]));
  const cap = Math.max(1.1, Math.min(hi95, 2 * hi50)), lo = Math.max(0, Math.min(0.9, ...qs.map(q => q[RI.lo95])));
  const step = rtStep((cap - lo) / 5), dec = (String(+step.toFixed(4)).split('.')[1] || '').length;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(cap / step) * step, step,
    fmt: v => { const str = v.toFixed(dec); return LANG === 'fr' ? str.replace('.', ',') : str; } };
}
const rtNote = (svg, msg, legend) => { if (legend) legend.innerHTML = ''; svg.setAttribute('height', 30); svg.onmousemove = svg.onclick = null;
  svg.innerHTML = `<text x="8" y="20" style="font-size:11px;fill:#5f6b7a;font-style:italic">${rtEsc(msg)}</text>`; };

function drawRtTime() {
  const svg = document.getElementById('rtChart'), legend = document.getElementById('rtLegend');
  if (S.layout.hidden.has('weekly')) return;   // panel hidden: drawn again when shown
  const W = svg.clientWidth || 360, loc = S.location, R0 = S.roundRef;
  document.getElementById('rtTimeSub').textContent = locName(loc);
  const ticked = R0 ? selectedModels('rt') : [];
  const sel = ticked.map(id => ({ id, d: rtLoc(id, loc) })).filter(x => x.d);
  const missing = ticked.filter(id => !rtLoc(id, loc));
  const esc = rtEsc, empty = msg => { svg.removeAttribute('height'); rtNote(svg, msg, legend); };
  if (!R0 || !roundHasRt()) return empty(t('rt.noRound'));
  if (!ticked.length) return empty(noneTickedNote('rt'));
  if (!sel.length) return empty(t('rt.noLoc', { loc: locName(loc) }));

  // legend: model chips (click: map), the band key, the Rt = 1 line, and ticked models without Rt here
  const sw = (fill, op) => `<i style="background:${fill};opacity:${op}"></i>`;
  legend.innerHTML = sel.map(x => `<span class="chip pick${x.id === S.rtMapModel ? ' onmap' : ''}" data-model="${x.id}" title="${esc(t(x.id === S.rtMapModel ? 'ts.leg.onMap' : 'ts.leg.mapTitle'))}"><i style="background:${modelColor(x.id)}"></i>${esc(modelLabel(x.id))}</span>`).join('')
    + `<span class="chip">${sw('#5f6b7a', 0.5)}${t('rt.i50')}</span><span class="chip">${sw('#5f6b7a', 0.2)}${t('rt.i95')}</span>`
    + `<span class="chip"><svg width="18" height="8" style="vertical-align:middle"><line x1="0" y1="4" x2="18" y2="4" stroke="#1b2430" stroke-width="1.5"/></svg>${t('rt.one')}</span>`
    + (missing.length ? `<span class="chip" style="font-style:italic">${esc(t('rt.missing', { list: missing.map(modelLabel).join(', ') }))}</span>` : '');

  svg.removeAttribute('height');   // fills the panel (CSS flex); measured after the legend is in place
  const H = Math.max(160, svg.clientHeight || 230), mL = 36, mR = 8, mT = 10, mB = 32;
  // x: one week per slot from the first to the last date any series gives, half a week of padding each side
  const dates = [...new Set(sel.flatMap(x => x.d.dates))].sort();
  const weeks = []; for (let w = dates[0]; w <= dates[dates.length - 1]; w = addDays(w, 7)) weeks.push(w);
  const slot = (W - mL - mR) / weeks.length, xOf = w => mL + (weeks.indexOf(w) + 0.5) * slot;
  // y: rtRange (0 floor, includes 1, very wide upper intervals cut with an arrow)
  const rg = rtRange(sel.flatMap(x => x.d.q)), y0 = rg.lo, y1 = rg.hi, step = rg.step, fmtRtick = rg.fmt;
  const yOf = v => mT + (1 - (Math.min(v, y1) - y0) / (y1 - y0)) * (H - mT - mB);
  const textW = (str, fs) => { _mctx.font = `${fs}px ${getComputedStyle(svg).fontFamily}`; return _mctx.measureText(str).width; };

  let s = '';
  // mapped week, growing / declining tints, grid, y labels
  if (weeks.includes(S.rtWeek)) s += `<rect x="${xOf(S.rtWeek) - slot / 2 + 1}" y="${mT}" width="${slot - 2}" height="${H - mT - mB + 26}" fill="var(--accent)" opacity="0.08"/>`;
  const y1line = yOf(1);
  s += `<rect x="${mL}" y="${mT}" width="${W - mL - mR}" height="${y1line - mT}" fill="${RT_UP}" opacity="0.06"/>`;
  s += `<rect x="${mL}" y="${y1line}" width="${W - mL - mR}" height="${H - mB - y1line}" fill="${RT_DOWN}" opacity="0.06"/>`;
  for (let v = y0; v <= y1 + 1e-9; v += step) { const yy = yOf(v);
    s += `<line x1="${mL}" y1="${yy}" x2="${W - mR}" y2="${yy}" stroke="var(--line)"/>`;
    s += `<text x="${mL - 5}" y="${yy + 3}" text-anchor="end" style="font-size:9px">${fmtRtick(v)}</text>`; }
  // x labels: date, then the week relative to the round (labels thinned when crowded)
  const lw = Math.max(...weeks.map(w => textW(fmtDate(w), 9))) + 10, every = Math.max(1, Math.ceil(lw / slot));
  weeks.forEach((w, i) => { if ((weeks.length - 1 - i) % every) return; const xx = xOf(w);
    s += `<text x="${xx}" y="${H - mB + 13}" text-anchor="middle" style="font-size:9px">${fmtDate(w)}</text>`;
    s += `<text x="${xx}" y="${H - mB + 24}" text-anchor="middle" style="font-size:8.5px;fill:#8a94a3">${weekRelLabel(w)}</text>`; });
  s += `<text x="${mL + 5}" y="${mT + 11}" style="font-size:9px;font-style:italic;fill:${RT_UP}">${t('rt.growing')}</text>`;
  s += `<text x="${mL + 5}" y="${H - mB - 5}" style="font-size:9px;font-style:italic;fill:${RT_DOWN}">${t('rt.declining')}</text>`;

  // each series: runs of consecutive weeks as bands + median line; lone weeks as dodged intervals
  const lone = {};   // date -> series indices drawing a lone interval there (for the side-by-side offset)
  sel.forEach((x, k) => { x.runs = []; let run = [];
    x.d.dates.forEach((w, i) => { if (run.length && addDays(x.d.dates[run[run.length - 1]], 7) !== w) { x.runs.push(run); run = []; } run.push(i); });
    if (run.length) x.runs.push(run);
    x.runs.filter(r => r.length === 1).forEach(r => (lone[x.d.dates[r[0]]] = lone[x.d.dates[r[0]]] || []).push(k)); });
  const inRun = new Set(sel.flatMap(x => x.runs.filter(r => r.length > 1).flatMap(r => r.map(i => x.d.dates[i]))));
  const bw = Math.max(6, Math.min(16, slot * 0.7 / Math.max(1, ...Object.values(lone).map(a => a.length))));
  const arrow = (xx, col) => `<path d="M${xx - 3.5} ${yOf(y1) + 5} L${xx} ${yOf(y1)} L${xx + 3.5} ${yOf(y1) + 5} Z" fill="${col}"/>`;
  sel.forEach((x, k) => { const col = modelColor(x.id), q = x.d.q;
    let g = '';
    x.runs.forEach(r => {
      if (r.length > 1) {
        const band = (a, b) => r.map(i => `${xOf(x.d.dates[i])},${yOf(q[i][a])}`).join(' ') + ' ' + r.slice().reverse().map(i => `${xOf(x.d.dates[i])},${yOf(q[i][b])}`).join(' ');
        g += `<polygon points="${band(RI.hi95, RI.lo95)}" fill="${col}" opacity="0.15"/>`;
        g += `<polygon points="${band(RI.hi50, RI.lo50)}" fill="${col}" opacity="0.3"/>`;
        g += `<polyline points="${r.map(i => `${xOf(x.d.dates[i])},${yOf(q[i][RI.med])}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>`;
        r.forEach(i => { g += `<circle cx="${xOf(x.d.dates[i])}" cy="${yOf(q[i][RI.med])}" r="2.8" fill="${col}" stroke="#fff" stroke-width="1"/>`;
          if (q[i][RI.hi95] > y1) g += arrow(xOf(x.d.dates[i]), col); });
      } else {
        // a band's point at the same week: the lone intervals step aside to its right
        const i = r[0], w = x.d.dates[i], grp = lone[w], j = grp.indexOf(k), xx = xOf(w) + (inRun.has(w) ? (j + 0.9) * bw : (j - (grp.length - 1) / 2) * bw);
        g += `<line x1="${xx}" y1="${yOf(q[i][RI.lo95])}" x2="${xx}" y2="${yOf(q[i][RI.hi95])}" stroke="${col}" stroke-width="1.5" opacity="0.8"/>`;
        g += `<rect x="${xx - bw * 0.3}" y="${yOf(q[i][RI.hi50])}" width="${bw * 0.6}" height="${Math.max(1, yOf(q[i][RI.lo50]) - yOf(q[i][RI.hi50]))}" fill="${col}" fill-opacity="0.35" stroke="${col}" stroke-width="1.2"/>`;
        g += `<circle cx="${xx}" cy="${yOf(q[i][RI.med])}" r="3.2" fill="${col}" stroke="#fff" stroke-width="1"/>`;
        if (q[i][RI.hi95] > y1) g += arrow(xx, col);
      } });
    s += `<g class="rtser" data-model="${x.id}">${g}</g>`; });
  // Rt = 1 on top of the series
  s += `<line x1="${mL}" y1="${y1line}" x2="${W - mR}" y2="${y1line}" stroke="#1b2430" stroke-width="1.5"/>`;
  const oneW = textW(t('rt.one'), 9) + 6;
  s += `<rect x="${W - mR - oneW - 2}" y="${y1line - 12}" width="${oneW}" height="11" fill="var(--panel)" opacity="0.85"/>`;
  s += `<text x="${W - mR - 5}" y="${y1line - 3}" text-anchor="end" style="font-size:9px;font-weight:600;fill:#1b2430">${t('rt.one')}</text>`;
  svg.innerHTML = s;

  // tooltip: every series at the hovered week
  svg.onmousemove = e => { const r = svg.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - mL) / slot), w = weeks[i];
    if (w == null || e.clientX - r.left < mL) return hideTip();
    const rows = sel.map(x => ({ x, j: x.d.dates.indexOf(w) })).filter(o => o.j >= 0);
    if (!rows.length) return hideTip();
    showTip(`<b>${t('rt.tipHead', { d: fmtDate(w, true) })}</b> <span class="sm">· ${weekRelLabel(w)}</span>`
      + rows.map(({ x, j }) => { const q = x.d.q[j];
        return `<div class="row"><span style="color:${modelColor(x.id)}">${esc(modelLabel(x.id))}</span><b>${fmtR(q[RI.med])}</b></div>`
          + `<div class="sm">${t('rt.tipIv', { r50: `${fmtR(q[RI.lo50])}–${fmtR(q[RI.hi50])}`, r95: `${fmtR(q[RI.lo95])}–${fmtR(q[RI.hi95])}` })} · ${t('rt.pGt1', { p: fmtRtP(x.d.p_gt1[j]) })}</div>`; }).join('')
      + `<div class="sm" style="margin-top:4px">${t('tip.clickModelMap')}</div>`, e.clientX, e.clientY); };
  svg.onmouseleave = hideTip;
  // a click on a week (not on a model's band or interval, which maps the model) maps that week
  svg.onclick = e => { if (e.target.closest('[data-model]')) return;
    const w = weeks[Math.floor((e.clientX - svg.getBoundingClientRect().left - mL) / slot)];
    if (w && rtWeeks().includes(w) && w !== S.rtWeek) setRtWeek(w); };
}

function drawRtLoc() {
  const svg = document.getElementById('rtLocChart');
  if (S.layout.hidden.has('cum')) return;
  const W = svg.clientWidth || 360, m = S.rtMapModel, w = S.rtWeek, esc = rtEsc;
  const zones = S.mapLayer === 'hz' && locProvince(S.location), prov = zones || null;
  document.getElementById('rtLocSub').textContent = m && w ? t('rtloc.sub', { name: modelLabel(m), d: fmtDate(w), rel: weekRelLabel(w) }) : '';
  if (!S.roundRef || !roundHasRt()) return rtNote(svg, t('rt.noRound'));
  if (!m) return rtNote(svg, noneTickedNote('rt'));
  // the level shown on the map: the country and provinces, or a province and its zones
  const head = prov ? [prov] : [NATIONAL], body = prov ? zonesOf(prov).map(l => l.code) : provinces().map(l => l.code);
  const row = code => { const d = rtLoc(m, code), i = d ? d.dates.indexOf(w) : -1; return i < 0 ? null : { code, q: d.q[i], p: d.p_gt1[i] }; };
  const top = head.map(row).filter(Boolean), rows = body.map(row).filter(Boolean).sort((a, b) => b.q[RI.med] - a.q[RI.med]);
  const all = [...top, ...rows], nMissing = body.length - rows.length;
  if (!all.length) return rtNote(svg, t('rtloc.empty', { name: modelLabel(m) }));
  const textW = (str, fs, bold) => { _mctx.font = `${bold ? '600 ' : ''}${fs}px ${getComputedStyle(svg).fontFamily}`; return _mctx.measureText(str).width; };
  const name = code => code === NATIONAL ? t('loc.national') : (locInfo(code) || {}).name || code;
  const val = r => `${fmtR(r.q[RI.med])}  ${fmtRtP(r.p)}`;
  const mL = Math.min(W * 0.32, Math.max(...all.map(r => textW(name(r.code), 10, r.code === S.location))) + 12);
  const mR = Math.max(textW(t('rtloc.colHead'), 8.5), ...all.map(r => textW(val(r), 9.5))) + 22, rowH = 17, mT = 26, gap = top.length && rows.length ? 6 : 0;
  const H = mT + all.length * rowH + gap + (nMissing ? 18 : 6);
  svg.setAttribute('height', H);
  const rg = rtRange(all.map(r => r.q)), x0 = mL, x1 = W - mR, xOf = v => x0 + (Math.min(v, rg.hi) - rg.lo) / (rg.hi - rg.lo) * (x1 - x0);
  const yEnd = mT + all.length * rowH + gap;
  let s = '';
  s += `<rect x="${x0}" y="${mT - 4}" width="${xOf(1) - x0}" height="${yEnd - mT + 4}" fill="${RT_DOWN}" opacity="0.06"/>`;
  s += `<rect x="${xOf(1)}" y="${mT - 4}" width="${x1 - xOf(1)}" height="${yEnd - mT + 4}" fill="${RT_UP}" opacity="0.06"/>`;
  for (let v = rg.lo; v <= rg.hi + 1e-9; v += rg.step) { const xx = xOf(v);
    s += `<line x1="${xx}" y1="${mT - 4}" x2="${xx}" y2="${yEnd}" stroke="var(--line)"/>`;
    s += `<text x="${xx}" y="${mT - 9}" text-anchor="middle" style="font-size:9px">${rg.fmt(v)}</text>`; }
  s += `<text x="${x1 + 14}" y="${mT - 9}" style="font-size:8.5px;fill:#8a94a3">${t('rtloc.colHead')}</text>`;
  const col = modelColor(m);
  all.forEach((r, k) => { const y = mT + k * rowH + (k >= top.length ? gap : 0) + rowH / 2, q = r.q, sel = r.code === S.location;
    if (sel) s += `<rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="var(--accent)" opacity="0.1"/>`;
    s += `<g class="rtrow" data-loc="${r.code}" style="cursor:pointer"><rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="transparent"/>`;
    s += `<text x="${mL - 8}" y="${y + 3.5}" text-anchor="end" style="font-size:10px;${sel ? 'font-weight:600;fill:#1b2430' : 'fill:#5f6b7a'}">${esc(name(r.code))}</text>`;
    s += `<line x1="${xOf(q[RI.lo95])}" y1="${y}" x2="${xOf(q[RI.hi95])}" y2="${y}" stroke="${col}" stroke-width="1.5" opacity="0.8"/>`;
    s += `<rect x="${xOf(q[RI.lo50])}" y="${y - 4.5}" width="${Math.max(1, xOf(q[RI.hi50]) - xOf(q[RI.lo50]))}" height="9" fill="${col}" fill-opacity="0.35" stroke="${col}" stroke-width="1.2"/>`;
    s += `<circle cx="${xOf(q[RI.med])}" cy="${y}" r="3.2" fill="${col}" stroke="#fff" stroke-width="1"/>`;
    if (q[RI.hi95] > rg.hi) s += `<path d="M${x1 - 5} ${y - 3.5} L${x1} ${y} L${x1 - 5} ${y + 3.5} Z" fill="${col}"/>`;
    s += `<text x="${x1 + 14}" y="${y + 3.5}" style="font-size:9.5px;fill:#1b2430">${fmtR(q[RI.med])}<tspan style="fill:#8a94a3"> · ${fmtRtP(r.p)}</tspan></text></g>`; });
  s += `<line x1="${xOf(1)}" y1="${mT - 4}" x2="${xOf(1)}" y2="${yEnd}" stroke="#1b2430" stroke-width="1.5"/>`;
  if (nMissing) s += `<text x="${mL}" y="${H - 5}" style="font-size:9px;fill:#8a94a3;font-style:italic">${esc(tn(prov ? 'rtloc.missingZones' : 'rtloc.missingProv', nMissing))}</text>`;
  svg.innerHTML = s;
  svg.onclick = e => { const g = e.target.closest('.rtrow'); if (g) selectLocation(g.dataset.loc); };
  svg.onmousemove = e => { const g = e.target.closest('.rtrow'); if (!g) return hideTip();
    const r = all.find(x => x.code === g.dataset.loc), q = r.q;
    showTip(`<b>${esc(locName(r.code))}</b> <span class="sm">· ${t('rt.tipHead', { d: fmtDate(w, true) })}</span>`
      + `<div class="row"><span style="color:${col}">${esc(modelLabel(m))}</span><b>${fmtR(q[RI.med])}</b></div>`
      + `<div class="sm">${t('rt.tipIv', { r50: `${fmtR(q[RI.lo50])}–${fmtR(q[RI.hi50])}`, r95: `${fmtR(q[RI.lo95])}–${fmtR(q[RI.hi95])}` })} · ${t('rt.pGt1', { p: fmtRtP(r.p) })}</div>`
      + `<div class="sm" style="margin-top:4px">${t(r.code === S.location ? 'rtloc.selected' : 'rtloc.click')}</div>`, e.clientX, e.clientY); };
  svg.onmouseleave = hideTip;
}
