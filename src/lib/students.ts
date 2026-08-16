import { supabase } from './supabase'

export const FORMS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'] as const
export type Form = (typeof FORMS)[number]
export type Gender = 'M' | 'F'
export type StudentStatus = 'active' | 'graduated' | 'inactive'

export interface Student {
  id: string
  admission_no: string
  full_name: string
  gender: Gender
  form: Form
  parent_phone: string
  status: StudentStatus
  graduated_at: string | null
  created_at: string
}

export const NEXT_FORM: Record<Form, Form | 'graduate'> = {
  F1: 'F2',
  F2: 'F3',
  F3: 'F4',
  F4: 'graduate',
  F5: 'F6',
  F6: 'graduate',
}

export interface ImportSummary {
  imported: number
  errors: { line: number; reason: string }[]
}

export async function generateAdmissionNo(form: Form): Promise<string> {
  const { data, error } = await supabase
    .from('students')
    .select('admission_no')
    .eq('form', form)
    .order('admission_no', { ascending: false })
    .limit(1)

  let next = 1
  if (!error && data?.length) {
    const match = data[0].admission_no.match(/(\d+)\s*$/)
    const last = match ? parseInt(match[1], 10) : 0
    next = (Number.isFinite(last) ? last : 0) + 1
  }
  return `MUF/${form}/${String(next).padStart(3, '0')}`
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export interface CsvRow {
  full_name: string
  gender: Gender
  form: Form
  parent_phone: string
}

export function normalizeCsvRow(raw: string[]): {
  ok: boolean
  row?: CsvRow
  error?: string
} {
  const [fullName = '', gender = '', form = '', parentPhone = ''] = raw

  if (!fullName) return { ok: false, error: 'Full name is empty' }

  const g = gender.toLowerCase()
  if (g === 'm' || g === 'male') {
    /* ok */
  } else if (g === 'f' || g === 'female') {
    /* ok */
  } else {
    return { ok: false, error: `Invalid gender "${gender}" (use M or F)` }
  }

  const f = form.toUpperCase()
  if (!(FORMS as readonly string[]).includes(f)) {
    return { ok: false, error: `Invalid form "${form}" (use F1-F6)` }
  }

  return {
    ok: true,
    row: {
      full_name: fullName,
      gender: g.startsWith('m') ? 'M' : 'F',
      form: f as Form,
      parent_phone: parentPhone,
    },
  }
}

export function buildTemplateCsv(): string {
  const header = 'full_name,gender,form,parent_phone'
  const rows = [
    'Amani Hassan Mwinyi,M,F1,0712345678',
    'Neema Joseph Kimaro,F,F2,0755123456',
  ]
  return `${header}\n${rows.join('\n')}\n`
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
