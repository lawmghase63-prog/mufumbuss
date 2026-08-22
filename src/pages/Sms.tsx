import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  MessageSquare,
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
  avg: number
  division: string
  position: number
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

  const [phones, setPhones] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'auto' | 'custom'>('auto')
  const [template, setTemplate] = useState(AUTO_TEMPLATE_DEFAULT)
  const [customText, setCustomText] = useState('')
  const [savingPhone, setSavingPhone] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    async function loadExams() {
      setLoading(true)
      const res = await supabase.from('exams').select('*').order('start_date', { ascending: false })
      if (!alive) return
      if (!res.error) setExams((res.data as Exam[]) ?? [])
      setLoading(false)
    }
    loadExams()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!examId) {
      setExam(null)
      setStudents([])
      setMarks([])
      setResults([])
      return
    }
    let alive = true
    async function loadExamData() {
      setLoadingExam(true)
      setSelected(new Set())
      const [examRes, studRes, marksRes, resultsRes, combosRes, scRes] = await Promise.all([
        supabase.from('exams').select('*').eq('id', examId).maybeSingle(),
        supabase.from('students').select('*'),
        supabase.from('exam_marks').select('*').eq('exam_id', examId),
        supabase
          .from('exam_results')
          .select('student_id, form, division')
          .eq('exam_id', examId),
        supabase.from('combinations').select('*'),
        supabase.from('student_combinations').select('student_id, combination_id'),
      ])
      if (!alive) return
      setExam((examRes.data as Exam) ?? null)
      const studs = (studRes.data as Student[]) ?? []
      setStudents(studs.filter((s) => s.status === 'active'))
      setMarks((marksRes.data as ExamMark[]) ?? [])
      setResults((resultsRes.data as ExamResultRow[]) ?? [])
      setCombinations((combosRes.data as Combination[]) ?? [])
      setStudentCombinations((scRes.data as StudentCombination[]) ?? [])
      const initialPhones: Record<string, string> = {}
      for (const s of studs) initialPhones[s.id] = s.parent_phone ?? ''
      setPhones(initialPhones)
      setLoadingExam(false)
    }
    loadExamData()
    return () => {
      alive = false
    }
  }, [examId])

  const scopedResults = useMemo(() => {
    let filtered =
      selectedForm === 'ALL' ? results : results.filter((r) => r.form === selectedForm)
    if (selectedForm !== 'ALL' && selectedComboId !== 'ALL') {
      const ids = new Set(
        studentCombinations
          .filter((sc) => sc.combination_id === selectedComboId)
          .map((sc) => sc.student_id),
      )
      filtered = filtered.filter((r) => ids.has(r.student_id))
    }
    return filtered
  }, [results, selectedForm, selectedComboId, studentCombinations])

  const rows = useMemo<Row[]>(() => {
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

    list.sort((a, b) => b.avg - a.avg || a.student.full_name.localeCompare(b.student.full_name))
    const n = list.length
    list.forEach((row, i) => {
      const prev = i > 0 ? list[i - 1] : null
      row.position = prev && row.avg === prev.avg ? prev.position : i + 1
      row.total = n
    })
    return list
  }, [students, marks, scopedResults])

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
      AVG: row.avg.toFixed(1),
      DIV: row.division,
      POS: String(row.position),
      TOTAL: String(row.total),
    })
  }

  function toggleAll() {
    if (selected.size >= validRows.length && validRows.length > 0) {
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
      setFlash({ type: 'error', text: `Namba ya simu haikuhifadhiwa: ${error.message}` })
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
          to: `${chunk.length} messages`,
          error: err instanceof Error ? err.message : 'Request failed',
        })
        break
      }
    }
    if (failed.length === 0) {
      setFlash({ type: 'ok', text: `SMS zote zimetumwa kikamilifu (${sent}/${messages.length}).` })
    } else {
      const firstErr = failed[0]?.error ?? ''
      setFlash({
        type: 'error',
        text: `Zilizofanikiwa: ${sent}. Zilizoshindikana: ${failed.length}. ${firstErr}`,
      })
    }
  }

  async function sendSingle(row: Row) {
    const to = phoneOf(row)
    if (!to) {
      setFlash({ type: 'error', text: `Namba ya simu ya ${row.student.full_name} si sahihi.` })
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
      setFlash({ type: 'error', text: 'Andika ujumbe kwanza.' })
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
        Loading exams...
      </div>
    )
  }

  return (
    <div className="sms-page">
      <header className="page-head">
        <h2>Send SMS</h2>
        <p>Tuma matokeo kwa wazazi moja moja au kwa pamoja (Beem Africa)</p>
      </header>

      {flash && (
        <div className="page-flash">
          <FlashMessage type={flash.type} text={flash.text} onDismiss={() => setFlash(null)} />
        </div>
      )}

      <section className="panel sms-controls">
        <div className="sms-controls-row">
          <div className="field sms-exam-field">
            <label>Mtihani</label>
            <select value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">— Chagua mtihani —</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          {exam && (
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
                  {f === 'ALL' ? 'Madarasa yote' : formLabel(f as Form)}
                </button>
              ))}
            </div>
          )}
        </div>

        {(selectedForm === 'F5' || selectedForm === 'F6') && combinations.length > 0 && (
          <div className="chips-row sms-form-picker">
            <button
              type="button"
              className={selectedComboId === 'ALL' ? 'chip active' : 'chip'}
              onClick={() => setSelectedComboId('ALL')}
            >
              Combinations zote
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
      </section>

      {loadingExam ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Loading students...
        </div>
      ) : !examId ? (
        <div className="list-state">
          <MessageSquare size={22} />
          Chagua mtihani ili kutuma SMS za matokeo.
        </div>
      ) : !hasProcessed ? (
        <div className="list-state">
          <Database size={22} />
          Matokeo hayajachakatwa. Tafadhali process results kwanza.
        </div>
      ) : (
        <>
          <section className="panel sms-compose">
            <div className="sms-mode-tabs">
              <button
                type="button"
                className={mode === 'auto' ? 'chip active' : 'chip'}
                onClick={() => setMode('auto')}
              >
                Ujumbe wa matokeo (kila mwanafunzi)
              </button>
              <button
                type="button"
                className={mode === 'custom' ? 'chip active' : 'chip'}
                onClick={() => setMode('custom')}
              >
                Ujumbe wa kawaida (wote sawa)
              </button>
            </div>

            {mode === 'auto' ? (
              <div className="field">
                <label>Kigezo cha ujumbe</label>
                <textarea
                  rows={3}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
                <small className="sms-hint">
                  Placeholder: {'{NAME}'} {'{FORM}'} {'{EXAM}'} {'{AVG}'} {'{DIV}'} {'{POS}'}{' '}
                  {'{TOTAL}'}
                </small>
              </div>
            ) : (
              <div className="field">
                <label>Ujumbe (utatumwa kwako wote waliochaguliwa)</label>
                <textarea
                  rows={3}
                  placeholder="Mfano: Shule inafunga Desemba 20. Mwanafunzi afike Januari 13."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                />
              </div>
            )}
          </section>

          <section className="panel">
            <div className="analysis-section-title no-print">
              <span>
                Wanafunzi ({rows.length}) · Wana namba sahihi: {validRows.length}
                {missingCount > 0 && (
                  <span className="sms-missing-warn">
                    {' '}
                    · Hawana namba: {missingCount}
                  </span>
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
                  Tuma kwa walioteuliwa ({selectedValid})
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
                    <th>Jina</th>
                    <th>Darasa</th>
                    <th>Namba ya mzazi</th>
                    <th>Wastani</th>
                    <th>Div</th>
                    <th>Nafasi</th>
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
                        <td>{row.position}</td>
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
                            {savingPhone === row.student.id && (
                              <Loader2 size={14} className="spin" />
                            )}
                          </div>
                        </td>
                        <td>{row.avg.toFixed(1)}</td>
                        <td>{row.division}</td>
                        <td>
                          {row.position}/{row.total}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="signin-btn sms-send-one"
                            disabled={sending || !phoneOk}
                            title={`Tuma kwa ${row.student.full_name}`}
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
                          Hakuna matokeo kwenye darasa hili.
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
                Wanafunzi {missingCount} hawana namba sahihi. Andika namba kwenye jedwali
                (mfano 0712345678) itahifadhika moja kwa moja.
              </p>
            )}
          </section>
        </>
      )}

      {confirmBulk && (
        <ConfirmDialog
          title="Tuma SMS"
          message={`Tuma ${mode === 'auto' ? 'matokeo binafsi' : 'ujumbe huu'} kwa wazazi ${selectedValid}? Gharama ya SMS itakatwa kwa kila ujumbe.`}
          confirmLabel="Tuma sasa"
          onConfirm={sendSelected}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </div>
  )
}
