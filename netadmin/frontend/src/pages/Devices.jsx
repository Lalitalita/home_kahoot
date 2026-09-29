import { Pencil, Plus, Trash2, Wifi } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import DeviceForm from '../components/DeviceForm'
import DeviceIcon, { KIND_LABEL } from '../components/DeviceIcon'
import { Badge, Empty, Modal, Page, StatusDot } from '../components/ui'
import { useApp } from '../store'

export default function Devices() {
  const { devices, meta, reload, toast, setSelectedId } = useApp()
  const [form, setForm] = useState(null) // {device?, empty?}
  const [del, setDel] = useState(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)
  const list = devices.filter((d) => `${d.name} ${d.ip} ${d.host}`.toLowerCase().includes(q.toLowerCase()))
  const label = (id) => meta.profiles.find((p) => p.id === id)?.label || id

  const test = async (d) => {
    setBusy(d.id)
    try { await api(`/devices/${d.id}/test`, { method: 'POST' }); toast(`${d.name} : connexion OK`) }
    catch (e) { toast(`${d.name} : ${e.message}`, 'err') }
    await reload(); setBusy(null)
  }
  const remove = async () => {
    try { await api(`/devices/${del.id}`, { method: 'DELETE' }); await reload(); toast('Appareil supprimé') } catch (e) { toast(e.message, 'err') }
    setDel(null)
  }

  return (
    <Page title="Appareils" subtitle="Routeurs, switchs, et machines vides"
      actions={<>
        <input className="input !w-48" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => setForm({ empty: true })}><Plus size={14} />Machine vide</button>
        <button className="btn btn-primary" onClick={() => setForm({})}><Plus size={14} />Appareil</button>
      </>}>
      {!list.length ? <Empty>Aucun appareil</Empty> : (
        <div className="card overflow-auto">
          <table className="w-full">
            <thead><tr>{['', 'Nom', 'Type', 'Marque / OS', 'Accès', ''].map((h, i) => <th key={i} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="hover:bg-line/30">
                  <td className="td w-8">{d.managed ? <StatusDot status={d.status} /> : null}</td>
                  <td className="td"><span className="flex items-center gap-2 font-medium"><DeviceIcon kind={d.kind} className="text-mute" />{d.name}{d.discovered && <Badge tone="acc">découvert</Badge>}</span></td>
                  <td className="td text-mute">{KIND_LABEL[d.kind]}</td>
                  <td className="td text-mute">{d.managed ? label(d.driver) : <Badge>machine vide</Badge>}</td>
                  <td className="td font-mono text-[12px]">{d.managed ? (d.conn_type === 'serial' ? `${d.serial_port} @${d.baudrate}` : d.conn_type === 'demo' ? 'démo' : `${d.host}:${d.ssh_port}`) : d.ip || <span className="text-mute/50">—</span>}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      {d.managed && <button className="btn btn-ghost !px-2" title="Tester la connexion" disabled={busy === d.id} onClick={() => test(d)}><Wifi size={14} /></button>}
                      <button className="btn btn-ghost !px-2" title="Modifier" onClick={() => { setForm({ device: d }); if (d.managed) setSelectedId(d.id) }}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-danger !px-2" title="Supprimer" onClick={() => setDel(d)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {form && <DeviceForm device={form.device} presetEmpty={form.empty} onClose={() => setForm(null)} />}
      {del && (
        <Modal title="Supprimer l'appareil ?" onClose={() => setDel(null)}
          footer={<><button className="btn" onClick={() => setDel(null)}>Annuler</button><button className="btn btn-primary !bg-red-500 !border-red-500" onClick={remove}>Supprimer</button></>}>
          <b>{del.name}</b> et ses liens seront retirés du schéma. L'appareil réel n'est pas modifié.
        </Modal>
      )}
    </Page>
  )
}
