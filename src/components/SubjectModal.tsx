import { useEffect, useState, type FormEvent } from 'react'
import { X, Save, Loader2, BookOpen, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  O_LEVEL_FORMS,
  type OLevelForm,
  type Subject,
  type SubjectType,
} from '../lib/subjects'
import FlashMessage from './FlashMessage'

const TYPE_OPTIONS: { value: SubjectType; label: string; hint: string }[] = [
  { value: 'o', label: 'O-Level (F1-F4)', hint: 'Taught in O-Level classes.' },
  { value: 'core', label: 'A-Level Core', hint: 'Main subject of a combination.' },
  { value: 'subsidiary', label: 'A-Level Subsidiary', hint: 'Extra subject of a combination.' },
]

export default function SubjectModal({
  subject,
  presetType,
  onClose,
  onSaved,
}: {
  subject: Subject | null
  presetType?: SubjectType
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const editing = !!subject
  const [name, setName] = useState(subject?.name ?? '')
  const [code, setCode] = useState(subject?.code ?? '')
  const [type, setType] = useState<SubjectType>(subject?.type ?? presetType ?? 'o')
  const [hasPractical, setHasPractical] = useState(
    subject?.has_practical ?? false,
  )
  const [forms, setForms] = useState<OLevelForm[]>(
    (subject?.forms ?? []) as OLevelForm[],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleForm(f: OLevelForm) {
    setForms((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    )
  }

  function switchType(t: SubjectType) {
    setType(t)
    if (t !== 'o') setForms([])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (type === 'o' && forms.length === 0) {
      setError('Select at least one O-Level form, or choose A-Level type.')
      return
    }
    setSaving(true)

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      type,
      has_practical: hasPractical,
      forms,
    }

    const { error } = subject
      ? await supabase.from('subjects').update(payload).eq('id', subject.id)
      : await supabase.from('subjects').insert(payload)

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved(
      editing
        ? `${name.trim()} updated.`
        : `${name.trim()} (${code.trim().toUpperCase()}) registered.`,
    )
  }

  const selectedType = TYPE_OPTIONS.find((t) => t.value === type)!

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="subject-modal-title">
              {editing ? 'Edit Subject' : 'Register Subject'}
            </h3>
            <p className="modal-sub">
              {editing ? subject!.code : 'Subject used in the school'}
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
            <span className="field-label">Subject name</span>
            <div className="input-wrap">
              <BookOpen size={18} className="input-icon" aria-hidden="true" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Biology"
                required
                autoFocus
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Subject code</span>
            <div className="input-wrap">
              <Tag size={18} className="input-icon" aria-hidden="true" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. BIO"
                required
              />
            </div>
          </label>

          <div className="field">
            <span className="field-label">Subject type</span>
            <div className="chips-row modal-chips">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={type === t.value ? 'chip active' : 'chip'}
                  onClick={() => switchType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="field-hint">{selectedType.hint}</p>
          </div>

          {type === 'o' && (
            <div className="field">
              <span className="field-label">Taught in (O-Level forms)</span>
              <div className="chips-row modal-chips">
                {O_LEVEL_FORMS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={forms.includes(f) ? 'chip active' : 'chip'}
                    onClick={() => toggleForm(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <span className="field-label">Has practical</span>
            <button
              type="button"
              role="switch"
              aria-checked={hasPractical}
              className={hasPractical ? 'switch on' : 'switch'}
              onClick={() => setHasPractical((v) => !v)}
            >
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
              {hasPractical ? 'Yes' : 'No'}
            </button>
            <p className="field-hint">
              Subjects like Chemistry, Biology, Physics or ICT usually have
              practical exams.
            </p>
          </div>

          <button type="submit" className="signin-btn modal-save" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={18} className="spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                {editing ? 'Save changes' : 'Register subject'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
