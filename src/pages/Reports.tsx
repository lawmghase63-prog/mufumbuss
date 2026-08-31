import { useState } from 'react'
import { ArrowLeft, FileDown, Loader2 } from 'lucide-react'
import type { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'
import { paginate } from '../lib/paginate'
import FlashMessage from '../components/FlashMessage'
import { FORMS, type Form, type Student } from '../lib/students'
import type { Combination, Subject, SubjectType } from '../lib/subjects'
import type {
  Exam,
  ExamMark,
  ResultLevel,
  StudentMarkEntry,
} from '../lib/exams'
import {
  computeDivision,
  formLevel,
  gradeForMark,
  pointsForMark,
  subjectTotalMark,
} from '../lib/exams'

interface SchoolSettings {
  school_name: string
  district: string
  address: string
}

interface ExamOption extends Exam {
  processed: boolean
}

interface SubjectRow {
  name: string
  mark: string
  grade: string
  point: string
  remark: string
}

interface HistRow {
  name: string
  date: string
  avg: number
  pos: number
  div: string
  pts: number
  trend: string
}

interface ReportCard {
  fullName: string
  sex: string
  stream: string
  avg: number
  gpa: number
  position: number
  totalPoints: number
  division: string
  rows: SubjectRow[]
  history: HistRow[]
  comment: string
  parentMsg: string
}

const REMARKS: Record<string, string> = {
  A: 'BORA SANA',
  B: 'VIZURI SANA',
  C: 'WASTANI',
  D: 'HAFIFU',
  E: 'KARIA',
  S: 'PASI NDOGO',
  F: 'FELI',
}

const BEHAVIOR_ROWS = [
  ['1', 'KUFANYA KAZI KWA BIDII', 'HESHIMA KWA WALIMU NA WANAFUNZI'],
  ['2', 'KUPENDA KUHESHIMU NA KUTHAMINI KAZI', 'KUTII NA KUFUATA MAAGIZO'],
  ['3', 'UANGALIFU WA MALI ZA UMA', 'USAFI BINAFSI'],
  ['4', 'UELEWA NA USHIRIKIANO', 'KUSHIRIKI SHUGHULI ZA UTAMADUNI'],
]

const GREEN: [number, number, number] = [11, 94, 46]
const HEAD_FILL: [number, number, number] = [180, 220, 180]
const INFO_FILL: [number, number, number] = [224, 242, 224]
const STRIPE_FILL: [number, number, number] = [245, 250, 245]
const MSG_FILL: [number, number, number] = [255, 246, 229]
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 10
const CONTENT_W = PAGE_W - MARGIN * 2

function fmtDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

function schoolComment(avg: number): string {
  if (avg >= 75)
    return 'Ufaulu wa juu sana. Hongera mwanafunzi. Endelea kudumisha ukakamali wako.'
  if (avg >= 65)
    return 'Ufaulu mzuri. Ongeza juhudi kidogo ili kufikia ubora zaidi.'
  if (avg >= 45)
    return 'Ufaulu wa wastani. Jitahidi zaidi ili kuboresha matokeo yako.'
  if (avg >= 30)
    return 'Ufaulu wa chini. Mzazi ashirikiane na shule ili kumsaidia mwanafunzi.'
  return 'Ufaulu hafifu. Mzazi anashauriwa kufika shuleni kwa mazungumzo ya kina.'
}

function parentAdvice(avg: number): string {
  if (avg >= 75)
    return 'Hongera kwa matokeo bora. Endelea kumhimiza mwanafunzi kudumisha ukakamali huu.'
  if (avg >= 65)
    return 'Matokeo mazuri. Msaidie mwanafunzi kuongeza muda wa kusoma nyumbani.'
  if (avg >= 45)
    return 'Matokeo ya wastani. Hakikisha anafanya kazi za nyumbani na kujisomea zaidi.'
  if (avg >= 30)
    return 'Matokeo dhaifu. Tafadhali wasiliana na mwalimu wa darasa ili kujua changamoto.'
  return 'Matokeo duni sana. Inashauriwa kufika shuleni kwa ushauri na kufuatilia maendeleo.'
}

function rankCohort(
  rows: { student_id: string; total_points: number; avg: number }[],
): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) =>
      a.total_points - b.total_points ||
      b.avg - a.avg ||
      a.student_id.localeCompare(b.student_id),
  )
  const pos = new Map<string, number>()
  sorted.forEach((r, i) => {
    const prev = i > 0 ? sorted[i - 1] : null
    const tied =
      prev !== null &&
      prev.total_points === r.total_points &&
      prev.avg === r.avg
    pos.set(r.student_id, tied ? pos.get(prev.student_id) ?? i + 1 : i + 1)
  })
  return pos
}

