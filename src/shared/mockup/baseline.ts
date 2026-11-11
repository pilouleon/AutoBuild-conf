// Générateur « de base », sans IA : transforme le brief en app.json en quelques millisecondes.
// - utilisé seul en mode démo (sans clé API) et comme plan B ;
// - sert de point de départ à l'agent IA, qui l'enrichit ensuite avec du code sur mesure.

import { getProjectType } from '../catalog'
import type { Brief, BriefItem } from '../brief/schema'
import { Faker } from './fake'
import type { AppConfig, Entity, Field, FieldType, NavItem } from './types'

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'element'
  )
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function pluralize(label: string): string {
  const words = label.split(' ')
  const w = words[0]
  let p = w
  if (/(s|x|z)$/i.test(w)) p = w
  else if (/(eau|au|eu)$/i.test(w)) p = w + 'x'
  else if (/al$/i.test(w) && !/(festival|carnaval|bal)$/i.test(w)) p = w.slice(0, -2) + 'aux'
  else p = w + 's'
  return [p, ...words.slice(1)].join(' ')
}

const FEMININ = /(facture|commande|intervention|demande|opportunit|activit|actualit|mission|tâche|tache|livraison|réservation|reservation|visite|fiche|offre|vente|campagne|réclamation|candidature|formation|équipe|equipe|entreprise|société|societe|ressource|note|catégorie|categorie|machine|pièce|piece|prestation|affaire|location|session|inscription|consultation|alerte|étape|etape|consultation|requête|requete|plainte|anomalie|zone|agence|tournée|tournee)/i

// ── Préréglages d'entités connues (champs et statuts crédibles) ──────────────
interface Preset {
  match: RegExp
  label: string
  icone: string
  champs: Field[]
  statuts?: string[]
  titre: string
  vues?: Entity['vues']
}

const S = (id: string, label: string, type: FieldType, extra: Partial<Field> = {}): Field => ({ id, label, type, ...extra })

