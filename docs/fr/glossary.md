# Glossaire anglais–français du tableau de bord / English–French glossary

Ce document fixe la terminologie française du tableau de bord du BDBV Modeling Hub, relue par des
collègues francophones (première relecture appliquée le 2026-10-27, français ouvert sur le site public le
même jour ; les corrections restent bienvenues). La liste complète
des chaînes traduites, avec un exemple pour chacune, est dans [`strings.md`](strings.md) (générée à
partir de `assets/i18n.js`).

**Où voir le résultat :** le tableau de bord public,
<https://insightnet-us.github.io/BDBV-Modeling-Hub-Dashboard/?lang=fr>, avec le sélecteur EN | FR dans la
barre d'outils (la version de test avec des données simulées reste à
<https://insightnet-us.github.io/BDBV-Modeling-Hub-Dashboard/mock/?lang=fr>, phrase de test `testme`).

**Comment relire :** corrigez directement la colonne « Français retenu » ici et la colonne « French » de
`strings.md` (pull request), ou envoyez vos remarques par courriel en citant le terme anglais. Les
corrections sont ensuite reportées dans le dictionnaire `assets/i18n.js` et les tableaux sont régénérés.
Les points marqués **à vérifier** sont ceux sur lesquels nous hésitons le plus.

**Historique :** première relecture reçue le 2026-10-27 (deux relecteurs) et appliquée : estimation en
temps réel, cycle de projection, semaines écoulées, cas déclarés, données observées, ensemble
multimodèle, zone géographique, sans prévision, nombre total de cas estimé, résultats de modèles
simulés, résultat du modèle, « Modèles ayant soumis des prévisions », « mis à jour le »,
Agrandir / Réduire. Restent à confirmer : « Projections au », « tableau de bord public », la
terminologie officielle pour « cas déclarés », et les termes de l'ensemble calculé par le tableau de bord
ajoutés le 2026-10-27 (« ensemble du tableau de bord », « modèles regroupés », « regroupement linéaire »).

Conventions adoptées, à confirmer :

- Les noms de lieux viennent du hub tels quels (Nord Kivu, Haut Uele, zones de santé) et ne sont pas
  traduits. Les noms de modèles, d'équipes et les descriptions de méthodes sont fournis par les équipes
  en anglais et restent en anglais ; une note le signale dans le volet « Modèles ».
- Les dates abrégées suivent l'usage français : « 31 oct. 2026 », « 7 nov. ». Les dates ISO
  (2026-10-24) identifient une version des données et restent telles quelles dans les deux langues.
- Les nombres sont groupés par espace fine insécable (10 365) ; le signe % est précédé d'une espace fine
  insécable (86 %). Les intervalles gardent le tiret demi-cadratin (286–433).
- « sem. » abrège « semaine » dans les étiquettes courtes (+1 sem., sem. 0).
- Les titres de section du panneau cumulé sont affichés en capitales, accents conservés (CUMUL FINAL
  ESTIMÉ).
- Le fond de carte (noms de pays et de villes) reste pour l'instant en anglais dans les deux langues ; un
  fond à étiquettes françaises est prévu séparément.

