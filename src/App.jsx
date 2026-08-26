import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import ForgotPassword from './components/ForgotPassword'
import SetPassword from './components/SetPassword'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Overview from './pages/Overview'
import LinkSectionPage from './pages/LinkSectionPage'
import LinkDetail from './pages/LinkDetail'
import FileBrowser from './pages/FileBrowser'
import ByMonth from './pages/ByMonth'

function Shell({ session }) {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('links').select('*').order('name', { ascending: true })
    setLinks(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function computeBreadcrumb() {
    const path = location.pathname
    if (path === '/') return ['Samesun', 'Overview']
    const [, section, ...rest] = path.split('/')
    if (section === 'files-by-month') {
      const [month, reportTypeSlug] = rest
      const crumbs = ['Samesun', 'Files', 'By Month']
      if (month) {
        const [year, m] = month.split('-').map(Number)
        crumbs.push(new Date(year, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }))
      }
      if (reportTypeSlug) crumbs.push(reportTypeSlug.replace(/-/g, ' '))
      return crumbs
    }
    const sectionLabels = { automations: 'Automations', tools: 'Tools', models: 'Models', files: 'Files' }
    const label = sectionLabels[section] ?? section
    if (rest.length === 0) return ['Samesun', label]
    if (section === 'automations' || section === 'tools') {
      const item = links.find(l => l.slug === rest[0])
      return ['Samesun', label, item?.name ?? rest[0]]
    }
    return ['Samesun', label, ...rest.map(r => r.replace(/-/g, ' '))]
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar links={links} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <div className="flex-1 min-w-0">
        <Topbar breadcrumb={computeBreadcrumb()} userEmail={session.user.email} onSignOut={handleSignOut} />
        <main>
          {loading ? (
            <p className="text-sm text-[#94a3b8] px-10 py-14">Loading…</p>
          ) : (
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/automations" element={<LinkSectionPage section="automations" links={links} onRefresh={fetchLinks} />} />
              <Route path="/automations/:slug" element={<LinkDetail links={links} section="automations" onRefresh={fetchLinks} />} />
              <Route path="/tools" element={<LinkSectionPage section="tools" links={links} onRefresh={fetchLinks} />} />
              <Route path="/tools/:slug" element={<LinkDetail links={links} section="tools" onRefresh={fetchLinks} />} />
              <Route path="/models/*" element={<FileBrowser section="models" />} />
              <Route path="/files/*" element={<FileBrowser section="files" />} />
              <Route path="/files-by-month/*" element={<ByMonth />} />
            </Routes>
          )}
        </main>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setChecking(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const path = window.location.pathname
  if (path === '/reset-password') {
    return <SetPassword onSuccess={() => { window.location.href = '/' }} />
  }
  if (path === '/forgot-password') {
    return <ForgotPassword />
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#94a3b8] font-mono">Loading…</p>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Shell session={session} />
    </BrowserRouter>
  )
}

export default App
