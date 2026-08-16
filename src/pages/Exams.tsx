import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  CalendarPlus,
  ClipboardList,
  FlaskConical,
  CalendarCheck,
  Loader2,
  Database,
  Pencil,
  Trash2,
  Power,
  RotateCcw,
  Layers,
  Play,
  BarChart3,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import FlashMessage from '../components/FlashMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import ExamModal from '../components/ExamModal'
import type { Exam, ExamMark, Division, StudentMarkEntry } from '../lib/exams'
import { examTypeLabel, formatExamDates, computeDivision } from '../lib/exams'
import type { Student } from '../lib/students'

type DivisionCounts = Record<Division, number>

const EMPTY_DIVISIONS: DivisionCounts = { I: 0, II: 0, III: 0, IV: 0, '0': 0 }

const DIVISION_KEYS: Division[] = ['I', 'II', 'III', 'IV', '0']

export default function Exams() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [flash, setFlash] = useState<{
    type: 'ok' | 'error'
    text: string
  } | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState<Exam | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    confirmLabel: string
    danger?: boolean
    action: () => void
  } | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, DivisionCounts>>({})
  const navigate = useNavigate()
  const location = useLocation()

  function analysisPath(examId: string): string {
    const base = location.pathname.startsWith('/academic') ? '/academic' : '/headmaster'
    return `${base}/analysis/${examId}`
  }

  async function load() {
    setLoading(true)
    const [examsRes, resultsRes] = await Promise.all([
      supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('exam_results').select('exam_id, division'),
    ])
    if (examsRes.error) {
      setTableMissing(
        /relation "public\.exams" does not exist/i.test(examsRes.error.message),
      )
    } else {
      setTableMissing(false)
      setExams((examsRes.data as Exam[]) ?? [])
      const map: Record<string, DivisionCounts> = {}
      for (const r of (resultsRes.data ?? []) as {
        exam_id: string
        division: Division
      }[]) {
        const counts = map[r.exam_id] ?? { ...EMPTY_DIVISIONS }
        counts[r.division] += 1
        map[r.exam_id] = counts
      }
      setResults(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(
    () => ({
      total: exams.length,
      active: exams.filter((e) => e.status === 'active').length,
      tests: exams.filter((e) => e.exam_type === 'test').length,
      practical: exams.filter((e) => e.has_practical).length,
    }),
    [exams],
  )

  function handleDelete(e: Exam) {
    setConfirm({
      title: 'Delete exam',
      message: `Delete "${e.name}"? All marks entered for this exam will also be removed.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => doDelete(e),
    })
  }

  async function doDelete(e: Exam) {
    const { error } = await supabase.from('exams').delete().eq('id', e.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: `"${e.name}" deleted.` })
      load()
    }
  }

  async function toggleStatus(e: Exam) {
    const next = e.status === 'active' ? 'closed' : 'active'
    const { error } = await supabase.from('exams').update({ status: next }).eq('id', e.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({
        type: 'ok',
        text:
          next === 'active'
            ? `"${e.name}" re-activated — teachers can enter marks.`
            : `"${e.name}" closed — teachers can no longer enter marks.`,
      })
      load()
    }
  }

  function handleProcess(e: Exam) {
    setConfirm({
      title: 'Process results',
      message: `Compute divisions for all students in "${e.name}" (${e.forms
        .map((f) => `Form ${f.slice(1)}`)
        .join(', ')})? O-Level uses the best 7 subjects (NECTA CSEE); A-Level uses points from the best 3 core subjects. Existing divisions for this exam will be recalculated.`,
      confirmLabel: 'Process',
      action: () => processExam(e),
    })
  }

  async function processExam(exam: Exam) {
    setProcessingId(exam.id)
    try {
      const [marksRes, studentsRes, subjectsRes] = await Promise.all([
        supabase.from('exam_marks').select('*').eq('exam_id', exam.id),
        supabase.from('students').select('id, form, status'),
        supabase.from('subjects').select('id, type'),
      ])
      if (marksRes.error) throw new Error(marksRes.error.message)
      if (studentsRes.error) throw new Error(studentsRes.error.message)
      if (subjectsRes.error) throw new Error(subjectsRes.error.message)

      const marks = (marksRes.data ?? []) as ExamMark[]
      const students = (studentsRes.data ?? []) as Pick<Student, 'id' | 'form' | 'status'>[]
      const subjectTypes = new Map(
        (subjectsRes.data ?? []).map((s) => [s.id, s.type]),
      )

      const byStudent = new Map<string, StudentMarkEntry[]>()
      for (const m of marks) {
        const arr = byStudent.get(m.student_id) ?? []
        arr.push({
          subject_id: m.subject_id,
          theory: m.theory,
          practical: m.practical,
          absent: m.absent,
        })
        byStudent.set(m.student_id, arr)
      }

      const formSet = new Set(exam.forms)
      const rows: {
        exam_id: string
        student_id: string
        form: string
        level: string
        division: Division
        subjects_used: number
        best_count: number
        d_below: number
        total_points: number
      }[] = []
      let skipped = 0

      for (const s of students) {
        if (s.status !== 'active') continue
        if (!formSet.has(s.form)) continue
        const entries = byStudent.get(s.id)
        if (!entries) continue
        const result = computeDivision(s.form, entries, subjectTypes)
        if (!result) {
          skipped++
          continue
        }
        rows.push({
          exam_id: exam.id,
          student_id: s.id,
          form: s.form,
          level: result.level,
          division: result.division,
          subjects_used: result.subjectsUsed,
          best_count: result.bestCount,
          d_below: result.dBelow,
          total_points: result.points,
        })
      }

      if (rows.length === 0) {
        setFlash({
          type: 'error',
          text: `No marks to process for "${exam.name}". Enter marks first.`,
        })
        return
      }

      const { error } = await supabase
        .from('exam_results')
        .upsert(rows, { onConflict: 'exam_id,student_id' })
      if (error) throw new Error(error.message)

      const counts: DivisionCounts = { ...EMPTY_DIVISIONS }
      for (const r of rows) counts[r.division]++
      const summary = `Processed ${rows.length} students for "${exam.name}"${skipped ? ` (${skipped} without enough marks)` : ''}. Divisions — I: ${counts.I}, II: ${counts.II}, III: ${counts.III}, IV: ${counts.IV}, 0: ${counts['0']}.`
      setFlash({ type: 'ok', text: summary })
      load()
      navigate(analysisPath(exam.id))
    } catch (err) {
      setFlash({
        type: 'error',
        text: err instanceof Error ? err.message : 'Processing failed.',
      })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="exams-page">
      <header className="page-head">
        <h2>Exams</h2>
        <p>Register exams and tests. They activate instantly so teachers can enter marks.</p>
      </header>

      <section className="stats-grid">
        <StatCard label="Total Exams" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Tests" value={stats.tests} />
        <StatCard label="With Practical" value={stats.practical} />
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
          <CalendarPlus size={18} />
          Register exam / test
        </button>
      </div>

      {tableMissing && (
        <FlashMessage
          type="error"
          text="The 'exams' table is missing in your database. Run the SQL in supabase/schema.sql."
          onDismiss={() => setTableMissing(false)}
        />
      )}

      {loading ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Loading exams...
        </div>
      ) : exams.length === 0 ? (
        <div className="list-state">
          <Database size={22} />
          No exams registered yet. Register your first exam or test.
        </div>
      ) : (
        <div className="class-grid">
          {exams.map((exam) => (
            <section key={exam.id} className="panel exam-card">
              <div className="exam-card-head">
                <div className="exam-title">
                  <span
                    className={
                      exam.exam_type === 'test'
                        ? 'exam-type-badge test'
                        : 'exam-type-badge'
                    }
                  >
                    {exam.exam_type === 'test' ? <Layers size={13} /> : <ClipboardList size={13} />}
                    {examTypeLabel(exam.exam_type)}
                  </span>
                  <h3>{exam.name}</h3>
                </div>
                <span
                  className={
                    exam.status === 'active'
                      ? 'exam-status active'
                      : 'exam-status closed'
                  }
                >
                  {exam.status === 'active' ? 'Active' : 'Closed'}
                </span>
              </div>

              <div className="exam-meta">
                <span>
                  <CalendarCheck size={15} />
                  {formatExamDates(exam)}
                </span>
              </div>

              <div className="exam-forms">
                {exam.forms.map((form) => (
                  <span key={form} className="form-tag">
                    Form {form.slice(1)}
                  </span>
                ))}
                {exam.forms.length === 0 && <span className="muted">No classes</span>}
              </div>

              {exam.has_practical && (
                <div className="exam-practical">
                  <FlaskConical size={15} />
                  Has practical component
                </div>
              )}

              <div className="exam-actions">
                <button
                  type="button"
                  className="exam-act primary"
                  disabled={processingId === exam.id}
                  onClick={() => handleProcess(exam)}
                >
                  {processingId === exam.id ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <Play size={15} />
                  )}
                  {processingId === exam.id ? 'Processing...' : 'Process'}
                </button>
                <button
                  type="button"
                  className="exam-act"
                  onClick={() => navigate(analysisPath(exam.id))}
                >
                  <BarChart3 size={15} />
                  Analysis
                </button>
                <button
                  type="button"
                  className="exam-act"
                  onClick={() => setEditing(exam)}
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  type="button"
                  className="exam-act"
                  onClick={() => toggleStatus(exam)}
                >
                  {exam.status === 'active' ? (
                    <>
                      <Power size={15} />
                      Close
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} />
                      Re-activate
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="exam-act danger"
                  onClick={() => handleDelete(exam)}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>

              {results[exam.id] && (
                <div className="exam-results-summary">
                  <span className="results-total">
                    Divisions ·{' '}
                    {DIVISION_KEYS.reduce(
                      (sum, k) => sum + (results[exam.id]?.[k] ?? 0),
                      0,
                    )}{' '}
                    students
                  </span>
                  <div className="division-counts">
                    {DIVISION_KEYS.map((d) => (
                      <span key={d} className="division-count">
                        {d}: {results[exam.id]?.[d] ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {registerOpen && (
        <ExamModal
          onClose={() => setRegisterOpen(false)}
          onSaved={(message) => {
            setRegisterOpen(false)
            setFlash({ type: 'ok', text: message })
            load()
          }}
        />
      )}

      {editing && (
        <ExamModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            setFlash({ type: 'ok', text: message })
            load()
          }}
        />
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
    </div>
  )
}
