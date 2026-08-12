import { NavLink } from 'react-router-dom'

export default function FilesTabs() {
  return (
    <div className="flex items-center gap-1 mb-8 border-b border-[#e2e8f0]">
      <FilesTab to="/files" label="Folders" />
      <FilesTab to="/files-by-month" label="By Month" />
    </div>
  )
}

function FilesTab({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
          isActive ? 'border-[#1e293b] text-[#1e293b]' : 'border-transparent text-[#94a3b8] hover:text-[#475569]'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
