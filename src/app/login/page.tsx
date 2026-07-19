'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

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
    const res = await signIn('credentials', { 
      email: email.trim().toLowerCase(), 
      password, 
      redirect: false 
    })
    if (res?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Column: Image Background */}
      <div 
        className="hidden lg:flex flex-1 relative bg-cover bg-center"
        style={{ backgroundImage: 'url(/login-bg.png)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary-dark)]/40 to-[var(--primary-dark)]/90" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-white p-12">
          <div className="bg-white rounded-2xl p-4 mb-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <img src="/logo.png" alt="printax.lk" className="w-64 h-auto block" />
          </div>
          <h1 className="text-4xl font-bold mb-2">printax.lk</h1>
          <p className="text-lg text-slate-300">Professional Print Shop Management</p>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-base)] p-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="bg-white rounded-xl p-3 inline-flex items-center justify-center shadow-[0_4px_16px_rgba(21,94,150,0.2)]">
              <img src="/logo.png" alt="printax.lk" className="w-40 h-auto block" />
            </div>
            <p className="text-[var(--text-muted)] mt-2 text-sm">
              Print Shop Management System
            </p>
          </div>

          {/* Card */}
          <div className="card p-8">
            <h2 className="text-2xl font-bold mb-1">Sign in</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Enter your credentials to continue
            </p>

            {error && (
              <div className="alert alert-danger mb-5 flex items-center gap-2">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                <div className="relative">
                  <input
                    id="password" type={showPass ? 'text' : 'password'} className="form-control"
                    placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-[var(--text-muted)] cursor-pointer text-sm flex items-center justify-center">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full btn-lg mt-2 justify-center" disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-[var(--text-muted)] text-xs mt-8">
            © {new Date().getFullYear()} printax.lk · Powered by bitmosolutions.com
          </p>
        </div>
      </div>
    </div>
  )
}
