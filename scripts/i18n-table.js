#!/usr/bin/env node
/* Review table and consistency checks for the dashboard's translations.
     node scripts/i18n-table.js          writes docs/fr/strings.md from assets/i18n.js
     node scripts/i18n-table.js --check  exits 1 if: a key or placeholder differs between en and fr,
                                         a data-i18n* key in index.html or a t('…')/tn('…') key in
                                         assets/*.js is missing from the dictionary, or strings.md is stale.
   No dependencies. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// evaluate assets/i18n.js in a sandbox (it is a classic script declaring LANG and I18N)
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(read('assets/i18n.js') + '\nthis.I18N = I18N;', ctx);
const I18N = ctx.I18N, EN = I18N.en, FR = I18N.fr;

/* where each key appears, for the reviewer; prefixes give the panel, specific keys refine it */
const PANEL = { page: 'Page', hdr: 'Header', common: 'Header / panel labels', badge: 'Synthetic marks (mock copy)', banner: 'Synthetic marks (mock copy)',
  wm: 'Synthetic marks (mock copy)', gate: 'Test-phrase gate (mock copy)', loc: 'Locations', model: 'Models', week: 'Week labels', dd: 'Model menus',
  ts: 'Weekly chart', tip: 'Weekly chart tooltip', cum: 'Cumulative panel', map: 'Map', drawer: 'Models drawer', foot: 'Footer', panels: 'Panel layout', err: 'Errors' };
