import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'

export default function FlashMessage({
  type,
  text,
  onDismiss,
  duration = 4000,
}: {
  type: 'ok' | 'error'
  text: string
  onDismiss: () => void
  duration?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [onDismiss, duration])

  return (
    <div className={type === 'ok' ? 'form-alert ok' : 'form-alert'} role="alert">
      {type === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span>{text}</span>
      <button
        type="button"
        className="alert-close"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}
