import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const url = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const USERS = [
  { email: 'headmaster@mufumbu.ac.tz', password: 'Headmaster@123', fullName: 'Headmaster Mufumbu', role: 'headmaster' },
  { email: 'academic@mufumbu.ac.tz', password: 'Academic@123', fullName: 'Academic Officer', role: 'academic' },
  { email: 'teacher@mufumbu.ac.tz', password: 'Teacher@123', fullName: 'Teacher Demo', role: 'teacher' },
  { email: 'erickgeofrey75@gmail.com', password: 'Academic@123', fullName: 'Erick Geofrey', role: 'academic' },
]

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function api(path, method, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`)
  }
  return data
}

async function listAllUsers() {
  const map = new Map()
  let page = 1
  for (;;) {
    const data = await api(`/auth/v1/admin/users?per_page=1000&page=${page}`, 'GET')
    for (const u of data?.users ?? []) map.set(u.email, u)
    if ((data?.users?.length ?? 0) < 1000) break
    page += 1
  }
  return map
}

async function upsertProfile(user, u) {
  const res = await fetch(`${url}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: user.id, full_name: u.fullName, role: u.role }),
  })
  if (!res.ok) {
    throw new Error(`upsert profile -> ${res.status} ${await res.text()}`)
  }
  return res.json()
}

async function main() {
  console.log('Seeding demo users...\n')
  const byEmail = await listAllUsers()

  for (const u of USERS) {
    let user = byEmail.get(u.email)
    if (!user) {
      user = await api('/auth/v1/admin/users', 'POST', {
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      })
      console.log(`CREATED auth user ${u.email} (${user.id})`)
    }

    await upsertProfile(user, u)
    console.log(`OK  ${u.email.padEnd(30)} role: ${u.role}`)
  }

  console.log('\nLogin credentials:')
  console.log('  headmaster@mufumbu.ac.tz / Headmaster@123  -> headmaster')
  console.log('  academic@mufumbu.ac.tz   / Academic@123     -> academic')
  console.log('  teacher@mufumbu.ac.tz    / Teacher@123      -> teacher')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
