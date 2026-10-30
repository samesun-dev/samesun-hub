import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { ChevronRight, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

// ── helpers ──────────────────────────────────────────────────────────────
const isoDay = (d) => d.toISOString().slice(0, 10)

function presetRange(key) {
  const now = new Date()
  const to = isoDay(now)
  if (key === '30d') return { from: isoDay(new Date(now.getTime() - 30 * 864e5)), to }
  if (key === '90d') return { from: isoDay(new Date(now.getTime() - 90 * 864e5)), to }
  if (key === 'ytd') return { from: `${now.getUTCFullYear()}-01-01`, to }
  return { from: '', to: '' } // all time
}

const PRESETS = [
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['ytd', 'This year'],
  ['all', 'All time'],
]

const num = (n) => Math.round(n).toLocaleString('en-US')
const money = (sym, n, d = 0) =>
  `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
const fmtDay = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''
const range = (a, b) => (!a ? '—' : a === b || fmtDay(a) === fmtDay(b) ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`)
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
const shortProp = (p) => p.replace(/^Samesun\s+/, '')

// Revenue from different currencies must never be added together.
const addTo = (map, key, n) => { map[key] = (map[key] ?? 0) + n }
const moneyList = (byCur, d = 0) => {
  const entries = Object.entries(byCur)
  return entries.length ? entries.map(([c, n]) => money(c, n, d)).join(' + ') : '—'
}
const statusText = (s) =>
  Object.entries(s).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(' · ')
const minIso = (a, b) => (!a ? b : !b ? a : a < b ? a : b)
const maxIso = (a, b) => (!a ? b : !b ? a : a > b ? a : b)

const PALETTE = ['#1d4ed8', '#f5a623', '#10b981', '#8b5cf6', '#dc2626', '#0891b2', '#db2777', '#65a30d']

function newAgg() {
  return {
    uses: 0, nights: 0, revenueByCur: {}, statuses: {},
    firstBooked: null, lastBooked: null, firstArrival: null, lastArrival: null,
    firstDeparture: null, lastDeparture: null,
  }
}
function mergeRow(agg, r) {
  agg.uses += r.uses
  agg.nights += r.nights
  addTo(agg.revenueByCur, r.currency, r.revenue)
  addTo(agg.statuses, r.status, r.uses)
  agg.firstBooked = minIso(agg.firstBooked, r.first_booked)
  agg.lastBooked = maxIso(agg.lastBooked, r.last_booked)
  agg.firstArrival = minIso(agg.firstArrival, r.first_arrival)
  agg.lastArrival = maxIso(agg.lastArrival, r.last_arrival)
  agg.firstDeparture = minIso(agg.firstDeparture, r.first_departure)
  agg.lastDeparture = maxIso(agg.lastDeparture, r.last_departure)
}
const avgPerUse = (byCur, uses) => {
  const out = {}
  for (const [c, n] of Object.entries(byCur)) out[c] = uses ? n / uses : 0
  return out
}

async function fetchVouchers(params) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`/api/mews-vouchers?${params}`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Something went wrong')
  return json
}

