export default function StatCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}
