import { Link } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../api'
import DeviceForm from '../components/DeviceForm'
import DeviceIcon from '../components/DeviceIcon'
import { Empty, Page, StatusDot } from '../components/ui'
import { useApp } from '../store'

const Stat = ({ label, value }) => (
  <div className="card p-4"><div className="text-2xl font-semibold">{value}</div><div className="mt-0.5 text-mute">{label}</div></div>
)

export default function Dashboard() {
  const { devices, links, managed, reload, toast, prefs } = useApp()
  const [form, setForm] = useState(null)
  const down = managed.filter((d) => d.status === 'down').length

  const seed = async () => {
    try { await api('/demo/seed', { method: 'POST' }); await reload(); toast('Réseau d\'exemple chargé') } catch (e) { toast(e.message, 'err') }
  }

  if (!devices.length) return (
    <Page title={`Bienvenue sur ${prefs.name}`} subtitle="Ton réseau, en un coup d'œil.">
      <Empty>
        <p className="mb-4">Aucun appareil pour l'instant.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-primary" onClick={() => setForm('dev')}>Ajouter un routeur / switch</button>
          <button className="btn" onClick={seed}>Charger un réseau d'exemple</button>
        </div>
      </Empty>
      {form && <DeviceForm onClose={() => setForm(null)} />}
    </Page>
  )

  return (
    <Page title="Tableau de bord" subtitle="Vue d'ensemble de ton réseau">
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Appareils gérés" value={managed.length} />
        <Stat label="Machines vides" value={devices.length - managed.length} />
        <Stat label="Liens" value={links.length} />
        <Stat label="Injoignables" value={down} />
      </div>
      <div className="card divide-y divide-line">
        {managed.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
            <StatusDot status={d.status} />
            <DeviceIcon kind={d.kind} className="text-mute" />
            <span className="font-medium">{d.name}</span>
            <span className="font-mono text-[12px] text-mute">{d.conn_type === 'serial' ? d.serial_port : d.host}</span>
            <span className="ml-auto text-mute">{d.last_seen ? 'vu ' + new Date(d.last_seen + 'Z').toLocaleString() : 'jamais contacté'}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-mute">Voir le <Link to="/topologie" className="text-accent hover:underline">schéma du réseau</Link>.</p>
    </Page>
  )
}
