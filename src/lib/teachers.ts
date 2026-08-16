import type { Form } from './students'

export type Sex = 'M' | 'F'

export interface Teacher {
  id: string
  user_id: string
  full_name: string
  sex: Sex
  email: string
  phone: string
  created_at: string
}

export interface TeacherAssignment {
  id: string
  teacher_id: string
  subject_id: string
  form: Form
  created_at: string
}

export const DEFAULT_TEACHER_PASSWORD = 'Mufumbu@123'
