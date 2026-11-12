// Catalogue des types de projets qu'une agence de développement sur mesure
// (type ESN / agence web métier, ex. imagile.fr) construit pour ses clients.
// Sert à trois choses :
//  1. le moteur de brief classe le besoin du prospect dans un de ces types ;
//  2. le générateur choisit le template qui déclare ce type ;
//  3. il donne des pages, modules et entités « typiques » pour compléter la maquette
//     quand le prospect n'a pas encore tout détaillé (affiché comme hypothèse, jamais comme info du brief).

export interface ProjectType {
  id: string
  label: string
  famille: 'gestion' | 'portail' | 'metier' | 'web' | 'mobile' | 'commerce'
  description: string
  /** Mots ou expressions qui orientent vers ce type pendant l'appel. */
  signaux: string[]
  pagesTypiques: string[]
  modulesTypiques: string[]
  entitesTypiques: string[]
  rolesTypiques: string[]
  /** Priorité de création du template (1 = à faire en premier). */
  prioriteTemplate: 1 | 2 | 3
  /** Infos à obtenir propres à ce type de projet, ajoutées à la checklist dès qu'il est identifié. */
  champs: TypeField[]
}

export interface TypeField {
  id: string
  label: string
  description: string
  groupe: 'entreprise' | 'projet' | 'utilisateurs' | 'fonctionnel' | 'technique' | 'commercial'
  type: 'texte' | 'liste'
}

const F = (id: string, label: string, description: string, groupe: TypeField['groupe'] = 'fonctionnel', type: TypeField['type'] = 'texte'): TypeField => ({ id, label, description, groupe, type })

