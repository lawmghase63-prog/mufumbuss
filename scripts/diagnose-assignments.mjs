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
const H = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' }

async function withCount(table, filter = '') {
  const res = await fetch(`${url}/rest/v1/${table}?select=id${filter}`, {
    method: 'HEAD',
    headers: { ...H, Prefer: 'count=exact' },
  })
  return Number(res.headers.get('content-range')?.split('/')[1] ?? '0')
}

console.log('exam_marks TOTAL:', await withCount('exam_marks'))
console.log('exam_results TOTAL:', await withCount('exam_results'))
console.log('exams TOTAL:', await withCount('exams'))
console.log()

const exams = await (await fetch(`${url}/rest/v1/exams?select=id,name,status,forms&limit=1000&order=created_at.desc`, { headers: H })).json()
for (const e of exams) {
  const n = await withCount('exam_marks', `&exam_id=eq.${e.id}`)
  const r = await withCount('exam_results', `&exam_id=eq.${e.id}`)
  console.log(`  exam ${e.name.padEnd(30)} status=${e.status} marks=${n} results=${r}`)
}

// Full paginated fetch to verify teacher->subject student counts
async function fetchAll(table, select, filter = '') {
  const out = []
  for (let off = 0; ; off += 1000) {
    const rows = await (await fetch(`${url}/rest/v1/${table}?select=${select}${filter}&limit=1000&offset=${off}`, { headers: H })).json()
    if (!rows.length) break
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

const [students, subjects, teachers, teacherAssignments, studentSubjects, combos, studentCombos] = await Promise.all([
  fetchAll('students', 'id,admission_no,form,status'),
  fetchAll('subjects', '*'),
  fetchAll('teachers', '*'),
  fetchAll('teacher_assignments', '*'),
  fetchAll('student_subjects', 'student_id,subject_id'),
  fetchAll('combinations', '*'),
  fetchAll('student_combinations', 'student_id,combination_id'),
])

const subById = new Map(subjects.map((s) => [s.id, s]))
const subByCode = new Map(subjects.map((s) => [s.code, s]))
const stuById = new Map(students.map((s) => [s.id, s]))
const comboById = new Map(combos.map((c) => [c.id, c]))

const ssByStu = new Map()
const ssByStuSub = new Set()
for (const ss of studentSubjects) {
  if (!ssByStu.has(ss.student_id)) ssByStu.set(ss.student_id, new Set())
  ssByStu.get(ss.student_id).add(ss.subject_id)
  ssByStuSub.add(`${ss.student_id}::${ss.subject_id}`)
}

console.log()
console.log('===== WITH FULL DATA: teacher -> subject student counts =====')
for (const t of teachers) {
  const ass = teacherAssignments.filter((a) => a.teacher_id === t.id)
  const line = ass
    .map((a) => {
      const sub = subById.get(a.subject_id)
      const count = students.filter(
        (s) => s.form === a.form && s.status === 'active' && ssByStu.get(s.id)?.has(a.subject_id),
      ).length
      return `${sub?.code ?? '?'}/${a.form}=${count}`
    })
    .join(' ')
  console.log(`${t.full_name.padEnd(26)} ${line}`)
}

console.log()
console.log('===== CHECK F5/F6 combos with FULL data =====')
let comboMissing = 0
for (const sc of studentCombos) {
  const stu = stuById.get(sc.student_id)
  const combo = comboById.get(sc.combination_id)
  if (!stu || !combo) continue
  const codes = [...combo.core_subjects, ...combo.subsidiary_subjects]
  for (const code of codes) {
    const id = subByCode.get(code)?.id
    if (id && !ssByStuSub.has(`${stu.id}::${id}`)) comboMissing++
  }
}
console.log('combo subject rows missing (should be 0):', comboMissing)

console.log()
console.log('===== O-level form mismatches with FULL data =====')
let mismatches = 0
for (const ss of studentSubjects) {
  const stu = stuById.get(ss.student_id)
  const sub = subById.get(ss.subject_id)
  if (!stu || !sub || sub.type !== 'o') continue
  if (!(sub.forms || []).includes(stu.form)) mismatches++
}
console.log('O-level form mismatches:', mismatches)