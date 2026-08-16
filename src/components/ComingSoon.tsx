import { useLocation } from 'react-router-dom'

export default function ComingSoon() {
  const location = useLocation()
  const title = location.pathname.split('/').filter(Boolean).pop() ?? 'Page'
  const label = title
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <section className="panel">
      <h3>{label}</h3>
      <p className="muted">
        This module is coming soon. We will build it step by step.
      </p>
    </section>
  )
}
