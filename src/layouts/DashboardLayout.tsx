import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
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
  MessageSquare,
  Eye,
  TrendingUp,
  Globe,
  FileUp,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import logo from '../assets/logo.png'
import type { Role } from '../lib/types'

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
      ],
    },
    {
      title: 'Staff Management',
      items: [
        { to: '/headmaster/teachers', label: 'Teachers', icon: UserCog },
      ],
    },
    {
      title: 'Exam Management',
      items: [
        { to: '/headmaster/view-results', label: 'View Results', icon: Eye },
        { to: '/headmaster/reports', label: 'Reports', icon: FileText },
        { to: '/headmaster/comparison', label: 'Comparison', icon: TrendingUp },
      ],
    },
    {
      title: 'Communication',
      items: [
        { to: '/headmaster/joining-instructions', label: 'Joining Instr.', icon: FileUp },
      ],
    },
  ],
  academic: [
    {
      title: 'Main',
      items: [
        { to: '/academic', label: 'Overview', icon: LayoutDashboard },
      ],
    },
    {
      title: 'School Management',
      items: [
        { to: '/academic/students', label: 'Students', icon: Users },
        { to: '/academic/subjects', label: 'Subjects', icon: BookOpen },
        { to: '/academic/assignments', label: 'Assignments', icon: CheckSquare },
      ],
    },
    {
      title: 'Teachers Management',
      items: [
        { to: '/academic/teachers', label: 'Teachers', icon: UserCog },
      ],
    },
    {
      title: 'Exam Management',
      items: [
        { to: '/academic/exams', label: 'Exams', icon: CalendarCheck },
        { to: '/academic/results', label: 'Results Entry', icon: ClipboardList },
        { to: '/academic/reports', label: 'Reports', icon: FileText },
        { to: '/academic/view-results', label: 'View Results', icon: Eye },
        { to: '/academic/comparison', label: 'Comparison', icon: TrendingUp },
        { to: '/academic/sms', label: 'SMS', icon: MessageSquare },
      ],
    },
    {
      title: 'Communication',
      items: [
        { to: '/academic/joining-instructions', label: 'Joining Instr.', icon: FileUp },
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
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const role = user?.profile?.role
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
    setAccountOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!accountOpen) return
    function onDocClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountOpen])

  useEffect(() => {
    if (role) {
      const initial: Record<string, boolean> = {}
      NAV_SECTIONS[role].forEach((section) => {
        initial[section.title] = true
      })
      setOpenGroups(initial)
    }
  }, [role])

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  if (!user?.profile) return null
  const safeRole: Role = role ?? 'teacher'
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
            <img src={logo} alt="School logo" />
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
          {NAV_SECTIONS[safeRole].map((section) => (
            <div className="nav-group" key={section.title}>
              <button
                type="button"
                className="nav-group-title"
                onClick={() => toggleGroup(section.title)}
              >
                <span>{section.title}</span>
                <ChevronDown
                  size={14}
                  className={`group-chevron ${openGroups[section.title] ? 'open' : ''}`}
                />
              </button>
              {openGroups[section.title] &&
                section.items.map((item) => (
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
            <a href="/" className="side-link">
              <Globe size={18} className="side-link-icon" />
              <span className="side-link-label">School Website</span>
            </a>
          </div>
        </nav>

        <div className="side-foot">
          <Link to="/profile" className="user-card">
            <span className="avatar">{initials}</span>
            <div className="user-meta">
              <span className="user-name">{displayName}</span>
              <span className="role-badge">{roleTitle(safeRole)}</span>
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
            <div
              ref={accountRef}
              className={accountOpen ? 'account-menu open' : 'account-menu'}
            >
              <button
                type="button"
                className="account-trigger"
                onClick={() => setAccountOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label="Account menu"
              >
                <span className="avatar topbar-avatar">{initials}</span>
                <ChevronDown size={15} className="account-caret" />
              </button>
              {accountOpen && (
                <div className="account-dropdown" role="menu">
                  <div className="account-dd-head">
                    <span className="avatar dd-avatar">{initials}</span>
                    <div className="account-dd-meta">
                      <strong>{displayName}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                  <NavLink
                    to="/profile"
                    role="menuitem"
                    className="account-dd-item"
                    onClick={() => setAccountOpen(false)}
                  >
                    <UserCircle size={17} />
                    My Profile
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    className="account-dd-item danger"
                    onClick={async () => {
                      setAccountOpen(false)
                      await signOut()
                      navigate('/login', { replace: true })
                    }}
                  >
                    <LogOut size={17} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="dash-main">{children}</main>
      </div>
    </div>
  )
}
