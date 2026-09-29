import dagre from '@dagrejs/dagre'
import {
  Background, BaseEdge, ConnectionMode, Controls, EdgeLabelRenderer, getBezierPath, Handle, MiniMap, Panel,
  Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LayoutGrid, Monitor, Pencil, Plus, Radar, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import DeviceForm from '../components/DeviceForm'
import DeviceIcon, { KIND_LABEL } from '../components/DeviceIcon'
import { Badge, Field, Modal, StatusDot } from '../components/ui'
import { useApp } from '../store'

const W = 156, H = 56
const RANK = { cloud: 0, firewall: 1, router: 2, switch: 3, ap: 4, server: 4, other: 4, printer: 5, pc: 5, phone: 5 }

/** Hierarchical layout: internet/firewall/router on top, switches in the middle, end devices at the bottom. */
function autoLayout(devices, links) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 90 })
  g.setDefaultEdgeLabel(() => ({}))
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]))
  devices.forEach((d) => g.setNode(String(d.id), { width: W, height: H }))
  links.forEach((l) => {
    const a = byId[l.a_id], b = byId[l.b_id]
    if (!a || !b) return
    ;(RANK[a.kind] ?? 4) <= (RANK[b.kind] ?? 4) ? g.setEdge(String(a.id), String(b.id)) : g.setEdge(String(b.id), String(a.id))
  })
  dagre.layout(g)
  return Object.fromEntries(devices.map((d) => { const n = g.node(String(d.id)); return [d.id, { x: Math.round(n.x - W / 2), y: Math.round(n.y - H / 2) }] }))
}

