-- Mufumbu Secondary School - Results Management System
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)

-- ============================================================
-- 1. PROFILES TABLE
--    Stores user role and extra info linked to auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'teacher'
    check (role in ('headmaster', 'academic', 'teacher')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- 5. STUDENTS TABLE
--    Admission number is auto-generated on registration.
-- ============================================================
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  full_name text not null,
  gender text not null check (gender in ('M', 'F')),
  form text not null check (form in ('F1', 'F2', 'F3', 'F4', 'F5', 'F6')),
  parent_phone text not null default '',
  status text not null default 'active' check (status in ('active', 'graduated', 'inactive')),
  graduated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

create policy "Authenticated users can view students"
  on public.students for select
  to authenticated using (true);

create policy "Authenticated users can insert students"
  on public.students for insert
  to authenticated with check (true);

create policy "Authenticated users can update students"
  on public.students for update
  to authenticated using (true);

create policy "Authenticated users can delete students"
  on public.students for delete
  to authenticated using (true);

-- ============================================================
-- 6. SUBJECTS TABLE (O-Level subjects, F1 - F4)
--    'forms' lists which forms the subject is taught in,
--    e.g. {F1,F2,F3,F4} or {F1,F2}. Empty for A-Level subjects.
-- ============================================================
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  type text not null default 'o' check (type in ('o', 'core', 'subsidiary')),
  has_practical boolean not null default false,
  forms text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create policy "Authenticated users can view subjects"
  on public.subjects for select
  to authenticated using (true);

create policy "Authenticated users can insert subjects"
  on public.subjects for insert
  to authenticated with check (true);

create policy "Authenticated users can update subjects"
  on public.subjects for update
  to authenticated using (true);

create policy "Authenticated users can delete subjects"
  on public.subjects for delete
  to authenticated using (true);

-- ============================================================
-- 7. COMBINATIONS TABLE (A-Level combinations, F5 - F6)
--    'core_subjects' holds the codes of the main combination
--    subjects (e.g. PCM -> PHY,CHE,MATH). 'subsidiary_subjects'
--    holds codes of the subsidiary subjects added later.
-- ============================================================
create table if not exists public.combinations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  core_subjects text[] not null default '{}'::text[],
  subsidiary_subjects text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table public.combinations enable row level security;

create policy "Authenticated users can view combinations"
  on public.combinations for select
  to authenticated using (true);

create policy "Authenticated users can insert combinations"
  on public.combinations for insert
  to authenticated with check (true);

create policy "Authenticated users can update combinations"
  on public.combinations for update
  to authenticated using (true);

create policy "Authenticated users can delete combinations"
  on public.combinations for delete
  to authenticated using (true);

-- ============================================================
-- 8. SUBJECT ASSIGNMENTS (O-Level students, F1 - F4)
--    Which subjects each student is enrolled in.
-- ============================================================
create table if not exists public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id)
);

alter table public.student_subjects enable row level security;

create policy "Authenticated users can view student_subjects"
  on public.student_subjects for select
  to authenticated using (true);

create policy "Authenticated users can insert student_subjects"
  on public.student_subjects for insert
  to authenticated with check (true);

create policy "Authenticated users can update student_subjects"
  on public.student_subjects for update
  to authenticated using (true);

create policy "Authenticated users can delete student_subjects"
  on public.student_subjects for delete
  to authenticated using (true);

-- ============================================================
-- 9. COMBINATION ASSIGNMENTS (A-Level students, F5 - F6)
--    Which combination each student is enrolled in.
-- ============================================================
create table if not exists public.student_combinations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  combination_id uuid not null references public.combinations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, combination_id)
);

-- One combination per student is enforced at the DB level.
create unique index if not exists student_combinations_one_per_student
  on public.student_combinations (student_id);

alter table public.student_combinations enable row level security;

create policy "Authenticated users can view student_combinations"
  on public.student_combinations for select
  to authenticated using (true);

create policy "Authenticated users can insert student_combinations"
  on public.student_combinations for insert
  to authenticated with check (true);

create policy "Authenticated users can update student_combinations"
  on public.student_combinations for update
  to authenticated using (true);

create policy "Authenticated users can delete student_combinations"
  on public.student_combinations for delete
  to authenticated using (true);

-- ============================================================
-- 10. SAMPLE USERS (optional - uncomment to run)
--    Create users first via Dashboard > Authentication > Users,
--    then set their roles with UPDATE below.
-- ============================================================
-- update public.profiles set role = 'headmaster'
--   where id = '<USER_UUID_OF_HEADMASTER>';
-- update public.profiles set role = 'academic'
--   where id = '<USER_UUID_OF_ACADEMIC>';
-- update public.profiles set role = 'teacher'
--   where id = '<USER_UUID_OF_TEACHER>';

