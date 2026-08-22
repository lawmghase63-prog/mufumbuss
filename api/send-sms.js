// Vercel serverless function: secure proxy to Beem Africa SMS API.
// Env vars required (set in Vercel dashboard):
//   BEEM_API_KEY, BEEM_SECRET_KEY, BEEM_SENDER_ID,
//   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY

const BEEM_URL = 'https://api.beem.africa/v1/send-sms'
const ALLOWED_ROLES = new Set(['headmaster', 'academic'])
const MAX_MESSAGES = 500
const CONCURRENCY = 5

function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 12 && digits.startsWith('255')) return digits
  if (digits.length === 10 && digits.startsWith('0')) return `255${digits.slice(1)}`
  if (digits.length === 9 && /^[67]/.test(digits)) return `255${digits}`
  return null
}

async function verifyUser(token, sbUrl, serviceKey) {
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || serviceKey
  const uRes = await fetch(`${sbUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  })
  if (!uRes.ok) return null
  const user = await uRes.json()
  if (!user?.id) return null

  const pRes = await fetch(`${sbUrl}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  if (!pRes.ok) return null
  const rows = await pRes.json()
  const role = rows?.[0]?.role
  return ALLOWED_ROLES.has(role) ? user : null
}

async function sendOne(basic, senderId, idx, to, text) {
  try {
    const res = await fetch(BEEM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify({
        source_addr: senderId,
        encoding: 0,
        message: text,
        recipients: [{ recipient_id: idx + 1, to }],
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { index: idx, ok: false, error: data?.message || `HTTP ${res.status}` }
    }
    if (data && data.successful === false) {
      return { index: idx, ok: false, error: data.status_desc || data.code || 'Rejected by Beem' }
    }
    return { index: idx, ok: true, messageId: data?.message_id ?? null, to }
  } catch (err) {
    return { index: idx, ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.BEEM_API_KEY
  const secretKey = process.env.BEEM_SECRET_KEY
  const senderId = process.env.BEEM_SENDER_ID || 'MUFUMBUSS'

  if (!sbUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured (Supabase)' })
  }
  if (!apiKey || !secretKey) {
    return res.status(500).json({ error: 'SMS provider not configured (Beem keys missing)' })
  }

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) {
    return res.status(401).json({ error: 'Missing session token' })
  }

  let user
  try {
    user = await verifyUser(token, sbUrl, serviceKey)
  } catch {
    return res.status(502).json({ error: 'Auth verification failed' })
  }
  if (!user) {
    return res.status(403).json({ error: 'Not authorized to send SMS' })
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
  if (messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided' })
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `Too many messages (max ${MAX_MESSAGES})` })
  }

  // Normalize + validate all recipients first; reject whole batch on any invalid number
  const prepared = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const to = normalizePhone(m.to)
    const text = typeof m.text === 'string' ? m.text.trim() : ''
    if (!to) {
      return res.status(400).json({ error: `Invalid phone number at position ${i + 1}`, index: i })
    }
    if (!text) {
      return res.status(400).json({ error: `Empty message at position ${i + 1}`, index: i })
    }
    prepared.push({ to, text })
  }

  const basic = Buffer.from(`${apiKey}:${secretKey}`).toString('base64')
  const results = new Array(prepared.length)
  let cursor = 0

  async function worker() {
    for (;;) {
      const idx = cursor++
      if (idx >= prepared.length) return
      const m = prepared[idx]
      results[idx] = await sendOne(basic, senderId, idx, m.to, m.text)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, prepared.length) }, worker))

  const sent = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)

  return res.status(200).json({
    ok: failed.length === 0,
    total: prepared.length,
    sent,
    failed_count: failed.length,
    results,
  })
}
