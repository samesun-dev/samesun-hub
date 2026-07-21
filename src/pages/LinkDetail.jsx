import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Code2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = { live: 'Live', degraded: 'Degraded', down: 'Down', beta: 'Beta' }
const STATUS_COLOR = { live: '#10b981', degraded: '#f59e0b', down: '#dc2626', beta: '#f5a623' }
const SECTION_LABEL = { automations: 'Automation', tools: 'Tool' }

export default function LinkDetail({ links, section, onRefresh }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const item = links.find((l) => l.slug === slug && l.section === section)

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto px-10 py-14">
        <p className="text-sm text-[#94a3b8]">Not found.</p>
        <Link to={`/${section}`} className="text-sm text-[#1d4ed8] mt-2 inline-block">← Back</Link>
      </div>
    )
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${item.name}"? This can't be undone.`)) return
    await supabase.from('links').delete().eq('id', item.id)
    onRefresh()
    navigate(`/${section}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-10 py-14">
      <Link to={`/${section}`} className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#475569] transition-colors mb-8">
        <ArrowLeft size={14} />
        All {section}
      </Link>

      <p className="text-xs font-mono uppercase tracking-wide text-[#94a3b8] mb-2">{SECTION_LABEL[section]}</p>

      <div className="flex items-center gap-3 mb-4">
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-4xl font-medium text-[#1e293b]">{item.name}</h1>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[item.status] ?? '#94a3b8' }} />
          <span className="text-sm text-[#64748b]">{STATUS_LABEL[item.status] ?? item.status}</span>
        </span>
      </div>

      <p className="text-[#64748b] leading-relaxed mb-8 text-[15px]">{item.description}</p>

      <div className="flex items-center gap-3 mb-10">
        {item.live_url && (
          <a href={item.live_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#1e293b] text-white hover:bg-[#334155] transition-colors">
            Open <ExternalLink size={13} />
          </a>
        )}
        {item.repo_url && (
          <a href={item.repo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-[#e2e8f0] text-[#475569] hover:border-[#94a3b8] transition-colors">
            <Code2 size={14} /> View source
          </a>
        )}
      </div>

      <div className="border-t border-[#f1f5f9] pt-6 flex flex-col gap-3 mb-8">
        <DetailRow label="Owner" value={item.owner} />
      </div>

      <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-[#dc2626] hover:underline">
        <Trash2 size={14} /> Delete
      </button>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-[#94a3b8] w-28 shrink-0">{label}</span>
      <span className="text-[#1e293b] font-medium">{value}</span>
    </div>
  )
}
