import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Database,
  FlaskConical,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import FlashMessage from '../components/FlashMessage'
import type { Form, Student } from '../lib/students'
import type { Subject, Combination } from '../lib/subjects'
import type { Exam } from '../lib/exams'
import type { Teacher } from '../lib/teachers'
import { gradeForMark, subjectTotalMark } from '../lib/exams'

interface RawMark {
  student_id: string
  subject_id: string
  theory: number
  practical: number | null
  absent: boolean
  teacher_id: string | null
}

export default function ResultsEntry() {
  const [loading, setLoading] = useState(true)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<Form | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [studentCombinations, setStudentCombinations] = useState<{ student_id: string; combination_id: string }[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [ssSet, setSsSet] = useState<Map<string, Set<string>>>(new Map())
  const [marks, setMarks] = useState<RawMark[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])

  useEffect(() => {
    async function load() {
      const [examsRes, subjectsRes, studentsRes, ssRes, combosRes, scRes, teachersRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('code', { ascending: true }),
        supabase
          .from('students')
          .select('id, admission_no, full_name, form, status')
          .eq('status', 'active'),
        paginate(async ({ from, to }) =>
          supabase.from('student_subjects').select('student_id, subject_id').range(from, to),
        ),
        supabase.from('combinations').select('*'),
        supabase.from('student_combinations').select('student_id, combination_id'),
        supabase.from('teachers').select('*'),
      ])

      setExams((examsRes.data as Exam[]) ?? [])
      setSubjects((subjectsRes.data as Subject[]) ?? [])
      setStudents((studentsRes.data as Student[]) ?? [])
      setCombinations((combosRes.data as Combination[]) ?? [])
      setStudentCombinations((scRes.data as { student_id: string; combination_id: string }[]) ?? [])
      setTeachers((teachersRes.data as Teacher[]) ?? [])

      const map = new Map<string, Set<string>>()
      ;(ssRes.data as { student_id: string; subject_id: string }[] | null)?.forEach(
        (r) => {
          if (!map.has(r.student_id)) map.set(r.student_id, new Set())
          map.get(r.student_id)!.add(r.subject_id)
        },
      )
      setSsSet(map)

      setSelectedExamId((examsRes.data as Exam[] | null)?.[0]?.id ?? null)
      setLoading(false)
    }
    load()
  }, [])

  const exam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) ?? null,
    [exams, selectedExamId],
  )

  const examForms = useMemo<Form[]>(() => {
    if (!exam) return []
    return (exam.forms as Form[]).sort()
  }, [exam])

  useEffect(() => {
    setSelectedForm(examForms[0] ?? null)
  }, [selectedExamId]) // eslint-disable-line react-hooks/exhaustive-deps

  const subjectIdByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of subjects) map.set(s.code, s.id)
    return map
  }, [subjects])

  const comboByStudentId = useMemo(() => {
    const map = new Map<string, Combination>()
    for (const sc of studentCombinations) {
      const combo = combinations.find((c) => c.id === sc.combination_id)
      if (combo) map.set(sc.student_id, combo)
    }
    return map
  }, [studentCombinations, combinations])

  const isALevelForm = selectedForm === 'F5' || selectedForm === 'F6'

  const studentSubjectsMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const s of students) {
      if (s.form !== selectedForm) continue
      if (isALevelForm) {
        const combo = comboByStudentId.get(s.id)
        if (!combo) continue
        const ids = new Set<string>()
        for (const code of combo.core_subjects) {
          const id = subjectIdByCode.get(code)
          if (id) ids.add(id)
        }
        for (const code of combo.subsidiary_subjects) {
          const id = subjectIdByCode.get(code)
          if (id) ids.add(id)
        }
        map.set(s.id, ids)
      } else {
        map.set(s.id, ssSet.get(s.id) ?? new Set())
      }
    }
    return map
  }, [students, selectedForm, isALevelForm, ssSet, comboByStudentId, subjectIdByCode])

  const studentsInForm = useMemo(
    () =>
      students
        .filter((s) => s.form === selectedForm)
        .sort((a, b) => a.admission_no.localeCompare(b.admission_no)),
    [students, selectedForm],
  )

  const subjectsInForm = useMemo(() => {
    const seen = new Set<string>()
    studentsInForm.forEach((s) => {
      studentSubjectsMap.get(s.id)?.forEach((subjectId) => seen.add(subjectId))
    })
    return subjects
      .filter((sub) => seen.has(sub.id))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [studentsInForm, subjects, studentSubjectsMap])

  useEffect(() => {
    if (!selectedExamId || !selectedForm) {
      setMarks([])
      return
    }
    paginate(async ({ from, to }) =>
      supabase
        .from('exam_marks')
        .select('student_id, subject_id, theory, practical, absent, teacher_id')
        .eq('exam_id', selectedExamId)
        .range(from, to),
    ).then((res) => {
      const all = (res.data as RawMark[] | null) ?? []
      setMarks(all.filter((m) => {
        const student = students.find((s) => s.id === m.student_id)
        return student?.form === selectedForm
      }))
    })
  }, [selectedExamId, selectedForm, students])

  const teacherMap = useMemo(() => {
    const map = new Map<string, Teacher>()
    for (const t of teachers) map.set(t.id, t)
    return map
  }, [teachers])

  const markGrid = useMemo(() => {
    const map = new Map<string, RawMark>()
    for (const m of marks) map.set(`${m.student_id}::${m.subject_id}`, m)
    return map
  }, [marks])

  const subjectSummary = useMemo(() => {
    return subjectsInForm.map((sub) => {
      const enrolled = studentsInForm.filter(
        (s) => studentSubjectsMap.get(s.id)?.has(sub.id),
      )
      const total = enrolled.length
      let entered = 0
      let teacherName: string | null = null
      let teacherId: string | null = null

      for (const s of enrolled) {
        const m = markGrid.get(`${s.id}::${sub.id}`)
        if (m) {
          entered++
          if (!teacherId && m.teacher_id) {
            teacherId = m.teacher_id
            const t = teacherMap.get(m.teacher_id)
            teacherName = t?.full_name ?? null
          }
        }
      }

      const pct = total > 0 ? Math.round((entered / total) * 100) : 0
      const status: 'complete' | 'partial' | 'none' =
        total === 0 ? 'none' : entered === total ? 'complete' : entered > 0 ? 'partial' : 'none'

      return { subject: sub, entered, total, pct, status, teacherName }
    })
  }, [subjectsInForm, studentsInForm, studentSubjectsMap, markGrid, teacherMap])

  const summaryStats = useMemo(() => {
    const completed = subjectSummary.filter((r) => r.status === 'complete').length
    const inProgress = subjectSummary.filter((r) => r.status === 'partial').length
    const pending = subjectSummary.filter((r) => r.status === 'none').length
    return { total: subjectSummary.length, completed, inProgress, pending }
  }, [subjectSummary])

  function showsPractical(subject: Subject) {
    return !!exam?.has_practical && subject.has_practical
  }

  function markDisplay(studentId: string, subjectId: string): string {
    const m = markGrid.get(`${studentId}::${subjectId}`)
    if (!m) return ''
    if (m.absent) return 'ABS'
    const total = subjectTotalMark(m)
    if (total === null) return ''
    const grade = gradeForMark(total, isALevelForm ? 'a' : 'o')
    return `${total}${grade ? ` ${grade}` : ''}`
  }

  function markClass(studentId: string, subjectId: string): string {
    const m = markGrid.get(`${studentId}::${subjectId}`)
    if (!m) return 'mark-cell empty'
    if (m.absent) return 'mark-cell absent'
    return 'mark-cell filled'
  }

  return (
    <div className="mark-entry-page">
      <header className="page-head">
        <h2>View Marks Entry</h2>
        <p>Overview of marks entered per subject and per student, per exam.</p>
      </header>

      {flash && (
        <div className="page-flash">
          <FlashMessage
            type={flash.type}
            text={flash.text}
            onDismiss={() => setFlash(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Loading exams...
        </div>
      ) : exams.length === 0 ? (
        <div className="list-state">
          <Database size={22} />
          No exams registered yet.
        </div>
      ) : (
        <>
          <div className="chips-row exam-picker">
            {exams.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className={ex.id === exam?.id ? 'chip active' : 'chip'}
                onClick={() => setSelectedExamId(ex.id)}
              >
                {ex.name}
                <span>{ex.exam_type === 'test' ? 'Test' : 'Exam'}</span>
              </button>
            ))}
          </div>

          {exam && examForms.length === 0 ? (
            <div className="list-state">
              <Database size={22} />
              This exam has no classes attached.
            </div>
          ) : (
            exam && (
              <>
                <div className="chips-row exam-picker">
                  {examForms.map((form) => (
                    <button
                      key={form}
                      type="button"
                      className={form === selectedForm ? 'chip active' : 'chip'}
                      onClick={() => setSelectedForm(form)}
                    >
                      Form {form.slice(1)}
                    </button>
                  ))}
                </div>

                {subjectsInForm.length === 0 ? (
                  <div className="list-state">
                    <Database size={22} />
                    No students registered in subjects for Form{' '}
                    {selectedForm?.slice(1)} yet.
                  </div>
                ) : (
                  <>
                    <div className="panel marks-overview-panel">
                      <div className="marks-overview-head">
                        <h3>
                          Marks Entry Status — {exam.name} — Form {selectedForm?.slice(1)}
                        </h3>
                        <div className="marks-overview-stats">
                          <span className="ms-stat complete">
                            {summaryStats.completed} Complete
                          </span>
                          <span className="ms-stat partial">
                            {summaryStats.inProgress} In Progress
                          </span>
                          <span className="ms-stat pending">
                            {summaryStats.pending} Pending
                          </span>
                        </div>
                      </div>
                      <div className="table-scroll">
                        <table className="data-table marks-overview-table">
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Subject</th>
                              <th>Teacher</th>
                              <th className="num-col">Entered</th>
                              <th className="num-col">Total</th>
                              <th>Progress</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjectSummary.map((row) => (
                              <tr key={row.subject.id}>
                                <td>
                                  <span className="subject-code-badge">
                                    {row.subject.code}
                                  </span>
                                </td>
                                <td className="subject-name-cell">
                                  {row.subject.name}
                                  {showsPractical(row.subject) && (
                                    <span className="practical-tag">
                                      <FlaskConical size={10} />
                                      Practical
                                    </span>
                                  )}
                                </td>
                                <td className="teacher-name-cell">
                                  {row.teacherName ?? (
                                    <span className="no-teacher">—</span>
                                  )}
                                </td>
                                <td className="num-col">{row.entered}</td>
                                <td className="num-col">{row.total}</td>
                                <td>
                                  <div className="progress-bar-wrap">
                                    <div className="progress-bar-track">
                                      <div
                                        className={`progress-bar-fill ${row.status}`}
                                        style={{ width: `${row.pct}%` }}
                                      />
                                    </div>
                                    <span className="progress-pct">
                                      {row.pct}%
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`status-pill ${row.status}`}>
                                    {row.status === 'complete'
                                      ? 'Complete'
                                      : row.status === 'partial'
                                        ? 'In Progress'
                                        : 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="panel marks-grid-panel">
                      <div className="marks-grid-head">
                        <h3>
                          Student Marks — Form {selectedForm?.slice(1)}
                        </h3>
                        <span className="marks-grid-count">
                          {studentsInForm.length} students
                        </span>
                      </div>
                      <div className="table-scroll marks-grid-scroll">
                        <table className="data-table marks-grid-table">
                          <thead>
                            <tr>
                              <th className="sticky-col">#</th>
                              <th className="sticky-col name-col">Student</th>
                              {subjectsInForm.map((sub) => (
                                <th key={sub.id} className="subj-col">
                                  <span className="grid-subj-code">{sub.code}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {studentsInForm.map((s, idx) => (
                              <tr key={s.id}>
                                <td className="sticky-col row-num">
                                  {idx + 1}
                                </td>
                                <td className="sticky-col name-col">
                                  <div className="student-cell">
                                    <span className="student-avatar-sm">
                                      {s.full_name
                                        .split(/\s+/)
                                        .filter(Boolean)
                                        .map((p) => p[0])
                                        .slice(0, 2)
                                        .join('')
                                        .toUpperCase()}
                                    </span>
                                    <span className="table-name">
                                      {s.full_name}
                                    </span>
                                  </div>
                                </td>
                                {subjectsInForm.map((sub) => (
                                  <td
                                    key={sub.id}
                                    className={markClass(s.id, sub.id)}
                                  >
                                    {markDisplay(s.id, sub.id) || (
                                      <span className="mark-dash">—</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}
