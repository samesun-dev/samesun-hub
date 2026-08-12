import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, FileText, Download, DownloadCloud, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import FilesTabs from '../components/FilesTabs'

const SECTION = 'files'

// Canonical display order for the report-type list; anything else (e.g. a
// future report type) is appended alphabetically after these.
const REPORT_TYPE_ORDER = ['Order Items', 'Manager Report', 'Ledger Report']

function formatBytes(bytes) {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatMonth(sortableMonth) {
  const [year, month] = sortableMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function sortReportTypes(types) {
  return [...types].sort((a, b) => {
    const ai = REPORT_TYPE_ORDER.indexOf(a)
    const bi = REPORT_TYPE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export default function ByMonth() {
  const { '*': pathParam } = useParams()
  const navigate = useNavigate()
  const [months, setMonths] = useState([])
  const [reportTypes, setReportTypes] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  const segments = (pathParam ?? '').split('/').filter(Boolean)
  const month = segments[0] ?? null
  const reportTypeSlug = segments[1] ?? null

  const loadMonths = useCallback(async () => {
    const { data } = await supabase.from('documents').select('month').eq('section', SECTION).not('month', 'is', null)
    const unique = [...new Set((data ?? []).map((d) => d.month))].sort().reverse()
    setMonths(unique)
  }, [])

  const loadReportTypes = useCallback(async (forMonth) => {
    const { data } = await supabase
      .from('documents')
      .select('report_type')
      .eq('section', SECTION)
      .eq('month', forMonth)
      .not('report_type', 'is', null)
    const unique = [...new Set((data ?? []).map((d) => d.report_type))]
    setReportTypes(sortReportTypes(unique))
  }, [])

  const loadDocuments = useCallback(async (forMonth, forReportType) => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('section', SECTION)
      .eq('month', forMonth)
      .eq('report_type', forReportType)
      .order('city')
    setDocuments(data ?? [])
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      if (!month) {
        await loadMonths()
      } else if (!reportTypeSlug) {
        await loadReportTypes(month)
      } else {
        const { data } = await supabase
          .from('documents')
          .select('report_type')
          .eq('section', SECTION)
          .eq('month', month)
          .not('report_type', 'is', null)
        const matchedType = (data ?? []).map((d) => d.report_type).find((rt) => slugify(rt) === reportTypeSlug)
        if (matchedType) await loadDocuments(month, matchedType)
        else setDocuments([])
      }
      setLoading(false)
    }
    load()
  }, [month, reportTypeSlug, loadMonths, loadReportTypes, loadDocuments])

  async function handleDownload(doc) {
    const { data } = await supabase.storage.from('hub-files').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // Triggers each file as a direct download (not a new tab) via a
  // programmatic <a download> click, staggered slightly so browsers don't
  // throttle/block a burst of near-simultaneous downloads.
  async function handleDownloadAll() {
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      const { data } = await supabase.storage
        .from('hub-files')
        .createSignedUrl(doc.storage_path, 60, { download: doc.name })
      if (data?.signedUrl) {
        const link = document.createElement('a')
        link.href = data.signedUrl
        link.download = doc.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      if (i < documents.length - 1) await new Promise((r) => setTimeout(r, 200))
    }
  }

  function goToMonth(m) {
    navigate(`/files-by-month/${m}`)
  }

  function goToReportType(rt) {
    navigate(`/files-by-month/${month}/${slugify(rt)}`)
  }

  function goToBreadcrumb(index) {
    if (index < 0) navigate('/files-by-month')
    else if (index === 0) navigate(`/files-by-month/${month}`)
  }

  const currentReportTypeLabel = documents[0]?.report_type

  return (
    <div className="max-w-2xl mx-auto px-10 py-14">
      <p className="text-xs font-mono uppercase tracking-wide text-[#94a3b8] mb-2">Samesun Workspace</p>
      <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-4xl font-medium text-[#1e293b] mb-3">
        Files
      </h1>
      <p className="text-[#64748b] leading-relaxed mb-6">Imported Mews reports, browsed by month.</p>

      <FilesTabs />

      <div className="flex items-center gap-1.5 text-sm mb-6 text-[#94a3b8]">
        <button onClick={() => goToBreadcrumb(-1)} className="hover:text-[#1d4ed8] transition-colors">
          By Month
        </button>
        {month && (
          <span className="flex items-center gap-1.5">
            <ChevronRight size={13} />
            <button onClick={() => goToBreadcrumb(0)} className="hover:text-[#1d4ed8] transition-colors">
              {formatMonth(month)}
            </button>
          </span>
        )}
        {reportTypeSlug && (
          <span className="flex items-center gap-1.5">
            <ChevronRight size={13} />
            <span className="text-[#1e293b]">{currentReportTypeLabel ?? reportTypeSlug}</span>
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#94a3b8]">Loading…</p>
      ) : !month ? (
        <div className="flex flex-col">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => goToMonth(m)}
              className="group flex items-center justify-between gap-3 py-3 border-b border-[#f1f5f9] text-left"
            >
              <span className="flex items-center gap-3 flex-1 min-w-0">
                <Calendar size={18} className="text-[#94a3b8] shrink-0" />
                <span className="text-sm font-medium text-[#1e293b] truncate">{formatMonth(m)}</span>
              </span>
              <ChevronRight size={14} className="text-[#cbd5e1] shrink-0" />
            </button>
          ))}
          {months.length === 0 && (
            <p className="text-sm text-[#94a3b8] py-10">No imported reports yet.</p>
          )}
        </div>
      ) : !reportTypeSlug ? (
        <div className="flex flex-col">
          {reportTypes.map((rt) => (
            <button
              key={rt}
              onClick={() => goToReportType(rt)}
              className="group flex items-center justify-between gap-3 py-3 border-b border-[#f1f5f9] text-left"
            >
              <span className="text-sm font-medium text-[#1e293b] truncate">{rt}</span>
              <ChevronRight size={14} className="text-[#cbd5e1] shrink-0" />
            </button>
          ))}
          {reportTypes.length === 0 && (
            <p className="text-sm text-[#94a3b8] py-10">No reports for this month.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          {documents.length > 0 && (
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-1.5 self-start mb-4 px-3 py-1.5 rounded-lg bg-[#1e293b] text-white text-sm font-medium hover:bg-[#334155] transition-colors"
            >
              <DownloadCloud size={14} /> Download all ({documents.length})
            </button>
          )}
          {documents.map((doc) => (
            <div key={doc.id} className="group flex items-center justify-between gap-3 py-3 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText size={18} className="text-[#94a3b8] shrink-0" />
                <span className="text-sm font-medium text-[#1e293b] truncate">{doc.city}</span>
                <span className="text-xs text-[#cbd5e1] font-mono shrink-0">{formatBytes(doc.size_bytes)}</span>
              </div>
              <button
                onClick={() => handleDownload(doc)}
                className="text-[#94a3b8] hover:text-[#1d4ed8] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download size={15} />
              </button>
            </div>
          ))}
          {documents.length === 0 && (
            <p className="text-sm text-[#94a3b8] py-10">No files found for this report type.</p>
          )}
        </div>
      )}
    </div>
  )
}