const PRESETS: Preset[] = [
  { match: /(pointage|feuille de temps|feuilles d.heures|temps passé|temps passe)/i, label: 'Pointage', icone: 'clock', titre: 'reference', statuts: ['Saisi', 'Validé', 'Transmis à la paie'], vues: ['liste', 'kanban', 'calendrier'],
    champs: [S('reference', 'Référence', 'texte'), S('salarie', 'Salarié', 'personne'), S('chantier', 'Chantier', 'texte'), S('date', 'Date', 'date'), S('heures', 'Heures', 'nombre')] },
  { match: /situation/i, label: 'Situation de travaux', icone: 'invoice', titre: 'reference', statuts: ['Brouillon', 'Validée', 'Exportée en comptabilité'],
    champs: [S('reference', 'Référence', 'texte'), S('chantier', 'Chantier', 'texte'), S('mois', 'Mois', 'texte'), S('avancement', 'Avancement', 'pourcent'), S('montant', 'Montant HT', 'euro')] },
  { match: /chantier/i, label: 'Chantier', icone: 'hardhat', titre: 'nom', statuts: ['À démarrer', 'En cours', 'En retard', 'Réceptionné'], vues: ['liste', 'kanban', 'calendrier'],
    champs: [S('nom', 'Chantier', 'texte'), S('client', 'Client', 'texte'), S('adresse', 'Adresse', 'texte'), S('chef', 'Chef de chantier', 'personne'), S('debut', 'Date de début', 'date'), S('fin', 'Fin prévue', 'date'), S('montant', 'Montant', 'euro'), S('avancement', 'Avancement', 'pourcent')] },
  { match: /devis/i, label: 'Devis', icone: 'file', titre: 'numero', statuts: ['Brouillon', 'Envoyé', 'Accepté', 'Refusé'],
    champs: [S('numero', 'N° devis', 'texte'), S('client', 'Client', 'texte'), S('date', 'Date', 'date'), S('montant', 'Montant HT', 'euro'), S('commercial', 'Commercial', 'personne')] },
  { match: /factur/i, label: 'Facture', icone: 'invoice', titre: 'numero', statuts: ['Brouillon', 'Envoyée', 'Payée', 'En retard'],
    champs: [S('numero', 'N° facture', 'texte'), S('client', 'Client', 'texte'), S('date', 'Date', 'date'), S('echeance', 'Échéance', 'date'), S('montant', 'Montant TTC', 'euro')] },
  { match: /commande/i, label: 'Commande', icone: 'cart', titre: 'numero', statuts: ['À préparer', 'En préparation', 'Expédiée', 'Livrée'],
    champs: [S('numero', 'N° commande', 'texte'), S('client', 'Client', 'texte'), S('date', 'Date', 'date'), S('livraison', 'Livraison prévue', 'date'), S('montant', 'Montant HT', 'euro')] },
  { match: /(article|produit|stock|référence|reference|catalogue|matériel|materiel|pièce|piece)/i, label: 'Article', icone: 'box', titre: 'designation', statuts: ['En stock', 'Stock faible', 'Rupture'],
    champs: [S('reference', 'Référence', 'texte'), S('designation', 'Désignation', 'texte'), S('categorie', 'Catégorie', 'choix', { options: ['Fournitures', 'Équipement', 'Consommable', 'Pièce détachée'] }), S('quantite', 'Quantité', 'nombre'), S('prix', 'Prix unitaire', 'euro'), S('emplacement', 'Emplacement', 'texte')] },
  { match: /fournisseur/i, label: 'Fournisseur', icone: 'truck', titre: 'nom', statuts: ['Actif', 'À référencer', 'Inactif'],
    champs: [S('nom', 'Fournisseur', 'texte'), S('contact', 'Contact', 'personne'), S('telephone', 'Téléphone', 'telephone'), S('ville', 'Ville', 'texte'), S('delai', 'Délai moyen (jours)', 'nombre')] },
  { match: /(client|compte|entreprise|société|societe|prospect)/i, label: 'Client', icone: 'building', titre: 'nom', statuts: ['Prospect', 'Actif', 'Inactif'],
    champs: [S('nom', 'Raison sociale', 'texte'), S('contact', 'Contact', 'personne'), S('email', 'E-mail', 'email'), S('telephone', 'Téléphone', 'telephone'), S('ville', 'Ville', 'texte'), S('ca', 'CA annuel', 'euro')] },
  { match: /(contact|interlocuteur)/i, label: 'Contact', icone: 'user', titre: 'nom',
    champs: [S('nom', 'Nom', 'personne'), S('societe', 'Société', 'texte'), S('fonction', 'Fonction', 'texte'), S('email', 'E-mail', 'email'), S('telephone', 'Téléphone', 'telephone')] },
  { match: /(opportunit|affaire|deal|pipeline)/i, label: 'Opportunité', icone: 'star', titre: 'nom', statuts: ['Découverte', 'Proposition', 'Négociation', 'Gagnée', 'Perdue'], vues: ['kanban', 'liste'],
    champs: [S('nom', 'Opportunité', 'texte'), S('client', 'Client', 'texte'), S('montant', 'Montant', 'euro'), S('probabilite', 'Probabilité', 'pourcent'), S('cloture', 'Clôture prévue', 'date'), S('commercial', 'Commercial', 'personne')] },
  { match: /(intervention|maintenance|dépannage|depannage|visite|tournée|tournee|mission)/i, label: 'Intervention', icone: 'wrench', titre: 'reference', statuts: ['Planifiée', 'En cours', 'Terminée', 'Annulée'], vues: ['calendrier', 'liste', 'kanban'],
    champs: [S('reference', 'Référence', 'texte'), S('client', 'Client', 'texte'), S('technicien', 'Technicien', 'personne'), S('date', 'Date', 'date'), S('adresse', 'Adresse', 'texte'), S('duree', 'Durée (h)', 'nombre')] },
  { match: /(rendez|rdv|réservation|reservation|créneau|creneau)/i, label: 'Rendez-vous', icone: 'calendar', titre: 'objet', statuts: ['Confirmé', 'À confirmer', 'Annulé'], vues: ['calendrier', 'liste'],
    champs: [S('objet', 'Objet', 'texte'), S('client', 'Client', 'personne'), S('date', 'Date', 'date'), S('heure', 'Heure', 'texte'), S('lieu', 'Lieu', 'texte')] },
  { match: /(ticket|demande|réclamation|reclamation|incident|support|sav)/i, label: 'Demande', icone: 'ticket', titre: 'sujet', statuts: ['Nouvelle', 'En cours', 'En attente client', 'Résolue'], vues: ['liste', 'kanban'],
    champs: [S('sujet', 'Sujet', 'texte'), S('demandeur', 'Demandeur', 'personne'), S('date', 'Date', 'date'), S('priorite', 'Priorité', 'choix', { options: ['Basse', 'Normale', 'Haute', 'Urgente'] }), S('assigne', 'Assignée à', 'personne')] },
  { match: /(document|contrat|pièce jointe|ged)/i, label: 'Document', icone: 'file', titre: 'titre', statuts: ['Brouillon', 'En validation', 'Validé', 'Archivé'],
    champs: [S('titre', 'Titre', 'texte'), S('type', 'Type', 'choix', { options: ['Contrat', 'Procès-verbal', 'Rapport', 'Attestation'] }), S('auteur', 'Auteur', 'personne'), S('date', 'Date', 'date')] },
  { match: /(collaborateur|salarié|salarie|employé|employe|technicien|équipes?\b|equipes?\b|personnel|ressource humaine)/i, label: 'Collaborateur', icone: 'users', titre: 'nom', statuts: ['Disponible', 'En mission', 'Absent'],
    champs: [S('nom', 'Nom', 'personne'), S('poste', 'Poste', 'texte'), S('service', 'Service', 'choix', { options: ['Direction', 'Exploitation', 'Commercial', 'Administratif', 'Technique'] }), S('email', 'E-mail', 'email'), S('telephone', 'Téléphone', 'telephone')] },
  { match: /(actualit|news|annonce)/i, label: 'Actualité', icone: 'news', titre: 'titre', statuts: ['Brouillon', 'Publiée'],
    champs: [S('titre', 'Titre', 'texte'), S('auteur', 'Auteur', 'personne'), S('date', 'Date', 'date'), S('categorie', 'Catégorie', 'choix', { options: ['Vie de l’entreprise', 'RH', 'Sécurité', 'Clients'] })] },
  { match: /(véhicule|vehicule|camion|engin|machine|équipement|equipement|parc)/i, label: 'Équipement', icone: 'truck', titre: 'nom', statuts: ['Disponible', 'Affecté', 'En maintenance'],
    champs: [S('nom', 'Nom', 'texte'), S('immatriculation', 'Immatriculation / n° série', 'texte'), S('affectation', 'Affecté à', 'personne'), S('prochaineMaintenance', 'Prochaine maintenance', 'date')] }
]

