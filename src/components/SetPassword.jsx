import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Sun } from 'lucide-react'

export default function SetPassword({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    onSuccess()
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-[#f5a623] flex items-center justify-center mb-4">
            <Sun size={19} className="text-white" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-medium text-[#1e293b]">
            Set your password
          </h1>
          <p className="text-xs text-[#94a3b8] font-mono uppercase tracking-wide mt-1">Welcome to Samesun</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-[#64748b] mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/25 focus:border-[#3b82f6] transition-all"
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-[#64748b] mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/25 focus:border-[#3b82f6] transition-all"
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e293b] hover:bg-[#334155] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60 mt-1"
          >
            {loading ? 'Saving…' : 'Set password →'}
          </button>
        </form>
      </div>
    </div>
  )
}