function DeviceNode({ data }) {
  const d = data.device
  return (
    <div className={`node-card card relative flex items-center gap-2.5 px-3 py-2 shadow-sm ${d.managed ? '' : 'border-dashed'}`} style={{ width: W, height: H }}>
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${d.managed ? 'bg-accent/15 text-accent' : 'bg-line text-mute'}`}><DeviceIcon kind={d.kind} size={16} /></div>
      <div className="min-w-0">
        <div className="truncate font-medium leading-tight">{d.name}</div>
        <div className="truncate font-mono text-[10px] text-mute">{d.ip || d.host || KIND_LABEL[d.kind]}</div>
      </div>
      {d.managed && <span className="absolute right-2 top-2"><StatusDot status={d.status} /></span>}
      <Handle id="t" type="source" position={Position.Top} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <Handle id="l" type="source" position={Position.Left} />
      <Handle id="r" type="source" position={Position.Right} />
    </div>
  )
}

const Pill = ({ x, y, children }) => (
  <div className="nodrag nopan pointer-events-none absolute rounded border border-line bg-panel px-1 font-mono text-[10px] text-mute"
    style={{ transform: `translate(-50%,-50%) translate(${x}px,${y}px)` }}>{children}</div>
)

function LinkEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const t = 0.2
  const pt = (k) => [sourceX + (targetX - sourceX) * k, sourceY + (targetY - sourceY) * k]
  const [ax, ay] = pt(t), [bx, by] = pt(1 - t)
  return (
    <>
      <BaseEdge path={path} interactionWidth={16} style={{ stroke: selected ? 'rgb(var(--accent))' : 'rgb(var(--mute) / .6)', strokeWidth: selected ? 2 : 1.5 }} />
      <EdgeLabelRenderer>
        {data.a_port && <Pill x={ax} y={ay}>{data.a_port}</Pill>}
        {data.b_port && <Pill x={bx} y={by}>{data.b_port}</Pill>}
        {data.label && <Pill x={lx} y={ly}>{data.label}</Pill>}
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = { device: DeviceNode }
const edgeTypes = { link: LinkEdge }

function handles(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  if (Math.abs(dy) * 1.2 >= Math.abs(dx)) return dy >= 0 ? ['b', 't'] : ['t', 'b']
  return dx >= 0 ? ['r', 'l'] : ['l', 'r']
}

function LinkModal({ init, devices, onClose, onSaved }) {
  const { toast, reload } = useApp()
  const [f, setF] = useState(init)
  const name = (id) => devices.find((d) => d.id === id)?.name
  const save = async () => {
    try {
      await api(f.id ? `/links/${f.id}` : '/links', { method: f.id ? 'PUT' : 'POST', body: { a_id: f.a_id, b_id: f.b_id, a_port: f.a_port, b_port: f.b_port, label: f.label } })
      await reload(); onSaved?.(); onClose()
    } catch (e) { toast(e.message, 'err') }
  }
  return (
    <Modal title={f.id ? 'Modifier le lien' : 'Nouveau lien'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Port sur ${name(f.a_id)}`}><input className="input" autoFocus placeholder="Gi1/0/1" value={f.a_port} onChange={(e) => setF({ ...f, a_port: e.target.value })} /></Field>
        <Field label={`Port sur ${name(f.b_id)}`}><input className="input" placeholder="Gi1/0/48" value={f.b_port} onChange={(e) => setF({ ...f, b_port: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Étiquette (optionnel)"><input className="input" placeholder="Trunk VLAN 10,20 — 1 Gbit/s" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field></div>
      </div>
    </Modal>
  )
}

function DiscoverModal({ onClose }) {
  const { reload, toast } = useApp()
  const [hosts, setHosts] = useState(true)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const run = async () => {
    setBusy(true)
    try { const r = await api('/topology/discover', { method: 'POST', body: { import_hosts: hosts } }); setRes(r); await reload() }
    catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title="Découverte automatique" onClose={onClose}
      footer={res ? <button className="btn btn-primary" onClick={onClose}>Fermer</button> : <><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={busy} onClick={run}>{busy ? 'Interrogation…' : 'Lancer'}</button></>}>
      {!res ? (
        <div className="space-y-3">
          <p className="text-mute">Interroge chaque appareil géré (LLDP / CDP) et ajoute au schéma les liens et voisins trouvés. Rien n'est supprimé.</p>
          <label className="flex items-center gap-2"><input type="checkbox" checked={hosts} onChange={(e) => setHosts(e.target.checked)} />Ajouter aussi les machines vues dans les tables MAC / ARP</label>
        </div>
      ) : (
        <div className="space-y-2">
          <p><b>{res.links}</b> lien(s), <b>{res.devices}</b> appareil(s) voisin(s), <b>{res.hosts}</b> machine(s) ajoutée(s).</p>
          {res.report.map((e) => <div key={e.device} className="flex items-center gap-2"><Badge tone={e.ok ? 'ok' : 'err'}>{e.ok ? 'OK' : 'Erreur'}</Badge><span className="font-medium">{e.device}</span>{!e.ok && <span className="truncate text-red-500">{e.error}</span>}</div>)}
          {!res.report.length && <p className="text-mute">Aucun appareil géré à interroger.</p>}
        </div>
      )}
    </Modal>
  )
}

function Flow() {
  const { devices, links, reload, toast, setSelectedId } = useApp()
  const navigate = useNavigate()
  const { fitView } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [sel, setSel] = useState(null) // {type, id}
  const [devForm, setDevForm] = useState(null)
  const [linkForm, setLinkForm] = useState(null)
  const [discover, setDiscover] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const savePositions = (pos) => api('/devices/positions', { method: 'POST', body: { positions: pos } }).catch(() => {})

  // Devices -> nodes (server positions; missing ones are computed and persisted)
  useEffect(() => {
    const missing = devices.some((d) => d.pos_x == null)
    const auto = missing ? autoLayout(devices, links) : {}
    const toSave = {}
    setNodes((old) => devices.map((d) => {
      const prev = old.find((n) => n.id === String(d.id))
      let pos = d.pos_x != null ? { x: d.pos_x, y: d.pos_y } : auto[d.id]
      if (d.pos_x == null) toSave[d.id] = [pos.x, pos.y]
      return { id: String(d.id), type: 'device', position: prev && d.pos_x != null ? prev.position : pos, data: { device: d }, selected: prev?.selected }
    }))
    if (Object.keys(toSave).length) { savePositions(toSave); reload(); setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 100) }
  }, [devices.map((d) => `${d.id}:${d.pos_x}:${d.status}:${d.name}:${d.kind}:${d.ip}`).join('|'), links.length])

  const posOf = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.position])), [nodes])
  const edges = useMemo(() => links.filter((l) => posOf[l.a_id] && posOf[l.b_id]).map((l) => {
    const [sh, th] = handles(posOf[l.a_id], posOf[l.b_id])
    return { id: String(l.id), source: String(l.a_id), target: String(l.b_id), sourceHandle: sh, targetHandle: th, type: 'link', selected: sel?.type === 'edge' && sel.id === l.id, data: l }
  }), [links, posOf, sel])

  const relayout = async () => {
    const pos = autoLayout(devices, links)
    setNodes((ns) => ns.map((n) => ({ ...n, position: pos[Number(n.id)] })))
    await savePositions(Object.fromEntries(Object.entries(pos).map(([id, p]) => [id, [p.x, p.y]])))
    await reload()
    setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 50)
  }

  const onConnect = useCallback((c) => {
    if (c.source === c.target) return
    setLinkForm({ a_id: Number(c.source), b_id: Number(c.target), a_port: '', b_port: '', label: '' })
  }, [])

  const seed = async () => { await api('/demo/seed', { method: 'POST' }); await reload(); toast('Réseau d\'exemple chargé') }
  const remove = async () => {
    try {
      await api(confirm.type === 'node' ? `/devices/${confirm.id}` : `/links/${confirm.id}`, { method: 'DELETE' })
      setSel(null); await reload()
    } catch (e) { toast(e.message, 'err') }
    setConfirm(null)
  }

  const selDev = sel?.type === 'node' ? devices.find((d) => d.id === sel.id) : null
  const selLink = sel?.type === 'edge' ? links.find((l) => l.id === sel.id) : null
  const dn = (id) => devices.find((d) => d.id === id)?.name
  const devLinks = selDev ? links.filter((l) => l.a_id === selDev.id || l.b_id === selDev.id) : []

  return (
    <div className="relative h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onConnect={onConnect} connectionMode={ConnectionMode.Loose}
        onNodeClick={(_, n) => setSel({ type: 'node', id: Number(n.id) })}
        onEdgeClick={(_, e) => setSel({ type: 'edge', id: Number(e.id) })}
        onPaneClick={() => setSel(null)}
        onNodeDragStop={(_, n) => savePositions({ [n.id]: [n.position.x, n.position.y] })}
        deleteKeyCode={null} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} maxZoom={2}
        proOptions={{ hideAttribution: true }}>
        <Background gap={24} size={1} color="rgb(var(--line))" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="rgb(0 0 0 / .15)" nodeColor="rgb(var(--mute))" />
        <Panel position="top-left" className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => setDevForm({})}><Plus size={14} />Appareil</button>
          <button className="btn" onClick={() => setDevForm({ empty: true })}><Monitor size={14} />Machine vide</button>
          <button className="btn" onClick={() => setDiscover(true)}><Radar size={14} />Découvrir</button>
          <button className="btn" onClick={relayout}><LayoutGrid size={14} />Réorganiser</button>
        </Panel>
      </ReactFlow>

      {!devices.length && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="card pointer-events-auto p-8 text-center">
            <p className="mb-4 text-mute">Le schéma se construit à partir de tes appareils.</p>
            <div className="flex justify-center gap-2"><button className="btn btn-primary" onClick={() => setDevForm({})}>Ajouter un appareil</button><button className="btn" onClick={seed}>Réseau d'exemple</button></div>
          </div>
        </div>
      )}

      {(selDev || selLink) && (
        <aside className="card absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-72 overflow-auto p-4 shadow-xl">
          <button className="btn btn-ghost absolute right-2 top-2 !px-1.5" onClick={() => setSel(null)}><X size={14} /></button>
          {selDev && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pr-6"><DeviceIcon kind={selDev.kind} className="text-accent" /><span className="text-sm font-semibold">{selDev.name}</span></div>
              <div className="flex flex-wrap gap-1"><Badge>{KIND_LABEL[selDev.kind]}</Badge>{selDev.managed ? <Badge tone={selDev.status === 'up' ? 'ok' : selDev.status === 'down' ? 'err' : 'mute'}>{selDev.status}</Badge> : <Badge>machine vide</Badge>}</div>
              <dl className="space-y-1 text-[12px]">
                {(selDev.host || selDev.ip) && <div className="flex justify-between"><dt className="text-mute">IP</dt><dd className="font-mono">{selDev.host || selDev.ip}</dd></div>}
                {selDev.mac && <div className="flex justify-between"><dt className="text-mute">MAC</dt><dd className="font-mono">{selDev.mac}</dd></div>}
                {selDev.notes && <div className="text-mute">{selDev.notes}</div>}
              </dl>
              <div>
                <div className="label">Liens ({devLinks.length})</div>
                {devLinks.map((l) => {
                  const mine = l.a_id === selDev.id
                  return <button key={l.id} className="block w-full rounded px-1.5 py-1 text-left hover:bg-line/50" onClick={() => setSel({ type: 'edge', id: l.id })}>
                    <span className="font-mono text-[11px] text-mute">{(mine ? l.a_port : l.b_port) || '·'}</span> → {dn(mine ? l.b_id : l.a_id)} <span className="font-mono text-[11px] text-mute">{(mine ? l.b_port : l.a_port)}</span></button>
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn" onClick={() => setDevForm({ device: selDev })}><Pencil size={13} />Modifier</button>
                {selDev.managed && <button className="btn" onClick={() => { setSelectedId(selDev.id); navigate('/interfaces') }}>Interfaces</button>}
                <button className="btn btn-danger" onClick={() => setConfirm({ type: 'node', id: selDev.id, label: selDev.name })}><Trash2 size={13} /></button>
              </div>
            </div>
          )}
          {selLink && (
            <div className="space-y-3">
              <div className="pr-6 text-sm font-semibold">{dn(selLink.a_id)} ↔ {dn(selLink.b_id)}</div>
              <dl className="space-y-1 text-[12px]">
                <div className="flex justify-between"><dt className="text-mute">{dn(selLink.a_id)}</dt><dd className="font-mono">{selLink.a_port || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-mute">{dn(selLink.b_id)}</dt><dd className="font-mono">{selLink.b_port || '—'}</dd></div>
                {selLink.label && <div className="flex justify-between"><dt className="text-mute">Étiquette</dt><dd>{selLink.label}</dd></div>}
                <div className="flex justify-between"><dt className="text-mute">Origine</dt><dd><Badge tone={selLink.source === 'manual' ? 'mute' : 'acc'}>{selLink.source}</Badge></dd></div>
              </dl>
              <div className="flex gap-2">
                <button className="btn" onClick={() => setLinkForm({ ...selLink })}><Pencil size={13} />Modifier</button>
                <button className="btn btn-danger" onClick={() => setConfirm({ type: 'edge', id: selLink.id, label: 'ce lien' })}><Trash2 size={13} /></button>
              </div>
            </div>
          )}
        </aside>
      )}

      {devForm && <DeviceForm device={devForm.device} presetEmpty={devForm.empty} onClose={() => setDevForm(null)} />}
      {linkForm && <LinkModal init={linkForm} devices={devices} onClose={() => setLinkForm(null)} />}
      {discover && <DiscoverModal onClose={() => setDiscover(false)} />}
      {confirm && (
        <Modal title="Confirmer la suppression" onClose={() => setConfirm(null)}
          footer={<><button className="btn" onClick={() => setConfirm(null)}>Annuler</button><button className="btn btn-primary !bg-red-500 !border-red-500" onClick={remove}>Supprimer</button></>}>
          Supprimer <b>{confirm.label}</b> du schéma ? {confirm.type === 'node' && "L'appareil réel n'est pas modifié."}
        </Modal>
      )}
    </div>
  )
}

export default function Topology() {
  return <div className="h-full"><ReactFlowProvider><Flow /></ReactFlowProvider></div>
}