/** Devine le type d'un champ d'après son nom (attribut cité par le prospect). */
export function inferFieldType(name: string, entityNames: string[] = []): { type: FieldType; reference?: string } {
  const n = name.toLowerCase()
  if (/(avancement|progression|taux|pourcentage|%)/.test(n)) return { type: 'pourcent' }
  if (/(statut|état|etat|étape|etape|phase)/.test(n)) return { type: 'statut' }
  if (/(date|début|debut|fin\b|échéance|echeance|livraison|jour|délai le|deadline|prévu|prevu)/.test(n)) return { type: 'date' }
  if (/(montant|prix|coût|cout|budget|\bca\b|chiffre|total|\bht\b|ttc|tarif|marge|valeur)/.test(n)) return { type: 'euro' }
  if (/(e-?mail|courriel)/.test(n)) return { type: 'email' }
  if (/(téléphone|telephone|\btél|\btel\b|portable|mobile)/.test(n)) return { type: 'telephone' }
  if (/(chef|responsable|technicien|commercial|conducteur|gestionnaire|assigné|assigne|interlocuteur|référent|referent|salarié|salarie|employé|employe|auteur|demandeur|intervenant|ouvrier|chauffeur|opérateur|operateur)/.test(n)) return { type: 'personne' }
  for (const e of entityNames) if (e && n.includes(e.toLowerCase())) return { type: 'reference', reference: slugify(e) }
  if (/(quantité|quantite|nombre|\bnb\b|qté|qte|stock|heures|durée|duree|effectif|surface|poids|kilom)/.test(n)) return { type: 'nombre' }
  if (/(description|commentaire|note|observation|remarque|détail|detail)/.test(n)) return { type: 'texte-long' }
  if (/(urgent|urgence|validé|valide|actif|oui\/non)/.test(n)) return { type: 'booleen' }
  return { type: 'texte' }
}

