import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Clock,
  GraduationCap,
  BookOpen,
  Users,
  Trophy,
  ArrowRight,
  ChevronDown,
  Eye,
  Target,
  Sparkles,
  CheckCircle2,
  FileText,
  Camera,
  Landmark,
  Download,
  Construction,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { JoiningDoc } from './JoiningInstructions'
import type { Subject, Combination } from '../lib/subjects'
import { subjectName } from '../lib/subjects'
import logo from '../assets/logo.png'
import './Landing.css'

/* ==========================================================
   EDIT SCHOOL CONTENT HERE — swap these values anytime
   ========================================================== */
const CONTENT = {
  name: 'Mufumbu Secondary School',
  shortName: 'Mufumbu S.S.',
  motto: 'Education Is a Key to Life',
  vision:
    'To be a centre of academic excellence that produces disciplined, knowledgeable and self-reliant graduates who serve their nation with integrity.',
  mission:
    'To provide quality education through dedicated teaching, a conducive learning environment and strong partnership between school, parents and the community.',
  about:
    'Mufumbu Secondary School is a co-educational government school offering both Ordinary (O-Level) and Advanced (A-Level) secondary education. We are committed to nurturing academic excellence, discipline and talent so that every student reaches their full potential.',
  stats: [
    { icon: Users, value: '500+', label: 'Students' },
    { icon: GraduationCap, value: 'F1 – F6', label: 'O & A Level' },
    { icon: BookOpen, value: '15+', label: 'Subjects' },
    { icon: Trophy, value: 'Top', label: 'District Performer' },
  ],
  coreValues: ['Discipline', 'Hard work', 'Integrity', 'Cooperation', 'Excellence'],
  joiningSteps: [
    {
      title: 'Get your selection letter',
      text: 'Collect your admission/selection letter from the school office or download it from NECTA/selform after Form Four results.',
    },
    {
      title: 'Report on the announced date',
      text: 'New students report on the date announced by the school / Ministry. Report before 2:00 PM with all requirements.',
    },
    {
      title: 'Bring required documents',
      text: 'Birth certificate, primary/previous school leaving certificate, selection letter and passport-size photos.',
    },
    {
      title: 'Clear joining fees',
      text: 'Pay the prescribed school contribution via the official school bank account or mobile money and bring the receipt.',
    },
  ],
  requirements: [
    'School uniform (as per school specification)',
    'Mattress, bed sheet and blanket',
    'Bucket, soap and toiletries',
    'Exercise books, pens and mathematical set',
    'Birth certificate copy (photocopy)',
    'Two passport-size photographs',
    'Fee receipt / bank pay-in slip',
  ],
  contacts: {
    address: 'P.O. Box 155, Iramba, Singida',
    phone: '+255 700 000 000',
    email: 'info@mufumbuss.ac.tz',
    hours: 'Mon – Fri: 7:30 AM – 4:00 PM',
  },
}
/* ========================================================== */

type PhotoModule = { default: string }

const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#academics', label: 'Academics' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#admissions', label: 'Admissions' },
  { href: '#contact', label: 'Contact' },
]

