# Dashboard strings, English and French

Generated from `assets/i18n.js` by `node scripts/i18n-table.js`; do not edit the French here by hand without also telling the developer, since the file is regenerated from the dictionary. Suggest changes in the French column (a pull request or comments by email are both fine) and they will be transferred to the dictionary.

How to read the table: `{n}`, `{d}`, `{loc}` and similar are placeholders filled at run time (a number, a date, a location name); the *Example* column shows one filled-in rendering. Rows with *(one)* and *(other)* are the singular and plural forms; French uses the singular for 0 and 1. Bold parts of a message are shown as "bold part — rest". The sign ␣ marks the narrow no-break space used in French numbers and before %. ISO dates such as 2026-10-24 identify a data release and stay as they are in both languages. Model names, team names and method descriptions come from the hub in English and are not translated. See `glossary.md` for the terminology choices.

Try it: the French interface is on the test copy of the dashboard, `/mock/?lang=fr` (test phrase "testme"); the EN | FR switch is in the toolbar.

## Week labels

| Where | English | French | Example (French) |
|---|---|---|---|
| month abbreviations used in every date | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | janv., févr., mars, avr., mai, juin, juil., août, sept., oct., nov., déc. | 24 oct. |
| kind of a nowcast week, e.g. "nowcast −2 wk" | nowcast {rel} | estimation en temps réel {rel} | estimation en temps réel −2 sem. |
| kind of the reference week | forecast wk 0 | prévision sem. 0 | prévision sem. 0 |
| kind of a forecast week | forecast +{n} wk | prévision +{n} sem. | prévision +3 sem. |
| offset label of the reference week | wk 0 | sem. 0 | sem. 0 |
| offset of a forecast week | +{n} wk | +{n} sem. | +3 sem. |
| offset of a nowcast week | −{n} wk | −{n} sem. | −3 sem. |

## Page

| Where | English | French | Example (French) |
|---|---|---|---|
| browser tab title | BDBV Modeling Hub — nowcasts and forecasts | BDBV Modeling Hub — estimations en temps réel et prévisions | BDBV Modeling Hub — estimations en temps réel et prévisions |
| search-engine description | Nowcasts and short-term forecasts of weekly confirmed Bundibugyo virus disease cases by province, from the BDBV Modeling Hub. | Estimations en temps réel et prévisions à court terme des cas confirmés hebdomadaires de maladie à virus Bundibugyo par province, produits par le BDBV Modeling Hub. | Estimations en temps réel et prévisions à court terme des cas confirmés hebdomadaires de maladie à virus Bundibugyo par province, produits par le BDBV Modeling Hub. |

## Header

| Where | English | French | Example (French) |
|---|---|---|---|
| after the title "BDBV Modeling Hub" | · nowcasts & forecasts of weekly confirmed cases | · estimations en temps réel et prévisions des cas confirmés hebdomadaires | · estimations en temps réel et prévisions des cas confirmés hebdomadaires |
|  | Projections from | Projections au | Projections au |
|  | Earlier round | Cycle de projection précédent | Cycle de projection précédent |
|  | Later round | Cycle de projection suivant | Cycle de projection suivant |
| hover text of the round selector | Submission round: the week projections were made (reference date = Saturday ending that week). Click to pick, or step with the arrows. | Cycle de projection : la semaine où les projections ont été faites (date de référence = samedi clôturant cette semaine). Cliquez pour choisir, ou utilisez les flèches. | Cycle de projection : la semaine où les projections ont été faites (date de référence = samedi clôturant cette semaine). Cliquez pour choisir, ou utilisez les flèches. |
| round selector when no round has a submission | no rounds yet | aucun cycle de projection pour l’instant | aucun cycle de projection pour l’instant |
| next to the round selector *(one)* | {n} model · data as of {d} | {n} modèle · données au {d} | 1 modèle · données au 24 oct. |
| next to the round selector *(other)* | {n} models · data as of {d} | {n} modèles · données au {d} | 3 modèles · données au 24 oct. |
|  | Location | Zone géographique | Zone géographique |
|  | Country or province | Pays ou province | Pays ou province |
|  | Health zone within the selected province | Zone de santé de la province sélectionnée | Zone de santé de la province sélectionnée |
|  | Models | Modèles | Modèles |
| hover text of the EN/FR switch | Language | Langue | Langue |