function presetFor(name: string): Preset | undefined {
  return PRESETS.find((p) => p.match.test(name))
}

function statusOptionsFor(name: string): string[] {
  return presetFor(name)?.statuts ?? ['À traiter', 'En cours', 'En attente', 'Terminé']
}

/** Construit une entité à partir d'un objet métier cité (nom + attributs). */
export function buildEntity(item: BriefItem, otherEntityNames: string[]): Entity {
  const nom = cap(item.nom.trim())
  const id = slugify(nom)
  const preset = presetFor(nom)
  const attrs = (item.attributs ?? []).map((a) => a.trim()).filter(Boolean)
  let champs: Field[]
  if (attrs.length) {
    // Les champs cités par le prospect d'abord, avec ses mots.
    champs = []
    const titre = preset?.champs.find((c) => c.id === preset.titre)
    if (!attrs.some((a) => /(nom|numéro|numero|référence|reference|titre|intitulé|libellé)/i.test(a))) {
      champs.push(titre ? { ...titre, label: titre.label === 'Chantier' ? nom : titre.label } : S('reference', 'Référence', 'texte'))
    }
    for (const a of attrs) {
      const t = inferFieldType(a, otherEntityNames.filter((e) => e.toLowerCase() !== nom.toLowerCase()))
      const fid = slugify(a).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
      if (champs.some((c) => c.id === fid)) continue
      champs.push({ id: fid, label: cap(a), type: t.type, ...(t.reference ? { reference: t.reference } : {}) })
    }
  } else if (preset) {
    champs = preset.champs.map((c) => ({ ...c }))
    if (preset.titre === 'nom' && champs[0]?.label === 'Chantier') champs[0].label = nom
  } else {
    champs = [S('nom', 'Nom', 'texte'), S('responsable', 'Responsable', 'personne'), S('date', 'Date', 'date')]
  }
  // Un statut rend les vues kanban et les badges possibles.
  let statut = champs.find((c) => c.type === 'statut')
  if (!statut) {
    statut = S('statut', 'Statut', 'statut')
    champs.push(statut)
  }
  statut.options = statut.options?.length ? statut.options : statusOptionsFor(nom)
  const titre = champs.find((c) => c.type === 'texte') ?? champs[0]
  const date = champs.find((c) => c.type === 'date')
  const vues: Entity['vues'] = preset?.vues ?? (date ? ['liste', 'kanban', 'calendrier'] : ['liste', 'kanban'])
  return {
    id,
    label: nom,
    labelPluriel: cap(pluralize(nom)),
    icone: preset?.icone ?? 'folder',
    feminin: FEMININ.test(nom),
    champs,
    champTitre: titre.id,
    champStatut: statut.id,
    champDate: date?.id,
    vues: vues.filter((v) => v !== 'calendrier' || !!date),
    donnees: []
  }
}

