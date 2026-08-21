import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Login.css'

type Step = 'email' | 'code' | 'password' | 'done'

const STEP_ORDER: Step[] = ['email', 'code', 'password']

const STEP_LABELS: Record<string, string> = {
  email: 'Email',
  code: 'Verification code',
  password: 'New password',
}

export default function ForgotPassword() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const activeIndex = STEP_ORDER.indexOf(step)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setResendIn(60)
    setStep('code')
  }

  async function resendCode() {
    if (resendIn > 0 || busy) return
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setResendIn(60)
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (code.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ''),
      type: 'recovery',
    })
    setBusy(false)
    if (error) {
      setError('This code is invalid or has expired. Request a new one.')
      return
    }
    setStep('password')
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) await supabase.auth.signOut()
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setStep('done')
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
              <GraduationCap size={30} />
            </div>
            <div className="brand-name">
              <span className="brand-title">Mufumbu</span>
              <span className="brand-subtitle">Secondary School</span>
            </div>
          </div>

          <div className="brand-body">
            <h1>Password Recovery</h1>
            <p className="brand-tagline">
              Securely reset your password using a verification code sent to
              your email address.
            </p>

            <ul className="brand-features">
              <li>
                <span className="feature-icon">
                  <Mail size={18} />
                </span>
                <span>Receive a 6-digit code by email</span>
              </li>
              <li>
                <span className="feature-icon">
                  <KeyRound size={18} />
                </span>
                <span>Verify the code to prove identity</span>
              </li>
              <li>
                <span className="feature-icon">
                  <ShieldCheck size={18} />
                </span>
                <span>Set a strong new password</span>
              </li>
            </ul>
          </div>

          <p className="brand-foot">
            &copy; {new Date().getFullYear()} Mufumbu Secondary School
          </p>
        </aside>

        <section className="login-form-wrap">
          <div className="login-form">
            {step !== 'done' ? (
              <>
                <div className="form-head">
                  <span className="form-eyebrow">Account recovery</span>
                  <h2>Forgot your password?</h2>
                  <p className="form-subheading">
                    {step === 'email' &&
                      'Enter your school email address to receive a verification code.'}
                    {step === 'code' &&
                      `We sent a 6-digit code to ${email}. Enter it below to continue.`}
                    {step === 'password' &&
                      'Code verified. Now choose a new password for your account.'}
                  </p>
                </div>

                <ol className="reset-steps">
                  {STEP_ORDER.map((s, i) => (
                    <li
                      key={s}
                      className={
                        i === activeIndex
                          ? 'reset-step current'
                          : i < activeIndex
                            ? 'reset-step done'
                            : 'reset-step'
                      }
                    >
                      <span className="reset-step-dot">{i + 1}</span>
                      <span className="reset-step-label">
                        {STEP_LABELS[s]}
                      </span>
                    </li>
                  ))}
                </ol>

                {error && (
                  <div className="form-error" role="alert">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {step === 'email' && (
                  <form onSubmit={sendCode} noValidate>
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

                    <button type="submit" className="signin-btn" disabled={busy}>
                      {busy ? (
                        <>
                          <Loader2 size={18} className="spin" />
                          Sending code...
                        </>
                      ) : (
                        <>
                          Send verification code
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {step === 'code' && (
                  <form onSubmit={verifyCode} noValidate>
                    <label className="field">
                      <span className="field-label">Verification code</span>
                      <input
                        className="otp-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="000000"
                        required
                        autoFocus
                      />
                    </label>

                    <button type="submit" className="signin-btn" disabled={busy}>
                      {busy ? (
                        <>
                          <Loader2 size={18} className="spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {step === 'password' && (
                  <form onSubmit={savePassword} noValidate>
                    <label className="field">
                      <span className="field-label">New password</span>
                      <div className="input-wrap">
                        <Lock size={18} className="input-icon" aria-hidden="true" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          required
                          minLength={6}
                          autoComplete="new-password"
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

                    <label className="field">
                      <span className="field-label">Confirm new password</span>
                      <div className="input-wrap">
                        <Lock size={18} className="input-icon" aria-hidden="true" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          placeholder="Repeat new password"
                          required
                          minLength={6}
                          autoComplete="new-password"
                        />
                      </div>
                    </label>

                    <button type="submit" className="signin-btn" disabled={busy}>
                      {busy ? (
                        <>
                          <Loader2 size={18} className="spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Set new password
                          <ShieldCheck size={18} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                <div className="form-row reset-links">
                  {step === 'code' ? (
                    <>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setStep('email')
                          setError(null)
                          setCode('')
                        }}
                      >
                        <ArrowLeft size={15} />
                        Change email
                      </button>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={resendCode}
                        disabled={resendIn > 0 || busy}
                      >
                        {resendIn > 0
                          ? `Resend code in ${resendIn}s`
                          : 'Resend code'}
                      </button>
                    </>
                  ) : (
                    <Link to="/login" className="link-btn">
                      <ArrowLeft size={15} />
                      Back to sign in
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <div className="reset-done">
                <span className="reset-done-icon">
                  <CheckCircle2 size={54} />
                </span>
                <h2>Password updated</h2>
                <p className="form-subheading">
                  Your password has been changed successfully. Sign in with
                  your new password.
                </p>
                <button
                  type="button"
                  className="signin-btn"
                  onClick={() => navigate('/login', { replace: true })}
                >
                  Go to sign in
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            <p className="help-text">
              Need help? Contact the school headmaster or academic office.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
