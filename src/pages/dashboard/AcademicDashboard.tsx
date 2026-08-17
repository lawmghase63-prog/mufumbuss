import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, BarChart3, Users, ArrowRight } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import StatCard from '../../components/StatCard'

const TODAY = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function AcademicDashboard() {
  const { user } = useAuth()
  const firstName = user?.profile?.full_name.split(' ')[0] || ''

  const [stats, setStats] = useState({
    activeExams: 0,
    subjects: 0,
    classes: 0,
    resultsEntered: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      const [exams, subjects, forms, marks] = await Promise.all([
        supabase.from('exams').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('form').eq('status', 'active'),
        supabase.from('exam_marks').select('id', { count: 'exact', head: true }),
      ])

      const uniqueForms = new Set<string>()
      forms.data?.forEach(s => uniqueForms.add(s.form))

      setStats({
        activeExams: exams.count ?? 0,
        subjects: subjects.count ?? 0,
        classes: uniqueForms.size,
        resultsEntered: marks.count ?? 0,
      })
    }
    fetchStats()
  }, [])

  return (
    <>
      <section className="welcome-card">
        <div className="welcome-inner">
          <span className="welcome-eyebrow">{TODAY}</span>
          <h2>Welcome, {firstName}</h2>
          <p>
            Manage exams, enter results and analyse performance across all
            classes at Mufumbu S.S.
          </p>
          <div className="quick-actions">
            <Link to="/academic/students" className="action-btn primary">
              <Users size={17} />
              Register Students
            </Link>
            <Link to="/academic/exams" className="action-btn">
              <CalendarCheck size={17} />
              New Exam
            </Link>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Active Exams" value={stats.activeExams} />
        <StatCard label="Subjects" value={stats.subjects} />
        <StatCard label="Classes" value={stats.classes} />
        <StatCard label="Results Entered" value={stats.resultsEntered} />
      </section>

      <section className="panel">
        <h3>Results Management</h3>
        <p className="muted">
          Exam setup, results entry and analysis modules will be built in the
          coming steps.
        </p>
        <div className="quick-actions">
          <Link to="/academic/analysis" className="action-btn">
            <BarChart3 size={17} />
            Performance Analysis
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  )
}