/** Remplit une entité avec des données fictives cohérentes (déterministes). */
export function fillEntity(entity: Entity, seed: string, ctx: { count?: number; secteur?: string; entities: Entity[] }): Entity {
  const f = new Faker(`${seed}:${entity.id}`)
  const count = ctx.count ?? f.int(12, 18)
  const prefix = entity.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'REF'
  const people = Array.from({ length: 6 }, () => f.personne())
  const companies = Array.from({ length: 10 }, () => f.client(ctx.secteur))
  const rows: Entity['donnees'] = []
  for (let i = 0; i < count; i++) {
    const row: Entity['donnees'][number] = { id: String(i + 1) }
    for (const c of entity.champs) row[c.id] = fakeValue(c, entity, i, f, { prefix, people, companies, ctx })
    rows.push(row)
  }
  // Cohérence des dates début / fin.
  const d1 = entity.champs.find((c) => c.type === 'date' && /(début|debut|date)/i.test(c.label))
  const d2 = entity.champs.find((c) => c.type === 'date' && c !== d1 && /(fin|échéance|echeance|livraison|prévu|prevu|clôture|cloture)/i.test(c.label))
  if (d1 && d2) {
    for (const r of rows) {
      const start = new Date(String(r[d1.id]))
      r[d2.id] = new Date(start.getTime() + f.int(10, 120) * 86_400_000).toISOString().slice(0, 10)
    }
  }
  // Type d'engin cohérent avec son nom.
  const typeField = entity.champs.find((c) => /^(type|catégorie|categorie)/i.test(c.label))
  if (typeField && /(engin|véhicule|vehicule|machine|équipement|equipement)/i.test(entity.label)) {
    const map: [RegExp, string][] = [[/mini-pelle/i, 'Mini-pelle'], [/pelle/i, 'Pelle sur chenilles'], [/camion/i, 'Camion benne'], [/compacteur/i, 'Compacteur'], [/chargeuse/i, 'Chargeuse'], [/tombereau/i, 'Tombereau'], [/niveleuse/i, 'Niveleuse']]
    for (const r of rows) {
      const t = String(r[entity.champTitre] ?? '')
      const hit = map.find(([re]) => re.test(t))
      if (hit) r[typeField.id] = hit[1]
    }
  }
  // Mois au format lisible.
  const moisField = entity.champs.find((c) => /^mois$/i.test(c.label))
  if (moisField) for (const r of rows) r[moisField.id] = f.pick(['Juillet 2026', 'Août 2026', 'Septembre 2026', 'Octobre 2026', 'Novembre 2026'])
  // Avancement cohérent avec le statut.
  const pct = entity.champs.find((c) => c.type === 'pourcent')
  const st = entity.champs.find((c) => c.id === entity.champStatut)
  if (pct && st?.options) {
    for (const r of rows) {
      const idx = st.options.indexOf(String(r[st.id]))
      if (idx === 0) r[pct.id] = 0
      else if (/(termin|réception|reception|livr|clos|pay)/i.test(String(r[st.id]))) r[pct.id] = 100
    }
  }
  return { ...entity, donnees: rows }
}