const O_FORMS = ['F1', 'F2', 'F3', 'F4'] as const

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [docs, setDocs] = useState<JoiningDoc[]>([])
  const [showBanner, setShowBanner] = useState(true)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase
        .from('joining_instructions')
        .select('*')
        .order('level', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase.from('subjects').select('*'),
      supabase.from('combinations').select('*').order('code', { ascending: true }),
    ]).then(([docsRes, subjRes, combosRes]) => {
      if (!alive) return
      if (!docsRes.error) setDocs((docsRes.data as JoiningDoc[]) ?? [])
      if (!subjRes.error) setSubjects((subjRes.data as Subject[]) ?? [])
      if (!combosRes.error) setCombinations((combosRes.data as Combination[]) ?? [])
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const photos = useMemo<string[]>(() => {
    const mods = import.meta.glob<PhotoModule>('../assets/gallery/*.{png,jpg,jpeg,webp}', {
      eager: true,
    })
    return Object.values(mods)
      .map((m) => m.default)
      .slice(0, 8)
  }, [])

  const oSubjectsByForm = useMemo<Record<string, Subject[]>>(() => {
    const out: Record<string, Subject[]> = {}
    for (const f of O_FORMS) {
      out[f] = subjects
        .filter((s) => s.type === 'o' && s.forms?.includes(f))
        .sort((a, b) => a.code.localeCompare(b.code))
    }
    return out
  }, [subjects])

  const anySubjects = subjects.length > 0
  const anyCombos = combinations.length > 0

  return (
    <div className="land">
      {/* ---------- Navbar ---------- */}
      <header className={scrolled ? 'land-nav scrolled' : 'land-nav'}>
        <div className="land-nav-inner">
          <a href="#home" className="land-brand">
            <img src={logo} alt="School logo" />
            <span>
              <strong>Mufumbu</strong>
              <small>Secondary School</small>
            </span>
          </a>

          <nav className={menuOpen ? 'land-links open' : 'land-links'}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
            <Link to="/login" className="land-signin">
              Staff Sign In
              <ArrowRight size={15} />
            </Link>
          </nav>

          <button
            type="button"
            className="land-burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section id="home" className="land-hero">
        <div className="hero-overlay" aria-hidden="true" />
        {showBanner && (
          <div className="construction-banner" role="status">
            <Construction size={15} />
            <span>Site Under Construction</span>
            <button
              type="button"
              className="banner-close"
              onClick={() => setShowBanner(false)}
              aria-label="Dismiss notice"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="hero-content reveal in">
          <span className="hero-motto-chip">
            <Sparkles size={14} />
            {`"${CONTENT.motto}"`}
          </span>
          <h1>
            Karibu <em>{CONTENT.shortName}</em> — Home of
            <br />
            Discipline &amp; Excellence
          </h1>
          <p>
            A leading O-Level and A-Level school dedicated to building knowledgeable,
            disciplined and self-reliant graduates.
          </p>
          <div className="hero-cta">
            <a href="#admissions" className="btn-gold">
              Joining Instructions
              <ArrowRight size={17} />
            </a>
            <a href="#contact" className="btn-outline">
              Contact Us
            </a>
          </div>
        </div>
        <a href="#about" className="hero-scroll" aria-label="Scroll down">
          <ChevronDown size={20} />
        </a>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="land-stats-wrap">
        <div className="land-container">
          <div className="land-stats reveal">
            {CONTENT.stats.map(({ icon: Icon, value, label }) => (
              <div className="stat-card" key={label}>
                <span className="stat-icon">
                  <Icon size={20} />
                </span>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Motto banner ---------- */}
      <section className="motto-banner">
        <Landmark size={26} className="motto-mark" aria-hidden="true" />
        <p>{CONTENT.motto}</p>
        <span>— School Motto —</span>
      </section>

      {/* ---------- About + Vision/Mission ---------- */}
      <section id="about" className="land-section">
        <div className="land-container">
          <div className="section-head reveal">
            <span className="eyebrow">About Our School</span>
            <h2>
              Building tomorrow&apos;s leaders, <em>today</em>
            </h2>
            <p>{CONTENT.about}</p>
          </div>

          <div className="vm-grid">
            <article className="vm-card reveal">
              <span className="vm-icon vision">
                <Eye size={24} />
              </span>
              <h3>Our Vision</h3>
              <p>{CONTENT.vision}</p>
            </article>
            <article className="vm-card reveal">
              <span className="vm-icon mission">
                <Target size={24} />
              </span>
              <h3>Our Mission</h3>
              <p>{CONTENT.mission}</p>
            </article>
          </div>

          <div className="values-row reveal">
            {CONTENT.coreValues.map((v) => (
              <span className="value-chip" key={v}>
                <CheckCircle2 size={14} />
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Academics ---------- */}
      <section id="academics" className="land-section alt">
        <div className="land-container">
          <div className="section-head reveal">
            <span className="eyebrow">Academics</span>
            <h2>
              Two levels, one <em>standard of excellence</em>
            </h2>
          </div>

          <div className="acad-grid">
            <article className="acad-card reveal">
              <span className="acad-badge">O-Level</span>
              <h3>Ordinary Level (Form 1 – 4)</h3>
              <p>
                Subjects offered across each form, taught by qualified and committed
                teachers following the national curriculum with continuous assessment.
              </p>
              {anySubjects ? (
                <div className="subject-forms">
                  {O_FORMS.map((f) => (
                    <div className="subject-form" key={f}>
                      <h4>Form {f.slice(1)}</h4>
                      <div className="subject-chips">
                        {(oSubjectsByForm[f] ?? []).length > 0 ? (
                          oSubjectsByForm[f].map((s) => (
                            <span className="subject-chip" key={s.id} title={s.name}>
                              {s.code}
                            </span>
                          ))
                        ) : (
                          <span className="subject-chip empty">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ul>
                  <li>Core sciences, business and arts subjects</li>
                  <li>Practical laboratory sessions</li>
                  <li>Counselling &amp; guidance programme</li>
                </ul>
              )}
            </article>

            <article className="acad-card reveal">
              <span className="acad-badge gold">A-Level</span>
              <h3>Advanced Level (Form 5 – 6)</h3>
              <p>
                Specialist subject combinations that prepare students for higher learning
                institutions in Tanzania and beyond.
              </p>
              {anyCombos ? (
                <div className="combo-list">
                  {combinations.map((c) => (
                    <div className="combo-item" key={c.id}>
                      <span className="combo-code">{c.code}</span>
                      <span className="combo-desc">
                        {c.core_subjects
                          .map((code) => subjectName(subjects, code))
                          .join(', ')}
                        {c.subsidiary_subjects.length > 0 && (
                          <>
                            {' '}
                            <small>
                              +{' '}
                              {c.subsidiary_subjects
                                .map((code) => subjectName(subjects, code))
                                .join(', ')}
                            </small>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <ul>
                  <li>Focused combination teaching</li>
                  <li>Intensive exam preparation</li>
                  <li>Career &amp; university guidance</li>
                </ul>
              )}
            </article>
          </div>
        </div>
      </section>

      {/* ---------- Gallery ---------- */}
      <section id="gallery" className="land-section">
        <div className="land-container">
          <div className="section-head reveal">
            <span className="eyebrow">Gallery</span>
            <h2>
              Life at <em>Mufumbu</em>
            </h2>
            <p>A glimpse of our classrooms, ceremonies and school environment.</p>
          </div>
          {photos.length > 0 ? (
            <div className="gallery-grid reveal">
              {photos.map((src, i) => (
                <figure className={`gallery-item g${i % 5}`} key={src}>
                  <img src={src} alt={`School photo ${i + 1}`} loading="lazy" />
                </figure>
              ))}
            </div>
          ) : (
            <div className="gallery-empty reveal">
              <Camera size={30} />
              <p>School photos will be published here soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Joining instructions ---------- */}
      <section id="admissions" className="land-section alt">
        <div className="land-container">
          <div className="section-head reveal">
            <span className="eyebrow">Admissions</span>
            <h2>
              Joining <em>instructions</em>
            </h2>
            <p>Four simple steps to join Mufumbu Secondary School.</p>
          </div>

          <div className="docs-block reveal">
            <h3 className="docs-title">Official joining instruction documents</h3>
            {docs.length > 0 ? (
              <div className="docs-grid">
                {docs.map((d) => (
                  <a
                    key={d.id}
                    href={d.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="doc-card"
                  >
                    <span className={d.level === 'O' ? 'doc-icon o' : 'doc-icon a'}>
                      <FileText size={20} />
                    </span>
                    <span className="doc-meta">
                      <strong>{d.title}</strong>
                      <small>
                        {d.level === 'O' ? 'O-Level (Form 1–4)' : 'A-Level (Form 5–6)'}
                        {d.size_bytes
                          ? ` · ${d.size_bytes < 1048576 ? `${Math.round(d.size_bytes / 1024)} KB` : `${(d.size_bytes / 1048576).toFixed(1)} MB`}`
                          : ''}
                      </small>
                    </span>
                    <span className="doc-download">
                      Download
                      <Download size={15} />
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="docs-empty">
                Official joining instruction documents will be published here soon. In the
                meantime, follow the steps below.
              </p>
            )}
          </div>

          <ol className="steps-grid">
            {CONTENT.joiningSteps.map((s, i) => (
              <li className="step-card reveal" key={s.title}>
                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="req-card reveal">
            <div className="req-head">
              <FileText size={20} />
              <h3>What to bring when reporting</h3>
            </div>
            <ul className="req-list">
              {CONTENT.requirements.map((r) => (
                <li key={r}>
                  <CheckCircle2 size={16} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Contacts ---------- */}
      <section id="contact" className="land-section">
        <div className="land-container">
          <div className="section-head reveal">
            <span className="eyebrow">Get In Touch</span>
            <h2>
              Contact <em>us</em>
            </h2>
            <p>We welcome parents, guardians and well-wishers at any time.</p>
          </div>
          <div className="contact-grid">
            <div className="contact-card reveal">
              <MapPin size={22} />
              <h3>Visit Us</h3>
              <p>{CONTENT.contacts.address}</p>
            </div>
            <div className="contact-card reveal">
              <Phone size={22} />
              <h3>Call Us</h3>
              <p>
                <a href={`tel:${CONTENT.contacts.phone.replace(/\s/g, '')}`}>
                  {CONTENT.contacts.phone}
                </a>
              </p>
            </div>
            <div className="contact-card reveal">
              <Mail size={22} />
              <h3>Email Us</h3>
              <p>
                <a href={`mailto:${CONTENT.contacts.email}`}>{CONTENT.contacts.email}</a>
              </p>
            </div>
            <div className="contact-card reveal">
              <Clock size={22} />
              <h3>Office Hours</h3>
              <p>{CONTENT.contacts.hours}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA strip ---------- */}
      <section className="join-strip">
        <h2>Ready to be part of Mufumbu family?</h2>
        <a href="#admissions" className="btn-gold big">
          Start Your Journey
          <ArrowRight size={18} />
        </a>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="land-footer">
        <div className="land-container footer-grid">
          <div className="footer-about">
            <a href="#home" className="land-brand footer-brand">
              <img src={logo} alt="School logo" />
              <span>
                <strong>Mufumbu</strong>
                <small>Secondary School</small>
              </span>
            </a>
            <p>{CONTENT.about}</p>
          </div>

          <div className="footer-col">
            <h4>Quick Links</h4>
            <a href="#home">Home</a>
            <a href="#about">About Us</a>
            <a href="#academics">Academics</a>
            <a href="#admissions">Joining Instructions</a>
            <Link to="/login">Staff Sign In</Link>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <span>
              <MapPin size={15} /> {CONTENT.contacts.address}
            </span>
            <span>
              <Phone size={15} /> {CONTENT.contacts.phone}
            </span>
            <span>
              <Mail size={15} /> {CONTENT.contacts.email}
            </span>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            &copy; {new Date().getFullYear()} {CONTENT.name}. All rights reserved.
          </p>
          <p>
            Powered by{' '}
            <Link to="/login" className="footer-system-link">
              Results Management System
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
