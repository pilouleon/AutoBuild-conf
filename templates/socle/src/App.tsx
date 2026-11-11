import { useEffect, useState } from 'react'
import { Layout } from './components/Layout'
import { Login } from './components/Login'
import { EmptyState, Card } from './components/ui'
import { navigate, useRoute } from './lib/router'
import { applyBrand } from './lib/theme'
import { app, brand, getEntity } from './mockup'
import { Dashboard } from './pages/Dashboard'
import { EntityPage } from './pages/EntityPage'
import { customPages } from './pages/custom/registry'

export default function App() {
  const [logged, setLogged] = useState(() => sessionStorage.getItem('maquette-connecte') === '1')
  const [role, setRole] = useState(app.roleParDefaut || app.roles[0]?.id || '')
  const [routeId, itemId] = useRoute()

  useEffect(() => applyBrand(brand), [])
  useEffect(() => {
    if (logged && !routeId) navigate(app.navigation[0]?.id ?? '')
  }, [logged, routeId])

  if (!logged)
    return (
      <Login
        onLogin={() => {
          sessionStorage.setItem('maquette-connecte', '1')
          setLogged(true)
        }}
      />
    )

  const item = app.navigation.find((n) => n.id === routeId) ?? app.navigation[0]
  let content = (
    <Card>
      <EmptyState title="Page en préparation" text="Cette page sera détaillée lors de la prochaine étape." />
    </Card>
  )
  if (item?.type === 'tableau-de-bord') content = <Dashboard />
  if (item?.type === 'entite') {
    const entity = getEntity(item.cible)
    if (entity) content = <EntityPage key={entity.id} entity={entity} navId={item.id} itemId={itemId} />
  }
  if (item?.type === 'page' && item.cible && customPages[item.cible]) {
    const Page = customPages[item.cible]
    content = <Page itemId={itemId} />
  }

  return (
    <Layout
      active={item?.id ?? ''}
      role={role}
      onRole={setRole}
      onLogout={() => {
        sessionStorage.removeItem('maquette-connecte')
        setLogged(false)
      }}
    >
      {content}
    </Layout>
  )
}
