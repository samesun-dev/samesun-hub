import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const STATUS_LABEL = { live: 'Live', degraded: 'Degraded', down: 'Down', beta: 'Beta' }
const STATUS_COLOR = { live: '#10b981', degraded: '#f59e0b', down: '#dc2626', beta: '#f5a623' }

const LABELS = {
  automations: { title: 'Automations', desc: 'Scripts and workflows that run on their own.' },
  tools: { title: 'Tools', desc: 'Apps the team uses day to day.' },
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function LinkSectionPage({ section, links, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const items = links.filter(l => l.section === section)
  const { title, desc } = LABELS[section]

  return (
    <div className="max-w-2xl mx-auto px-10 py-14">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-[#94a3b8] mb-2">Samesun Workspace</p>
          <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-4xl font-medium text-[#1e293b]">
            {title}
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] text-white text-sm font-medium hover:bg-[#334155] transition-colors shrink-0 mt-1"
        >
          <Plus size={15} />
          Add
        </button>
      </div>
      <p className="text-[#64748b] leading-relaxed mb-12">{desc}</p>

      <div className="flex flex-col">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/${section}/${item.slug}`}
            className="group flex items-baseline justify-between gap-6 py-5 border-b border-[#f1f5f9] hover:border-[#e2e8f0] transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b] group-hover:text-[#1d4ed8] transition-colors">
                  {item.name}
                </h2>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[item.status] ?? '#94a3b8' }} />
                  <span className="text-[11px] text-[#94a3b8] font-mono">{STATUS_LABEL[item.status] ?? item.status}</span>
                </span>
              </div>
              <p className="text-sm text-[#64748b] mt-1 truncate">{item.description}</p>
            </div>
            <span className="text-sm text-[#94a3b8] group-hover:text-[#1d4ed8] transition-colors shrink-0">View →</span>
          </Link>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-[#94a3b8] py-10">Nothing here yet. Click Add to create the first one.</p>
        )}
      </div>

      {showAdd && (
        <AddLinkModal
          section={section}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh() }}
        />
      )}
    </div>
  )
}

function AddLinkModal({ section, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '', live_url: '', repo_url: '', status: 'live', owner: '' })
  const [saving, setSaving] = useState(false)
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('links').insert({
      slug: slugify(form.name),
      section,
      name: form.name.trim(),
      description: form.description.trim(),
      live_url: form.live_url.trim() || null,
      repo_url: form.repo_url.trim() || null,
      status: form.status,
      owner: form.owner.trim() || 'Unassigned',
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#e2e8f0] shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b]">
            Add {section === 'automations' ? 'automation' : 'tool'}
          </p>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#475569]"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-3.5">
          <Field label="Name *" value={form.name} onChange={(v) => update('name', v)} placeholder="e.g. Reeny Report" />
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Description</label>
            <textarea
              value={form.description} onChange={(e) => update('description', e.target.value)}
              rows={2} placeholder="What does this do?"
              className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/25 focus:border-[#3b82f6] resize-none"
            />
          </div>
          <Field label="Live URL" value={form.live_url} onChange={(v) => update('live_url', v)} placeholder="https://…" />
          <Field label="Repo URL" value={form.repo_url} onChange={(v) => update('repo_url', v)} placeholder="https://github.com/…" />
          <Field label="Owner" value={form.owner} onChange={(v) => update('owner', v)} placeholder="Who runs this?" />
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm">
              <option value="live">Live</option>
              <option value="beta">Beta</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#e2e8f0] text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">Cancel</button>
          <button onClick={handleSave} disabled={!form.name.trim() || saving} className="flex-1 py-2.5 rounded-lg bg-[#1e293b] text-white text-sm font-semibold hover:bg-[#334155] disabled:opacity-50">
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">{label}</label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/25 focus:border-[#3b82f6]"
      />
    </div>
  )
}
