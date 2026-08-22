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
const accessToken = env['ACEESS TOKEN'] || env['ACCESS TOKEN']

if (!url || !accessToken) {
  console.error('Missing VITE_SUPABASE_URL or access token in .env')
  process.exit(1)
}

const ref = url.replace(/^https?:\/\//, '').split('.')[0]
console.log(`Project ref: ${ref}`)

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data)}`)
  return data
}

const STATEMENTS = [
  `create table if not exists public.joining_instructions (
    id uuid primary key default gen_random_uuid(),
    level text not null check (level in ('O','A')),
    title text not null,
    file_path text not null,
    file_url text not null,
    file_name text,
    mime_type text,
    size_bytes bigint,
    uploaded_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
  )`,
  `alter table public.joining_instructions enable row level security`,
  `drop policy if exists "public read joining instructions" on public.joining_instructions;
   create policy "public read joining instructions" on public.joining_instructions for select using (true)`,
  `drop policy if exists "staff insert joining instructions" on public.joining_instructions;
   create policy "staff insert joining instructions" on public.joining_instructions for insert to authenticated with check (true)`,
  `drop policy if exists "staff delete joining instructions" on public.joining_instructions;
   create policy "staff delete joining instructions" on public.joining_instructions for delete to authenticated using (true)`,
  `insert into storage.buckets (id, name, public) values ('documents','documents', true)
   on conflict (id) do update set public = true`,
  `drop policy if exists "public read documents" on storage.objects;
   create policy "public read documents" on storage.objects for select using (bucket_id = 'documents')`,
  `drop policy if exists "staff upload documents" on storage.objects;
   create policy "staff upload documents" on storage.objects for insert to authenticated with check (bucket_id = 'documents')`,
  `drop policy if exists "staff update documents" on storage.objects;
   create policy "staff update documents" on storage.objects for update to authenticated using (bucket_id = 'documents')`,
  `drop policy if exists "staff delete documents" on storage.objects;
   create policy "staff delete documents" on storage.objects for delete to authenticated using (bucket_id = 'documents')`,
]

for (const sql of STATEMENTS) {
  const label = sql.trim().split(/\s+/).slice(0, 4).join(' ')
  try {
    await query(sql)
    console.log(`OK   ${label}`)
  } catch (err) {
    console.error(`FAIL ${label} -> ${err.message}`)
    process.exitCode = 1
  }
}
