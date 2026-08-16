import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
} from 'react'
import { X, Save, Loader2, Layers, Tag, Star, BookOpenCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Combination, Subject } from '../lib/subjects'
import FlashMessage from './FlashMessage'

const coreSubjects = (subjects: Subject[]) =>
  subjects.filter((s) => s.type === 'core')

const subsidiarySubjects = (subjects: Subject[]) =>
  subjects.filter((s) => s.type === 'subsidiary')

export default function CombinationModal({
  combination,
  subjects,
  onClose,
  onSaved,
}: {
  combination: Combination | null
  subjects: Subject[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const editing = !!combination
  const [code, setCode] = useState(combination?.code ?? '')
  const [name, setName] = useState(combination?.name ?? '')
  const [core, setCore] = useState<string[]>(combination?.core_subjects ?? [])
  const [subsidiary, setSubsidiary] = useState<string[]>(
    combination?.subsidiary_subjects ?? [],
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

  function toggle(
    setter: Dispatch<SetStateAction<string[]>>,
    max: number,
    code: string,
  ) {
    setter((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= max
          ? prev
          : [...prev, code],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (core.length !== 3) {
      setError('Core subjects must be exactly 3.')
      return
    }
    if (subsidiary.length === 0) {
      setError('Select at least one subsidiary subject.')
      return
    }
    setSaving(true)

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      core_subjects: core,
      subsidiary_subjects: subsidiary,
    }

    const { data: existing, error: qErr } = await supabase
      .from('combinations')
      .select('id, code, core_subjects, subsidiary_subjects')

    if (qErr) {
      setSaving(false)
      setError(qErr.message)
      return
    }

    const sortedCore = [...core].sort().join(',')
    const sortedSub = [...subsidiary].sort().join(',')
    const dup = (existing ?? []).find((c) => {
      if (editing && c.id === combination!.id) return false
      const sameCode = c.code === payload.code
      const sameSubjects =
        [...c.core_subjects].sort().join(',') === sortedCore &&
        [...c.subsidiary_subjects].sort().join(',') === sortedSub
      return sameCode || sameSubjects
    })

    if (dup) {
      setSaving(false)
      setError(
        dup.code === payload.code
          ? `Code "${dup.code}" already exists.`
          : `Duplicate combination: same subjects are already used by "${dup.code}".`,
      )
      return
    }

    const { error } = combination
      ? await supabase.from('combinations').update(payload).eq('id', combination.id)
      : await supabase.from('combinations').insert(payload)

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved(editing ? `${code.trim().toUpperCase()} updated.` : `${code.trim().toUpperCase()} registered.`)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="combination-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="combination-modal-title">
              {editing ? 'Edit Combination' : 'Register Combination'}
            </h3>
            <p className="modal-sub">
              A-Level combination (F5 - F6), e.g. PCM, PCB
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

          <div className="reg-row">
            <label className="field">
              <span className="field-label">Combination code</span>
              <div className="input-wrap">
                <Tag size={18} className="input-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PCM"
                  required
                  autoFocus
                />
              </div>
            </label>

            <label className="field">
              <span className="field-label">Combination name</span>
              <div className="input-wrap">
                <Layers size={18} className="input-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Physics, Chemistry, Mathematics"
                  required
                />
              </div>
            </label>
          </div>

          <div className="field">
            <span className="field-label">
              <Star size={13} className="inline-icon" /> Core subjects
              <span
                className={
                  core.length === 3
                    ? 'count-badge ok'
                    : 'count-badge'
                }
              >
                {core.length}/3
              </span>
            </span>
            {coreSubjects(subjects).length === 0 ? (
              <p className="field-hint">
                No A-Level core subjects registered yet. Register them as
                "A-Level Core" in Subjects first.
              </p>
            ) : (
              <div className="chips-row modal-chips">
                {coreSubjects(subjects).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={core.includes(s.code) ? 'chip active' : 'chip'}
                    onClick={() => toggle(setCore, 3, s.code)}
                    disabled={!core.includes(s.code) && core.length >= 3}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <p className="field-hint">
              Exactly 3 core subjects are required.
            </p>
          </div>

          <div className="field">
            <span className="field-label">
              <BookOpenCheck size={13} className="inline-icon" /> Subsidiary
              subjects
              <span className="count-badge neutral">
                {subsidiary.length} selected
              </span>
            </span>
            {subsidiarySubjects(subjects).length === 0 ? (
              <p className="field-hint">
                No A-Level subsidiary subjects registered yet. Register them as
                "A-Level Subsidiary" in Subjects first.
              </p>
            ) : (
              <div className="chips-row modal-chips">
                {subsidiarySubjects(subjects).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={subsidiary.includes(s.code) ? 'chip active' : 'chip'}
                    onClick={() => toggle(setSubsidiary, 99, s.code)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <p className="field-hint">
              At least one subsidiary subject is required; no upper limit.
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
                {editing ? 'Save changes' : 'Register combination'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
