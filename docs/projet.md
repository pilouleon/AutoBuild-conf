# Projet : maquette sur mesure générée pendant le rendez-vous prospect

## Promesse

« À la fin de votre rendez-vous, vous présentez à votre prospect la maquette de son projet, à l'image de son
entreprise, construite pendant que vous parliez. »

Version courte : « Votre prospect vous parle de son projet, vous lui montrez la maquette avant de raccrocher. »

## Contexte

- **Cible** : agences de développement et ESN (5 à 50 personnes) qui vendent du sur-mesure : intranet, extranet,
  ERP, applications métier.
- **Situation** : appels d'offres ou leads entrants, premier rendez-vous (R1) en visio d'environ 30 min où le prospect
  décrit son besoin.
- **Problème** : tous les concurrents arrivent avec les mêmes slides ; la maquette n'arrive qu'après plusieurs jours.
- **Bénéfice visé** : passer au R2 avec une maquette déjà vue, effet « waouh », engagement, différenciation.
- **Hypothèse business** : un deal vaut 30 à 300 k€ ; un outil à 200-500 €/mois se justifie s'il fait gagner un deal
  de plus par an. À valider en appelant une dizaine d'agences.

## Workflow cible

1. Écoute de la visio en direct, deux côtés distingués (micro = commercial, audio système = prospect), transcription
   en temps réel.
2. Fenêtre flottante avec la checklist de qualification (obtenu coché, manquant grisé), mise à jour en continu.
3. Identification automatique des besoins et remplissage du brief structuré.
4. Choix du bon template (ERP, app métier, intranet, extranet…).
5. Construction d'un squelette sur mesure pendant l'appel à partir des templates : pages, champs, données fictives
   réalistes, identité visuelle du prospect. À la fin, le commercial partage son écran et montre un premier jet.

## Décisions validées (novembre 2026)

| Sujet | Décision |
|---|---|
| Transcription | **Gemini**. Mode « par tronçons » d'abord (découpage sur les silences) ; mode **Live** (streaming) prêt et activable dans les réglages. Claude ne transcrit pas l'audio. |
| Brief | **Claude ou Gemini**, au choix dans les réglages. |
| Génération | **L'IA code pendant l'appel** pour faire du sur-mesure, en modifiant des templates existants (pas de génération à partir de zéro). Garde-fou : compilation après chaque étape, retour arrière automatique si ça casse. |
| Plateformes | Application desktop **macOS et Windows**. |
| Langue | **Français uniquement** pour le MVP. |
| Grille de qualification | Proposée par nous (voir [grille-qualification.md](grille-qualification.md)). |
| Identité du prospect | Le commercial saisit l'**URL du site** avant l'appel ; nom, logo, couleurs, police et textes du site sont réutilisés dans la maquette. |
| Modèle produit | **SaaS vendu aux agences** ; chaque agence peut apporter **ses propres templates et sa signature**. |
| Partage | La maquette reste **locale** (partage d'écran). |
| Livrable | Une **maquette présentable** (v1), pas une application fonctionnelle. |
| Ordre de travail | App qui écoute → brief → envoi en direct vers la construction de la maquette → fenêtre checklist. Les templates métier sont construits ensuite ; d'abord, lister les types de projets d'une agence comme imagile.fr. |

## Risques identifiés

- La génération est le point dur : adapter un template est fiable, construire une application complète ne l'est pas.
- Temps de génération de plusieurs minutes : tâche de fond, par étapes.
- Capture audio système différente selon l'OS.
- Avec deux canaux, tout ce qui vient du système est « le prospect » : plusieurs interlocuteurs sont mélangés.
- RGPD : prévenir le prospect et obtenir son accord, même sans bot visible.
- Barrière à l'entrée faible : la valeur est dans la qualité des templates, la grille de qualification et la fidélité
  à l'identité du prospect.
- Une maquette médiocre se retourne contre l'agence : mieux vaut peu de pages bien faites.

## Questions encore ouvertes

- Quel modèle Gemini donne la meilleure transcription en français sur de la visio (tronçons vs Live,
  `gemini-3.8-flash` vs `gemini-3.5-transcribe`) ? À mesurer sur les 3 faux rendez-vous.
- Quels 4 ou 5 templates en priorité 1 selon les agences ciblées (proposition dans [catalogue-projets.md](catalogue-projets.md)).
- Modèle de prix : abonnement par agence ou à l'usage (le coût IA par rendez-vous est affiché étape par étape dans
  l'application pour aider à trancher).
- Validation du besoin et du prix auprès d'une dizaine d'agences.
