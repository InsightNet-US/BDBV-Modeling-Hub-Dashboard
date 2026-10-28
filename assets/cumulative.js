/* Cumulative confirmed cases for the selected location: reported to date (round data version),
   each selected model's nowcast of the eventual total through the reference date, and projected
   cumulative totals at +1..+3 weeks. Boxes = 50% interval, whiskers = 95%, bar = median. */
function drawCum() {
  const svg = document.getElementById('cumChart');
  const W = svg.clientWidth || 360, R = S.roundRef, loc = S.location, mapRel = weekRel(S.mapWeek);
  const sub = document.getElementById('cumSub');
  if (S.layout.hidden.has('cum')) return;   // panel hidden: drawn again when shown
  if (!S.obsRound) { svg.innerHTML = ''; return; }
  const obs = obsMap(S.obsRound, loc), asOf = S.obsRound.as_of;
  const upTo = R || S.obsRound.last_complete_week;
  const reported = Object.keys(obs).filter(w => w <= upTo).reduce((a, w) => a + obs[w], 0);
  const latestObs = S.obsLatest.as_of !== asOf
    ? Object.entries(obsMap(S.obsLatest, loc)).filter(([w]) => w <= upTo).reduce((a, [, v]) => a + v, 0) : null;
  sub.textContent = t('cum.sub', { loc: locName(loc), d: fmtDate(upTo, true) });

  const sel = roundModels().filter(id => S.cumSelected.has(id)).map(id => ({ id, name: modelLabel(id), color: modelColor(id), m: modelLoc(id, loc) })).filter(tm => tm.m);
  const H_LIST = S.manifest.horizons;
  const n = Math.max(1, sel.length);
  const mLc = LANG === 'fr' ? 190 : 162, mRc = 56, mT = 8, mB = 18, gp = 13, ggap = 6;   // wider label gutter for French
  const H = mT + 8 + 15 + 23 + (latestObs != null ? 16 : 0) + 4 + 15 + (H_LIST.length + 1) * (n * gp + ggap) + 6 + mB;
  svg.setAttribute('height', H);
  const y0 = H - mB;
  const maxOf = arr => arr.length ? Math.max(...arr) : 0;
  const xmax = Math.max(reported, latestObs || 0,
    maxOf(sel.map(tm => tm.m.cum_nowcast[QI.hi95])),
    maxOf(sel.flatMap(tm => H_LIST.map(h => (tm.m.cum_through_h[h] || [0])[QI.hi95] || 0)))) * 1.06 || 1;
  const px = v => mLc + (v / xmax) * (W - mLc - mRc);

  let s = '';
  for (let g = 0; g <= 4; g++) { const val = xmax * g / 4, xx = px(val);
    s += `<line x1="${xx}" y1="${mT}" x2="${xx}" y2="${y0}" stroke="var(--line)"/>`;
    s += `<text x="${xx}" y="${H - 5}" text-anchor="middle" style="font-size:9px">${fmtN(val)}</text>`; }
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const section = (txt, yy) => `<text x="8" y="${yy}" style="fill:#5f6b7a;font-size:9px;font-weight:700;letter-spacing:.4px">${txt.toUpperCase()}</text>`;
  // a label may carry two lines separated by \n (long French labels); the pair is centred on cy
  const cat = (txt, cy, col) => { const lines = txt.split('\n'), st = `fill:${col || 'var(--muted)'};font-size:9px`;
    return lines.length === 1 ? `<text x="${mLc - 6}" y="${cy + 3}" text-anchor="end" style="${st}">${txt}</text>`
      : `<text x="${mLc - 6}" y="${cy - 2}" text-anchor="end" style="${st}">${lines[0]}<tspan x="${mLc - 6}" dy="9.5">${lines[1]}</tspan></text>`; };
  const valTxt = (v, x, cy) => `<text x="${x + 5}" y="${cy + 3}" style="fill:var(--muted);font-size:8.5px">${fmtN(v)}</text>`;
  const box = (q, color, cy, bh, tip) => { bh = bh || 9;
    return `<g class="cbox" data-tip="${esc(tip)}"><line x1="${px(q[QI.lo95])}" y1="${cy}" x2="${px(q[QI.hi95])}" y2="${cy}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<line x1="${px(q[QI.lo95])}" y1="${cy - 4}" x2="${px(q[QI.lo95])}" y2="${cy + 4}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<line x1="${px(q[QI.hi95])}" y1="${cy - 4}" x2="${px(q[QI.hi95])}" y2="${cy + 4}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<rect x="${px(q[QI.lo50])}" y="${cy - bh / 2}" width="${Math.max(1, px(q[QI.hi50]) - px(q[QI.lo50]))}" height="${bh}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="1.2"/>`
      + `<line x1="${px(q[QI.med])}" y1="${cy - bh / 2}" x2="${px(q[QI.med])}" y2="${cy + bh / 2}" stroke="#1b2430" stroke-width="1.4"/>`
      + valTxt(q[QI.med], px(q[QI.hi95]), cy) + `</g>`; };
  const dot = (v, color, cy, hollow) => `<circle cx="${px(v)}" cy="${cy}" r="4.5" fill="${hollow ? '#fff' : color}" stroke="${hollow ? color : '#fff'}" stroke-width="${hollow ? 1.5 : 1}"/>` + valTxt(v, px(v), cy);
  const note = (txt, cy) => `<text x="${mLc + 4}" y="${cy + 3}" style="fill:#8a94a3;font-size:9px;font-style:italic">${txt}</text>`;

  let yy = mT + 8;
  s += section(t('cum.toDate'), yy); yy += 15;
  { const cy = yy + 7; s += cat(t('cum.reported', { d: fmtDate(asOf) }), cy, 'var(--past)') + dot(reported, 'var(--past)', cy); yy += 23; }
  if (latestObs != null) { const cy = yy; s += cat(t('cum.latest', { d: fmtDate(S.obsLatest.as_of) }), cy, 'var(--latest)') + dot(latestObs, 'var(--latest)', cy, true); yy += 16; }
  yy += 4;
  s += section(t('cum.eventual'), yy); yy += 15;
  if (!sel.length) s += note(t(S.round && roundModels().length ? 'cum.noOutput' : 'cum.noSub'), yy + gp / 2);
  // nowcast: closed weeks through the Saturday before the reference date
  { const gTop = yy, gH = n * gp, through = R ? fmtDate(addDays(R, -7)) : '';
    if (mapRel != null && mapRel < 0) s += `<rect x="${mLc - 2}" y="${gTop - 1}" width="${W - mRc - (mLc - 2)}" height="${gH + 2}" fill="var(--accent)" opacity="0.08"/>`;
    s += cat(t('cum.nowcastCat', { d: through }), gTop + gH / 2 - 4, 'var(--median)');
    sel.forEach((tm, k) => { const cy = gTop + k * gp + gp / 2;
      if (tm.m.n_nowcast_weeks === 0) s += dot(tm.m.cum_nowcast[QI.med], tm.color, cy, true) + note(t('cum.noNowcast'), cy);
      else s += box(tm.m.cum_nowcast, tm.color, cy, 9, tn('cum.nowcastTip', tm.m.n_nowcast_weeks, { name: tm.name, d: through })); });
    yy += gH + ggap + 6; }
  // forecast horizons: week 0 (reference week, still in progress) through +3
  H_LIST.forEach(h => { const gTop = yy, gH = n * gp;
    if (h === mapRel) s += `<rect x="${mLc - 2}" y="${gTop - 1}" width="${W - mRc - (mLc - 2)}" height="${gH + 2}" fill="var(--accent)" opacity="0.08"/>`;
    const when = R ? fmtDate(addDays(R, 7 * h)) : '';
    s += cat(h === 0 ? t('cum.fcCat0', { d: when }) : t('cum.fcCat', { n: h, d: when }), gTop + gH / 2 - 4);
    sel.forEach((tm, k) => { const q = tm.m.cum_through_h[h], cy = gTop + k * gp + gp / 2;
      if (q) s += box(q, tm.color, cy, 9, h === 0 ? t('cum.fcTip0', { name: tm.name, d: when }) : t('cum.fcTip', { name: tm.name, n: h, d: when }));
      else s += note(t('cum.notSubmitted'), cy); });
    yy += gH + ggap; });
  svg.innerHTML = s;
  svg.querySelectorAll('.cbox').forEach(g => {
    g.addEventListener('mousemove', e => showTip(`<b>${g.dataset.tip}</b>${synNote()}`, e.clientX, e.clientY));
    g.addEventListener('mouseleave', hideTip);
  });
}
