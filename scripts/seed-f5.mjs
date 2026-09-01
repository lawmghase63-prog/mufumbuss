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

const NEW_SUBJECTS = [
  { code: 'PHYA', name: 'Physics', type: 'core', has_practical: true, forms: [] },
  { code: 'CHEMA', name: 'Chemistry', type: 'core', has_practical: true, forms: [] },
  { code: 'MATHA', name: 'Mathematics', type: 'core', has_practical: false, forms: [] },
  { code: 'ECON', name: 'Economics', type: 'core', has_practical: false, forms: [] },
  { code: 'ENGA', name: 'English', type: 'core', has_practical: false, forms: [] },
  { code: 'BIOA', name: 'Biology', type: 'core', has_practical: true, forms: [] },
]

const COMBINATIONS = [
  { code: 'PCM', name: 'Physics, Chemistry, Mathematics', core_subjects: ['PHYA', 'CHEMA', 'MATHA'], subsidiary_subjects: ['GS', 'KISWA'] },
  { code: 'HGL', name: 'History, Geography, Kiswahili', core_subjects: ['HIST', 'GEOG', 'KISWA'], subsidiary_subjects: ['GS'] },
  { code: 'EGA', name: 'Economics, Geography, English', core_subjects: ['ECON', 'GEOG', 'ENGA'], subsidiary_subjects: ['GS', 'KISWA'] },
]

// 30 F5 students: 10 PCM, 10 HGL, 10 EGA (15M, 15F)
const STUDENTS = [
  // PCM (10)
  ['MUF/F5/001', 'Baraka John Mushi', 'M'],
  ['MUF/F5/002', 'Neema Elia Mkumbo', 'F'],
  ['MUF/F5/003', 'Emmanuel Daudi Lyimo', 'M'],
  ['MUF/F5/004', 'Rehema Juma Said', 'F'],
  ['MUF/F5/005', 'Filbert Peter Mwakalinga', 'M'],
  ['MUF/F5/006', 'Happiness Steven Mabula', 'F'],
  ['MUF/F5/007', 'Ibrahim Yusuf Kombo', 'M'],
  ['MUF/F5/008', 'Angelina Cosmas Msaki', 'F'],
  ['MUF/F5/009', 'George Zakaria Meela', 'M'],
  ['MUF/F5/010', 'Upendo Emmanuel Mnzava', 'F'],
  // HGL (10)
  ['MUF/F5/011', 'Salome Joseph Macha', 'F'],
  ['MUF/F5/012', 'Erick Godfrey Mushi', 'M'],
  ['MUF/F5/013', 'Beatrice John Mwakyusa', 'F'],
  ['MUF/F5/014', 'Daudi Peter Shirima', 'M'],
  ['MUF/F5/015', 'Esther Michael Mghwira', 'F'],
  ['MUF/F5/016', 'Frank Charles Msuya', 'M'],
  ['MUF/F5/017', 'Grace Emmanuel Mushi', 'F'],
  ['MUF/F5/018', 'Happy Daniel Makweta', 'M'],
  ['MUF/F5/019', 'Irene Yusto Mgonja', 'F'],
  ['MUF/F5/020', 'James Abel Mollel', 'M'],
  // EGA (10)
  ['MUF/F5/021', 'Juliana Petro Kimaro', 'F'],
  ['MUF/F5/022', 'Kelvin Raphael Mbuya', 'M'],
  ['MUF/F5/023', 'Mariam Saleh Juma', 'F'],
  ['MUF/F5/024', 'Naomi Paulo Mwangosi', 'F'],
  ['MUF/F5/025', 'Oscar Japhet Shao', 'M'],
  ['MUF/F5/026', 'Pendo George Mushi', 'F'],
  ['MUF/F5/027', 'Rashidi Athumani Ramadhani', 'M'],
  ['MUF/F5/028', 'Sarah Emmanuel Komba', 'F'],
  ['MUF/F5/029', 'Tumaini Elias Mbise', 'M'],
  ['MUF/F5/030', 'Vicky Nestory Mwita', 'F'],
]

const EXAM_NAME = 'A-Level Examination 2026'

// Deterministic PRNG
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260818)
const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min

function gradeForMark(mark) {
  if (mark >= 80) return 'A'
  if (mark >= 70) return 'B'
  if (mark >= 60) return 'C'
  if (mark >= 50) return 'D'
  if (mark >= 40) return 'E'
  if (mark >= 35) return 'S'
  return 'F'
}

const A_LEVEL_POINTS = { A: 1, B: 2, C: 3, D: 4, E: 5, S: 6, F: 7 }

