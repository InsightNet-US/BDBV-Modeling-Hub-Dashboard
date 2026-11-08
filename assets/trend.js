/* Trend tab of the lower-left panel: for the selected location, the chance that each selected model
   (ensemble first) projects a decrease, no change or an increase in weekly confirmed cases for weeks 0
   to +3, each against the same trajectory's week −1 (±10%; pipeline/summarize.py trend_probs). Each
   cell is a fan: a dot with three arrows to the right, up at 45° (increase), level (stable) and down
   at 45° (decrease), each arrow's width and shading growing with its probability. Same #cumChart SVG and
   ticked models (selectedModels(), header Models menu) as the other panels; clicking a model's name puts
   it on the map. */
const TREND = ['inc', 'st', 'dec'], T_IDX = { dec: 0, st: 1, inc: 2 };   // trend arrays are [dec, stable, inc]
const T_ARROW = { inc: { ang: -45, c: '#e07b39' }, st: { ang: 0, c: '#5f6b7a' }, dec: { ang: 45, c: '#2a9d8f' } };
/** one arrow of length R from the centre; opacity reaches full at p = 0.75, width grows to 1 + wMax */
function trendArrow(k, p, R, wMax) {
  const g = T_ARROW[k], op = p == null ? 0 : 0.12 + 0.88 * Math.min(1, p / 0.75), w = 1 + (p || 0) * wMax;
  const hl = Math.max(R * 0.24, w * 1.3), hw = Math.max(R * 0.17, w * 1.0), x1 = R - hl;
  return `<g transform="rotate(${g.ang})" opacity="${op.toFixed(2)}"><line x1="${R * 0.18}" y1="0" x2="${x1}" y2="0" stroke="${g.c}" stroke-width="${w.toFixed(2)}" stroke-linecap="butt"/>`
    + `<path d="M${x1 - 0.5} ${-hw} L${R} 0 L${x1 - 0.5} ${hw} Z" fill="${g.c}"/></g>`;
}
/** fan centred at (cx, cy), p = [dec, stable, inc] */
function trendFan(cx, cy, R, p) {
  return `<g transform="translate(${cx} ${cy})">${TREND.map(k => trendArrow(k, p[T_IDX[k]], R, R * 0.38)).join('')}<circle r="${Math.max(2, R * 0.1)}" fill="#1b2430"/></g>`;
}
/** single arrow icon for the legend and tooltips */
const trendArrowSVG = (k, R = 15) => { const z = Math.round(R * 0.74 + 3), ty = k === 'st' ? z / 2 : k === 'inc' ? z - 1.5 : 1.5;
  return `<svg width="${z}" height="${z}" style="vertical-align:middle;overflow:visible"><g transform="translate(1.5 ${ty})">${trendArrow(k, 0.6, k === 'st' ? z - 3 : R, R * 0.3)}</g></svg>`; };
const trendFanSVG = (p, R = 10) => `<svg width="${R + 4}" height="${2 * R * 0.72 + 4}" style="vertical-align:middle;overflow:visible">${trendFan(2, R * 0.72 + 2, R, p)}</svg>`;
const trendWeek = h => h === 0 ? t('trend.wk0') : t('trend.wkPos', { n: h });

