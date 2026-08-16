import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X, Save, Loader2, BookOpen, Layers, ListChecks } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { FORMS, type Form } from '../lib/students'
import type { Subject } from '../lib/subjects'
import type { Teacher, TeacherAssignment } from '../lib/teachers'
import FlashMessage from './FlashMessage'

function subjectsForForm(subjects: Subject[], form: Form): Subject[] {
  return subjects.filter((s) => {
    if (s.type === 'o') return s.forms.includes(form)
    return form === 'F5' || form === 'F6'
  })
}

export default function TeacherAssignModal({
  teacher,
  onClose,
  onSaved,
}: {
  teacher: Teacher
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [existing, setExisting] = useState<TeacherAssignment[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [level, setLevel] = useState<'o' | 'a'>('o')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    Promise.all([
      supabase.from('subjects').select('*').order('code', { ascending: true }),
      supabase
        .from('teacher_assignments')
        .select('*')
        .eq('teacher_id', teacher.id),
    ]).then(([subjectsRes, assignRes]) => {
      const subs = (subjectsRes.data as Subject[]) ?? []
      const assigns = (assignRes.data as TeacherAssignment[]) ?? []
      setSubjects(subs)
      setExisting(assigns)
      setSelected(
        new Set(assigns.map((a) => `${a.subject_id}::${a.form}`)),
      )
      setLoading(false)
    })
  }, [teacher.id])

  const formCounts = useMemo(() => {
    const map = new Map<Form, number>(FORMS.map((f) => [f, 0]))
    selected.forEach((key) => {
      const form = key.split('::')[1] as Form
      map.set(form, (map.get(form) ?? 0) + 1)
    })
    return map
  }, [selected])

  const O_FORMS = FORMS.slice(0, 4)
  const A_FORMS = FORMS.slice(4)
  const activeForms = level === 'o' ? O_FORMS : A_FORMS
  const levelTotalO = O_FORMS.reduce((sum, f) => sum + (formCounts.get(f) ?? 0), 0)
  const levelTotalA = A_FORMS.reduce((sum, f) => sum + (formCounts.get(f) ?? 0), 0)

  function toggle(subjectId: string, form: Form) {
    const key = `${subjectId}::${form}`
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const existingKeys = new Set(existing.map((a) => `${a.subject_id}::${a.form}`))
    const toInsert: { teacher_id: string; subject_id: string; form: Form }[] = []
    selected.forEach((key) => {
      if (!existingKeys.has(key)) {
        const [subjectId, form] = key.split('::')
        toInsert.push({ teacher_id: teacher.id, subject_id: subjectId, form: form as Form })
      }
    })
    const toDelete = existing.filter(
      (a) => !selected.has(`${a.subject_id}::${a.form}`),
    )

    if (toInsert.length) {
      const { error } = await supabase.from('teacher_assignments').insert(toInsert)
      if (error) {
        setSaving(false)
        setError(error.message)
        return
      }
    }
    if (toDelete.length) {
      const { error } = await supabase
        .from('teacher_assignments')
        .delete()
        .in('id', toDelete.map((a) => a.id))
      if (error) {
        setSaving(false)
        setError(error.message)
        return
      }
    }

    setSaving(false)
    onSaved(
      `${teacher.full_name}'s teaching assignments saved (${selected.size} total).`,
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-assign-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="teacher-assign-title">Teaching Assignments</h3>
            <p className="modal-sub">
              {teacher.full_name} — choose which subjects this teacher teaches in
              each form.
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

          {loading ? (
            <div className="list-state">
              <Loader2 size={20} className="spin" />
              Loading subjects...
            </div>
          ) : (
            <>
              <div className="assign-legend">
                <span>
                  <ListChecks size={15} />
                  A teacher can teach more than one subject in the same form, or
                  one subject across different forms.
                </span>
              </div>

              <div className="subj-tabs">
                <button
                  type="button"
                  className={level === 'o' ? 'subj-tab active' : 'subj-tab'}
                  onClick={() => setLevel('o')}
                >
                  <BookOpen size={16} />
                  O-Level (F1 - F4)
                  <span className="tab-count">{levelTotalO}</span>
                </button>
                <button
                  type="button"
                  className={level === 'a' ? 'subj-tab active' : 'subj-tab'}
                  onClick={() => setLevel('a')}
                >
                  <Layers size={16} />
                  A-Level (F5 - F6)
                  <span className="tab-count">{levelTotalA}</span>
                </button>
              </div>

              {activeForms.map((form) => {
                const formSubjects = subjectsForForm(subjects, form)
                if (formSubjects.length === 0) return null
                const count = formCounts.get(form) ?? 0
                return (
                  <div key={form} className="assign-form-block">
                    <div className="assign-form-head">
                      <span className="assign-form-title">
                        <BookOpen size={15} />
                        Form {form.slice(1)}
                      </span>
                      <span className={count ? 'count-badge ok' : 'count-badge'}>
                        {count} subject{count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="chips-row modal-chips">
                      {formSubjects.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={
                            selected.has(`${s.id}::${form}`)
                              ? 'chip active'
                              : 'chip'
                          }
                          onClick={() => toggle(s.id, form)}
                        >
                          {s.name}
                          {s.has_practical && (
                            <span className="practical-dot" title="Has practical" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          <button type="submit" className="signin-btn modal-save" disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 size={18} className="spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save assignments
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
