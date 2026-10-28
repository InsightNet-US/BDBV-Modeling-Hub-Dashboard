/* Weekly confirmed cases by week of symptom onset: reported (round data version), latest data
   overlay, nowcast/forecast from the ensemble (hub or dashboard; dotted outline + optional interval) and
   selected team models (points + 95% intervals). */
function drawTS() {
  const svg = document.getElementById('tsChart'), empty = document.getElementById('tsEmpty');
  const R = S.roundRef, loc = S.location, maxH = Math.max(0, ...(S.manifest.horizons || [3]));
  const legend = document.getElementById('tsLegend');
  if (S.layout.hidden.has('weekly')) return;   // panel hidden: drawn again when shown
  svg.innerHTML = ''; empty.style.display = 'none';
  if (!S.obsRound) { document.getElementById('tsBrush').innerHTML = ''; return; }

  const obs = obsMap(S.obsRound, loc), latest = obsMap(S.obsLatest, loc);
  const haveLatest = S.obsLatest && S.obsLatest.as_of !== S.obsRound.as_of;
  const asOf = S.obsRound.as_of, lastComplete = S.obsRound.last_complete_week;

  // weeks: union of observed weeks and round weeks, contiguous Saturdays
  let allWeeks = S.round ? S.round.weeks.slice() : S.obsRound.weeks.slice();
  if (S.round) { const ow = S.obsRound.weeks; if (ow[0] < allWeeks[0]) { let w = ow[0]; const pre = []; while (w < allWeeks[0]) { pre.push(w); w = addDays(w, 7); } allWeeks = pre.concat(allWeeks); } }
  const nowIdxAll = R ? allWeeks.indexOf(R) : allWeeks.indexOf(lastComplete);
  const [i0, i1] = weekWindow(allWeeks, nowIdxAll);   // the brush strip's window (default: recent weeks)
  const weeks = allWeeks.slice(i0, i1 + 1);
  const nowIdx = R ? weeks.indexOf(R) : -1;
  const total = weeks.length;
  const mapIdx = S.mapWeek ? weeks.indexOf(S.mapWeek) : -1, mappable = S.round ? new Set(roundWeeks()) : new Set();

  // models
  const ens = S.ensembleId ? modelLoc(S.ensembleId, loc) : null;
  const showEnsCI = !!(ens && S.tsSelected.has(S.ensembleId)), dash = S.ensembleSource === 'dashboard';
  const teams = roundModels().filter(id => id !== S.ensembleId && S.tsSelected.has(id)).map(id => ({ id, name: modelLabel(id), color: modelColor(id), m: modelLoc(id, loc) })).filter(tm => tm.m);
  const anyModel = ens || teams.length;
  const qAt = (m, w) => { const i = m.weeks.indexOf(w); return i < 0 ? null : m.q[i]; };

  document.getElementById('tsSub').textContent = [locName(loc), R ? t('ts.sub.ref', { d: fmtDate(R, true) }) : '', t('ts.sub.asOf', { d: asOf })].filter(Boolean).join(' · ');
  legend.innerHTML = `<span class="chip"><i style="background:var(--past)"></i>${t('ts.leg.reported', { d: fmtDate(asOf) })}</span>`
    + `<span class="chip"><i style="background:repeating-linear-gradient(135deg,var(--past) 0 2px,#fff 2px 4px)"></i>${t('ts.leg.inProgress')}</span>`
    + (haveLatest ? `<span class="chip"><i style="border:1.5px solid var(--latest);background:transparent"></i>${t('ts.leg.latest', { d: fmtDate(S.obsLatest.as_of) })}</span>` : '')
    + (ens ? `<span class="chip"><i style="border:1.5px dashed var(--median);background:transparent"></i>${dash ? t(showEnsCI ? 'ts.leg.ensMedianCIDash' : 'ts.leg.ensMedianDash') : t(showEnsCI ? 'ts.leg.ensMedianCI' : 'ts.leg.ensMedian')}</span>` : '')
    + teams.map(tm => `<span class="chip"><i style="background:${tm.color}"></i>${tm.name}</span>`).join('')
    + (mapIdx >= 0 ? `<span class="chip"><i style="background:var(--accent);opacity:.35"></i>${t('ts.leg.weekOnMap')}</span>` : '');

  if (S.round && !anyModel && roundModels().length) {
    empty.style.display = 'block';
    const others = modelsForLocation(loc).filter(id => id !== S.ensembleId);
    if (others.length) empty.innerHTML = tn('ts.emptyOthers', others.length, { loc: locName(loc), list: others.map(modelLabel).join(', ') });
    else empty.innerHTML = t(loc === NATIONAL ? 'ts.emptyNational' : 'ts.emptyLoc', { loc: locName(loc) });
  } else if (!S.round) {
    empty.style.display = 'block';
    empty.innerHTML = t('ts.emptyNoSub', { d: fmtDate(S.manifest.accepted_reference_dates[0] || '', true) });
  }
  // measure after the header (sub + legend) has been updated, since it can wrap and change the height
  const W = svg.clientWidth || 600, H = svg.clientHeight || 300;
  const mL = 42, mR = 12, mT = 18, mB = 36, iw = W - mL - mR, ih = H - mT - mB;

  // y scale
  let vals = [1];
  weeks.forEach(w => {
    if (obs[w] != null) vals.push(obs[w]);
    if (haveLatest && latest[w] != null) vals.push(latest[w]);
    if (ens) { const q = qAt(ens, w); if (q) vals.push(q[QI.med], showEnsCI ? q[QI.hi95] : 0); }
    teams.forEach(tm => { const q = qAt(tm.m, w); if (q) vals.push(q[QI.hi95]); });
  });
  // round ticks (niceAxis in app.js): 4 to 8 of them, axis top at most 25% above the data max
  const ax = niceAxis(Math.max(...vals) * 1.08), step = ax.step, ticks = ax.n, ymax = ax.top;
  const slotW = iw / total, barW = Math.min(slotW * 0.66, 26);
  const bx = i => mL + (i + 0.5) * slotW, edge = i => mL + i * slotW;
  const y = v => mT + ih - (v / ymax) * ih, y0 = y(0);

  let s = `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#fff"/><rect width="2" height="4" fill="var(--past)"/></pattern></defs>`;
  for (let g = 0; g <= ticks; g++) { const val = step * g, yy = y(val);
    s += `<line x1="${mL}" y1="${yy}" x2="${W - mR}" y2="${yy}" stroke="var(--line)"/>`;
    s += `<text x="${mL - 6}" y="${yy + 3}" text-anchor="end">${fmtN(val)}</text>`; }
  s += `<line x1="${mL}" y1="${y0}" x2="${W - mR}" y2="${y0}" stroke="var(--muted)"/>`;
  // x axis: tick every week, label at first week of each month (or every 4 weeks when crowded)
  // label the first Saturday of each month (skip a label that would collide with the previous one)
  let lastMonth = weeks.length ? weeks[0].slice(0, 7) : null, lastLabelX = -Infinity;
  weeks.forEach((w, i) => {
    s += `<line x1="${bx(i)}" y1="${y0}" x2="${bx(i)}" y2="${y0 + 4}" stroke="var(--muted)"/>`;
    const m = w.slice(0, 7);
    if (m !== lastMonth && bx(i) - lastLabelX > (LANG === 'fr' ? 52 : 44)) { s += `<text x="${bx(i)}" y="${y0 + 16}" text-anchor="middle">${fmtDate(w)}</text>`; lastLabelX = bx(i); }
    lastMonth = m;
  });
  s += `<text x="${mL}" y="${H - 4}" style="fill:#5b6675;font-size:9px">${t('ts.axis')}</text>`;

  // forecast window shading: week 0 (the reference week) through the longest horizon
  if (nowIdx >= 0) {
    const hx0 = edge(nowIdx), hx1 = edge(Math.min(total, nowIdx + 1 + maxH));
    if (hx1 > hx0) s += `<rect x="${hx0}" y="${mT}" width="${hx1 - hx0}" height="${ih}" fill="var(--accent)" opacity="0.07"/>`;
  }
  // the week currently shown on the map
  if (mapIdx >= 0) {
    s += `<rect x="${edge(mapIdx)}" y="${mT}" width="${slotW}" height="${ih}" fill="var(--accent)" opacity="0.13"/>`;
    s += `<rect x="${edge(mapIdx)}" y="${mT}" width="${slotW}" height="3" fill="var(--accent)" opacity="0.6"/>`;
  }

  // bars
  weeks.forEach((w, i) => {
    const cx = bx(i), x0 = cx - barW / 2;
    const rep = obs[w], partial = w > lastComplete;
    const eq = ens ? qAt(ens, w) : null;
    if (eq) { const top = y(eq[QI.med]);
      s += `<rect x="${x0}" y="${top}" width="${barW}" height="${Math.max(0, y0 - top)}" fill="none" stroke="var(--median)" stroke-width="1.5" stroke-dasharray="3 3" rx="2"/>`; }
    if (rep > 0) { const top = y(rep);
      s += `<rect x="${x0}" y="${top}" width="${barW}" height="${y0 - top}" fill="${partial ? 'url(#hatch)' : 'var(--past)'}" rx="2"/>`;
      if (partial) s += `<rect x="${x0}" y="${top}" width="${barW}" height="${y0 - top}" fill="none" stroke="var(--past)" stroke-width="1" rx="2"/>`; }
    if (haveLatest && latest[w] != null && latest[w] !== rep) { const top = y(latest[w]);
      s += `<rect x="${x0 - 1.5}" y="${top}" width="${barW + 3}" height="${Math.max(0, y0 - top)}" fill="none" stroke="var(--latest)" stroke-width="1.2" opacity="0.7" rx="2"/>`; }
    // ensemble intervals: thin 95% whisker with caps, thicker 50% segment over it
    if (showEnsCI && eq && eq[QI.hi95] > eq[QI.lo95]) { const yl = y(eq[QI.lo95]), yh = y(eq[QI.hi95]), cap = Math.min(barW * 0.32, 7);
      s += `<line x1="${cx}" y1="${yh}" x2="${cx}" y2="${yl}" stroke="var(--muted)" stroke-width="1.5"/>`;
      s += `<line x1="${cx - cap}" y1="${yh}" x2="${cx + cap}" y2="${yh}" stroke="var(--muted)" stroke-width="1.5"/>`;
      s += `<line x1="${cx - cap}" y1="${yl}" x2="${cx + cap}" y2="${yl}" stroke="var(--muted)" stroke-width="1.5"/>`;
      s += `<line x1="${cx}" y1="${y(eq[QI.hi50])}" x2="${cx}" y2="${y(eq[QI.lo50])}" stroke="var(--muted)" stroke-width="5" stroke-linecap="butt" opacity="0.55"/>`; }
    // team overlays
    const nB = teams.length, jw = slotW * 0.26;
    teams.forEach((tm, k) => { const q = qAt(tm.m, w); if (!q) return;
      const off = (nB <= 1 ? 0 : (k / (nB - 1) - 0.5)) * 2 * jw, x = cx + off;
      s += `<line x1="${x}" y1="${y(q[QI.hi95])}" x2="${x}" y2="${y(q[QI.lo95])}" stroke="${tm.color}" stroke-width="1.5" opacity="0.6"/>`;
      s += `<line x1="${x - 2}" y1="${y(q[QI.hi95])}" x2="${x + 2}" y2="${y(q[QI.hi95])}" stroke="${tm.color}" stroke-width="1.5" opacity="0.8"/>`;
      s += `<line x1="${x - 2}" y1="${y(q[QI.lo95])}" x2="${x + 2}" y2="${y(q[QI.lo95])}" stroke="${tm.color}" stroke-width="1.5" opacity="0.8"/>`;
      s += `<line x1="${x}" y1="${y(q[QI.hi50])}" x2="${x}" y2="${y(q[QI.lo50])}" stroke="${tm.color}" stroke-width="4.5" opacity="0.55"/>`;
      s += `<circle cx="${x}" cy="${y(q[QI.med])}" r="3" fill="${tm.color}" stroke="#fff" stroke-width="0.6"/>`; });
    s += `<rect class="hit" data-i="${i}" x="${cx - slotW / 2}" y="${mT}" width="${slotW}" height="${ih}" fill="transparent"/>`;
  });

  if (nowIdx >= 0) {
    // faint guide between the last closed week (nowcast) and the reference week (forecast week 0)
    const nx = edge(nowIdx);
    s += `<line x1="${nx}" y1="${mT}" x2="${nx}" y2="${mT + ih}" stroke="var(--now)" stroke-width="1" opacity="0.35" stroke-dasharray="2 3"/>`;
  }
  svg.innerHTML = s;
  drawBrush(allWeeks, i0, i1, obs, mL, mR);

  svg.querySelectorAll('.hit').forEach(r => {
    r.addEventListener('mousemove', e => {
      const i = +r.dataset.i, w = weeks[i], rel = nowIdx >= 0 ? i - nowIdx : null;
      const hasModelHere = (ens && qAt(ens, w)) || teams.some(tm => qAt(tm.m, w));
      const kind = rel == null ? '' : rel === 0 ? t('tip.kindFc0') : rel > 0 ? t('tip.kindFc', { n: rel }) : hasModelHere ? t('tip.kindNc') : '';
      let rows = '';
      if (obs[w] != null) rows += `<div class="row"><span>${t('tip.reported', { d: fmtDate(asOf) })}${w > lastComplete ? ` <span class="sm">${t('tip.inProgress')}</span>` : ''}</span><b>${fmtN(obs[w])}</b></div>`;
      else if (rel != null && rel <= 0) rows += `<div class="row"><span>${t('tip.reportedLbl')}</span><b>${t('tip.noData')}</b></div>`;
      if (haveLatest && latest[w] != null) rows += `<div class="row"><span>${t('tip.latest', { d: fmtDate(S.obsLatest.as_of) })}</span><b>${fmtN(latest[w])}</b></div>`;
      if (ens) {
        const q = qAt(ens, w), nm = ens.n_models_wk ? ens.n_models_wk[ens.weeks.indexOf(w)] : null;
        if (q) rows += `<div class="row"><span style="color:var(--median)">${t(dash ? 'tip.ensembleDash' : 'tip.ensemble')}${nm ? ` <span class="sm">${tn('tip.ensModels', nm)}</span>` : ''}</span><b>${fmtN(q[QI.med])} <span class="sm">${t('tip.ranges', { r50: fmtRange(q, 50), r95: fmtRange(q) })}</span></b></div>`;
      }
      teams.forEach(tm => { const q = qAt(tm.m, w); if (q) rows += `<div class="row"><span style="color:${tm.color}">${tm.name}</span><b>${fmtN(q[QI.med])} <span class="sm">${t('tip.ranges', { r50: fmtRange(q, 50), r95: fmtRange(q) })}</span></b></div>`; });
      const hasModel = (ens && qAt(ens, w)) || teams.some(tm => qAt(tm.m, w));
      const mapHint = mappable.has(w) ? `<div class="sm" style="margin-top:4px">${t(w === S.mapWeek ? 'tip.shownOnMap' : 'tip.clickMap')}</div>` : '';
      showTip(`<b>${t('tip.weekEnding', { d: fmtDate(w, true) })}</b>${kind}${rows}${mapHint}${hasModel ? synNote() : ''}`, e.clientX, e.clientY);
    });
    r.addEventListener('mouseleave', hideTip);
    r.addEventListener('click', () => { const w = weeks[+r.dataset.i]; if (mappable.has(w) && w !== S.mapWeek) setMapWeek(w); });
  });
}