const WHERE = {
  months: 'month abbreviations used in every date', 'page.title': 'browser tab title', 'page.desc': 'search-engine description',
  'hdr.subtitle': 'after the title "BDBV Modeling Hub"', 'hdr.roundTitle': 'hover text of the round selector', 'hdr.roundInfo': 'next to the round selector',
  'hdr.noRounds': 'round selector when no round has a submission', 'hdr.langTitle': 'hover text of the EN/FR switch',
  'tip.syn': 'last line of every tooltip that shows synthetic output', 'wm.word': 'large watermark word on panels and map',
  'gate.p1': 'gate paragraph, first part', 'gate.p2': 'gate paragraph, bold part', 'gate.p3': 'gate paragraph, middle', 'gate.live': 'gate paragraph, link', 'gate.p4': 'gate paragraph, end',
  'gate.https': 'gate error when the page is not served over https', 'gate.wrong': 'gate error after a wrong phrase',
  'loc.national': 'name of the country in subtitles', 'loc.nationalShort': 'country name after a zone name', 'loc.nationalOpt': 'first entry of the location selector', 'loc.wholeProvince': 'first entry of the zone selector',
  'model.ensemble': 'label of the hub ensemble wherever models are listed', 'week.nowcastKind': 'kind of a nowcast week, e.g. "nowcast −2 wk"',
  'week.fc0': 'kind of the reference week', 'week.fcPos': 'kind of a forecast week', 'week.h0': 'offset label of the reference week', 'week.hPos': 'offset of a forecast week', 'week.hNeg': 'offset of a nowcast week',
  'dd.hintEns': 'top of the weekly-chart model menu', 'dd.ensCI': 'ensemble entry in the weekly-chart model menu', 'dd.noSub': 'hover text of a greyed-out model', 'dd.none': 'model menu when the round has no submission',
  'dd.plus': 'model menu button', 'dd.ensInterval': 'model menu button', 'dd.ens': 'model menu button', 'dd.noneSel': 'model menu button', 'dd.all': 'model menu button', 'dd.nModels': 'model menu button',
  'ts.sub.ref': 'weekly-chart subtitle', 'ts.sub.asOf': 'weekly-chart subtitle (ISO date kept as a data-version identifier)', 'ts.leg.reported': 'legend', 'ts.leg.inProgress': 'legend', 'ts.leg.latest': 'legend',
  'ts.leg.ensMedian': 'legend', 'ts.leg.ensMedianCI': 'legend', 'ts.leg.weekOnMap': 'legend', 'ts.emptyOthers': 'message over the chart when the ticked models lack the location',
  'ts.emptyNational': 'message over the chart when no model covers the country', 'ts.emptyLoc': 'message over the chart when no model covers the location', 'ts.emptyNoSub': 'message over the chart before any submission',
  'ts.axis': 'caption under the x axis', 'tip.weekEnding': 'tooltip heading', 'tip.kindFc0': 'tooltip heading suffix', 'tip.kindFc': 'tooltip heading suffix', 'tip.kindNc': 'tooltip heading suffix',
  'tip.shownOnMap': 'tooltip last line', 'tip.clickMap': 'tooltip last line',
  'cum.sub': 'cumulative panel subtitle', 'cum.toDate': 'section heading (shown in capitals)', 'cum.eventual': 'section heading (shown in capitals)', 'cum.nowcastCat': 'row label', 'cum.fcCat0': 'row label', 'cum.fcCat': 'row label',
  'cum.noNowcast': 'italic note next to a hollow dot', 'cum.notSubmitted': 'italic note', 'cum.noOutput': 'italic note', 'cum.noSub': 'italic note', 'cum.nowcastTip': 'tooltip of a nowcast box', 'cum.fcTip0': 'tooltip of a forecast box', 'cum.fcTip': 'tooltip of a forecast box',
  'map.levelTitle': 'hover text of the Provinces / Health zones switch', 'map.weekTitle': 'hover text of the week selector', 'map.nowcastWeeks': 'group heading in the week selector', 'map.forecastWeeks': 'group heading in the week selector',
  'map.wkLabel': 'map subtitle and tooltip, e.g. "week ending 7 Nov (forecast +1 wk)"', 'map.subMedian': 'map subtitle', 'map.subPresence': 'map subtitle', 'map.synthetic': 'map subtitle (mock copy)',
  'map.missingProvinces': 'map subtitle', 'map.missingZones': 'map subtitle', 'map.tipNotInHub': 'tooltip of an unmatched zone polygon', 'map.ctxZone': 'tooltip heading suffix for a zone',
  'map.actBack': 'tooltip last line', 'map.actClear': 'tooltip last line', 'map.actSelect': 'tooltip last line', 'map.zoomIn': 'hover text of the + button', 'map.zoomOut': 'hover text of the − button',
  'drawer.sub': 'under the drawer title', 'drawer.englishNote': 'under the drawer title (French only)', 'drawer.data': 'data inputs line of a model', 'drawer.nloc': 'last line of a model', 'drawer.tagEns': 'small tag after a model name', 'drawer.tagSyn': 'small tag after a model name',
  'foot.hub': 'footer provenance', 'foot.latest': 'footer provenance (ISO date kept)', 'foot.built': 'footer provenance', 'foot.synthetic': 'footer provenance (mock copy)', 'foot.pgInsp': 'hover text of the INSP + KSPH logos', 'foot.ksph': 'hover text of the KSPH logo',
  'panels.btn': 'toolbar button opening the panel menu', 'panels.weekly': 'panel name in the menu and button labels', 'panels.cum': 'panel name in the menu and button labels', 'panels.map': 'panel name in the menu and button labels',
  'panels.reset': 'entry of the panel menu', 'panels.copy': 'entry of the panel menu', 'panels.copied': 'confirmation after copying', 'panels.hide': 'hover text of the × button in a panel header',
  'panels.allHidden': 'note shown when every panel is hidden', 'panels.show': 'button under that note', 'panels.vsplit': 'hover text of the gutter between the charts and the map', 'panels.hsplit': 'hover text of the gutter between the two charts',
  'foot.pgInsight': 'hover text of the Insight Net logos', 'foot.pgHubverse': 'hover text of the hubverse logo', 'err.load': 'red banner if the data files cannot be loaded',
};
/* sample values for the example column, per language */
const SAMPLE = {
  en: { n: 3, d: '24 Oct', loc: 'Ituri', list: 'OHTJHU-BM, CEPH-Rtrend_BDBV', name: 'OHTJHU-BM', rel: '−2 wk', kind: 'forecast +1 wk', wk: 'week ending 7 Nov (forecast +1 wk)', prov: 'Nord Kivu', s: 'Hub target data', repo: 'InsightNet-US/BDBV-Modeling-Hub', branch: 'main', commit: '07b9844', msg: 'data/manifest.json: 404' },
  fr: { n: 3, d: '24 oct.', loc: 'Ituri', list: 'OHTJHU-BM, CEPH-Rtrend_BDBV', rel: '−2 sem.', kind: 'prévision +1 sem.', wk: 'semaine se terminant le 7 nov. (prévision +1 sem.)', prov: 'Nord Kivu', s: 'Données observées du hub', name: 'Carte', repo: 'InsightNet-US/BDBV-Modeling-Hub', branch: 'main', commit: '07b9844', msg: 'data/manifest.json: 404' },
};
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const strip = s => String(s).replace(/<[^>]+>/g, (m) => (m === '</b>' ? ' — ' : ''));
const cell = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/ /g, '␣');
const isPlural = v => !!v && typeof v === 'object' && !Array.isArray(v);
const placeholders = s => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');