// ── page ─────────────────────────────────────────────────────────────────
export default function Vouchers() {
  const [preset, setPreset] = useState('ytd')
  const [dates, setDates] = useState(presetRange('ytd'))
  const [basis, setBasis] = useState('created_at')
  const [selectedProps, setSelectedProps] = useState(null) // null = all
  const [onlineOnly, setOnlineOnly] = useState(true)
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [view, setView] = useState('code')
  const [sort, setSort] = useState({ key: 'uses', dir: 'desc' })
  const [expanded, setExpanded] = useState(null)
  const [chartCode, setChartCode] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError('')
    const p = new URLSearchParams()
    if (dates.from) p.set('from', dates.from)
    if (dates.to) p.set('to', dates.to)
    p.set('basis', basis === 'arrival' ? 'arrival' : 'created')
    if (selectedProps) p.set('properties', selectedProps.join(','))
    p.set('online', onlineOnly ? '1' : '0')
    p.set('cancelled', includeCancelled ? '1' : '0')
    fetchVouchers(p)
      .then((json) => { if (id === reqId.current) setData(json) })
      .catch((e) => { if (id === reqId.current) setError(e.message) })
      .finally(() => { if (id === reqId.current) setLoading(false) })
  }, [dates, basis, selectedProps, onlineOnly, includeCancelled])

  const allProps = useMemo(() => data?.properties ?? [], [data])
  const propColor = useMemo(() => {
    const m = {}
    allProps.forEach((p, i) => { m[p.property] = PALETTE[i % PALETTE.length] })
    return m
  }, [allProps])

  // voucher -> { ...agg, props: { property -> agg + currency } }
  const codes = useMemo(() => {
    const byCode = new Map()
    for (const r of data?.summary ?? []) {
      if (!byCode.has(r.voucher)) byCode.set(r.voucher, { voucher: r.voucher, ...newAgg(), props: {} })
      const c = byCode.get(r.voucher)
      mergeRow(c, r)
      if (!c.props[r.property]) c.props[r.property] = { property: r.property, currency: r.currency, ...newAgg() }
      mergeRow(c.props[r.property], r)
    }
    return [...byCode.values()]
  }, [data])

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    const val = (c) =>
      sort.key === 'voucher' ? c.voucher.toLowerCase()
      : sort.key === 'last' ? c.lastBooked ?? ''
      : sort.key === 'nights' ? c.nights
      : sort.key === 'revenue' ? Object.values(c.revenueByCur).reduce((a, b) => a + b, 0)
      : c.uses
    return [...codes].sort((a, b) => (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : 0))
  }, [codes, sort])

  const kpi = useMemo(() => {
    const t = newAgg()
    codes.forEach((c) => {
      t.uses += c.uses
      t.nights += c.nights
      for (const [cur, n] of Object.entries(c.revenueByCur)) addTo(t.revenueByCur, cur, n)
    })
    return t
  }, [codes])

  const propsWithData = useMemo(() => {
    const s = new Set()
    codes.forEach((c) => Object.keys(c.props).forEach((p) => s.add(p)))
    return allProps.map((p) => p.property).filter((p) => s.has(p))
  }, [codes, allProps])

  // monthly chart series for the chosen code (or all codes)
  const chartVal = codes.some((c) => c.voucher === chartCode) ? chartCode : ''
  const series = useMemo(() => {
    const rows = (data?.monthly ?? []).filter((m) => !chartVal || m.voucher === chartVal)
    if (!rows.length) return { months: [], max: 0, byMonth: {} }
    const byMonth = {}
    let lo = '9999-99', hi = '0000-00'
    for (const m of rows) {
      byMonth[m.month] ??= {}
      addTo(byMonth[m.month], m.property, m.uses)
      if (m.month < lo) lo = m.month
      if (m.month > hi) hi = m.month
    }
    const months = []
    let [y, mo] = lo.split('-').map(Number)
    const [hy, hm] = hi.split('-').map(Number)
    while (y < hy || (y === hy && mo <= hm)) {
      months.push(`${y}-${String(mo).padStart(2, '0')}`)
      if (++mo > 12) { mo = 1; y++ }
    }
    const max = Math.max(...months.map((k) => Object.values(byMonth[k] ?? {}).reduce((a, b) => a + b, 0)))
    return { months, max, byMonth }
  }, [data, chartVal])

  function pickPreset(key) {
    setPreset(key)
    setDates(presetRange(key))
  }
  function toggleProp(name) {
    const current = selectedProps ?? allProps.map((p) => p.property)
    const next = current.includes(name) ? current.filter((p) => p !== name) : [...current, name]
    setSelectedProps(next.length === 0 || next.length === allProps.length ? null : next)
  }
  function sortBy(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'voucher' ? 'asc' : 'desc' }))
  }
  function toggleRow(v) {
    if (expanded === v) { setExpanded(null); setChartCode('') }
    else { setExpanded(v); setChartCode(v) }
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new()
    const rows = []
    for (const c of sorted) for (const p of Object.values(c.props)) {
      const rev = Object.values(p.revenueByCur).reduce((a, b) => a + b, 0)
      rows.push({
        Voucher: c.voucher, Property: p.property, Currency: p.currency, Reservations: p.uses, Nights: p.nights,
        Revenue: Math.round(rev * 100) / 100,
        'Avg Booking Value': p.uses ? Math.round((rev / p.uses) * 100) / 100 : 0,
        'Avg Length of Stay': p.uses ? Math.round((p.nights / p.uses) * 10) / 10 : 0,
        'Reservation Status': statusText(p.statuses),
        'First Booked': fmtDay(p.firstBooked), 'Last Booked': fmtDay(p.lastBooked),
        'First Arrival': fmtDay(p.firstArrival), 'Last Arrival': fmtDay(p.lastArrival),
        'First Departure': fmtDay(p.firstDeparture), 'Last Departure': fmtDay(p.lastDeparture),
      })
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'By code and property')
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet((data?.monthly ?? []).map((m) => ({ Voucher: m.voucher, Property: m.property, Month: m.month, Reservations: m.uses }))),
      'By month'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Date range', `${dates.from || 'start'} to ${dates.to || 'today'}`],
        ['Date basis', basis === 'arrival' ? 'Arrival date' : 'Booking date'],
        ['Properties', selectedProps ? selectedProps.join(', ') : 'All'],
        ['Codes counted', onlineOnly ? 'Guest-entered online codes only' : 'All voucher entries'],
        ['Cancelled', includeCancelled ? 'Included' : 'Excluded'],
        ['Exported', new Date().toISOString()],
      ]),
      'Filters'
    )
    XLSX.writeFile(wb, `Voucher_Usage_${isoDay(new Date())}.xlsx`)
  }

  const Th = ({ k, children, right }) => (
    <th
      onClick={k ? () => sortBy(k) : undefined}
      className={`py-2 px-3 text-xs font-medium text-[#94a3b8] ${right ? 'text-right' : 'text-left'} ${k ? 'cursor-pointer hover:text-[#475569] select-none' : ''}`}
    >
      {children}{k && sort.key === k ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const chip = (active) =>
    `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      active ? 'bg-[#1e293b] text-white border-[#1e293b]' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]'
    }`
  const activeProps = selectedProps ?? allProps.map((p) => p.property)
  const matrixMax = Math.max(1, ...codes.flatMap((c) => Object.values(c.props).map((p) => p.uses)))

  return (
    <div className="max-w-6xl mx-auto px-10 py-14">
      <p className="text-xs font-mono uppercase tracking-wide text-[#94a3b8] mb-2">Samesun Workspace</p>
      <div className="flex items-start justify-between gap-4 mb-3">
        <h1 style={{ fontFamily: 'var(--font-display)' }} className="text-4xl font-medium text-[#1e293b]">
          Voucher usage
        </h1>
        <button
          onClick={exportExcel}
          disabled={!codes.length}
          className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-[#1e293b] text-white text-sm font-medium hover:bg-[#334155] transition-colors disabled:opacity-40"
        >
          <Download size={14} /> Export to Excel
        </button>
      </div>
      <p className="text-[#64748b] leading-relaxed mb-8">
        How often each promo code was used across properties, from Mews reservation reports. Guest personal details are never stored.
      </p>

      {/* filters */}
      <div className="flex flex-col gap-4 mb-8 pb-6 border-b border-[#f1f5f9]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs font-mono uppercase tracking-wide text-[#94a3b8]">Dates</span>
          {PRESETS.map(([k, label]) => (
            <button key={k} onClick={() => pickPreset(k)} className={chip(preset === k)}>{label}</button>
          ))}
          <input
            type="date" value={dates.from} aria-label="From date"
            onChange={(e) => { setPreset('custom'); setDates((d) => ({ ...d, from: e.target.value })) }}
            className="ml-2 border border-[#e2e8f0] rounded-lg px-2 py-1 text-xs text-[#475569]"
          />
          <span className="text-xs text-[#94a3b8]">to</span>
          <input
            type="date" value={dates.to} aria-label="To date"
            onChange={(e) => { setPreset('custom'); setDates((d) => ({ ...d, to: e.target.value })) }}
            className="border border-[#e2e8f0] rounded-lg px-2 py-1 text-xs text-[#475569]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs font-mono uppercase tracking-wide text-[#94a3b8]">Date is</span>
          <button onClick={() => setBasis('created_at')} className={chip(basis === 'created_at')}>Booking date</button>
          <button onClick={() => setBasis('arrival')} className={chip(basis === 'arrival')}>Arrival date</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs font-mono uppercase tracking-wide text-[#94a3b8]">Properties</span>
          {allProps.map((p) => (
            <button key={p.property} onClick={() => toggleProp(p.property)} className={chip(activeProps.includes(p.property))}
              title={p.last_import ? `Last report received ${fmtDay(p.last_import)}` : ''}>
              {shortProp(p.property)}
            </button>
          ))}
          {!allProps.length && <span className="text-xs text-[#cbd5e1]">No properties yet</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="w-24 text-xs font-mono uppercase tracking-wide text-[#94a3b8]">Counting</span>
          <label className="flex items-center gap-2 text-sm text-[#475569]">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
            Guest-entered online codes only
          </label>
          <label className="flex items-center gap-2 text-sm text-[#475569]">
            <input type="checkbox" checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} />
            Include cancelled
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-[#dc2626] mb-6">{error}</p>}

      {/* KPIs */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {[
          ['Code uses', num(kpi.uses)],
          ['Different codes', num(codes.length)],
          ['Nights booked', num(kpi.nights)],
          ['Revenue', moneyList(kpi.revenueByCur)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-mono uppercase tracking-wide text-[#94a3b8] mb-1">{label}</p>
            <p style={{ fontFamily: 'var(--font-display)' }} className="text-2xl font-medium text-[#1e293b]">{value}</p>
          </div>
        ))}
      </div>

      {!loading && !error && !codes.length ? (
        <p className="text-sm text-[#94a3b8] py-10">
          {allProps.length
            ? 'No voucher uses match these filters.'
            : 'No reservation reports received yet. Data appears here once Mews scheduled exports start arriving.'}
        </p>
      ) : (
        <>
          {/* over time */}
          <div className={`mb-10 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontFamily: 'var(--font-display)' }} className="text-xl font-medium text-[#1e293b]">When codes were used</h2>
              <select
                value={chartVal} onChange={(e) => setChartCode(e.target.value)} aria-label="Code for chart"
                className="border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm text-[#475569]"
              >
                <option value="">All codes</option>
                {sorted.map((c) => <option key={c.voucher} value={c.voucher}>{c.voucher}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2 h-44 border-b border-[#e2e8f0]">
              {series.months.map((m) => {
                const parts = Object.entries(series.byMonth[m] ?? {})
                const total = parts.reduce((a, [, n]) => a + n, 0)
                return (
                  <div key={m} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1"
                    title={`${monthLabel(m)}: ${total} uses`}>
                    <span className="text-[10px] text-[#94a3b8]">{total || ''}</span>
                    <div className="w-full max-w-12 flex flex-col-reverse rounded-t overflow-hidden"
                      style={{ height: `${series.max ? (total / series.max) * 85 : 0}%` }}>
                      {parts.map(([prop, n]) => (
                        <div key={prop} style={{ height: `${(n / total) * 100}%`, background: propColor[prop] ?? '#94a3b8' }}
                          title={`${shortProp(prop)}: ${n}`} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 mt-1">
              {series.months.map((m) => (
                <span key={m} className="flex-1 min-w-0 text-center text-[10px] text-[#94a3b8] truncate">{monthLabel(m)}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {propsWithData.map((p) => (
                <span key={p} className="flex items-center gap-1.5 text-xs text-[#64748b]">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: propColor[p] }} />{shortProp(p)}
                </span>
              ))}
            </div>
          </div>

          {/* table / compare */}
          <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setView('code')} className={chip(view === 'code')}>By code</button>
              <button onClick={() => setView('matrix')} className={chip(view === 'matrix')}>Compare properties</button>
            </div>

            {view === 'code' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e2e8f0]">
                    <tr>
                      <Th k="voucher">Code</Th>
                      <Th k="uses" right>Uses</Th>
                      <Th right>Properties</Th>
                      <Th k="nights" right>Nights</Th>
                      <Th k="revenue" right>Revenue</Th>
                      <Th right>Avg value</Th>
                      <Th right>Avg stay</Th>
                      <Th k="last" right>Last used</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c) => {
                      const open = expanded === c.voucher
                      return (
                        <Fragment key={c.voucher}>
                          <tr onClick={() => toggleRow(c.voucher)} className="border-b border-[#f1f5f9] cursor-pointer hover:bg-[#f8fafc]">
                            <td className="py-3 px-3 font-medium text-[#1e293b]">
                              <span className="flex items-center gap-1.5">
                                <ChevronRight size={13} className={`text-[#94a3b8] transition-transform ${open ? 'rotate-90' : ''}`} />
                                {c.voucher}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums">{num(c.uses)}</td>
                            <td className="py-3 px-3 text-right text-[#64748b]">{Object.keys(c.props).length}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{num(c.nights)}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{moneyList(c.revenueByCur)}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{moneyList(avgPerUse(c.revenueByCur, c.uses), 2)}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{(c.nights / c.uses).toFixed(1)}</td>
                            <td className="py-3 px-3 text-right text-[#64748b]">{fmtDay(c.lastBooked)}</td>
                          </tr>
                          {open && (
                            <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                              <td colSpan={8} className="px-3 py-4">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[#94a3b8]">
                                      {['Property', 'Uses', 'Nights', 'Revenue', 'Avg value', 'Avg stay', 'Status', 'Booked', 'Arrivals', 'Departures'].map((h, i) => (
                                        <th key={h} className={`py-1.5 px-2 font-medium whitespace-nowrap ${i > 0 && i < 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.values(c.props).sort((a, b) => b.uses - a.uses).map((p) => (
                                      <tr key={p.property} className="border-t border-[#e2e8f0] align-top">
                                        <td className="py-2 px-2 font-medium text-[#1e293b] whitespace-nowrap">
                                          <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: propColor[p.property] }} />
                                          {shortProp(p.property)}
                                        </td>
                                        <td className="py-2 px-2 text-right tabular-nums">{num(p.uses)}</td>
                                        <td className="py-2 px-2 text-right tabular-nums">{num(p.nights)}</td>
                                        <td className="py-2 px-2 text-right tabular-nums">{moneyList(p.revenueByCur)}</td>
                                        <td className="py-2 px-2 text-right tabular-nums">{moneyList(avgPerUse(p.revenueByCur, p.uses), 2)}</td>
                                        <td className="py-2 px-2 text-right tabular-nums">{(p.nights / p.uses).toFixed(1)}</td>
                                        <td className="py-2 px-2 text-[#64748b]">{statusText(p.statuses)}</td>
                                        <td className="py-2 px-2 text-[#64748b]">{range(p.firstBooked, p.lastBooked)}</td>
                                        <td className="py-2 px-2 text-[#64748b]">{range(p.firstArrival, p.lastArrival)}</td>
                                        <td className="py-2 px-2 text-[#64748b]">{range(p.firstDeparture, p.lastDeparture)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#e2e8f0]">
                    <tr>
                      <Th k="voucher">Code</Th>
                      {propsWithData.map((p) => <Th key={p} right>{shortProp(p)}</Th>)}
                      <Th k="uses" right>Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c) => (
                      <tr key={c.voucher} className="border-b border-[#f1f5f9]">
                        <td className="py-2.5 px-3 font-medium text-[#1e293b]">{c.voucher}</td>
                        {propsWithData.map((p) => {
                          const n = c.props[p]?.uses ?? 0
                          return (
                            <td key={p} className="py-2.5 px-3 text-right tabular-nums"
                              style={{ background: n ? `rgba(29,78,216,${0.07 + (n / matrixMax) * 0.28})` : undefined }}>
                              {n || <span className="text-[#cbd5e1]">·</span>}
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-3 text-right tabular-nums font-medium">{num(c.uses)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {loading && !data && <p className="text-sm text-[#94a3b8]">Loading…</p>}
    </div>
  )
}
