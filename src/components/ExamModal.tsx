import { useState, type FormEvent } from 'react'
import {
  X,
  Save,
  Loader2,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  BookOpen,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { FORMS, type Form } from '../lib/students'
import type { Exam, ExamType } from '../lib/exams'
import FlashMessage from './FlashMessage'

interface Props {
  editing?: Exam | null
  onClose: () => void
  onSaved: (message: string) => void
}

export default function ExamModal({ editing, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState(editing?.name ?? '')
  const [examType, setExamType] = useState<ExamType>(editing?.exam_type ?? 'exam')
  const [startDate, setStartDate] = useState(editing?.start_date ?? '')
  const [endDate, setEndDate] = useState(editing?.end_date ?? '')
  const [forms, setForms] = useState<Form[]>(editing?.forms ?? [])
  const [hasPractical, setHasPractical] = useState(
    editing?.has_practical ?? false,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleForm(form: Form) {
    setForms((prev) =>
      prev.includes(form) ? prev.filter((f) => f !== form) : [...prev, form],
    )
  }

  function validate(): string | null {
    if (!name.trim()) return 'Enter the exam or test name.'
    if (!startDate) return 'Choose the start date.'
    if (!endDate) return 'Choose the end date.'
    if (endDate < startDate)
      return 'End date cannot be before the start date.'
    if (forms.length === 0)
      return 'Select at least one class (form) for this exam.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setSaving(true)

    const payload = {
      name: name.trim(),
      exam_type: examType,
      start_date: startDate,
      end_date: endDate,
      forms,
      has_practical: hasPractical,
      status: 'active' as const,
      created_by: user?.id ?? null,
    }

    if (editing) {
      const { error } = await supabase.from('exams').update(payload).eq('id', editing.id)
      if (error) {
        setSaving(false)
        setError(error.message)
        return
      }
      setSaving(false)
      onSaved(`"${name.trim()}" updated.`)
    } else {
      const { error } = await supabase.from('exams').insert(payload)
      if (error) {
        setSaving(false)
        setError(error.message)
        return
      }
      setSaving(false)
      onSaved(`"${name.trim()}" registered and activated — teachers can now enter marks.`)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="exam-modal-title">
              {editing ? 'Edit Exam' : 'Register Exam / Test'}
            </h3>
            <p className="modal-sub">
              Pick the dates, the classes involved and whether it has a
              practical. It activates immediately for teachers.
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

          <div className="subj-tabs">
            <button
              type="button"
              className={examType === 'exam' ? 'subj-tab active' : 'subj-tab'}
              onClick={() => setExamType('exam')}
            >
              <ClipboardList size={16} />
              Exam
            </button>
            <button
              type="button"
              className={examType === 'test' ? 'subj-tab active' : 'subj-tab'}
              onClick={() => setExamType('test')}
            >
              <BookOpen size={16} />
              Test
            </button>
          </div>

          <label className="field">
            <span className="field-label">Name</span>
            <div className="input-wrap">
              <CalendarCheck size={18} className="input-icon" aria-hidden="true" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  examType === 'test' ? 'e.g. Mid-Term Test 2026' : 'e.g. End of Term 1 Exam 2026'
                }
                autoFocus
              />
            </div>
          </label>

          <div className="reg-row">
            <label className="field">
              <span className="field-label">Start date</span>
              <div className="input-wrap">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            </label>
            <label className="field">
              <span className="field-label">End date</span>
              <div className="input-wrap">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </label>
          </div>

          <div className="field">
            <span className="field-label">Classes involved</span>
            <div className="chips-row modal-chips">
              {FORMS.map((form) => (
                <button
                  key={form}
                  type="button"
                  className={forms.includes(form) ? 'chip active' : 'chip'}
                  onClick={() => toggleForm(form)}
                >
                  Form {form.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <label className="practical-toggle">
            <input
              type="checkbox"
              checked={hasPractical}
              onChange={(e) => setHasPractical(e.target.checked)}
            />
            <FlaskConical size={16} />
            This exam has a practical component
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
                {editing ? 'Save changes' : 'Register & activate'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
