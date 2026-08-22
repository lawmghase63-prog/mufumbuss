import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  BarChart3,
  Users,
  ClipboardList,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import logo from '../assets/logo.png'
import './Login.css'

const ROLE_ROUTES = {
  headmaster: '/headmaster',
  academic: '/academic',
  teacher: '/teacher',
} as const

const FEATURES = [
  { icon: ClipboardList, text: 'Accurate results entry and processing' },
  { icon: BarChart3, text: 'Instant academic performance analysis' },
  { icon: Users, text: 'Manage students, classes and teachers' },
  { icon: ShieldCheck, text: 'Secure, role-based access for staff' },
]

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user?.profile) {
      navigate(ROLE_ROUTES[user.profile.role], { replace: true })
    } else if (user) {
      setError('Profile not found for this account. Contact the headmaster.')
    }
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await signIn(email.trim(), password)
    setSubmitting(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="login-page">
      <div className="login-decor login-decor-a" />
      <div className="login-decor login-decor-b" />

      <div className="login-shell">
        <aside className="login-brand">
          <div className="brand-glow" aria-hidden="true" />
          <div className="brand-top">
            <div className="brand-logo">
              <img src={logo} alt="Mufumbu Secondary School logo" />
            </div>
            <div className="brand-name">
              <span className="brand-title">Mufumbu</span>
              <span className="brand-subtitle">Secondary School</span>
            </div>
          </div>

          <div className="brand-body">
            <h1>Results Management System</h1>
            <p className="brand-tagline">
              A complete platform for recording, processing and reporting
              student academic results.
            </p>

            <ul className="brand-features">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span className="feature-icon">
                    <Icon size={18} />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="brand-foot">
            &copy; {new Date().getFullYear()} Mufumbu Secondary School
          </p>
        </aside>

        <section className="login-form-wrap">
          <div className="login-form">
            <div className="form-head">
              <span className="form-eyebrow">Secure portal</span>
              <h2>Welcome back</h2>
              <p className="form-subheading">
                Sign in to your account to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <label className="field">
                <span className="field-label">Email address</span>
                <div className="input-wrap">
                  <Mail size={18} className="input-icon" aria-hidden="true" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.ac.tz"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </label>

              <label className="field">
                <span className="field-label">Password</span>
                <div className="input-wrap">
                  <Lock size={18} className="input-icon" aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="form-row">
                <label className="remember">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <Link className="forgot-link" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="form-error" role="alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="signin-btn"
                disabled={submitting || loading}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to dashboard
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <p className="help-text">
              Need help? Contact the school headmaster or academic office.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
