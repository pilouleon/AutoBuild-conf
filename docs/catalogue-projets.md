# Catalogue des types de projets et feuille de route des templates

> Tableau généré depuis `src/shared/catalog.ts` (`npm run docs`). Le moteur de brief classe le besoin du prospect
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

| Id | Type de projet | Famille | Priorité template | Pages typiques | Entités typiques |
|---|---|---|---|---|---|
| `erp` | **ERP / gestion intégrée** — Outil de gestion centralisé : ventes, achats, stocks, facturation, avec tableaux de bord. | gestion | 1 | Tableau de bord, Clients, Devis, Commandes, Factures, Articles, Stocks, Fournisseurs, Achats, Paramètres | Client, Devis, Commande, Facture, Article, Fournisseur, Mouvement de stock |
| `crm` | **CRM / relation client** — Suivi des prospects, clients, opportunités et actions commerciales. | gestion | 1 | Tableau de bord, Pipeline, Contacts, Entreprises, Opportunités, Activités, Rapports | Contact, Entreprise, Opportunité, Activité, Devis |
| `app-metier` | **Application métier sur mesure** — Outil qui informatise un processus spécifique de l'entreprise (dossiers, chantiers, production, contrôles...). | metier | 1 | Tableau de bord, Liste des dossiers, Fiche dossier, Workflow / étapes, Planning, Documents, Administration | Dossier, Étape, Document, Intervenant, Client |
| `intranet` | **Intranet / portail collaborateurs** — Portail interne : actualités, annuaire, documents, demandes internes, outils RH. | portail | 1 | Accueil / actualités, Annuaire, Documents, Demandes (congés, matériel), Agenda, Mon profil, Administration | Collaborateur, Actualité, Document, Demande, Service |
| `extranet` | **Extranet / portail clients, partenaires ou adhérents** — Espace sécurisé pour les clients, partenaires, revendeurs ou adhérents : suivi, documents, commandes, demandes. | portail | 1 | Connexion, Accueil, Mes commandes / dossiers, Mes documents, Mes demandes / tickets, Mon compte, Back-office | Compte client, Commande, Document, Demande, Contrat |
| `planning-rdv` | **Planning, prise de rendez-vous, interventions** — Planification de ressources, rendez-vous, tournées ou interventions, avec suivi et facturation. | metier | 2 | Planning (calendrier), Rendez-vous, Interventions, Ressources / équipes, Clients, Tableau de bord | Rendez-vous, Intervention, Technicien, Client, Créneau |
| `configurateur-devis` | **Configurateur / devis en ligne / moteur de calcul** — Outil qui calcule un prix, un dimensionnement ou une offre à partir de paramètres saisis. | metier | 2 | Étapes du configurateur, Récapitulatif, Devis PDF, Historique des devis, Paramétrage des règles | Configuration, Option, Règle, Devis, Client |
| `pilotage-bi` | **Tableaux de bord / pilotage / reporting** — Consolidation de données et indicateurs pour la direction ou les équipes. | gestion | 2 | Vue direction, Indicateurs par activité, Détail, Exports, Alertes | Indicateur, Période, Entité / site, Objectif |
| `app-mobile-terrain` | **Application mobile / terrain (PWA ou native)** — Application pour équipes terrain : saisie, photos, géolocalisation, mode hors ligne, notifications. | mobile | 2 | Accueil terrain, Liste des missions, Fiche mission, Saisie / formulaire, Photos, Synchronisation | Mission, Rapport, Photo, Site, Technicien |
| `gestion-documentaire` | **Gestion et génération de documents** — Production de documents contractuels ou réglementaires à partir de modèles, circuits de signature, archivage. | metier | 3 | Tableau de bord, Documents, Modèles, Génération, Circuit de validation, Archives | Document, Modèle, Signataire, Dossier |
| `ecommerce-b2b` | **E-commerce B2B / B2C, catalogue connecté ERP** — Boutique ou catalogue en ligne, souvent B2B avec tarifs par client et lien avec l’ERP. | commerce | 3 | Catalogue, Fiche produit, Panier, Mes commandes, Mon compte, Back-office | Produit, Catégorie, Commande, Client, Tarif |
| `marketplace-annuaire` | **Plateforme / marketplace / annuaire** — Mise en relation entre plusieurs types d'utilisateurs, annuaire de membres, inscriptions. | web | 3 | Accueil, Recherche / annuaire, Fiche membre, Inscription, Messagerie, Back-office | Membre, Offre, Demande, Message, Catégorie |
| `site-institutionnel` | **Site vitrine / institutionnel avec espace membre** — Site de présentation (actualités, missions, offres) avec éventuellement un espace réservé. | web | 3 | Accueil, À propos, Offres / services, Actualités, Contact, Espace membre | Page, Actualité, Membre, Demande de contact |

## Feuille de route des templates

Aujourd'hui : un seul template, **socle** (générique, piloté par `app.json`), qui sert de repli à tous les types.
Proposition d'ordre de création (à confirmer avec les ~10 agences interrogées) :

| Priorité | Template | Couvre | Pourquoi |
|---|---|---|---|
| 1 | **App métier** (dossiers + workflow + planning) | `app-metier`, `planning-rdv`, `gestion-documentaire` | Le besoin le plus fréquent chez une agence comme imagile ; écrans clés : liste de dossiers, fiche avec étapes, planning. |
| 1 | **ERP / gestion commerciale** | `erp`, `crm`, `pilotage-bi` | Fort effet « waouh » (tableaux de bord, devis, factures, stocks) ; cité dans le cahier des charges. |
| 1 | **Portail extranet** (espace client / adhérent / partenaire) | `extranet`, `site-institutionnel` | Très demandé (espace adhérent, espace pro, suivi de commandes) ; mise en page différente (vue client). |
| 1 | **Intranet** | `intranet` | Actualités, annuaire, documents, demandes internes : vitrine différente du back-office. |
| 2 | **Mobile terrain** (rendu tablette / téléphone) | `app-mobile-terrain` | Souvent un module des projets ci-dessus (pointage, interventions, photos). |
| 2 | **Configurateur / devis** | `configurateur-devis` | Parcours en étapes très démonstratif. |
| 3 | **E-commerce B2B**, **plateforme / annuaire** | `ecommerce-b2b`, `marketplace-annuaire` | Moins cœur de cible (souvent des solutions du marché). |

Pour chaque template : 4 à 6 pages très soignées, un `CLAUDE.md` précis (ce que l'IA peut modifier et comment), des
jeux de données par secteur, et le même contrat `src/mockup/` pour profiter du générateur de base (voir [templates.md](templates.md)).