function fakeValue(
  c: Field,
  entity: Entity,
  i: number,
  f: Faker,
  x: { prefix: string; people: string[]; companies: string[]; ctx: { entities: Entity[] } }
): string | number | boolean | null {
  const l = c.label.toLowerCase()
  switch (c.type) {
    case 'statut':
    case 'choix': {
      const opts = c.options ?? ['À traiter', 'En cours', 'Terminé']
      // Distribution réaliste : surtout « en cours », quelques extrêmes.
      const w = opts.map((_, k) => (k === 1 ? 3 : k === 0 ? 2 : k === opts.length - 1 ? 2 : 1))
      let r = f.float() * w.reduce((a, b) => a + b, 0)
      for (let k = 0; k < opts.length; k++) {
        r -= w[k]
        if (r <= 0) return opts[k]
      }
      return opts[0]
    }
    case 'date':
      return f.date(/(fin|échéance|echeance|livraison|prévu|prevu|clôture)/.test(l) ? 0 : -75, /(fin|échéance|echeance|livraison|prévu|prevu|clôture)/.test(l) ? 120 : 30)
    case 'euro': {
      if (/(prix|unitaire|tarif)/.test(l)) return f.int(4, 480) + f.int(0, 99) / 100
      if (/(ca|chiffre)/.test(l)) return f.int(80, 4500) * 1000
      if (/(budget|marché|marche|chantier)/.test(l) || /chantier/i.test(entity.label)) return f.int(18, 950) * 1000
      return f.int(6, 180) * 100
    }
    case 'pourcent':
      return f.int(5, 95)
    case 'nombre':
      if (/(délai|delai|jour)/.test(l)) return f.int(2, 21)
      if (/(heure|durée|duree)/.test(l)) return f.int(1, 8)
      if (/(quantit|stock|qté)/.test(l)) return f.int(0, 420)
      return f.int(1, 60)
    case 'email':
      return f.email()
    case 'telephone':
      return f.telephone()
    case 'personne':
      return x.people[f.int(0, x.people.length - 1)]
    case 'booleen':
      return f.float() > 0.6
    case 'reference': {
      const target = x.ctx.entities.find((e) => e.id === c.reference)
      const pool = target?.donnees.map((d) => String(d[target.champTitre] ?? '')).filter(Boolean)
      return pool?.length ? f.pick(pool) : x.companies[f.int(0, x.companies.length - 1)]
    }
    case 'texte-long':
      return f.pick(['RAS, conforme au cahier des charges.', 'Prévoir un point avec le client la semaine prochaine.', 'Documents reçus, en attente de validation.', 'Contraintes d’accès à vérifier sur place.', 'Priorité haute demandée par la direction.'])
    default: {
      if (c.id === entity.champTitre && /(n°|numéro|numero|référence|reference|ref)/.test(l)) return `${x.prefix}-2026-${String(i + 1).padStart(3, '0')}`
      if (/(n°|numéro|numero|référence|reference|\bref\b|immatriculation)/.test(l)) return `${x.prefix}-${String(1000 + i * 7 + f.int(0, 6))}`
      if (/(client|société|societe|entreprise|raison sociale|fournisseur|donneur)/.test(l)) return x.companies[f.int(0, x.companies.length - 1)]
      if (/(adresse|lieu|site)/.test(l)) return f.adresse()
      if (/ville/.test(l)) return f.ville()
      if (/(nom|prénom|prenom)/.test(l) && /(collaborateur|contact|personne|salari)/i.test(entity.label)) return x.people[i % x.people.length]
      if (/(désignation|designation|produit|article)/.test(l)) return f.produit()
      if (/(sujet|objet|titre)/.test(l)) return f.sujet()
      if (/(heure)/.test(l)) return `${f.int(8, 17)}h${f.pick(['00', '30'])}`
      if (/(poste|fonction)/.test(l)) return f.pick(['Chargé d’affaires', 'Assistante de direction', 'Responsable d’exploitation', 'Technicien', 'Comptable', 'Conducteur de travaux'])
      if (/^(type|catégorie|categorie|modèle|modele)/.test(l) && /(engin|véhicule|vehicule|machine|équipement|equipement|matériel|materiel)/i.test(entity.label)) return f.pick(['Pelle sur chenilles', 'Mini-pelle', 'Camion benne', 'Compacteur', 'Chargeuse', 'Tombereau', 'Niveleuse'])
      if (c.id === entity.champTitre) {
        if (/(engin|véhicule|vehicule|machine|équipement|equipement)/i.test(entity.label)) return `${f.pick(['Pelle 22 t', 'Mini-pelle 5 t', 'Camion benne 19 t', 'Compacteur V4', 'Chargeuse 950', 'Tombereau 25 t', 'Niveleuse 140'])} n°${String(i + 1).padStart(2, '0')}`
        if (/chantier/i.test(entity.label)) return `${f.pick(['Réhabilitation', 'Construction', 'Extension', 'Rénovation', 'Aménagement', 'Voirie'])} ${f.pick(['groupe scolaire', 'logements', 'entrepôt', 'mairie', 'gymnase', 'résidence', 'parking', 'centre médical', 'rue des Lilas'])} — ${f.ville()}`
        return `${entity.label} ${f.ville()} ${String(i + 1).padStart(2, '0')}`
      }
      return f.pick(['Standard', 'Prioritaire', 'Secteur Nord', 'Secteur Sud', 'Agence centrale', 'Lot 2'])
    }
  }
}

