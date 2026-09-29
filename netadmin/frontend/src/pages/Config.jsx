import { Download, Eye, GitCompare, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import DevicePicker from '../components/DevicePicker'
import { Empty, Modal, Page, Pre } from '../components/ui'
import { useApp } from '../store'
import { NoDevice, useFamily } from './Data'

export default function Config() {
  const { selected, toast } = useApp()
  const fam = useFamily('config')
  const [backups, setBackups] = useState([])
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)
  const id = selected?.id

  const loadB = useCallback(() => id && api(`/devices/${id}/backups`).then(setBackups).catch(() => {}), [id])
  useEffect(() => { loadB() }, [loadB])

  const backup = async () => {
    setBusy(true)
    try { await api(`/devices/${id}/backups`, { method: 'POST' }); toast('Sauvegarde créée'); loadB() } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  const open = async (b, against) => {
    const r = await api(`/backups/${b.id}${against ? `?against=${against.id}` : ''}`)
    setView({ ...r, mode: against ? 'diff' : 'view', against })
  }
  const del = async (b) => { await api(`/backups/${b.id}`, { method: 'DELETE' }); loadB() }
  const download = (name, text) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = name; a.click()
  }
  const raw = fam.data?.raw || ''

  return (
    <Page title="Configuration" subtitle="Configuration courante et sauvegardes"
      actions={<><DevicePicker /><button className="btn" disabled={!id || fam.loading} onClick={() => fam.load(true)}><RefreshCw size={14} className={fam.loading ? 'animate-spin' : ''} />Actualiser</button>
        <button className="btn btn-primary" disabled={!id || busy} onClick={backup}><Plus size={14} />Sauvegarder</button></>}>
      {!selected ? <NoDevice /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            {fam.error ? <Empty><span className="text-red-500">{fam.error}</span></Empty> : fam.loading && !raw ? <Empty>Lecture de la configuration…</Empty>
              : <><Pre className="max-h-[70vh]">{raw || '(vide)'}</Pre>{raw && <button className="btn mt-2" onClick={() => download(`${selected.name}.cfg`, raw)}><Download size={14} />Télécharger</button>}</>}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Sauvegardes</h2>
            {!backups.length ? <Empty>Aucune</Empty> : (
              <div className="card divide-y divide-line">
                {backups.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-1 px-3 py-2">
                    <div className="mr-auto"><div>{new Date(b.at + 'Z').toLocaleString()}</div><div className="text-[11px] text-mute">{(b.size / 1024).toFixed(1)} Ko</div></div>
                    <button className="btn btn-ghost !px-1.5" title="Voir" onClick={() => open(b)}><Eye size={14} /></button>
                    {backups[i + 1] && <button className="btn btn-ghost !px-1.5" title="Différences avec la précédente" onClick={() => open(b, backups[i + 1])}><GitCompare size={14} /></button>}
                    <button className="btn btn-ghost btn-danger !px-1.5" title="Supprimer" onClick={() => del(b)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {view && (
        <Modal wide title={view.mode === 'diff' ? `Différences #${view.against.id} → #${view.id}` : `Sauvegarde du ${new Date(view.at + 'Z').toLocaleString()}`} onClose={() => setView(null)}>
          {view.mode === 'diff' ? (
            view.diff ? <pre className="max-h-[60vh] overflow-auto font-mono text-[12px]">{view.diff.split('\n').map((l, i) => (
              <div key={i} className={l.startsWith('+') && !l.startsWith('+++') ? 'bg-emerald-500/15 text-emerald-500' : l.startsWith('-') && !l.startsWith('---') ? 'bg-red-500/15 text-red-500' : 'text-mute'}>{l || ' '}</div>))}</pre>
              : <p className="text-mute">Aucune différence.</p>
          ) : <Pre className="max-h-[60vh]">{view.content}</Pre>}
        </Modal>
      )}
    </Page>
  )
}
