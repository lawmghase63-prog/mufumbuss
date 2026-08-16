import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  CheckCheck,
  ClipboardList,
  Info,
  Users,
  type LucideIcon,
} from 'lucide-react'

interface Notif {
  id: number
  title: string
  body: string
  time: string
  icon: LucideIcon
  read: boolean
}

const INITIAL_NOTIFS: Notif[] = [
  {
    id: 1,
    title: 'Results entry opened',
    body: 'Term II examination results entry is now open for all teachers.',
    time: '2h ago',
    icon: ClipboardList,
    read: false,
  },
  {
    id: 2,
    title: 'Staff meeting',
    body: 'General staff meeting this Friday at 3:00 PM in the staffroom.',
    time: '1d ago',
    icon: Info,
    read: false,
  },
  {
    id: 3,
    title: 'Form I admissions finalised',
    body: 'New student registrations for the coming academic year are complete.',
    time: '3d ago',
    icon: Users,
    read: true,
  },
]

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS)
  const wrapRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter((n) => !n.read).length

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function toggleRead(id: number) {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)),
    )
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="notif-markall" onClick={markAllRead}>
                <CheckCheck size={15} />
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifs.length === 0 ? (
              <p className="notif-empty">You are all caught up.</p>
            ) : (
              notifs.map((n) => {
                const Icon = n.icon
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={n.read ? 'notif-item' : 'notif-item unread'}
                    onClick={() => toggleRead(n.id)}
                  >
                    <span className="notif-icon">
                      <Icon size={16} />
                    </span>
                    <span className="notif-body">
                      <span className="notif-title">{n.title}</span>
                      <span className="notif-text">{n.body}</span>
                      <span className="notif-time">{n.time}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
