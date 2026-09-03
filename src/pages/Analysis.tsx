import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2,
  Database,
  ArrowLeft,
  Printer,
  Building2,
  FileDown,
} from 'lucide-react'
import type { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import FlashMessage from '../components/FlashMessage'
import type { Exam, ExamMark, ResultLevel, Division } from '../lib/exams'
import {
  subjectTotalMark,
  gradeForMark,
  pointsForMark,
} from '../lib/exams'
import type { Student, Form } from '../lib/students'
import type { Subject, SubjectType } from '../lib/subjects'
import type { Combination } from '../lib/subjects'

interface StudentCombination {
  student_id: string
  combination_id: string
}

interface SchoolSettings {
  id: string
  school_name: string
  district: string
  address: string
}

interface DivCounts {
  boys: number
  girls: number
  total: number
}

interface ResultRow {
  position: number
  name: string
  gender: string
  avg: number
  grade: string
  pts: number
  division: Division
  subjects: string
  subjectsMarks: string
}

interface SubjectPerf {
  name: string
  code: string
  type: SubjectType
  reg: number
  sat: number
  pass: number
  avg: number
  grade: string
  gpa: number
  competency: string
  counts: Record<string, number>
}

const DIV_KEYS: Division[] = ['I', 'II', 'III', 'IV', '0']

function competencyLabel(avg: number, level: ResultLevel): string {
  if (level === 'a') {
    if (avg >= 80) return 'Excellent'
    if (avg >= 70) return 'Very Good'
    if (avg >= 60) return 'Good'
    if (avg >= 50) return 'Satisfactory'
    if (avg >= 40) return 'Satisfactory (Pass)'
    if (avg >= 35) return 'Subsidiary Pass'
    return 'Fail'
  }
  if (avg >= 75) return 'Excellent'
  if (avg >= 65) return 'Very Good'
  if (avg >= 45) return 'Good'
  if (avg >= 30) return 'Fair'
  return 'Fail'
}

function gradeScaleOf(subjectType: SubjectType): ResultLevel {
  return subjectType === 'o' ? 'o' : 'a'
}

export default function Analysis() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [exam, setExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [marks, setMarks] = useState<ExamMark[]>([])
  const [results, setResults] = useState<
    {
      student_id: string
      form: Form
      level: ResultLevel
      division: Division
      d_below: number
      total_points: number
      subjects_used?: number
    }[]
  >([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    district: '',
    school_name: '',
    address: '',
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedForm, setSelectedForm] = useState<Form | 'ALL'>('ALL')
  const [selectedCombinationId, setSelectedCombinationId] = useState<string | 'ALL'>('ALL')
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [studentCombinations, setStudentCombinations] = useState<StudentCombination[]>([])
  const [studentSubjects, setStudentSubjects] = useState<{ student_id: string; subject_id: string }[]>([])
  const [viewMode, setViewMode] = useState<'marks' | 'grade'>('marks')
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(
    null,
  )

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const [examRes, studRes, marksRes, resultsRes, subjRes, settingsRes, combosRes, scRes, ssRes] =
        await Promise.all([
          supabase.from('exams').select('*').eq('id', examId ?? '').maybeSingle(),
          supabase.from('students').select('*'),
          paginate(async ({ from, to }) =>
            supabase
              .from('exam_marks')
              .select('*')
              .eq('exam_id', examId ?? '')
              .order('id', { ascending: true })
              .range(from, to),
          ),
          supabase
            .from('exam_results')
            .select('*')
            .eq('exam_id', examId ?? ''),
          supabase.from('subjects').select('*'),
          supabase.from('school_settings').select('*').maybeSingle(),
          supabase.from('combinations').select('*'),
          supabase.from('student_combinations').select('student_id, combination_id'),
          paginate(async ({ from, to }) =>
            supabase
              .from('student_subjects')
              .select('student_id, subject_id')
              .order('id', { ascending: true })
              .range(from, to),
          ),
        ])

      if (!alive) return

      if (examRes.error || !examRes.data) {
        setMissing(true)
      } else {
        setExam(examRes.data as Exam)
      }
      setStudents((studRes.data as Student[]) ?? [])
      setMarks((marksRes.data as ExamMark[]) ?? [])
      setResults(
        (resultsRes.data as {
          student_id: string
          form: Form
          level: ResultLevel
          division: Division
          d_below: number
          total_points: number
          subjects_used?: number
        }[]) ?? [],
      )
      setSubjects((subjRes.data as Subject[]) ?? [])

      setCombinations((combosRes.data as Combination[]) ?? [])
      setStudentCombinations((scRes.data as StudentCombination[]) ?? [])
      setStudentSubjects((ssRes.data as { student_id: string; subject_id: string }[]) ?? [])

      const settingsRow = settingsRes.data as SchoolSettings | null
      setSettings(settingsRow)
      setEditForm({
        district: settingsRow?.district ?? '',
        school_name: settingsRow?.school_name ?? '',
        address: settingsRow?.address ?? '',
      })
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [examId])

  const processed = results.length > 0

  const subjectById = useMemo(() => {
    const map = new Map<string, Subject>()
    for (const s of subjects) map.set(s.id, s)
    return map
  }, [subjects])

  const studentById = useMemo(() => {
    const map = new Map<string, Student>()
    for (const s of students) map.set(s.id, s)
    return map
  }, [students])

  const formFilteredResults = useMemo(() => {
    let filtered = selectedForm === 'ALL' ? results : results.filter((r) => r.form === selectedForm)
    if (selectedCombinationId !== 'ALL' && (selectedForm === 'F5' || selectedForm === 'F6')) {
      const studentIds = new Set(
        studentCombinations
          .filter((sc) => sc.combination_id === selectedCombinationId)
          .map((sc) => sc.student_id),
      )
      filtered = filtered.filter((r) => studentIds.has(r.student_id))
    }
    return filtered
  }, [results, selectedForm, selectedCombinationId, studentCombinations])

  const formFilteredMarks = useMemo(() => {
    const ids = new Set(formFilteredResults.map((r) => r.student_id))
    return marks.filter((m) => ids.has(m.student_id))
  }, [marks, formFilteredResults])

  const analysis = useMemo(() => {
    if (!processed) return null

    const subjectLevel = (subjectId: string): ResultLevel =>
      gradeScaleOf(subjectById.get(subjectId)?.type ?? 'o')

    const totalBySubject = new Map<string, number>()
    const gradeCounts = new Map<string, Record<string, number>>()
    const regBySubject = new Map<string, number>()
    const satBySubject = new Map<string, number>()
    const passBySubject = new Map<string, number>()
    const pointsSumBySubject = new Map<string, number>()

    const subjectIdByCode = new Map<string, string>()
    for (const s of subjects) subjectIdByCode.set(s.code, s.id)
    const comboById = new Map<string, Combination>()
    for (const c of combinations) comboById.set(c.id, c)
    const comboByStudent = new Map<string, string>()
    for (const sc of studentCombinations) comboByStudent.set(sc.student_id, sc.combination_id)

    const scopeStudentIds = new Set(formFilteredResults.map((r) => r.student_id))
    for (const sid of scopeStudentIds) {
      const student = studentById.get(sid)
      if (!student) continue
      const ids = new Set<string>()
      if (student.form === 'F5' || student.form === 'F6') {
        const combo = comboById.get(comboByStudent.get(sid) ?? '')
        if (combo) {
          for (const code of combo.core_subjects) {
            const id = subjectIdByCode.get(code)
            if (id) ids.add(id)
          }
          for (const code of combo.subsidiary_subjects) {
            const id = subjectIdByCode.get(code)
            if (id) ids.add(id)
          }
        }
      } else {
        for (const ss of studentSubjects) {
          if (ss.student_id === sid) ids.add(ss.subject_id)
        }
      }
      for (const id of ids) {
        regBySubject.set(id, (regBySubject.get(id) ?? 0) + 1)
      }
    }

    for (const m of formFilteredMarks) {
      const total = subjectTotalMark(m)
      if (total == null) continue
      const level = subjectLevel(m.subject_id)
      satBySubject.set(m.subject_id, (satBySubject.get(m.subject_id) ?? 0) + 1)
      totalBySubject.set(m.subject_id, (totalBySubject.get(m.subject_id) ?? 0) + total)
      const grade = gradeForMark(total, level) ?? 'F'
      const counts = gradeCounts.get(m.subject_id) ?? {}
      counts[grade] = (counts[grade] ?? 0) + 1
      gradeCounts.set(m.subject_id, counts)
      if (total >= (level === 'a' ? 35 : 45)) {
        passBySubject.set(m.subject_id, (passBySubject.get(m.subject_id) ?? 0) + 1)
      }
      pointsSumBySubject.set(
        m.subject_id,
        (pointsSumBySubject.get(m.subject_id) ?? 0) + pointsForMark(total, level),
      )
    }

    const subjectPerf: SubjectPerf[] = []
    for (const s of subjects) {
      const reg = regBySubject.get(s.id) ?? 0
      const sat = satBySubject.get(s.id) ?? 0
      if (reg === 0) continue
      const avg = sat > 0 ? (totalBySubject.get(s.id) ?? 0) / sat : 0
      subjectPerf.push({
        name: s.name,
        code: s.code,
        type: s.type,
        reg,
        sat,
        pass: passBySubject.get(s.id) ?? 0,
        avg,
        grade: sat > 0 ? gradeForMark(avg, gradeScaleOf(s.type)) ?? 'F' : '-',
        gpa: sat > 0 ? (pointsSumBySubject.get(s.id) ?? 0) / sat : 0,
        competency: competencyLabel(avg, gradeScaleOf(s.type)),
        counts: gradeCounts.get(s.id) ?? {},
      })
    }
    subjectPerf.sort(
      (a, b) => b.avg - a.avg || a.name.localeCompare(b.name),
    )

    const resultRows: ResultRow[] = []
    for (const r of formFilteredResults) {
      const student = studentById.get(r.student_id)
      if (!student) continue
      const level = r.level

      if ((r.subjects_used ?? 0) === 0) {
        resultRows.push({
          position: 0,
          name: student.full_name,
          gender: student.gender === 'M' ? 'M' : 'F',
          avg: 0,
          grade: '-',
          pts: 0,
          division: 'ABS' as Division,
          subjects: 'ABSENT',
          subjectsMarks: 'ABSENT',
        })
        continue
      }

      const totals = formFilteredMarks
        .filter((m) => m.student_id === r.student_id)
        .map(subjectTotalMark)
        .filter((t): t is number => t != null)
      const avg = totals.length > 0 ? totals.reduce((s, t) => s + t, 0) / totals.length : 0

      const subjectParts = formFilteredMarks
        .filter((m) => m.student_id === r.student_id)
        .map((m) => {
          const code = subjectById.get(m.subject_id)?.code ?? '?'
          const total = subjectTotalMark(m)
          if (total == null) return `${code}-ABS`
          const g = gradeForMark(total, subjectLevel(m.subject_id)) ?? 'F'
          return `${code}-${g}`
        })
        .sort()

      const subjectPartsMarks = formFilteredMarks
        .filter((m) => m.student_id === r.student_id)
        .map((m) => {
          const code = subjectById.get(m.subject_id)?.code ?? '?'
          const total = subjectTotalMark(m)
          if (total == null) return `${code}-ABS`
          return `${code}-${total}`
        })
        .sort()

      const pts =
        level === 'a'
          ? r.total_points
          : totals
              .slice()
              .sort((a, b) => b - a)
              .slice(0, 7)
              .reduce((s, t) => s + pointsForMark(t, 'o'), 0)

      resultRows.push({
        position: 0,
        name: student.full_name,
        gender: student.gender === 'M' ? 'M' : 'F',
        avg,
        grade: gradeForMark(avg, level) ?? '-',
        pts,
        division: r.division,
        subjects: subjectParts.join(' '),
        subjectsMarks: subjectPartsMarks.join(' '),
      })
    }

    resultRows.sort(
      (a, b) =>
        b.avg - a.avg ||
        a.name.localeCompare(b.name),
    )
    resultRows.forEach((row, i) => {
      const prev = i > 0 ? resultRows[i - 1] : null
      row.position = prev && row.avg === prev.avg ? prev.position : i + 1
    })

    const divByGender: Record<Division, DivCounts> = {
      I: { boys: 0, girls: 0, total: 0 },
      II: { boys: 0, girls: 0, total: 0 },
      III: { boys: 0, girls: 0, total: 0 },
      IV: { boys: 0, girls: 0, total: 0 },
      '0': { boys: 0, girls: 0, total: 0 },
    }
    for (const r of formFilteredResults) {
      if ((r.subjects_used ?? 0) === 0) continue
      const student = studentById.get(r.student_id)
      if (!student) continue
      const d = divByGender[r.division]
      d.total++
      if (student.gender === 'M') d.boys++
      else d.girls++
    }

    const allTotals: number[] = []
    const allPoints: number[] = []
    for (const m of formFilteredMarks) {
      const total = subjectTotalMark(m)
      if (total == null) continue
      allTotals.push(total)
      allPoints.push(pointsForMark(total, subjectLevel(m.subject_id)))
    }
    const schoolAvg = allTotals.length > 0
      ? allTotals.reduce((s, t) => s + t, 0) / allTotals.length
      : 0
    const hasOLevel = formFilteredResults.some((r) => r.level === 'o')
    const schoolLevel: ResultLevel = hasOLevel ? 'o' : 'a'
    const gpaPerStudent: number[] = []
    for (const r of formFilteredResults) {
      const level = r.level
      const pts = formFilteredMarks
        .filter((m) => m.student_id === r.student_id)
        .map(subjectTotalMark)
        .filter((t): t is number => t != null)
        .map((t) => pointsForMark(t, level))
      if (pts.length > 0) {
        gpaPerStudent.push(pts.reduce((s, p) => s + p, 0) / pts.length)
      }
    }
    const schoolGpa =
      gpaPerStudent.length > 0
        ? gpaPerStudent.reduce((s, g) => s + g, 0) / gpaPerStudent.length
        : 0

    const hasALevel = formFilteredResults.some((r) => r.level === 'a')
    const subjectGradeKeys = hasALevel
      ? ['A', 'B', 'C', 'D', 'E', 'S', 'F']
      : ['A', 'B', 'C', 'D', 'F']

    return {
      divByGender,
      resultRows,
      subjectPerf,
      subjectGradeKeys,
      schoolAvg,
      schoolGrade: gradeForMark(schoolAvg, schoolLevel) ?? '-',
      schoolGpa,
      allTotals,
    }
  }, [processed, formFilteredResults, formFilteredMarks, subjectById, studentById, subjects, studentSubjects, combinations, studentCombinations])

  async function saveSettings() {
    setSavingSettings(true)
    const { error } = await supabase
      .from('school_settings')
      .update({
        school_name: editForm.school_name.trim(),
        district: editForm.district.trim(),
        address: editForm.address.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'main')
    if (error) {
      setFlash({ type: 'error', text: error.message })
    } else {
      setFlash({ type: 'ok', text: 'School details saved.' })
      setSettings({ ...editForm } as SchoolSettings)
      setSettingsOpen(false)
    }
    setSavingSettings(false)
  }

  const GREEN: [number, number, number] = [11, 61, 46]
  const PAGE_W = 297
  const PAGE_H = 210
  const MARGIN = 12
  const HEADER_H = 34

  function sectionTitle(doc: jsPDF, y: number, title: string): number {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    const w = doc.getTextWidth(title) + 12
    const x = (PAGE_W - w) / 2
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2])
    doc.roundedRect(x, y, w, 7, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(title, x + w / 2, y + 4.8, { align: 'center' })
    doc.setTextColor(30, 30, 30)
    return y + 11
  }

  async function downloadPdf() {
    if (!analysis || !exam) return
    setDownloading(true)
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })
      const schoolName = settings?.school_name || 'Mufumbu Secondary School'
      const district = settings?.district || ''
      const address = settings?.address || ''
      const generated = new Date().toLocaleString()

      const decor = (d: jsPDF, pageNumber: number) => {
        const c = PAGE_W / 2
        d.setFont('helvetica', 'normal')
        d.setFontSize(9)
        if (district) d.text(district, c, 9, { align: 'center' })
        d.setFont('helvetica', 'bold')
        d.setFontSize(16)
        d.text(schoolName.toUpperCase(), c, district ? 15 : 11, {
          align: 'center',
        })
        d.setFont('helvetica', 'normal')
        d.setFontSize(9)
        if (address) d.text(address, c, 20, { align: 'center' })
        d.setFont('helvetica', 'bold')
        d.setFontSize(12)
        d.text((exam.name || '').toUpperCase(), c, address ? 26 : 21, {
          align: 'center',
        })
        d.setDrawColor(GREEN[0], GREEN[1], GREEN[2])
        d.setLineWidth(0.5)
        d.line(MARGIN, 30, PAGE_W - MARGIN, 30)
        d.setFont('helvetica', 'normal')
        d.setFontSize(8)
        d.setTextColor(120, 120, 120)
        d.text(`Generated: ${generated}`, MARGIN, PAGE_H - 8)
        d.text(`Page ${pageNumber}`, PAGE_W - MARGIN, PAGE_H - 8, {
          align: 'right',
        })
        d.setTextColor(30, 30, 30)
      }

      const base = {
        theme: 'grid' as const,
        margin: { left: MARGIN, right: MARGIN, top: HEADER_H, bottom: 12 },
        headStyles: {
          fillColor: GREEN,
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold' as const,
          halign: 'center' as const,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          textColor: [30, 30, 30] as [number, number, number],
          lineColor: [210, 208, 216] as [number, number, number],
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250] as [number, number, number],
        },
      }

      const finalY = () =>
        (doc as unknown as { lastAutoTable?: { finalY?: number } })
          .lastAutoTable?.finalY ?? HEADER_H

      autoTable(doc, {
        ...base,
        didDrawPage: (data) => decor(data.doc, data.pageNumber),
        startY: HEADER_H,
        tableWidth: 110,
        margin: { left: (PAGE_W - 110) / 2, right: (PAGE_W - 110) / 2 },
        head: [['Div', 'Boys', 'Girls', 'Total']],
        body: DIV_KEYS.map((d) => {
          const c = analysis.divByGender[d]
          return [d, String(c.boys), String(c.girls), String(c.total)]
        }),
      })

      autoTable(doc, {
        ...base,
        startY: sectionTitle(doc, finalY() + 10, 'Results'),
        head: [
          ['#', 'Student Name', 'Sex', 'Average', 'Grade', 'Points', 'Div', 'Subjects'],
        ],
        body: analysis.resultRows.map((r) => [
          String(r.position),
          r.name,
          r.gender,
          r.avg.toFixed(2),
          r.grade,
          String(r.pts),
          r.division,
          viewMode === 'marks' ? r.subjectsMarks : r.subjects,
        ]),
        columnStyles: {
          1: { halign: 'left' as const, cellWidth: 55 },
          7: { halign: 'left' as const },
        },
      })

      autoTable(doc, {
        ...base,
        startY: finalY() + 10,
        tableWidth: 110,
        margin: { left: (PAGE_W - 110) / 2, right: (PAGE_W - 110) / 2 },
        head: [[{ content: 'School Summary', colSpan: 2 }]],
        body: [
          ['Average', `${analysis.schoolAvg.toFixed(2)}%`],
          ['Grade', analysis.schoolGrade],
          ['Students', String(processed)],
          ['School GPA', analysis.schoolGpa.toFixed(2)],
        ],
        columnStyles: {
          0: { fontStyle: 'bold' as const, halign: 'left' as const },
          1: { halign: 'center' as const },
        },
      })

      const keys = analysis.subjectGradeKeys
      autoTable(doc, {
        ...base,
        startY: sectionTitle(doc, finalY() + 10, 'Subject Performance Summary'),
        head: [
          ['#', 'Subject', ...keys, 'Avg', 'Grade', 'REG', 'SAT', 'PASS', 'GPA', 'Competency'],
        ],
        body: analysis.subjectPerf.map((s, i) => [
          String(i + 1),
          s.name,
          ...keys.map((k) => String(s.counts[k] ?? 0)),
          s.avg.toFixed(2),
          s.grade,
          String(s.reg),
          String(s.sat),
          String(s.pass),
          s.gpa.toFixed(2),
          s.competency,
        ]),
        columnStyles: {
          1: { halign: 'left' as const },
        },
      })

      const safeName = (exam.name || 'Exam Analysis').replace(/[^\w\s-]/g, '')
      const formLabel = selectedForm === 'ALL' ? 'All Forms' : `Form ${selectedForm.slice(1)}`
      const comboLabel = selectedCombinationId !== 'ALL'
        ? ` - ${combinations.find(c => c.id === selectedCombinationId)?.code ?? ''}`
        : ''
      doc.save(`${safeName} - ${formLabel}${comboLabel} - Results Analysis.pdf`)
    } catch (err) {
      setFlash({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not generate the PDF.',
      })
    } finally {
      setDownloading(false)
    }
  }

  const back = () => {
    const base = window.location.pathname.startsWith('/academic')
      ? '/academic'
      : '/headmaster'
    navigate(`${base}/exams`)
  }

  if (loading) {
    return (
      <div className="list-state">
        <Loader2 size={20} className="spin" />
        Loading analysis...
      </div>
    )
  }  if (missing) {
    return (
      <div className="list-state">
        <Database size={22} />
        Exam not found.
      </div>
    )
  }

  const schoolName = settings?.school_name || 'Mufumbu Secondary School'
  const examLevel = exam?.forms.some((f) => f === 'F5' || f === 'F6') ? 'A-Level' : 'O-Level'

  return (
    <div className="analysis-page">
      <header className="page-head">
        <h2>Exam Analysis
          <span className={`level-tag level-${examLevel === 'A-Level' ? 'a' : 'o'}`}>
            {examLevel}
          </span>
        </h2>
        <p>{exam?.name}</p>
      </header>

      {flash && (
        <div className="page-flash">
          <FlashMessage
            type={flash.type}
            text={flash.text}
            onDismiss={() => setFlash(null)}
          />
        </div>
      )}

      <div className="page-tools analysis-tools no-print">
        <button type="button" className="signin-btn" onClick={back}>
          <ArrowLeft size={18} />
          Back
        </button>
        {processed && (
          <>
            <button type="button" className="signin-btn" onClick={() => window.print()}>
              <Printer size={18} />
              Print
            </button>
            <button
              type="button"
              className="signin-btn"
              disabled={downloading}
              onClick={downloadPdf}
            >
              {downloading ? <Loader2 size={18} className="spin" /> : <FileDown size={18} />}
              Download PDF
            </button>
          </>
        )}
        <button
          type="button"
          className="signin-btn"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <Building2 size={18} />
          School details
        </button>
      </div>

      {settingsOpen && (
        <section className="panel analysis-settings">
          <h3>School details</h3>
          <div className="grid-3">
            <div className="field">
              <label>School name</label>
              <input
                value={editForm.school_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, school_name: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>District / Council</label>
              <input
                value={editForm.district}
                onChange={(e) =>
                  setEditForm({ ...editForm, district: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Address (P.O Box)</label>
              <input
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
              />
            </div>
          </div>
          <button
            type="button"
            className="signin-btn reg-open"
            disabled={savingSettings}
            onClick={saveSettings}
          >
            {savingSettings ? <Loader2 size={16} className="spin" /> : null}
            Save details
          </button>
        </section>
      )}

      <div className="print-header">
        <div className="line1">{settings?.district || ''}</div>
        <div className="line2">{schoolName.toUpperCase()}</div>
        <div className="line3">{settings?.address || ''}</div>
        <div className="line4">{exam?.name.toUpperCase() || ''}</div>
      </div>

      {!processed ? (
        <div className="list-state">
          <Database size={22} />
          Results not processed. Please process the results first before
          viewing.
        </div>
      ) : (
        analysis && (
          <>
            <div className="chips-row form-picker no-print">
              {['ALL', ...exam!.forms].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={selectedForm === f ? 'chip active' : 'chip'}
                  onClick={() => { setSelectedForm(f as Form | 'ALL'); setSelectedCombinationId('ALL') }}
                >
                  {f === 'ALL' ? 'All Forms' : `Form ${f.slice(1)}`}
                </button>
              ))}
            </div>

            {(selectedForm === 'F5' || selectedForm === 'F6') && combinations.length > 0 && (
              <div className="chips-row form-picker no-print">
                <button
                  type="button"
                  className={selectedCombinationId === 'ALL' ? 'chip active' : 'chip'}
                  onClick={() => setSelectedCombinationId('ALL')}
                >
                  All Combinations
                </button>
                {combinations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={selectedCombinationId === c.id ? 'chip active' : 'chip'}
                    onClick={() => setSelectedCombinationId(c.id)}
                  >
                    {c.code}
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}

            <section className="panel">
              <h3 className="screen-school">{schoolName}</h3>
              <h4 className="screen-exam">{exam?.name}</h4>

              <div className="analysis-table-wrap">
                <table className="analysis-table div-table">
                  <thead>
                    <tr>
                      <th>Div</th>
                      <th>Boys</th>
                      <th>Girls</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIV_KEYS.map((d) => {
                      const c = analysis.divByGender[d]
                      return (
                        <tr key={d}>
                          <td>
                            <strong>{d}</strong>
                          </td>
                          <td>{c.boys}</td>
                          <td>{c.girls}</td>
                          <td>
                            <strong>{c.total}</strong>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="analysis-section-title no-print">
                <span>Results</span>
                <span className="view-toggle">
                  <button
                    type="button"
                    className={viewMode === 'marks' ? 'chip active' : 'chip'}
                    onClick={() => setViewMode('marks')}
                  >
                    Marks
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'grade' ? 'chip active' : 'chip'}
                    onClick={() => setViewMode('grade')}
                  >
                    Grade
                  </button>
                </span>
              </div>
              <div className="analysis-table-wrap">
                <table className="analysis-table results-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Sex</th>
                      <th>Average</th>
                      <th>Grade</th>
                      <th>Points</th>
                      <th>Div</th>
                      <th>Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.resultRows.map((row, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'stripe' : ''}>
                        <td>{row.position}</td>
                        <td className="left">{row.name}</td>
                        <td>{row.gender}</td>
                        <td>{row.avg.toFixed(2)}</td>
                        <td>{row.grade}</td>
                        <td>{row.pts}</td>
                        <td>{row.division}</td>
                        <td className="left">
                          {viewMode === 'marks' ? row.subjectsMarks : row.subjects}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="analysis-table-wrap">
                <table className="analysis-table school-summary-table">
                  <thead>
                    <tr>
                      <th colSpan={2}>School Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="label">Average</td>
                      <td>{analysis.schoolAvg.toFixed(2)}%</td>
                    </tr>
                    <tr>
                      <td className="label">Grade</td>
                      <td>{analysis.schoolGrade}</td>
                    </tr>
                    <tr>
                      <td className="label">Students</td>
                      <td>{formFilteredResults.length}</td>
                    </tr>
                    <tr>
                      <td className="label">School GPA</td>
                      <td>{analysis.schoolGpa.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="analysis-section-title">
                Subject Performance Summary
              </div>
              <div className="analysis-table-wrap">
                <table className="analysis-table subject-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Subject</th>
                      {analysis.subjectGradeKeys.map((g) => (
                        <th key={g}>{g}</th>
                      ))}
                      <th>Avg</th>
                      <th>Grade</th>
                      <th>REG</th>
                      <th>SAT</th>
                      <th>PASS</th>
                      <th>GPA</th>
                      <th>Competency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.subjectPerf.map((s, i) => (
                      <tr key={s.code} className={i % 2 === 1 ? 'stripe' : ''}>
                        <td>{i + 1}</td>
                        <td className="left">{s.name}</td>
                        {analysis.subjectGradeKeys.map((g) => (
                          <td key={g}>{s.counts[g] ?? 0}</td>
                        ))}
                        <td>{s.avg.toFixed(2)}</td>
                        <td>{s.grade}</td>
                        <td>{s.reg}</td>
                        <td>{s.sat}</td>
                        <td>{s.pass}</td>
                        <td>{s.gpa.toFixed(2)}</td>
                        <td>{s.competency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )
      )}

      <p className="generated-at">
        Generated: {new Date().toLocaleString()}
      </p>
    </div>
  )
}
