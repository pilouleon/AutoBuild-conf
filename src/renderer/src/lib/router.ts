// Navigation par hash : #/<section>/<id>/<onglet>. Chaque écran a une adresse (retour arrière, liens croisés).
import { useEffect, useState } from 'react'

export type Route =
  | { page: 'accueil' }
  | { page: 'rdvs'; filtre?: 'tous' | 'avenir' | 'passes'; vue?: 'liste' | 'calendrier' }
  | { page: 'rdv'; id: string; tab?: 'synthese' | 'brief' | 'transcription' | 'maquette'; focus?: string }
  | { page: 'prospects'; id?: string }
  | { page: 'templates' }
  | { page: 'template'; id: string; pageId?: string }
  | { page: 'reglages'; section?: string }
  | { page: 'aide' }

export function parse(hash: string): Route {
  const [section, a, b, c] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (section) {
    case 'rendez-vous':
      if (a && a !== 'avenir' && a !== 'passes' && a !== 'calendrier') return { page: 'rdv', id: a, tab: (b as never) || undefined, focus: c || undefined }
      return { page: 'rdvs', filtre: a === 'avenir' || a === 'passes' ? a : 'tous', vue: a === 'calendrier' ? 'calendrier' : 'liste' }
    case 'prospects':
      return { page: 'prospects', id: a || undefined }
    case 'templates':
      return a ? { page: 'template', id: a, pageId: b || undefined } : { page: 'templates' }
    case 'reglages':
      return { page: 'reglages', section: a || undefined }
    case 'aide':
      return { page: 'aide' }
    default:
      return { page: 'accueil' }
  }
}

export function href(r: Route): string {
  const e = encodeURIComponent
  switch (r.page) {
    case 'accueil':
      return '#/'
    case 'rdvs':
      return r.vue === 'calendrier' ? '#/rendez-vous/calendrier' : r.filtre && r.filtre !== 'tous' ? `#/rendez-vous/${r.filtre}` : '#/rendez-vous'
    case 'rdv':
      return `#/rendez-vous/${e(r.id)}${r.tab ? `/${r.tab}` : ''}${r.focus ? `/${e(r.focus)}` : ''}`
    case 'prospects':
      return `#/prospects${r.id ? `/${e(r.id)}` : ''}`
    case 'templates':
      return '#/templates'
    case 'template':
      return `#/templates/${e(r.id)}${r.pageId ? `/${e(r.pageId)}` : ''}`
    case 'reglages':
      return `#/reglages${r.section ? `/${r.section}` : ''}`
    case 'aide':
      return '#/aide'
  }
}

export function go(r: Route): void {
  window.location.hash = href(r)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash))
      document.querySelector('.scroll')?.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
