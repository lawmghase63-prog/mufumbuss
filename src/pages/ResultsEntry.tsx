import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Database,
  Save,
  FlaskConical,
  CheckCheck,
  UserX,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import FlashMessage from '../components/FlashMessage'
import type { Form, Student } from '../lib/students'
import type { Subject, Combination } from '../lib/subjects'
import type { Exam, ExamMark } from '../lib/exams'
import { parseMark } from '../lib/exams'

interface Entry {
  theory: string
  practical: string
  absent: boolean
}

const keyOf = (studentId: string, subjectId: string) => `${studentId}::${subjectId}`

export default function ResultsEntry() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [selectedForm, setSelectedForm] = useState<Form | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [studentCombinations, setStudentCombinations] = useState<{ student_id: string; combination_id: string }[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [ssSet, setSsSet] = useState<Map<string, Set<string>>>(new Map())
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map())

  useEffect(() => {
    async function load() {
      const [examsRes, subjectsRes, studentsRes, ssRes, combosRes, scRes] = await Promise.all([
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
      ])

      setExams((examsRes.data as Exam[]) ?? [])
      setSubjects((subjectsRes.data as Subject[]) ?? [])
      setStudents((studentsRes.data as Student[]) ?? [])
      setCombinations((combosRes.data as Combination[]) ?? [])
      setStudentCombinations((scRes.data as { student_id: string; combination_id: string }[]) ?? [])

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
    setSelectedSubjectId(null)
  }, [selectedExamId]) // eslint-disable-line react-hooks/exhaustive-deps

  const studentsInForm = useMemo(
    () =>
      students
        .filter((s) => s.form === selectedForm)
        .sort((a, b) => a.admission_no.localeCompare(b.admission_no)),
    [students, selectedForm],
  )

  const isALevelForm = selectedForm === 'F5' || selectedForm === 'F6'

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

  const studentSubjectsMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const s of students) {
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
  }, [students, isALevelForm, ssSet, comboByStudentId, subjectIdByCode])

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
    if (subjectsInForm.length === 0) {
      setSelectedSubjectId(null)
    } else if (!subjectsInForm.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjectsInForm[0].id)
    }
  }, [subjectsInForm, selectedSubjectId])

  const subjectStudents = useMemo(() => {
    const map = new Map<string, Student[]>()
    subjectsInForm.forEach((sub) => {
      const list = studentsInForm.filter(
        (s) => studentSubjectsMap.get(s.id)?.has(sub.id),
      )
      map.set(sub.id, list)
    })
    return map
  }, [subjectsInForm, studentsInForm, studentSubjectsMap])

  useEffect(() => {
    if (!selectedExamId) {
      setEntries(new Map())
      return
    }
    paginate(async ({ from, to }) =>
      supabase
        .from('exam_marks')
        .select('*')
        .eq('exam_id', selectedExamId)
        .range(from, to),
    ).then((res) => {
        const next = new Map<string, Entry>()
        ;(res.data as ExamMark[] | null)?.forEach((m) => {
          next.set(keyOf(m.student_id, m.subject_id), {
            theory: String(m.theory),
            practical: m.practical != null ? String(m.practical) : '',
            absent: m.absent,
          })
        })
        setEntries(next)
      })
  }, [selectedExamId])

  const selectedSubject = subjectsInForm.find((s) => s.id === selectedSubjectId) ?? null
  const activeStudents = selectedSubject
    ? (subjectStudents.get(selectedSubject.id) ?? [])
    : []

  const subjectProgress = (subject: Subject) => {
    const list = subjectStudents.get(subject.id) ?? []
    let entered = 0
    list.forEach((s) => {
      const entry = entries.get(keyOf(s.id, subject.id))
      if (entry && (entry.absent || entry.theory.trim() !== '')) entered++
    })
    return { entered, total: list.length }
  }

  const activeProgress = useMemo(
    () =>
      selectedSubject
        ? subjectProgress(selectedSubject)
        : { entered: 0, total: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSubject, entries, subjectStudents],
  )

  function showsPractical(subject: Subject) {
    return !!exam?.has_practical && subject.has_practical
  }

  function setMark(
    subjectId: string,
    studentId: string,
    field: 'theory' | 'practical',
    value: string,
  ) {
    setEntries((prev) => {
      const next = new Map(prev)
      const key = keyOf(studentId, subjectId)
      const cur = next.get(key) ?? { theory: '', practical: '', absent: false }
      next.set(key, { ...cur, [field]: value })
      return next
    })
  }

  function toggleAbsent(subjectId: string, studentId: string) {
    setEntries((prev) => {
      const next = new Map(prev)
      const key = keyOf(studentId, subjectId)
      const cur = next.get(key) ?? { theory: '', practical: '', absent: false }
      const absent = !cur.absent
      next.set(key, {
        theory: absent ? '' : cur.theory,
        practical: absent ? '' : cur.practical,
        absent,
      })
      return next
    })
  }

  function validate(): string[] {
    if (!selectedSubject) return []
    const errors: string[] = []
    const practical = showsPractical(selectedSubject)
    activeStudents.forEach((s) => {
      const entry = entries.get(keyOf(s.id, selectedSubject.id))
      if (!entry || entry.absent) return
      if (entry.theory.trim() !== '') {
        const n = Number(entry.theory)
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          errors.push(
            `Invalid theory mark for ${s.full_name} (${selectedSubject.code}) — use 0 to 100.`,
          )
        }
      }
      if (practical && entry.practical.trim() !== '') {
        const n = Number(entry.practical)
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          errors.push(
            `Invalid practical mark for ${s.full_name} (${selectedSubject.code}) — use 0 to 50.`,
          )
        }
      }
    })
    return errors
  }

  async function handleSave() {
    if (!exam || !selectedSubject || !selectedForm) return
    const errors = validate()
    if (errors.length) {
      setFlash({ type: 'error', text: errors[0] })
      return
    }

    const rows: {
      exam_id: string
      student_id: string
      subject_id: string
      theory: number
      practical: number | null
      absent: boolean
    }[] = []

    const practical = showsPractical(selectedSubject)
    activeStudents.forEach((s) => {
      const entry = entries.get(keyOf(s.id, selectedSubject.id))
      if (!entry) return
      if (entry.absent) {
        rows.push({
          exam_id: exam.id,
          student_id: s.id,
          subject_id: selectedSubject.id,
          theory: 0,
          practical: null,
          absent: true,
        })
        return
      }
      const theory = parseMark(entry.theory)
      const pract = practical ? parseMark(entry.practical) : null
      if (theory === null && pract === null) return
      rows.push({
        exam_id: exam.id,
        student_id: s.id,
        subject_id: selectedSubject.id,
        theory: theory ?? 0,
        practical: pract,
        absent: false,
      })
    })

    if (rows.length === 0) {
      setFlash({ type: 'error', text: 'No marks entered for this subject yet.' })
      return
    }

    setSaving(true)
    setFlash(null)
    const { error } = await supabase
      .from('exam_marks')
      .upsert(rows, { onConflict: 'exam_id,student_id,subject_id' })
    setSaving(false)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({
        type: 'ok',
        text: `Saved ${rows.length} mark${rows.length === 1 ? '' : 's'} for ${selectedSubject.code} — Form ${selectedForm.slice(1)} (${exam.name}).`,
      })
      const res = await paginate(async ({ from, to }) =>
        supabase.from('exam_marks').select('*').eq('exam_id', exam.id).range(from, to),
      )
      const next = new Map<string, Entry>()
      ;(res.data as ExamMark[] | null)?.forEach((m) => {
        next.set(keyOf(m.student_id, m.subject_id), {
          theory: String(m.theory),
          practical: m.practical != null ? String(m.practical) : '',
          absent: m.absent,
        })
      })
      setEntries(next)
    }
  }

  return (
    <div className="mark-entry-page">
      <header className="page-head">
        <h2>Results Entry</h2>
        <p>Enter or correct marks for any class and subject, per exam.</p>
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
          No exams registered yet. Register an exam first so teachers can enter
          marks.
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
                    {selectedForm?.slice(1)} yet. Assign subjects to students
                    first.
                  </div>
                ) : (
                  selectedSubject && (
                    <>
                      <div className="chips-row exam-picker">
                        {subjectsInForm.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            className={
                              sub.id === selectedSubject.id ? 'chip active' : 'chip'
                            }
                            onClick={() => setSelectedSubjectId(sub.id)}
                          >
                            {sub.name}
                            <span>{sub.code}</span>
                          </button>
                        ))}
                      </div>

                      <div className="mark-blocks">
                        <section className="panel mark-block">
                          <div className="mark-block-head">
                            <div className="mark-block-title">
                              <span className="class-subject-code">
                                {selectedSubject.code}
                              </span>
                              <span className="mark-block-name">
                                {selectedSubject.name}
                                <span className="form-tag">
                                  Form {selectedForm?.slice(1)}
                                </span>
                                {showsPractical(selectedSubject) && (
                                  <span className="practical-tag">
                                    <FlaskConical size={12} />
                                    Practical
                                  </span>
                                )}
                              </span>
                            </div>
                            <span
                              className={
                                activeProgress.total > 0 &&
                                activeProgress.entered === activeProgress.total
                                  ? 'count-badge ok'
                                  : 'count-badge neutral'
                              }
                            >
                              {activeProgress.entered}/{activeProgress.total}
                            </span>
                          </div>

                          {activeStudents.length === 0 ? (
                            <div className="list-state small">
                              No students registered for this subject in this
                              class yet.
                            </div>
                          ) : (
                            <div className="table-scroll">
                              <table className="data-table mark-table">
                                <thead>
                                  <tr>
                                    <th>Student</th>
                                    <th className="mark-col">Theory</th>
                                    {showsPractical(selectedSubject) && (
                                      <th className="mark-col">Practical</th>
                                    )}
                                    <th className="mark-col">Absent</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeStudents.map((s) => {
                                    const entry = entries.get(
                                      keyOf(s.id, selectedSubject.id),
                                    )
                                    const absent = entry?.absent ?? false
                                    return (
                                      <tr
                                        key={s.id}
                                        className={absent ? 'row-absent' : ''}
                                      >
                                        <td>
                                          <div className="student-cell">
                                            <span className="student-avatar">
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
                                            {absent && (
                                              <span className="absent-tag">
                                                Absent
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="mark-col">
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            max={100}
                                            className="mark-input"
                                            value={
                                              absent ? '' : (entry?.theory ?? '')
                                            }
                                            placeholder="0-100"
                                            disabled={absent}
                                            onChange={(e) =>
                                              setMark(
                                                selectedSubject.id,
                                                s.id,
                                                'theory',
                                                e.target.value,
                                              )
                                            }
                                          />
                                        </td>
                                        {showsPractical(selectedSubject) && (
                                          <td className="mark-col">
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              min={0}
                                              max={50}
                                              className="mark-input"
                                              value={
                                                absent
                                                  ? ''
                                                  : (entry?.practical ?? '')
                                              }
                                              placeholder="0-50"
                                              disabled={absent}
                                              onChange={(e) =>
                                                setMark(
                                                  selectedSubject.id,
                                                  s.id,
                                                  'practical',
                                                  e.target.value,
                                                )
                                              }
                                            />
                                          </td>
                                        )}
                                        <td className="mark-col">
                                          <button
                                            type="button"
                                            className={
                                              absent ? 'absent-btn on' : 'absent-btn'
                                            }
                                            onClick={() =>
                                              toggleAbsent(
                                                selectedSubject.id,
                                                s.id,
                                              )
                                            }
                                            aria-pressed={absent}
                                          >
                                            <UserX size={14} />
                                            Absent
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
                      </div>

                      <div className="mark-save-bar">
                        <div className="mark-save-info">
                          <CheckCheck size={17} />
                          {activeProgress.entered} of {activeProgress.total} marks
                          entered for {selectedSubject.code}
                        </div>
                        <button
                          type="button"
                          className="signin-btn"
                          onClick={handleSave}
                          disabled={saving || activeProgress.entered === 0}
                        >
                          {saving ? (
                            <>
                              <Loader2 size={18} className="spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save size={18} />
                              Save {selectedSubject.code} marks
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}
