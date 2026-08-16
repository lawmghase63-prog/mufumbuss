import { Link } from 'react-router-dom'
import { Users, UserCog, ClipboardList, BarChart3, ArrowRight } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import StatCard from '../../components/StatCard'

const TODAY = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function HeadmasterDashboard() {
  const { user } = useAuth()
  const firstName = user?.profile?.full_name.split(' ')[0] || ''

  return (
    <>
      <section className="welcome-card">
        <div className="welcome-inner">
          <span className="welcome-eyebrow">{TODAY}</span>
          <h2>Welcome back, {firstName}</h2>
          <p>
            Here is what is happening at Mufumbu S.S. Manage students, teachers
            and academic results all in one place.
          </p>
          <div className="quick-actions">
            <Link to="/headmaster/students" className="action-btn primary">
              <Users size={17} />
              View Students
            </Link>
            <Link to="/headmaster/results" className="action-btn">
              <ClipboardList size={17} />
              Recent Results
            </Link>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Total Students" value="—" />
        <StatCard label="Teachers" value="—" />
        <StatCard label="Subjects" value="—" />
        <StatCard label="Classes" value="—" />
      </section>

      <section className="panel">
        <h3>Quick Access</h3>
        <p className="muted">
          Student, teacher and results modules will be built in the coming steps.
        </p>
        <div className="quick-actions">
          <Link to="/headmaster/teachers" className="action-btn">
            <UserCog size={17} />
            Manage Teachers
          </Link>
          <Link to="/headmaster/reports" className="action-btn">
            <BarChart3 size={17} />
            View Reports
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  )
}