## Header / panel labels

| Where | English | French | Example (French) |
|---|---|---|---|
|  | Models | Modèles | Modèles |
|  | Model | Modèle | Modèle |

## Synthetic marks (mock copy)

| Where | English | French | Example (French) |
|---|---|---|---|
|  | Synthetic model output | Résultats de modèles simulés | Résultats de modèles simulés |
|  | Model output shown here is synthetic demonstration data, not team submissions | Les résultats de modèles affichés ici sont des données de démonstration simulées, pas des soumissions d’équipes | Les résultats de modèles affichés ici sont des données de démonstration simulées, pas des soumissions d’équipes |
|  | SYNTHETIC MODEL OUTPUT · demonstration data, not team submissions ·  | RÉSULTATS DE MODÈLES SIMULÉS · données de démonstration, pas des soumissions d’équipes ·  | RÉSULTATS DE MODÈLES SIMULÉS · données de démonstration, pas des soumissions d’équipes ·  |
|  | go to the live dashboard | aller au tableau de bord public | aller au tableau de bord public |
| large watermark word on panels and map | Synthetic | Simulé | Simulé |

## Weekly chart tooltip

| Where | English | French | Example (French) |
|---|---|---|---|
| last line of every tooltip that shows synthetic output | SYNTHETIC MODEL OUTPUT · not a team submission | RÉSULTATS DE MODÈLES SIMULÉS · pas une soumission d’équipe | RÉSULTATS DE MODÈLES SIMULÉS · pas une soumission d’équipe |
| tooltip heading | Week ending {d} | Semaine se terminant le {d} | Semaine se terminant le 24 oct. |
| tooltip heading suffix |  · forecast wk 0 (reference week) |  · prévision sem. 0 (semaine de référence) |  · prévision sem. 0 (semaine de référence) |
| tooltip heading suffix |  · forecast wk +{n} |  · prévision sem. +{n} |  · prévision sem. +3 |
| tooltip heading suffix |  · nowcast |  · estimation en temps réel |  · estimation en temps réel |
|  | Reported (as of {d}) | Déclarés (au {d}) | Déclarés (au 24 oct.) |
|  | week in progress | semaine en cours | semaine en cours |
|  | Reported | Déclarés | Déclarés |
|  | no data yet | pas encore de données | pas encore de données |
|  | Latest (as of {d}) | Dernières données (au {d}) | Dernières données (au 24 oct.) |
| tooltip row of the hub-sourced ensemble | Hub ensemble | Ensemble multimodèle | Ensemble multimodèle |
| tooltip row of the dashboard-computed ensemble | Dashboard ensemble | Ensemble du tableau de bord | Ensemble du tableau de bord |
| after the ensemble label in the tooltip: how many models submitted that week *(one)* | · {n} model | · {n} modèle | · 1 modèle |
| after the ensemble label in the tooltip: how many models submitted that week *(other)* | · {n} models | · {n} modèles | · 3 modèles |
| after each model median in the tooltip: the 50% and 95% ranges | (50%: {r50} · 95%: {r95}) | (50 % : {r50} · 95 % : {r95}) | (50 % : 286–433 · 95 % : 150–720) |
| tooltip last line | shown on map | affichée sur la carte | affichée sur la carte |
| tooltip last line | click to show this week on the map | cliquer pour afficher cette semaine sur la carte | cliquer pour afficher cette semaine sur la carte |

## Test-phrase gate (mock copy)

| Where | English | French | Example (French) |
|---|---|---|---|
|  | Test dashboard | Tableau de bord de test | Tableau de bord de test |
| gate paragraph, first part | This copy shows  | Cette copie présente des  | Cette copie présente des  |
| gate paragraph, bold part | synthetic model output | résultats de modèles simulés | résultats de modèles simulés |
| gate paragraph, middle |  for development and demonstration. Enter the test phrase to continue, or go to the  |  à des fins de développement et de démonstration. Saisissez la phrase de test pour continuer, ou allez au  |  à des fins de développement et de démonstration. Saisissez la phrase de test pour continuer, ou allez au  |
| gate paragraph, link | live dashboard | tableau de bord public | tableau de bord public |
| gate paragraph, end | . | . | . |
|  | test phrase | phrase de test | phrase de test |
|  | Test phrase | Phrase de test | Phrase de test |
|  | Open | Ouvrir | Ouvrir |
| gate error when the page is not served over https | Open this page over https (or localhost) to unlock it. | Ouvrez cette page en https (ou sur localhost) pour la déverrouiller. | Ouvrez cette page en https (ou sur localhost) pour la déverrouiller. |
| gate error after a wrong phrase | That is not the test phrase. | Ce n’est pas la phrase de test. | Ce n’est pas la phrase de test. |

