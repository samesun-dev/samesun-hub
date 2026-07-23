import { Link } from 'react-router-dom'
import { ArrowUpRight, Zap, Wrench, FileSpreadsheet, Folder as FolderIcon } from 'lucide-react'

const HERO_TITLE = 'Samesun Workspace'
const HERO_SUBTITLE = 'The home base for the team.'
const SUMMARY = 'Quick links to automations, tools, Excel models, and files, along with Notion projects, useful websites and tools, and editing instructions.'

const QUICK_SECTIONS = [
  { key: 'automations', label: 'Automations', desc: 'Scripts and workflows that run on their own.', icon: Zap, path: '/automations' },
  { key: 'tools', label: 'Tools', desc: 'Apps the team uses day to day.', icon: Wrench, path: '/tools' },
  { key: 'models', label: 'Models', desc: 'Blank templates - revenue, labour, capex.', icon: FileSpreadsheet, path: '/models' },
  { key: 'files', label: 'Files', desc: 'Shared documents, organized into folders.', icon: FolderIcon, path: '/files' },
]

const NOTION_LINKS = [
  { title: 'Project Manager', url: 'https://app.notion.com/p/Project-Manager-37351b12974e80b2a2a6c91e6d029b1c' },
  { title: 'Groups Outreach Hub', url: 'https://app.notion.com/p/Groups-Hub-36c51b12974e80658917e6005b066e69' },
  { title: 'Corporate Contracts', url: 'https://app.notion.com/p/Corporate-Contracts-9c151b12974e83b886638129f558f9dd' },
  { title: 'Coming soon', url: '#' },
]

const QUICK_LINKS = [
  { label: 'Supabase', url: 'https://supabase.com/dashboard' },
  { label: 'Vercel', url: 'https://vercel.com/dashboard' },
  { label: 'GitHub (samesun-dev)', url: 'https://github.com/samesun-dev' },
  { label: 'React Docs', url: 'https://react.dev' },
]

const SETUP_STEPS = [
  { label: 'Install Node.js (needed to run the code)', url: 'https://nodejs.org' },
  { label: 'Install VS Code (the editor)', url: 'https://code.visualstudio.com' },
  { label: 'Install Git (needed to save and push changes)', url: 'https://git-scm.com/downloads' },
  { label: 'Install the GitHub CLI or Desktop app (optional, easier than raw git)', url: 'https://desktop.github.com' },
]

const EDIT_INSTRUCTIONS = 'To change anything on this page: open the samesun-hub project folder in VS Code, then open src/pages/Overview.jsx. All the text above lives in one labeled section near the top of that file - change what is between the quotes, save, then run these three commands in the terminal to publish the change: git add . , then git commit -m "update homepage" , then git push. Vercel will automatically redeploy within a minute.'

export default function Overview() {
  return (
    <div>
      <div
        className="w-full px-10 py-14 flex flex-col items-center text-center"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 65%, #f5a623 150%)' }}
      >
        <p className="text-xs font-mono uppercase tracking-wide text-white/60 mb-2">Samesun Workspace</p>
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-5xl font-medium text-white mb-3">
          {HERO_TITLE}
        </h1>
        <p className="text-white/70 text-lg">{HERO_SUBTITLE}</p>
      </div>

      <div className="max-w-4xl mx-auto px-10 py-12">
        <p className="text-[#64748b] leading-relaxed text-[15px] mb-12 max-w-2xl">{SUMMARY}</p>

        <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b] mb-4">
          Jump to a section
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {QUICK_SECTIONS.map((section) => (
            <Link
              key={section.key}
              to={section.path}
              className="group flex flex-col gap-3 p-5 rounded-xl border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-sm transition-all"
            >
              <section.icon size={20} className="text-[#f5a623]" />
              <div>
                <p style={{ fontFamily: 'var(--font-display)' }} className="font-medium text-[#1e293b] group-hover:text-[#1d4ed8] transition-colors">
                  {section.label}
                </p>
                <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">{section.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b] mb-4">
              Notion Projects
            </h2>
            <div className="flex flex-col gap-2">
              {NOTION_LINKS.map((link) => (
                <a
                
                  key={link.title}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-[#e2e8f0] hover:border-[#93c5fd] transition-colors"
                >
                  <span className="text-sm font-medium text-[#1e293b]">{link.title}</span>
                  <ArrowUpRight size={14} className="text-[#94a3b8] group-hover:text-[#1d4ed8] transition-colors shrink-0" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b] mb-4">
              Quick links
            </h2>
            <div className="flex flex-col gap-2">
              {QUICK_LINKS.map((link) => (
                <a
                
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-[#e2e8f0] hover:border-[#93c5fd] transition-colors"
                >
                  <span className="text-sm font-medium text-[#1e293b]">{link.label}</span>
                  <ArrowUpRight size={14} className="text-[#94a3b8] group-hover:text-[#1d4ed8] transition-colors shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 border border-dashed border-[#e2e8f0] rounded-xl p-6">
          <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b] mb-2">
            Editing this page
          </h2>
          <p className="text-sm text-[#64748b] leading-relaxed mb-5">{EDIT_INSTRUCTIONS}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-3">What you need installed first</p>
          <div className="flex flex-col gap-2">
            {SETUP_STEPS.map((step) => (
              <a
              
                key={step.label}
                href={step.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 text-sm text-[#475569] hover:text-[#1d4ed8] transition-colors"
              >
                {step.label}
                <ArrowUpRight size={13} className="text-[#cbd5e1] shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
