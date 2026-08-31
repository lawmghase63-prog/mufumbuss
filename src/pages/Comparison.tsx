import { useEffect, useMemo, useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus, Printer, FileDown } from 'lucide-react'
import type { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import type { Exam, ExamMark } from '../lib/exams'
import { subjectTotalMark } from '../lib/exams'
import type { Student, Form } from '../lib/students'
import { FORMS } from '../lib/students'
import type { Subject } from '../lib/subjects'
import type { Combination } from '../lib/subjects'

interface SchoolSettings {
  id: string
  school_name: string
  district: string
  address: string
}

interface StudentCombination {
  student_id: string
  combination_id: string
}

interface SubjectCompare {
  name: string
  code: string
  prevAvg: number
  currAvg: number
  deltaAbs: number
  deltaPct: number | null
}

interface StudentCompare {
  id: string
  name: string
  prevAvg: number
  currAvg: number
  deltaAbs: number
  deltaPct: number | null
}

function formLabel(f: Form): string {
  return `Form ${f.slice(1)}`
}

function pct(deltaPct: number | null): string {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return '—'
  const sign = deltaPct > 0 ? '+' : ''
  return `${sign}${deltaPct.toFixed(1)}%`
}

export default function Comparison() {
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [studentCombinations, setStudentCombinations] = useState<StudentCombination[]>([])

  const [selectedForm, setSelectedForm] = useState<Form | 'ALL'>('ALL')
  const [selectedComboId, setSelectedComboId] = useState<string | 'ALL'>('ALL')
  const [prevExamId, setPrevExamId] = useState('')
  const [currExamId, setCurrExamId] = useState('')

  const [prevMarks, setPrevMarks] = useState<ExamMark[]>([])
  const [currMarks, setCurrMarks] = useState<ExamMark[]>([])
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [downloading, setDownloading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const [examsRes, studsRes, subjRes, combosRes, scRes, settingsRes] = await Promise.all([
        supabase.from('exams').select('*').order('start_date', { ascending: false }),
        supabase.from('students').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('combinations').select('*'),
        supabase.from('student_combinations').select('student_id, combination_id'),
        supabase.from('school_settings').select('*').maybeSingle(),
      ])
      if (!alive) return
      if (!examsRes.error) setExams((examsRes.data as Exam[]) ?? [])
      setStudents(((studsRes.data as Student[]) ?? []).filter((s) => s.status === 'active'))
      setSubjects((subjRes.data as Subject[]) ?? [])
      setCombinations((combosRes.data as Combination[]) ?? [])
      setStudentCombinations((scRes.data as StudentCombination[]) ?? [])
      setSettings((settingsRes.data as SchoolSettings) ?? null)
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const availableForms = useMemo<Form[]>(() => {
    const present = new Set(students.map((s) => s.form))
    return FORMS.filter((f) => present.has(f))
  }, [students])

  const scopedStudents = useMemo(() => {
    let list =
      selectedForm === 'ALL' ? students : students.filter((s) => s.form === selectedForm)
    if ((selectedForm === 'F5' || selectedForm === 'F6') && selectedComboId !== 'ALL') {
      const ids = new Set(
        studentCombinations
          .filter((sc) => sc.combination_id === selectedComboId)
          .map((sc) => sc.student_id),
      )
      list = list.filter((s) => ids.has(s.id))
    }
    return list
  }, [students, selectedForm, selectedComboId, studentCombinations])

  const bothSelected = !!(prevExamId && currExamId && prevExamId !== currExamId)

  useEffect(() => {
    if (!bothSelected) {
      setPrevMarks([])
      setCurrMarks([])
      setError(null)
      return
    }
    let alive = true
    async function loadMarks() {
      setComparing(true)
      setError(null)
      const [prevRes, currRes] = await Promise.all([
        paginate(async ({ from, to }) =>
          supabase.from('exam_marks').select('*').eq('exam_id', prevExamId).range(from, to),
        ),
        paginate(async ({ from, to }) =>
          supabase.from('exam_marks').select('*').eq('exam_id', currExamId).range(from, to),
        ),
      ])
      if (!alive) return
      if (prevRes.error || currRes.error) {
        setError(prevRes.error?.message || currRes.error?.message || 'Failed to load marks.')
        setPrevMarks([])
        setCurrMarks([])
      } else {
        setPrevMarks((prevRes.data as ExamMark[]) ?? [])
        setCurrMarks((currRes.data as ExamMark[]) ?? [])
      }
      setComparing(false)
    }
    loadMarks()
    return () => {
      alive = false
    }
  }, [prevExamId, currExamId, bothSelected])

  function avgByStudent(marksList: ExamMark[], studentIds: Set<string>): Map<string, number> {
    const totals = new Map<string, number[]>()
    for (const m of marksList) {
      if (!studentIds.has(m.student_id)) continue
      const t = subjectTotalMark(m)
      if (t == null) continue
      const arr = totals.get(m.student_id) ?? []
      arr.push(t)
      totals.set(m.student_id, arr)
    }
    const out = new Map<string, number>()
    for (const [id, arr] of totals) out.set(id, arr.reduce((s, t) => s + t, 0) / arr.length)
    return out
  }

  function avgBySubject(marksList: ExamMark[], studentIds: Set<string>): Map<string, { sum: number; count: number }> {
    const acc = new Map<string, { sum: number; count: number }>()
    for (const m of marksList) {
      if (!studentIds.has(m.student_id)) continue
      const t = subjectTotalMark(m)
      if (t == null) continue
      const cur = acc.get(m.subject_id) ?? { sum: 0, count: 0 }
      cur.sum += t
      cur.count += 1
      acc.set(m.subject_id, cur)
    }
    return acc
  }

  function deltaOf(prev: number, curr: number): number | null {
    if (prev <= 0) return null
    return ((curr - prev) / prev) * 100
  }

  const subjectComparison = useMemo<SubjectCompare[]>(() => {
    if (!bothSelected || comparing) return []
    const ids = new Set(scopedStudents.map((s) => s.id))
    const pAvg = avgBySubject(prevMarks, ids)
    const cAvg = avgBySubject(currMarks, ids)
    const out: SubjectCompare[] = []
    for (const sub of subjects) {
      const p = pAvg.get(sub.id)
      const c = cAvg.get(sub.id)
      if (!p || !c) continue
      const pa = p.sum / p.count
      const ca = c.sum / c.count
      out.push({
        name: sub.name,
        code: sub.code,
        prevAvg: pa,
        currAvg: ca,
        deltaAbs: ca - pa,
        deltaPct: deltaOf(pa, ca),
      })
    }
    out.sort((a, b) => (b.deltaPct ?? -Infinity) - (a.deltaPct ?? -Infinity))
    return out
  }, [bothSelected, comparing, scopedStudents, prevMarks, currMarks, subjects])

  const studentComparison = useMemo<StudentCompare[]>(() => {
    if (!bothSelected || comparing) return []
    const ids = new Set(scopedStudents.map((s) => s.id))
    const pAvg = avgByStudent(prevMarks, ids)
    const cAvg = avgByStudent(currMarks, ids)
    const byName = new Map(students.map((s) => [s.id, s.full_name]))
    const out: StudentCompare[] = []
    for (const [id, pa] of pAvg) {
      const ca = cAvg.get(id)
      if (ca == null) continue
      out.push({
        id,
        name: byName.get(id) ?? '',
        prevAvg: pa,
        currAvg: ca,
        deltaAbs: ca - pa,
        deltaPct: deltaOf(pa, ca),
      })
    }
    out.sort((a, b) => (b.deltaPct ?? -Infinity) - (a.deltaPct ?? -Infinity))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothSelected, comparing, scopedStudents, prevMarks, currMarks, students])

  const improved = studentComparison.filter((s) => (s.deltaPct ?? 0) > 0).length
  const declined = studentComparison.filter((s) => (s.deltaPct ?? 0) < 0).length

  const prevExam = exams.find((e) => e.id === prevExamId)
  const currExam = exams.find((e) => e.id === currExamId)

  const GREEN: [number, number, number] = [11, 61, 46]
  const PAGE_W = 210

  function scopeLabel(): string {
    const base = selectedForm === 'ALL' ? 'All Classes' : formLabel(selectedForm)
    if ((selectedForm === 'F5' || selectedForm === 'F6') && selectedComboId !== 'ALL') {
      return `${base} ${combinations.find((c) => c.id === selectedComboId)?.code ?? ''}`.trim()
    }
    return base
  }

  async function downloadPdf() {
    if (!prevExam || !currExam || studentComparison.length === 0) return
    setDownloading(true)
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const schoolName = settings?.school_name || 'Mufumbu Secondary School'
      const district = settings?.district || ''
      const address = settings?.address || ''
      const generated = new Date().toLocaleString()
      const HEADER_H = 40

      const decor = (d: jsPDF, pageNumber: number) => {
        const c = PAGE_W / 2
        d.setFont('helvetica', 'normal')
        d.setFontSize(9)
        let y = 9
        if (district) {
          d.text(district.toUpperCase(), c, y, { align: 'center' })
          y += 6
        }
        d.setFont('helvetica', 'bold')
        d.setFontSize(14)
        d.text(schoolName.toUpperCase(), c, y, { align: 'center' })
        y += 6
        d.setFont('helvetica', 'normal')
        d.setFontSize(9)
        if (address) {
          d.text(address, c, y, { align: 'center' })
          y += 6
        }
        d.setFont('helvetica', 'bold')
        d.setFontSize(10.5)
        d.text(
          `COMPARISON: ${(currExam?.name ?? '').toUpperCase()} vs ${(prevExam?.name ?? '').toUpperCase()}`,
          c,
          y,
          { align: 'center' },
        )
        y += 5.5
        d.setFont('helvetica', 'normal')
        d.setFontSize(9.5)
        d.text(`${scopeLabel()}   |   Students compared: ${studentComparison.length}`, c, y, {
          align: 'center',
        })
        d.setDrawColor(GREEN[0], GREEN[1], GREEN[2])
        d.setLineWidth(0.5)
        d.line(12, y + 3, PAGE_W - 12, y + 3)
        d.setFont('helvetica', 'normal')
        d.setFontSize(8)
        d.setTextColor(120, 120, 120)
        d.text(`Generated: ${generated}`, 12, 292)
        d.text(`Page ${pageNumber}`, PAGE_W - 12, 292, { align: 'right' })
        d.setTextColor(30, 30, 30)
      }

      const base = {
        theme: 'grid' as const,
        margin: { left: 12, right: 12, top: HEADER_H, bottom: 14 },
        headStyles: {
          fillColor: GREEN,
          textColor: 255,
          fontSize: 8.5,
          fontStyle: 'bold' as const,
          halign: 'center' as const,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          textColor: [30, 30, 30] as [number, number, number],
          lineColor: [210, 208, 216] as [number, number, number],
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250] as [number, number, number],
        },
      }

      const finalY = () =>
        (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ??
        HEADER_H

      autoTable(doc, {
        ...base,
        didDrawPage: (data) => decor(data.doc, data.pageNumber),
        startY: HEADER_H,
        head: [['#', 'Subject', 'Previous avg', 'Current avg', 'Change', 'Change %']],
        body: subjectComparison.map((s, i) => [
          String(i + 1),
          `${s.name} (${s.code})`,
          s.prevAvg.toFixed(2),
          s.currAvg.toFixed(2),
          `${s.deltaAbs >= 0 ? '+' : ''}${s.deltaAbs.toFixed(2)}`,
          pct(s.deltaPct),
        ]),
        columnStyles: {
          1: { halign: 'left' as const },
        },
      })

      autoTable(doc, {
        ...base,
        startY: finalY() + 8,
        head: [['#', 'Student', 'Previous avg', 'Current avg', 'Change', 'Change %', 'Trend']],
        body: studentComparison.map((s, i) => {
          const up = (s.deltaPct ?? 0) > 0
          const down = (s.deltaPct ?? 0) < 0
          return [
            String(i + 1),
            s.name,
            s.prevAvg.toFixed(2),
            s.currAvg.toFixed(2),
            `${s.deltaAbs >= 0 ? '+' : ''}${s.deltaAbs.toFixed(2)}`,
            pct(s.deltaPct),
            up ? 'Up' : down ? 'Down' : 'Same',
          ]
        }),
        columnStyles: {
          1: { halign: 'left' as const },
        },
      })

      const safe = (s: string) => (s || 'exam').replace(/[^\w\s-]/g, '')
      doc.save(
        `Comparison_${safe(currExam.name)}_vs_${safe(prevExam.name)}_${scopeLabel().replace(/\s+/g, '')}.pdf`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the PDF.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="list-state">
        <Loader2 size={20} className="spin" />
        Loading...
      </div>
    )
  }

  return (
    <div className="comparison-page">
      <header className="page-head no-print">
        <h2>Exam Comparison</h2>
        <p>Compare a previous exam with the current one — per subject and per student</p>
      </header>

      <section className="panel sms-controls no-print">
        <div className="chips-row sms-form-picker">
          <button
            type="button"
            className={selectedForm === 'ALL' ? 'chip active' : 'chip'}
            onClick={() => {
              setSelectedForm('ALL')
              setSelectedComboId('ALL')
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

        <div className="sms-controls-row">
          <div className="field sms-exam-field">
            <label>Previous exam</label>
            <select value={prevExamId} onChange={(e) => setPrevExamId(e.target.value)}>
              <option value="">— Select previous exam —</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field sms-exam-field">
            <label>Current exam</label>
            <select value={currExamId} onChange={(e) => setCurrExamId(e.target.value)}>
              <option value="">— Select current exam —</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {prevExamId && prevExamId === currExamId && (
          <p className="sms-hint sms-missing-warn">Select two different exams.</p>
        )}
      </section>

      {!bothSelected ? (
        <div className="list-state">
          <TrendingUp size={22} />
          Choose a class, a previous exam and the current exam to compare.
        </div>
      ) : error ? (
        <div className="list-state">{error}</div>
      ) : comparing ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Comparing...
        </div>
      ) : (
        <>
          <div className="page-tools no-print">
            <button type="button" className="signin-btn" onClick={() => window.print()}>
              <Printer size={18} />
              Print
            </button>
            <button
              type="button"
              className="signin-btn"
              disabled={downloading || studentComparison.length === 0}
              onClick={downloadPdf}
            >
              {downloading ? <Loader2 size={18} className="spin" /> : <FileDown size={18} />}
              Download PDF
            </button>
          </div>

          <section className="panel comparison-summary no-print">
            <h3>{`${prevExam?.name ?? ''} → ${currExam?.name ?? ''}`}</h3>
            <p className="sms-hint">
              {scopedStudents.length} students in scope · Improved: {improved} · Declined:{' '}
              {declined} · Unchanged: {studentComparison.length - improved - declined}
            </p>
          </section>

          <div className="print-header">
            <div className="line1">{settings?.district || ''}</div>
            <div className="line2">
              {(settings?.school_name || 'Mufumbu Secondary School').toUpperCase()}
            </div>
            <div className="line3">{settings?.address || ''}</div>
            <div className="line4">{`COMPARISON: ${(currExam?.name ?? '').toUpperCase()} vs ${(prevExam?.name ?? '').toUpperCase()}`}</div>
          </div>

          <section className="panel">
            <div className="analysis-section-title">Subject averages</div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject</th>
                    <th>Previous avg</th>
                    <th>Current avg</th>
                    <th>Change</th>
                    <th>Change %</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectComparison.map((s, i) => (
                    <tr key={s.code}>
                      <td>{i + 1}</td>
                      <td className="left">
                        {s.name} ({s.code})
                      </td>
                      <td>{s.prevAvg.toFixed(2)}</td>
                      <td>{s.currAvg.toFixed(2)}</td>
                      <td className={
                        s.deltaAbs > 0 ? 'cmp-up' : s.deltaAbs < 0 ? 'cmp-down' : ''
                      }>
                        {s.deltaAbs >= 0 ? '+' : ''}
                        {s.deltaAbs.toFixed(2)}
                      </td>
                      <td className={
                        (s.deltaPct ?? 0) > 0 ? 'cmp-up' : (s.deltaPct ?? 0) < 0 ? 'cmp-down' : ''
                      }>
                        {pct(s.deltaPct)}
                      </td>
                    </tr>
                  ))}
                  {subjectComparison.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="list-state small">No common marked subjects found.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="analysis-section-title">
              Per-student change (who went up, who went down)
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Previous avg</th>
                    <th>Current avg</th>
                    <th>Change</th>
                    <th>Change %</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {studentComparison.map((s, i) => {
                    const up = (s.deltaPct ?? 0) > 0
                    const down = (s.deltaPct ?? 0) < 0
                    return (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td className="left">{s.name}</td>
                        <td>{s.prevAvg.toFixed(2)}</td>
                        <td>{s.currAvg.toFixed(2)}</td>
                        <td className={up ? 'cmp-up' : down ? 'cmp-down' : ''}>
                          {s.deltaAbs >= 0 ? '+' : ''}
                          {s.deltaAbs.toFixed(2)}
                        </td>
                        <td className={up ? 'cmp-up' : down ? 'cmp-down' : ''}>
                          {pct(s.deltaPct)}
                        </td>
                        <td>
                          {up ? (
                            <span className="cmp-badge up">
                              <TrendingUp size={14} /> Up
                            </span>
                          ) : down ? (
                            <span className="cmp-badge down">
                              <TrendingDown size={14} /> Down
                            </span>
                          ) : (
                            <span className="cmp-badge flat">
                              <Minus size={14} /> Same
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {studentComparison.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="list-state small">
                          No students sat both exams in this scope.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