## Locations

| Where | English | French | Example (French) |
|---|---|---|---|
| name of the country in subtitles | DRC (national) | RDC (national) | RDC (national) |
| country name after a zone name | DRC | RDC | RDC |
| first entry of the location selector | DRC · national | RDC · national | RDC · national |
| first entry of the zone selector | Whole province | Province entière | Province entière |

## Models

| Where | English | French | Example (French) |
|---|---|---|---|
| label of the hub-sourced ensemble wherever models are listed | Hub ensemble | Ensemble multimodèle | Ensemble multimodèle |
| label of the ensemble computed by the dashboard wherever models are listed | Dashboard ensemble | Ensemble du tableau de bord | Ensemble du tableau de bord |

## Model menus

| Where | English | French | Example (French) |
|---|---|---|---|
| top of the weekly-chart model menu | Ensemble median always shown | La médiane de l’ensemble multimodèle est toujours affichée | La médiane de l’ensemble multimodèle est toujours affichée |
| ensemble entry in the weekly-chart model menu | Ensemble 50% and 95% intervals | Intervalles à 50 % et 95 % de l’ensemble multimodèle | Intervalles à 50 % et 95 % de l’ensemble multimodèle |
| hover text of a greyed-out model | No submission for {loc} | Pas de soumission pour {loc} | Pas de soumission pour Ituri |
| model menu when the round has no submission | No submissions in this round | Aucune soumission dans ce cycle de projection | Aucune soumission dans ce cycle de projection |
| model menu button *(one)* | Ensemble + {n} model | Ensemble + {n} modèle | Ensemble + 1 modèle |
| model menu button *(other)* | Ensemble + {n} models | Ensemble + {n} modèles | Ensemble + 3 modèles |
| model menu button | Ensemble + interval | Ensemble + intervalle | Ensemble + intervalle |
| model menu button | Ensemble | Ensemble | Ensemble |
| model menu button | none | aucun | aucun |
| model menu button | All models | Tous les modèles | Tous les modèles |
| model menu button *(one)* | {n} model | {n} modèle | 1 modèle |
| model menu button *(other)* | {n} models | {n} modèles | 3 modèles |

## Weekly chart