function aLevelDivision(points) {
  if (points <= 9) return 'I'
  if (points <= 12) return 'II'
  if (points <= 17) return 'III'
  if (points <= 19) return 'IV'
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
  console.log('Seeding A-Level F5 (subjects, combinations, students, exam, marks)...\n')

  // 1. Upsert new A-Level subjects
  const newSubjects = await req(
    '/rest/v1/subjects?on_conflict=code',
    'POST',
    NEW_SUBJECTS,
    'resolution=merge-duplicates,return=representation',
  )
  console.log(`New A-Level subjects: ${newSubjects.length}`)
  for (const s of newSubjects) console.log(`  ${s.code.padEnd(5)} ${s.name} (${s.has_practical ? 'practical' : 'theory'})`)

  // 2. Load all A-Level subjects (existing + new)
  const allSubjects = await req(
    `/rest/v1/subjects?select=id,code,name,type,has_practical&order=code`,
    'GET',
  )
  const coreSubs = allSubjects.filter((s) => s.type === 'core')
  const subSubs = allSubjects.filter((s) => s.type === 'subsidiary')
  const subByCode = new Map(allSubjects.map((s) => [s.code, s]))
  console.log(`\nAll subjects: ${allSubjects.length} (${coreSubs.length} core, ${subSubs.length} subsidiary)`)

  // 3. Upsert combinations
  const combos = await req(
    '/rest/v1/combinations?on_conflict=code',
    'POST',
    COMBINATIONS.map((c) => ({
      ...c,
      core_subjects: c.core_subjects,
      subsidiary_subjects: c.subsidiary_subjects,
    })),
    'resolution=merge-duplicates,return=representation',
  )
  console.log(`\nCombinations: ${combos.length}`)
  for (const c of combos) console.log(`  ${c.code}: ${c.core_subjects.join(',')} + ${c.subsidiary_subjects.join(',')}`)
  const comboByCode = new Map(combos.map((c) => [c.code, c]))

  // 4. Insert 30 F5 students
  const students = await req(
    '/rest/v1/students?on_conflict=admission_no',
    'POST',
    STUDENTS.map(([admission_no, full_name, gender]) => ({
      admission_no,
      full_name,
      gender,
      form: 'F5',
      parent_phone: `071234${String(ri(1000, 9999))}`,
    })),
    'resolution=merge-duplicates,return=representation',
  )
  console.log(`\nStudents: ${students.length} (F5)`)

  // 5. Assign students to combinations (10 each)
  const studentCombos = []
  const comboGroups = [
    { code: 'PCM', students: students.slice(0, 10) },
    { code: 'HGL', students: students.slice(10, 20) },
    { code: 'EGA', students: students.slice(20, 30) },
  ]

  for (const group of comboGroups) {
    const combo = comboByCode.get(group.code)
    if (!combo) continue
    for (const st of group.students) {
      studentCombos.push({ student_id: st.id, combination_id: combo.id })
    }
    console.log(`  ${group.code}: ${group.students.length} students`)
  }
  await req(
    '/rest/v1/student_combinations?on_conflict=student_id',
    'POST',
    studentCombos,
    'resolution=merge-duplicates',
  )
  console.log(`Student-combination assignments: ${studentCombos.length}`)

  // 6. Enroll students in their subjects (core + subsidiary)
  const enrollments = []
  for (const group of comboGroups) {
    const combo = comboByCode.get(group.code)
    if (!combo) continue
    const subjectCodes = [...combo.core_subjects, ...combo.subsidiary_subjects]
    for (const st of group.students) {
      for (const code of subjectCodes) {
        const sub = subByCode.get(code)
        if (sub) enrollments.push({ student_id: st.id, subject_id: sub.id })
      }
    }
  }
  await req(
    '/rest/v1/student_subjects?on_conflict=student_id,subject_id',
    'POST',
    enrollments,
    'resolution=merge-duplicates',
  )
  console.log(`Enrolments: ${enrollments.length} (${students.length} students x varying subjects)`)

  // 7. Register exam
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
        start_date: '2026-09-01',
        end_date: '2026-09-12',
        forms: ['F5'],
        has_practical: true,
        status: 'active',
      },
      'return=representation',
    )
    examId = created[0].id
    console.log(`\nExam created: ${EXAM_NAME} (${examId})`)
  } else {
    console.log(`\nExam already exists, reusing: ${EXAM_NAME} (${examId})`)
  }

  // 8. Generate marks
  const marks = []
  for (const st of students) {
    // Find which subjects this student is enrolled in
    const stEnrollments = enrollments.filter((e) => e.student_id === st.id)
    for (const enr of stEnrollments) {
      const sub = subByCode.get(
        allSubjects.find((s) => s.id === enr.subject_id)?.code,
      )
      if (!sub) continue
      const hasPractical = sub.has_practical
      marks.push({
        exam_id: examId,
        student_id: st.id,
        subject_id: enr.subject_id,
        theory: ri(30, 95),
        practical: hasPractical ? ri(15, 49) : null,
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
  console.log(`\nMarks inserted: ${marks.length}`)

  // 9. Process results (A-Level: best 3 core subjects, points)
  const byStudent = new Map()
  for (const m of marks) {
    const arr = byStudent.get(m.student_id) ?? []
    arr.push({ subject_id: m.subject_id, theory: m.theory, practical: m.practical, absent: m.absent })
    byStudent.set(m.student_id, arr)
  }

  const rows = []
  for (const st of students) {
    const entries = byStudent.get(st.id) ?? []
    const totals = entries
      .map((e) => {
        const sub = allSubjects.find((s) => s.id === e.subject_id)
        return { id: e.subject_id, type: sub?.type ?? 'o', total: subjectTotalMark(e) }
      })
      .filter((r) => r.total != null)

    if (totals.length === 0) continue

    const core = totals.filter((r) => r.type === 'core')
    const best = [...core].sort((a, b) => b.total - a.total).slice(0, 3)
    const points = best.reduce(
      (sum, s) => sum + (A_LEVEL_POINTS[gradeForMark(s.total)] ?? 7),
      0,
    )
    rows.push({
      exam_id: examId,
      student_id: st.id,
      form: 'F5',
      level: 'a',
      division: aLevelDivision(points),
      subjects_used: totals.length,
      best_count: best.length,
      d_below: 0,
      total_points: points,
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
