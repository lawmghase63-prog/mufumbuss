-- ============================================================
-- Mufumbu Secondary School - O-Level Seed Data
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor).
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
--
-- Adds:
--   1. 8 O-Level subjects (F1-F4)
--   2. 50 students (F1: 13, F2: 13, F3: 12, F4: 12)
--   3. Enrols every student in all 8 subjects (student_subjects)
-- ============================================================

-- ------------------------------------------------------------
-- 1. O-LEVEL SUBJECTS
-- ------------------------------------------------------------
insert into public.subjects (name, code, type, has_practical, forms) values
  ('English',                'ENG',  'o', false, array['F1','F2','F3','F4']),
  ('Mathematics',            'MATH', 'o', false, array['F1','F2','F3','F4']),
  ('Geography',              'GEO',  'o', false, array['F1','F2','F3','F4']),
  ('Chemistry',              'CHEM', 'o', true,  array['F1','F2','F3','F4']),
  ('Physics',                'PHY',  'o', true,  array['F1','F2','F3','F4']),
  ('History',                'HST',  'o', false, array['F1','F2','F3','F4']),
  ('Historia ya Tanzania na Maadili', 'CIV', 'o', false, array['F1','F2','F3','F4']),
  ('Business Studies',       'BST',  'o', false, array['F1','F2','F3','F4'])
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 2. STUDENTS (50)  F1: 13, F2: 13, F3: 12, F4: 12
-- ------------------------------------------------------------
insert into public.students (admission_no, full_name, gender, form, parent_phone) values
  -- FORM 1 (13)
  ('MUF/F1/001', 'Baraka John Mushi',          'M', 'F1', '0712345601'),
  ('MUF/F1/002', 'Neema Elia Mkumbo',          'F', 'F1', '0712345602'),
  ('MUF/F1/003', 'Amani Hassan Mwinyi',        'M', 'F1', '0712345603'),
  ('MUF/F1/004', 'Zawadi Godfrey Mrema',       'F', 'F1', '0712345604'),
  ('MUF/F1/005', 'Emmanuel Daudi Lyimo',       'M', 'F1', '0712345605'),
  ('MUF/F1/006', 'Rehema Juma Said',           'F', 'F1', '0712345606'),
  ('MUF/F1/007', 'Filbert Peter Mwakalinga',   'M', 'F1', '0712345607'),
  ('MUF/F1/008', 'Happiness Steven Mabula',    'F', 'F1', '0712345608'),
  ('MUF/F1/009', 'Godlisten Tumaini Massawe',  'M', 'F1', '0712345609'),
  ('MUF/F1/010', 'Angelina Cosmas Msaki',      'F', 'F1', '0712345610'),
  ('MUF/F1/011', 'Ibrahim Yusuf Kombo',        'M', 'F1', '0712345611'),
  ('MUF/F1/012', 'Upendo Emmanuel Mnzava',     'F', 'F1', '0712345612'),
  ('MUF/F1/013', 'George Zakaria Meela',       'M', 'F1', '0712345613'),

  -- FORM 2 (13)
  ('MUF/F2/001', 'Salome Joseph Macha',        'F', 'F2', '0712345614'),
  ('MUF/F2/002', 'Erick Godfrey Mushi',        'M', 'F2', '0712345615'),
  ('MUF/F2/003', 'Beatrice John Mwakyusa',     'F', 'F2', '0712345616'),
  ('MUF/F2/004', 'Daudi Peter Shirima',        'M', 'F2', '0712345617'),
  ('MUF/F2/005', 'Esther Michael Mghwira',     'F', 'F2', '0712345618'),
  ('MUF/F2/006', 'Frank Charles Msuya',        'M', 'F2', '0712345619'),
  ('MUF/F2/007', 'Grace Emmanuel Mushi',       'F', 'F2', '0712345620'),
  ('MUF/F2/008', 'Happy Daniel Makweta',       'M', 'F2', '0712345621'),
  ('MUF/F2/009', 'Irene Yusto Mgonja',         'F', 'F2', '0712345622'),
  ('MUF/F2/010', 'James Abel Mollel',          'M', 'F2', '0712345623'),
  ('MUF/F2/011', 'Juliana Petro Kimaro',       'F', 'F2', '0712345624'),
  ('MUF/F2/012', 'Kelvin Raphael Mbuya',       'M', 'F2', '0712345625'),
  ('MUF/F2/013', 'Mariam Saleh Juma',          'F', 'F2', '0712345626'),

  -- FORM 3 (12)
  ('MUF/F3/001', 'Naomi Paulo Mwangosi',       'F', 'F3', '0712345627'),
  ('MUF/F3/002', 'Oscar Japhet Shao',          'M', 'F3', '0712345628'),
  ('MUF/F3/003', 'Pendo George Mushi',         'F', 'F3', '0712345629'),
  ('MUF/F3/004', 'Rashidi Athumani Ramadhani', 'M', 'F3', '0712345630'),
  ('MUF/F3/005', 'Sarah Emmanuel Komba',       'F', 'F3', '0712345631'),
  ('MUF/F3/006', 'Tumaini Elias Mbise',        'M', 'F3', '0712345632'),
  ('MUF/F3/007', 'Vicky Nestory Mwita',        'F', 'F3', '0712345633'),
  ('MUF/F3/008', 'Wilbert Godfrey Maro',       'M', 'F3', '0712345634'),
  ('MUF/F3/009', 'Zainabu Hamisi Msuo',        'F', 'F3', '0712345635'),
  ('MUF/F3/010', 'Absalom Nehemia Mrema',      'M', 'F3', '0712345636'),
  ('MUF/F3/011', 'Clement Stephen Massawe',    'M', 'F3', '0712345637'),
  ('MUF/F3/012', 'Dorothy Isaya Lyimo',        'F', 'F3', '0712345638'),

  -- FORM 4 (12)
  ('MUF/F4/001', 'Emmanuel Joseph Mushi',      'M', 'F4', '0712345639'),
  ('MUF/F4/002', 'Faith Christopher Msuya',    'F', 'F4', '0712345640'),
  ('MUF/F4/003', 'Gloria Adam Kombe',          'F', 'F4', '0712345641'),
  ('MUF/F4/004', 'Hashimu Rajab Mngong''o',    'M', 'F4', '0712345642'),
  ('MUF/F4/005', 'Imani Baraka Mwakyusa',      'F', 'F4', '0712345643'),
  ('MUF/F4/006', 'Juma Abdallah Salum',        'M', 'F4', '0712345644'),
  ('MUF/F4/007', 'Kudra Hamza Mwinyi',         'F', 'F4', '0712345645'),
  ('MUF/F4/008', 'Lazaro Paul Mrema',          'M', 'F4', '0712345646'),
  ('MUF/F4/009', 'Monica Barnabas Shayo',      'F', 'F4', '0712345647'),
  ('MUF/F4/010', 'Nelson Elias Lyatuu',        'M', 'F4', '0712345648'),
  ('MUF/F4/011', 'Paskal Andrew Nkwabi',       'M', 'F4', '0712345649'),
  ('MUF/F4/012', 'Rita Emmanuel Mushi',        'F', 'F4', '0712345650')
on conflict (admission_no) do nothing;

-- ------------------------------------------------------------
-- 3. ENROL ALL STUDENTS IN ALL 8 O-LEVEL SUBJECTS
-- ------------------------------------------------------------
insert into public.student_subjects (student_id, subject_id)
select s.id, sub.id
from public.students s
cross join public.subjects sub
where sub.code in ('ENG', 'MATH', 'GEO', 'CHEM', 'PHY', 'HST', 'CIV', 'BST')
on conflict (student_id, subject_id) do nothing;