| Where | English | French | Example (French) |
|---|---|---|---|
|  | Weekly confirmed cases | Cas confirmés hebdomadaires | Cas confirmés hebdomadaires |
| weekly-chart subtitle | reference date {d} | date de référence {d} | date de référence 24 oct. |
| weekly-chart subtitle (ISO date kept as a data-version identifier) | data as of {d} | données au {d} | données au 24 oct. |
| legend | reported (as of {d}) | déclarés (au {d}) | déclarés (au 24 oct.) |
| legend | week in progress | semaine en cours | semaine en cours |
| legend | latest (as of {d}) | dernières données (au {d}) | dernières données (au 24 oct.) |
| legend | Hub ensemble median | Médiane de l’ensemble multimodèle | Médiane de l’ensemble multimodèle |
| legend | Hub ensemble median + 50% and 95% intervals | Médiane de l’ensemble multimodèle + intervalles à 50 % et 95 % | Médiane de l’ensemble multimodèle + intervalles à 50 % et 95 % |
| legend (dashboard-computed ensemble) | Dashboard ensemble median | Médiane de l’ensemble du tableau de bord | Médiane de l’ensemble du tableau de bord |
| legend (dashboard-computed ensemble) | Dashboard ensemble median + 50% and 95% intervals | Médiane de l’ensemble du tableau de bord + intervalles à 50 % et 95 % | Médiane de l’ensemble du tableau de bord + intervalles à 50 % et 95 % |
| legend | week on map | semaine sur la carte | semaine sur la carte |
| message over the chart when the ticked models lack the location *(one)* | None of the selected models covers {loc} — One model submitted it in this round: {list}. Tick it in the Models menu. | Aucun des modèles sélectionnés ne couvre {loc} — Un modèle l’a soumise dans ce cycle de projection : {list}. Cochez-le dans le menu Modèles. | Aucun des modèles sélectionnés ne couvre Ituri — Un modèle l’a soumise dans ce cycle de projection : OHTJHU-BM, CEPH-Rtrend_BDBV. Cochez-le dans le menu Modèles. |
| message over the chart when the ticked models lack the location *(other)* | None of the selected models covers {loc} — {n} models submitted it in this round: {list}. Tick them in the Models menu. | Aucun des modèles sélectionnés ne couvre {loc} — {n} modèles l’ont soumise dans ce cycle de projection : {list}. Cochez-les dans le menu Modèles. | Aucun des modèles sélectionnés ne couvre Ituri — 3 modèles l’ont soumise dans ce cycle de projection : OHTJHU-BM, CEPH-Rtrend_BDBV. Cochez-les dans le menu Modèles. |
| message over the chart when no model covers the country | No model output for {loc} — No model submitted a national (CD) series in this round; reported national counts are shown. | Aucun résultat de modèle pour {loc} — Aucun modèle n’a soumis de série nationale (CD) dans ce cycle de projection ; les cas déclarés au niveau national sont affichés. | Aucun résultat de modèle pour Ituri — Aucun modèle n’a soumis de série nationale (CD) dans ce cycle de projection ; les cas déclarés au niveau national sont affichés. |
| message over the chart when no model covers the location | No model output for {loc} — No model submitted this location in this round. | Aucun résultat de modèle pour {loc} — Aucun modèle n’a soumis cette zone géographique dans ce cycle de projection. | Aucun résultat de modèle pour Ituri — Aucun modèle n’a soumis cette zone géographique dans ce cycle de projection. |
| message over the chart before any submission | No submissions yet — The first accepted reference date is {d}. Reported cases are shown. | Pas encore de soumissions — La première date de référence acceptée est le {d}. Les cas déclarés sont affichés. | Pas encore de soumissions — La première date de référence acceptée est le 24 oct.. Les cas déclarés sont affichés. |
| caption under the x axis | week ending (Saturday) · cases by symptom onset | semaine se terminant le (samedi) · cas par date de début des symptômes | semaine se terminant le (samedi) · cas par date de début des symptômes |
| hover text and accessible label of the week-window strip under the weekly chart (the selected dates are appended) | Weeks shown — drag the window or its handles, double-click to reset | Semaines affichées — glisser la fenêtre ou ses poignées, double-clic pour réinitialiser | Semaines affichées — glisser la fenêtre ou ses poignées, double-clic pour réinitialiser |

## Cumulative panel

