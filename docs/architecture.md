# Architecture et choix techniques

## Vue d'ensemble

Application **Electron** (TypeScript) en trois couches :

| Couche | Dossier | Rôle |
|---|---|---|
| Logique pure | `src/shared/` | Grille et schéma du brief, vérification des preuves, catalogue des types de projets, découpage audio (VAD) et encodage WAV, générateur de maquette « de base », données fictives. Sans dépendance à Electron, testée par Vitest. |
| Processus principal | `src/main/` | Session de rendez-vous (`session.ts`), transcription Gemini, moteur de brief Claude/Gemini, extraction de l'identité du prospect, générateur (espace de travail, instantanés, agent IA, compilation, preview), fenêtres, réglages chiffrés. |
| Interface | `src/renderer/` | Fenêtre principale (brief, transcript, maquette), fenêtre checklist flottante, capture audio (AudioWorklet). |

`Session` est indépendante d'Electron : `scripts/demo-headless.ts` fait tourner tout le pipeline en ligne de commande
(et sert de test d'intégration en CI).

## 1. Capture audio (renderer)

- **Micro** : `getUserMedia` avec annulation d'écho → canal *commercial*.
- **Audio système** : `getDisplayMedia` ; le processus principal répond avec l'écran principal et `audio: 'loopback'`
  (`setDisplayMediaRequestHandler`), sans fenêtre de choix → canal *prospect*. La piste vidéo est arrêtée aussitôt.
  - **Windows** : loopback natif.
  - **macOS** : activé par des fonctionnalités Chromium (`MacLoopbackAudioForScreenShare`, `MacCatapLoopbackAudioForScreenShare`)
    et l'autorisation « Enregistrement de l'écran et de l'audio système ». **À valider sur Mac** : si l'audio système
    reste muet, le réglage « Voix du prospect » accepte n'importe quelle entrée audio (périphérique virtuel BlackHole,
    Loopback…).
- Les deux flux passent dans un `AudioContext` à **16 kHz** et un AudioWorklet qui produit des trames de 100 ms.
- **Mode tronçons** : `VadChunker` coupe sur les silences (≥ 650 ms, tronçons de 3 à 14 s), jette le silence et le
  bruit faible, encode en WAV 16 bits → IPC → Gemini.
- **Mode Live** : PCM 16 bits envoyé en continu → IPC → websocket Gemini Live.

## 2. Transcription (Gemini)

- **Tronçons** (`gemini-chunks.ts`, par défaut) : `generateContent` avec l'audio WAV en ligne et une consigne de
  transcription mot à mot en français. Une file par canal (ordre et contexte préservés), les deux canaux en parallèle,
  une nouvelle tentative en cas d'erreur. Le contexte (phrase précédente) et le vocabulaire du site du prospect (noms
  propres, produits) sont fournis pour améliorer la reconnaissance. Latence : 5 à 15 s, suffisant car le brief est
  mis à jour toutes les 25 s.
- **Live** (`gemini-live.ts`, expérimental) : une session websocket par canal, `inputAudioTranscription`, reprise de
  session (`sessionResumption` + reconnexion sur `GoAway`) et `contextWindowCompression` pour dépasser les limites de
  10 à 15 minutes. Texte provisoire affiché en gris, validé après 1,5 s sans nouveau mot.
- Modèles par défaut (réglables) : `gemini-3.8-flash` (tronçons, modèle des exemples officiels de transcription),
  `gemini-3.8-live` (Live). `gemini-3.5-transcribe` / `gemini-3.5-transcribe-live` (modèles dédiés) sont proposés
  dans les réglages : à comparer sur les faux rendez-vous.

## 3. Brief

