import { useEffect, useMemo, useState } from 'react'
import { Loader2, Eye, Database, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import FlashMessage from '../components/FlashMessage'
import type { Exam, ExamMark, ResultLevel, Division } from '../lib/exams'
import {
  subjectTotalMark,
  gradeForMark,
  pointsForMark,
} from '../lib/exams'
import type { Student, Form } from '../lib/students'
import type { Subject, SubjectType, Combination } from '../lib/subjects'

interface StudentCombination {
  student_id: string
  combination_id: string
}

interface SchoolSettings {
  school_name: string
  district: string
  address: string
}

interface ExamResultRow {
  student_id: string
  form: Form
  level: ResultLevel
  division: Division
  total_points: number
}

interface Row {
  position: number
  name: string
  sex: string
  avg: number
  grade: string
  pts: number
  division: string
  subjects: string
  subjectsMarks: string
}

interface DivCounts {
  boys: number
  girls: number
  total: number
}

interface SubjectPerf {
  name: string
  code: string
  type: SubjectType
  reg: number
  sat: number
  pass: number
  avg: number
  grade: string
  gpa: number
  competency: string
  counts: Record<string, number>
}

const DIV_KEYS: Division[] = ['I', 'II', 'III', 'IV', '0']

function formLabel(f: Form): string {
  return `Form ${f.slice(1)}`
}

function gradeScaleOf(subjectType: SubjectType): ResultLevel {
  return subjectType === 'o' ? 'o' : 'a'
}

function competencyLabel(avg: number, level: ResultLevel): string {
  if (level === 'a') {
    if (avg >= 80) return 'Excellent'
    if (avg >= 70) return 'Very Good'
    if (avg >= 60) return 'Good'
    if (avg >= 50) return 'Satisfactory'
    if (avg >= 40) return 'Satisfactory (Pass)'
    if (avg >= 35) return 'Subsidiary Pass'
    return 'Fail'
  }
  if (avg >= 75) return 'Excellent'
  if (avg >= 65) return 'Very Good'
  if (avg >= 45) return 'Good'
  if (avg >= 30) return 'Fair'
  return 'Fail'
}

export default function ViewResults() {
  const [loading, setLoading] = useState(true)
  const [loadingExam, setLoadingExam] = useState(false)
  const [exams, setExams] = useState<Exam[]>([])
  const [examId, setExamId] = useState('')
  const [exam, setExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<ExamMark[]>([])
  const [results, setResults] = useState<ExamResultRow[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [studentCombinations, setStudentCombinations] = useState<StudentCombination[]>([])
  const [selectedForm, setSelectedForm] = useState<Form | 'ALL'>('ALL')
  const [selectedComboId, setSelectedComboId] = useState<string | 'ALL'>('ALL')
  const [viewMode, setViewMode] = useState<'marks' | 'grade'>('marks')
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

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
      if (!settingsRes.error) setSettings((settingsRes.data as SchoolSettings | null) ?? null)
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
      setSelectedForm('ALL')
      setSelectedComboId('ALL')
      const [examRes, marksRes, resultsRes] = await Promise.all([
        supabase.from('exams').select('*').eq('id', examId).maybeSingle(),
        paginate(async ({ from, to }) =>
          supabase.from('exam_marks').select('*').eq('exam_id', examId).range(from, to),
        ),
        supabase.from('exam_results').select('*').eq('exam_id', examId),
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

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const scopedResults = useMemo(() => {
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
  }, [results, selectedForm, selectedComboId, studentCombinations])

  const scopedMarks = useMemo(() => {
    const ids = new Set(scopedResults.map((r) => r.student_id))
    return marks.filter((m) => ids.has(m.student_id))
  }, [marks, scopedResults])

  const rows = useMemo<Row[]>(() => {
    const studentById = new Map(students.map((s) => [s.id, s]))
    const marksByStudent = new Map<string, ExamMark[]>()
    for (const m of scopedMarks) {
      const arr = marksByStudent.get(m.student_id) ?? []
      arr.push(m)
      marksByStudent.set(m.student_id, arr)
    }

    const list: Omit<Row, 'position'>[] = []
    for (const r of scopedResults) {
      const student = studentById.get(r.student_id)
      if (!student) continue
      const level = r.level
      const studentMarks = marksByStudent.get(r.student_id) ?? []

      const totals = studentMarks
        .map(subjectTotalMark)
        .filter((t): t is number => t != null)
      const avg = totals.length > 0 ? totals.reduce((s, t) => s + t, 0) / totals.length : 0

      const pts =
        level === 'a'
          ? r.total_points
          : totals
              .slice()
              .sort((a, b) => b - a)
              .slice(0, 7)
              .reduce((s, t) => s + pointsForMark(t, 'o'), 0)

      const subjectParts = studentMarks
        .map((m) => {
          const code = subjectById.get(m.subject_id)?.code ?? '?'
          const total = subjectTotalMark(m)
          if (total == null) return `${code}-ABS`
          const subLevel = gradeScaleOf(subjectById.get(m.subject_id)?.type ?? 'o')
          const g = gradeForMark(total, subLevel) ?? 'F'
          return `${code}-${g}`
        })
        .sort()

      const subjectPartsMarks = studentMarks
        .map((m) => {
          const code = subjectById.get(m.subject_id)?.code ?? '?'
          const total = subjectTotalMark(m)
          if (total == null) return `${code}-ABS`
          return `${code}-${total}`
        })
        .sort()

      list.push({
        name: student.full_name,
        sex: student.gender,
        avg,
        grade: gradeForMark(avg, level) ?? '-',
        pts,
        division: r.division,
        subjects: subjectParts.join(' '),
        subjectsMarks: subjectPartsMarks.join(' '),
      })
    }

    list.sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name))
    const out: Row[] = list.map((r) => ({ ...r, position: 0 }))
    out.forEach((row, i) => {
      const prev = i > 0 ? out[i - 1] : null
      row.position = prev && row.avg === prev.avg ? prev.position : i + 1
    })
    return out
  }, [students, scopedMarks, scopedResults, subjectById])

  const analysis = useMemo(() => {
    if (scopedResults.length === 0) return null

    const studentById = new Map(students.map((s) => [s.id, s]))
    const subjectTypes = new Map<string, SubjectType>(
      subjects.map((s) => [s.id, s.type]),
    )
    const subjectLevel = (subjectId: string): ResultLevel =>
      gradeScaleOf(subjectTypes.get(subjectId) ?? 'o')

    const totalBySubject = new Map<string, number>()
    const gradeCounts = new Map<string, Record<string, number>>()
    const regBySubject = new Map<string, number>()
    const satBySubject = new Map<string, number>()
    const passBySubject = new Map<string, number>()
    const pointsSumBySubject = new Map<string, number>()

    for (const m of scopedMarks) {
      regBySubject.set(m.subject_id, (regBySubject.get(m.subject_id) ?? 0) + 1)
      const total = subjectTotalMark(m)
      if (total == null) continue
      const level = subjectLevel(m.subject_id)
      satBySubject.set(m.subject_id, (satBySubject.get(m.subject_id) ?? 0) + 1)
      totalBySubject.set(m.subject_id, (totalBySubject.get(m.subject_id) ?? 0) + total)
      const grade = gradeForMark(total, level) ?? 'F'
      const counts = gradeCounts.get(m.subject_id) ?? {}
      counts[grade] = (counts[grade] ?? 0) + 1
      gradeCounts.set(m.subject_id, counts)
      if (total >= (level === 'a' ? 35 : 45)) {
        passBySubject.set(m.subject_id, (passBySubject.get(m.subject_id) ?? 0) + 1)
      }
      pointsSumBySubject.set(
        m.subject_id,
        (pointsSumBySubject.get(m.subject_id) ?? 0) + pointsForMark(total, level),
      )
    }

    const subjectPerf: SubjectPerf[] = []
    for (const s of subjects) {
      const reg = regBySubject.get(s.id) ?? 0
      const sat = satBySubject.get(s.id) ?? 0
      if (reg === 0) continue
      const avg = sat > 0 ? (totalBySubject.get(s.id) ?? 0) / sat : 0
      subjectPerf.push({
        name: s.name,
        code: s.code,
        type: s.type,
        reg,
        sat,
        pass: passBySubject.get(s.id) ?? 0,
        avg,
        grade: sat > 0 ? gradeForMark(avg, gradeScaleOf(s.type)) ?? 'F' : '-',
        gpa: sat > 0 ? (pointsSumBySubject.get(s.id) ?? 0) / sat : 0,
        competency: competencyLabel(avg, gradeScaleOf(s.type)),
        counts: gradeCounts.get(s.id) ?? {},
      })
    }
    subjectPerf.sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name))

    const divByGender: Record<Division, DivCounts> = {
      I: { boys: 0, girls: 0, total: 0 },
      II: { boys: 0, girls: 0, total: 0 },
      III: { boys: 0, girls: 0, total: 0 },
      IV: { boys: 0, girls: 0, total: 0 },
      '0': { boys: 0, girls: 0, total: 0 },
    }
    for (const r of scopedResults) {
      const student = studentById.get(r.student_id)
      if (!student) continue
      const d = divByGender[r.division]
      d.total++
      if (student.gender === 'M') d.boys++
      else d.girls++
    }

    const allTotals: number[] = []
    for (const m of scopedMarks) {
      const total = subjectTotalMark(m)
      if (total == null) continue
      allTotals.push(total)
    }
    const schoolAvg = allTotals.length > 0
      ? allTotals.reduce((s, t) => s + t, 0) / allTotals.length
      : 0
    const hasOLevel = scopedResults.some((r) => r.level === 'o')
    const schoolLevel: ResultLevel = hasOLevel ? 'o' : 'a'
    const gpaPerStudent: number[] = []
    for (const r of scopedResults) {
      const level = r.level
      const pts = scopedMarks
        .filter((m) => m.student_id === r.student_id)
        .map(subjectTotalMark)
        .filter((t): t is number => t != null)
        .map((t) => pointsForMark(t, level))
      if (pts.length > 0) {
        gpaPerStudent.push(pts.reduce((s, p) => s + p, 0) / pts.length)
      }
    }
    const schoolGpa =
      gpaPerStudent.length > 0
        ? gpaPerStudent.reduce((s, g) => s + g, 0) / gpaPerStudent.length
        : 0

    const hasALevel = scopedResults.some((r) => r.level === 'a')
    const subjectGradeKeys = hasALevel
      ? ['A', 'B', 'C', 'D', 'E', 'S', 'F']
      : ['A', 'B', 'C', 'D', 'F']

    return {
      divByGender,
      subjectPerf,
      subjectGradeKeys,
      schoolAvg,
      schoolGrade: gradeForMark(schoolAvg, schoolLevel) ?? '-',
      schoolGpa,
    }
  }, [scopedResults, scopedMarks, students, subjects])

  const hasProcessed = results.length > 0

  if (loading) {
    return (
      <div className="list-state">
        <Loader2 size={20} className="spin" />
        Loading...
      </div>
    )
  }

  const schoolName = settings?.school_name || 'Mufumbu Secondary School'

  return (
    <div className="view-results-page analysis-page">
      <header className="page-head">
        <h2>View Results</h2>
        <p>Browse processed results for any exam and class</p>
      </header>

      {flash && (
        <div className="page-flash">
          <FlashMessage type={flash.type} text={flash.text} onDismiss={() => setFlash(null)} />
        </div>
      )}

      {hasProcessed && exam && analysis && (
        <div className="page-tools analysis-tools no-print">
          <button type="button" className="signin-btn" onClick={() => window.print()}>
            <Printer size={18} />
            Print
          </button>
        </div>
      )}

      <section className="panel sms-controls no-print">
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
        </div>
      </section>

      {exam && hasProcessed && (
        <div className="chips-row form-picker no-print">
          {['ALL', ...exam.forms].map((f) => (
            <button
              key={f}
              type="button"
              className={selectedForm === f ? 'chip active' : 'chip'}
              onClick={() => {
                setSelectedForm(f as Form | 'ALL')
                setSelectedComboId('ALL')
              }}
            >
              {f === 'ALL' ? 'All Forms' : formLabel(f as Form)}
            </button>
          ))}
        </div>
      )}

      {(selectedForm === 'F5' || selectedForm === 'F6') &&
        combinations.length > 0 && (
          <div className="chips-row form-picker no-print">
            <button
              type="button"
              className={selectedComboId === 'ALL' ? 'chip active' : 'chip'}
              onClick={() => setSelectedComboId('ALL')}
            >
              All Combinations
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

      <div className="print-header">
        <div className="line1">{settings?.district || ''}</div>
        <div className="line2">{schoolName.toUpperCase()}</div>
        <div className="line3">{settings?.address || ''}</div>
        <div className="line4">{exam?.name.toUpperCase() || ''}</div>
      </div>

      {loadingExam ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Loading results...
        </div>
      ) : !examId ? (
        <div className="list-state">
          <Eye size={22} />
          Select an exam to view its processed results.
        </div>
      ) : !hasProcessed ? (
        <div className="list-state">
          <Database size={22} />
          Results not processed yet for this exam.
        </div>
      ) : rows.length === 0 ? (
        <div className="list-state">
          <Database size={22} />
          No results found for this class.
        </div>
      ) : (
        analysis && (
          <section className="panel">
            <h3 className="screen-school">{schoolName}</h3>
            <h4 className="screen-exam">{exam?.name}</h4>

            <div className="analysis-table-wrap">
              <table className="analysis-table div-table">
                <thead>
                  <tr>
                    <th>Div</th>
                    <th>Boys</th>
                    <th>Girls</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {DIV_KEYS.map((d) => {
                    const c = analysis.divByGender[d]
                    return (
                      <tr key={d}>
                        <td>
                          <strong>{d}</strong>
                        </td>
                        <td>{c.boys}</td>
                        <td>{c.girls}</td>
                        <td>
                          <strong>{c.total}</strong>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="analysis-section-title no-print">
              <span>Results</span>
              <span className="view-toggle">
                <button
                  type="button"
                  className={viewMode === 'marks' ? 'chip active' : 'chip'}
                  onClick={() => setViewMode('marks')}
                >
                  Marks
                </button>
                <button
                  type="button"
                  className={viewMode === 'grade' ? 'chip active' : 'chip'}
                  onClick={() => setViewMode('grade')}
                >
                  Grade
                </button>
              </span>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table results-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>Sex</th>
                    <th>Average</th>
                    <th>Grade</th>
                    <th>Points</th>
                    <th>Div</th>
                    <th>Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.name}-${row.position}`}>
                      <td>{row.position}</td>
                      <td className="left">{row.name}</td>
                      <td>{row.sex}</td>
                      <td>{row.avg.toFixed(2)}</td>
                      <td>{row.grade}</td>
                      <td>{row.pts}</td>
                      <td>{row.division}</td>
                      <td className="left">
                        {viewMode === 'marks' ? row.subjectsMarks : row.subjects}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="analysis-table-wrap">
              <table className="analysis-table school-summary-table">
                <thead>
                  <tr>
                    <th colSpan={2}>School Summary</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="label">Average</td>
                    <td>{analysis.schoolAvg.toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td className="label">Grade</td>
                    <td>{analysis.schoolGrade}</td>
                  </tr>
                  <tr>
                    <td className="label">Students</td>
                    <td>{scopedResults.length}</td>
                  </tr>
                  <tr>
                    <td className="label">School GPA</td>
                    <td>{analysis.schoolGpa.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="analysis-section-title">
              Subject Performance Summary
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table subject-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject</th>
                    {analysis.subjectGradeKeys.map((g) => (
                      <th key={g}>{g}</th>
                    ))}
                    <th>Avg</th>
                    <th>Grade</th>
                    <th>REG</th>
                    <th>SAT</th>
                    <th>PASS</th>
                    <th>GPA</th>
                    <th>Competency</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.subjectPerf.map((s, i) => (
                    <tr key={s.code} className={i % 2 === 1 ? 'stripe' : ''}>
                      <td>{i + 1}</td>
                      <td className="left">{s.name}</td>
                      {analysis.subjectGradeKeys.map((g) => (
                        <td key={g}>{s.counts[g] ?? 0}</td>
                      ))}
                      <td>{s.avg.toFixed(2)}</td>
                      <td>{s.grade}</td>
                      <td>{s.reg}</td>
                      <td>{s.sat}</td>
                      <td>{s.pass}</td>
                      <td>{s.gpa.toFixed(2)}</td>
                      <td>{s.competency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}

      <p className="generated-at">
        Generated: {new Date().toLocaleString()}
      </p>
    </div>
  )
}