| Where | English | French | Example (French) |
|---|---|---|---|
|  | Cumulative confirmed cases | Cas confirmés cumulés | Cas confirmés cumulés |
| cumulative panel subtitle | {loc} · through week ending {d} | {loc} · jusqu’à la semaine se terminant le {d} | Ituri · jusqu’à la semaine se terminant le 24 oct. |
| section heading (shown in capitals) | To date | À ce jour | À ce jour |
|  | Reported (as of {d}) | Déclarés (au {d}) | Déclarés (au 24 oct.) |
|  | Latest (as of {d}) | Dernières données (au {d}) | Dernières données (au 24 oct.) |
| section heading (shown in capitals) | Eventual cumulative | Nombre total de cas estimé | Nombre total de cas estimé |
| italic note | no model output for this location | aucun résultat du modèle pour cette zone géographique | aucun résultat du modèle pour cette zone géographique |
| italic note | no submissions | aucune soumission | aucune soumission |
| row label | Nowcast · closed wks thru {d} | Estimation en temps réel sem. écoulées jusqu’au {d} | Estimation en temps réel sem. écoulées jusqu’au 24 oct. |
| italic note next to a hollow dot | no nowcast weeks submitted (reported only) | aucune semaine d’estimation en temps réel soumise (déclarés seulement) | aucune semaine d’estimation en temps réel soumise (déclarés seulement) |
| tooltip of a nowcast box *(one)* | {name}: eventual confirmed cases in weeks closed by {d} ({n} nowcast wk) | {name} : nombre total de cas confirmés estimé pour les semaines écoulées au {d} ({n} sem. d’estimation en temps réel) | Carte : nombre total de cas confirmés estimé pour les semaines écoulées au 24 oct. (1 sem. d’estimation en temps réel) |
| tooltip of a nowcast box *(other)* | {name}: eventual confirmed cases in weeks closed by {d} ({n} nowcast wk) | {name} : nombre total de cas confirmés estimé pour les semaines écoulées au {d} ({n} sem. d’estimation en temps réel) | Carte : nombre total de cas confirmés estimé pour les semaines écoulées au 24 oct. (3 sem. d’estimation en temps réel) |
| row label | Forecast wk 0 · thru {d} | Prévision sem. 0 · jusqu’au {d} | Prévision sem. 0 · jusqu’au 24 oct. |
| row label | Forecast +{n} wk · thru {d} | Prévision +{n} sem. · jusqu’au {d} | Prévision +3 sem. · jusqu’au 24 oct. |
| tooltip of a forecast box | {name}: cumulative confirmed through week 0 ({d}) | {name} : cas confirmés cumulés jusqu’à la semaine 0 ({d}) | Carte : cas confirmés cumulés jusqu’à la semaine 0 (24 oct.) |
| tooltip of a forecast box | {name}: cumulative confirmed through week +{n} ({d}) | {name} : cas confirmés cumulés jusqu’à la semaine +{n} ({d}) | Carte : cas confirmés cumulés jusqu’à la semaine +3 (24 oct.) |
| italic note | not submitted | non soumis | non soumis |

## Map

| Where | English | French | Example (French) |
|---|---|---|---|
| hover text of the Provinces / Health zones switch | Map level | Niveau de la carte | Niveau de la carte |
|  | Provinces | Provinces | Provinces |
|  | Health zones | Zones de santé | Zones de santé |
|  | Median cases | Cas (médiane) | Cas (médiane) |
|  | P(≥1 case) | P(≥1 cas) | P(≥1 cas) |
|  | Week | Semaine | Semaine |
|  | Earlier week | Semaine précédente | Semaine précédente |
|  | Later week | Semaine suivante | Semaine suivante |
| hover text of the week selector | Week whose cases are mapped (week ending Saturday), with its offset from the projections-from date. Click to pick, or step with the arrows. | Semaine dont les cas sont cartographiés (semaine se terminant le samedi), avec son décalage par rapport à la date des projections. Cliquez pour choisir, ou utilisez les flèches. | Semaine dont les cas sont cartographiés (semaine se terminant le samedi), avec son décalage par rapport à la date des projections. Cliquez pour choisir, ou utilisez les flèches. |
|  | no models | aucun modèle | aucun modèle |
| group heading in the week selector | Nowcast weeks (ending) | Semaines d’estimation en temps réel (fin de semaine) | Semaines d’estimation en temps réel (fin de semaine) |
| group heading in the week selector | Forecast weeks (ending) | Semaines de prévision (fin de semaine) | Semaines de prévision (fin de semaine) |
|  | no weeks | aucune semaine | aucune semaine |
| hover text of the + button | Zoom in | Agrandir | Agrandir |
| hover text of the − button | Zoom out | Réduire | Réduire |
| map subtitle and tooltip, e.g. "week ending 7 Nov (forecast +1 wk)" | week ending {d} ({kind}) | semaine se terminant le {d} ({kind}) | semaine se terminant le 24 oct. (prévision +1 sem.) |
|  | no week | aucune semaine | aucune semaine |
| map subtitle | Median cases | Cas (médiane) | Cas (médiane) |
| map subtitle | P(≥1 case) | P(≥1 cas) | P(≥1 cas) |
|  | no model | aucun modèle | aucun modèle |
| map subtitle (mock copy) | (synthetic) | (simulé) | (simulé) |
| map subtitle *(one)* | {n} province without output (dashed) | {n} province sans prévision (hachurée) | 1 province sans prévision (hachurée) |
| map subtitle *(other)* | {n} provinces without output (dashed) | {n} provinces sans prévision (hachurées) | 3 provinces sans prévision (hachurées) |
| map subtitle *(one)* | {n} zone without output (dashed) | {n} zone sans prévision (hachurée) | 1 zone sans prévision (hachurée) |
| map subtitle *(other)* | {n} zones without output (dashed) | {n} zones sans prévision (hachurées) | 3 zones sans prévision (hachurées) |
| tooltip of an unmatched zone polygon | zone not in the hub's location list | zone absente de la liste des zones géographiques du hub | zone absente de la liste des zones géographiques du hub |
|  | Median cases, {wk} | Cas (médiane), {wk} | Cas (médiane), semaine se terminant le 7 nov. (prévision +1 sem.) |
|  | P(≥1 case), same week | P(≥1 cas), même semaine | P(≥1 cas), même semaine |
|  | Reported so far, same week | Déclarés à ce jour, même semaine | Déclarés à ce jour, même semaine |
|  | (as of {d}) | (au {d}) | (au 24 oct.) |
|  | Model output | Résultat du modèle | Résultat du modèle |
|  | week not submitted | semaine non soumise | semaine non soumise |
|  | no submission | pas de soumission | pas de soumission |
|  | Reported, last 4 wk | Déclarés, 4 dernières sem. | Déclarés, 4 dernières sem. |
|  | Reported to date | Déclarés à ce jour | Déclarés à ce jour |
| tooltip heading suffix for a zone |  · health zone, {prov} |  · zone de santé, {prov} |  · zone de santé, Nord Kivu |
| tooltip last line | click to go back to the province | cliquer pour revenir à la province | cliquer pour revenir à la province |
| tooltip last line | click to clear selection | cliquer pour désélectionner | cliquer pour désélectionner |
| tooltip last line | click to select | cliquer pour sélectionner | cliquer pour sélectionner |