function problems() {
  const out = [];
  const keysEn = Object.keys(EN), keysFr = Object.keys(FR);
  keysEn.filter(k => !(k in FR)).forEach(k => out.push(`fr is missing key ${k}`));
  keysFr.filter(k => !(k in EN)).forEach(k => out.push(`fr has key ${k} that en does not`));
  keysEn.filter(k => k in FR).forEach(k => {
    const a = EN[k], b = FR[k];
    if (isPlural(a) !== isPlural(b)) out.push(`${k}: plural shape differs`);
    if (Array.isArray(a) && (!Array.isArray(b) || a.length !== b.length)) out.push(`${k}: array length differs`);
    const fa = isPlural(a) ? [a.one, a.other] : [a], fb = isPlural(b) ? [b.one, b.other] : [b];
    fa.forEach((s, i) => { if (!Array.isArray(a) && placeholders(s) !== placeholders(fb[i])) out.push(`${k}: placeholders differ (${placeholders(s)} vs ${placeholders(fb[i])})`); });
  });
  // keys referenced by the page and the scripts
  const html = read('index.html');
  for (const m of html.matchAll(/data-i18n(?:-title|-ph|-aria)?="([^"]+)"/g)) if (!(m[1] in EN)) out.push(`index.html uses unknown key ${m[1]}`);
  for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.js') && f !== 'i18n.js')) {
    const src = read('assets/' + f);
    for (const m of src.matchAll(/\btn?\(\s*'([^']+)'/g)) if (!(m[1] in EN)) out.push(`${f} uses unknown key ${m[1]}`);
    for (const m of src.matchAll(/\bt\((\w+) === \w+ \? '([^']+)' : '([^']+)'\)/g)) [m[2], m[3]].forEach(k => { if (!(k in EN)) out.push(`${f} uses unknown key ${k}`); });
  }
  return out;
}

function table() {
  const groups = new Map();
  for (const k of Object.keys(EN)) {
    const p = k === 'months' ? 'Week labels' : PANEL[k.split('.')[0]] || 'Other';
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(k);
  }
  let md = `# Dashboard strings, English and French\n\n`;
  md += `Generated from \`assets/i18n.js\` by \`node scripts/i18n-table.js\`; do not edit the French here by hand without also telling the developer, since the file is regenerated from the dictionary. Suggest changes in the French column (a pull request or comments by email are both fine) and they will be transferred to the dictionary.\n\n`;
  md += `How to read the table: \`{n}\`, \`{d}\`, \`{loc}\` and similar are placeholders filled at run time (a number, a date, a location name); the *Example* column shows one filled-in rendering. Rows with *(one)* and *(other)* are the singular and plural forms; French uses the singular for 0 and 1. Bold parts of a message are shown as "bold part — rest". The sign ␣ marks the narrow no-break space used in French numbers and before %. ISO dates such as 2026-10-24 identify a data release and stay as they are in both languages. Model names, team names and method descriptions come from the hub in English and are not translated. See \`glossary.md\` for the terminology choices.\n\n`;
  md += `Try it: the French interface is on the test copy of the dashboard, \`/mock/?lang=fr\` (test phrase "testme"); the EN | FR switch is in the toolbar.\n\n`;
  for (const [panel, keys] of groups) {
    md += `## ${panel}\n\n| Where | English | French | Example (French) |\n|---|---|---|---|\n`;
    for (const k of keys) {
      const a = EN[k], b = FR[k], where = WHERE[k] || '';
      if (Array.isArray(a)) { md += `| ${cell(where)} | ${cell(a.join(', '))} | ${cell(b.join(', '))} | ${cell(fill('24 {m}', { m: b[9] }))} |\n`; continue; }
      const rows = isPlural(a) ? [['one', a.one, b.one, 1], ['other', a.other, b.other, 3]] : [['', a, b, null]];
      for (const [form, en, fr, n] of rows) {
        const vars = Object.assign({}, SAMPLE.fr, n != null ? { n } : {});
        const ex = fr === '' ? '' : fill(strip(fr), vars);
        md += `| ${cell(where)}${form ? ` *(${form})*` : ''} | ${cell(strip(en))} | ${cell(strip(fr))} | ${cell(ex)} |\n`;
      }
    }
    md += '\n';
  }
  return md;
}

const check = process.argv.includes('--check');
const md = table();
const outPath = path.join(ROOT, 'docs/fr/strings.md');
if (check) {
  const probs = problems();
  if (!fs.existsSync(outPath) || fs.readFileSync(outPath, 'utf8') !== md) probs.push('docs/fr/strings.md is stale: run node scripts/i18n-table.js');
  if (probs.length) { console.error(probs.join('\n')); process.exit(1); }
  console.log(`i18n ok: ${Object.keys(EN).length} keys in en and fr, strings.md current`);
} else {
  const probs = problems();
  if (probs.length) console.error('warning:\n' + probs.join('\n'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log(`wrote ${path.relative(ROOT, outPath)} (${Object.keys(EN).length} keys)`);
}
