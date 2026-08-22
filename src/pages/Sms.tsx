import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Send,
  Database,
  Users,
  Phone,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import FlashMessage from '../components/FlashMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import type { Exam, ExamMark } from '../lib/exams'
import { subjectTotalMark } from '../lib/exams'
import type { Student, Form } from '../lib/students'
import { FORMS } from '../lib/students'
import type { Combination } from '../lib/subjects'
import {
  normalizeTzPhone,
  renderTemplate,
  AUTO_TEMPLATE_DEFAULT,
  sendSmsBatch,
} from '../lib/sms'

interface StudentCombination {
  student_id: string
  combination_id: string
}

interface ExamResultRow {
  student_id: string
  form: Form
  division: string
}

interface Row {
  student: Student
  avg: number | null
  division: string | null
  position: number | null
  total: number
}

const CHUNK_SIZE = 20

function formLabel(f: Form): string {
  return `Form ${f.slice(1)}`
}

export default function Sms() {
  const [loading, setLoading] = useState(true)
  const [loadingExam, setLoadingExam] = useState(false)
  const [exams, setExams] = useState<Exam[]>([])
  const [examId, setExamId] = useState('')
  const [exam, setExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<ExamMark[]>([])
  const [results, setResults] = useState<ExamResultRow[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [studentCombinations, setStudentCombinations] = useState<StudentCombination[]>([])
  const [selectedForm, setSelectedForm] = useState<Form | 'ALL'>('ALL')
  const [selectedComboId, setSelectedComboId] = useState<string | 'ALL'>('ALL')

  const [mode, setMode] = useState<'auto' | 'custom'>('auto')
  const [phones, setPhones] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [template, setTemplate] = useState(AUTO_TEMPLATE_DEFAULT)
  const [customText, setCustomText] = useState('')
  const [savingPhone, setSavingPhone] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const [examsRes, studsRes, combosRes, scRes] = await Promise.all([
        supabase.from('exams').select('*').order('start_date', { ascending: false }),
        supabase.from('students').select('*'),
        supabase.from('combinations').select('*'),
        supabase.from('student_combinations').select('student_id, combination_id'),
      ])
      if (!alive) return
      if (!examsRes.error) setExams((examsRes.data as Exam[]) ?? [])
      const studs = (studsRes.data as Student[]) ?? []
      setStudents(studs.filter((s) => s.status === 'active'))
      const initialPhones: Record<string, string> = {}
      for (const s of studs) initialPhones[s.id] = s.parent_phone ?? ''
      setPhones(initialPhones)
      setCombinations((combosRes.data as Combination[]) ?? [])
      setStudentCombinations((scRes.data as StudentCombination[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!examId) {
      setExam(null)
      setMarks([])
      setResults([])
      return
    }
    let alive = true
    async function loadExamData() {
      setLoadingExam(true)
      setSelected(new Set())
      const [examRes, marksRes, resultsRes] = await Promise.all([
        supabase.from('exams').select('*').eq('id', examId).maybeSingle(),
        supabase.from('exam_marks').select('*').eq('exam_id', examId),
        supabase
          .from('exam_results')
          .select('student_id, form, division')
          .eq('exam_id', examId),
      ])
      if (!alive) return
      setExam((examRes.data as Exam) ?? null)
      setMarks((marksRes.data as ExamMark[]) ?? [])
      setResults((resultsRes.data as ExamResultRow[]) ?? [])
      setLoadingExam(false)
    }
    loadExamData()
    return () => {
      alive = false
    }
  }, [examId])

  function switchMode(next: 'auto' | 'custom') {
    if (next === mode) return
    setMode(next)
    setSelected(new Set())
    setSelectedForm('ALL')
    setSelectedComboId('ALL')
  }

  const availableForms = useMemo<Form[]>(() => {
    if (mode === 'auto') return exam?.forms ?? []
    const present = new Set(students.map((s) => s.form))
    return FORMS.filter((f) => present.has(f))
  }, [mode, exam, students])

  const scopedResults = useMemo(() => {
    if (mode !== 'auto') return []
    let filtered =
      selectedForm === 'ALL' ? results : results.filter((r) => r.form === selectedForm)
    if (selectedComboId !== 'ALL') {
      const ids = new Set(
        studentCombinations
          .filter((sc) => sc.combination_id === selectedComboId)
          .map((sc) => sc.student_id),
      )
      filtered = filtered.filter((r) => ids.has(r.student_id))
    }
    return filtered
  }, [mode, results, selectedForm, selectedComboId, studentCombinations])

  const customAudience = useMemo(() => {
    if (mode !== 'custom') return []
    let list =
      selectedForm === 'ALL' ? students : students.filter((s) => s.form === selectedForm)
    if (selectedComboId !== 'ALL') {
      const ids = new Set(
        studentCombinations
          .filter((sc) => sc.combination_id === selectedComboId)
          .map((sc) => sc.student_id),
      )
      list = list.filter((s) => ids.has(s.id))
    }
    return list
  }, [mode, students, selectedForm, selectedComboId, studentCombinations])

  const rows = useMemo<Row[]>(() => {
    if (mode === 'custom') {
      return customAudience.map((s) => ({
        student: s,
        avg: null,
        division: null,
        position: null,
        total: customAudience.length,
      }))
    }

    const studentById = new Map(students.map((s) => [s.id, s]))
    const totalsByStudent = new Map<string, number[]>()
    for (const m of marks) {
      const t = subjectTotalMark(m)
      if (t == null) continue
      const arr = totalsByStudent.get(m.student_id) ?? []
      arr.push(t)
      totalsByStudent.set(m.student_id, arr)
    }

    const list: Row[] = []
    for (const r of scopedResults) {
      const student = studentById.get(r.student_id)
      if (!student) continue
      const totals = totalsByStudent.get(r.student_id) ?? []
      const avg = totals.length > 0 ? totals.reduce((s, t) => s + t, 0) / totals.length : 0
      list.push({
        student,
        avg,
        division: r.division,
        position: 0,
        total: 0,
      })
    }

    list.sort((a, b) => b.avg! - a.avg! || a.student.full_name.localeCompare(b.student.full_name))
    const n = list.length
    list.forEach((row, i) => {
      const prev = i > 0 ? list[i - 1] : null
      row.position = prev && row.avg === prev.avg ? prev.position : i + 1
      row.total = n
    })
    return list
  }, [mode, customAudience, students, marks, scopedResults])

  function phoneOf(row: Row): string | null {
    return normalizeTzPhone(phones[row.student.id] ?? '')
  }

  const validRows = rows.filter((r) => phoneOf(r))
  const missingCount = rows.length - validRows.length

  function buildMessage(row: Row): string {
    if (mode === 'custom') return customText.trim()
    return renderTemplate(template, {
      NAME: row.student.full_name,
      FORM: formLabel(row.student.form),
      EXAM: exam?.name ?? '',
      AVG: row.avg != null ? row.avg.toFixed(1) : '',
      DIV: row.division ?? '',
      POS: String(row.position ?? ''),
      TOTAL: String(row.total),
    })
  }

  function toggleAll() {
    if (validRows.length > 0 && selected.size >= validRows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(validRows.map((r) => r.student.id)))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function savePhone(student: Student) {
    const raw = phones[student.id] ?? ''
    if (raw.trim() === student.parent_phone.trim()) return
    setSavingPhone(student.id)
    const { error } = await supabase
      .from('students')
      .update({ parent_phone: raw.trim() })
      .eq('id', student.id)
    if (!error) {
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, parent_phone: raw.trim() } : s)),
      )
    } else {
      setFlash({ type: 'error', text: `Could not save phone number: ${error.message}` })
    }
    setSavingPhone(null)
  }

  async function dispatch(messages: { to: string; text: string }[]) {
    let sent = 0
    const failed: { to: string; error?: string }[] = []
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE)
      try {
        const resp = await sendSmsBatch(chunk)
        sent += resp.sent
        for (const r of resp.results) {
          if (!r.ok) failed.push({ to: r.to ?? '?', error: r.error })
        }
      } catch (err) {
        failed.push({
          to: `${chunk.length} message(s)`,
          error: err instanceof Error ? err.message : 'Request failed',
        })
        break
      }
    }
    if (failed.length === 0) {
      setFlash({ type: 'ok', text: `All messages sent successfully (${sent}/${messages.length}).` })
    } else {
      const firstErr = failed[0]?.error ?? ''
      setFlash({
        type: 'error',
        text: `Sent: ${sent}. Failed: ${failed.length}. ${firstErr}`,
      })
    }
  }

  async function sendSingle(row: Row) {
    const to = phoneOf(row)
    if (!to) {
      setFlash({ type: 'error', text: `Invalid phone number for ${row.student.full_name}.` })
      return
    }
    setSending(true)
    try {
      await dispatch([{ to, text: buildMessage(row) }])
    } finally {
      setSending(false)
    }
  }

  async function sendSelected() {
    const targets = validRows.filter((r) => selected.has(r.student.id))
    if (targets.length === 0) return
    if (mode === 'custom' && !customText.trim()) {
      setFlash({ type: 'error', text: 'Write a message first.' })
      return
    }
    setConfirmBulk(false)
    setSending(true)
    try {
      await dispatch(
        targets.map((r) => ({ to: phoneOf(r) as string, text: buildMessage(r) })),
      )
      setSelected(new Set())
    } finally {
      setSending(false)
    }
  }

  const hasProcessed = results.length > 0
  const selectedValid = validRows.filter((r) => selected.has(r.student.id)).length

  if (loading) {
    return (
      <div className="list-state">
        <Loader2 size={20} className="spin" />
        Loading...
      </div>
    )
  }

  return (
    <div className="sms-page">
      <header className="page-head">
        <h2>Send SMS</h2>
        <p>Send results or announcements to parents — single or bulk (Beem Africa)</p>
      </header>

      {flash && (
        <div className="page-flash">
          <FlashMessage type={flash.type} text={flash.text} onDismiss={() => setFlash(null)} />
        </div>
      )}

      <section className="panel sms-compose">
        <div className="sms-mode-tabs">
          <button
            type="button"
            className={mode === 'auto' ? 'chip active' : 'chip'}
            onClick={() => switchMode('auto')}
          >
            Results message (per student)
          </button>
          <button
            type="button"
            className={mode === 'custom' ? 'chip active' : 'chip'}
            onClick={() => switchMode('custom')}
          >
            Custom message (same for all)
          </button>
        </div>

        {mode === 'auto' && (
          <div className="sms-controls-row">
            <div className="field sms-exam-field">
              <label>Exam</label>
              <select value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">— Select exam —</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
            {examId && !hasProcessed && (
              <span className="sms-hint sms-missing-warn">
                <AlertTriangle size={14} /> Results not processed yet.
              </span>
            )}
          </div>
        )}

        {mode === 'auto' && exam && hasProcessed && (
          <div className="chips-row sms-form-picker">
            {['ALL', ...exam.forms].map((f) => (
              <button
                key={f}
                type="button"
                className={selectedForm === f ? 'chip active' : 'chip'}
                onClick={() => {
                  setSelectedForm(f as Form | 'ALL')
                  setSelectedComboId('ALL')
                  setSelected(new Set())
                }}
              >
                {f === 'ALL' ? 'All classes' : formLabel(f as Form)}
              </button>
            ))}
          </div>
        )}

        {mode === 'custom' && (
          <>
            <div className="chips-row sms-form-picker">
              <button
                type="button"
                className={selectedForm === 'ALL' ? 'chip active' : 'chip'}
                onClick={() => {
                  setSelectedForm('ALL')
                  setSelectedComboId('ALL')
                  setSelected(new Set())
                }}
              >
                All classes
              </button>
              {availableForms.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={selectedForm === f ? 'chip active' : 'chip'}
                  onClick={() => {
                    setSelectedForm(f)
                    setSelectedComboId('ALL')
                    setSelected(new Set())
                  }}
                >
                  {formLabel(f)}
                </button>
              ))}
            </div>
            {(selectedForm === 'F5' || selectedForm === 'F6') && combinations.length > 0 && (
              <div className="chips-row sms-form-picker">
                <button
                  type="button"
                  className={selectedComboId === 'ALL' ? 'chip active' : 'chip'}
                  onClick={() => setSelectedComboId('ALL')}
                >
                  All combinations
                </button>
                {combinations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={selectedComboId === c.id ? 'chip active' : 'chip'}
                    onClick={() => setSelectedComboId(c.id)}
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'auto' ? (
          <div className="field">
            <label>Message template (personalised per student)</label>
            <textarea rows={3} value={template} onChange={(e) => setTemplate(e.target.value)} />
            <small className="sms-hint">
              Placeholders: {'{NAME}'} {'{FORM}'} {'{EXAM}'} {'{AVG}'} {'{DIV}'} {'{POS}'}{' '}
              {'{TOTAL}'}
            </small>
          </div>
        ) : (
          <div className="field">
            <label>Message (sent exactly as written to everyone selected)</label>
            <textarea
              rows={3}
              placeholder="e.g. School closes on Dec 20. Students report back on Jan 13."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
          </div>
        )}
      </section>

      {loadingExam ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Loading students...
        </div>
      ) : mode === 'auto' && examId && !hasProcessed ? (
        <div className="list-state">
          <Database size={22} />
          Results not processed. Process the results first to send result SMS.
        </div>
      ) : (
        <section className="panel">
          <div className="analysis-section-title no-print">
            <span>
              Students ({rows.length}) · Valid phone: {validRows.length}
              {missingCount > 0 && (
                <span className="sms-missing-warn"> · Missing phone: {missingCount}</span>
              )}
            </span>
            <span className="view-toggle">
              <button
                type="button"
                className="signin-btn"
                disabled={sending || selectedValid === 0}
                onClick={() => setConfirmBulk(true)}
              >
                {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                Send to selected ({selectedValid})
              </button>
            </span>
          </div>

          <div className="analysis-table-wrap">
            <table className="analysis-table sms-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={validRows.length > 0 && selected.size >= validRows.length}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th>#</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Parent phone</th>
                  {mode === 'auto' && (
                    <>
                      <th>Avg</th>
                      <th>Div</th>
                      <th>Pos</th>
                    </>
                  )}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const phoneOk = !!phoneOf(row)
                  return (
                    <tr key={row.student.id} className={!phoneOk ? 'sms-row-invalid' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!phoneOk}
                          checked={selected.has(row.student.id)}
                          onChange={() => toggleOne(row.student.id)}
                        />
                      </td>
                      <td>{row.position ?? '-'}</td>
                      <td className="left">{row.student.full_name}</td>
                      <td>{formLabel(row.student.form)}</td>
                      <td>
                        <div className="sms-phone-cell">
                          <input
                            type="tel"
                            className={phoneOk ? '' : 'sms-phone-bad'}
                            value={phones[row.student.id] ?? ''}
                            onChange={(e) =>
                              setPhones((p) => ({ ...p, [row.student.id]: e.target.value }))
                            }
                            onBlur={() => savePhone(row.student)}
                            placeholder="0712..."
                          />
                          {!phoneOk && <Phone size={14} color="#b3261e" />}
                          {savingPhone === row.student.id && <Loader2 size={14} className="spin" />}
                        </div>
                      </td>
                      {mode === 'auto' && (
                        <>
                          <td>{row.avg?.toFixed(1) ?? '-'}</td>
                          <td>{row.division ?? '-'}</td>
                          <td>{row.total > 0 ? `${row.position}/${row.total}` : '-'}</td>
                        </>
                      )}
                      <td>
                        <button
                          type="button"
                          className="signin-btn sms-send-one"
                          disabled={sending || !phoneOk || (mode === 'custom' && !customText.trim())}
                          title={`Send to parent of ${row.student.full_name}`}
                          onClick={() => sendSingle(row)}
                        >
                          <Send size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="list-state">
                        <Users size={20} />
                        No students found for this selection.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {missingCount > 0 && (
            <p className="sms-hint sms-missing-note">
              <AlertTriangle size={14} />
              {missingCount} student(s) have an invalid/missing phone number. Type it in the table
              (e.g. 0712345678) and it saves automatically.
            </p>
          )}
        </section>
      )}

      {confirmBulk && (
        <ConfirmDialog
          title="Send SMS"
          message={`Send ${mode === 'auto' ? 'result messages' : 'this message'} to ${selectedValid} parent(s)? Each message costs one SMS unit.`}
          confirmLabel="Send now"
          onConfirm={sendSelected}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </div>
  )
}
