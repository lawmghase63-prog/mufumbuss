import { useEffect, useMemo, useState } from 'react'
import { Loader2, Eye, Database } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import FlashMessage from '../components/FlashMessage'
import type { Exam, ExamMark, ResultLevel } from '../lib/exams'
import {
  subjectTotalMark,
  gradeForMark,
  pointsForMark,
} from '../lib/exams'
import type { Student, Form } from '../lib/students'
import type { Subject } from '../lib/subjects'
import type { Combination } from '../lib/subjects'

interface StudentCombination {
  student_id: string
  combination_id: string
}

interface ExamResultRow {
  student_id: string
  form: Form
  level: ResultLevel
  division: string
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
}

function formLabel(f: Form): string {
  return `Form ${f.slice(1)}`
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
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const [examsRes, studsRes, subjRes, combosRes, scRes] = await Promise.all([
        supabase.from('exams').select('*').order('start_date', { ascending: false }),
        supabase.from('students').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('combinations').select('*'),
        supabase.from('student_combinations').select('student_id, combination_id'),
      ])
      if (!alive) return
      if (!examsRes.error) setExams((examsRes.data as Exam[]) ?? [])
      setStudents(((studsRes.data as Student[]) ?? []).filter((s) => s.status === 'active'))
      setSubjects((subjRes.data as Subject[]) ?? [])
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

  const rows = useMemo<Row[]>(() => {
    const studentById = new Map(students.map((s) => [s.id, s]))
    const marksByStudent = new Map<string, ExamMark[]>()
    for (const m of marks) {
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
          const subLevel: ResultLevel = subjectById.get(m.subject_id)?.type === 'o' ? 'o' : 'a'
          const g = gradeForMark(total, subLevel) ?? 'F'
          return `${code}-${g}`
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
      })
    }

    list.sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name))
    const out: Row[] = list.map((r) => ({ ...r, position: 0 }))
    out.forEach((row, i) => {
      const prev = i > 0 ? out[i - 1] : null
      row.position = prev && row.avg === prev.avg ? prev.position : i + 1
    })
    return out
  }, [students, marks, scopedResults, subjectById])

  const hasProcessed = results.length > 0

  if (loading) {
    return (
      <div className="list-state">
        <Loader2 size={20} className="spin" />
        Loading...
      </div>
    )
  }

  return (
    <div className="view-results-page">
      <header className="page-head">
        <h2>View Results</h2>
        <p>Browse processed results for any exam and class</p>
      </header>

      {flash && (
        <div className="page-flash">
          <FlashMessage type={flash.type} text={flash.text} onDismiss={() => setFlash(null)} />
        </div>
      )}

      <section className="panel sms-controls">
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

        {exam && hasProcessed && (
          <div className="chips-row sms-form-picker">
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
                {f === 'ALL' ? 'All classes' : formLabel(f as Form)}
              </button>
            ))}
          </div>
        )}

        {(selectedForm === 'F5' || selectedForm === 'F6') &&
          combinations.length > 0 && (
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
      </section>

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
        <section className="panel">
          <h3 className="screen-exam">{exam?.name}</h3>
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
                    <td className="left">{row.subjects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
