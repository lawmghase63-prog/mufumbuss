import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Database,
  Save,
  School,
  FlaskConical,
  CheckCheck,
  UserX,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import { useAuth } from '../lib/auth'
import FlashMessage from '../components/FlashMessage'
import type { Form, Student } from '../lib/students'
import type { Subject, Combination } from '../lib/subjects'
import type { Teacher, TeacherAssignment } from '../lib/teachers'
import type { Exam, ExamMark } from '../lib/exams'
import { parseMark } from '../lib/exams'

interface Block {
  subject: Subject
  form: Form
}

interface Entry {
  theory: string
  practical: string
  absent: boolean
}

const keyOf = (studentId: string, subjectId: string) => `${studentId}::${subjectId}`

export default function MarkEntry() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [studentCombinations, setStudentCombinations] = useState<{ student_id: string; combination_id: string }[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [ssSet, setSsSet] = useState<Map<string, Set<string>>>(new Map())
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map())

  useEffect(() => {
    async function load() {
      if (!user) return
      const teacherRes = await supabase.from('teachers').select('*').eq('user_id', user.id)
      const myTeacher = (teacherRes.data as Teacher[] | null)?.[0] ?? null
      setTeacher(myTeacher)

      const [examsRes, subjectsRes, studentsRes, ssRes, combosRes, scRes] = await Promise.all([
        supabase
          .from('exams')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
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

      if (myTeacher) {
        const assignRes = await supabase
          .from('teacher_assignments')
          .select('*')
          .eq('teacher_id', myTeacher.id)
        setAssignments((assignRes.data as TeacherAssignment[]) ?? [])
      }

      setSelectedExamId((examsRes.data as Exam[] | null)?.[0]?.id ?? null)
      setLoading(false)
    }
    load()
  }, [user])

  const exam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) ?? null,
    [exams, selectedExamId],
  )

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  )

  const blocks = useMemo<Block[]>(() => {
    if (!exam) return []
    const seen = new Set<string>()
    const out: Block[] = []
    assignments.forEach((a) => {
      const subject = subjectMap.get(a.subject_id)
      if (!subject) return
      if (!exam.forms.includes(a.form)) return
      const key = `${a.subject_id}::${a.form}`
      if (seen.has(key)) return
      seen.add(key)
      out.push({ subject, form: a.form })
    })
    return out.sort((x, y) =>
      `${x.form} ${x.subject.code}`.localeCompare(`${y.form} ${y.subject.code}`),
    )
  }, [assignments, exam, subjectMap])

  const examSubjects = useMemo(() => {
    const seen = new Set<string>()
    const out: Subject[] = []
    blocks.forEach((b) => {
      if (seen.has(b.subject.id)) return
      seen.add(b.subject.id)
      out.push(b.subject)
    })
    return out.sort((a, b) => a.code.localeCompare(b.code))
  }, [blocks])

  const activeBlocks = useMemo(
    () => blocks.filter((b) => b.subject.id === selectedSubjectId),
    [blocks, selectedSubjectId],
  )

  useEffect(() => {
    if (examSubjects.length === 0) {
      setSelectedSubjectId(null)
    } else if (!examSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(examSubjects[0].id)
    }
  }, [examSubjects, selectedSubjectId])

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
      if (s.form === 'F5' || s.form === 'F6') {
        const combo = comboByStudentId.get(s.id)
        if (!combo) { map.set(s.id, new Set()); continue }
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
  }, [students, ssSet, comboByStudentId, subjectIdByCode])

  const blockStudents = useMemo(() => {
    const map = new Map<string, Student[]>()
    blocks.forEach((block) => {
      const key = `${block.subject.id}::${block.form}`
      const list = students
        .filter((s) => {
          if (s.form !== block.form) return false
          return studentSubjectsMap.get(s.id)?.has(block.subject.id) ?? false
        })
        .sort((a, b) => a.admission_no.localeCompare(b.admission_no))
      map.set(key, list)
    })
    return map
  }, [blocks, students, studentSubjectsMap])

  useEffect(() => {
    if (!selectedExamId || !teacher) {
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
  }, [selectedExamId, teacher])

  const selectedSubject = examSubjects.find((s) => s.id === selectedSubjectId) ?? null

  function showsPractical(subject: Subject) {
    return !!exam?.has_practical && subject.has_practical
  }

  function setMark(
    block: Block,
    studentId: string,
    field: 'theory' | 'practical',
    value: string,
  ) {
    setEntries((prev) => {
      const next = new Map(prev)
      const key = keyOf(studentId, block.subject.id)
      const cur = next.get(key) ?? { theory: '', practical: '', absent: false }
      next.set(key, { ...cur, [field]: value })
      return next
    })
  }

  function toggleAbsent(block: Block, studentId: string) {
    setEntries((prev) => {
      const next = new Map(prev)
      const key = keyOf(studentId, block.subject.id)
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

  const blockProgress = (block: Block) => {
    const list = blockStudents.get(`${block.subject.id}::${block.form}`) ?? []
    let entered = 0
    list.forEach((s) => {
      const entry = entries.get(keyOf(s.id, block.subject.id))
      if (entry && (entry.absent || entry.theory.trim() !== '')) entered++
    })
    return { entered, total: list.length }
  }

  const selectedTotal = useMemo(() => {
    let entered = 0
    let total = 0
    activeBlocks.forEach((block) => {
      const p = blockProgress(block)
      entered += p.entered
      total += p.total
    })
    return { entered, total }
  }, [activeBlocks, entries, blockStudents]) // eslint-disable-line react-hooks/exhaustive-deps

  function validate(): string[] {
    const errors: string[] = []
    activeBlocks.forEach((block) => {
      const list = blockStudents.get(`${block.subject.id}::${block.form}`) ?? []
      const practical = showsPractical(block.subject)
      list.forEach((s) => {
        const entry = entries.get(keyOf(s.id, block.subject.id))
        if (!entry || entry.absent) return
        if (entry.theory.trim() !== '') {
          const n = Number(entry.theory)
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            errors.push(
              `Invalid theory mark for ${s.full_name} (${block.subject.code}) — use 0 to 100.`,
            )
          }
        }
        if (practical && entry.practical.trim() !== '') {
          const n = Number(entry.practical)
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            errors.push(
              `Invalid practical mark for ${s.full_name} (${block.subject.code}) — use 0 to 50.`,
            )
          }
        }
      })
    })
    return errors
  }

  async function handleSave() {
    if (!exam || !teacher || !selectedSubject) return
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
      teacher_id: string
    }[] = []
    const removals: { exam_id: string; student_id: string; subject_id: string }[] = []

    activeBlocks.forEach((block) => {
      const practical = showsPractical(block.subject)
      const list = blockStudents.get(`${block.subject.id}::${block.form}`) ?? []
      const subjectId = block.subject.id
      list.forEach((s) => {
        const key = keyOf(s.id, subjectId)
        const entry = entries.get(key)
        if (!entry) return
        if (entry.absent) {
          rows.push({
            exam_id: exam.id,
            student_id: s.id,
            subject_id: subjectId,
            theory: 0,
            practical: null,
            absent: true,
            teacher_id: teacher.id,
          })
          return
        }
        const theory = parseMark(entry.theory)
        const pract = practical ? parseMark(entry.practical) : null
        if (theory === null && pract === null) {
          removals.push({ exam_id: exam.id, student_id: s.id, subject_id: subjectId })
          return
        }
        rows.push({
          exam_id: exam.id,
          student_id: s.id,
          subject_id: subjectId,
          theory: theory ?? 0,
          practical: pract,
          absent: false,
          teacher_id: teacher.id,
        })
      })
    })

    if (rows.length === 0 && removals.length === 0) {
      setFlash({ type: 'error', text: 'No marks entered for this subject yet.' })
      return
    }

    setSaving(true)
    setFlash(null)

    let upsertError: { message: string } | null = null
    if (rows.length > 0) {
      const { error } = await supabase
        .from('exam_marks')
        .upsert(rows, { onConflict: 'exam_id,student_id,subject_id' })
      upsertError = error as { message: string } | null
    }

    let deleteError: { message: string } | null = null
    if (!upsertError && removals.length > 0) {
      const or = removals.map(
        (r) =>
          `and(exam_id.eq.${r.exam_id},student_id.eq.${r.student_id},subject_id.eq.${r.subject_id})`,
      )
      const { error } = await supabase.from('exam_marks').delete().or(or.join(','))
      deleteError = error as { message: string } | null
    }

    setSaving(false)
    if (upsertError) {
      setFlash({ type: 'error', text: upsertError.message })
    } else if (deleteError) {
      setFlash({ type: 'error', text: deleteError.message })
    } else {
      const parts: string[] = []
      if (rows.length) {
        parts.push(
          `saved ${rows.length} mark${rows.length === 1 ? '' : 's'}`,
        )
      }
      if (removals.length) {
        parts.push(
          `removed ${removals.length} mark${removals.length === 1 ? '' : 's'}`,
        )
      }
      setFlash({
        type: 'ok',
        text: `${parts.join(' and ')} for ${selectedSubject.code} (${exam.name}).`,
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

  const firstName = user?.profile?.full_name.split(' ')[0] || ''

  return (
    <div className="mark-entry-page">
      <header className="page-head">
        <h2>Enter Results</h2>
        <p>Enter marks for the classes and subjects you teach, per active exam.</p>
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
      ) : !teacher ? (
        <div className="list-state">
          <School size={22} />
          Your account is not linked to a teacher record yet. Ask the Headmaster
          or Academic Officer to register you as a teacher.
        </div>
      ) : exams.length === 0 ? (
        <div className="list-state">
          <Database size={22} />
          No active exams yet, {firstName}. When the school registers an exam it
          will appear here for you to enter marks.
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

          {exam && examSubjects.length === 0 ? (
            <div className="list-state">
              <Database size={22} />
              This exam does not cover any of your classes. Ask the Headmaster or
              Academic Officer to assign you to the classes involved.
            </div>
          ) : (
            exam &&
            selectedSubject && (
              <>
                <div className="chips-row exam-picker">
                  {examSubjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={s.id === selectedSubject.id ? 'chip active' : 'chip'}
                      onClick={() => setSelectedSubjectId(s.id)}
                    >
                      {s.name}
                      <span>{s.code}</span>
                    </button>
                  ))}
                </div>

                <div className="mark-blocks">
                  {activeBlocks.map((block) => {
                    const key = `${block.subject.id}::${block.form}`
                    const list = blockStudents.get(key) ?? []
                    const progress = blockProgress(block)
                    const practical = showsPractical(block.subject)
                    return (
                      <section key={key} className="panel mark-block">
                        <div className="mark-block-head">
                          <div className="mark-block-title">
                            <span className="class-subject-code">
                              {block.subject.code}
                            </span>
                            <span className="mark-block-name">
                              {block.subject.name}
                              <span className="form-tag">Form {block.form.slice(1)}</span>
                              {practical && (
                                <span className="practical-tag">
                                  <FlaskConical size={12} />
                                  Practical
                                </span>
                              )}
                            </span>
                          </div>
                          <span
                            className={
                              progress.total > 0 && progress.entered === progress.total
                                ? 'count-badge ok'
                                : 'count-badge neutral'
                            }
                          >
                            {progress.entered}/{progress.total}
                          </span>
                        </div>

                        {list.length === 0 ? (
                          <div className="list-state small">
                            No students registered for this subject in this form yet.
                          </div>
                        ) : (
                          <div className="table-scroll">
                            <table className="data-table mark-table">
                              <thead>
                                <tr>
                                  <th>Student</th>
                                  <th className="mark-col">Theory</th>
                                  {practical && <th className="mark-col">Practical</th>}
                                  <th className="mark-col">Absent</th>
                                </tr>
                              </thead>
                              <tbody>
                                {list.map((s) => {
                                  const entry = entries.get(keyOf(s.id, block.subject.id))
                                  const absent = entry?.absent ?? false
                                  return (
                                    <tr key={s.id} className={absent ? 'row-absent' : ''}>
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
                                          <span className="table-name">{s.full_name}</span>
                                          {absent && <span className="absent-tag">Absent</span>}
                                        </div>
                                      </td>
                                      <td className="mark-col">
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          min={0}
                                          max={100}
                                          className="mark-input"
                                          value={absent ? '' : (entry?.theory ?? '')}
                                          placeholder="0-100"
                                          disabled={absent}
                                          onChange={(e) =>
                                            setMark(block, s.id, 'theory', e.target.value)
                                          }
                                        />
                                      </td>
                                      {practical && (
                                        <td className="mark-col">
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            max={50}
                                            className="mark-input"
                                            value={absent ? '' : (entry?.practical ?? '')}
                                            placeholder="0-50"
                                            disabled={absent}
                                            onChange={(e) =>
                                              setMark(block, s.id, 'practical', e.target.value)
                                            }
                                          />
                                        </td>
                                      )}
                                      <td className="mark-col">
                                        <button
                                          type="button"
                                          className={absent ? 'absent-btn on' : 'absent-btn'}
                                          onClick={() => toggleAbsent(block, s.id)}
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
                    )
                  })}
                </div>

                <div className="mark-save-bar">
                  <div className="mark-save-info">
                    <CheckCheck size={17} />
                    {selectedTotal.entered} of {selectedTotal.total} marks entered
                  </div>
                  <button
                    type="button"
                    className="signin-btn"
                    onClick={handleSave}
                    disabled={saving || selectedTotal.entered === 0}
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
      )}
    </div>
  )
}
