import { Play, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import ConfigModal from '../components/ConfigModal'
import DevicePicker from '../components/DevicePicker'
import { Page } from '../components/ui'
import { useApp } from '../store'
import { NoDevice } from './Data'

export default function Console() {
  const { selected } = useApp()
  const [input, setInput] = useState('')
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const [cfg, setCfg] = useState(false)
  const end = useRef()
  useEffect(() => { end.current?.scrollIntoView() }, [log])
  useEffect(() => setLog([]), [selected?.id])

  const run = async () => {
    const commands = input.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!commands.length) return
    setBusy(true)
    try {
      const r = await api(`/devices/${selected.id}/cli`, { method: 'POST', body: { commands } })
      setLog((l) => [...l, ...r.results])
      setInput('')
    } catch (e) { setLog((l) => [...l, { command: commands.join('; '), output: e.message, error: true }]) }
    setBusy(false)
  }
  const cmds = input.split('\n').filter((l) => l.trim())
  return (
    <Page title="Console CLI" subtitle="Commandes directes, via SSH ou console série" actions={<DevicePicker />}>
      {!selected ? <NoDevice /> : (
        <div className="card flex h-[70vh] flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-black/20 p-4 font-mono text-[12px] leading-relaxed">
            {!log.length && <div className="text-mute">Connecté à {selected.name}. Une commande par ligne — Ctrl+Entrée pour exécuter.</div>}
            {log.map((e, i) => (
              <div key={i} className="mb-3">
                <div className="text-accent">{selected.name}# {e.command}</div>
                <pre className={`whitespace-pre-wrap ${e.error ? 'text-red-500' : ''}`}>{e.output}</pre>
              </div>
            ))}
            <div ref={end} />
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <textarea className="input flex-1" rows={2} value={input} placeholder="show ip interface brief" spellCheck={false}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run() }} />
            <div className="flex flex-col gap-1">
              <button className="btn btn-primary" disabled={busy || !cmds.length} onClick={run}><Play size={14} />Exécuter</button>
              <button className="btn" disabled={busy || !cmds.length} title="Envoyer en mode configuration" onClick={() => setCfg(true)}><Send size={14} />Config</button>
            </div>
          </div>
        </div>
      )}
      {cfg && <ConfigModal device={selected} action="raw" params={{ commands: cmds }} title="Envoyer en mode configuration" onClose={() => setCfg(false)} onDone={() => setInput('')} />}
    </Page>
  )
}
