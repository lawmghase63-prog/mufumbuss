import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  UserPlus,
  Users,
  Search,
  Trash2,
  Loader2,
  GraduationCap,
  RefreshCw,
  Database,
  Pencil,
  MoveRight,
  Upload,
  RotateCcw,
  UserX,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import FlashMessage from '../components/FlashMessage'
import StudentModal from '../components/StudentModal'
import RegisterStudentModal from '../components/RegisterStudentModal'
import ImportCsvModal from '../components/ImportCsvModal'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  FORMS,
  NEXT_FORM,
  generateAdmissionNo,
  normalizeCsvRow,
  parseCsvLine,
  type Form,
  type ImportSummary,
  type Student,
} from '../lib/students'

type StatusFilter = 'active' | 'graduated' | 'inactive' | 'all'

export default function Students() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  const [flash, setFlash] = useState<{
    type: 'ok' | 'error'
    text: string
  } | null>(null)

  const [query, setQuery] = useState('')
  const [formFilter, setFormFilter] = useState<Form | ''>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const [registerOpen, setRegisterOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)

  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    confirmLabel: string
    danger?: boolean
    action: () => void
  } | null>(null)

  const [bulkForm, setBulkForm] = useState<Form>('F1')
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  async function loadStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('admission_no', { ascending: true })
    if (error) {
      setTableMissing(
        /relation "public\.students" does not exist/i.test(error.message),
      )
    } else {
      setTableMissing(false)
      setStudents((data as Student[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const stats = useMemo(() => {
    const active = students.filter((s) => s.status === 'active')
    return {
      total: active.length,
      boys: active.filter((s) => s.gender === 'M').length,
      girls: active.filter((s) => s.gender === 'F').length,
      graduated: students.filter((s) => s.status === 'graduated').length,
      inactive: students.filter((s) => s.status === 'inactive').length,
    }
  }, [students])

  const formCounts = useMemo(() => {
    const map = new Map<Form, number>(FORMS.map((f) => [f, 0]))
    students
      .filter((s) => s.status === 'active')
      .forEach((s) => map.set(s.form, (map.get(s.form) ?? 0) + 1))
    return map
  }, [students])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter((s) => {
      if (statusFilter === 'active' && s.status !== 'active') return false
      if (statusFilter === 'graduated' && s.status !== 'graduated') return false
      if (statusFilter === 'inactive' && s.status !== 'inactive') return false
      if (formFilter && s.form !== formFilter) return false
      if (!q) return true
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        s.parent_phone.includes(q)
      )
    })
  }, [students, query, formFilter, statusFilter])

  function handleDelete(s: Student) {
    setConfirm({
      title: 'Delete student',
      message: `Delete ${s.full_name} (${s.admission_no})? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => doDelete(s),
    })
  }

  async function doDelete(s: Student) {
    const { error } = await supabase.from('students').delete().eq('id', s.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: `${s.full_name} deleted.` })
      loadStudents()
    }
  }

  function handlePromote(s: Student) {
    const next = NEXT_FORM[s.form]
    const isGraduate = next === 'graduate'
    setConfirm({
      title: isGraduate ? 'Graduate student' : `Promote to ${next}`,
      message: isGraduate
        ? `Graduate ${s.full_name} (${s.admission_no})?`
        : `Promote ${s.full_name} from ${s.form} to ${next}?`,
      confirmLabel: isGraduate ? 'Graduate' : 'Promote',
      action: () => doPromote(s, isGraduate),
    })
  }

  async function doPromote(s: Student, isGraduate: boolean) {
    const updates = isGraduate
      ? { status: 'graduated', graduated_at: new Date().toISOString() }
      : { form: NEXT_FORM[s.form] }
    const { error } = await supabase.from('students').update(updates).eq('id', s.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({
        type: 'ok',
        text: isGraduate
          ? `${s.full_name} graduated.`
          : `${s.full_name} promoted to ${NEXT_FORM[s.form]}.`,
      })
      loadStudents()
    }
  }

  function handleReactivate(s: Student) {
    setConfirm({
      title: 'Reactivate student',
      message: `Reactivate ${s.full_name} as an active student?`,
      confirmLabel: 'Reactivate',
      action: () => doReactivate(s),
    })
  }

  async function doReactivate(s: Student) {
    const { error } = await supabase
      .from('students')
      .update({ status: 'active', graduated_at: null })
      .eq('id', s.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: `${s.full_name} reactivated.` })
      loadStudents()
    }
  }

  function handleDeactivate(s: Student) {
    setConfirm({
      title: 'Deactivate student',
      message: `Deactivate ${s.full_name} (${s.admission_no})? They will no longer appear in the active register.`,
      confirmLabel: 'Deactivate',
      danger: true,
      action: () => doDeactivate(s),
    })
  }

  async function doDeactivate(s: Student) {
    const { error } = await supabase
      .from('students')
      .update({ status: 'inactive' })
      .eq('id', s.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: `${s.full_name} deactivated.` })
      loadStudents()
    }
  }

  function handlePromoteAll() {
    const next = NEXT_FORM[bulkForm]
    const isGraduate = next === 'graduate'
    const count = students.filter(
      (s) => s.form === bulkForm && s.status === 'active',
    ).length
    if (!count) {
      setFlash({ type: 'error', text: `No active students in ${bulkForm}.` })
      return
    }
    setConfirm({
      title: isGraduate ? `Graduate all ${bulkForm}` : `Promote all ${bulkForm}`,
      message: isGraduate
        ? `Graduate all ${count} students in ${bulkForm}?`
        : `Promote all ${count} students in ${bulkForm} to ${next}?`,
      confirmLabel: isGraduate ? 'Graduate' : 'Promote',
      action: () => doPromoteAll(isGraduate, count),
    })
  }

  async function doPromoteAll(isGraduate: boolean, count: number) {
    const updates = isGraduate
      ? { status: 'graduated', graduated_at: new Date().toISOString() }
      : { form: NEXT_FORM[bulkForm] }
    const { error } = await supabase
      .from('students')
      .update(updates)
      .eq('form', bulkForm)
      .eq('status', 'active')
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({
        type: 'ok',
        text: `${count} students ${isGraduate ? 'graduated' : `promoted to ${NEXT_FORM[bulkForm]}`}.`,
      })
      loadStudents()
    }
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFlash(null)
    setImporting(true)
    setImportSummary(null)

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const imported: Student[] = []
    const errors: ImportSummary['errors'] = []

    for (let i = 0; i < lines.length; i++) {
      if (i === 0) continue
      const raw = parseCsvLine(lines[i])
      const res = normalizeCsvRow(raw)
      if (!res.ok) {
        errors.push({ line: i + 1, reason: res.error! })
        continue
      }
      const row = res.row!
      const no = await generateAdmissionNo(row.form)
      const { data, error } = await supabase
        .from('students')
        .insert({
          admission_no: no,
          full_name: row.full_name,
          gender: row.gender,
          form: row.form,
          parent_phone: row.parent_phone,
        })
        .select()
        .single()
      if (error) {
        errors.push({ line: i + 1, reason: error.message })
      } else {
        imported.push(data as Student)
      }
    }

    setImporting(false)
    setImportSummary({ imported: imported.length, errors })
    setFlash({
      type: errors.length ? 'error' : 'ok',
      text: `${imported.length} student(s) imported${errors.length ? `, ${errors.length} error(s)` : ''}.`,
    })
    if (imported.length) loadStudents()
  }

  const active = statusFilter === 'active'

  return (
    <div className="students-page">
      <header className="page-head">
        <h2>Student Registration</h2>
      </header>

      <section className="stats-grid">
        <StatCard label="Total Students" value={stats.total} />
        <StatCard label="Boys" value={stats.boys} />
        <StatCard label="Girls" value={stats.girls} />
        <StatCard label="Graduates" value={stats.graduated} />
        <StatCard label="Inactive" value={stats.inactive} />
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

      <div className="page-tools">
        <button
          type="button"
          className="signin-btn reg-open"
          onClick={() => setRegisterOpen(true)}
        >
          <UserPlus size={18} />
          Register student
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={16} />
          Import CSV
        </button>
      </div>

      <section className="panel students-list">
          <div className="list-head">
            <h3>
              <Users size={18} />
              Students
              <span className="count-pill">{filtered.length}</span>
            </h3>
            <button
              type="button"
              className="refresh-btn"
              onClick={loadStudents}
              aria-label="Refresh list"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="list-tools">
            <div className="input-wrap">
              <Search size={17} className="input-icon" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, admission no. or phone..."
              />
            </div>
            <select
              className="status-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter)
                setFormFilter('')
              }}
            >
              <option value="active">Active</option>
              <option value="graduated">Graduates</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>

          {active && (
            <>
              <div className="bulk-row">
                <span>Promote all in</span>
                <select
                  className="status-select bulk-select"
                  value={bulkForm}
                  onChange={(e) => setBulkForm(e.target.value as Form)}
                >
                  {FORMS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="bulk-btn"
                  onClick={handlePromoteAll}
                >
                  <MoveRight size={15} />
                  {NEXT_FORM[bulkForm] === 'graduate'
                    ? 'Graduate'
                    : `→ ${NEXT_FORM[bulkForm]}`}
                </button>
              </div>

              <div className="chips-row">
                <button
                  type="button"
                  className={formFilter === '' ? 'chip active' : 'chip'}
                  onClick={() => setFormFilter('')}
                >
                  All <span>{stats.total}</span>
                </button>
                {FORMS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={formFilter === f ? 'chip active' : 'chip'}
                    onClick={() => setFormFilter(formFilter === f ? '' : f)}
                  >
                    {f} <span>{formCounts.get(f) ?? 0}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {tableMissing && (
            <FlashMessage
              type="error"
              text="The 'students' table is missing in your database. Run the SQL in supabase/schema.sql."
              onDismiss={() => setTableMissing(false)}
            />
          )}

          {loading ? (
            <div className="list-state">
              <Loader2 size={20} className="spin" />
              Loading students...
            </div>
          ) : filtered.length === 0 ? (
            <div className="list-state">
              <Database size={22} />
              {tableMissing
                ? 'Database table not found.'
                : statusFilter === 'graduated'
                  ? 'No graduates yet. Promote F6 students to graduate them.'
                  : statusFilter === 'inactive'
                    ? 'No inactive students.'
                    : query || formFilter
                      ? 'No students match your filters.'
                      : 'No students registered yet.'}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission no.</th>
                    <th>Gender</th>
                    <th>Form</th>
                    <th>Parent phone</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const isGrad = s.status === 'graduated'
                    const isInactive = s.status === 'inactive'
                    const isActive = s.status === 'active'
                    return (
                      <tr
                        key={s.id}
                        className={
                          isGrad ? 'row-grad' : isInactive ? 'row-inactive' : ''
                        }
                      >
                        <td>
                          <div className="student-cell">
                            <span className="student-avatar">
                              {s.full_name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                            <span className="table-name">
                              {s.full_name}
                              {isGrad && (
                                <span className="grad-badge">Graduate</span>
                              )}
                              {isInactive && (
                                <span className="inactive-badge">Inactive</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="mono">{s.admission_no}</td>
                        <td>
                          <span
                            className={
                              s.gender === 'M' ? 'gender-tag male' : 'gender-tag female'
                            }
                          >
                            {s.gender === 'M' ? 'Male' : 'Female'}
                          </span>
                        </td>
                        <td>
                          <span className="form-tag">{s.form}</span>
                        </td>
                        <td className="mono">{s.parent_phone || '—'}</td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="row-act"
                            onClick={() => setEditing(s)}
                            aria-label={`Edit ${s.full_name}`}
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          {isActive ? (
                            <>
                              <button
                                type="button"
                                className="row-act promote"
                                onClick={() => handlePromote(s)}
                                aria-label={
                                  NEXT_FORM[s.form] === 'graduate'
                                    ? `Graduate ${s.full_name}`
                                    : `Promote ${s.full_name} to ${NEXT_FORM[s.form]}`
                                }
                                title={
                                  NEXT_FORM[s.form] === 'graduate'
                                    ? 'Graduate'
                                    : `Promote to ${NEXT_FORM[s.form]}`
                                }
                              >
                                <GraduationCap size={15} />
                              </button>
                              <button
                                type="button"
                                className="row-act deactivate"
                                onClick={() => handleDeactivate(s)}
                                aria-label={`Deactivate ${s.full_name}`}
                                title="Deactivate"
                              >
                                <UserX size={15} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="row-act reactivate"
                              onClick={() => handleReactivate(s)}
                              aria-label={`Reactivate ${s.full_name}`}
                              title="Reactivate"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="row-act row-del"
                            onClick={() => handleDelete(s)}
                            aria-label={`Delete ${s.full_name}`}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

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

      {importOpen && (
        <ImportCsvModal
          importing={importing}
          summary={importSummary}
          onFile={handleImportFile}
          onClose={() => setImportOpen(false)}
        />
      )}

      {registerOpen && (
        <RegisterStudentModal
          onClose={() => setRegisterOpen(false)}
          onRegistered={(msg) => {
            setRegisterOpen(false)
            setFlash({ type: 'ok', text: msg })
            loadStudents()
          }}
        />
      )}

      {editing && (
        <StudentModal
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setFlash({ type: 'ok', text: 'Student updated.' })
            loadStudents()
          }}
        />
      )}
    </div>
  )
}
