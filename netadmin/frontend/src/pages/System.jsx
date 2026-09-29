import { Wifi } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import ConfigModal from '../components/ConfigModal'
import DevicePicker from '../components/DevicePicker'
import { Field, Page } from '../components/ui'
import { useApp } from '../store'
import { DataPanel, NoDevice, useFamily } from './Data'

export default function System() {
  const { selected, toast, reload } = useApp()
  const fam = useFamily('version')
  const [name, setName] = useState('')
  const [cfg, setCfg] = useState(null)
  const test = async () => {
    try { await api(`/devices/${selected.id}/test`, { method: 'POST' }); toast('Connexion OK') } catch (e) { toast(e.message, 'err') }
    reload()
  }
  return (
    <Page title="Système" subtitle="Identité et informations de l'appareil" actions={<><DevicePicker />{selected && <button className="btn" onClick={test}><Wifi size={14} />Tester</button>}</>}>
      {!selected ? <NoDevice /> : (
        <div className="space-y-6">
          <div className="card flex items-end gap-3 p-4">
            <div className="max-w-xs flex-1"><Field label="Nom d'hôte"><input className="input" placeholder={selected.name} value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
            <button className="btn btn-primary" disabled={!name} onClick={() => setCfg({ action: 'hostname', params: { name }, title: 'Changer le nom d\'hôte' })}>Aperçu…</button>
          </div>
          <div><h2 className="mb-2 text-sm font-semibold">Version</h2><DataPanel fam={fam} /></div>
        </div>
      )}
      {cfg && <ConfigModal device={selected} {...cfg} onClose={() => setCfg(null)} onDone={() => { setName(''); fam.load(true) }} />}
    </Page>
  )
}
