import { useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'

export default function Topbar({ breadcrumb, userEmail, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const initials = userEmail?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="h-14 border-b border-[#e2e8f0] bg-white flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-2 text-sm">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-[#cbd5e1]">/</span>}
            <span className={i === breadcrumb.length - 1 ? 'font-semibold text-[#1e293b]' : 'text-[#94a3b8]'}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[#f8fafc] transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-[#f5a623] text-white text-xs font-semibold flex items-center justify-center">
            {initials}
          </div>
          <ChevronDown size={14} className="text-[#94a3b8]" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#e2e8f0] rounded-lg shadow-lg py-1">
            <div className="px-3 py-2 border-b border-[#f1f5f9]">
              <p className="text-xs text-[#94a3b8] truncate">{userEmail}</p>
            </div>
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#475569] hover:bg-[#f8fafc]"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
