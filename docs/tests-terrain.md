# Tests : ce qui est vérifié, ce qui reste à vérifier sur le terrain

## Vérifié automatiquement (environnement de développement Linux)

| Quoi | Comment |
|---|---|
| Règle « jamais deviné » : citations retrouvées, infos inventées rejetées, saisie manuelle prioritaire | `npm test` (merge.test.ts) |
| Découpage audio sur les silences, rejet du silence et du bruit, encodage WAV | `npm test` (chunker.test.ts) |
| Transcripteur Gemini par tronçons : ordre, contexte, vocabulaire, silences, nouvelle tentative (API simulée) | `npm test` (gemini-chunks.test.ts) |
| Générateur de base : champs cités, types devinés, rôles, KPI, déterminisme | `npm test` (baseline.test.ts) |
| Garde-fou de génération : modification valide gardée, code cassé annulé, IA coupée après 2 échecs (agent simulé, compilation réelle) | `npm test` (generator.test.ts) |
| Scénario de démo : 100 % des citations valides ; extraction de marque du site fictif (nom, logo, couleurs exactes, police) | `npm test` (scenario.test.ts) |
| Pipeline complet sans interface : scénario → brief (96 %) → maquette → compilation | `npm run demo:headless` (aussi en CI) |
| Application Electron : accueil, démo, checklist, finalisation, ouverture de la maquette | `npm run test:app` (xvfb-run sous Linux) |
| Application **packagée** : mêmes étapes, preview lancée par le Node embarqué | `AUTOBUILD_EXE=… node scripts/e2e-electron.cjs` |
| Chaîne audio réelle : micro + loopback → AudioWorklet 16 kHz → tronçons WAV → processus principal | `npm run test:audio` (micro factice Chromium) |
| Lancement de l'agent Claude (Agent SDK) et remontée d'une erreur d'authentification | essai manuel avec une clé invalide |

## À vérifier sur vos machines (non testable depuis le cloud)

### 1. Installation et audio : Mac et Windows (30 min)

- [ ] Installer l'application (artefact GitHub Actions ou `npm run dev`).
- [ ] **Windows** : Réglages → Audio → « Voix du prospect » = *Audio système*. Lancer une vidéo YouTube, démarrer
      l'écoute : le vumètre « Prospect » bouge.
- [ ] **macOS** : au premier démarrage de l'écoute, autoriser le micro et « Enregistrement de l'écran et de l'audio
      système » (Réglages système → Confidentialité). Relancer l'application si demandé. Vérifier le vumètre « Prospect ».
  - Si l'audio système reste muet : installer BlackHole 2ch, créer une sortie multiple (haut-parleurs + BlackHole) dans
    « Configuration audio et MIDI », choisir *Entrée : BlackHole* comme « Voix du prospect ». Me signaler le résultat
    (version de macOS) : c'est le point technique le plus incertain.
- [ ] Ouvrir la fenêtre checklist, partager l'écran dans Teams / Meet / Zoom : **la checklist ne doit pas apparaître**
      chez l'autre participant.
- [ ] Sur un même appel test, comparer « Par tronçons » et « Live » (Réglages → Transcription).

### 2. Clés API (10 min)

- [ ] Réglages → saisir les clés → *Tester les clés* → « OK » pour Claude et Gemini.
- [ ] Mode démo avec clés : le brief est rempli par l'IA (et non plus rejoué) et l'IA génère la maquette.

### 3. Trois faux rendez-vous (1 h 30)

Avec un collègue qui joue le prospect (un vrai besoin de client passé, si possible), 30 min chacun, en visio réelle :

| # | Prospect joué | Type attendu |
|---|---|---|
| 1 | PME industrielle qui gère devis, commandes et stocks sur Excel | ERP |
| 2 | Fédération ou réseau qui veut un espace adhérent (documents, événements, annuaire) | Extranet |
| 3 | Entreprise de services avec techniciens terrain (planning, interventions, rapports photo) | App métier / planning |

Pour chacun, noter :
- [ ] qualité de la transcription (noms propres, chiffres, chevauchements) ;
- [ ] délai entre une phrase et son apparition dans le brief ;
- [ ] infos fausses dans le brief (doit être 0) et infos manquées ;
- [ ] pertinence des questions suggérées ;
- [ ] temps de chaque étape IA et coût affiché ;
- [ ] note de la maquette finale sur 10, et ce qu'il aurait fallu pour « waouh » ;
- [ ] utilisation du plan B ou de la version sûre.

Ces résultats orientent la suite : choix du modèle de transcription, réglage de l'intervalle du brief, priorité des
templates, prix.
