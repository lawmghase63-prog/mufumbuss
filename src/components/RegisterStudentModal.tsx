import { useEffect, useState, type FormEvent } from 'react'
import {
  X,
  UserPlus,
  Loader2,
  Users,
  IdCard,
  GraduationCap,
  Phone,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  FORMS,
  generateAdmissionNo,
  type Form,
  type Gender,
} from '../lib/students'
import FlashMessage from './FlashMessage'

export default function RegisterStudentModal({
  onClose,
  onRegistered,
}: {
  onClose: () => void
  onRegistered: (message: string) => void
}) {
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState<Gender>('M')
  const [form, setForm] = useState<Form>('F1')
  const [parentPhone, setParentPhone] = useState('')
  const [admissionNo, setAdmissionNo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    generateAdmissionNo(form).then(setAdmissionNo)
  }, [form])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const no = await generateAdmissionNo(form)
    const { error } = await supabase.from('students').insert({
      admission_no: no,
      full_name: fullName.trim(),
      gender,
      form,
      parent_phone: parentPhone.trim(),
    })

    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    onRegistered(`${fullName.trim()} registered — ${no}`)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="register-modal-title">Register New Student</h3>
            <p className="modal-sub">Admission number is generated automatically.</p>
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
            <FlashMessage
              type="error"
              text={error}
              onDismiss={() => setError(null)}
            />
          )}

          <label className="field">
            <span className="field-label">Admission no. (auto)</span>
            <div className="input-wrap">
              <IdCard size={18} className="input-icon" aria-hidden="true" />
              <input
                type="text"
                value={admissionNo}
                readOnly
                disabled
                className="disabled"
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Student full name</span>
            <div className="input-wrap">
              <Users size={18} className="input-icon" aria-hidden="true" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Amani Hassan Mwinyi"
                required
                autoFocus
              />
            </div>
          </label>

          <div className="reg-row">
            <label className="field">
              <span className="field-label">Gender</span>
              <div className="select-wrap">
                <GraduationCap size={18} className="input-icon" aria-hidden="true" />
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </label>

            <label className="field">
              <span className="field-label">Class / Form</span>
              <div className="select-wrap">
                <GraduationCap size={18} className="input-icon" aria-hidden="true" />
                <select
                  value={form}
                  onChange={(e) => setForm(e.target.value as Form)}
                >
                  {FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <label className="field">
            <span className="field-label">Parent phone number</span>
            <div className="input-wrap">
              <Phone size={18} className="input-icon" aria-hidden="true" />
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="e.g. 0712 345 678"
              />
            </div>
          </label>

          <button type="submit" className="signin-btn modal-save" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={18} className="spin" />
                Registering...
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Register student
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