| Anglais (interface) | Français retenu | Autres options envisagées | Remarque |
|---|---|---|---|
| nowcast, nowcasting | **estimation en temps réel** | nowcast (emprunt) | Choix des relecteurs (2026-10-27) : la périphrase est préférée à l'emprunt malgré sa longueur ; « sem. d'estimation en temps réel » dans les étiquettes courtes. |
| forecast | prévision | projection | « prévision » pour les semaines à venir ; « projection » est réservé au terme générique ci-dessous. |
| projections (nowcast + forecast) | projections | — | Terme générique couvrant nowcast et prévision. |
| Projections from (date) | Projections au (31 oct. 2026) | Projections du ; Projections faites le | **à vérifier**. Date à laquelle les projections ont été faites (= date de référence du cycle de projection). |
| reference date | date de référence | — | Samedi clôturant la semaine de soumission (terminologie hubverse). |
| reference week | semaine de référence | — | Semaine se terminant à la date de référence (semaine 0). |
| round (submission round) | cycle de projection | cycle ; tour ; ronde | Relecteurs : « cycle » seul est difficile à comprendre. |
| horizon +1 wk, +2 wk | +1 sem., +2 sem. | +1 semaine | Décalage par rapport à la date de référence. |
| wk 0 (reference week) | sem. 0 | — | Semaine de référence, encore en cours au moment de la soumission. |
| week ending (Saturday) | semaine se terminant le (samedi) | semaine finissant le ; semaine au | « semaine se terminant le 7 nov. ». |
| week of symptom onset | semaine de début des symptômes | semaine d'apparition des symptômes | Date de début des symptômes = date d'onset. |
| weekly confirmed cases | cas confirmés hebdomadaires | — | |
| cumulative confirmed cases | cas confirmés cumulés | cumul des cas confirmés | « cumul » dans les étiquettes courtes. |
| reported (cases) | déclarés | rapportés ; notifiés | Relecteurs : « cas déclarés ». **à vérifier** s'il existe une terminologie officielle RDC/INSP (« cas notifiés »). |
| as of (date) | au (24 oct.) | à la date du ; en date du | « données au 24 oct. ». |
| data as of 2026-10-24 (version) | données au 2026-10-24 | — | La date ISO identifie la version des données du hub. |
| latest data | dernières données | données les plus récentes | Version la plus récente, superposée à celle du cycle. |
| target data | données observées | données cibles | Relecteurs. Données du hub contre lesquelles les projections sont évaluées. |
| week in progress | semaine en cours | semaine incomplète ; semaine partielle | Semaine dont la déclaration n'était pas close à la date des données. **à vérifier** si « semaine incomplète » est plus clair. |
| closed weeks | semaines écoulées | semaines closes ; semaines terminées | Relecteurs. Semaines dont le samedi est passé à la date des données. |
| through / thru (date) | jusqu'au (24 oct.) | — | Inclusif. |
| eventual cumulative | nombre total de cas estimé | cumul final estimé ; cumul attendu | Relecteurs. Pas « éventuel » (faux ami). |
| to date | à ce jour | — | |
| median | médiane | — | |
| median cases | cas (médiane) | médiane des cas | Étiquette courte de la carte. |
| 95% interval | intervalle à 95 % | intervalle de crédibilité à 95 % | Intervalle entre les quantiles 2,5 % et 97,5 % des trajectoires (trait fin). |
| 50% interval | intervalle à 50 % | intervalle interquartile | Intervalle entre les quantiles 25 % et 75 % (trait épais sur le graphique hebdomadaire ; boîte dans le panneau cumulé). |
| P(≥1 case) | P(≥1 cas) | probabilité d'au moins un cas | |
| hub ensemble | ensemble multimodèle | ensemble du hub | Modèle d'ensemble soumis par le hub, combinant toutes les soumissions. |
| dashboard ensemble | ensemble du tableau de bord | ensemble multimodèle du tableau de bord ; ensemble calculé | **à vérifier**. Ensemble calculé par le tableau de bord lui-même (regroupement de toutes les trajectoires soumises, à poids égaux par modèle) quand le hub n'en soumet pas. Nom du modèle : « BDBV dashboard ensemble » (non traduit, comme les autres noms de modèles). |
| computed by the dashboard (tag) | calculé par le tableau de bord | — | Étiquette dans le volet Modèles. |
| pooled models | modèles regroupés | modèles combinés ; modèles agrégés | **à vérifier**. Liste des modèles entrant dans l'ensemble du tableau de bord. |
| linear pool | regroupement linéaire | mélange linéaire ; combinaison linéaire | **à vérifier**. Méthode de l'ensemble (toutes les trajectoires mises en commun). |
| · 3 models (tooltip) | · 3 modèles | — | Nombre de modèles ayant soumis la semaine survolée, après le nom de l'ensemble. |
| model / team / submission | modèle / équipe / soumission | — | |
| submitted (location) | soumis | — | « 7 lieux soumis ». |
| location | zone géographique | lieu ; localisation | Relecteurs. Pays, province ou zone de santé. |
| country (national) | national ; RDC (national) | pays | « RDC · national » dans le sélecteur. |
| province | province | — | |
| health zone | zone de santé | — | Terme officiel RDC. |
| whole province | province entière | toute la province | Première entrée du sélecteur de zones. |
| weeks shown (brush strip) | semaines affichées | période affichée ; fenêtre temporelle | **à vérifier**. Bande sous le graphique hebdomadaire qui remplace l'ancien choix « Récent / Toute l'épidémie » (supprimé le 2026-10-28). |
| window (of the brush) | fenêtre | sélection | Zone surlignée de la bande : les semaines affichées. |
| handle | poignée | curseur | Les deux bords de la fenêtre que l'on fait glisser. |
| double-click to reset | double-clic pour réinitialiser | — | Rétablit les 24 semaines par défaut. |
| without output (dashed) | sans prévision (hachuré) | sans résultat | Relecteurs. « 19 provinces sans prévision (hachurées) ». |
| model output | résultat du modèle | résultat de modèle ; sortie de modèle | Relecteurs. « résultat de modèle » reste dans les messages génériques où aucun modèle particulier n'est visé (« Aucun résultat de modèle pour Ituri »). |
| no data yet | pas encore de données | — | |
| not submitted | non soumis | — | |
| week on map / shown on map | semaine sur la carte / affichée sur la carte | — | |
| click to select / clear selection / go back to the province | cliquer pour sélectionner / désélectionner / revenir à la province | — | |
| reported, last 4 wk / reported to date | rapportés, 4 dernières sem. / rapportés à ce jour | — | Infobulle de la carte. |
| Models (menu) / Models in this round | Modèles / Modèles ayant soumis des prévisions | Modèles de ce cycle | Relecteurs. |
| tick (in the menu) | cocher | sélectionner | |
| synthetic model output | résultats de modèles simulés | résultats de modèles synthétiques | Relecteurs : « synthétiques » ne serait pas compris. Filigrane : SIMULÉ. |
| demonstration data | données de démonstration | — | |
| live dashboard | tableau de bord public | tableau de bord principal ; en production | **à vérifier**. |
| test dashboard / test phrase / Open | tableau de bord de test / phrase de test / Ouvrir | — | |
| boundaries | limites administratives | frontières ; découpage | Source geoBoundaries. |
| hub repository | dépôt du hub | — | |
| built (timestamp) | mis à jour le | généré le ; construit le | Relecteurs. |
| earlier / later (round, week) | précédent(e) / suivant(e) | — | Flèches. |
| website / code | site web / code | — | Liens du volet Modèles. |
| Data: (inputs) | Données : | — | |
| zone not in the hub's location list | zone absente de la liste des lieux du hub | — | Polygone sans code hub. |
| panel / Panels (menu) | panneau / Panneaux | volet | Menu de la barre d'outils qui affiche ou masque les panneaux. |
| hide (panel button) | masquer | fermer | Bouton × dans l'en-tête de chaque panneau. |
| reset layout | réinitialiser la disposition | rétablir la disposition | |
| copy link to this layout | copier le lien vers cette disposition | — | |
| drag to resize | glisser pour redimensionner | — | Info-bulle des séparateurs entre panneaux. |
| Zoom in / Zoom out | Agrandir / Réduire | Zoom avant / Zoom arrière ; grossir / diminuer | Relecteurs (seconde proposition retenue). |
