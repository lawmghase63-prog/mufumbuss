import { Link } from 'react-router-dom'
import { CalendarCheck, BarChart3, Users, ArrowRight } from 'lucide-react'
import { useAuth } from '../../lib/auth'
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
        <StatCard label="Active Exams" value="—" />
        <StatCard label="Subjects" value="—" />
        <StatCard label="Classes" value="—" />
        <StatCard label="Results Entered" value="—" />
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