/* ---------- week-window brush under the chart ----------
   S.layout.weeks is null (default window) or {start, end} with ISO Saturdays or the sentinels 'first' /
   'last' (a side dragged to the strip's end follows the data as new weeks arrive). Persisted with the
   panel layout (bdbv-layout, ?weeks=start,end, Reset layout). */
const BRUSH_MIN = 4;
let BRUSH = null;   // what drawBrush last rendered: {weeks, n, i0, i1, mL, mR}

/** [i0, i1] inclusive indices into allWeeks. Default: 24 weeks ending 4 weeks after the reference week. */
function weekWindow(allWeeks, nowIdxAll) {
  const n = allWeeks.length, minW = Math.min(BRUSH_MIN, n);
  const end = Math.min(n, (nowIdxAll >= 0 ? nowIdxAll : n - 1) + 4);
  const dflt = [Math.max(0, end - 24), Math.max(0, end - 1)];
  const w = S.layout.weeks;
  if (!w || !n) return dflt;
  let i0 = w.start === 'first' ? 0 : allWeeks.findIndex(x => x >= w.start);
  let i1 = w.end === 'last' ? n - 1 : -1;
  if (w.end !== 'last') allWeeks.forEach((x, k) => { if (x <= w.end) i1 = k; });
  if (i0 < 0) i0 = n - 1;   // start after the last week
  if (i1 < 0) i1 = 0;       // end before the first week
  if (i0 > i1 || i1 - i0 + 1 < minW) return dflt;
  return [i0, i1];
}

