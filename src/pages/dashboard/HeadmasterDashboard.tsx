import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
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

  const [stats, setStats] = useState({
    totalStudents: 0,
    teachers: 0,
    subjects: 0,
    classes: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      const [students, teachers, subjects, forms] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('teachers').select('id', { count: 'exact', head: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('form').eq('status', 'active'),
      ])

      const uniqueForms = new Set<string>()
      forms.data?.forEach(s => uniqueForms.add(s.form))

      setStats({
        totalStudents: students.count ?? 0,
        teachers: teachers.count ?? 0,
        subjects: subjects.count ?? 0,
        classes: uniqueForms.size,
      })
    }
    fetchStats()
  }, [])

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
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Total Students" value={stats.totalStudents} />
        <StatCard label="Teachers" value={stats.teachers} />
        <StatCard label="Subjects" value={stats.subjects} />
        <StatCard label="Classes" value={stats.classes} />
      </section>
    </>
  )
}