function finalY(doc: jsPDF): number {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? MARGIN + 40
  )
}

function drawHeader(doc: jsPDF, exam: Exam, settings: SchoolSettings | null): number {
  let y = 14
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  const district = settings?.district ?? ''
  if (district) {
    doc.text(district.toUpperCase(), PAGE_W / 2, y, { align: 'center' })
    y += 5.5
  }
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.text(
    (settings?.school_name || 'Mufumbu Secondary School').toUpperCase(),
    PAGE_W / 2,
    y,
    { align: 'center' },
  )
  y += 6.5
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  const address = settings?.address ?? ''
  if (address) {
    doc.text(address.toUpperCase(), PAGE_W / 2, y, { align: 'center' })
    y += 5.5
  }
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.text(`RIPOTI YA MATOKEO - ${exam.name.toUpperCase()}`, PAGE_W / 2, y, {
    align: 'center',
  })
  y += 3
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2])
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  return y + 5
}

function drawInfoBlock(
  doc: jsPDF,
  y: number,
  card: ReportCard,
  form: Form,
  dateStr: string,
): number {
  doc.setFillColor(INFO_FILL[0], INFO_FILL[1], INFO_FILL[2])
  doc.rect(MARGIN, y, CONTENT_W, 6.5, 'F')
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  doc.text(`JINA: ${card.fullName}`, MARGIN + 2, y + 4.5)
  y += 6.5
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  doc.rect(MARGIN, y, 120, 6, 'F')
  doc.rect(MARGIN + 120, y, 70, 6, 'F')
  doc.text(
    `Kidato: Form ${form.slice(1)}   |   Mkondo: ${card.stream}   |   Jinsia: ${card.sex}`,
    MARGIN + 2,
    y + 4.2,
  )
  doc.text(
    `Tarehe: ${dateStr}   |   Wastani: ${card.avg.toFixed(2)}%`,
    MARGIN + 188,
    y + 4.2,
    { align: 'right' },
  )
  return y + 11
}

function drawSummaryLine(
  doc: jsPDF,
  y: number,
  card: ReportCard,
  cohort: number,
): number {
  doc.setFillColor(INFO_FILL[0], INFO_FILL[1], INFO_FILL[2])
  doc.rect(MARGIN, y, CONTENT_W, 6, 'F')
  doc.setFont('times', 'bold')
  doc.setFontSize(9.5)
  doc.text(
    `GPA: ${card.gpa.toFixed(2)}   |   Nafasi: ${card.position} / ${cohort}   |   Jumla Pointi: ${card.totalPoints}   |   Division: ${card.division}`,
    MARGIN + CONTENT_W - 2,
    y + 4.2,
    { align: 'right' },
  )
  return y + 11
}

function drawWrapped(
  doc: jsPDF,
  y: number,
  title: string,
  text: string,
  filled: boolean,
): number {
  doc.setFont('times', 'bold')
  doc.setFontSize(10)
  doc.text(title, PAGE_W / 2, y, { align: 'center' })
  y += 5.5
  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  const lines = doc.splitTextToSize(text, CONTENT_W - 4) as string[]
  if (filled) {
    doc.setFillColor(MSG_FILL[0], MSG_FILL[1], MSG_FILL[2])
    doc.rect(MARGIN, y - 3.8, CONTENT_W, lines.length * 5 + 2.5, 'F')
  }
  doc.setTextColor(30, 30, 30)
  for (const line of lines) {
    doc.text(line, MARGIN + 2, y + 1)
    y += 5
  }
  return y + 3
}

