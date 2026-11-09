/* Team colours. One ColorBrewer "Paired" light/dark pair per team (as in the hub's src/*.R plots);
   models of the same team get shades within the pair. Blue is reserved for observed data and the
   ensemble (hub or dashboard), so teams start at red. */
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
/** models: {id: meta}. Returns {id: cssColor}. Ensemble ids (one or a list) are coloured var(--median). */
function assignColors(models, ensembleId) {
  const ens = new Set([].concat(ensembleId || []).filter(Boolean));
  const teams = {};
  Object.keys(models).sort().forEach(id => {
    if (ens.has(id)) return;
    const t = models[id].team_abbr || id.split('-')[0];
    (teams[t] = teams[t] || []).push(id);
  });
  const out = {};
  ens.forEach(id => { out[id] = 'var(--median)'; });
  Object.keys(teams).sort().forEach((t, i) => {
    const pair = PAIRED[i % PAIRED.length], ids = teams[t];
    ids.forEach((id, k) => { out[id] = ids.length === 1 ? pair[1] : mix(pair[0], pair[1], 0.35 + 0.65 * k / (ids.length - 1)); });
  });
  return out;
}
/* 0..1 -> single-hue sequential ramp (light to deep purple) for probabilities */
const P_STOPS = ['#f4f1f9', '#cdc0e3', '#9e86c8', '#6f4fa8', '#44207d'];
function colorForP(p) {
  p = Math.max(0, Math.min(1, p));
  const x = p * (P_STOPS.length - 1), i = Math.min(P_STOPS.length - 2, Math.floor(x));
  return mix(P_STOPS[i], P_STOPS[i + 1], x - i);
}
const P_GRADIENT = `linear-gradient(90deg,${P_STOPS.join(',')})`;
/* 0..1 -> diverging at 0.5 for the probability of an increase: teal below even odds (as the trend fans'
   "decrease" arrows; ColorBrewer BrBG), near white at 50%, orange above (ColorBrewer Oranges, the "increase"
   arrows). The legend bar marks the 50% midpoint. */
const I_STOPS = ['#01665e', '#35978f', '#80cdc1', '#c7eae5', '#f7f7f7', '#fdd0a2', '#fd8d3c', '#d94801', '#7f2704'];
const I_GRADIENT = `linear-gradient(90deg,transparent calc(50% - 1px),#1b2430 calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)),linear-gradient(90deg,${I_STOPS.join(',')})`;
function colorForInc(p) {
  p = Math.max(0, Math.min(1, p));
  const x = p * (I_STOPS.length - 1), i = Math.min(I_STOPS.length - 2, Math.floor(x));
  return mix(I_STOPS[i], I_STOPS[i + 1], x - i);
}
/* 0..1 -> ColorBrewer YlOrRd (9 classes, interpolated) for case counts, log-scaled by the caller; a median of
   0 is the pale-yellow start of the scale, not a separate grey, so it does not look like missing data. Close to
   the reds of the INRB epidemic dashboard (inrb-umie.github.io/BDBV2026-Epidemic_Dashboard) without its grey. */
const N_STOPS = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'];
const N_GRADIENT = `linear-gradient(90deg,${N_STOPS.join(',')})`;
function colorFor(p) {
  p = Math.max(0, Math.min(1, p));
  const x = p * (N_STOPS.length - 1), i = Math.min(N_STOPS.length - 2, Math.floor(x));
  return mix(N_STOPS[i], N_STOPS[i + 1], x - i);
}
