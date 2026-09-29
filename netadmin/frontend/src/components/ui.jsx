import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-md'} shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button className="btn btn-ghost !px-1.5" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-mute">{hint}</span>}
  </label>
)

export const Badge = ({ tone = 'mute', children }) => {
  const c = { ok: 'bg-emerald-500/15 text-emerald-500', err: 'bg-red-500/15 text-red-500', warn: 'bg-amber-500/15 text-amber-500', mute: 'bg-line text-mute', acc: 'bg-accent/15 text-accent' }[tone]
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>
}

export const StatusDot = ({ status }) => (
  <span title={status} className={`inline-block h-2 w-2 rounded-full ${status === 'up' ? 'bg-emerald-500' : status === 'down' ? 'bg-red-500' : 'bg-mute/50'}`} />
)

export const Page = ({ title, subtitle, actions, children }) => (
  <div className="mx-auto max-w-6xl px-6 py-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-mute">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
    {children}
  </div>
)

export const Empty = ({ children }) => <div className="card p-10 text-center text-mute">{children}</div>

export function Table({ rows, columns, onRow }) {
  if (!rows.length) return <Empty>Aucune donnée</Empty>
  const cols = columns || Object.keys(rows[0])
  return (
    <div className="card overflow-auto">
      <table className="w-full border-collapse">
        <thead><tr>{cols.map((c) => <th key={c.key || c} className="th">{(typeof c === 'string' ? c : c.label).replace(/_/g, ' ')}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-line/30">
              {cols.map((c) => {
                const k = c.key || c
                return <td key={k} className="td">{c.render ? c.render(r) : cell(k, r[k])}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function cell(k, v) {
  if (v === undefined || v === null || v === '') return <span className="text-mute/50">—</span>
  const s = String(v)
  if (/^(status|proto|state|link)$/.test(k)) {
    const l = s.toLowerCase()
    if (['up', 'connected', 'active', 'yes'].includes(l)) return <Badge tone="ok">{s}</Badge>
    if (['down', 'notconnect', 'disabled', 'err-disabled', 'administratively down', 'inactive', 'no'].includes(l)) return <Badge tone="err">{s}</Badge>
    return <Badge>{s}</Badge>
  }
  return <span className="font-mono text-[12px]">{s}</span>
}

export const Pre = ({ children, className = '' }) => (
  <pre className={`card overflow-auto whitespace-pre p-4 font-mono text-[12px] leading-relaxed ${className}`}>{children}</pre>
)