## Models drawer

| Where | English | French | Example (French) |
|---|---|---|---|
|  | Models | Modèles | Modèles |
|  | Close | Fermer | Fermer |
|  | Models in this round | Modèles ayant soumis des prévisions | Modèles ayant soumis des prévisions |
| under the drawer title *(one)* | Reference date {d} · {n} model | Date de référence {d} · {n} modèle | Date de référence 24 oct. · 1 modèle |
| under the drawer title *(other)* | Reference date {d} · {n} models | Date de référence {d} · {n} modèles | Date de référence 24 oct. · 3 modèles |
|  | No round loaded | Aucun cycle de projection chargé | Aucun cycle de projection chargé |
| under the drawer title (French only) |  | Descriptions fournies par les équipes, en anglais. | Descriptions fournies par les équipes, en anglais. |
|  | website | site web | site web |
|  | code | code | code |
| small tag after a model name | ensemble | ensemble | ensemble |
| tag after the dashboard-computed ensemble in the Models drawer | computed by the dashboard | calculé par le tableau de bord | calculé par le tableau de bord |
| method paragraph of the dashboard-computed ensemble | Equal-weight linear pool of every trajectory submitted by the models in this round (100 per model), computed by the dashboard rather than submitted to the hub. Weekly values use the models that submitted that week; cumulative totals and forecast windows are computed trajectory by trajectory and then summarised. Locations submitted by fewer than {n} models are not covered. | Regroupement linéaire à poids égaux de toutes les trajectoires soumises par les modèles de ce cycle de projection (100 par modèle), calculé par le tableau de bord et non soumis au hub. Les valeurs hebdomadaires utilisent les modèles ayant soumis la semaine ; les cumuls et les fenêtres de prévision sont calculés trajectoire par trajectoire puis résumés. Les zones géographiques soumises par moins de {n} modèles ne sont pas couvertes. | Regroupement linéaire à poids égaux de toutes les trajectoires soumises par les modèles de ce cycle de projection (100 par modèle), calculé par le tableau de bord et non soumis au hub. Les valeurs hebdomadaires utilisent les modèles ayant soumis la semaine ; les cumuls et les fenêtres de prévision sont calculés trajectoire par trajectoire puis résumés. Les zones géographiques soumises par moins de 3 modèles ne sont pas couvertes. |
| line under that paragraph listing the pooled models | Pooled models: {list} | Modèles regroupés : {list} | Modèles regroupés : OHTJHU-BM, CEPH-Rtrend_BDBV |
| small tag after a model name | synthetic | simulé | simulé |
| data inputs line of a model | Data: {s} | Données : {s} | Données : Données observées du hub |
| last line of a model *(one)* | {n} location submitted | {n} zone géographique soumise | 1 zone géographique soumise |
| last line of a model *(other)* | {n} locations submitted | {n} zones géographiques soumises | 3 zones géographiques soumises |
|  | No submissions yet for this round. | Aucune soumission pour ce cycle de projection. | Aucune soumission pour ce cycle de projection. |

