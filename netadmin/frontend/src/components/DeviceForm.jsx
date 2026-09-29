import { useState } from 'react'
import { api } from '../api'
import { useApp } from '../store'
import { KIND_LABEL } from './DeviceIcon'
import { Field, Modal } from './ui'

const blank = { name: '', kind: 'switch', managed: true, driver: 'cisco_ios', conn_type: 'ssh', host: '', ssh_port: 22, username: '', password: '', secret: '', serial_port: '', baudrate: 9600, ip: '', mac: '', notes: '' }

export default function DeviceForm({ device, presetEmpty, onClose, onSaved }) {
  const { meta, reload, toast } = useApp()
  const [f, setF] = useState(() => device
    ? { ...blank, ...device, password: '', secret: '' }
    : { ...blank, ...(presetEmpty ? { managed: false, kind: 'pc' } : {}) })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value })

  const save = async () => {
    setBusy(true)
    try {
      const body = { ...f }
      const r = await api(device ? `/devices/${device.id}` : '/devices', { method: device ? 'PUT' : 'POST', body })
      await reload()
      toast(device ? 'Appareil modifié' : 'Appareil ajouté')
      onSaved?.(r)
      onClose()
    } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <Modal wide title={device ? `Modifier ${device.name}` : f.managed ? 'Ajouter un appareil' : 'Ajouter une machine vide'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={busy || !f.name.trim()} onClick={save}>Enregistrer</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom"><input className="input" autoFocus value={f.name} onChange={set('name')} placeholder="SW-Etage1" /></Field>
        <Field label="Type">
          <select className="input" value={f.kind} onChange={set('kind')}>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>

        <label className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={!f.managed} onChange={(e) => setF({ ...f, managed: !e.target.checked })} />
          <span>Machine vide <span className="text-mute">— simple point sur le schéma (PC utilisateur…), sans connexion</span></span>
        </label>

        {f.managed ? (
          <>
            <Field label="Marque / OS">
              <select className="input" value={f.driver} onChange={set('driver')}>
                {meta.profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Connexion">
              <select className="input" value={f.conn_type} onChange={set('conn_type')}>
                <option value="ssh">SSH</option><option value="serial">Console (série)</option><option value="demo">Démo (simulé)</option>
              </select>
            </Field>
            {f.conn_type !== 'serial' ? (
              <>
                <Field label="Adresse IP / hôte"><input className="input" value={f.host} onChange={set('host')} placeholder="10.0.0.2" /></Field>
                <Field label="Port SSH"><input className="input" type="number" value={f.ssh_port} onChange={set('ssh_port')} /></Field>
              </>
            ) : (
              <>
                <Field label="Port série" hint="Le port doit être passé au conteneur (devices: dans le compose)">
                  <input className="input" list="serial-ports" value={f.serial_port} onChange={set('serial_port')} placeholder="/dev/ttyUSB0" />
                  <datalist id="serial-ports">{meta.serial_ports.map((p) => <option key={p} value={p} />)}</datalist>
                </Field>
                <Field label="Débit (baud)">
                  <select className="input" value={f.baudrate} onChange={set('baudrate')}>{[9600, 19200, 38400, 57600, 115200].map((b) => <option key={b}>{b}</option>)}</select>
                </Field>
              </>
            )}
            <Field label="Utilisateur"><input className="input" value={f.username} onChange={set('username')} autoComplete="off" /></Field>
            <Field label="Mot de passe" hint={device?.has_password ? 'Laisser vide pour conserver' : ''}><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
            <Field label="Mot de passe enable (Cisco)" hint={device?.has_secret ? 'Laisser vide pour conserver' : 'Optionnel'}><input className="input" type="password" value={f.secret} onChange={set('secret')} autoComplete="new-password" /></Field>
            <Field label="IP d'affichage"><input className="input" value={f.ip} onChange={set('ip')} placeholder="(optionnel)" /></Field>
          </>
        ) : (
          <>
            <Field label="Adresse IP"><input className="input" value={f.ip} onChange={set('ip')} placeholder="192.168.1.20" /></Field>
            <Field label="Adresse MAC"><input className="input" value={f.mac} onChange={set('mac')} placeholder="00:11:22:33:44:55" /></Field>
          </>
        )}
        <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field></div>
      </div>
    </Modal>
  )
}
