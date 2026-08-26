import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Sun, ChevronRight, ChevronsLeft, ChevronsRight, Home, Circle, Folder, Users } from 'lucide-react'

const STATUS_COLOR = {
  live: '#10b981',
  degraded: '#f59e0b',
  down: '#dc2626',
  beta: '#f5a623',
}

function LinkSectionNav({ label, sectionKey, links, expanded, onToggle }) {
  const items = links.filter(l => l.section === sectionKey)
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2.5 py-1.5 mt-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8] hover:text-[#64748b] transition-colors"
      >
        <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        {label}
      </button>
      {expanded && (
        <div className="flex flex-col gap-0.5 ml-2">
          {items.map((item) => (
            <NavLink
              key={item.id}
              to={`/${sectionKey}/${item.slug}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-[#dbeafe] text-[#1d4ed8] font-medium' : 'text-[#64748b] hover:bg-[#f1f5f9]'
                }`
              }
            >
              <Circle size={6} className="fill-current shrink-0" style={{ color: STATUS_COLOR[item.status] ?? '#94a3b8' }} />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
          {items.length === 0 && (
            <p className="px-2.5 py-1 text-xs text-[#cbd5e1]">Empty</p>
          )}
        </div>
      )}
    </div>
  )
}

function FolderSectionNav({ label, sectionKey, expanded, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2.5 py-1.5 mt-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8] hover:text-[#64748b] transition-colors"
      >
        <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        {label}
      </button>
      {expanded && (
        <div className="flex flex-col gap-0.5 ml-2">
          <NavLink
            to={`/${sectionKey}`}
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                isActive ? 'bg-[#dbeafe] text-[#1d4ed8] font-medium' : 'text-[#64748b] hover:bg-[#f1f5f9]'
              }`
            }
          >
            <Folder size={13} />
            Browse
          </NavLink>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ links, collapsed, onToggleCollapse }) {
  const [expanded, setExpanded] = useState({
    automations: true,
    tools: true,
    models: false,
    files: false,
  })

  function toggle(key) {
    setExpanded((p) => ({ ...p, [key]: !p[key] }))
  }

  if (collapsed) {
    return (
      <aside className="w-14 bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col items-center h-screen sticky top-0 py-4 gap-4">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg bg-[#f5a623] flex items-center justify-center hover:opacity-90 transition-opacity"
          title="Expand sidebar"
        >
          <Sun size={16} className="text-white" />
        </button>
        <div className="w-full h-px bg-[#e2e8f0]" />
        <NavLink
          to="/"
          className={({ isActive }) =>
            `w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isActive ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'text-[#94a3b8] hover:bg-[#e2e8f0]'
            }`
          }
        >
          <Home size={15} />
        </NavLink>
        <NavLink
          to="/people"
          className={({ isActive }) =>
            `w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isActive ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'text-[#94a3b8] hover:bg-[#e2e8f0]'
            }`
          }
        >
          <Users size={15} />
        </NavLink>
        <button onClick={onToggleCollapse} className="mt-auto text-[#94a3b8] hover:text-[#475569]">
          <ChevronsRight size={16} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-[#f8fafc] border-r border-[#e2e8f0] flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 flex items-center justify-between border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#f5a623] flex items-center justify-center shrink-0">
            <Sun size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-sm font-semibold text-[#1e293b] truncate">
              Samesun
            </p>
            <p className="text-[10px] text-[#94a3b8] font-mono uppercase tracking-wide">Workspace</p>
          </div>
        </div>
        <button onClick={onToggleCollapse} className="text-[#94a3b8] hover:text-[#475569] shrink-0" title="Collapse sidebar">
          <ChevronsLeft size={16} />
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'text-[#475569] hover:bg-[#f1f5f9]'
            }`
          }
        >
          <Home size={15} />
          Overview
        </NavLink>

        <LinkSectionNav label="Automations" sectionKey="automations" links={links} expanded={expanded.automations} onToggle={() => toggle('automations')} />
        <LinkSectionNav label="Tools" sectionKey="tools" links={links} expanded={expanded.tools} onToggle={() => toggle('tools')} />
        <FolderSectionNav label="Models" sectionKey="models" expanded={expanded.models} onToggle={() => toggle('models')} />
        <FolderSectionNav label="Files" sectionKey="files" expanded={expanded.files} onToggle={() => toggle('files')} />

        <NavLink
          to="/people"
          className={({ isActive }) =>
            `flex items-center gap-2 px-2.5 py-1.5 mt-2 rounded-md text-sm font-medium transition-colors ${
              isActive ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'text-[#475569] hover:bg-[#f1f5f9]'
            }`
          }
        >
          <Users size={15} />
          People
        </NavLink>
      </nav>
    </aside>
  )
}
