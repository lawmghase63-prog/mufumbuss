import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Role } from '../lib/types'

const ROLE_ROUTES: Record<Role, string> = {
  headmaster: '/headmaster',
  academic: '/academic',
  teacher: '/teacher',
}

export default function ProtectedRoute({
  roles,
  children,
}: {
  roles: Role[]
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!user.profile || !roles.includes(user.profile.role)) {
    return <Navigate to={ROLE_ROUTES[user.profile?.role ?? 'teacher']} replace />
  }

  return <>{children}</>
}
