import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Folder, FileText, Plus, Upload, X, Download, Trash2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SECTION_LABEL = { models: 'Models', files: 'Files' }
const SECTION_DESC = {
  models: 'Blank templates — download, fill in, and use.',
  files: 'Shared documents, organized into folders.',
}

function formatBytes(bytes) {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export default function FileBrowser({ section }) {
  const { '*': pathParam } = useParams()
  const navigate = useNavigate()
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [breadcrumb, setBreadcrumb] = useState([])
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [uploading, setUploading] = useState(false)

  const resolvePath = useCallback(async () => {
    const segments = (pathParam ?? '').split('/').filter(Boolean)
    let parentId = null
    const crumbs = []
    for (const slug of segments) {
      const { data } = await supabase.from('folders').select('*').eq('section', section)
        .eq('parent_id', parentId).eq('slug', slug).maybeSingle()
      if (!data) break
      crumbs.push(data)
      parentId = data.id
    }
    setBreadcrumb(crumbs)
    setCurrentFolderId(parentId)
  }, [pathParam, section])

  const loadContents = useCallback(async () => {
    setLoading(true)
    await resolvePath()
    setLoading(false)
  }, [resolvePath])

  useEffect(() => { loadContents() }, [loadContents])

  useEffect(() => {
    async function fetchContents() {
      const folderQuery = supabase.from('folders').select('*').eq('section', section).order('name')
      const docQuery = supabase.from('documents').select('*').eq('section', section).order('name')
      const withParent = currentFolderId
        ? [folderQuery.eq('parent_id', currentFolderId), docQuery.eq('folder_id', currentFolderId)]
        : [folderQuery.is('parent_id', null), docQuery.is('folder_id', null)]
      const [{ data: folderData }, { data: docData }] = await Promise.all(withParent)
      setFolders(folderData ?? [])
      setDocuments(docData ?? [])
    }
    if (!loading) fetchContents()
  }, [currentFolderId, section, loading])

  function goToFolder(folder) {
    const newPath = [...breadcrumb, folder].map(f => f.slug).join('/')
    navigate(`/${section}/${newPath}`)
  }

  function goToBreadcrumb(index) {
    if (index < 0) {
      navigate(`/${section}`)
      return
    }
       const newPath = breadcrumb.slice(0, index + 1).map(f => f.slug).join('/')
    navigate(`/${section}/${newPath}`)
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const slug = newFolderName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    await supabase.from('folders').insert({ section, name: newFolderName.trim(), slug, parent_id: currentFolderId })
    setShowNewFolder(false)
    loadContents()
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `${section}/${crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('hub-files').upload(path, file)
    if (!uploadError) {
      await supabase.from('documents').insert({
        section, folder_id: currentFolderId, name: file.name,
        storage_path: path, size_bytes: file.size,
      })
      loadContents()
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDownload(doc) {
    const { data } = await supabase.storage.from('hub-files').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDeleteFolder(folder) {
    if (!window.confirm(`Delete folder "${folder.name}" and everything inside it?`)) return
    await supabase.from('folders').delete().eq('id', folder.id)
    loadContents()
  }

  async function handleDeleteDoc(doc) {
    if (!window.confirm(`Delete "${doc.name}"?`)) return
    await supabase.storage.from('hub-files').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    loadContents()
  }

  return (
    <div className="max-w-2xl mx-auto px-10 py-14">
      <p className="text-xs font-mono uppercase tracking-wide text-[#94a3b8] mb-2">Samesun Workspace</p>
      <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-4xl font-medium text-[#1e293b] mb-3">
        {SECTION_LABEL[section]}
      </h1>
      <p className="text-[#64748b] leading-relaxed mb-6">{SECTION_DESC[section]}</p>

      <div className="flex items-center gap-1.5 text-sm mb-6 text-[#94a3b8]">
        <button onClick={() => goToBreadcrumb(-1)} className="hover:text-[#1d4ed8] transition-colors">
          {SECTION_LABEL[section]}
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <ChevronRight size={13} />
            <button onClick={() => goToBreadcrumb(i)} className="hover:text-[#1d4ed8] transition-colors">
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-sm font-medium text-[#475569] hover:border-[#94a3b8] transition-colors"
        >
          <Plus size={14} /> New folder
        </button>
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] text-white text-sm font-medium hover:bg-[#334155] transition-colors cursor-pointer">
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-[#94a3b8]">Loading…</p>
      ) : (
        <div className="flex flex-col">
          {folders.map((folder) => (
            <div key={folder.id} className="group flex items-center justify-between gap-3 py-3 border-b border-[#f1f5f9]">
              <button onClick={() => goToFolder(folder)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Folder size={18} className="text-[#94a3b8] shrink-0" />
                <span className="text-sm font-medium text-[#1e293b] truncate">{folder.name}</span>
              </button>
              <button
                onClick={() => handleDeleteFolder(folder)}
                className="text-[#94a3b8] hover:text-[#dc2626] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {documents.map((doc) => (
            <div key={doc.id} className="group flex items-center justify-between gap-3 py-3 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText size={18} className="text-[#94a3b8] shrink-0" />
                <span className="text-sm text-[#1e293b] truncate">{doc.name}</span>
                <span className="text-xs text-[#cbd5e1] font-mono shrink-0">{formatBytes(doc.size_bytes)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDownload(doc)} className="text-[#94a3b8] hover:text-[#1d4ed8]">
                  <Download size={15} />
                </button>
                <button onClick={() => handleDeleteDoc(doc)} className="text-[#94a3b8] hover:text-[#dc2626]">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {folders.length === 0 && documents.length === 0 && (
            <p className="text-sm text-[#94a3b8] py-10">Empty. Create a folder or upload a file to get started.</p>
          )}
        </div>
      )}

      {showNewFolder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewFolder(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e2e8f0] shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontFamily: 'var(--font-display)' }} className="text-lg font-medium text-[#1e293b]">New folder</p>
              <button onClick={() => setShowNewFolder(false)} className="text-[#94a3b8] hover:text-[#475569]"><X size={18} /></button>
            </div>
            <input
              type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name" autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/25 focus:border-[#3b82f6] mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewFolder(false)} className="flex-1 py-2 rounded-lg border border-[#e2e8f0] text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">Cancel</button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="flex-1 py-2 rounded-lg bg-[#1e293b] text-white text-sm font-semibold hover:bg-[#334155] disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