function drawTrend() {
  const svg = document.getElementById('cumChart'), legend = document.getElementById('trendLegend');
  if (S.layout.hidden.has('cum')) return;   // panel hidden: drawn again when shown
  const W = svg.clientWidth || 360, loc = S.location, R0 = S.roundRef, mapRel = weekRel(S.mapWeek);
  document.getElementById('cumSub').textContent = t('trend.sub', { loc: locName(loc) });
  legend.innerHTML = TREND.map(k => `<span class="chip">${trendArrowSVG(k)}${t('trend.' + k)}</span>`).join('');
  const sel = R0 ? selectedModels().map(id => ({ id, m: modelLoc(id, loc) })).filter(x => x.m && x.m.trend) : [];
  if (!sel.length) { svg.setAttribute('height', 30); svg.innerHTML = `<text x="8" y="20" style="font-size:11px;fill:#5f6b7a;font-style:italic">${R0 && !selectedModels().length && roundModels().length ? noneTickedNote() : t('trend.empty')}</text>`; return; }
  const HS = S.manifest.horizons, narrow = W < 520, fs = narrow ? 9.5 : 10, mR = 6, mT = 30;
  // label gutter sized to the longest label (canvas measureText, same font as the SVG), at most 30% of the width; longer labels are cut with an ellipsis
  const family = getComputedStyle(svg).fontFamily;
  const textW = (str, bold) => { _mctx.font = `${bold ? '600 ' : ''}${fs}px ${family}`; return _mctx.measureText(str).width; };
  sel.forEach(x => { x.ens = x.id === S.ensembleId; x.name = narrow && x.ens ? t('trend.ensShort') : modelLabel(x.id); });
  const mL = Math.round(Math.min(W * 0.3, Math.max(...sel.map(x => textW(x.name, x.ens))) + 14));
  sel.forEach(x => { if (textW(x.name, x.ens) > mL - 12) { let n = x.name; while (n.length > 1 && textW(n + '…', x.ens) > mL - 12) n = n.slice(0, -1); x.short = n + '…'; } });
  const colW = (W - mL - mR) / HS.length, R = Math.max(14, Math.min(28, colW / 4.2)), showPct = colW >= 80, rowH = 2 * R * 0.72 + (showPct ? 26 : 18);
  const H = mT + sel.length * rowH + 6;
  svg.setAttribute('height', H);
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let s = '';
  HS.forEach((h, j) => { const x0 = mL + j * colW, cx = x0 + colW / 2, end = fmtDate(addDays(R0, 7 * h));
    if (h === mapRel) s += `<rect x="${x0 + 1}" y="2" width="${colW - 2}" height="${H - 4}" fill="var(--accent)" opacity="0.08"/>`;
    if (j) s += `<line x1="${x0}" y1="4" x2="${x0}" y2="${H - 4}" stroke="var(--line)"/>`;
    s += `<text x="${cx}" y="12" text-anchor="middle" style="font-size:10.5px;font-weight:600;fill:#1b2430">${trendWeek(h)}</text>`;
    s += `<text x="${cx}" y="24" text-anchor="middle" style="font-size:9px;fill:#5f6b7a">${narrow ? end : t('trend.ending', { d: end })}</text>`; });
  sel.forEach((x, i) => { const y = mT + i * rowH + rowH / 2;
    const onMap = x.id === S.mapModel;
    s += `<text x="${mL - 8}" y="${y + 3.5}" text-anchor="end" style="font-size:${fs}px;${x.ens ? 'font-weight:600;fill:var(--median)' : `fill:${modelColor(x.id)}`}${onMap ? ';text-decoration:underline' : ''}">${esc(x.short || x.name)}</text>`;
    // the label gutter is the click target that puts the model on the map (app.js wireMapPick)
    s += `<rect class="mhit" data-model="${x.id}" x="0" y="${y - rowH / 2}" width="${mL - 2}" height="${rowH}" fill="transparent"><title>${esc(x.name)} · ${t(onMap ? 'ts.leg.onMap' : 'ts.leg.mapTitle')}</title></rect>`;
    HS.forEach((h, j) => { const p = x.m.trend[h], cx = mL + (j + 0.5) * colW, fx = showPct ? cx - R * 0.75 : cx - R / 2;
      if (!p) { s += `<text x="${cx}" y="${y + 3}" text-anchor="middle" style="font-size:10px;fill:#8a94a3">—</text>`; return; }
      s += trendFan(fx, y, R, p);
      if (showPct) TREND.forEach(k => { const a = T_ARROW[k].ang * Math.PI / 180, tx = fx + Math.cos(a) * (R + 3), ty = y + Math.sin(a) * (R + 3) + 3.5;
        s += `<text x="${tx}" y="${ty}" style="font-size:9.5px;fill:${T_ARROW[k].c}${p[T_IDX[k]] >= 0.4 ? ';font-weight:600' : ''}">${fmtPct(p[T_IDX[k]])}</text>`; });
      s += `<rect class="thit" data-id="${x.id}" data-h="${h}" x="${mL + j * colW}" y="${y - rowH / 2}" width="${colW}" height="${rowH}" fill="transparent"/>`; });
  });
  svg.innerHTML = s;
  svg.querySelectorAll('.thit').forEach(rc => {
    rc.addEventListener('mousemove', e => { const h = +rc.dataset.h, id = rc.dataset.id, p = modelLoc(id, loc).trend[h];
      const name = id === S.ensembleId ? ensLabelN(loc) : modelLabel(id), col = id === S.ensembleId ? 'var(--median)' : modelColor(id);
      showTip(`<b>${trendWeek(h)} · ${t('trend.ending', { d: fmtDate(addDays(R0, 7 * h), true) })}</b><div class="sm">${t('trend.vs')}</div>`
        + `<div class="row"><span style="color:${col}">${trendFanSVG(p, 16)} ${esc(name)}</span><b>${TREND.map(k => `${trendArrowSVG(k, 12)} ${fmtPct(p[T_IDX[k]])}`).join('&nbsp; ')}</b></div>`, e.clientX, e.clientY); });
    rc.addEventListener('mouseleave', hideTip);
  });
}
