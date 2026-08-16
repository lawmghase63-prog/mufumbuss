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

const SUBJECTS = [
  { code: 'ENG', name: 'English', type: 'o', has_practical: false, forms: ['F1', 'F2', 'F3', 'F4'] },
  { code: 'MATH', name: 'Mathematics', type: 'o', has_practical: false, forms: ['F1', 'F2', 'F3', 'F4'] },
  { code: 'GEO', name: 'Geography', type: 'o', has_practical: false, forms: ['F1', 'F2', 'F3', 'F4'] },
  { code: 'CHEM', name: 'Chemistry', type: 'o', has_practical: true, forms: ['F1', 'F2', 'F3', 'F4'] },
  { code: 'PHY', name: 'Physics', type: 'o', has_practical: true, forms: ['F1', 'F2', 'F3', 'F4'] },
  { code: 'HST', name: 'History', type: 'o', has_practical: false, forms: ['F1', 'F2', 'F3', 'F4'] },
  { code: 'CIV', name: 'Historia ya Tanzania na Maadili', type: 'o', has_practical: false, forms: ['F1', 'F2', 'F3', 'F4'] },
  { code: 'BST', name: 'Business Studies', type: 'o', has_practical: false, forms: ['F1', 'F2', 'F3', 'F4'] },
]

const STUDENTS = [
  // FORM 1 (13)
  ['MUF/F1/001', 'Baraka John Mushi', 'M', 'F1', '0712345601'],
  ['MUF/F1/002', 'Neema Elia Mkumbo', 'F', 'F1', '0712345602'],
  ['MUF/F1/003', 'Amani Hassan Mwinyi', 'M', 'F1', '0712345603'],
  ['MUF/F1/004', 'Zawadi Godfrey Mrema', 'F', 'F1', '0712345604'],
  ['MUF/F1/005', 'Emmanuel Daudi Lyimo', 'M', 'F1', '0712345605'],
  ['MUF/F1/006', 'Rehema Juma Said', 'F', 'F1', '0712345606'],
  ['MUF/F1/007', 'Filbert Peter Mwakalinga', 'M', 'F1', '0712345607'],
  ['MUF/F1/008', 'Happiness Steven Mabula', 'F', 'F1', '0712345608'],
  ['MUF/F1/009', 'Godlisten Tumaini Massawe', 'M', 'F1', '0712345609'],
  ['MUF/F1/010', 'Angelina Cosmas Msaki', 'F', 'F1', '0712345610'],
  ['MUF/F1/011', 'Ibrahim Yusuf Kombo', 'M', 'F1', '0712345611'],
  ['MUF/F1/012', 'Upendo Emmanuel Mnzava', 'F', 'F1', '0712345612'],
  ['MUF/F1/013', 'George Zakaria Meela', 'M', 'F1', '0712345613'],
  // FORM 2 (13)
  ['MUF/F2/001', 'Salome Joseph Macha', 'F', 'F2', '0712345614'],
  ['MUF/F2/002', 'Erick Godfrey Mushi', 'M', 'F2', '0712345615'],
  ['MUF/F2/003', 'Beatrice John Mwakyusa', 'F', 'F2', '0712345616'],
  ['MUF/F2/004', 'Daudi Peter Shirima', 'M', 'F2', '0712345617'],
  ['MUF/F2/005', 'Esther Michael Mghwira', 'F', 'F2', '0712345618'],
  ['MUF/F2/006', 'Frank Charles Msuya', 'M', 'F2', '0712345619'],
  ['MUF/F2/007', 'Grace Emmanuel Mushi', 'F', 'F2', '0712345620'],
  ['MUF/F2/008', 'Happy Daniel Makweta', 'M', 'F2', '0712345621'],
  ['MUF/F2/009', 'Irene Yusto Mgonja', 'F', 'F2', '0712345622'],
  ['MUF/F2/010', 'James Abel Mollel', 'M', 'F2', '0712345623'],
  ['MUF/F2/011', 'Juliana Petro Kimaro', 'F', 'F2', '0712345624'],
  ['MUF/F2/012', 'Kelvin Raphael Mbuya', 'M', 'F2', '0712345625'],
  ['MUF/F2/013', 'Mariam Saleh Juma', 'F', 'F2', '0712345626'],
  // FORM 3 (12)
  ['MUF/F3/001', 'Naomi Paulo Mwangosi', 'F', 'F3', '0712345627'],
  ['MUF/F3/002', 'Oscar Japhet Shao', 'M', 'F3', '0712345628'],
  ['MUF/F3/003', 'Pendo George Mushi', 'F', 'F3', '0712345629'],
  ['MUF/F3/004', 'Rashidi Athumani Ramadhani', 'M', 'F3', '0712345630'],
  ['MUF/F3/005', 'Sarah Emmanuel Komba', 'F', 'F3', '0712345631'],
  ['MUF/F3/006', 'Tumaini Elias Mbise', 'M', 'F3', '0712345632'],
  ['MUF/F3/007', 'Vicky Nestory Mwita', 'F', 'F3', '0712345633'],
  ['MUF/F3/008', 'Wilbert Godfrey Maro', 'M', 'F3', '0712345634'],
  ['MUF/F3/009', 'Zainabu Hamisi Msuo', 'F', 'F3', '0712345635'],
  ['MUF/F3/010', 'Absalom Nehemia Mrema', 'M', 'F3', '0712345636'],
  ['MUF/F3/011', 'Clement Stephen Massawe', 'M', 'F3', '0712345637'],
  ['MUF/F3/012', 'Dorothy Isaya Lyimo', 'F', 'F3', '0712345638'],
  // FORM 4 (12)
  ['MUF/F4/001', 'Emmanuel Joseph Mushi', 'M', 'F4', '0712345639'],
  ['MUF/F4/002', 'Faith Christopher Msuya', 'F', 'F4', '0712345640'],
  ['MUF/F4/003', 'Gloria Adam Kombe', 'F', 'F4', '0712345641'],
  ['MUF/F4/004', 'Hashimu Rajab Mng\'ong\'o', 'M', 'F4', '0712345642'],
  ['MUF/F4/005', 'Imani Baraka Mwakyusa', 'F', 'F4', '0712345643'],
  ['MUF/F4/006', 'Juma Abdallah Salum', 'M', 'F4', '0712345644'],
  ['MUF/F4/007', 'Kudra Hamza Mwinyi', 'F', 'F4', '0712345645'],
  ['MUF/F4/008', 'Lazaro Paul Mrema', 'M', 'F4', '0712345646'],
  ['MUF/F4/009', 'Monica Barnabas Shayo', 'F', 'F4', '0712345647'],
  ['MUF/F4/010', 'Nelson Elias Lyatuu', 'M', 'F4', '0712345648'],
  ['MUF/F4/011', 'Paskal Andrew Nkwabi', 'M', 'F4', '0712345649'],
  ['MUF/F4/012', 'Rita Emmanuel Mushi', 'F', 'F4', '0712345650'],
]

