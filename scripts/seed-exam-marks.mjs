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

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function req(path, method, body, prefer) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`)
  }
  return data
}

const EXAM_NAME = 'Annual Examination 2026'
const EXAM_FORMS = ['F1', 'F2', 'F3', 'F4']
const SUBJECT_CODES = ['ENG', 'MATH', 'GEO', 'CHEM', 'PHY', 'HST', 'CIV', 'BST']

// Deterministic pseudo-random so re-runs give identical marks.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260817)
const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min

function gradeForMark(mark) {
  if (mark >= 75) return 'A'
  if (mark >= 65) return 'B'
  if (mark >= 45) return 'C'
  if (mark >= 30) return 'D'
  return 'F'
}

function oLevelDivision(dBelow) {
  if (dBelow <= 1) return 'I'
  if (dBelow <= 3) return 'II'
  if (dBelow === 4) return 'III'
  if (dBelow === 5) return 'IV'
  return '0'
}

function subjectTotalMark(entry) {
  if (entry.absent) return null
  const theory = Number(entry.theory)
  if (!Number.isFinite(theory)) return null
  if (entry.practical != null) {
    return Math.round(((theory + Number(entry.practical)) / 150) * 100)
  }
  return Math.round(theory)
}

async function main() {
  console.log('Seeding exam + marks...\n')

  // 1. Register the exam (reuse existing with same name if present)
  const existing = await req(
    `/rest/v1/exams?name=eq.${encodeURIComponent(EXAM_NAME)}&select=id`,
    'GET',
  )
  let examId = existing?.[0]?.id ?? null
  if (!examId) {
    const created = await req(
      '/rest/v1/exams',
      'POST',
      {
        name: EXAM_NAME,
        exam_type: 'exam',
        start_date: '2026-08-17',
        end_date: '2026-08-28',
        forms: EXAM_FORMS,
        has_practical: true,
        status: 'active',
      },
      'return=representation',
    )
    examId = created[0].id
    console.log(`Exam created: ${EXAM_NAME} (${examId})`)
  } else {
    console.log(`Exam already exists, reusing: ${EXAM_NAME} (${examId})`)
  }

  // 2. Load subjects + students
  const subjects = await req(
    `/rest/v1/subjects?code=in.(${SUBJECT_CODES.map((c) => `"${c}"`).join(',')})&select=id,code,has_practical`,
    'GET',
  )
  const students = await req(
    `/rest/v1/students?form=in.(${EXAM_FORMS.map((f) => `"${f}"`).join(',')})&select=id,admission_no,full_name,form`,
    'GET',
  )
  console.log(`Subjects: ${subjects.length}, Students: ${students.length}`)

  // 3. Generate marks
  const marks = []
  for (const st of students) {
    for (const sub of subjects) {
      const hasPractical = sub.has_practical
      marks.push({
        exam_id: examId,
        student_id: st.id,
        subject_id: sub.id,
        theory: ri(28, 98),
        practical: hasPractical ? ri(14, 49) : null,
        absent: false,
        teacher_id: null,
      })
    }
  }
  await req(
    '/rest/v1/exam_marks?on_conflict=exam_id,student_id,subject_id',
    'POST',
    marks,
    'resolution=merge-duplicates',
  )
  console.log(`Marks inserted: ${marks.length} (${students.length} students x ${subjects.length} subjects)`)

  // 4. Compute + store exam results (O-Level division, best 7)
  const byStudent = new Map()
  for (const m of marks) {
    const arr = byStudent.get(m.student_id) ?? []
    arr.push({ subject_id: m.subject_id, theory: m.theory, practical: m.practical, absent: m.absent })
    byStudent.set(m.student_id, arr)
  }

  const rows = []
  for (const st of students) {
    const totals = byStudent
      .get(st.id)
      .map((e) => ({ id: e.subject_id, total: subjectTotalMark(e) }))
      .filter((r) => r.total != null)
    if (totals.length === 0) continue
    const best = [...totals].sort((a, b) => b.total - a.total).slice(0, 7)
    const dBelow = best.filter((s) => gradeForMark(s.total) === 'D' || gradeForMark(s.total) === 'F').length
    rows.push({
      exam_id: examId,
      student_id: st.id,
      form: st.form,
      level: 'o',
      division: oLevelDivision(dBelow),
      subjects_used: totals.length,
      best_count: best.length,
      d_below: dBelow,
      total_points: 0,
    })
  }
  await req(
    '/rest/v1/exam_results?on_conflict=exam_id,student_id',
    'POST',
    rows,
    'resolution=merge-duplicates',
  )
  console.log(`Results stored: ${rows.length} students`)

  const counts = { I: 0, II: 0, III: 0, IV: 0, 0: 0 }
  for (const r of rows) counts[r.division]++
  console.log(`Divisions — I: ${counts.I}, II: ${counts.II}, III: ${counts.III}, IV: ${counts.IV}, 0: ${counts['0']}`)

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
