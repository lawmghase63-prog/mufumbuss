import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserCog,
  ClipboardList,
  CalendarCheck,
  BookOpen,
  PenLine,
  LogOut,
  Menu,
  X,
  UserCircle,
  CheckSquare,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import type { Role } from '../lib/types'
import NotificationsBell from '../components/NotificationsBell'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: Record<Role, NavSection[]> = {
  headmaster: [
    {
      title: 'Main',
      items: [
        { to: '/headmaster', label: 'Overview', icon: LayoutDashboard },
        { to: '/headmaster/students', label: 'Students', icon: Users },
        { to: '/headmaster/subjects', label: 'Subjects', icon: BookOpen },
        { to: '/headmaster/assignments', label: 'Assignments', icon: CheckSquare },
        { to: '/headmaster/teachers', label: 'Teachers', icon: UserCog },
        { to: '/headmaster/exams', label: 'Exams', icon: CalendarCheck },
        { to: '/headmaster/results', label: 'Results', icon: ClipboardList },
        { to: '/headmaster/reports', label: 'Reports', icon: FileText },
      ],
    },
  ],
  academic: [
    {
      title: 'Main',
      items: [
        { to: '/academic', label: 'Overview', icon: LayoutDashboard },
        { to: '/academic/students', label: 'Students', icon: Users },
        { to: '/academic/subjects', label: 'Subjects', icon: BookOpen },
        { to: '/academic/assignments', label: 'Assignments', icon: CheckSquare },
        { to: '/academic/teachers', label: 'Teachers', icon: UserCog },
        { to: '/academic/exams', label: 'Exams', icon: CalendarCheck },
        { to: '/academic/results', label: 'Results Entry', icon: ClipboardList },
        { to: '/academic/reports', label: 'Reports', icon: FileText },
      ],
    },
  ],
  teacher: [
    {
      title: 'Main',
      items: [{ to: '/teacher', label: 'Overview', icon: LayoutDashboard }],
    },
    {
      title: 'Teaching',
      items: [
        { to: '/teacher/my-classes', label: 'My Classes', icon: BookOpen },
        { to: '/teacher/entry', label: 'Enter Results', icon: PenLine },
      ],
    },
  ],
}

function roleTitle(role: Role) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!user?.profile) return null
  const role = user.profile.role
  const displayName = user.profile.full_name || user.email
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="dash">
      <div
        className={open ? 'dash-overlay show' : 'dash-overlay'}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="side-head">
          <div className="side-logo">
            <GraduationCap size={22} />
          </div>
          <div className="side-brand">
            <span className="side-brand-title">Mufumbu S.S.</span>
            <span className="side-brand-subtitle">Results System</span>
          </div>
          <button
            type="button"
            className="side-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="side-nav">
          {NAV_SECTIONS[role].map((section) => (
            <div className="nav-group" key={section.title}>
              <span className="nav-group-title">{section.title}</span>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'side-link active' : 'side-link'
                  }
                >
                  <item.icon size={18} className="side-link-icon" />
                  <span className="side-link-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          <div className="nav-group">
            <span className="nav-group-title">Account</span>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                isActive ? 'side-link active' : 'side-link'
              }
            >
              <UserCircle size={18} className="side-link-icon" />
              <span className="side-link-label">Profile</span>
            </NavLink>
          </div>
        </nav>

        <div className="side-foot">
          <Link to="/profile" className="user-card">
            <span className="avatar">{initials}</span>
            <div className="user-meta">
              <span className="user-name">{displayName}</span>
              <span className="role-badge">{roleTitle(role)}</span>
            </div>
          </Link>
          <button type="button" className="signout-btn" onClick={signOut}>
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="dash-body">
        <header className="topbar">
          <button
            type="button"
            className="topbar-menu"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div className="topbar-title">
            <strong>Mufumbu Secondary School</strong>
            <span>Results Management System</span>
          </div>

          <div className="topbar-actions">
            <NotificationsBell />
            <Link to="/profile" className="avatar-link" aria-label="Profile">
              <span className="avatar topbar-avatar">{initials}</span>
            </Link>
          </div>
        </header>

        <main className="dash-main">{children}</main>
      </div>
    </div>
  )
}