// Demo/test students to remove first (their student_subjects cascade-delete).
const DEMO_ADMISSION = ['MUF/F1/001', 'MUF/F1/002', 'MUF/F2/001', 'MUF/F5/001']

async function main() {
  console.log('Seeding O-Level subjects + 50 students...\n')

  // 0. Remove demo students
  const demoList = DEMO_ADMISSION.map((a) => `"${a}"`).join(',')
  const del = await req(
    `/rest/v1/students?admission_no=in.(${demoList})`,
    'DELETE',
  )
  console.log(`Removed demo students: ${JSON.stringify(del) ?? 0}`)

  // 1. Subjects
  const subjects = await req(
    '/rest/v1/subjects?on_conflict=code',
    'POST',
    SUBJECTS,
    'resolution=merge-duplicates,return=representation',
  )
  console.log(`Subjects: ${subjects.length} registered`)
  for (const s of subjects) console.log(`  ${s.code.padEnd(5)} ${s.name}`)

  // 2. Students
  const students = await req(
    '/rest/v1/students?on_conflict=admission_no',
    'POST',
    STUDENTS.map(([admission_no, full_name, gender, form, parent_phone]) => ({
      admission_no,
      full_name,
      gender,
      form,
      parent_phone,
    })),
    'resolution=merge-duplicates,return=representation',
  )
  console.log(`\nStudents: ${students.length} registered`)
  for (const f of ['F1', 'F2', 'F3', 'F4']) {
    console.log(`  ${f}: ${students.filter((s) => s.form === f).length}`)
  }

  // 3. Enrol every student in all 8 subjects
  const pairs = []
  for (const st of students) {
    for (const sub of subjects) {
      pairs.push({ student_id: st.id, subject_id: sub.id })
    }
  }
  await req(
    '/rest/v1/student_subjects?on_conflict=student_id,subject_id',
    'POST',
    pairs,
    'resolution=merge-duplicates',
  )
  console.log(`\nEnrolments: ${pairs.length} (50 students x ${subjects.length} subjects)`)

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
