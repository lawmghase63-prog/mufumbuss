import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Layers,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Star,
  BookOpenCheck,
  Database,
  Plus,
  FlaskConical,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import FlashMessage from '../components/FlashMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import SubjectModal from '../components/SubjectModal'
import CombinationModal from '../components/CombinationModal'
import {
  O_LEVEL_FORMS,
  subjectName,
  type Combination,
  type Subject,
  type SubjectType,
} from '../lib/subjects'

interface Flash {
  type: 'ok' | 'error'
  text: string
}

type Tab = 'o' | 'a' | 'c'

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [tab, setTab] = useState<Tab>('o')

  const [flash, setFlash] = useState<Flash | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    confirmLabel: string
    danger?: boolean
    action: () => void
  } | null>(null)
  const [subjectModal, setSubjectModal] = useState<{
    open: boolean
    editing: Subject | null
    presetType?: SubjectType
  }>({ open: false, editing: null })
  const [comboModal, setComboModal] = useState<{
    open: boolean
    editing: Combination | null
  }>({ open: false, editing: null })

  async function load() {
    setLoading(true)
    const [subjectsRes, combosRes] = await Promise.all([
      supabase.from('subjects').select('*').order('code', { ascending: true }),
      supabase
        .from('combinations')
        .select('*')
        .order('code', { ascending: true }),
    ])
    const missing = !!(
      (subjectsRes.error &&
        /relation "public\.subjects" does not exist/i.test(subjectsRes.error.message)) ||
      (combosRes.error &&
        /relation "public\.combinations" does not exist/i.test(combosRes.error.message))
    )
    setTableMissing(missing)
    if (!subjectsRes.error) setSubjects((subjectsRes.data as Subject[]) ?? [])
    if (!combosRes.error) setCombinations((combosRes.data as Combination[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    const oLevel = subjects.filter((s) => s.type === 'o').length
    const aLevel = subjects.filter(
      (s) => s.type === 'core' || s.type === 'subsidiary',
    ).length
    return {
      total: subjects.length,
      oLevel,
      aLevel,
      combinations: combinations.length,
    }
  }, [subjects, combinations])

  const oLevelSubjects = useMemo(
    () => subjects.filter((s) => s.type === 'o'),
    [subjects],
  )
  const aLevelSubjects = useMemo(
    () =>
      subjects.filter((s) => s.type === 'core' || s.type === 'subsidiary'),
    [subjects],
  )
  const coreSubjects = useMemo(
    () => subjects.filter((s) => s.type === 'core'),
    [subjects],
  )
  const subsidiarySubjects = useMemo(
    () => subjects.filter((s) => s.type === 'subsidiary'),
    [subjects],
  )

  function askDeleteSubject(s: Subject) {
    setConfirm({
      title: 'Delete subject',
      message: `Delete ${s.name} (${s.code})? It will be removed from any combination that uses it.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => doDeleteSubject(s),
    })
  }

  async function doDeleteSubject(s: Subject) {
    const { error } = await supabase.from('subjects').delete().eq('id', s.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: `${s.name} deleted.` })
      load()
    }
  }

  function askDeleteCombination(c: Combination) {
    setConfirm({
      title: 'Delete combination',
      message: `Delete combination ${c.code} (${c.name})?`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => doDeleteCombination(c),
    })
  }

  async function doDeleteCombination(c: Combination) {
    const { error } = await supabase.from('combinations').delete().eq('id', c.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: `${c.code} deleted.` })
      load()
    }
  }

  function renderSubjectTable(list: Subject[]) {
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Code</th>
              <th>Type</th>
              <th>Practical</th>
              <th>Taught in</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="student-cell">
                    <span className="subject-avatar">{s.code.slice(0, 2)}</span>
                    <span className="table-name">{s.name}</span>
                  </div>
                </td>
                <td>
                  <span className="code-tag">{s.code}</span>
                </td>
                <td>
                  {s.type === 'core' ? (
                    <span className="type-tag core">
                      <Star size={11} /> Core
                    </span>
                  ) : s.type === 'subsidiary' ? (
                    <span className="type-tag subsidiary">
                      <BookOpenCheck size={11} /> Subsidiary
                    </span>
                  ) : (
                    <span className="type-tag o">
                      <BookOpen size={11} /> O-Level
                    </span>
                  )}
                </td>
                <td>
                  {s.has_practical ? (
                    <span className="practical-tag">
                      <FlaskConical size={11} /> Practical
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {s.type === 'o' ? (
                    <div className="form-chips">
                      {O_LEVEL_FORMS.map((f) => (
                        <span
                          key={f}
                          className={
                            s.forms.includes(f) ? 'mini-chip on' : 'mini-chip off'
                          }
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">F5 - F6</span>
                  )}
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="row-act"
                    onClick={() => setSubjectModal({ open: true, editing: s })}
                    aria-label={`Edit ${s.name}`}
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="row-act row-del"
                    onClick={() => askDeleteSubject(s)}
                    aria-label={`Delete ${s.name}`}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="subjects-page">
      <header className="page-head">
        <h2>Subjects</h2>
      </header>

      <section className="stats-grid">
        <StatCard label="Total Subjects" value={stats.total} />
        <StatCard label="O-Level (F1-F4)" value={stats.oLevel} />
        <StatCard label="A-Level (F5-F6)" value={stats.aLevel} />
        <StatCard label="Combinations" value={stats.combinations} />
      </section>

      {flash && (
        <div className="page-flash">
          <FlashMessage
            type={flash.type}
            text={flash.text}
            onDismiss={() => setFlash(null)}
          />
        </div>
      )}

      <div className="subj-tabs">
        <button
          type="button"
          className={tab === 'o' ? 'subj-tab active' : 'subj-tab'}
          onClick={() => setTab('o')}
        >
          <BookOpen size={16} />
          O-Level Subjects
          <span className="tab-count">{stats.oLevel}</span>
        </button>
        <button
          type="button"
          className={tab === 'a' ? 'subj-tab active' : 'subj-tab'}
          onClick={() => setTab('a')}
        >
          <Layers size={16} />
          A-Level Subjects
          <span className="tab-count">{stats.aLevel}</span>
        </button>
        <button
          type="button"
          className={tab === 'c' ? 'subj-tab active' : 'subj-tab'}
          onClick={() => setTab('c')}
        >
          <BookOpenCheck size={16} />
          Combinations
          <span className="tab-count">{stats.combinations}</span>
        </button>
      </div>

      {tableMissing && (
        <FlashMessage
          type="error"
          text="The 'subjects' or 'combinations' table is missing. Run the SQL in supabase/schema.sql."
          onDismiss={() => setTableMissing(false)}
        />
      )}

      {loading ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Loading subjects...
        </div>
      ) : tab === 'o' ? (
        <section className="panel">
          <div className="list-head">
            <h3>
              <BookOpen size={18} />
              O-Level Subjects (F1 - F4)
            </h3>
            <div className="head-actions">
              <button
                type="button"
                className="refresh-btn"
                onClick={load}
                aria-label="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                className="signin-btn add-btn"
                onClick={() =>
                  setSubjectModal({ open: true, editing: null, presetType: 'o' })
                }
              >
                <Plus size={17} />
                Add subject
              </button>
            </div>
          </div>

          {oLevelSubjects.length === 0 ? (
            <div className="list-state">
              <Database size={22} />
              No O-Level subjects yet.
            </div>
          ) : (
            renderSubjectTable(oLevelSubjects)
          )}
        </section>
      ) : tab === 'a' ? (
        <section className="panel">
          <div className="list-head">
            <h3>
              <Layers size={18} />
              A-Level Subjects (F5 - F6)
            </h3>
            <div className="head-actions">
              <button
                type="button"
                className="refresh-btn"
                onClick={load}
                aria-label="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                className="signin-btn add-btn"
                onClick={() =>
                  setSubjectModal({ open: true, editing: null, presetType: 'core' })
                }
              >
                <Plus size={17} />
                Add A-Level subject
              </button>
            </div>
          </div>

          <div className="a-level-summary">
            <div className="summary-box core">
              <Star size={16} />
              <strong>{coreSubjects.length}</strong>
              core subject(s)
            </div>
            <div className="summary-box subsidiary">
              <BookOpenCheck size={16} />
              <strong>{subsidiarySubjects.length}</strong>
              subsidiary subject(s)
            </div>
            <p className="field-hint">
              Register A-Level subjects as <strong>Core</strong> or{' '}
              <strong>Subsidiary</strong>. Core subjects form the combination
              (e.g. PCM = Physics, Chemistry, Mathematics).
            </p>
          </div>

          {aLevelSubjects.length === 0 ? (
            <div className="list-state">
              <Database size={22} />
              No A-Level subjects yet. Register subjects as Core or Subsidiary.
            </div>
          ) : (
            renderSubjectTable(aLevelSubjects)
          )}
        </section>
      ) : (
        <section className="panel">
          <div className="list-head">
            <h3>
              <BookOpenCheck size={18} />
              A-Level Combinations (F5 - F6)
            </h3>
            <div className="head-actions">
              <button
                type="button"
                className="refresh-btn"
                onClick={load}
                aria-label="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                className="signin-btn add-btn"
                onClick={() => setComboModal({ open: true, editing: null })}
              >
                <Plus size={17} />
                Add combination
              </button>
            </div>
          </div>

          {combinations.length === 0 ? (
            <div className="list-state">
              <Database size={22} />
              No combinations yet. Register a combination like PCM (Physics,
              Chemistry, Mathematics).
            </div>
          ) : (
            <div className="combo-cards">
              {combinations.map((c) => (
                <div className="combo-card" key={c.id}>
                  <div className="combo-head">
                    <span className="combo-code">{c.code}</span>
                    <div className="combo-title">
                      <span className="table-name">{c.name}</span>
                    </div>
                    <div className="combo-actions">
                      <button
                        type="button"
                        className="row-act"
                        onClick={() => setComboModal({ open: true, editing: c })}
                        aria-label={`Edit ${c.code}`}
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="row-act row-del"
                        onClick={() => askDeleteCombination(c)}
                        aria-label={`Delete ${c.code}`}
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="combo-block">
                    <span className="combo-label">
                      <Star size={13} /> Core subjects
                    </span>
                    <div className="combo-tags">
                      {c.core_subjects.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        c.core_subjects.map((code) => (
                          <span className="combo-tag core" key={code}>
                            {subjectName(subjects, code)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="combo-block">
                    <span className="combo-label">
                      <BookOpenCheck size={13} /> Subsidiary subjects
                    </span>
                    <div className="combo-tags">
                      {c.subsidiary_subjects.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        c.subsidiary_subjects.map((code) => (
                          <span className="combo-tag sub" key={code}>
                            {subjectName(subjects, code)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={() => {
            const action = confirm.action
            setConfirm(null)
            action()
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {subjectModal.open && (
        <SubjectModal
          subject={subjectModal.editing}
          presetType={subjectModal.presetType}
          onClose={() => setSubjectModal({ open: false, editing: null })}
          onSaved={(msg) => {
            setSubjectModal({ open: false, editing: null })
            setFlash({ type: 'ok', text: msg })
            load()
          }}
        />
      )}

      {comboModal.open && (
        <CombinationModal
          combination={comboModal.editing}
          subjects={subjects}
          onClose={() => setComboModal({ open: false, editing: null })}
          onSaved={(msg) => {
            setComboModal({ open: false, editing: null })
            setFlash({ type: 'ok', text: msg })
            load()
          }}
        />
      )}
    </div>
  )
}
