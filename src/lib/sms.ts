import { supabase } from './supabase'

export interface OutgoingSms {
  to: string
  text: string
}

export interface SmsResult {
  index: number
  ok: boolean
  error?: string
  messageId?: string | null
  to?: string
}

export interface SmsBatchResponse {
  ok: boolean
  total: number
  sent: number
  failed_count: number
  results: SmsResult[]
}

export function normalizeTzPhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 12 && digits.startsWith('255')) return digits
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`
  if (digits.length === 9 && /^[67]/.test(digits)) return `255${digits}`
  return null
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizeTzPhone(phone)
  if (!n) return phone || '—'
  return `+${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`
}

export const AUTO_TEMPLATE_DEFAULT =
  'Mufumbu SS: Results of {EXAM} for {NAME} ({FORM}): Average {AVG}%, Division {DIV}, Position {POS} out of {TOTAL}. Thank you.'

export interface TemplateVars {
  NAME: string
  FORM: string
  EXAM: string
  AVG: string
  DIV: string
  POS: string
  TOTAL: string
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(NAME|FORM|EXAM|AVG|DIV|POS|TOTAL)\}/g, (_, key: keyof TemplateVars) =>
    (vars[key] ?? '').toString(),
  )
}

export async function sendSmsBatch(messages: OutgoingSms[]): Promise<SmsBatchResponse> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Session expired. Please sign in again.')

  const res = await fetch('/api/send-sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || `SMS request failed (HTTP ${res.status})`)
  }
  return data as SmsBatchResponse
}
