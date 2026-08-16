import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Layers,
  Users,
  Loader2,
  Database,
  GraduationCap,
  School,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import StatCard from '../components/StatCard'
import { FORMS, type Form } from '../lib/students'
import type { Subject } from '../lib/subjects'
import type { Teacher, TeacherAssignment } from '../lib/teachers'

export default function MyClasses() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [formCounts, setFormCounts] = useState<Map<Form, number>>(new Map())

  useEffect(() => {
    async function load() {
      if (!user) return
      const teacherRes = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user.id)
      const myTeacher = (teacherRes.data as Teacher[] | null)?.[0] ?? null
      setTeacher(myTeacher)

      if (myTeacher) {
        const [assignRes, subjectsRes, studentsRes] = await Promise.all([
          supabase
            .from('teacher_assignments')
            .select('*')
            .eq('teacher_id', myTeacher.id),
          supabase.from('subjects').select('*').order('code', { ascending: true }),
          supabase
            .from('students')
            .select('id, form, status')
            .eq('status', 'active'),
        ])
        setAssignments((assignRes.data as TeacherAssignment[]) ?? [])
        setSubjects((subjectsRes.data as Subject[]) ?? [])
        const counts = new Map<Form, number>(FORMS.map((f) => [f, 0]))
        ;(studentsRes.data as { form: Form }[] | null)?.forEach((s) =>
          counts.set(s.form, (counts.get(s.form) ?? 0) + 1),
        )
        setFormCounts(counts)
      }
      setLoading(false)
    }
    load()
  }, [user])

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  )

  const grouped = useMemo(() => {
    const map = new Map<Form, Subject[]>()
    assignments.forEach((a) => {
      const sub = subjectMap.get(a.subject_id)
      if (!sub) return
      const arr = map.get(a.form) ?? []
      arr.push(sub)
      map.set(a.form, arr)
    })
    return map
  }, [assignments, subjectMap])

  const stats = useMemo(() => {
    const uniqueSubjects = new Set(assignments.map((a) => a.subject_id)).size
    let students = 0
    grouped.forEach((_, form) => {
      students += formCounts.get(form) ?? 0
    })
    return {
      classes: grouped.size,
      subjects: uniqueSubjects,
      students,
      pending: '—',
    }
  }, [assignments, grouped, formCounts])

  const firstName = user?.profile?.full_name.split(' ')[0] || ''

  return (
    <div className="my-classes-page">
      <header className="page-head">
        <h2>My Classes</h2>
      </header>

      <section className="stats-grid">
        <StatCard label="My Classes" value={stats.classes} />
        <StatCard label="My Subjects" value={stats.subjects} />
        <StatCard label="Students" value={stats.students} />
        <StatCard label="Pending Entries" value={stats.pending} />
      </section>

      {loading ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
          Loading your classes...
        </div>
      ) : !teacher ? (
        <div className="list-state">
          <School size={22} />
          Your account is not linked to a teacher record yet. Ask the Headmaster
          or Academic Officer to register you as a teacher.
        </div>
      ) : assignments.length === 0 ? (
        <div className="list-state">
          <Database size={22} />
          No classes assigned yet, {firstName}. Ask the Headmaster or Academic
          Officer to assign your teaching subjects.
        </div>
      ) : (
        <div className="class-grid">
          {FORMS.map((form) => {
            const subs = grouped.get(form)
            if (!subs) return null
            return (
              <section key={form} className="panel class-card">
                <div className="class-card-head">
                  <h3>
                    <GraduationCap size={18} />
                    Form {form.slice(1)}
                    <span className="count-pill">{formCounts.get(form) ?? 0}</span>
                  </h3>
                  <span className="class-students">
                    <Users size={14} />
                    {formCounts.get(form) ?? 0} students
                  </span>
                </div>
                <div className="class-subjects">
                  {subs.map((s) => (
                    <div key={s.id} className="class-subject">
                      <span className="class-subject-code">{s.code}</span>
                      <span className="class-subject-name">
                        {s.name}
                        {s.has_practical && (
                          <span className="practical-tag">Practical</span>
                        )}
                      </span>
                      <span className="class-subject-type">
                        {s.type === 'o'
                          ? 'O-Level'
                          : s.type === 'core'
                            ? 'Core'
                            : 'Subsidiary'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <section className="panel">
        <h3>
          <Layers size={18} />
          Subjects I Teach
        </h3>
        {grouped.size === 0 ? (
          <p className="muted">No subjects assigned yet.</p>
        ) : (
          <div className="chips-row">
            {[...new Set(assignments.map((a) => a.subject_id))].map((sid) => {
              const s = subjectMap.get(sid)
              if (!s) return null
              return (
                <span key={sid} className="chip-subject">
                  <BookOpen size={14} />
                  {s.name}
                </span>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
