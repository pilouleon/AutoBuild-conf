# Templates : contrat et création

Un template est un **projet web complet** (aujourd'hui Vite + React + TypeScript + Tailwind) que AutoBuild copie pour
chaque rendez-vous, habille aux couleurs du prospect, remplit à partir du brief, puis fait modifier par l'IA.

Une agence peut fournir **ses propres templates** (et sa signature) : Réglages → *Templates de l'agence* → choisir un
dossier qui contient un sous-dossier par template. Un template de l'agence remplace un template intégré de même `id`.

## Deux formes de template

1. **Projet complet** : un projet web autonome (structure ci-dessous).
2. **Manifeste qui étend un projet de base** (`"extends": "socle"`) : il ne contient que son `template.json` (et
   éventuellement des fichiers à superposer au projet de base). Il décrit sa **mise en page** et sa **bibliothèque
   de pages**. C'est la forme des 4 templates intégrés :

| Template | Mise en page | Types de projets | Pages |
|---|---|---|---|
| ERP / gestion commerciale | menu latéral | ERP, CRM, pilotage / BI, e-commerce B2B | tableau de bord, clients (base) ; devis, commandes, factures, articles, stocks, fournisseurs, production, opportunités, planning, reporting, droits, paramètres (options) |
| Application métier | menu latéral | application métier, planning et RDV, GED, mobile terrain, configurateur | tableau de bord (base) ; suivi des étapes, planning, interventions, documents, clients, équipe, reporting, droits, paramètres (options) |
| Extranet / portail client | menu horizontal | extranet, site institutionnel, annuaire | accueil, mon compte (base) ; commandes, demandes, documents, factures, annuaire, actualités (options) |
| Intranet | menu horizontal | intranet | actualités, annuaire, documents (base) ; demandes, agenda, droits (options) |

Comme ils partagent le même projet (le socle), **le template peut changer pendant l'appel** : quand le type de projet
devient clair, AutoBuild passe au template le plus adapté (tant que l'IA n'a pas encore pris la main sur la maquette,
et si le commercial a laissé le choix « Automatique »).

### Pages : base et options

```json
{ "id": "devis", "label": "Devis", "description": "Éditeur de devis…", "niveau": "option",
  "kind": "page", "cible": "devis", "declencheurs": ["devis", "chiffrage", "proposition commerciale"], "icone": "file" }
```

| Champ | Rôle |
|---|---|
| `niveau` | `base` : toujours dans la maquette. `option` : activée si un `declencheur` est cité dans le brief (les 4 plus citées au plus, au départ). |
| `kind` | `tableau-de-bord`, `entite` (liste / kanban / calendrier / fiche générées depuis `app.json`, `cible` = nom de l'objet, ex. « Facture ») ou `page` (page de la bibliothèque du socle, `cible` = id). |

Bibliothèque de pages du socle (`templates/socle/src/pages/library/`) : `planning`, `devis`, `stocks`, `reporting`,
`droits`, `parametres`, `documents`, `actualites`, `annuaire`, `accueil-portail`, `tickets`, `suivi`. Elles
s'adaptent aux entités de la maquette (`source` dans la navigation : l'entité dont elles affichent les données).
L'IA peut les adapter, ou créer une page sur mesure dans `src/pages/custom/` (prioritaire sur la bibliothèque).

## Structure minimale

```
mon-template/
  template.json        manifeste (obligatoire)
  CLAUDE.md            consignes pour l'agent IA (fortement recommandé)
  package.json         + node_modules installés (npm install) : la maquette tourne sans réseau
  src/mockup/          données écrites par AutoBuild (voir ci-dessous)
  public/brand/        logo du prospect et de l'agence (créé si absent)
```

## template.json

```json
{
  "id": "erp-pme",
  "name": "ERP PME",
  "version": "1.0.0",
  "description": "Gestion commerciale : devis, commandes, factures, stocks, tableaux de bord.",
  "projectTypes": ["erp", "crm", "pilotage-bi"],
  "fallback": false,
  "dev":   { "script": "node_modules/vite/bin/vite.js", "args": ["--port", "{port}", "--strictPort", "--host", "127.0.0.1"] },
  "check": { "script": "node_modules/typescript/bin/tsc", "args": ["--noEmit", "-p", "tsconfig.json"] },
  "mockupDir": "src/mockup",
  "brandAssetsDir": "public/brand"
}
```

| Champ | Rôle |
|---|---|
| `projectTypes` | Ids du catalogue ([catalogue-projets.md](catalogue-projets.md)) couverts. `["*"]` = tous. |
| `fallback` | Template utilisé quand aucun autre ne correspond (le « socle »). Ne s'hérite pas. |
| `extends` | Id du projet de base (manifeste seulement). |
| `layout` | `sidebar` (back-office) ou `topnav` (portail). Écrit dans `app.json`. |
| `couleur` | Couleur de la vignette dans la bibliothèque des templates. |
| `pages` | Bibliothèque de pages (voir plus haut). |
| `dev` | Script Node qui lance le serveur de preview. `{port}` est remplacé. Exécuté avec le Node embarqué d'Electron. |
| `check` | Script Node de vérification (doit sortir en code 0) : lancé après chaque étape IA ; en cas d'échec, retour arrière. |
| `mockupDir` | Dossier où AutoBuild écrit les fichiers de données. |
| `brandAssetsDir` | Dossier public où sont copiés `logo.*` (prospect) et `agence.*`. |

Les scripts doivent être des fichiers JavaScript exécutables par Node (pas de commande `npm`).

## Fichiers écrits par AutoBuild dans `src/mockup/`

| Fichier | Contenu | Qui l'écrit |
|---|---|---|
| `brand.json` | nom, logo (`/brand/logo.svg`), couleurs (primaire, secondaire, accent), police, slogan, ton, URL | AutoBuild (ne pas modifier) |
| `agence.json` | nom, mention (« Maquette de travail, données fictives »), logo | AutoBuild (ne pas modifier) |
| `brief.json` | le brief complet du rendez-vous | AutoBuild, à chaque mise à jour |
| `site.txt` | texte du site du prospect (titres, services, menu) | AutoBuild, à la préparation |
| `app.json` | navigation, rôles, entités, champs, données, tableau de bord | générateur de base, puis l'IA |

Le format de `app.json` est défini dans `templates/socle/src/mockup/types.ts`. Un template qui respecte ce format
profite du **générateur de base** (maquette sans IA, plan B, mode sans clé) ; un template qui ne le respecte pas
fonctionne quand même, mais seule l'IA l'adapte (et le plan B est le template brut aux couleurs du prospect).

## Couleurs de la marque

Le template doit lire `brand.json` au démarrage et exposer les couleurs en variables CSS (le socle le fait dans
`src/lib/theme.ts` + `src/index.css` : classes Tailwind `bg-primary`, `text-primary-fg`, `bg-secondary`, `bg-accent`…).
Ne jamais coder de couleur de marque en dur.

## CLAUDE.md : les consignes de l'agent

C'est le levier principal de qualité. Il doit dire :
- ce qu'est la maquette (cliquable, données fictives, montrée en fin de rendez-vous) ;
- les fichiers interdits (brand, agence, brief, configuration) et les dépendances interdites ;
- la structure du projet : où ajouter une page, comment l'enregistrer dans la navigation, quels composants utiliser ;
- les priorités (les mots du prospect, l'écran clé, peu de pages mais soignées) ;
- que le code doit compiler (vérifié automatiquement).

Voir `templates/socle/CLAUDE.md` comme modèle.

## Créer un template à partir du socle

```bash
cp -r templates/socle ~/AutoBuild-templates/erp-pme
cd ~/AutoBuild-templates/erp-pme
# modifier template.json (id, name, projectTypes, fallback: false), les pages, CLAUDE.md, app.json par défaut
npm install
npm run dev     # travailler le rendu
npm run check   # doit passer
```

Puis Réglages → *Templates de l'agence* → `~/AutoBuild-templates`.

Pour une simple variante (autre jeu de pages, autre mise en page), un manifeste suffit :

```json
{ "id": "portail-adherents", "name": "Portail adhérents", "description": "…", "extends": "socle",
  "projectTypes": ["extranet"], "layout": "topnav", "couleur": "#be185d", "pages": [ … ] }
```

## Signature de l'agence

Réglages → *Agence et signature* : nom, mention et logo. Ils apparaissent dans la maquette (pied de la barre
latérale et page de connexion dans le socle) via `agence.json`.
