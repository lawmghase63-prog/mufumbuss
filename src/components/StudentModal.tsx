import { useEffect, useState, type FormEvent } from 'react'
import { X, Save, Loader2, Users, GraduationCap, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  FORMS,
  type Form,
  type Gender,
  type Student,
} from '../lib/students'
import FlashMessage from './FlashMessage'

export default function StudentModal({
  student,
  onClose,
  onSaved,
}: {
  student: Student
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(student.full_name)
  const [gender, setGender] = useState<Gender>(student.gender)
  const [form, setForm] = useState<Form>(student.form)
  const [parentPhone, setParentPhone] = useState(student.parent_phone)
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
    const { error } = await supabase
      .from('students')
      .update({
        full_name: fullName.trim(),
        gender,
        form,
        parent_phone: parentPhone.trim(),
      })
      .eq('id', student.id)
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="student-modal-title">Edit Student</h3>
            <p className="modal-sub">
              {student.admission_no} — {student.full_name}
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

          <button type="submit" className="signin-btn modal-save" disabled={saving}>
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
      </div>
    </div>
  )
}