## Footer

| Where | English | French | Example (French) |
|---|---|---|---|
| footer provenance | Hub {repo}@{branch} ({commit}) | Hub {repo}@{branch} ({commit}) | Hub InsightNet-US/BDBV-Modeling-Hub@main (07b9844) |
| footer provenance (ISO date kept) | latest target data as of {d} | dernières données observées au {d} | dernières données observées au 24 oct. |
| footer provenance | built {d} | mis à jour le {d} | mis à jour le 24 oct. |
| footer provenance (mock copy) | model output is synthetic | les résultats de modèles sont simulés | les résultats de modèles sont simulés |
|  | Boundaries:  | Limites administratives :  | Limites administratives :  |
|  |  (ODbL) ·  |  (ODbL) ·  |  (ODbL) ·  |
|  | Hub repository | Dépôt du hub | Dépôt du hub |
|  | Partners | Partenaires | Partenaires |
| hover text of the INSP + KSPH logos | Institut National de Santé Publique (DRC) and the Kinshasa School of Public Health | Institut National de Santé Publique (RDC) et École de Santé Publique de Kinshasa | Institut National de Santé Publique (RDC) et École de Santé Publique de Kinshasa |
| hover text of the KSPH logo | Kinshasa School of Public Health | École de Santé Publique de Kinshasa | École de Santé Publique de Kinshasa |
| hover text of the Insight Net logos | Insight Net centers ACCIDDA and epiENGAGE | Centres Insight Net ACCIDDA et epiENGAGE | Centres Insight Net ACCIDDA et epiENGAGE |
| hover text of the hubverse logo | Built with the hubverse data formats and tools | Construit avec les formats de données et les outils hubverse | Construit avec les formats de données et les outils hubverse |

## Panel layout

| Where | English | French | Example (French) |
|---|---|---|---|
| toolbar button opening the panel menu | Panels | Panneaux | Panneaux |
| panel name in the menu and button labels | Weekly chart | Graphique hebdomadaire | Graphique hebdomadaire |
| panel name in the menu and button labels | Cumulative cases | Cas cumulés | Cas cumulés |
| panel name in the menu and button labels | Map | Carte | Carte |
| entry of the panel menu | Reset layout | Réinitialiser la disposition | Réinitialiser la disposition |
| entry of the panel menu | Copy link to this layout | Copier le lien vers cette disposition | Copier le lien vers cette disposition |
| confirmation after copying | Link copied | Lien copié | Lien copié |
| hover text of the × button in a panel header | Hide: {name} | Masquer : {name} | Masquer : Carte |
| note shown when every panel is hidden | All panels are hidden. | Tous les panneaux sont masqués. | Tous les panneaux sont masqués. |
| button under that note | Show panels | Afficher les panneaux | Afficher les panneaux |
| hover text of the gutter between the charts and the map | Drag to resize the columns (double-click to reset) | Glisser pour redimensionner les colonnes (double-clic pour réinitialiser) | Glisser pour redimensionner les colonnes (double-clic pour réinitialiser) |
| hover text of the gutter between the two charts | Drag to resize the charts (double-click to reset) | Glisser pour redimensionner les graphiques (double-clic pour réinitialiser) | Glisser pour redimensionner les graphiques (double-clic pour réinitialiser) |

## Errors

| Where | English | French | Example (French) |
|---|---|---|---|
| red banner if the data files cannot be loaded | Failed to load dashboard data: {msg} | Échec du chargement des données du tableau de bord : {msg} | Échec du chargement des données du tableau de bord : data/manifest.json: 404 |

