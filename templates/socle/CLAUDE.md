# Consignes pour l'agent de génération de maquette

Tu modifies une **maquette cliquable** (pas une application fonctionnelle) qui sera montrée à un prospect
**à la fin d'un rendez-vous commercial de 30 minutes**, en partage d'écran. Elle doit être juste, soignée,
à l'image de l'entreprise du prospect et refléter ce qu'il a dit pendant l'appel.

## Règles

1. **Tout en français**, vocabulaire du métier du prospect (reprends ses mots exacts quand il les a dits).
2. **Pas de backend, pas d'appel réseau, pas de nouvelle dépendance npm.** Données fictives en mémoire uniquement.
3. **Ne modifie jamais** `src/mockup/brand.json`, `src/mockup/agence.json`, `src/mockup/brief.json` (écrits par AutoBuild),
   ni `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`.
4. Respecte les types de `src/mockup/types.ts` : `app.json` doit rester valide. Le code doit compiler (`tsc --noEmit`) :
   après ton passage, la compilation est vérifiée automatiquement et tes modifications sont annulées si elle échoue.
5. Couleurs : utilise uniquement les classes `bg-primary`, `text-primary`, `bg-primary/10`, `text-primary-fg`,
   `bg-secondary`, `bg-accent`… (elles suivent la marque du prospect) et la palette `slate` pour les neutres.
   Jamais de couleur de marque codée en dur.
6. **Mieux vaut peu de pages très bien faites** que beaucoup de pages vides. Chaque page visible doit avoir des données
   crédibles (noms français, villes, montants et dates cohérents, statuts variés).
7. Les infos du brief marquées « manquant » ne doivent pas être inventées comme si le prospect les avait dites :
   complète avec des contenus génériques plausibles pour son secteur, sans chiffres « engageants » (prix, délais du projet).
8. Travaille vite : tu as quelques minutes par étape. Pas de refactoring, pas de tests, pas de README.

## Structure

- `src/mockup/app.json` : **la configuration de l'application** (titre, rôles, navigation, tableau de bord, entités, données).
  C'est le premier endroit à modifier : ajouter une entité, des champs, des statuts, des données, une entrée de menu.
- `src/mockup/types.ts` : le contrat de `app.json` (lis-le avant de modifier `app.json`).
- `src/pages/EntityPage.tsx` : pages génériques des entités (vues liste / kanban / calendrier, fiche, création).
- `src/pages/Dashboard.tsx` : tableau de bord générique (KPI, graphiques, listes récentes).
- `src/pages/custom/` : **pages sur mesure**. Pour un écran spécifique au prospect (planning de chantiers, carte des
  interventions, configurateur, suivi de production, portail client…), crée `src/pages/custom/NomPage.tsx`,
  enregistre-la dans `src/pages/custom/registry.ts` et ajoute une entrée `"type": "page"` dans la navigation.
- `src/components/ui.tsx` : composants (Button, Card, CardHeader, Badge, Input, Select, Tabs, Modal, PageHeader, Avatar,
  EmptyState, statusColor) ; `src/components/charts.tsx` : BarChart, LineChart, DonutChart ;
  `src/components/icons.tsx` : `<Icon name="…" />` (liste des noms dans `PATHS`, ajoute un tracé SVG si besoin).
- `src/lib/store.ts` : `useRows(entityId)`, `addRow`, `updateRow` pour lire et modifier les données d'une entité.
- `src/lib/router.tsx` : `Link`, `navigate`, `useRoute` (routes `#/<id-navigation>/<id-élément>`).
- `src/mockup/site.txt` (s'il existe) : texte du site web du prospect. Réutilise ses noms de produits, services,
  agences, slogans pour rendre la maquette crédible.

## Priorités pendant l'appel

1. Type de projet, modules et objets métier cités → navigation et entités avec les bons champs.
2. Le ou les écrans que le prospect a décrits avec émotion ou insistance → page sur mesure soignée.
3. Rôles utilisateurs → `roles` + filtrage de la navigation par rôle si c'est utile à la démo.
4. Tableau de bord avec les indicateurs que le prospect a cités.
5. Données réalistes pour son secteur.
