'use client'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/dashboard', icon: '⊞', label: 'Dashboard', section: 'Main' },
  { href: '/jobs/new', icon: '＋', label: 'New Job', section: 'Main' },
  { href: '/invoices', icon: '🧾', label: 'Invoices', section: 'Main' },
  { href: '/customers', icon: '👥', label: 'Customers', section: 'Main' },
  { href: '/statements', icon: '📋', label: 'Statements', section: 'Billing' },
  { href: '/payments', icon: '💳', label: 'Payments', section: 'Billing' },
  { href: '/reports', icon: '📊', label: 'Reports', section: 'Reports' },
  { href: '/settings', icon: '⚙', label: 'Settings', section: 'Admin', adminOnly: true },
  { href: '/pricing', icon: '💰', label: 'Pricing', section: 'Admin', adminOnly: true },
  { href: '/users', icon: '👤', label: 'Users', section: 'Admin', adminOnly: true },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Close sidebar on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    )
  }
  if (!session) return null

  const isAdmin = session.user?.role === 'ADMIN'
  const visibleItems = navItems.filter(i => !i.adminOnly || isAdmin)
  const sections = Array.from(new Set(visibleItems.map(i => i.section)))

  return (
    <div className={`app-shell ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ padding: '1.25rem', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            background: 'white', borderRadius: '8px', padding: '0.25rem',
            width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            <img src="/logo.png" alt="printax.lk" style={{ width: '100%', height: 'auto', maxHeight: '90px', objectFit: 'contain', display: 'block' }} />
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(section => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {visibleItems.filter(i => i.section === section).map(item => (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) ? 'active' : ''}`}>
                  <span className="nav-icon" style={{ fontSize: '1rem' }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{session.user?.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{session.user?.email}</div>
            <span className={`badge ${isAdmin ? 'badge-purple' : 'badge-muted'}`} style={{ marginTop: '0.375rem' }}>
              {isAdmin ? 'Admin' : 'Staff'}
            </span>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn btn-secondary btn-sm w-full">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <button className="mobile-toggle" onClick={() => setMobileOpen(true)}>
            ☰
          </button>
          <div className="topbar-date" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/jobs/new" className="btn btn-primary btn-sm">
              + New Job
            </Link>
          </div>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}
