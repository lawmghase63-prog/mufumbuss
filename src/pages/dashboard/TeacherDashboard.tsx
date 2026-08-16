import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, PenLine, ArrowRight, CalendarCheck, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import StatCard from '../../components/StatCard'
import type { Teacher, TeacherAssignment } from '../../lib/teachers'
import type { Exam } from '../../lib/exams'

const TODAY = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)

  const firstName = user?.profile?.full_name.split(' ')[0] || ''

  useEffect(() => {
    async function load() {
      if (!user) return
      const teacherRes = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user.id)
      const teacher = (teacherRes.data as Teacher[] | null)?.[0]
      if (teacher) {
        const [{ data }, examsRes] = await Promise.all([
          supabase
            .from('teacher_assignments')
            .select('*')
            .eq('teacher_id', teacher.id),
          supabase
            .from('exams')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false }),
        ])
        setAssignments((data as TeacherAssignment[]) ?? [])
        setExams((examsRes.data as Exam[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [user])

  const classCount = new Set(assignments.map((a) => a.form)).size
  const subjectCount = new Set(assignments.map((a) => a.subject_id)).size

  return (
    <>
      <section className="welcome-card">
        <div className="welcome-inner">
          <span className="welcome-eyebrow">{TODAY}</span>
          <h2>Welcome, {firstName}</h2>
          <p>
            {loading
              ? 'Loading your teaching assignments...'
              : assignments.length === 0
                ? 'No classes assigned yet. Contact the Headmaster or Academic Officer to assign your teaching subjects.'
                : `You are teaching ${subjectCount} subject(s) across ${classCount} class(es). Enter and track results below.`}
          </p>
          <div className="quick-actions">
            <Link to="/teacher/my-classes" className="action-btn primary">
              <BookOpen size={17} />
              My Classes
            </Link>
            <Link to="/teacher/entry" className="action-btn">
              <PenLine size={17} />
              Enter Results
            </Link>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="My Classes" value={loading ? '—' : classCount} />
        <StatCard label="My Subjects" value={loading ? '—' : subjectCount} />
        <StatCard label="Assignments" value={loading ? '—' : assignments.length} />
        <StatCard label="Active Exams" value={loading ? '—' : exams.length} />
      </section>

      <section className="panel">
        <h3>Active Exams</h3>
        {loading ? (
          <div className="list-state">
            <Loader2 size={20} className="spin" />
            Loading exams...
          </div>
        ) : exams.length === 0 ? (
          <p className="muted">
            No active exams right now. When the school registers an exam you will
            see it here and be able to enter marks.
          </p>
        ) : (
          <div className="chips-row">
            {exams.map((exam) => (
              <Link
                key={exam.id}
                to="/teacher/entry"
                className="chip chip-link"
              >
                <CalendarCheck size={15} />
                {exam.name}
                <span>{exam.exam_type === 'test' ? 'Test' : 'Exam'}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="quick-actions">
          <Link to="/teacher/entry" className="action-btn">
            <PenLine size={17} />
            Open Entry Form
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  )
}