-- ============================================================
-- 11. TEACHERS TABLE
--    Staff records. Login accounts are created with the auto
--    password Mufumbu@123 (teachers change it in Profile).
-- ============================================================
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  full_name text not null,
  sex text not null check (sex in ('M', 'F')),
  email text not null unique,
  phone text not null default '',
  created_at timestamptz not null default now()
);

alter table public.teachers enable row level security;

create policy "Authenticated users can view teachers"
  on public.teachers for select to authenticated using (true);

create policy "Authenticated users can insert teachers"
  on public.teachers for insert to authenticated with check (true);

create policy "Authenticated users can update teachers"
  on public.teachers for update to authenticated using (true);

create policy "Authenticated users can delete teachers"
  on public.teachers for delete to authenticated using (true);

-- ============================================================
-- 12. TEACHING ASSIGNMENTS
--    teacher x subject x form. A teacher can teach several
--    subjects in one form or one subject across several forms.
-- ============================================================
create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  form text not null check (form in ('F1', 'F2', 'F3', 'F4', 'F5', 'F6')),
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, form)
);

alter table public.teacher_assignments enable row level security;

create policy "Authenticated users can view teacher_assignments"
  on public.teacher_assignments for select to authenticated using (true);

create policy "Authenticated users can insert teacher_assignments"
  on public.teacher_assignments for insert to authenticated with check (true);

create policy "Authenticated users can update teacher_assignments"
  on public.teacher_assignments for update to authenticated using (true);

create policy "Authenticated users can delete teacher_assignments"
  on public.teacher_assignments for delete to authenticated using (true);

-- ============================================================
-- 13. EXAMS TABLE
--    A registered exam/test starts as 'active' so teachers can
--    enter marks. 'forms' lists which classes are involved.
-- ============================================================
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  exam_type text not null default 'exam' check (exam_type in ('exam', 'test')),
  start_date date not null,
  end_date date not null,
  forms text[] not null default '{}'::text[],
  has_practical boolean not null default false,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.exams enable row level security;

create policy "Authenticated users can view exams"
  on public.exams for select to authenticated using (true);

create policy "Authenticated users can insert exams"
  on public.exams for insert to authenticated with check (true);

create policy "Authenticated users can update exams"
  on public.exams for update to authenticated using (true);

create policy "Authenticated users can delete exams"
  on public.exams for delete to authenticated using (true);

-- ============================================================
-- 14. EXAM MARKS TABLE
--    Marks are unique per (exam, student, subject). 'practical'
--    is null when the exam/subject has no practical.
-- ============================================================
create table if not exists public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  theory numeric not null default 0 check (theory >= 0 and theory <= 100),
  practical numeric check (practical >= 0 and practical <= 100),
  absent boolean not null default false,
  teacher_id uuid references public.teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id, subject_id)
);

alter table public.exam_marks enable row level security;

create policy "Authenticated users can view exam_marks"
  on public.exam_marks for select to authenticated using (true);

create policy "Authenticated users can insert exam_marks"
  on public.exam_marks for insert to authenticated with check (true);

create policy "Authenticated users can update exam_marks"
  on public.exam_marks for update to authenticated using (true);

create policy "Authenticated users can delete exam_marks"
  on public.exam_marks for delete to authenticated using (true);

-- ============================================================
-- 15. EXAM RESULTS TABLE
--    Stores the computed division for each student in a given
--    exam (O-Level: best 7 subjects, D-or-below count; A-Level:
--    best 3 core subjects, points). One row per (exam, student).
-- ============================================================
create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  form text not null check (form in ('F1','F2','F3','F4','F5','F6')),
  level text not null check (level in ('o','a')),
  division text not null check (division in ('I','II','III','IV','0')),
  subjects_used int not null,
  best_count int not null,
  d_below int not null default 0,
  total_points int not null default 0,
  processed_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

alter table public.exam_results enable row level security;

create policy "Authenticated users can view exam_results"
  on public.exam_results for select to authenticated using (true);

create policy "Authenticated users can insert exam_results"
  on public.exam_results for insert to authenticated with check (true);

create policy "Authenticated users can update exam_results"
  on public.exam_results for update to authenticated using (true);

create policy "Authenticated users can delete exam_results"
  on public.exam_results for delete to authenticated using (true);

-- ============================================================
-- 16. SCHOOL SETTINGS TABLE
--    Single row holding the school identity used on the exam
--    analysis / print header (name, district, address).
-- ============================================================
create table if not exists public.school_settings (
  id text primary key default 'main',
  school_name text not null default 'Mufumbu Secondary School',
  district text not null default '',
  address text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id, school_name, district, address)
values ('main', 'Mufumbu Secondary School', '', '')
on conflict (id) do nothing;

alter table public.school_settings enable row level security;

create policy "Authenticated users can view school_settings"
  on public.school_settings for select to authenticated using (true);

create policy "Authenticated users can update school_settings"
  on public.school_settings for update to authenticated using (true);

create policy "Authenticated users can insert school_settings"
  on public.school_settings for insert to authenticated with check (true);
