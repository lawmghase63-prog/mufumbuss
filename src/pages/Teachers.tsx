import { useEffect, useMemo, useState } from 'react'
import {
  UserPlus,
  Users,
  Search,
  Trash2,
  Loader2,
  RefreshCw,
  Database,
  Pencil,
  ListChecks,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import FlashMessage from '../components/FlashMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import TeacherModal from '../components/TeacherModal'
import TeacherAssignModal from '../components/TeacherAssignModal'
import type { Subject } from '../lib/subjects'
import type { Form } from '../lib/students'
import type { Teacher, TeacherAssignment } from '../lib/teachers'

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [flash, setFlash] = useState<{
    type: 'ok' | 'error'
    text: string
  } | null>(null)
  const [query, setQuery] = useState('')

  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [assigning, setAssigning] = useState<Teacher | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    confirmLabel: string
    danger?: boolean
    action: () => void
  } | null>(null)

  async function load() {
    setLoading(true)
    const [teachersRes, assignRes, subjectsRes] = await Promise.all([
      supabase.from('teachers').select('*').order('created_at', { ascending: true }),
      supabase.from('teacher_assignments').select('*'),
      supabase.from('subjects').select('*').order('code', { ascending: true }),
    ])
    if (teachersRes.error) {
      setTableMissing(
        /relation "public\.teachers" does not exist/i.test(teachersRes.error.message),
      )
    } else {
      setTableMissing(false)
      setTeachers((teachersRes.data as Teacher[]) ?? [])
      setAssignments((assignRes.data as TeacherAssignment[]) ?? [])
      setSubjects((subjectsRes.data as Subject[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(
    () => ({
      total: teachers.length,
      male: teachers.filter((t) => t.sex === 'M').length,
      female: teachers.filter((t) => t.sex === 'F').length,
      assignments: assignments.length,
    }),
    [teachers, assignments],
  )

  const assignMap = useMemo(() => {
    const m = new Map<string, { code: string; form: Form }[]>()
    assignments.forEach((a) => {
      const sub = subjects.find((s) => s.id === a.subject_id)
      if (!sub) return
      const arr = m.get(a.teacher_id) ?? []
      arr.push({ code: sub.code, form: a.form })
      m.set(a.teacher_id, arr)
    })
    return m
  }, [assignments, subjects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.phone.includes(q),
    )
  }, [teachers, query])

  function handleDelete(t: Teacher) {
    setConfirm({
      title: 'Delete teacher',
      message: `Delete ${t.full_name}? Teaching assignments will also be removed. Their login account stays but will no longer appear as a teacher.`,
      confirmLabel: 'Delete',
      danger: true,
      action: () => doDelete(t),
    })
  }

  async function doDelete(t: Teacher) {
    const { error } = await supabase.from('teachers').delete().eq('id', t.id)
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: `${t.full_name} deleted.` })
      load()
    }
  }

  return (
    <div className="teachers-page">
      <header className="page-head">
        <h2>Teachers</h2>
      </header>

      <section className="stats-grid">
        <StatCard label="Total Teachers" value={stats.total} />
        <StatCard label="Male" value={stats.male} />
        <StatCard label="Female" value={stats.female} />
        <StatCard label="Teaching Assignments" value={stats.assignments} />
      </section>

      {flash && (
        <div className="page-flash">
          <FlashMessage
            type={flash.type}
            text={flash.text}
            onDismiss={() => setFlash(null)}
          />
        </div>
      )}

      <div className="page-tools">
        <button
          type="button"
          className="signin-btn reg-open"
          onClick={() => setRegisterOpen(true)}
        >
          <UserPlus size={18} />
          Register teacher
        </button>
      </div>

      <section className="panel students-list">
        <div className="list-head">
          <h3>
            <Users size={18} />
            Teachers
            <span className="count-pill">{filtered.length}</span>
          </h3>
          <button
            type="button"
            className="refresh-btn"
            onClick={load}
            aria-label="Refresh list"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="list-tools">
          <div className="input-wrap">
            <Search size={17} className="input-icon" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or phone..."
            />
          </div>
        </div>

        {tableMissing && (
          <FlashMessage
            type="error"
            text="The 'teachers' table is missing in your database. Run the SQL in supabase/schema.sql."
            onDismiss={() => setTableMissing(false)}
          />
        )}

        {loading ? (
          <div className="list-state">
            <Loader2 size={20} className="spin" />
            Loading teachers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="list-state">
            <Database size={22} />
            {query
              ? 'No teachers match your search.'
              : 'No teachers registered yet. Register your first teacher.'}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Sex</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Teaching</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const teach = assignMap.get(t.id) ?? []
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="student-cell">
                          <span className="student-avatar">
                            {t.full_name
                              .split(/\s+/)
                              .filter(Boolean)
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </span>
                          <span className="table-name">{t.full_name}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            t.sex === 'M' ? 'gender-tag male' : 'gender-tag female'
                          }
                        >
                          {t.sex === 'M' ? 'Male' : 'Female'}
                        </span>
                      </td>
                      <td className="mono">{t.email}</td>
                      <td className="mono">{t.phone || '—'}</td>
                      <td>
                        {teach.length === 0 ? (
                          <span className="table-empty">No assignments</span>
                        ) : (
                          <div className="teach-badges">
                            {teach.map((a, i) => (
                              <span key={i} className="teach-badge">
                                <span className="teach-subj">{a.code}</span>
                                <span className="teach-form">{a.form}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="row-act assign"
                          onClick={() => setAssigning(t)}
                          aria-label={`Assign subjects to ${t.full_name}`}
                          title="Teaching assignments"
                        >
                          <ListChecks size={15} />
                        </button>
                        <button
                          type="button"
                          className="row-act"
                          onClick={() => setEditing(t)}
                          aria-label={`Edit ${t.full_name}`}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="row-act row-del"
                          onClick={() => handleDelete(t)}
                          aria-label={`Delete ${t.full_name}`}
                          title="Delete"
                        >
                          <Trash2 size={15} />
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

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={() => {
            const action = confirm.action
            setConfirm(null)
            action()
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {registerOpen && (
        <TeacherModal
          teacher={null}
          onClose={() => setRegisterOpen(false)}
          onSaved={(msg) => {
            setRegisterOpen(false)
            setFlash({ type: 'ok', text: msg })
            load()
          }}
        />
      )}

      {editing && (
        <TeacherModal
          teacher={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null)
            setFlash({ type: 'ok', text: msg })
            load()
          }}
        />
      )}

      {assigning && (
        <TeacherAssignModal
          teacher={assigning}
          onClose={() => setAssigning(null)}
          onSaved={(msg) => {
            setAssigning(null)
            setFlash({ type: 'ok', text: msg })
            load()
          }}
        />
      )}
    </div>
  )
}