export const PROJECT_TYPES: ProjectType[] = [
  {
    id: 'erp',
    label: 'ERP / gestion intégrée',
    famille: 'gestion',
    description: 'Outil de gestion centralisé : ventes, achats, stocks, facturation, avec tableaux de bord.',
    signaux: ['ERP', 'gestion commerciale', 'stocks', 'facturation', 'devis', 'bons de commande', 'achats', 'inventaire', 'Excel partout'],
    pagesTypiques: ['Tableau de bord', 'Clients', 'Devis', 'Commandes', 'Factures', 'Articles', 'Stocks', 'Fournisseurs', 'Achats', 'Paramètres'],
    modulesTypiques: ['Ventes', 'Achats', 'Stocks', 'Facturation', 'Reporting'],
    entitesTypiques: ['Client', 'Devis', 'Commande', 'Facture', 'Article', 'Fournisseur', 'Mouvement de stock'],
    rolesTypiques: ['Direction', 'Commercial', 'Comptabilité', 'Magasinier'],
    prioriteTemplate: 1,
    champs: [F('erp_depots', 'Dépôts et stocks', 'Nombre de dépôts ou entrepôts, gestion multi-dépôts, inventaires'), F('erp_facturation', 'Cycle de vente', 'Du devis à la facture : étapes, acomptes, avoirs, relances'), F('erp_compta', 'Logiciel comptable', 'Outil de comptabilité à alimenter (export, synchronisation)', 'technique')]
  },
  {
    id: 'crm',
    label: 'CRM / relation client',
    famille: 'gestion',
    description: 'Suivi des prospects, clients, opportunités et actions commerciales.',
    signaux: ['CRM', 'prospects', 'pipeline', 'relances', 'opportunités', 'suivi commercial', 'fichier clients'],
    pagesTypiques: ['Tableau de bord', 'Pipeline', 'Contacts', 'Entreprises', 'Opportunités', 'Activités', 'Rapports'],
    modulesTypiques: ['Contacts', 'Pipeline', 'Activités', 'Campagnes', 'Reporting'],
    entitesTypiques: ['Contact', 'Entreprise', 'Opportunité', 'Activité', 'Devis'],
    rolesTypiques: ['Commercial', 'Manager commercial', 'Direction', 'Marketing'],
    prioriteTemplate: 1,
    champs: [F('crm_pipeline', 'Étapes du pipeline', 'Étapes de vente suivies, de la découverte à la signature', 'fonctionnel', 'liste'), F('crm_sources', 'Sources de leads', 'Origine des prospects : site, salons, partenaires…', 'fonctionnel', 'liste')]
  },
  {
    id: 'app-metier',
    label: 'Application métier sur mesure',
    famille: 'metier',
    description: "Outil qui informatise un processus spécifique de l'entreprise (dossiers, chantiers, production, contrôles...).",
    signaux: ['application métier', 'process', 'dossiers', 'workflow', 'validation', 'suivi', 'chantiers', 'production', 'interventions', 'moteur de calcul'],
    pagesTypiques: ['Tableau de bord', 'Liste des dossiers', 'Fiche dossier', 'Workflow / étapes', 'Planning', 'Documents', 'Administration'],
    modulesTypiques: ['Dossiers', 'Workflow de validation', 'Documents', 'Notifications', 'Statistiques'],
    entitesTypiques: ['Dossier', 'Étape', 'Document', 'Intervenant', 'Client'],
    rolesTypiques: ['Administrateur', 'Gestionnaire', 'Opérateur terrain', 'Responsable'],
    prioriteTemplate: 1,
    champs: [F('metier_validation', 'Circuit de validation', 'Qui valide quoi, à quelle étape'), F('metier_documents', 'Documents produits', 'Rapports, PV, attestations ou exports générés par l’outil', 'fonctionnel', 'liste')]
  },
  {
    id: 'intranet',
    label: 'Intranet / portail collaborateurs',
    famille: 'portail',
    description: "Portail interne : actualités, annuaire, documents, demandes internes, outils RH.",
    signaux: ['intranet', 'collaborateurs', 'salariés', 'communication interne', 'annuaire', 'notes de service', 'demandes de congés', 'onboarding'],
    pagesTypiques: ['Accueil / actualités', 'Annuaire', 'Documents', 'Demandes (congés, matériel)', 'Agenda', 'Mon profil', 'Administration'],
    modulesTypiques: ['Actualités', 'Annuaire', 'GED', 'Demandes internes', 'Agenda'],
    entitesTypiques: ['Collaborateur', 'Actualité', 'Document', 'Demande', 'Service'],
    rolesTypiques: ['Collaborateur', 'Manager', 'RH', 'Communication', 'Administrateur'],
    prioriteTemplate: 1,
    champs: [F('intranet_effectif', 'Collaborateurs concernés', 'Nombre de collaborateurs et de sites', 'utilisateurs'), F('intranet_contenus', 'Contenus attendus', 'Actualités, documents, annuaire, demandes internes…', 'fonctionnel', 'liste'), F('intranet_sso', 'Connexion', 'Identifiants de l’entreprise (Microsoft, Google) ou comptes dédiés', 'technique')]
  },
  {
    id: 'extranet',
    label: 'Extranet / portail clients, partenaires ou adhérents',
    famille: 'portail',
    description: 'Espace sécurisé pour les clients, partenaires, revendeurs ou adhérents : suivi, documents, commandes, demandes.',
    signaux: ['extranet', 'espace client', 'portail', 'espace adhérent', 'espace partenaire', 'revendeurs', 'suivi de commande', 'self-service'],
    pagesTypiques: ['Connexion', 'Accueil', 'Mes commandes / dossiers', 'Mes documents', 'Mes demandes / tickets', 'Mon compte', 'Back-office'],
    modulesTypiques: ['Espace client', 'Documents', 'Demandes / tickets', 'Commandes', 'Back-office'],
    entitesTypiques: ['Compte client', 'Commande', 'Document', 'Demande', 'Contrat'],
    rolesTypiques: ['Client', 'Partenaire', 'Gestionnaire interne', 'Administrateur'],
    prioriteTemplate: 1,
    champs: [F('extranet_public', 'Utilisateurs externes', 'Qui se connecte (clients, adhérents, partenaires) et combien', 'utilisateurs'), F('extranet_services', 'Services en ligne', 'Ce que l’utilisateur externe peut faire seul : suivre, commander, télécharger, signaler', 'fonctionnel', 'liste'), F('extranet_donnees', 'Source des données', 'D’où viennent les données affichées (ERP, CRM, fichiers)', 'technique')]
  },
  {
    id: 'planning-rdv',
    label: 'Planning, prise de rendez-vous, interventions',
    famille: 'metier',
    description: 'Planification de ressources, rendez-vous, tournées ou interventions, avec suivi et facturation.',
    signaux: ['planning', 'rendez-vous', 'agenda', 'créneaux', 'tournées', 'interventions', 'techniciens', 'dispatch'],
    pagesTypiques: ['Planning (calendrier)', 'Rendez-vous', 'Interventions', 'Ressources / équipes', 'Clients', 'Tableau de bord'],
    modulesTypiques: ['Planning', 'Prise de rendez-vous', 'Interventions', 'Équipes', 'Facturation'],
    entitesTypiques: ['Rendez-vous', 'Intervention', 'Technicien', 'Client', 'Créneau'],
    rolesTypiques: ['Planificateur', 'Technicien', 'Client', 'Responsable'],
    prioriteTemplate: 2,
    champs: [F('planning_ressources', 'Ressources planifiées', 'Techniciens, salles, véhicules… et leur nombre'), F('planning_regles', 'Règles de planification', 'Compétences, zones, durées, urgences')]
  },
  {
    id: 'gestion-documentaire',
    label: 'Gestion et génération de documents',
    famille: 'metier',
    description: 'Production de documents contractuels ou réglementaires à partir de modèles, circuits de signature, archivage.',
    signaux: ['documents', 'contrats', 'génération de documents', 'modèles', 'signature', 'GED', 'archivage', 'conformité'],
    pagesTypiques: ['Tableau de bord', 'Documents', 'Modèles', 'Génération', 'Circuit de validation', 'Archives'],
    modulesTypiques: ['Modèles', 'Génération', 'Signature', 'Archivage'],
    entitesTypiques: ['Document', 'Modèle', 'Signataire', 'Dossier'],
    rolesTypiques: ['Rédacteur', 'Valideur', 'Administrateur'],
    prioriteTemplate: 3,
    champs: [F('doc_types', 'Types de documents', 'Documents produits ou gérés', 'fonctionnel', 'liste'), F('doc_signature', 'Signature', 'Signature électronique, circuit de validation')]
  },
  {
    id: 'configurateur-devis',
    label: 'Configurateur / devis en ligne / moteur de calcul',
    famille: 'metier',
    description: 'Outil qui calcule un prix, un dimensionnement ou une offre à partir de paramètres saisis.',
    signaux: ['configurateur', 'calcul', 'chiffrage', 'devis automatique', 'simulateur', 'tarification', 'moteur de calcul'],
    pagesTypiques: ['Étapes du configurateur', 'Récapitulatif', 'Devis PDF', 'Historique des devis', 'Paramétrage des règles'],
    modulesTypiques: ['Configurateur', 'Règles de calcul', 'Devis', 'Back-office tarifs'],
    entitesTypiques: ['Configuration', 'Option', 'Règle', 'Devis', 'Client'],
    rolesTypiques: ['Client', 'Commercial', 'Administrateur des tarifs'],
    prioriteTemplate: 2,
    champs: [F('config_regles', 'Règles de calcul', 'Paramètres et règles qui déterminent le prix'), F('config_sortie', 'Résultat attendu', 'Devis PDF, commande, demande de contact')]
  },
  {
    id: 'pilotage-bi',
    label: 'Tableaux de bord / pilotage / reporting',
    famille: 'gestion',
    description: 'Consolidation de données et indicateurs pour la direction ou les équipes.',
    signaux: ['tableau de bord', 'indicateurs', 'KPI', 'reporting', 'pilotage', 'statistiques', 'consolidation'],
    pagesTypiques: ['Vue direction', 'Indicateurs par activité', 'Détail', 'Exports', 'Alertes'],
    modulesTypiques: ['Tableaux de bord', 'Alertes', 'Exports'],
    entitesTypiques: ['Indicateur', 'Période', 'Entité / site', 'Objectif'],
    rolesTypiques: ['Direction', 'Manager', 'Contrôleur de gestion'],
    prioriteTemplate: 2,
    champs: [F('bi_sources', 'Sources de données', 'Outils à consolider', 'technique', 'liste'), F('bi_frequence', 'Fréquence de mise à jour', 'Temps réel, quotidien, mensuel')]
  },
  {
    id: 'app-mobile-terrain',
    label: 'Application mobile / terrain (PWA ou native)',
    famille: 'mobile',
    description: 'Application pour équipes terrain : saisie, photos, géolocalisation, mode hors ligne, notifications.',
    signaux: ['mobile', 'terrain', 'tablette', 'hors ligne', 'offline', 'photos', 'géolocalisation', 'application iPhone', 'Android'],
    pagesTypiques: ['Accueil terrain', 'Liste des missions', 'Fiche mission', 'Saisie / formulaire', 'Photos', 'Synchronisation'],
    modulesTypiques: ['Missions', 'Formulaires terrain', 'Photos', 'Synchronisation', 'Notifications'],
    entitesTypiques: ['Mission', 'Rapport', 'Photo', 'Site', 'Technicien'],
    rolesTypiques: ['Technicien', 'Chef d’équipe', 'Bureau'],
    prioriteTemplate: 2,
    champs: [F('mobile_horsligne', 'Saisies hors ligne', 'Ce qui doit fonctionner sans réseau'), F('mobile_appareils', 'Appareils', 'Téléphones, tablettes, système', 'technique')]
  },
  {
    id: 'ecommerce-b2b',
    label: 'E-commerce B2B / B2C, catalogue connecté ERP',
    famille: 'commerce',
    description: 'Boutique ou catalogue en ligne, souvent B2B avec tarifs par client et lien avec l’ERP.',
    signaux: ['e-commerce', 'boutique', 'catalogue en ligne', 'commande en ligne', 'B2B', 'tarifs clients', 'panier'],
    pagesTypiques: ['Catalogue', 'Fiche produit', 'Panier', 'Mes commandes', 'Mon compte', 'Back-office'],
    modulesTypiques: ['Catalogue', 'Panier / commande', 'Comptes clients', 'Tarifs', 'Back-office'],
    entitesTypiques: ['Produit', 'Catégorie', 'Commande', 'Client', 'Tarif'],
    rolesTypiques: ['Client', 'Commercial', 'Administrateur'],
    prioriteTemplate: 3,
    champs: [F('ecom_catalogue', 'Taille du catalogue', 'Nombre de produits et de références'), F('ecom_tarifs', 'Tarifs clients', 'Tarifs négociés, remises, conditions')]
  },
  {
    id: 'marketplace-annuaire',
    label: 'Plateforme / marketplace / annuaire',
    famille: 'web',
    description: "Mise en relation entre plusieurs types d'utilisateurs, annuaire de membres, inscriptions.",
    signaux: ['plateforme', 'marketplace', 'mise en relation', 'annuaire', 'membres', 'inscription', 'start-up'],
    pagesTypiques: ['Accueil', 'Recherche / annuaire', 'Fiche membre', 'Inscription', 'Messagerie', 'Back-office'],
    modulesTypiques: ['Annuaire', 'Profils', 'Recherche', 'Messagerie', 'Modération'],
    entitesTypiques: ['Membre', 'Offre', 'Demande', 'Message', 'Catégorie'],
    rolesTypiques: ['Visiteur', 'Membre', 'Modérateur'],
    prioriteTemplate: 3,
    champs: [F('market_acteurs', 'Types d’utilisateurs', 'Profils mis en relation', 'utilisateurs', 'liste'), F('market_modele', 'Modèle économique', 'Commission, abonnement, gratuit', 'commercial')]
  },
  {
    id: 'site-institutionnel',
    label: 'Site vitrine / institutionnel avec espace membre',
    famille: 'web',
    description: 'Site de présentation (actualités, missions, offres) avec éventuellement un espace réservé.',
    signaux: ['site internet', 'site vitrine', 'refonte du site', 'institutionnel', 'actualités', 'CMS', 'référencement'],
    pagesTypiques: ['Accueil', 'À propos', 'Offres / services', 'Actualités', 'Contact', 'Espace membre'],
    modulesTypiques: ['Pages', 'Actualités', 'Formulaires', 'Espace membre'],
    entitesTypiques: ['Page', 'Actualité', 'Membre', 'Demande de contact'],
    rolesTypiques: ['Visiteur', 'Membre', 'Rédacteur'],
    prioriteTemplate: 3,
    champs: [F('site_espace', 'Espace réservé', 'Contenus réservés aux membres'), F('site_cms', 'Mise à jour', 'Qui met le site à jour, à quelle fréquence', 'technique')]
  }
]

export function getProjectType(id: string | null | undefined): ProjectType | undefined {
  return PROJECT_TYPES.find((t) => t.id === id)
}

/**
 * Type de projet « pressenti » avant l'appel (notes du commercial, texte du site) : sert seulement à choisir le
 * template de départ. Il n'entre pas dans le brief, qui ne contient que ce que le prospect a dit.
 */
export function guessProjectType(text: string): string | null {
  const t = ` ${text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `
  let best: { id: string; score: number } | null = null
  for (const pt of PROJECT_TYPES) {
    let score = 0
    for (const s of pt.signaux) {
      const n = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (t.includes(n)) score += n.includes(' ') ? 2 : 1
    }
    if (score > 0 && (!best || score > best.score)) best = { id: pt.id, score }
  }
  return best && best.score >= 2 ? best.id : null
}
