/* Cumulative confirmed cases for the selected location: reported to date (round data version),
   each selected model's nowcast of the eventual total through the reference date, and projected
   cumulative totals at +1..+3 weeks. Boxes = 50% interval, whiskers = 95%, bar = median. */
function drawCum() {
  const svg = document.getElementById('cumChart');
  const W = svg.clientWidth || 360, R = S.roundRef, loc = S.location, horizon = S.horizon;
  const sub = document.getElementById('cumSub');
  if (!S.obsRound) { svg.innerHTML = ''; return; }
  const obs = obsMap(S.obsRound, loc), asOf = S.obsRound.as_of;
  const upTo = R || S.obsRound.last_complete_week;
  const reported = Object.keys(obs).filter(w => w <= upTo).reduce((a, w) => a + obs[w], 0);
  const latestObs = S.showLatest && S.obsLatest.as_of !== asOf
    ? Object.entries(obsMap(S.obsLatest, loc)).filter(([w]) => w <= upTo).reduce((a, [, v]) => a + v, 0) : null;
  sub.textContent = `${locName(loc)} · through week ending ${fmtDate(upTo, true)}`;

  const sel = roundModels().filter(id => S.cumSelected.has(id)).map(id => ({ id, name: modelLabel(id), color: modelColor(id), m: modelLoc(id, loc) })).filter(t => t.m);
  const H_LIST = S.manifest.horizons;
  const n = Math.max(1, sel.length);
  const mLc = 162, mRc = 56, mT = 8, mB = 18, gp = 13, ggap = 6;
  const H = mT + 8 + 15 + 23 + (latestObs != null ? 16 : 0) + 4 + n * gp + 8 + 15 + H_LIST.length * (n * gp + ggap) + mB;
  svg.setAttribute('height', H);
  const y0 = H - mB;
  const maxOf = arr => arr.length ? Math.max(...arr) : 0;
  const xmax = Math.max(reported, latestObs || 0,
    maxOf(sel.map(t => t.m.cum_through_ref[QI.hi95])),
    maxOf(sel.flatMap(t => H_LIST.map(h => (t.m.cum_through_h[h] || [0])[QI.hi95] || 0)))) * 1.06 || 1;
  const px = v => mLc + (v / xmax) * (W - mLc - mRc);

  let s = '';
  for (let g = 0; g <= 4; g++) { const val = xmax * g / 4, xx = px(val);
    s += `<line x1="${xx}" y1="${mT}" x2="${xx}" y2="${y0}" stroke="var(--line)"/>`;
    s += `<text x="${xx}" y="${H - 5}" text-anchor="middle" style="font-size:9px">${fmtN(val)}</text>`; }
  const section = (t, yy) => `<text x="8" y="${yy}" style="fill:#5f6b7a;font-size:9px;font-weight:700;letter-spacing:.4px">${t.toUpperCase()}</text>`;
  const cat = (t, cy, col) => `<text x="${mLc - 6}" y="${cy + 3}" text-anchor="end" style="fill:${col || 'var(--muted)'};font-size:9px">${t}</text>`;
  const valTxt = (v, x, cy) => `<text x="${x + 5}" y="${cy + 3}" style="fill:var(--muted);font-size:8.5px">${fmtN(v)}</text>`;
  const box = (q, color, cy, bh, tip) => { bh = bh || 9;
    return `<g class="cbox" data-tip="${tip}"><line x1="${px(q[QI.lo95])}" y1="${cy}" x2="${px(q[QI.hi95])}" y2="${cy}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<line x1="${px(q[QI.lo95])}" y1="${cy - 4}" x2="${px(q[QI.lo95])}" y2="${cy + 4}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<line x1="${px(q[QI.hi95])}" y1="${cy - 4}" x2="${px(q[QI.hi95])}" y2="${cy + 4}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<rect x="${px(q[QI.lo50])}" y="${cy - bh / 2}" width="${Math.max(1, px(q[QI.hi50]) - px(q[QI.lo50]))}" height="${bh}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="1.2"/>`
      + `<line x1="${px(q[QI.med])}" y1="${cy - bh / 2}" x2="${px(q[QI.med])}" y2="${cy + bh / 2}" stroke="#1b2430" stroke-width="1.4"/>`
      + valTxt(q[QI.med], px(q[QI.hi95]), cy) + `</g>`; };
  const dot = (v, color, cy, hollow) => `<circle cx="${px(v)}" cy="${cy}" r="4.5" fill="${hollow ? '#fff' : color}" stroke="${hollow ? color : '#fff'}" stroke-width="${hollow ? 1.5 : 1}"/>` + valTxt(v, px(v), cy);
  const note = (t, cy) => `<text x="${mLc + 4}" y="${cy + 3}" style="fill:#8a94a3;font-size:9px;font-style:italic">${t}</text>`;

  let yy = mT + 8;
  s += section('To date', yy); yy += 15;
  { const cy = yy + 7; s += cat(`Reported (as of ${fmtDate(asOf)})`, cy, 'var(--past)') + dot(reported, 'var(--past)', cy); yy += 23; }
  if (latestObs != null) { const cy = yy; s += cat(`Latest (as of ${fmtDate(S.obsLatest.as_of)})`, cy, 'var(--latest)') + dot(latestObs, 'var(--latest)', cy, true); yy += 16; }
  yy += 4;
  { const gTop = yy, gH = n * gp;
    s += cat(R ? `Nowcast · eventual thru ${fmtDate(R)}` : 'Nowcast', gTop + gH / 2 - 4, 'var(--median)');
    sel.forEach((t, k) => { const cy = gTop + k * gp + gp / 2;
      if (t.m.n_nowcast_weeks === 0) s += dot(t.m.cum_through_ref[QI.med], t.color, cy, true) + note('no nowcast weeks submitted', cy + 0);
      else s += box(t.m.cum_through_ref, t.color, cy, 9, `${t.name}: eventual confirmed cases through ${fmtDate(R)} (${t.m.n_nowcast_weeks} nowcast wk)`); });
    if (!sel.length) s += note(S.round && roundModels().length ? 'no model output for this location' : 'no submissions', gTop + gp / 2);
    yy += gH + 8; }
  s += section('Projected cumulative', yy); yy += 15;
  H_LIST.forEach(h => { const gTop = yy, gH = n * gp;
    if (h === horizon) s += `<rect x="${mLc - 2}" y="${gTop - 1}" width="${W - mRc - (mLc - 2)}" height="${gH + 2}" fill="var(--accent)" opacity="0.08"/>`;
    s += cat(`through +${h} wk${R ? ' (' + fmtDate(addDays(R, 7 * h)) + ')' : ''}`, gTop + gH / 2 - 4);
    sel.forEach((t, k) => { const q = t.m.cum_through_h[h], cy = gTop + k * gp + gp / 2;
      if (q) s += box(q, t.color, cy, 9, `${t.name}: cumulative confirmed through +${h} wk`); else s += note('not submitted', cy); });
    yy += gH + ggap; });
  svg.innerHTML = s;
  svg.querySelectorAll('.cbox').forEach(g => {
    g.addEventListener('mousemove', e => showTip(`<b>${g.dataset.tip}</b>${synNote()}`, e.clientX, e.clientY));
    g.addEventListener('mouseleave', hideTip);
  });
}
