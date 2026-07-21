import { ArrowUpRight } from 'lucide-react'

const HERO_TITLE = 'Samesun Workspace'

const HERO_SUBTITLE =
  'The home base for everything the team has built - automations, tools, templates, and shared files, all in one place.'

const HOW_TO_EDIT =
  'To update this page, open src/pages/Overview.jsx in the code editor. All the text on this page lives in one labeled section near the top of the file - change what is between the quotes and save.'

const NOTION_LINKS = [
  { title: 'Corporate Project Manager', url: 'https://notion.so' },
  { title: 'Acquisitions Pipeline', url: 'https://notion.so' },
  { title: 'BD Research Archive', url: 'https://notion.so' },
  { title: 'Team Wiki', url: 'https://notion.so' },
]

const QUICK_LINKS = [
  { label: 'Supabase', url: 'https://supabase.com/dashboard' },
  { label: 'Vercel', url: 'https://vercel.com/dashboard' },
  { label: 'GitHub (samesun-dev)', url: 'https://github.com/samesun-dev' },
  { label: 'React Docs', url: 'https://react.dev' },
]

export default function Overview() {
  return (
    <div>
      <div
        className="w-full h-56 flex items-end px-10 py-8"
        style={{
          background:
            'linear-gradient(135deg, #1e293b 0%, #334155 60%, #f5a623 140%)',
        }}
      >
        <div>
          <p className="text-xs font-mono uppercase tracking-wide text-white/60 mb-1">
            Samesun Workspace
          </p>

          <h1
            style={{ fontFamily: 'var(--font-display)' }}
            className="text-4xl font-medium text-white"
          >
            {HERO_TITLE}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-10 py-12">
        <p className="text-[#64748b] leading-relaxed text-[15px] mb-12 max-w-xl">
          {HERO_SUBTITLE}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <h2
              style={{ fontFamily: 'var(--font-display)' }}
              className="text-lg font-medium text-[#1e293b] mb-4"
            >
              Notion Projects
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {NOTION_LINKS.map((link) => (
                <a
                  key={link.title}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-[#e2e8f0] hover:border-[#93c5fd] transition-colors"
                >
                  <span className="text-sm font-medium text-[#1e293b]">
                    {link.title}
                  </span>

                  <ArrowUpRight
                    size={14}
                    className="text-[#94a3b8] group-hover:text-[#1d4ed8] transition-colors shrink-0"
                  />
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="border border-[#e2e8f0] rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-3">
                Quick links
              </h3>

              <div className="flex flex-col gap-2">
                {QUICK_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-sm text-[#475569] hover:text-[#1d4ed8] transition-colors"
                  >
                    {link.label}

                    <ArrowUpRight
                      size={13}
                      className="text-[#cbd5e1]"
                    />
                  </a>
                ))}
              </div>
            </div>

            <div className="border border-dashed border-[#e2e8f0] rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-2">
                Editing this page
              </h3>

              <p className="text-xs text-[#94a3b8] leading-relaxed">
                {HOW_TO_EDIT}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}