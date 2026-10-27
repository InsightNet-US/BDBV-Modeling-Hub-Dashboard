/* Weekly confirmed cases by week of symptom onset: reported (round data version), latest data
   overlay, nowcast/forecast from the hub ensemble (dotted outline + optional interval) and
   selected team models (points + 95% intervals). */
function drawTS() {
  const svg = document.getElementById('tsChart'), empty = document.getElementById('tsEmpty');
  const R = S.roundRef, loc = S.location, maxH = Math.max(0, ...(S.manifest.horizons || [3]));
  const legend = document.getElementById('tsLegend');
  svg.innerHTML = ''; empty.style.display = 'none';
  if (!S.obsRound) return;

  const obs = obsMap(S.obsRound, loc), latest = obsMap(S.obsLatest, loc);
  const haveLatest = S.obsLatest && S.obsLatest.as_of !== S.obsRound.as_of;
  const asOf = S.obsRound.as_of, lastComplete = S.obsRound.last_complete_week;

  // weeks: union of observed weeks and round weeks, contiguous Saturdays
  let allWeeks = S.round ? S.round.weeks.slice() : S.obsRound.weeks.slice();
  if (S.round) { const ow = S.obsRound.weeks; if (ow[0] < allWeeks[0]) { let w = ow[0]; const pre = []; while (w < allWeeks[0]) { pre.push(w); w = addDays(w, 7); } allWeeks = pre.concat(allWeeks); } }
  const nowIdxAll = R ? allWeeks.indexOf(R) : allWeeks.indexOf(lastComplete);
  let weeks = allWeeks;
  if (S.range === 'recent') {
    const end = Math.min(allWeeks.length, (nowIdxAll >= 0 ? nowIdxAll : allWeeks.length - 1) + 4);
    weeks = allWeeks.slice(Math.max(0, end - 24), end);
  }
  const nowIdx = R ? weeks.indexOf(R) : -1;
  const total = weeks.length;
  const mapIdx = S.mapWeek ? weeks.indexOf(S.mapWeek) : -1, mappable = S.round ? new Set(roundWeeks()) : new Set();

  // models
  const ens = S.ensembleId ? modelLoc(S.ensembleId, loc) : null;
  const showEnsCI = !!(ens && S.tsSelected.has(S.ensembleId));
  const teams = roundModels().filter(id => id !== S.ensembleId && S.tsSelected.has(id)).map(id => ({ id, name: modelLabel(id), color: modelColor(id), m: modelLoc(id, loc) })).filter(t => t.m);
  const anyModel = ens || teams.length;
  const qAt = (m, w) => { const i = m.weeks.indexOf(w); return i < 0 ? null : m.q[i]; };

  document.getElementById('tsSub').textContent = [locName(loc), R ? 'reference date ' + fmtDate(R, true) : '', `data as of ${asOf}`].filter(Boolean).join(' · ');
  legend.innerHTML = `<span class="chip"><i style="background:var(--past)"></i>reported (as of ${fmtDate(asOf)})</span>`
    + `<span class="chip"><i style="background:repeating-linear-gradient(135deg,var(--past) 0 2px,#fff 2px 4px)"></i>week in progress</span>`
    + (haveLatest ? `<span class="chip"><i style="border:1.5px solid var(--latest);background:transparent"></i>latest (as of ${fmtDate(S.obsLatest.as_of)})</span>` : '')
    + (ens ? `<span class="chip"><i style="border:1.5px dashed var(--median);background:transparent"></i>Hub ensemble median${showEnsCI ? ' + 95% interval' : ''}</span>` : '')
    + teams.map(t => `<span class="chip"><i style="background:${t.color}"></i>${t.name}</span>`).join('')
    + (mapIdx >= 0 ? `<span class="chip"><i style="background:var(--accent);opacity:.35"></i>week on map</span>` : '');

  if (S.round && !anyModel && roundModels().length) {
    empty.style.display = 'block';
    const others = modelsForLocation(loc).filter(id => id !== S.ensembleId);
    if (others.length) empty.innerHTML = `<b>None of the selected models covers ${locName(loc)}</b>${others.length === 1 ? 'One model' : others.length + ' models'} submitted it in this round: ${others.map(modelLabel).join(', ')}. Tick ${others.length === 1 ? 'it' : 'them'} in the Models menu.`;
    else empty.innerHTML = `<b>No model output for ${locName(loc)}</b>${loc === NATIONAL ? 'No model submitted a national (CD) series in this round; reported national counts are shown.' : 'No model submitted this location in this round.'}`;
  } else if (!S.round) {
    empty.style.display = 'block';
    empty.innerHTML = `<b>No submissions yet</b>The first accepted reference date is ${fmtDate(S.manifest.accepted_reference_dates[0] || '', true)}. Reported cases are shown.`;
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
    teams.forEach(t => { const q = qAt(t.m, w); if (q) vals.push(q[QI.hi95]); });
  });
  // nice integer ticks: step from {1,2,5}x10^k, axis top = first tick at or above the data max
  const rawMax = Math.max(...vals) * 1.08, ticks = 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, rawMax / ticks))));
  const step = [1, 2, 5, 10].map(m => m * mag).find(st => st * ticks >= rawMax) || 10 * mag;
  const ymax = step * ticks;
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
    if (m !== lastMonth && bx(i) - lastLabelX > 44) { s += `<text x="${bx(i)}" y="${y0 + 16}" text-anchor="middle">${fmtDate(w)}</text>`; lastLabelX = bx(i); }
    lastMonth = m;
  });
  s += `<text x="${mL}" y="${H - 4}" style="fill:#5b6675;font-size:9px">week ending (Saturday) · cases by symptom onset</text>`;

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
    if (showEnsCI && eq && eq[QI.hi95] > eq[QI.lo95]) { const yl = y(eq[QI.lo95]), yh = y(eq[QI.hi95]), cap = Math.min(barW * 0.32, 7);
      s += `<line x1="${cx}" y1="${yh}" x2="${cx}" y2="${yl}" stroke="var(--muted)" stroke-width="1.5"/>`;
      s += `<line x1="${cx - cap}" y1="${yh}" x2="${cx + cap}" y2="${yh}" stroke="var(--muted)" stroke-width="1.5"/>`;
      s += `<line x1="${cx - cap}" y1="${yl}" x2="${cx + cap}" y2="${yl}" stroke="var(--muted)" stroke-width="1.5"/>`; }
    // team overlays
    const nB = teams.length, jw = slotW * 0.26;
    teams.forEach((t, k) => { const q = qAt(t.m, w); if (!q) return;
      const off = (nB <= 1 ? 0 : (k / (nB - 1) - 0.5)) * 2 * jw, x = cx + off;
      s += `<line x1="${x}" y1="${y(q[QI.hi95])}" x2="${x}" y2="${y(q[QI.lo95])}" stroke="${t.color}" stroke-width="1.8" opacity="0.6"/>`;
      s += `<line x1="${x - 2}" y1="${y(q[QI.hi95])}" x2="${x + 2}" y2="${y(q[QI.hi95])}" stroke="${t.color}" stroke-width="1.5" opacity="0.8"/>`;
      s += `<line x1="${x - 2}" y1="${y(q[QI.lo95])}" x2="${x + 2}" y2="${y(q[QI.lo95])}" stroke="${t.color}" stroke-width="1.5" opacity="0.8"/>`;
      s += `<circle cx="${x}" cy="${y(q[QI.med])}" r="3" fill="${t.color}" stroke="#fff" stroke-width="0.6"/>`; });
    s += `<rect class="hit" data-i="${i}" x="${cx - slotW / 2}" y="${mT}" width="${slotW}" height="${ih}" fill="transparent"/>`;
  });

  if (nowIdx >= 0) {
    // faint guide between the last closed week (nowcast) and the reference week (forecast week 0)
    const nx = edge(nowIdx);
    s += `<line x1="${nx}" y1="${mT}" x2="${nx}" y2="${mT + ih}" stroke="var(--now)" stroke-width="1" opacity="0.35" stroke-dasharray="2 3"/>`;
  }
  svg.innerHTML = s;

  svg.querySelectorAll('.hit').forEach(r => {
    r.addEventListener('mousemove', e => {
      const i = +r.dataset.i, w = weeks[i], rel = nowIdx >= 0 ? i - nowIdx : null;
      const hasModelHere = (ens && qAt(ens, w)) || teams.some(t => qAt(t.m, w));
      const kind = rel == null ? '' : rel >= 0 ? ` · forecast wk ${rel === 0 ? '0 (reference week)' : '+' + rel}` : hasModelHere ? ' · nowcast' : '';
      let rows = '';
      if (obs[w] != null) rows += `<div class="row"><span>Reported (as of ${fmtDate(asOf)})${w > lastComplete ? ' <span class="sm">week in progress</span>' : ''}</span><b>${fmtN(obs[w])}</b></div>`;
      else if (rel != null && rel <= 0) rows += `<div class="row"><span>Reported</span><b>no data yet</b></div>`;
      if (haveLatest && latest[w] != null) rows += `<div class="row"><span>Latest (as of ${fmtDate(S.obsLatest.as_of)})</span><b>${fmtN(latest[w])}</b></div>`;
      if (ens) { const q = qAt(ens, w); if (q) rows += `<div class="row"><span style="color:var(--median)">Hub ensemble</span><b>${fmtN(q[QI.med])} <span class="sm">(${fmtRange(q)})</span></b></div>`; }
      teams.forEach(t => { const q = qAt(t.m, w); if (q) rows += `<div class="row"><span style="color:${t.color}">${t.name}</span><b>${fmtN(q[QI.med])} <span class="sm">(${fmtRange(q)})</span></b></div>`; });
      const hasModel = (ens && qAt(ens, w)) || teams.some(t => qAt(t.m, w));
      const mapHint = mappable.has(w) ? `<div class="sm" style="margin-top:4px">${w === S.mapWeek ? 'shown on map' : 'click to show this week on the map'}</div>` : '';
      showTip(`<b>Week ending ${fmtDate(w, true)}</b>${kind}${rows}${mapHint}${hasModel ? synNote() : ''}`, e.clientX, e.clientY);
    });
    r.addEventListener('mouseleave', hideTip);
    r.addEventListener('click', () => { const w = weeks[+r.dataset.i]; if (mappable.has(w) && w !== S.mapWeek) setMapWeek(w); });
  });
}