function drawSignatures(doc: jsPDF, y: number): void {
  const sigY = Math.max(y + 4, PAGE_H - 34)
  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.3)
  const col = CONTENT_W / 3
  const s = '_______________________'
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  for (let i = 0; i < 3; i++) {
    doc.text(s, MARGIN + col * i + col / 2, sigY, { align: 'center' })
  }
  doc.setFont('times', 'bold')
  doc.setFontSize(9)
  const labels = ['MWALIMU WA DARASA', 'MWALIMU WA TAALUMA', 'MKUU WA SHULE']
  for (let i = 0; i < 3; i++) {
    doc.text(labels[i], MARGIN + col * i + col / 2, sigY + 5.5, {
      align: 'center',
    })
  }
  doc.setFont('times', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  doc.text(
    `Ripoti hii imetolewa na Ofisi ya Taaluma | Tarehe: ${fmtDate(new Date().toISOString().slice(0, 10))}`,
    PAGE_W / 2,
    PAGE_H - 8,
    { align: 'center' },
  )
  doc.setTextColor(30, 30, 30)
}

async function buildPdf(
  exam: Exam,
  form: Form,
  settings: SchoolSettings | null,
): Promise<void> {
  const level: ResultLevel = formLevel(form)
  const [
    studRes,
    subjRes,
    marksRes,
    resRes,
    combosRes,
    scRes,
  ] = await Promise.all([
    supabase.from('students').select('*').eq('form', form).eq('status', 'active'),
    supabase.from('subjects').select('*'),
    paginate(async ({ from, to }) =>
      supabase.from('exam_marks').select('*').eq('exam_id', exam.id).range(from, to),
    ),
    supabase.from('exam_results').select('*').eq('exam_id', exam.id).eq('form', form),
    supabase.from('combinations').select('*'),
    supabase.from('student_combinations').select('student_id, combination_id'),
  ])
  if (studRes.error) throw new Error(studRes.error.message)
  if (marksRes.error) throw new Error(marksRes.error.message)
  if (resRes.error) throw new Error(resRes.error.message)

  const results = (resRes.data ?? []) as {
    student_id: string
    form: Form
    level: ResultLevel
    division: string
    total_points: number
  }[]
  if (results.length === 0)
    throw new Error('No processed results for this exam.')

  const students = ((studRes.data ?? []) as Student[]).filter((s) =>
    results.some((r) => r.student_id === s.id),
  )
  const studentById = new Map(students.map((s) => [s.id, s]))
  const subjects = (subjRes.data ?? []) as Subject[]
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const subjectTypes = new Map<string, SubjectType>(
    subjects.map((s) => [s.id, s.type]),
  )
  const marks = (marksRes.data ?? []) as ExamMark[]
  const marksByStudent = new Map<string, ExamMark[]>()
  for (const m of marks) {
    const arr = marksByStudent.get(m.student_id) ?? []
    arr.push(m)
    marksByStudent.set(m.student_id, arr)
  }
  const comboById = new Map(
    ((combosRes.data ?? []) as Combination[]).map((c) => [c.id, c]),
  )
  const comboByStudent = new Map(
    ((scRes.data ?? []) as { student_id: string; combination_id: string }[]).map(
      (sc) => [sc.student_id, sc.combination_id],
    ),
  )

  const avgByStudent = new Map<string, number>()
  for (const r of results) {
    const totals = (marksByStudent.get(r.student_id) ?? [])
      .map(subjectTotalMark)
      .filter((t): t is number => t != null)
    const avg =
      totals.length > 0
        ? totals.reduce((s, t) => s + t, 0) / totals.length
        : 0
    avgByStudent.set(r.student_id, avg)
  }
  const positionByStudent = rankCohort(
    results.map((r) => ({
      student_id: r.student_id,
      total_points: r.total_points,
      avg: avgByStudent.get(r.student_id) ?? 0,
    })),
  )
  const cohort = results.length

  const histResultsRes = await supabase
    .from('exam_results')
    .select('exam_id, student_id, total_points, division')
    .eq('form', form)
    .neq('exam_id', exam.id)
  const histResults = (histResultsRes.data ?? []) as {
    exam_id: string
    student_id: string
    total_points: number
    division: string
  }[]
  const histExamIds = [...new Set(histResults.map((r) => r.exam_id))]
  const histExams = new Map<string, { name: string; start_date: string }>()
  const histSumByExamStudent = new Map<string, Map<string, number>>()
  const histCountByExamStudent = new Map<string, Map<string, number>>()
  if (histExamIds.length > 0) {
    const [hxRes, hmRes] = await Promise.all([
      supabase
        .from('exams')
        .select('id, name, start_date')
        .in('id', histExamIds),
      supabase
        .from('exam_marks')
        .select('exam_id, student_id, theory, practical, absent')
        .in('exam_id', histExamIds),
    ])
    for (const e of (hxRes.data ?? []) as {
      id: string
      name: string
      start_date: string
    }[]) {
      histExams.set(e.id, { name: e.name, start_date: e.start_date })
    }
    for (const m of (hmRes.data ?? []) as ExamMark[]) {
      const total = subjectTotalMark(m)
      if (total == null) continue
      const sums = histSumByExamStudent.get(m.exam_id) ?? new Map()
      const counts = histCountByExamStudent.get(m.exam_id) ?? new Map()
      sums.set(m.student_id, (sums.get(m.student_id) ?? 0) + total)
      counts.set(m.student_id, (counts.get(m.student_id) ?? 0) + 1)
      histSumByExamStudent.set(m.exam_id, sums)
      histCountByExamStudent.set(m.exam_id, counts)
    }
  }

  const histAvg = (examId: string, studentId: string): number => {
    const sum = histSumByExamStudent.get(examId)?.get(studentId)
    const count = histCountByExamStudent.get(examId)?.get(studentId) ?? 0
    return sum != null && count > 0 ? sum / count : 0
  }

  const cards: ReportCard[] = []
  for (const r of results) {
    const student = studentById.get(r.student_id)
    if (!student) continue
    const myMarks = marksByStudent.get(r.student_id) ?? []
    const rows: SubjectRow[] = []
    const totals: number[] = []
    const points: number[] = []
    for (const m of myMarks) {
      const subject = subjectById.get(m.subject_id)
      if (!subject) continue
      const total = subjectTotalMark(m)
      if (total == null) {
        rows.push({
          name: subject.name,
          mark: 'ABS',
          grade: '-',
          point: '-',
          remark: '-',
        })
        continue
      }
      const grade = gradeForMark(total, level) ?? 'F'
      const point = pointsForMark(total, level)
      totals.push(total)
      points.push(point)
      rows.push({
        name: subject.name,
        mark: String(total),
        grade,
        point: String(point),
        remark: REMARKS[grade] ?? '-',
      })
    }
    rows.sort((a, b) => a.name.localeCompare(b.name))
    const avg = avgByStudent.get(r.student_id) ?? 0
    const gpa =
      points.length > 0
        ? points.reduce((s, p) => s + p, 0) / points.length
        : 0
    const entries: StudentMarkEntry[] = myMarks.map((m) => ({
      subject_id: m.subject_id,
      theory: m.theory,
      practical: m.practical,
      absent: m.absent,
    }))
    const comp = computeDivision(form, entries, subjectTypes)
    const totalPoints = comp?.points ?? r.total_points
    const division = comp?.division ?? r.division

    const myHistRaw = histResults.filter((h) => h.student_id === r.student_id)
    const history: HistRow[] = []
    for (const h of myHistRaw) {
      const hx = histExams.get(h.exam_id)
      if (!hx) continue
      const cohortRows = histResults
        .filter((x) => x.exam_id === h.exam_id)
        .map((x) => ({
          student_id: x.student_id,
          total_points: x.total_points,
          avg: histAvg(h.exam_id, x.student_id),
        }))
      const posMap = rankCohort(cohortRows)
      history.push({
        name: hx.name,
        date: hx.start_date,
        avg: histAvg(h.exam_id, h.student_id),
        pos: posMap.get(h.student_id) ?? 0,
        div: h.division || '-',
        pts: h.total_points,
        trend: '',
      })
    }
    history.sort((a, b) => b.date.localeCompare(a.date))
    for (let i = 0; i < history.length; i++) {
      if (i < history.length - 1) {
        const older = history[i + 1].avg
        history[i].trend =
          history[i].avg > older ? '+' : history[i].avg < older ? '-' : '-'
      } else {
        history[i].trend = '-'
      }
    }
    for (const h of history) h.date = fmtDate(h.date)

    const comboId = comboByStudent.get(r.student_id)
    const stream = comboId ? comboById.get(comboId)?.code ?? '-' : '-'

    cards.push({
      fullName: student.full_name,
      sex: student.gender,
      stream,
      avg,
      gpa,
      position: positionByStudent.get(r.student_id) ?? 0,
      totalPoints,
      division,
      rows,
      history,
      comment: schoolComment(avg),
      parentMsg: `Mzazi mpendwa wa ${student.full_name}, matokeo ya '${exam.name}' yamehitimishwa. Amepata wastani wa ${avg.toFixed(2)}% nafasi ya ${positionByStudent.get(r.student_id) ?? 0} kati ya wanafunzi ${cohort}. ${parentAdvice(avg)}`,
    })
  }

  cards.sort((a, b) => a.position - b.position || a.fullName.localeCompare(b.fullName))

  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  for (const card of cards) {
    doc.addPage()
    let y = drawHeader(doc, exam, settings)
    y = drawInfoBlock(doc, y, card, form, fmtDate(exam.start_date))

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['SOMO', 'ALAMA', 'DARAJA', 'POINTI', 'MAONI']],
      body: card.rows.map((r) => [r.name, r.mark, r.grade, r.point, r.remark]),
      headStyles: {
        fillColor: HEAD_FILL,
        textColor: 0,
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
      },
      styles: {
        font: 'times',
        fontSize: 9.5,
        cellPadding: 1.5,
        textColor: [30, 30, 30],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: STRIPE_FILL },
      columnStyles: {
        0: { halign: 'left', cellWidth: 80 },
        1: { halign: 'center', cellWidth: 26 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 46 },
      },
    })

    y = drawSummaryLine(doc, finalY(doc) + 5, card, cohort)

    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.text(`Historia ya Mitihani - Form ${form.slice(1)}`, PAGE_W / 2, y, {
      align: 'center',
    })
    y += 4
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['MTIHANI', 'TAREHE', 'WASTANI', 'NAFASI', 'DIV', 'POINTI', 'MWE']],
      body:
        card.history.length > 0
          ? card.history.map((h) => [
              h.name,
              h.date,
              `${h.avg.toFixed(1)}%`,
              String(h.pos),
              h.div,
              String(h.pts),
              h.trend,
            ])
          : [
              [
                {
                  content: 'Hakuna matokeo ya mitihani ya awali.',
                  colSpan: 7,
                  styles: { halign: 'center' },
                },
              ],
            ],
      headStyles: {
        fillColor: HEAD_FILL,
        textColor: 0,
        fontStyle: 'bold',
        fontSize: 9.5,
        halign: 'center',
      },
      styles: {
        font: 'times',
        fontSize: 9,
        cellPadding: 1.5,
        textColor: [30, 30, 30],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: STRIPE_FILL },
      columnStyles: {
        0: { halign: 'left', cellWidth: 66 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 26 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'center', cellWidth: 14 },
      },
    })

    y = finalY(doc) + 6
    doc.setFont('times', 'bold')
    doc.setFontSize(10)
    doc.text('Tabia na Mwenendo', PAGE_W / 2, y, { align: 'center' })
    y += 4
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [['NO', 'MAELEZO', 'ALAMA', 'NO', 'MAELEZO', 'ALAMA']],
      body: BEHAVIOR_ROWS.map((r) => [
        r[0],
        r[1],
        '____',
        String(Number(r[0]) + 4),
        r[2],
        '____',
      ]),
      headStyles: {
        fillColor: HEAD_FILL,
        textColor: 0,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      styles: {
        font: 'times',
        fontSize: 8.5,
        cellPadding: 1.5,
        textColor: [30, 30, 30],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: STRIPE_FILL },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        1: { halign: 'left', cellWidth: 63 },
        2: { halign: 'center', cellWidth: 23 },
        3: { halign: 'center', cellWidth: 9 },
        4: { halign: 'left', cellWidth: 63 },
        5: { halign: 'center', cellWidth: 23 },
      },
    })

    y = finalY(doc) + 6
    y = drawWrapped(doc, y, 'Maoni ya Shule', card.comment, false)
    y = drawWrapped(
      doc,
      y,
      'Ujumbe kwa Mzazi / Mlezi',
      `Pointi: ${card.totalPoints} | GPA: ${card.gpa.toFixed(2)} | Nafasi: ${card.position} / ${cohort} | Wastani: ${card.avg.toFixed(1)}%\n${card.parentMsg}`,
      true,
    )
    drawSignatures(doc, y)
  }

  const safeName = exam.name.replace(/[\\/:*?"<>|]/g, '').trim()
  doc.save(`Ripoti_${safeName}_Kidato_${form.slice(1)}.pdf`)
}

export default function Reports() {
  const [selectedForm, setSelectedForm] = useState<Form | null>(null)
  const [exams, setExams] = useState<ExamOption[]>([])
  const [loadingExams, setLoadingExams] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(
    null,
  )

  async function chooseForm(f: Form) {
    setSelectedForm(f)
    setLoadingExams(true)
    setExams([])
    const [exRes, prRes] = await Promise.all([
      supabase.from('exams').select('*').order('start_date', { ascending: false }),
      supabase.from('exam_results').select('exam_id').eq('form', f),
    ])
    if (exRes.error) {
      setFlash({ type: 'error', text: exRes.error.message })
    } else {
      const processed = new Set(
        ((prRes.data ?? []) as { exam_id: string }[]).map((r) => r.exam_id),
      )
      setExams(
        ((exRes.data ?? []) as Exam[])
          .filter((e) => e.forms.includes(f))
          .map((e) => ({ ...e, processed: processed.has(e.id) })),
      )
    }
    setLoadingExams(false)
  }

  async function generate(exam: ExamOption) {
    if (!selectedForm) return
    setGeneratingId(exam.id)
    try {
      const sRes = await supabase
        .from('school_settings')
        .select('*')
        .maybeSingle()
      if (sRes.error) throw new Error(sRes.error.message)
      await buildPdf(exam, selectedForm, sRes.data as SchoolSettings | null)
    } catch (err) {
      setFlash({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not generate the report.',
      })
    } finally {
      setGeneratingId(null)
    }
  }

  return (
    <div className="reports-page">
      <header className="page-head">
        <h2>Student Reports</h2>
        <p>
          Select a form, then an exam to download reports for all students in
          that form.
        </p>
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

      {!selectedForm ? (
        <section className="panel">
          <h3>Select Form</h3>
          <div className="reports-grid">
            {FORMS.map((f) => (
              <button
                key={f}
                type="button"
                className="report-form-btn"
                onClick={() => chooseForm(f)}
              >
                Form {f.slice(1)}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="page-tools no-print">
            <button
              type="button"
              className="signin-btn"
              onClick={() => setSelectedForm(null)}
            >
              <ArrowLeft size={18} />
              Change form
            </button>
          </div>

          <section className="panel">
            <h3>
              Select Exam — Form {selectedForm.slice(1)}
            </h3>
            {loadingExams ? (
              <div className="list-state">
                <Loader2 size={20} className="spin" />
                Loading exams...
              </div>
            ) : exams.length === 0 ? (
              <div className="list-state">
                No exams registered for this form.
              </div>
            ) : (
              <div className="reports-exam-list">
                {exams.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="reports-exam-item"
                    disabled={!e.processed || generatingId !== null}
                    onClick={() => generate(e)}
                  >
                    <span className="reports-exam-name">{e.name}</span>
                    <span className="reports-exam-meta">
                      {fmtDate(e.start_date)}
                      {generatingId === e.id && (
                        <Loader2 size={15} className="spin" />
                      )}
                      {!e.processed && <em>Process results first</em>}
                      {e.processed && generatingId !== e.id && (
                        <>
                          <FileDown size={15} /> Download report
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
