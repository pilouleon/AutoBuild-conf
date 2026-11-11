// Le contrat de données des maquettes est défini dans le template socle
// (templates/socle/src/mockup/types.ts) : c'est la source de vérité, que les
// templates des agences doivent respecter pour profiter du générateur de base.
export type {
  AppConfig,
  Entity,
  Field,
  FieldType,
  Kpi,
  Graphique,
  NavItem,
  Role,
  Vue,
  Brand as MockupBrand,
  Agence as MockupAgence
} from '../../../templates/socle/src/mockup/types'
