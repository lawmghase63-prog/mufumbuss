export const O_LEVEL_FORMS = ['F1', 'F2', 'F3', 'F4'] as const
export type OLevelForm = (typeof O_LEVEL_FORMS)[number]

export type SubjectType = 'o' | 'core' | 'subsidiary'

export interface Subject {
  id: string
  name: string
  code: string
  type: SubjectType
  has_practical: boolean
  forms: string[]
  created_at: string
}

export interface Combination {
  id: string
  code: string
  name: string
  core_subjects: string[]
  subsidiary_subjects: string[]
  created_at: string
}

export function subjectName(subjects: Subject[], code: string): string {
  const found = subjects.find((s) => s.code === code)
  return found ? found.name : code
}
