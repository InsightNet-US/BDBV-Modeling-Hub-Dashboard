/* Cumulative confirmed cases for the selected location: reported to date (latest release, with the
   total known at round time when an older round is shown),
   each selected model's nowcast of the eventual total through the reference date, and projected
   cumulative totals at +1..+3 weeks. Boxes = 50% interval, whiskers = 95%, bar = median. The figures
   sit in a right-aligned column: median, then the 95% interval in parentheses (dropped when the
   panel is too narrow). */
const _mctx = document.createElement('canvas').getContext('2d');
function drawCum() {
  const svg = document.getElementById('cumChart');
  const W = svg.clientWidth || 360, R = S.roundRef, loc = S.location, mapRel = weekRel(S.mapWeek);
  const sub = document.getElementById('cumSub');
  if (S.layout.hidden.has('cum')) return;   // panel hidden: drawn again when shown
  if (!S.obsRound) { svg.innerHTML = ''; return; }
  const obs = obsMap(S.obsRound, loc), asOf = S.obsRound.as_of, latestAsOf = S.obsLatest.as_of, older = latestAsOf !== asOf;
  const upTo = R || S.obsRound.last_complete_week;
  const sumTo = m => Object.keys(m).filter(w => w <= upTo).reduce((a, w) => a + m[w], 0);
  const reportedCur = sumTo(obsMap(S.obsLatest, loc));                       // latest release
  const reportedRound = older && Object.keys(obs).length ? sumTo(obs) : null;   // known at round time (null: same release)
  sub.textContent = t('cum.sub', { loc: locName(loc), d: fmtDate(upTo, true) });

  const sel = selectedModels().map(id => ({ id, name: id === S.ensembleId ? ensLabelN(loc) : modelLabel(id), color: modelColor(id), m: modelLoc(id, loc) })).filter(tm => tm.m);
  const H_LIST = S.manifest.horizons;
  const n = Math.max(1, sel.length);
  const mLc = LANG === 'fr' ? 190 : 162, mT = 8, mB = 18, gp = 13, ggap = 6;   // wider label gutter for French
  const H = mT + 8 + 15 + 23 + 4 + 15 + (H_LIST.length + 1) * (n * gp + ggap) + 6 + mB;
  svg.setAttribute('height', H);
  const y0 = H - mB;
  const maxOf = arr => arr.length ? Math.max(...arr) : 0;
  // round ticks (niceAxis in app.js): 4 to 8 of them, axis end at most 25% above the data max
  const ax = niceAxis(Math.max(reportedCur, reportedRound || 0,
    maxOf(sel.map(tm => tm.m.cum_nowcast[QI.hi95])),
    maxOf(sel.flatMap(tm => H_LIST.map(h => (tm.m.cum_through_h[h] || [0])[QI.hi95] || 0)))) * 1.06);
  const xmax = ax.top;

  // text widths (canvas measureText, same font as the SVG) size the number column from the strings shown
  const family = getComputedStyle(svg).fontFamily;
  const textW = (str, fs, style) => { _mctx.font = `${style ? style + ' ' : ''}${fs}px ${family}`;
    return _mctx.font.includes(`${fs}px`) ? _mctx.measureText(str).width : str.length * fs * 0.6; };
  const diff = reportedRound != null ? reportedCur - reportedRound : 0;
  const repRow = { med: fmtN(reportedCur), iv: diff ? `(${diff > 0 ? '+' : '−'}${fmtN(Math.abs(diff))})` : '' };
  const boxRow = q => ({ med: fmtN(q[QI.med]), iv: `(${fmtRange(q, 95)})` });
  sel.forEach(tm => { tm.now = tm.m.n_nowcast_weeks === 0 ? { med: fmtN(tm.m.cum_nowcast[QI.med]), iv: '' } : boxRow(tm.m.cum_nowcast);
    tm.fc = H_LIST.map(h => tm.m.cum_through_h[h] ? boxRow(tm.m.cum_through_h[h]) : null); });
  const rows = [repRow, ...sel.flatMap(tm => [tm.now, ...tm.fc.filter(Boolean)])];
  const wM = maxOf(rows.map(r => textW(r.med, 8.5)));
  let wI = maxOf(rows.map(r => r.iv ? textW(r.iv, 8) : 0));
  const gutter = () => Math.max(56, 6 + wM + (wI ? 4 + wI : 0) + 6);
  let mRc = gutter(), showIv = true;
  if (W - mLc - mRc < 110) { showIv = false; wI = 0; mRc = gutter(); }   // too narrow: medians only
  const xI = W - 6, xM = showIv && wI ? xI - wI - 4 : xI;
  const px = v => mLc + (v / xmax) * (W - mLc - mRc);

  let s = '';
  // tick labels are thinned when they would collide: every k-th tick, k dividing the tick count so 0 and the maximum stay labelled
  const lw = textW(fmtN(ax.top), 9) + 8, need = Math.ceil(lw / ((W - mLc - mRc) / ax.n));
  let k = 1; while (k < need || ax.n % k) k++;
  for (let g = 0; g <= ax.n; g++) { const val = ax.step * g, xx = px(val);
    s += `<line x1="${xx}" y1="${mT}" x2="${xx}" y2="${y0}" stroke="var(--line)"/>`;
    if (g % k === 0) s += `<text x="${xx}" y="${H - 5}" text-anchor="middle" style="font-size:9px">${fmtN(val)}</text>`; }
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const section = (txt, yy) => `<text x="8" y="${yy}" style="fill:#5f6b7a;font-size:9px;font-weight:700;letter-spacing:.4px">${txt.toUpperCase()}</text>`;
  // a label may carry two lines separated by \n (long French labels); the pair is centred on cy
  const cat = (txt, cy, col, col2) => { const lines = txt.split('\n'), st = `fill:${col || 'var(--muted)'};font-size:9px`;
    return lines.length === 1 ? `<text x="${mLc - 6}" y="${cy + 3}" text-anchor="end" style="${st}">${txt}</text>`
      : `<text x="${mLc - 6}" y="${cy - 2}" text-anchor="end" style="${st}">${lines[0]}<tspan x="${mLc - 6}" dy="9.5"${col2 ? ` style="fill:${col2}"` : ''}>${lines[1]}</tspan></text>`; };
  const valTxt = (r, cy) => `<text x="${xM}" y="${cy + 3}" text-anchor="end" style="fill:var(--muted);font-size:8.5px">${r.med}</text>`
    + (showIv && r.iv ? `<text x="${xI}" y="${cy + 3}" text-anchor="end" style="fill:var(--muted);font-size:8px">${r.iv}</text>` : '');
  const box = (q, r, color, cy, bh, tip, id) => { bh = bh || 9;
    return `<g class="cbox" data-tip="${esc(tip)}" data-model="${id}"><line x1="${px(q[QI.lo95])}" y1="${cy}" x2="${px(q[QI.hi95])}" y2="${cy}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<line x1="${px(q[QI.lo95])}" y1="${cy - 4}" x2="${px(q[QI.lo95])}" y2="${cy + 4}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<line x1="${px(q[QI.hi95])}" y1="${cy - 4}" x2="${px(q[QI.hi95])}" y2="${cy + 4}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`
      + `<rect x="${px(q[QI.lo50])}" y="${cy - bh / 2}" width="${Math.max(1, px(q[QI.hi50]) - px(q[QI.lo50]))}" height="${bh}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="1.2"/>`
      + `<line x1="${px(q[QI.med])}" y1="${cy - bh / 2}" x2="${px(q[QI.med])}" y2="${cy + bh / 2}" stroke="#1b2430" stroke-width="1.4"/>`
      + valTxt(r, cy) + `</g>`; };
  const dot = (v, r, color, cy, hollow) => `<circle cx="${px(v)}" cy="${cy}" r="4.5" fill="${hollow ? '#fff' : color}" stroke="${hollow ? color : '#fff'}" stroke-width="${hollow ? 1.5 : 1}"/>` + valTxt(r, cy);
  const note = (txt, cy) => `<text x="${mLc + 4}" y="${cy + 3}" style="fill:#8a94a3;font-size:9px;font-style:italic">${txt}</text>`;
  // the hollow-dot note must stop short of the number column
  const noNowcastNote = () => { const long = t('cum.noNowcast'); return mLc + 4 + textW(long, 9, 'italic') > xM - wM - 8 ? t('cum.noNowcastShort') : long; };
  const hl = (gTop, gH) => `<rect x="${mLc - 2}" y="${gTop - 1}" width="${W - 2 - (mLc - 2)}" height="${gH + 2}" fill="var(--accent)" opacity="0.08"/>`;

  let yy = mT + 8;
  s += section(t('cum.toDate'), yy); yy += 15;
  // one two-tone row: blue dot = total known at round time, lighter bar and dot = reported since (latest release)
  { const cy = yy + 7;
    const lo = Math.min(reportedCur, reportedRound ?? reportedCur), hi = Math.max(reportedCur, reportedRound ?? reportedCur);
    s += cat(t('cum.reported', { d: fmtDate(latestAsOf) }) + (reportedRound != null ? '\n' + t('cum.atRound', { d: fmtDate(asOf) }) : ''), cy, 'var(--past)', 'var(--muted)');
    if (diff) s += `<rect x="${px(lo)}" y="${cy - 2}" width="${Math.max(1, px(hi) - px(lo))}" height="4" fill="var(--since)"/>`
      + `<circle cx="${px(reportedCur)}" cy="${cy}" r="4.5" fill="var(--since)" stroke="#fff" stroke-width="1"/>`;
    s += `<circle cx="${px(reportedRound ?? reportedCur)}" cy="${cy}" r="4.5" fill="var(--past)" stroke="#fff" stroke-width="1"/>`;
    s += valTxt(repRow, cy);
    yy += 23; }
  yy += 4;
  s += section(t('cum.eventual'), yy);
  if (showIv && sel.some(tm => tm.now.iv || tm.fc.some(Boolean))) s += `<text x="${xI}" y="${yy}" text-anchor="end" style="fill:#8a94a3;font-size:8px">${t('cum.colHead')}</text>`;
  yy += 15;
  if (!sel.length) s += note(!S.round || !roundModels().length ? t('cum.noSub') : selectedModels().length ? t('cum.noOutput') : noneTickedNote(), yy + gp / 2);
  // nowcast: closed weeks through the Saturday before the reference date
  { const gTop = yy, gH = n * gp, through = R ? fmtDate(addDays(R, -7)) : '';
    if (mapRel != null && mapRel < 0) s += hl(gTop, gH);
    s += cat(t('cum.nowcastCat', { d: through }), gTop + gH / 2 - 4, 'var(--median)');
    sel.forEach((tm, k) => { const cy = gTop + k * gp + gp / 2;
      if (tm.m.n_nowcast_weeks === 0) s += dot(tm.m.cum_nowcast[QI.med], tm.now, tm.color, cy, true) + note(noNowcastNote(), cy);
      else s += box(tm.m.cum_nowcast, tm.now, tm.color, cy, 9, tn('cum.nowcastTip', tm.m.n_nowcast_weeks, { name: tm.name, d: through }), tm.id); });
    yy += gH + ggap + 6; }
  // forecast horizons: week 0 (reference week, still in progress) through +3
  H_LIST.forEach((h, hi) => { const gTop = yy, gH = n * gp;
    if (h === mapRel) s += hl(gTop, gH);
    const when = R ? fmtDate(addDays(R, 7 * h)) : '';
    s += cat(h === 0 ? t('cum.fcCat0', { d: when }) : t('cum.fcCat', { n: h, d: when }), gTop + gH / 2 - 4);
    sel.forEach((tm, k) => { const q = tm.m.cum_through_h[h], cy = gTop + k * gp + gp / 2;
      if (q) s += box(q, tm.fc[hi], tm.color, cy, 9, h === 0 ? t('cum.fcTip0', { name: tm.name, d: when }) : t('cum.fcTip', { name: tm.name, n: h, d: when }), tm.id);
      else s += note(t('cum.notSubmitted'), cy); });
    yy += gH + ggap; });
  svg.innerHTML = s;
  svg.querySelectorAll('.cbox').forEach(g => {
    g.addEventListener('mousemove', e => showTip(`<b>${g.dataset.tip}</b><div class="sm" style="margin-top:4px">${t(g.dataset.model === S.mapModel ? 'ts.leg.onMap' : 'tip.clickModelMap')}</div>`, e.clientX, e.clientY));
    g.addEventListener('mouseleave', hideTip);
  });
}
