import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  LogOut,
  Mail,
  KeyRound,
  Save,
  Loader2,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import FlashMessage from '../components/FlashMessage'

async function supabaseReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
}

export default function Profile() {
  const { user, signOut, updateProfile } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'ok' | 'error'
    text: string
  } | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [resetSending, setResetSending] = useState(false)

  useEffect(() => {
    setFullName(user?.profile?.full_name ?? '')
  }, [user?.profile?.full_name])

  if (!user?.profile) return null

  const initials = (user.profile.full_name || user.email)
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const memberSince = new Date(user.profile.created_at).toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' },
  )

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    const result = await updateProfile({ full_name: fullName.trim() })
    setSaving(false)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'ok', text: 'Profile updated successfully.' })
    }
  }

  async function handleResetPassword() {
    if (!user) return
    setMessage(null)
    setResetSending(true)
    const { error } = await supabaseReset(user.email)
    setResetSending(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setResetSent(true)
      setMessage({
        type: 'ok',
        text: 'Password reset link sent. Check your email inbox.',
      })
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="profile-page">
      <section className="welcome-card profile-hero">
        <div className="welcome-inner">
          <span className="welcome-eyebrow">Account</span>
          <h2>My Profile</h2>
          <p>Manage your personal information and account settings.</p>
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-card">
          <div className="profile-identity">
            <span className="avatar profile-avatar">{initials}</span>
            <div className="profile-id-meta">
              <span className="profile-name">{user.profile.full_name || user.email}</span>
              <span className="role-badge">{user.profile.role}</span>
            </div>
          </div>

          <form onSubmit={handleSave} className="profile-form">
            <h3>Personal Information</h3>

            <label className="field">
              <span className="field-label">Full name</span>
              <div className="input-wrap">
                <GraduationCap size={18} className="input-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
            </label>

            <label className="field">
              <span className="field-label">Email address</span>
              <div className="input-wrap">
                <Mail size={18} className="input-icon" aria-hidden="true" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="disabled"
                  aria-describedby="email-hint"
                />
              </div>
              <span className="field-hint" id="email-hint">
                Email is your login identity and cannot be changed here.
              </span>
            </label>

            {message && (
              <FlashMessage
                type={message.type}
                text={message.text}
                onDismiss={() => setMessage(null)}
              />
            )}

            <button
              type="submit"
              className="signin-btn profile-save"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save changes
                </>
              )}
            </button>
          </form>
        </section>

        <div className="profile-side">
          <section className="profile-card">
            <h3>Account</h3>
            <ul className="account-list">
              <li>
                <span className="account-icon">
                  <ShieldCheck size={16} />
                </span>
                <span>
                  <strong>Role</strong>
                  <small>{user.profile.role}</small>
                </span>
              </li>
              <li>
                <span className="account-icon">
                  <CalendarDays size={16} />
                </span>
                <span>
                  <strong>Member since</strong>
                  <small>{memberSince}</small>
                </span>
              </li>
            </ul>
          </section>

          <section className="profile-card">
            <h3>Security</h3>
            <button
              type="button"
              className="action-btn on-light"
              onClick={handleResetPassword}
              disabled={resetSending}
            >
              {resetSending ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <KeyRound size={16} />
              )}
              {resetSent ? 'Reset link sent' : 'Change password'}
            </button>
          </section>

          <section className="profile-card danger">
            <h3>Sign out</h3>
            <p className="muted">
              Sign out to end this session on this device.
            </p>
            <button
              type="button"
              className="danger-btn"
              onClick={handleSignOut}
            >
              <LogOut size={17} />
              Log out
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
