import type { ChangeEvent } from 'react'
import { X, Download, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react'
import { buildTemplateCsv, downloadCsv, type ImportSummary } from '../lib/students'

export default function ImportCsvModal({
  importing,
  summary,
  onFile,
  onClose,
}: {
  importing: boolean
  summary: ImportSummary | null
  onFile: (e: ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 id="import-modal-title">Import from CSV</h3>
            <p className="modal-sub">Register many students at once.</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="import-body">
          <button
            type="button"
            className="template-btn"
            onClick={() => downloadCsv(buildTemplateCsv(), 'students_template.csv')}
          >
            <Download size={16} />
            Download template
          </button>

          <label className="file-drop">
            <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
            <FileSpreadsheet size={20} />
            <span>{importing ? 'Importing...' : 'Choose CSV file'}</span>
          </label>

          <details className="import-help" open>
            <summary>How to fill the template?</summary>
            <ul>
              <li>
                Keep the header row: <code>full_name,gender,form,parent_phone</code>.
              </li>
              <li>
                <strong>gender</strong> — use <code>M</code> or <code>F</code> only.
              </li>
              <li>
                <strong>form</strong> — use <code>F1</code> to <code>F6</code> (e.g.{' '}
                <code>F3</code>).
              </li>
              <li>Admission numbers are generated automatically — do not include them.</li>
              <li>Do not use commas inside a name.</li>
              <li>Leave <code>parent_phone</code> empty if unknown.</li>
            </ul>
          </details>

          {summary && (
            <div
              className={`import-result${summary.errors.length ? ' has-errors' : ''}`}
            >
              <p>
                <CheckCircle2 size={16} />
                {summary.imported} imported
                {summary.errors.length > 0 && (
                  <>
                    <XCircle size={16} />
                    {summary.errors.length} errors
                  </>
                )}
              </p>
              {summary.errors.length > 0 && (
                <div className="import-errors">
                  {summary.errors.map((er, idx) => (
                    <div key={idx}>
                      Line {er.line}: {er.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="button" className="signin-btn modal-save" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
