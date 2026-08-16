export type Role = 'headmaster' | 'academic' | 'teacher'

export interface Profile {
  id: string
  full_name: string
  role: Role
  created_at: string
}

export interface UserWithProfile {
  id: string
  email: string
  profile: Profile | null
}