const TITRES: Record<string, string> = {
  erp: 'Gestion',
  crm: 'CRM',
  intranet: 'Intranet',
  extranet: 'Espace client',
  'planning-rdv': 'Planning',
  'gestion-documentaire': 'Documents',
  'configurateur-devis': 'Configurateur',
  'pilotage-bi': 'Pilotage',
  'app-mobile-terrain': 'Terrain',
  'ecommerce-b2b': 'Boutique pro',
  'marketplace-annuaire': 'Plateforme',
  'site-institutionnel': 'Espace membre'
}

export interface BaselineInput {
  brief: Brief
  nomEntreprise: string
  secteur?: string
  seed: string
}

/** Construit l'app.json complet à partir du brief. Les hypothèses (catalogue) complètent ce qui manque. */
export function buildAppConfig(input: BaselineInput): AppConfig {
  const { brief, nomEntreprise, seed } = input
  const pt = getProjectType(brief.typeProjet) ?? getProjectType('app-metier')!
  const ch = brief.champs

  // 1. Entités : objets métier cités, puis modules cités, puis hypothèses du catalogue.
  const items: BriefItem[] = [...(ch.entites?.items ?? [])]
  const has = (n: string, p = presetFor(n)) => items.some((i) => slugify(i.nom) === slugify(n) || (!!p && presetFor(i.nom) === p))
  for (const m of ch.modules?.items ?? []) {
    const p = presetFor(m.nom)
    if (p && !has(p.label, p)) items.push({ nom: p.label })
  }
  if (items.length < 2) for (const e of pt.entitesTypiques) if (items.length < 3 && !has(e)) items.push({ nom: e })
  const names = items.map((i) => i.nom)
  let entities = items.slice(0, 7).map((i) => buildEntity(i, names))
  // Remplissage : d'abord les entités sans référence, pour que les références pointent vers des données existantes.
  const filled: Entity[] = []
  const order = [...entities].sort((a, b) => Number(a.champs.some((c) => c.type === 'reference')) - Number(b.champs.some((c) => c.type === 'reference')))
  const secteur = [input.secteur, ch.secteur?.valeur].filter(Boolean).join(' ')
  for (const e of order) filled.push(fillEntity(e, seed, { entities: filled, secteur }))
  entities = entities.map((e) => filled.find((x) => x.id === e.id)!)

  // 2. Rôles.
  const roleItems = ch.roles?.items?.length ? ch.roles.items.map((r) => ({ nom: r.nom, details: r.details })) : pt.rolesTypiques.map((r) => ({ nom: r, details: undefined }))
  const roles = roleItems.slice(0, 5).map((r) => ({ id: slugify(r.nom), label: cap(r.nom), description: r.details }))

  // 3. Navigation.
  const navigation: NavItem[] = [{ id: 'accueil', label: 'Tableau de bord', icone: 'dashboard', type: 'tableau-de-bord' }]
  for (const e of entities) navigation.push({ id: slugify(e.labelPluriel), label: e.labelPluriel, icone: e.icone, type: 'entite', cible: e.id })

  // 4. Tableau de bord.
  const main = entities[0]
  const money = main?.champs.find((c) => c.type === 'euro')
  const status = main?.champs.find((c) => c.id === main.champStatut)
  const f = new Faker(`${seed}:dashboard`)
  const kpis: AppConfig['tableauDeBord']['kpis'] = []
  for (const ind of ch.indicateurs?.items ?? []) {
    if (kpis.length >= 4) break
    const l = ind.nom.toLowerCase()
    const isMoney = /(chiffre|\bca\b|montant|€|euro|budget)/.test(l)
    const isRate = !isMoney && /(taux|%|pourcent|marge|satisfaction|occupation|remplissage)/.test(l)
    const isAlert = /(dérive|derive|retard|alerte|anomalie|litige|incident|impayé|impaye)/.test(l)
    kpis.push({
      label: cap(ind.nom),
      valeur: isMoney ? f.int(120, 2400) * 1000 : isRate ? (/marge/.test(l) ? f.int(9, 24) : f.int(55, 96)) : isAlert ? f.int(1, 5) : f.int(6, 140),
      format: isMoney ? 'euro' : isRate ? 'pourcent' : 'nombre',
      evolution: isAlert ? -f.int(5, 30) : f.int(-6, 18)
    })
  }
  if (main && kpis.length < 4) kpis.push({ label: `${main.labelPluriel} en cours`, valeur: main.donnees.length, format: 'nombre', evolution: f.int(2, 18) })
  if (main && money && kpis.length < 4)
    kpis.push({ label: `${money.label} total`, valeur: main.donnees.reduce((s, r) => s + (Number(r[money.id]) || 0), 0), format: 'euro', evolution: f.int(-5, 20) })
  if (status?.options && main && kpis.length < 4) {
    const last = status.options[status.options.length - 1]
    kpis.push({ label: `Taux « ${last} »`, valeur: Math.round((main.donnees.filter((r) => r[status.id] === last).length / Math.max(1, main.donnees.length)) * 100), format: 'pourcent', evolution: f.int(-4, 9) })
  }
  if (kpis.length < 4) kpis.push({ label: 'Utilisateurs actifs', valeur: f.int(8, 60), format: 'nombre', evolution: f.int(1, 15) })

  const mois = ['Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.']
  const graphiques: AppConfig['tableauDeBord']['graphiques'] = [
    {
      titre: money && main ? `${money.label} par mois` : `${main?.labelPluriel ?? 'Activité'} par mois`,
      type: 'barres',
      format: money ? 'euro' : 'nombre',
      donnees: mois.map((m) => ({ label: m, valeur: money ? f.int(40, 260) * 1000 : f.int(6, 30) }))
    }
  ]
  if (status?.options && main)
    graphiques.push({
      titre: `${main.labelPluriel} par statut`,
      type: 'donut',
      donnees: status.options.map((o) => ({ label: o, valeur: main.donnees.filter((r) => r[status.id] === o).length }))
    })

  const typeLabel = TITRES[pt.id] ?? main?.labelPluriel ?? 'Gestion'
  return {
    titre: `${nomEntreprise} ${typeLabel}`.trim(),
    sousTitre: brief.resume || pt.description,
    typeProjet: pt.id,
    roles: roles.length ? roles : [{ id: 'admin', label: 'Administrateur' }],
    roleParDefaut: roles[0]?.id ?? 'admin',
    utilisateur: { nom: new Faker(seed).personne(), poste: roles[0]?.label ?? 'Responsable' },
    navigation,
    tableauDeBord: {
      titre: 'Tableau de bord',
      kpis,
      graphiques,
      listes: entities.slice(0, 2).map((e) => ({ titre: `Derniers ${e.feminin ? 'ajouts' : 'éléments'} · ${e.labelPluriel}`, entite: e.id, limite: 5 }))
    },
    entites: entities
  }
}