function drawBrush(allWeeks, i0, i1, obs, mL, mR) {
  const b = document.getElementById('tsBrush'); if (!b) return;
  const W = b.clientWidth || 600, H = b.clientHeight || 38, n = allWeeks.length;
  const labels = W >= 320, top = 3, bh = H - top - (labels ? 12 : 3);
  const slot = (W - mL - mR) / Math.max(1, n), x = i => mL + i * slot;
  const vals = allWeeks.map(w => obs[w] || 0), vmax = Math.max(1, ...vals);
  let s = '';
  const rw = S.round ? roundWeeks() : [];   // band over the weeks with model output (nowcast + forecast)
  if (rw.length) { const a = allWeeks.indexOf(rw[0]), z = allWeeks.indexOf(rw[rw.length - 1]);
    if (a >= 0 && z >= 0) s += `<rect x="${x(a)}" y="${top}" width="${x(z + 1) - x(a)}" height="${bh}" fill="var(--now)" opacity="0.1"/>`; }
  vals.forEach((v, i) => { if (v > 0) { const h = Math.max(1, v / vmax * bh);
    s += `<rect x="${x(i) + slot * 0.15}" y="${top + bh - h}" width="${Math.max(1, slot * 0.7)}" height="${h}" fill="var(--past)" opacity="0.45"/>`; } });
  s += `<line x1="${mL}" y1="${top + bh}" x2="${W - mR}" y2="${top + bh}" stroke="var(--line)"/>`;
  const wx0 = x(i0), wx1 = x(i1 + 1);
  s += `<rect class="brush-win" x="${wx0}" y="${top - 1}" width="${wx1 - wx0}" height="${bh + 2}" rx="2"/>`;
  s += `<rect class="brush-h" data-side="start" x="${wx0 - 3.5}" y="${top + 1}" width="7" height="${bh - 2}" rx="2"/>`;
  s += `<rect class="brush-h" data-side="end" x="${wx1 - 3.5}" y="${top + 1}" width="7" height="${bh - 2}" rx="2"/>`;
  if (labels) s += `<text x="${mL}" y="${H - 2}">${fmtDate(allWeeks[0], true)}</text><text x="${W - mR}" y="${H - 2}" text-anchor="end">${fmtDate(allWeeks[n - 1], true)}</text>`;
  const label = `${t('ts.brush')} · ${fmtDate(allWeeks[i0])} – ${fmtDate(allWeeks[i1], true)}`;
  b.innerHTML = `<title>${label}</title>` + s;
  b.setAttribute('aria-label', label);
  BRUSH = { weeks: allWeeks, n, i0, i1, mL, mR };
}