- **Grille** : 26 informations en 6 groupes (`src/shared/brief/schema.ts`, voir [grille-qualification.md](grille-qualification.md)).
- Toutes les 25 s (s'il y a du nouveau), le transcript complet et l'état du brief sont envoyés au LLM, qui renvoie un
  **patch** en sortie structurée (schéma Zod commun) : mises à jour, type de projet, résumé, 2 ou 3 questions à poser.
- **Règle « jamais deviné » appliquée par le code** (`merge.ts`) : chaque mise à jour doit citer un segment (S12) avec un
  extrait mot pour mot ; la citation est recherchée dans le segment (tolérance aux variations de transcription) et
  la mise à jour est **rejetée** si elle est introuvable. Le type de projet doit appartenir au catalogue et être prouvé.
  Une saisie manuelle du commercial n'est jamais écrasée.
- **Claude** : `claude-opus-5-5`, effort `low` par défaut (latence), consignes + grille + catalogue mis en cache,
  transcript avec point de cache (il ne fait que grandir). Repli serveur activé (`fallbacks: "default"`) si le modèle
  décline une requête.
- **Gemini** : `gemini-3.6-flash`, `responseJsonSchema` généré depuis le même schéma Zod.
- **Scénario** : en démo sans clé, des patchs pré-écrits sont rejoués et passent par la même vérification.

## 4. Identité du prospect

`extractBrand` (avant l'appel) : page d'accueil + feuilles de style → nom (`og:site_name`, titre), logo (image
« logo » de l'en-tête, icônes, `og:image`, favicon), couleurs (variables CSS « primary/brand », règles des boutons et
liens, `theme-color`, couleurs du logo SVG ou raster), police (Google Fonts, `font-family`), textes clés (titres,
paragraphes, menu). Si une clé est disponible, un LLM résume l'activité, le ton et le vocabulaire. Le texte du site
est copié dans la maquette (`src/mockup/site.txt`) pour que l'IA réutilise les noms de produits, services, agences.

## 5. Génération de la maquette

### Espace de travail
À la préparation, le template choisi est **copié avec ses dépendances** dans `Documents/AutoBuild/maquettes/<date>-<prospect>/`.
La preview Vite est lancée avec le **Node embarqué d'Electron** (`ELECTRON_RUN_AS_NODE`) : rien à installer chez le
commercial. Les **instantanés** (copies de `src/` et `public/`) remplacent git, qui n'est pas forcément installé.

### Deux niveaux
1. **Générateur de base, sans IA** (`src/shared/mockup/baseline.ts`) : brief → `app.json` en quelques millisecondes
   (entités avec les champs cités et leurs types devinés, statuts plausibles, rôles, navigation, tableau de bord avec
   les indicateurs cités, données fictives françaises **déterministes**). Toujours présentable ; c'est aussi le plan B
   et le mode sans clé Claude.
2. **Agent Claude** (`agent.ts`, Claude Agent SDK, le moteur de Claude Code) : il modifie le code du template en suivant
   son `CLAUDE.md`. Outils limités à la lecture et l'écriture de fichiers (pas de shell, pas de réseau).
   - Déclenché quand les infos qui changent la maquette (type de projet, objets métier, modules, rôles, écrans,
     processus, indicateurs) ont changé, après 12 s de stabilité (40 s maximum d'attente).
   - Étapes : **structure** (sur mesure : navigation, entités avec les mots du prospect, page dédiée pour l'écran clé),
     **données** réalistes du secteur, puis **finition** au moment de « Finaliser ».
   - Dès qu'une étape IA réussit, l'IA devient propriétaire de `app.json` (le générateur de base ne l'écrase plus).

### Garde-fous
- Après chaque étape IA : vérification de `app.json` + **compilation TypeScript** ; en cas d'échec, une tentative de
  correction par l'IA, puis **retour à l'instantané précédent**.
- Après 2 échecs consécutifs (clé invalide, compilation), l'IA est coupée pour le rendez-vous ; la maquette de base
  continue de suivre le brief.
- Boutons **Version sûre** (dernier instantané valide), **Plan B** (maquette de base préparée avant l'appel),
  **Stopper l'IA**.
- Durée maximale par étape (4 min par défaut, réglable).

## 6. Fenêtres

- **Principale** : brief détaillé (preuves, saisie manuelle), transcript en direct, maquette (identité, étapes,
  actions, journal).
- **Checklist** : toujours au premier plan, sans cadre, `setContentProtection(true)` → **invisible lors d'un partage
  d'écran** (macOS et Windows).
- **Maquette** : fenêtre dédiée sur la preview locale, à partager au prospect.

## Coûts

L'application affiche le coût estimé de chaque étape de génération (retour du Claude Agent SDK). Le brief (Claude) est
un appel court toutes les 25 s, dont la plus grande partie est servie depuis le cache. Le coût réel par rendez-vous
(transcription Gemini + brief + génération) est à mesurer sur les faux rendez-vous ; c'est un intrant direct du
modèle de prix.

## RGPD

- Case à cocher obligatoire avant l'écoute réelle : le prospect a été informé et a donné son accord.
- Aucun bot dans la visio ; l'audio n'est pas enregistré sur disque (les tronçons ne vivent qu'en mémoire le temps de
  la transcription).
- Le transcript et le brief restent sur le poste du commercial (export manuel).
- Sous-traitants : Google (Gemini) et Anthropic (Claude) traitent l'audio et le texte : à mentionner dans la politique
  de confidentialité de l'agence et à vérifier selon les conditions de conservation de chaque API.

## Limites connues

- Avec deux canaux, toutes les voix côté visio sont « le prospect ».
- Sans casque, le micro capte la voix du prospect (doublons possibles, signalés au LLM).
- Installeurs non signés (Gatekeeper / SmartScreen) ; signature Apple + notarisation et certificat Windows à prévoir.
- Mac : build Apple Silicon uniquement pour l'instant.
- Taille de l'application (~400-600 Mo) : binaire de l'agent Claude + dépendances du template embarquées.
