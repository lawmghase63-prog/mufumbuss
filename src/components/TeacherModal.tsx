import { useEffect, useState, type FormEvent } from 'react'
import {
  X,
  Save,
  UserPlus,
  Loader2,
  Users,
  Mail,
  Phone,
  KeyRound,
  VenusAndMars,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_TEACHER_PASSWORD,
  type Sex,
  type Teacher,
} from '../lib/teachers'
import FlashMessage from './FlashMessage'

export default function TeacherModal({
  teacher,
  onClose,
  onSaved,
}: {
  teacher: Teacher | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const editing = !!teacher
  const [fullName, setFullName] = useState(teacher?.full_name ?? '')
  const [sex, setSex] = useState<Sex>(teacher?.sex ?? 'M')
  const [email, setEmail] = useState(teacher?.email ?? '')
  const [phone, setPhone] = useState(teacher?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const cleanEmail = email.trim().toLowerCase()
    const payload = {
      full_name: fullName.trim(),
      sex,
      email: cleanEmail,
      phone: phone.trim(),
    }

    if (editing) {
      const { error } = await supabase
        .from('teachers')
        .update(payload)
        .eq('id', teacher!.id)
      setSaving(false)
      if (error) {
        setError(error.message)
        return
      }
      onSaved(`${fullName.trim()} updated.`)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const prevSession = sessionData.session

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: DEFAULT_TEACHER_PASSWORD,
      options: {
        data: { full_name: fullName.trim(), role: 'teacher' },
      },
    })

    if (prevSession) {
      await supabase.auth.setSession({
        access_token: prevSession.access_token,
        refresh_token: prevSession.refresh_token,
      })
    }

    if (signUpError) {
      setSaving(false)
      setError(
        signUpError.message.includes('already been registered') ||
          signUpError.message.includes('already registered')
          ? `The email ${cleanEmail} already has an account. Use a different email or edit the existing teacher.`
          : signUpError.message,
      )
      return
    }

    const userId = data?.user?.id
    if (!userId) {
      setSaving(false)
      setError('Could not create the login account. Try again.')
      return
    }

    const { error: insertError } = await supabase
      .from('teachers')
      .insert({
        user_id: userId,
        full_name: fullName.trim(),
        sex,
        email: cleanEmail,
        phone: phone.trim(),
      })

    setSaving(false)
    if (insertError) {
      setError(
        insertError.message.includes('duplicate key')
          ? `The email ${cleanEmail} is already registered as a teacher.`
          : insertError.message,
      )
      return
    }
    onSaved(
      `${fullName.trim()} registered. Login: ${cleanEmail} / ${DEFAULT_TEACHER_PASSWORD}`,
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="teacher-modal-title">
              {editing ? 'Edit Teacher' : 'Register Teacher'}
            </h3>
            <p className="modal-sub">
              {editing
                ? teacher!.email
                : 'Login account is created automatically.'}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {error && (
            <FlashMessage type="error" text={error} onDismiss={() => setError(null)} />
          )}

          <label className="field">
            <span className="field-label">Full name</span>
            <div className="input-wrap">
              <Users size={18} className="input-icon" aria-hidden="true" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Hassan M. Mwinyi"
                required
                autoFocus
              />
            </div>
          </label>

          <div className="reg-row">
            <label className="field">
              <span className="field-label">Sex</span>
              <div className="select-wrap">
                <VenusAndMars size={18} className="input-icon" aria-hidden="true" />
                <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </label>

            <label className="field">
              <span className="field-label">Phone number</span>
              <div className="input-wrap">
                <Phone size={18} className="input-icon" aria-hidden="true" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0755 123 456"
                />
              </div>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Email (login)</span>
            <div className="input-wrap">
              <Mail size={18} className="input-icon" aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. teacher@mufumbu.ac.tz"
                required
                disabled={editing}
                className={editing ? 'disabled' : ''}
              />
            </div>
            {editing && (
              <p className="field-hint">Email cannot be changed after registration.</p>
            )}
          </label>

          {!editing && (
            <label className="field">
              <span className="field-label">Password (auto)</span>
              <div className="input-wrap">
                <KeyRound size={18} className="input-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={DEFAULT_TEACHER_PASSWORD}
                  readOnly
                  disabled
                  className="disabled"
                />
              </div>
              <p className="field-hint">
                Generated automatically. The teacher can change it later in their
                Profile.
              </p>
            </label>
          )}

          <button type="submit" className="signin-btn modal-save" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={18} className="spin" />
                {editing ? 'Saving...' : 'Registering...'}
              </>
            ) : (
              <>
                {editing ? <Save size={18} /> : <UserPlus size={18} />}
                {editing ? 'Save changes' : 'Register teacher'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
