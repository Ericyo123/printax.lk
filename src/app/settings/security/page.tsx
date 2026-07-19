'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { ShieldCheck, Monitor, Smartphone, Globe, Trash2, Clock, MapPin } from 'lucide-react'

export default function SecurityPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
    setLoading(true)
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function revokeSession(id: string) {
    if (!window.confirm('Are you sure you want to revoke this session? The user will be instantly logged out.')) return
    
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Parse User Agent to a readable format
  function parseUserAgent(ua: string) {
    if (!ua) return 'Unknown Device'
    let device = 'Desktop'
    if (ua.toLowerCase().includes('mobile') || ua.toLowerCase().includes('android') || ua.toLowerCase().includes('iphone')) device = 'Mobile'
    
    let browser = 'Unknown Browser'
    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Safari')) browser = 'Safari'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Edge')) browser = 'Edge'
    
    return `${device} - ${browser}`
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title"><ShieldCheck size={28} style={{ color: 'var(--primary)', marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle' }} /> Security & Active Sessions</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>View and revoke active logins across all devices.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchSessions}>↻ Refresh</button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>IP Address</th>
                <th>Device / Browser</th>
                <th>Logged In</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No active sessions found.</td></tr>
              ) : sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{session.user.name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{session.user.email}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Globe size={16} color="var(--text-muted)" />
                      {session.ipAddress || 'Unknown'}
                    </div>
                    {session.location && session.location !== 'Unknown Location' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        <MapPin size={12} color="var(--text-muted)" />
                        {session.location}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {parseUserAgent(session.userAgent).includes('Mobile') ? <Smartphone size={16} color="var(--text-muted)" /> : <Monitor size={16} color="var(--text-muted)" />}
                      {parseUserAgent(session.userAgent)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={session.userAgent}>
                      {session.userAgent}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={16} color="var(--text-muted)" />
                      {new Date(session.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => revokeSession(session.id)}>
                      <Trash2 size={16} style={{ marginRight: '0.25rem' }} /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
