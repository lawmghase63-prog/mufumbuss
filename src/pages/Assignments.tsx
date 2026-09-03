import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Layers,
  Search,
  Loader2,
  RefreshCw,
  Database,
  Users,
  X,
  CheckCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import FlashMessage from '../components/FlashMessage'
import type { Combination, Subject } from '../lib/subjects'
import type { Form, Student } from '../lib/students'

interface Flash {
  type: 'ok' | 'error'
  text: string
}

const O_FORMS: Form[] = ['F1', 'F2', 'F3', 'F4']
const A_FORMS: Form[] = ['F5', 'F6']

export default function Assignments() {
  const [level, setLevel] = useState<'o' | 'a'>('o')
  const [formFilter, setFormFilter] = useState<Form>('F1')
  const [query, setQuery] = useState('')

  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [assignments, setAssignments] = useState<Map<string, Set<string>>>(
    new Map(),
  )
  const [comboAssign, setComboAssign] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [busyCol, setBusyCol] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [studentsRes, subjectsRes, combosRes, saRes, scRes] =
      await Promise.all([
        supabase
          .from('students')
          .select('*')
          .order('admission_no', { ascending: true }),
        supabase.from('subjects').select('*').order('code', { ascending: true }),
        supabase.from('combinations').select('*').order('code', { ascending: true }),
        paginate(async ({ from, to }) =>
          supabase
            .from('student_subjects')
            .select('*')
            .order('id', { ascending: true })
            .range(from, to),
        ),
        supabase.from('student_combinations').select('*'),
      ])

    const missing =
      (studentsRes.error &&
        /relation "public\.students" does not exist/i.test(studentsRes.error.message)) ||
      (saRes.error &&
        /relation "public\.student_subjects" does not exist/i.test(saRes.error.message))
    setTableMissing(!!missing)
    if (!studentsRes.error) setStudents((studentsRes.data as Student[]) ?? [])
    if (!subjectsRes.error) setSubjects((subjectsRes.data as Subject[]) ?? [])
    if (!combosRes.error) setCombinations((combosRes.data as Combination[]) ?? [])
    if (!saRes.error) {
      const map = new Map<string, Set<string>>()
      ;(saRes.data as { student_id: string; subject_id: string }[]).forEach((r) => {
        if (!map.has(r.student_id)) map.set(r.student_id, new Set())
        map.get(r.student_id)!.add(r.subject_id)
      })
      setAssignments(map)
    }
    if (!scRes.error) {
      const map = new Map<string, string>()
      ;(scRes.data as { student_id: string; combination_id: string }[]).forEach(
        (r) => map.set(r.student_id, r.combination_id),
      )
      setComboAssign(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function comboSubjectIds(combo: Combination): string[] {
    const codes = [...combo.core_subjects, ...combo.subsidiary_subjects]
    return subjects.filter((s) => codes.includes(s.code)).map((s) => s.id)
  }

  function switchLevel(l: 'o' | 'a') {
    setLevel(l)
    setFormFilter(l === 'o' ? 'F1' : 'F5')
    setQuery('')
  }

  const levelStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter(
      (s) =>
        s.status === 'active' &&
        s.form === formFilter &&
        (!q ||
          s.full_name.toLowerCase().includes(q) ||
          s.admission_no.toLowerCase().includes(q)),
    )
  }, [students, formFilter, query])

  const oLevelSubjects = useMemo(
    () =>
      subjects.filter(
        (s) => s.type === 'o' && s.forms.includes(formFilter),
      ),
    [subjects, formFilter],
  )

  async function toggleSubject(studentId: string, subjectId: string) {
    const has = assignments.get(studentId)?.has(subjectId) ?? false
    if (has) {
      const { error } = await supabase
        .from('student_subjects')
        .delete()
        .match({ student_id: studentId, subject_id: subjectId })
      if (error) {
        setFlash({ type: 'error', text: error.message })
        return
      }
      setAssignments((prev) => {
        const m = new Map(prev)
        const set = new Set(m.get(studentId) ?? [])
        set.delete(subjectId)
        m.set(studentId, set)
        return m
      })
    } else {
      const { error } = await supabase
        .from('student_subjects')
        .insert({ student_id: studentId, subject_id: subjectId })
      if (error) {
        setFlash({ type: 'error', text: error.message })
        return
      }
      setAssignments((prev) => {
        const m = new Map(prev)
        const set = new Set(m.get(studentId) ?? [])
        set.add(subjectId)
        m.set(studentId, set)
        return m
      })
    }
  }

  async function bulkSubject(subjectId: string, assign: boolean) {
    const subject = subjects.find((s) => s.id === subjectId)
    const target = levelStudents
    setBusyCol(subjectId)
    if (assign) {
      const rows = target
        .filter((s) => !assignments.get(s.id)?.has(subjectId))
        .map((s) => ({ student_id: s.id, subject_id: subjectId }))
      if (rows.length) {
        const { error } = await supabase.from('student_subjects').insert(rows)
        if (error) {
          setBusyCol(null)
          setFlash({ type: 'error', text: error.message })
          return
        }
      }
      setFlash({
        type: 'ok',
        text: `${subject?.code ?? 'Subject'} assigned to ${rows.length} student(s).`,
      })
    } else {
      const ids = target.map((s) => s.id)
      const { error } = await supabase
        .from('student_subjects')
        .delete()
        .eq('subject_id', subjectId)
        .in('student_id', ids)
      if (error) {
        setBusyCol(null)
        setFlash({ type: 'error', text: error.message })
        return
      }
      setFlash({ type: 'ok', text: `${subject?.code ?? 'Subject'} cleared.` })
    }
    setBusyCol(null)
    load()
  }

  async function toggleCombination(studentId: string, combinationId: string) {
    const combo = combinations.find((c) => c.id === combinationId)
    const subjectIds = combo ? comboSubjectIds(combo) : []
    const current = comboAssign.get(studentId)

    if (current === combinationId) {
      const { error } = await supabase
        .from('student_combinations')
        .delete()
        .match({ student_id: studentId, combination_id: combinationId })
      if (error) {
        setFlash({ type: 'error', text: error.message })
        return
      }
      await supabase.from('student_subjects').delete().eq('student_id', studentId)
      setComboAssign((prev) => {
        const m = new Map(prev)
        m.delete(studentId)
        return m
      })
      setAssignments((prev) => {
        const m = new Map(prev)
        m.delete(studentId)
        return m
      })
      return
    }

    if (current) {
      await supabase
        .from('student_combinations')
        .delete()
        .match({ student_id: studentId, combination_id: current })
    }
    const { error } = await supabase
      .from('student_combinations')
      .insert({ student_id: studentId, combination_id: combinationId })
    if (error) {
      setFlash({ type: 'error', text: error.message })
      return
    }
    await supabase.from('student_subjects').delete().eq('student_id', studentId)
    if (subjectIds.length) {
      const { error: subErr } = await supabase
        .from('student_subjects')
        .insert(subjectIds.map((id) => ({ student_id: studentId, subject_id: id })))
      if (subErr) {
        setFlash({ type: 'error', text: subErr.message })
      }
    }
    setComboAssign((prev) => {
      const m = new Map(prev)
      m.set(studentId, combinationId)
      return m
    })
    setAssignments((prev) => {
      const m = new Map(prev)
      m.set(studentId, new Set(subjectIds))
      return m
    })
    if (combo) {
      setFlash({
        type: 'ok',
        text: `${combo.code} assigned — subjects (${combo.core_subjects.join(', ')}${combo.subsidiary_subjects.length ? ` + ${combo.subsidiary_subjects.join(', ')}` : ''}) synced.`,
      })
    }
  }

  async function bulkCombination(combinationId: string, assign: boolean) {
    const combo = combinations.find((c) => c.id === combinationId)
    const subjectIds = combo ? comboSubjectIds(combo) : []
    const target = levelStudents
    setBusyCol(combinationId)
    const ids = target.map((s) => s.id)

    if (assign) {
      await supabase.from('student_combinations').delete().in('student_id', ids)
      await supabase.from('student_subjects').delete().in('student_id', ids)
      const rows = target.map((s) => ({
        student_id: s.id,
        combination_id: combinationId,
      }))
      if (rows.length) {
        const { error } = await supabase
          .from('student_combinations')
          .insert(rows)
        if (error) {
          setBusyCol(null)
          setFlash({ type: 'error', text: error.message })
          load()
          return
        }
      }
      if (subjectIds.length && ids.length) {
        const subRows = ids.flatMap((sid) =>
          subjectIds.map((id) => ({ student_id: sid, subject_id: id })),
        )
        const { error: subErr } = await supabase
          .from('student_subjects')
          .insert(subRows)
        if (subErr) {
          setBusyCol(null)
          setFlash({ type: 'error', text: subErr.message })
          load()
          return
        }
      }
      setFlash({
        type: 'ok',
        text: `${combo?.code ?? 'Combination'} assigned to ${rows.length} student(s) with their subjects.`,
      })
    } else {
      const { error } = await supabase
        .from('student_combinations')
        .delete()
        .in('student_id', ids)
      await supabase.from('student_subjects').delete().in('student_id', ids)
      if (error) {
        setBusyCol(null)
        setFlash({ type: 'error', text: error.message })
        load()
        return
      }
      setFlash({ type: 'ok', text: `${combo?.code ?? 'Combination'} cleared.` })
    }
    setBusyCol(null)
    load()
  }

  const forms = level === 'o' ? O_FORMS : A_FORMS
  const columns = level === 'o' ? oLevelSubjects : combinations

  return (
    <div className="assign-page">
      <header className="page-head">
        <h2>Subject Assignments</h2>
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

      <div className="subj-tabs">
        <button
          type="button"
          className={level === 'o' ? 'subj-tab active' : 'subj-tab'}
          onClick={() => switchLevel('o')}
        >
          <BookOpen size={16} />
          O-Level (F1 - F4)
        </button>
        <button
          type="button"
          className={level === 'a' ? 'subj-tab active' : 'subj-tab'}
          onClick={() => switchLevel('a')}
        >
          <Layers size={16} />
          A-Level Combinations (F5 - F6)
        </button>
      </div>

      <section className="panel">
        <div className="assign-tools">
          <div className="chips-row">
            {forms.map((f) => (
              <button
                key={f}
                type="button"
                className={formFilter === f ? 'chip active' : 'chip'}
                onClick={() => setFormFilter(f)}
              >
                {f}
                <span>
                  {
                    students.filter(
                      (s) => s.status === 'active' && s.form === f,
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>

          <div className="assign-actions">
            <div className="input-wrap assign-search">
              <Search size={17} className="input-icon" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student..."
              />
            </div>
            <button
              type="button"
              className="refresh-btn"
              onClick={load}
              aria-label="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="assign-legend">
          <span>
            <span className="legend-cell on">
              <CheckCheck size={13} />
            </span>
            Assigned
          </span>
          <span>
            <span className="legend-cell">
              <X size={13} />
            </span>
            Not assigned
          </span>
          <span>Click a cell to assign / unassign.</span>
        </div>

        {tableMissing && (
          <FlashMessage
            type="error"
            text="A required table is missing. Run the SQL in supabase/schema.sql."
            onDismiss={() => setTableMissing(false)}
          />
        )}

        {loading ? (
          <div className="list-state">
            <Loader2 size={20} className="spin" />
            Loading assignments...
          </div>
        ) : levelStudents.length === 0 ? (
          <div className="list-state">
            <Users size={22} />
            No active students in {formFilter}.
          </div>
        ) : columns.length === 0 ? (
          <div className="list-state">
            <Database size={22} />
            {level === 'o'
              ? `No O-Level subjects registered for ${formFilter}. Register subjects with this form in Subjects.`
              : 'No combinations registered yet. Register them in Subjects.'}
          </div>
        ) : (
          <div className="assign-scroll">
            <table className="assign-grid">
              <thead>
                <tr>
                  <th className="sticky-col">
                    <span className="col-student">
                      Student
                      <span className="count-pill">{levelStudents.length}</span>
                    </span>
                  </th>
                  {columns.map((col) => {
                    const countAssigned = levelStudents.filter((s) =>
                      level === 'o'
                        ? assignments.get(s.id)?.has((col as Subject).id)
                        : comboAssign.get(s.id) === (col as Combination).id,
                    ).length
                    const allAssigned =
                      countAssigned === levelStudents.length &&
                      levelStudents.length > 0
                    const combo =
                      level === 'a' ? (col as Combination) : null
                    return (
                      <th key={col.id} className="grid-col">
                        <div className="col-top">
                          <span className="col-name">
                            {level === 'o'
                              ? (col as Subject).code
                              : combo!.code}
                          </span>
                          <button
                            type="button"
                            className="col-bulk"
                            onClick={() =>
                              level === 'o'
                                ? bulkSubject((col as Subject).id, !allAssigned)
                                : bulkCombination(combo!.id, !allAssigned)
                            }
                            title={
                              allAssigned
                                ? `Clear for all ${levelStudents.length} students`
                                : `Assign to all ${levelStudents.length} students`
                            }
                          >
                            {busyCol === col.id ? (
                              <Loader2 size={13} className="spin" />
                            ) : allAssigned ? (
                              <X size={13} />
                            ) : (
                              <CheckCheck size={13} />
                            )}
                          </button>
                        </div>
                        {level === 'a' && combo && (
                          <div className="col-subjects">
                            {combo.core_subjects.map((code) => (
                              <span key={code} className="mini-chip on">
                                {code}
                              </span>
                            ))}
                            {combo.subsidiary_subjects.map((code) => (
                              <span key={code} className="mini-chip sub">
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="col-count">
                          {countAssigned}/{levelStudents.length}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {levelStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="sticky-col">
                      <span className="grid-student">
                        <span className="student-avatar">
                          {s.full_name
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span className="student-meta">
                          <span className="table-name">{s.full_name}</span>
                          {level === 'a' &&
                            comboAssign.get(s.id) &&
                            (() => {
                              const combo = combinations.find(
                                (c) => c.id === comboAssign.get(s.id),
                              )
                              if (!combo) return null
                              return (
                                <span className="grid-subjects">
                                  {[
                                    ...combo.core_subjects,
                                    ...combo.subsidiary_subjects,
                                  ].map((code) => (
                                    <span key={code} className="mini-chip on">
                                      {code}
                                    </span>
                                  ))}
                                </span>
                              )
                            })()}
                        </span>
                        <span className="mono grid-adm">{s.admission_no}</span>
                      </span>
                    </td>
                    {columns.map((col) => {
                      const assigned =
                        level === 'o'
                          ? assignments
                              .get(s.id)
                              ?.has((col as Subject).id) ?? false
                          : comboAssign.get(s.id) === (col as Combination).id
                      return (
                        <td key={col.id} className="grid-cell">
                          <button
                            type="button"
                            className={assigned ? 'cell on' : 'cell'}
                            onClick={() =>
                              level === 'o'
                                ? toggleSubject(s.id, (col as Subject).id)
                                : toggleCombination(s.id, (col as Combination).id)
                            }
                            aria-label={
                              assigned
                                ? `Unassign ${level === 'o' ? (col as Subject).name : (col as Combination).code} from ${s.full_name}`
                                : `Assign ${level === 'o' ? (col as Subject).name : (col as Combination).code} to ${s.full_name}`
                            }
                          >
                            {assigned ? (
                              <CheckCheck size={15} />
                            ) : (
                              <X size={15} />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
