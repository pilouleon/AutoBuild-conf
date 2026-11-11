// Routeur minimal par hash : #/<route>/<id?>. Simple à lire et à modifier.
import { type AnchorHTMLAttributes, useEffect, useState } from 'react'

function current(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const on = () => setRoute(current())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(path: string): void {
  window.location.hash = '#/' + path.replace(/^\/+/, '')
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={'#/' + to.replace(/^\/+/, '')} {...rest} />
}
