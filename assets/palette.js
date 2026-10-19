/* Team colours. One ColorBrewer "Paired" light/dark pair per team (as in the hub's src/*.R plots);
   models of the same team get shades within the pair. Blue is reserved for observed data and the
   hub ensemble, so teams start at red. */
const PAIRED = [
  ['#fb9a99', '#e31a1c'],  // red
  ['#b2df8a', '#33a02c'],  // green
  ['#fdbf6f', '#ff7f00'],  // orange
  ['#cab2d6', '#6a3d9a'],  // purple
  ['#ffd92f', '#b15928'],  // yellow/brown
  ['#a6cee3', '#1f78b4'],  // blue (last resort)
];
function hexToRgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
}
/** models: {id: meta}. Returns {id: cssColor}. The ensemble id is coloured var(--median). */
function assignColors(models, ensembleId) {
  const teams = {};
  Object.keys(models).sort().forEach(id => {
    if (id === ensembleId) return;
    const t = models[id].team_abbr || id.split('-')[0];
    (teams[t] = teams[t] || []).push(id);
  });
  const out = {};
  if (ensembleId) out[ensembleId] = 'var(--median)';
  Object.keys(teams).sort().forEach((t, i) => {
    const pair = PAIRED[i % PAIRED.length], ids = teams[t];
    ids.forEach((id, k) => { out[id] = ids.length === 1 ? pair[1] : mix(pair[0], pair[1], 0.35 + 0.65 * k / (ids.length - 1)); });
  });
  return out;
}
/* 0..1 -> hazard ramp used by the map and its legend */
function colorFor(p) {
  const stops = [[0.0, [18, 50, 74]], [0.25, [30, 95, 134]], [0.5, [47, 158, 94]], [0.7, [242, 193, 78]], [0.85, [232, 104, 63]], [1.0, [192, 57, 43]]];
  p = Math.max(0, Math.min(1, p));
  for (let i = 1; i < stops.length; i++) if (p <= stops[i][0]) {
    const a = stops[i - 1], b = stops[i], t = (p - a[0]) / (b[0] - a[0]);
    const c = a[1].map((v, k) => Math.round(v + (b[1][k] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  return 'rgb(192,57,43)';
}
