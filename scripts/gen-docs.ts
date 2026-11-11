// Génère docs/grille-qualification.md à partir du code (source unique de vérité).
//   npm run docs
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FIELDS, GROUPS } from '../src/shared/brief/schema'
import { PROJECT_TYPES } from '../src/shared/catalog'

const root = join(import.meta.dirname, '..')

const grille = [
  '# Grille de qualification',
  '',
  '> Fichier généré depuis `src/shared/brief/schema.ts` (`npm run docs`). Pour modifier la grille, modifiez le code.',
  '',
  `${FIELDS.length} informations en ${GROUPS.length} groupes. Priorité 1 = indispensable (marquée « clé » dans la checklist tant qu'elle manque).`,
  '« Maquette » = l\'information sert directement à construire la maquette ; sinon, elle sert à la qualification commerciale.',
  '',
  'Statuts : **obtenu** (dit clairement), **partiel** (évoqué, incomplet), **manquant** (pas dit : jamais deviné).',
  'Chaque information obtenue ou partielle porte une preuve : citation exacte du transcript, extrait du site web, ou saisie du commercial.',
  ''
]
for (const g of GROUPS) {
  grille.push(`## ${g.label}`, '', '| Information | Type | Priorité | Maquette | Ce qu\'on cherche | Question suggérée |', '|---|---|---|---|---|---|')
  for (const f of FIELDS.filter((x) => x.groupe === g.id))
    grille.push(`| **${f.label}** (\`${f.id}\`) | ${f.type} | ${f.priorite} | ${f.maquette ? 'oui' : ''} | ${f.description} | « ${f.question} » |`)
  grille.push('')
}
writeFileSync(join(root, 'docs', 'grille-qualification.md'), grille.join('\n'))

const cat = ['| Id | Type de projet | Famille | Priorité template | Pages typiques | Entités typiques |', '|---|---|---|---|---|---|']
for (const t of [...PROJECT_TYPES].sort((a, b) => a.prioriteTemplate - b.prioriteTemplate))
  cat.push(`| \`${t.id}\` | **${t.label}** — ${t.description} | ${t.famille} | ${t.prioriteTemplate} | ${t.pagesTypiques.join(', ')} | ${t.entitesTypiques.join(', ')} |`)
const intro = `# Catalogue des types de projets et feuille de route des templates

> Tableau généré depuis \`src/shared/catalog.ts\` (\`npm run docs\`). Le moteur de brief classe le besoin du prospect
> dans l'un de ces types ; le générateur choisit le template qui le déclare (sinon : template « socle » de repli).

## Ce que construit une agence comme imagile.fr

Lecture du site imagile.fr (pages services, applications web, application mobile, site internet, études de cas) :

- **Applications web métier sur mesure** : le cœur de l'activité (« tous les processus métiers peuvent faire l'objet
  d'un développement spécifique ») : statistiques, suivi, administration, aide à la décision, interfaçage avec le CRM,
  l'ERP et les bases de données, reprise de code existant. Exemples : saisie et gestion de dossiers clients
  (cabinet de conseil), facturation et planning de rendez-vous (services), prise de rendez-vous (transport portuaire),
  génération de documents contractuels (fédération du BTP), refonte d'outil de production (aéronautique), moteur de
  calcul sur mesure, espace pour professionnels, application responsive pour une agence d'intérim.
- **Applications mobiles** (natives ou hybrides, PWA conseillée quand elle suffit) : terrain, mode hors ligne,
  géolocalisation, photos, notifications ; ex. plateforme B2B d'entretien d'immeubles avec mode hors ligne,
  application interne pour les collaborateurs.
- **Sites sur mesure** : vitrine, institutionnel, blog, annuaire de membres, générateur de leads, souvent avec un
  **espace membre / adhérent** (portail).
- **E-commerce B2B / B2C** branché sur l'ERP et le CRM.
- Prestations associées : audit de code, audit du système d'information, SEO, UX, rédactionnel.
- Secteurs clients : BTP et travaux publics, industrie et aéronautique, transport et logistique, santé et laboratoires,
  intérim, notariat et formation, assurance, immobilier, édition, distribution, collectivités, services à domicile, tourisme.

Le site ne parle pas d'« intranet » ou d'« ERP » comme produits, mais d'applications métier qui en couvrent les
fonctions : le catalogue ci-dessous reprend donc les types du cahier des charges (ERP, intranet, extranet, application
métier) et ceux observés chez imagile (planning / rendez-vous, documents, configurateur, mobile terrain, e-commerce B2B,
plateforme / annuaire, site avec espace membre).

## Catalogue

`

const roadmap = `
## Feuille de route des templates

Aujourd'hui : un seul template, **socle** (générique, piloté par \`app.json\`), qui sert de repli à tous les types.
Proposition d'ordre de création (à confirmer avec les ~10 agences interrogées) :

| Priorité | Template | Couvre | Pourquoi |
|---|---|---|---|
| 1 | **App métier** (dossiers + workflow + planning) | \`app-metier\`, \`planning-rdv\`, \`gestion-documentaire\` | Le besoin le plus fréquent chez une agence comme imagile ; écrans clés : liste de dossiers, fiche avec étapes, planning. |
| 1 | **ERP / gestion commerciale** | \`erp\`, \`crm\`, \`pilotage-bi\` | Fort effet « waouh » (tableaux de bord, devis, factures, stocks) ; cité dans le cahier des charges. |
| 1 | **Portail extranet** (espace client / adhérent / partenaire) | \`extranet\`, \`site-institutionnel\` | Très demandé (espace adhérent, espace pro, suivi de commandes) ; mise en page différente (vue client). |
| 1 | **Intranet** | \`intranet\` | Actualités, annuaire, documents, demandes internes : vitrine différente du back-office. |
| 2 | **Mobile terrain** (rendu tablette / téléphone) | \`app-mobile-terrain\` | Souvent un module des projets ci-dessus (pointage, interventions, photos). |
| 2 | **Configurateur / devis** | \`configurateur-devis\` | Parcours en étapes très démonstratif. |
| 3 | **E-commerce B2B**, **plateforme / annuaire** | \`ecommerce-b2b\`, \`marketplace-annuaire\` | Moins cœur de cible (souvent des solutions du marché). |

Pour chaque template : 4 à 6 pages très soignées, un \`CLAUDE.md\` précis (ce que l'IA peut modifier et comment), des
jeux de données par secteur, et le même contrat \`src/mockup/\` pour profiter du générateur de base (voir [templates.md](templates.md)).
`
writeFileSync(join(root, 'docs', 'catalogue-projets.md'), intro + cat.join('\n') + '\n' + roadmap)
console.log('docs générées')
