import type { Form } from './students'
import type { SubjectType } from './subjects'

export type ExamType = 'exam' | 'test'
export type ExamStatus = 'active' | 'closed'

export interface Exam {
  id: string
  name: string
  exam_type: ExamType
  start_date: string
  end_date: string
  forms: Form[]
  has_practical: boolean
  status: ExamStatus
  created_by: string | null
  created_at: string
}

export interface ExamMark {
  id: string
  exam_id: string
  student_id: string
  subject_id: string
  theory: number
  practical: number | null
  absent: boolean
  teacher_id: string | null
  created_at: string
  updated_at: string
}

export function examTypeLabel(type: ExamType): string {
  return type === 'test' ? 'Test' : 'Exam'
}

export function formatExamDates(exam: Exam): string {
  return `${exam.start_date} — ${exam.end_date}`
}

export function formatForms(forms: Form[]): string {
  return forms.length
    ? forms.map((f) => `Form ${f.slice(1)}`).join(', ')
    : '—'
}

export function parseMark(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

export type ResultLevel = 'o' | 'a'
export type Division = 'I' | 'II' | 'III' | 'IV' | '0'

export interface ExamResult {
  id: string
  exam_id: string
  student_id: string
  form: Form
  level: ResultLevel
  division: Division
  subjects_used: number
  best_count: number
  d_below: number
  total_points: number
  processed_at: string
}

export interface StudentMarkEntry {
  subject_id: string
  theory: number
  practical: number | null
  absent: boolean
}

export function formLevel(form: Form): ResultLevel {
  return form === 'F5' || form === 'F6' ? 'a' : 'o'
}

export function subjectTotalMark(entry: Pick<StudentMarkEntry, 'theory' | 'practical' | 'absent'>): number | null {
  if (entry.absent) return null
  const theory = Number(entry.theory)
  if (!Number.isFinite(theory)) return null
  if (entry.practical != null) {
    return Math.round(((theory + Number(entry.practical)) / 150) * 100)
  }
  return Math.round(theory)
}

export function gradeForMark(mark: number, level: ResultLevel): string | null {
  if (!Number.isFinite(mark)) return null
  if (level === 'o') {
    if (mark >= 75) return 'A'
    if (mark >= 65) return 'B'
    if (mark >= 45) return 'C'
    if (mark >= 30) return 'D'
    return 'F'
  }
  if (mark >= 80) return 'A'
  if (mark >= 70) return 'B'
  if (mark >= 60) return 'C'
  if (mark >= 50) return 'D'
  if (mark >= 40) return 'E'
  if (mark >= 35) return 'S'
  return 'F'
}

const A_LEVEL_POINTS: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  S: 6,
  F: 7,
}

export function pointsForGrade(grade: string): number {
  return A_LEVEL_POINTS[grade] ?? 7
}

export function pointsForMark(mark: number, level: ResultLevel): number {
  if (level === 'o') {
    const g = gradeForMark(mark, 'o')
    if (g === 'A') return 1
    if (g === 'B') return 2
    if (g === 'C') return 3
    if (g === 'D') return 4
    return 5
  }
  return pointsForGrade(gradeForMark(mark, 'a') ?? 'F')
}

export function oLevelDivision(points: number): Division {
  if (points <= 17) return 'I'
  if (points <= 21) return 'II'
  if (points <= 25) return 'III'
  if (points <= 33) return 'IV'
  return '0'
}

export function aLevelDivision(points: number): Division {
  if (points <= 9) return 'I'
  if (points <= 12) return 'II'
  if (points <= 17) return 'III'
  if (points <= 19) return 'IV'
  return '0'
}

export interface ComputedDivision {
  level: ResultLevel
  division: Division
  subjectsUsed: number
  bestCount: number
  dBelow: number
  points: number
}

export function computeDivision(
  form: Form,
  entries: StudentMarkEntry[],
  subjectTypes: Map<string, SubjectType>,
): ComputedDivision | null {
  const level = formLevel(form)
  const rows = entries
    .map((e) => ({ id: e.subject_id, total: subjectTotalMark(e) }))
    .filter((r): r is { id: string; total: number } => r.total != null)

  if (rows.length === 0) return null

  if (level === 'o') {
    const best = [...rows].sort((a, b) => b.total - a.total).slice(0, 7)
    const points = best.reduce((sum, s) => sum + pointsForMark(s.total, 'o'), 0)
    const dBelow = best.filter(
      (s) => gradeForMark(s.total, 'o') === 'D' || gradeForMark(s.total, 'o') === 'F',
    ).length
    return {
      level,
      division: oLevelDivision(points),
      subjectsUsed: rows.length,
      bestCount: best.length,
      dBelow,
      points,
    }
  }

  const core = rows.filter((r) => subjectTypes.get(r.id) === 'core')
  if (core.length === 0) return null
  const best = [...core].sort((a, b) => b.total - a.total).slice(0, 3)
  const points = best.reduce(
    (sum, s) => sum + pointsForGrade(gradeForMark(s.total, 'a') ?? 'F'),
    0,
  )
  return {
    level,
    division: aLevelDivision(points),
    subjectsUsed: rows.length,
    bestCount: best.length,
    dBelow: 0,
    points,
  }
}
