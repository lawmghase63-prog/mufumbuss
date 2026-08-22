import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Loader2,
  Upload,
  FileText,
  Trash2,
  Download,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import FlashMessage from '../components/FlashMessage'
import ConfirmDialog from '../components/ConfirmDialog'
import './JoiningInstructions.css'

export interface JoiningDoc {
  id: string
  level: 'O' | 'A'
  title: string
  file_path: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

const ACCEPTED = '.pdf,.doc,.docx,.png,.jpg,.jpeg'

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function levelLabel(level: JoiningDoc['level']): string {
  return level === 'O' ? 'O-Level' : 'A-Level'
}

export default function JoiningInstructions() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<JoiningDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<'O' | 'A'>('O')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [flash, setFlash] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [confirmDoc, setConfirmDoc] = useState<JoiningDoc | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await supabase
      .from('joining_instructions')
      .select('*')
      .order('level', { ascending: true })
      .order('created_at', { ascending: false })
    if (!res.error) setDocs((res.data as JoiningDoc[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) {
      setFlash({ type: 'error', text: 'Choose a document to upload.' })
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setFlash({ type: 'error', text: 'File is too large. Maximum is 15 MB.' })
      return
    }
    setUploading(true)
    setFlash(null)

    const finalTitle =
      title.trim() || `Joining Instructions – ${levelLabel(level)} ${new Date().getFullYear()}`
    const safeName = file.name.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '-')
    const path = `joining/${level}/${Date.now()}-${safeName}`

    const upRes = await supabase.storage.from('documents').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })
    if (upRes.error) {
      setUploading(false)
      const msg = (upRes.error as { message?: string }).message ?? 'unknown error'
      setFlash({ type: 'error', text: `Upload failed: ${msg}` })
      return
    }

    const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)
    const insRes = await supabase.from('joining_instructions').insert({
      level,
      title: finalTitle,
      file_path: path,
      file_url: pub.publicUrl,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user?.id ?? null,
    })
    if (insRes.error) {
      await supabase.storage.from('documents').remove([path])
      setUploading(false)
      setFlash({ type: 'error', text: `Could not save record: ${insRes.error.message}` })
      return
    }

    setUploading(false)
    setTitle('')
    setFile(null)
    const input = document.querySelector<HTMLInputElement>('#ji-file')
    if (input) input.value = ''
    await load()
    setFlash({ type: 'ok', text: `${finalTitle} uploaded and published.` })
  }

  async function handleDelete(doc: JoiningDoc) {
    setConfirmDoc(null)
    await supabase.from('joining_instructions').delete().eq('id', doc.id)
    await supabase.storage.from('documents').remove([doc.file_path])
    await load()
    setFlash({ type: 'ok', text: `"${doc.title}" removed.` })
  }

  const oDocs = docs.filter((d) => d.level === 'O')
  const aDocs = docs.filter((d) => d.level === 'A')

  return (
    <div className="ji-page">
      <header className="page-head">
        <h2>Joining Instructions</h2>
        <p>
          Upload official joining instruction documents. Files published here appear on the
          public school website for parents and students to download.
        </p>
      </header>

      <div className="page-flash">
        {flash && (
          <FlashMessage type={flash.type} text={flash.text} onDismiss={() => setFlash(null)} />
        )}
      </div>

      <section className="panel ji-upload-panel">
        <form className="ji-upload-form" onSubmit={handleUpload}>
          <label className="ji-field">
            <span className="field-label">Level</span>
            <select value={level} onChange={(e) => setLevel(e.target.value as 'O' | 'A')}>
              <option value="O">O-Level (Form 1 – 4)</option>
              <option value="A">A-Level (Form 5 – 6)</option>
            </select>
          </label>

          <label className="ji-field ji-grow">
            <span className="field-label">Title (optional)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Joining Instructions – ${levelLabel(level)}`}
              maxLength={120}
            />
          </label>

          <label className="ji-field ji-grow">
            <span className="field-label">Document (PDF / DOC / Image, max 15 MB)</span>
            <input
              id="ji-file"
              type="file"
              accept={ACCEPTED}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button type="submit" className="btn btn-primary ji-upload-btn" disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 size={17} className="spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={17} />
                Upload &amp; Publish
              </>
            )}
          </button>
        </form>
      </section>

      {loading ? (
        <div className="list-state">
          <Loader2 size={20} className="spin" />
        </div>
      ) : (
        <>
          <section className="panel ji-level-section">
            <div className="list-head">
              <h3>O-Level Documents ({oDocs.length})</h3>
              <button type="button" className="refresh-btn" onClick={load}>
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
            {oDocs.length === 0 ? (
              <p className="table-empty">No O-Level joining instructions uploaded yet.</p>
            ) : (
              <ul className="ji-doc-list">
                {oDocs.map((d) => (
                  <li key={d.id} className="ji-doc-row">
                    <span className="ji-doc-icon">
                      <FileText size={19} />
                    </span>
                    <div className="ji-doc-meta">
                      <strong>{d.title}</strong>
                      <small>
                        {d.file_name} {fmtSize(d.size_bytes) && `· ${fmtSize(d.size_bytes)}`} ·{' '}
                        {fmtDate(d.created_at)}
                      </small>
                    </div>
                    <div className="ji-doc-actions">
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="row-act"
                        title="Download / view"
                      >
                        <Download size={16} />
                      </a>
                      <button
                        type="button"
                        className="row-act row-del"
                        title="Delete"
                        onClick={() => setConfirmDoc(d)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel ji-level-section">
            <div className="list-head">
              <h3>A-Level Documents ({aDocs.length})</h3>
            </div>
            {aDocs.length === 0 ? (
              <p className="table-empty">No A-Level joining instructions uploaded yet.</p>
            ) : (
              <ul className="ji-doc-list">
                {aDocs.map((d) => (
                  <li key={d.id} className="ji-doc-row">
                    <span className="ji-doc-icon a">
                      <FileText size={19} />
                    </span>
                    <div className="ji-doc-meta">
                      <strong>{d.title}</strong>
                      <small>
                        {d.file_name} {fmtSize(d.size_bytes) && `· ${fmtSize(d.size_bytes)}`} ·{' '}
                        {fmtDate(d.created_at)}
                      </small>
                    </div>
                    <div className="ji-doc-actions">
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="row-act"
                        title="Download / view"
                      >
                        <Download size={16} />
                      </a>
                      <button
                        type="button"
                        className="row-act row-del"
                        title="Delete"
                        onClick={() => setConfirmDoc(d)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {confirmDoc && (
        <ConfirmDialog
          title="Delete document?"
          message={`"${confirmDoc.title}" will be removed from the website permanently.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(confirmDoc)}
          onCancel={() => setConfirmDoc(null)}
        />
      )}
    </div>
  )
}
