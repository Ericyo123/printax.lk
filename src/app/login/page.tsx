'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(21,94,150,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(102,150,176,0.08) 0%, transparent 60%), var(--bg-base)',
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '0.5rem',
            display: 'inline-flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem',
            boxShadow: '0 8px 32px rgba(21,94,150,0.25)', width: '180px'
          }}>
            <img src="/logo.png" alt="printax.lk" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Print Shop Management System
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '0.25rem', fontSize: '1.25rem' }}>Sign in</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
            Enter your credentials to continue
          </p>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email" type="email" className="form-control"
                placeholder="you@printax.com"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password" type={showPass ? 'text' : 'password'} className="form-control"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required
                  style={{ paddingRight: '2.75rem' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.875rem' }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}
              style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <hr className="divider" />
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <p><strong style={{ color: 'var(--text-secondary)' }}>Admin:</strong> mohommadammar826@gmail.com / admin123</p>
            <p style={{ marginTop: '0.25rem' }}><strong style={{ color: 'var(--text-secondary)' }}>Staff:</strong> staff@printax.com / staff123</p>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          © {new Date().getFullYear()} printax.lk · Print Shop Management
        </p>
      </div>
    </div>
  )
}
