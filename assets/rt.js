/* Rt tab of the lower-left panel: each ticked model's estimates of the effective reproduction number
   (hub target `wk R_t`, optional) for the selected round and location, at every target end date the model
   gave (week 0 and, for some teams, earlier weeks). Consecutive weeks are drawn as a median line with
   shaded 50% and 95% bands; a week standing alone as a vertical interval (thin 95% bar, 50% box, median
   dot), side by side when several models give it. A dark line marks Rt = 1, with the growing side tinted
   orange and the declining side teal. Data: models[mid].rt[loc] = {dates, q: [[2.5, 25, 50, 75, 97.5%]],
   p_gt1} in the round file (pipeline/summarize.py rt_summary); models that sent only Rt are in the round
   with no case output. Same #cumChart SVG, legend and ticked models (selectedModels()) as the other tabs;
   clicking a model's interval, band or legend chip puts it on the map. */
const RI = { lo95: 0, lo50: 1, med: 2, hi50: 3, hi95: 4 };
const RT_UP = '#e07b39', RT_DOWN = '#2a9d8f';   // trend tab's increase / decrease colours
/** {dates, q, p_gt1} for a model and location in the current round, or null */
function rtLoc(id, loc) { const m = S.round && S.round.models[id]; return (m && m.rt && m.rt[loc]) || null; }
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

function drawRt() {
  const svg = document.getElementById('cumChart'), legend = document.getElementById('trendLegend');
  if (S.layout.hidden.has('cum')) return;   // panel hidden: drawn again when shown
  const W = svg.clientWidth || 360, loc = S.location, R0 = S.roundRef;
  document.getElementById('cumSub').textContent = t('rt.sub', { loc: locName(loc) });
  const ticked = R0 ? selectedModels() : [];
  const sel = ticked.map(id => ({ id, d: rtLoc(id, loc) })).filter(x => x.d);
  const missing = ticked.filter(id => id !== S.ensembleId && !rtLoc(id, loc));
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const empty = msg => { legend.innerHTML = ''; svg.setAttribute('height', 30);
    svg.innerHTML = `<text x="8" y="20" style="font-size:11px;fill:#5f6b7a;font-style:italic">${esc(msg)}</text>`; };
  if (!R0 || !roundHasRt()) return empty(t('rt.noRound'));
  if (!ticked.length) return empty(noneTickedNote());
  if (!sel.length) return empty(ticked.every(id => id === S.ensembleId) ? t('rt.ensOnly') : t('rt.noLoc', { loc: locName(loc) }));

  // legend: model chips (click: map), the band key, the Rt = 1 line, and ticked models without Rt here
  const sw = (fill, op) => `<i style="background:${fill};opacity:${op}"></i>`;
  legend.innerHTML = sel.map(x => `<span class="chip pick${x.id === S.mapModel ? ' onmap' : ''}" data-model="${x.id}" title="${esc(t(x.id === S.mapModel ? 'ts.leg.onMap' : 'ts.leg.mapTitle'))}"><i style="background:${modelColor(x.id)}"></i>${esc(modelLabel(x.id))}</span>`).join('')
    + `<span class="chip">${sw('#5f6b7a', 0.5)}${t('rt.i50')}</span><span class="chip">${sw('#5f6b7a', 0.2)}${t('rt.i95')}</span>`
    + `<span class="chip"><svg width="18" height="8" style="vertical-align:middle"><line x1="0" y1="4" x2="18" y2="4" stroke="#1b2430" stroke-width="1.5"/></svg>${t('rt.one')}</span>`
    + (missing.length ? `<span class="chip" style="font-style:italic">${esc(t('rt.missing', { list: missing.map(modelLabel).join(', ') }))}</span>` : '');

  const H = 230, mL = 36, mR = 8, mT = 10, mB = 32;
  svg.setAttribute('height', H);
  // x: one week per slot from the first to the last date any series gives, half a week of padding each side
  const dates = [...new Set(sel.flatMap(x => x.d.dates))].sort();
  const weeks = []; for (let w = dates[0]; w <= dates[dates.length - 1]; w = addDays(w, 7)) weeks.push(w);
  const slot = (W - mL - mR) / weeks.length, xOf = w => mL + (weeks.indexOf(w) + 0.5) * slot;
  // y: from 0 at the lowest, always including 1; very wide upper intervals are cut (arrow) at twice the 50% top
  const all = sel.flatMap(x => x.d.q);
  const hi50 = Math.max(1.1, ...all.map(q => q[RI.hi50])), hi95 = Math.max(...all.map(q => q[RI.hi95]));
  const cap = Math.max(1.1, Math.min(hi95, 2 * hi50)), lo = Math.max(0, Math.min(0.9, ...all.map(q => q[RI.lo95])));
  const step = rtStep((cap - lo) / 5), y0 = Math.floor(lo / step) * step, y1 = Math.ceil(cap / step) * step;
  const dec = (String(+step.toFixed(4)).split('.')[1] || '').length;
  const fmtRtick = v => { const str = v.toFixed(dec); return LANG === 'fr' ? str.replace('.', ',') : str; };
  const yOf = v => mT + (1 - (Math.min(v, y1) - y0) / (y1 - y0)) * (H - mT - mB);
  const textW = (str, fs) => { _mctx.font = `${fs}px ${getComputedStyle(svg).fontFamily}`; return _mctx.measureText(str).width; };

  let s = '';
  // growing / declining tints, grid, y labels
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
}