/** pointer handling on the strip root (its content is re-rendered every frame, so nothing is attached
 *  to the handles themselves): handles resize, the window pans, a drag elsewhere draws a new window; a
 *  plain click does nothing; double-click restores the default window. */
function wireBrush() {
  const b = document.getElementById('tsBrush'); if (!b) return;
  let drag = null, raf = null;
  const idxAt = cx => { const r = b.getBoundingClientRect(), slot = (r.width - BRUSH.mL - BRUSH.mR) / BRUSH.n;
    return Math.max(0, Math.min(BRUSH.n - 1, Math.floor((cx - r.left - BRUSH.mL) / slot))); };
  const set = (i0, i1) => {
    S.layout.weeks = { start: i0 <= 0 ? 'first' : BRUSH.weeks[i0], end: i1 >= BRUSH.n - 1 ? 'last' : BRUSH.weeks[i1] };
    if (!raf) raf = requestAnimationFrame(() => { raf = null; drawTS(); });
  };
  b.addEventListener('pointerdown', e => {
    if (!BRUSH || e.button !== 0) return;
    const h = e.target.closest('.brush-h'), win = e.target.closest('.brush-win'), i = idxAt(e.clientX);
    drag = { mode: h ? h.dataset.side : win ? 'pan' : 'new', x0: e.clientX, i0: BRUSH.i0, i1: BRUSH.i1, anchor: i, grab: i - BRUSH.i0, moved: false };
    b.setPointerCapture(e.pointerId); e.preventDefault();
  });
  b.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved) { if (Math.abs(e.clientX - drag.x0) < 4) return; drag.moved = true; document.body.classList.add('brushing'); document.body.dataset.brush = drag.mode === 'pan' ? 'pan' : 'resize'; }
    const n = BRUSH.n, minW = Math.min(BRUSH_MIN, n), i = idxAt(e.clientX);
    let i0 = drag.i0, i1 = drag.i1;
    if (drag.mode === 'start') i0 = Math.min(i, drag.i1 - minW + 1);
    else if (drag.mode === 'end') i1 = Math.max(i, drag.i0 + minW - 1);
    else if (drag.mode === 'pan') { const w = drag.i1 - drag.i0; i0 = Math.max(0, Math.min(n - 1 - w, i - drag.grab)); i1 = i0 + w; }
    else { i0 = Math.min(drag.anchor, i); i1 = Math.max(drag.anchor, i);
      if (i1 - i0 + 1 < minW) { i1 = Math.min(n - 1, i0 + minW - 1); i0 = Math.max(0, i1 - minW + 1); } }
    set(Math.max(0, i0), Math.min(n - 1, i1));
  });
  const end = () => { if (!drag) return; const moved = drag.moved; drag = null;
    document.body.classList.remove('brushing'); delete document.body.dataset.brush; if (moved) saveLayout(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, end));
  b.addEventListener('dblclick', () => { S.layout.weeks = null; drawTS(); saveLayout(); });
}
