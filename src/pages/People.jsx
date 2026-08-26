import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

async function callPeopleApi(method, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/people', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Something went wrong')
  return json
}

export default function People() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [error, setError] = useState('')
  const [sendingId, setSendingId] = useState(null)
  const [sentId, setSentId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { people } = await callPeopleApi('GET')
      setPeople(people)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRemove(id) {
    setError('')
    try {
      await callPeopleApi('DELETE', { id })
      setConfirmId(null)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleSendLink(p) {
    setError('')
    setSentId(null)
    setSendingId(p.id)
    try {
      if (p.confirmed) {
        const { error } = await supabase.auth.resetPasswordForEmail(p.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
      } else {
        await callPeopleApi('POST', {
          name: p.name,
          email: p.email,
          redirectTo: `${window.location.origin}/reset-password`,
        })
      }
      setSentId(p.id)
    } catch (e) {
      setError(e.message)
    }
    setSendingId(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-10 py-14">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-[#94a3b8] mb-2">Samesun Workspace</p>
          <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-4xl font-medium text-[#1e293b]">
            People
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
      <p className="text-[#64748b] leading-relaxed mb-12">
        Everyone with access to this workspace. Adding someone here sends them an email to set their own password — nobody needs to go into Supabase directly.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-6">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-[#94a3b8]">Loading…</p>
      ) : (
        <div className="flex flex-col">
          {people.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-6 py-4 border-b border-[#f1f5f9]">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1e293b] truncate">{p.name}</p>
                <p className="text-sm text-[#94a3b8] truncate">{p.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={p.confirmed
                    ? { background: '#d1fae5', color: '#065f46' }
                    : { background: '#f3f4f6', color: '#6b7280' }}
                >
                  {p.confirmed ? 'Active' : 'Pending'}
                </span>

                {sentId === p.id ? (
                  <span className="text-xs font-medium text-emerald-600">Sent!</span>
                ) : (
                  <button
                    onClick={() => handleSendLink(p)}
                    disabled={sendingId === p.id}
                    className="text-xs border border-[#e2e8f0] rounded-md px-2.5 py-1 text-[#64748b] hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
                  >
                    {sendingId === p.id ? 'Sending…' : p.confirmed ? 'Send reset' : 'Send invite'}
                  </button>
                )}

                {confirmId === p.id ? (
                  <>
                    <span className="text-xs text-[#94a3b8]">Remove?</span>
                    <button onClick={() => handleRemove(p.id)} className="text-xs font-semibold text-red-600">Yes</button>
                    <button onClick={() => setConfirmId(null)} className="text-xs text-[#94a3b8]">No</button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmId(p.id)}
                    className="flex items-center gap-1 text-xs text-[#94a3b8] hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {people.length === 0 && (
            <p className="text-sm text-[#94a3b8] py-10">Nobody here yet. Click Add to invite the first person.</p>
          )}
        </div>
      )}

      {showAdd && (
        <AddPersonModal
          onClose={() => setShowAdd(false)}
          onInvited={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}

function AddPersonModal({ onClose, onInvited }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim() || !email.trim()) return
    setSaving(true)
    setError('')
    try {
      await callPeopleApi('POST', {
        name,
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      })
      onInvited()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#e2e8f0] shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b]">
            Add person
          </p>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-[#475569]"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Full name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" autoFocus
              className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/25 focus:border-[#3b82f6]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@samesun.com"
              className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/25 focus:border-[#3b82f6]"
            />
          </div>
          <p className="text-xs text-[#94a3b8]">They'll get an email with a link to set their own password.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>
        )}

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[#e2e8f0] text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || !email.trim() || saving} className="flex-1 py-2.5 rounded-lg bg-[#1e293b] text-white text-sm font-semibold hover:bg-[#334155] disabled:opacity-50">
            {saving ? 'Sending…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
