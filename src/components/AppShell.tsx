'use client'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { 
  LayoutDashboard, 
  PlusSquare, 
  Receipt, 
  Users, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Settings, 
  UserCircle,
  Menu,
  LogOut,
  ShieldCheck
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', section: 'Main' },
  { href: '/jobs/new', icon: <PlusSquare size={18} />, label: 'New Job', section: 'Main' },
  { href: '/invoices', icon: <Receipt size={18} />, label: 'Invoices', section: 'Main' },
  { href: '/customers', icon: <Users size={18} />, label: 'Customers', section: 'Main' },
  { href: '/statements', icon: <FileText size={18} />, label: 'Statements', section: 'Billing' },
  { href: '/payments', icon: <CreditCard size={18} />, label: 'Payments', section: 'Billing' },
  { href: '/reports', icon: <BarChart3 size={18} />, label: 'Reports', section: 'Reports', adminOnly: true },
  { href: '/settings', icon: <Settings size={18} />, label: 'Settings', section: 'Admin', adminOnly: true },
  { href: '/settings/security', icon: <ShieldCheck size={18} />, label: 'Security', section: 'Admin', adminOnly: true },
  { href: '/users', icon: <UserCircle size={18} />, label: 'Users', section: 'Admin', adminOnly: true },
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
        <div className="sidebar-logo" style={{ padding: '1.5rem 1.5rem 1rem 1.5rem' }}>
          <img src="/logo.png" alt="printax.lk" style={{ width: '100%', height: 'auto', maxHeight: '130px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        </div>

        <nav className="sidebar-nav">
          {sections.map(section => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {visibleItems.filter(i => i.section === section).map(item => (
                <Link key={item.href} href={item.href}
                  className={`nav-item ${pathname === item.href || (item.href !== '/dashboard' && item.href !== '/settings' && pathname.startsWith(item.href)) ? 'active' : ''}`}>
                  <span className="nav-icon" style={{ fontSize: '1rem' }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.15rem' }}>{session.user?.name}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{session.user?.email}</div>
            <span className={`badge ${isAdmin ? 'badge-purple' : 'badge-muted'}`} style={{ marginTop: '0.35rem' }}>
              {isAdmin ? 'Admin' : 'Staff'}
            </span>
          </div>
          <button 
            onClick={() => { if (window.confirm('Are you sure you want to sign out?')) signOut({ callbackUrl: '/login' }) }} 
            className="btn btn-danger w-full" 
            style={{ marginBottom: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            Sign out
          </button>
          <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Powered by <strong>bitmosolutions.com</strong>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <button className="mobile-toggle" onClick={() => setMobileOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="topbar-date" style={{ fontSize: '0.875rem', color: '#000', fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}
