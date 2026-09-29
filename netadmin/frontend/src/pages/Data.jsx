import { Plus, Power, RefreshCw, Pencil, Radar } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import ConfigModal from '../components/ConfigModal'
import DevicePicker from '../components/DevicePicker'
import { Empty, Field, Modal, Page, Pre, Table } from '../components/ui'
import { useApp } from '../store'

/** Fetch one "family" of data (interfaces, vlans...) from the selected device. */
export function useFamily(kind) {
  const { selected } = useApp()
  const [state, setState] = useState({ data: null, loading: false, error: '' })
  const id = selected?.id
  const load = useCallback(async (refresh = false) => {
    if (!id) return
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const data = await api(`/devices/${id}/data/${kind}${refresh ? '?refresh=1' : ''}`)
      setState({ data, loading: false, error: '' })
    } catch (e) { setState({ data: null, loading: false, error: e.message }) }
  }, [id, kind])
  useEffect(() => { load(false) }, [load])
  return { ...state, load }
}

export function NoDevice() {
  return <Empty>Aucun appareil géré. Ajoute-en un dans <b>Appareils</b> (ou charge l'exemple depuis le tableau de bord).</Empty>
}

export function DataPanel({ fam, columns, extra }) {
  const { data, loading, error } = fam
  if (loading && !data) return <Empty>Interrogation de l'appareil…</Empty>
  if (error) return <Empty><span className="text-red-500">{error}</span></Empty>
  if (!data) return null
  if (!data.supported) return <Empty>Non géré pour cette marque.</Empty>
  if (data.rows.length) return <Table rows={data.rows} columns={extra ? [...(columns || Object.keys(data.rows[0])), extra] : columns} />
  return data.raw ? <Pre>{data.raw}</Pre> : <Empty>Aucune donnée</Empty>
}

function Shell({ title, subtitle, fam, actions, children }) {
  const { selected } = useApp()
  return (
    <Page title={title} subtitle={subtitle}
      actions={<>
        <DevicePicker />
        {actions}
        <button className="btn" disabled={!selected || fam.loading} onClick={() => fam.load(true)}><RefreshCw size={14} className={fam.loading ? 'animate-spin' : ''} />Actualiser</button>
      </>}>
      {!selected ? <NoDevice /> : children}
      {selected && fam.data?.fetched_at && <p className="mt-2 text-[11px] text-mute">Relevé du {new Date(fam.data.fetched_at + 'Z').toLocaleString()}{fam.data.cached ? ' (en cache)' : ''} · {fam.data.command}</p>}
    </Page>
  )
}

// ---------------------------------------------------------------- Interfaces
function IfaceForm({ row, onClose, onSubmit }) {
  const [f, setF] = useState({ description: row.name ?? row.description ?? '', admin: '', mode: '', vlan: '', trunk_vlans: '', ip: '', mask: '255.255.255.0' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal title={`Interface ${row.__port}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={() => onSubmit(f)}>Aperçu…</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Description"><input className="input" value={f.description} onChange={set('description')} /></Field></div>
        <Field label="État"><select className="input" value={f.admin} onChange={set('admin')}><option value="">Inchangé</option><option value="up">Activée</option><option value="down">Désactivée</option></select></Field>
        <Field label="Mode"><select className="input" value={f.mode} onChange={set('mode')}><option value="">Inchangé</option><option value="access">Access</option><option value="trunk">Trunk</option></select></Field>
        {f.mode === 'access' && <Field label="VLAN"><input className="input" type="number" value={f.vlan} onChange={set('vlan')} /></Field>}
        {f.mode === 'trunk' && <Field label="VLANs autorisés"><input className="input" placeholder="10,20,30-40" value={f.trunk_vlans} onChange={set('trunk_vlans')} /></Field>}
        <Field label="Adresse IP (L3)"><input className="input" value={f.ip} onChange={set('ip')} placeholder="optionnel" /></Field>
        {f.ip && <Field label="Masque"><input className="input" value={f.mask} onChange={set('mask')} /></Field>}
      </div>
    </Modal>
  )
}

export function Interfaces() {
  const { selected } = useApp()
  const fam = useFamily('interfaces')
  const [edit, setEdit] = useState(null)
  const [cfg, setCfg] = useState(null)
  const portOf = (r) => r.port || r.interface || r.intf || r.name || ''
  const rows = fam.data?.rows?.map((r) => ({ ...r, __port: portOf(r) })) || []
  const submit = (row, f) => {
    const p = { name: row.__port, description: f.description, admin: f.admin || undefined, mode: f.mode || undefined }
    if (f.vlan) p.vlan = f.vlan
    if (f.trunk_vlans) p.trunk_vlans = f.trunk_vlans
    if (f.ip) { p.ip = f.ip; p.mask = f.mask }
    setEdit(null); setCfg({ action: 'interface', params: p, title: `Interface ${row.__port}` })
  }
  const toggle = (row) => {
    const st = String(row.status || row.proto || '').toLowerCase()
    const isUp = ['connected', 'up'].includes(st)
    setCfg({ action: 'interface', params: { name: row.__port, admin: isUp ? 'down' : 'up' }, title: `${isUp ? 'Désactiver' : 'Activer'} ${row.__port}` })
  }
  const actionCol = { key: '__a', label: '', render: (r) => (
    <div className="flex justify-end gap-1">
      <button className="btn btn-ghost !px-2" title="Activer / désactiver" onClick={() => toggle(r)}><Power size={14} /></button>
      <button className="btn btn-ghost !px-2" title="Modifier" onClick={() => setEdit(r)}><Pencil size={14} /></button>
    </div>) }
  const cols = rows.length ? [...Object.keys(rows[0]).filter((k) => k !== '__port'), actionCol] : undefined
  return (
    <Shell title="Interfaces" subtitle="Ports physiques et logiques" fam={fam}>
      {fam.loading && !fam.data ? <Empty>Interrogation de l'appareil…</Empty> : fam.error ? <Empty><span className="text-red-500">{fam.error}</span></Empty>
        : rows.length ? <Table rows={rows} columns={cols} /> : <DataPanel fam={fam} />}
      {edit && <IfaceForm row={edit} onClose={() => setEdit(null)} onSubmit={(f) => submit(edit, f)} />}
      {cfg && <ConfigModal device={selected} {...cfg} onClose={() => setCfg(null)} onDone={() => fam.load(true)} />}
    </Shell>
  )
}

// ---------------------------------------------------------------- VLANs
export function Vlans() {
  const { selected } = useApp()
  const fam = useFamily('vlans')
  const [form, setForm] = useState(null)
  const [cfg, setCfg] = useState(null)
  return (
    <Shell title="VLANs" subtitle="Création et suppression" fam={fam}
      actions={<button className="btn btn-primary" disabled={!selected} onClick={() => setForm({ id: '', name: '' })}><Plus size={14} />VLAN</button>}>
      <DataPanel fam={fam} extra={{ key: '__a', label: '', render: (r) => (
        r.vlan_id ? <button className="btn btn-ghost btn-danger !px-2" onClick={() => setCfg({ action: 'vlan_del', params: { id: r.vlan_id }, title: `Supprimer le VLAN ${r.vlan_id}` })}>Supprimer</button> : null) }} />
      {form && (
        <Modal title="Nouveau VLAN" onClose={() => setForm(null)}
          footer={<><button className="btn" onClick={() => setForm(null)}>Annuler</button><button className="btn btn-primary" disabled={!form.id} onClick={() => { setCfg({ action: 'vlan_add', params: form, title: `Créer le VLAN ${form.id}` }); setForm(null) }}>Aperçu…</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID (1-4094)"><input className="input" type="number" autoFocus value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></Field>
            <Field label="Nom"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {cfg && <ConfigModal device={selected} {...cfg} onClose={() => setCfg(null)} onDone={() => fam.load(true)} />}
    </Shell>
  )
}

// ---------------------------------------------------------------- Routing
export function Routing() {
  const { selected } = useApp()
  const fam = useFamily('routes')
  const [form, setForm] = useState(null)
  const [cfg, setCfg] = useState(null)
  return (
    <Shell title="Routage" subtitle="Table de routage et routes statiques" fam={fam}
      actions={<button className="btn btn-primary" disabled={!selected} onClick={() => setForm({ del: false, network: '', mask: '255.255.255.0', nexthop: '' })}><Plus size={14} />Route statique</button>}>
      <DataPanel fam={fam} />
      {form && (
        <Modal title="Route statique" onClose={() => setForm(null)}
          footer={<><button className="btn" onClick={() => setForm(null)}>Annuler</button><button className="btn btn-primary" disabled={!form.network || !form.nexthop} onClick={() => { setCfg({ action: form.del ? 'route_del' : 'route_add', params: form, title: form.del ? 'Supprimer la route' : 'Ajouter la route' }); setForm(null) }}>Aperçu…</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-1.5"><input type="radio" checked={!form.del} onChange={() => setForm({ ...form, del: false })} />Ajouter</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={form.del} onChange={() => setForm({ ...form, del: true })} />Supprimer</label>
            </div>
            <Field label="Réseau"><input className="input" autoFocus placeholder="10.1.0.0 ou 10.1.0.0/16" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} /></Field>
            <Field label="Masque"><input className="input" value={form.mask} onChange={(e) => setForm({ ...form, mask: e.target.value })} /></Field>
            <div className="col-span-2"><Field label="Passerelle (next-hop)"><input className="input" placeholder="10.0.0.1" value={form.nexthop} onChange={(e) => setForm({ ...form, nexthop: e.target.value })} /></Field></div>
          </div>
        </Modal>
      )}
      {cfg && <ConfigModal device={selected} {...cfg} onClose={() => setCfg(null)} onDone={() => fam.load(true)} />}
    </Shell>
  )
}

// ---------------------------------------------------------------- Neighbors
export function Neighbors() {
  const { selected, reload, toast } = useApp()
  const fam = useFamily('neighbors')
  const [busy, setBusy] = useState(false)
  const discover = async () => {
    setBusy(true)
    try {
      const r = await api('/topology/discover', { method: 'POST', body: { device_ids: [selected.id] } })
      await reload()
      const e = r.report[0]
      e?.ok === false ? toast(e.error, 'err') : toast(`Schéma mis à jour : ${r.links} lien(s), ${r.devices} appareil(s) ajouté(s)`)
    } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <Shell title="Voisins LLDP / CDP" subtitle="Ce que l'appareil voit sur ses ports" fam={fam}
      actions={<button className="btn btn-primary" disabled={!selected || busy} onClick={discover}><Radar size={14} />Ajouter au schéma</button>}>
      <DataPanel fam={fam} />
    </Shell>
  )
}

// ---------------------------------------------------------------- MAC / ARP
export function Tables() {
  const { selected, reload, toast } = useApp()
  const [tab, setTab] = useState('mac')
  const fam = useFamily(tab)
  const [busy, setBusy] = useState(false)
  const importHosts = async () => {
    setBusy(true)
    try {
      const r = await api('/topology/discover', { method: 'POST', body: { device_ids: [selected.id], import_hosts: true } })
      await reload(); toast(`${r.hosts} machine(s) ajoutée(s) au schéma`)
    } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <Shell title="Tables MAC / ARP" subtitle="Machines vues par l'appareil" fam={fam}
      actions={<button className="btn" disabled={!selected || busy} onClick={importHosts}><Plus size={14} />Importer comme machines vides</button>}>
      <div className="mb-3 flex gap-1">
        {[['mac', 'Table MAC'], ['arp', 'Table ARP']].map(([k, l]) => (
          <button key={k} className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <DataPanel fam={fam} />
    </Shell>
  )
}
