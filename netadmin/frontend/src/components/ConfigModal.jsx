import { useEffect, useState } from 'react'
import { api } from '../api'
import { useApp } from '../store'
import { Modal, Pre } from './ui'

/** Preview the commands that will be sent, let the user tweak them, then apply. */
export default function ConfigModal({ device, action, params, title, onClose, onDone }) {
  const { toast } = useApp()
  const [cmds, setCmds] = useState('')
  const [err, setErr] = useState('')
  const [save, setSave] = useState(true)
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState(null)

  useEffect(() => {
    api(`/devices/${device.id}/config/preview`, { method: 'POST', body: { action, params } })
      .then((r) => setCmds(r.commands.join('\n')))
      .catch((e) => setErr(e.message))
  }, [])

  const apply = async () => {
    setBusy(true)
    try {
      const r = await api(`/devices/${device.id}/config/apply`, { method: 'POST', body: { commands: cmds.split('\n').filter((l) => l.trim()), save } })
      setOut(r)
      toast(r.warning ? 'Appliqué — vérifie la sortie' : 'Configuration appliquée', r.warning ? 'err' : 'ok')
      onDone?.()
    } catch (e) { toast(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <Modal wide title={title || 'Appliquer la configuration'} onClose={onClose}
      footer={out
        ? <button className="btn btn-primary" onClick={onClose}>Fermer</button>
        : <><label className="mr-auto flex items-center gap-2"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />Sauvegarder (write memory)</label>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy || !cmds.trim()} onClick={apply}>{busy ? 'Envoi…' : `Appliquer sur ${device.name}`}</button></>}>
      {err ? <p className="text-red-500">{err}</p> : out ? (
        <Pre className="max-h-96">{out.output || '(aucune sortie)'}</Pre>
      ) : (
        <>
          <p className="mb-2 text-mute">Commandes envoyées à <b className="text-ink">{device.name}</b> ({{ serial: 'console', demo: 'démo', ssh: 'SSH' }[device.conn_type]}) — modifiables :</p>
          <textarea className="input" rows={Math.min(14, cmds.split('\n').length + 1)} value={cmds} onChange={(e) => setCmds(e.target.value)} spellCheck={false} />
        </>
      )}
    </Modal>
  )
}
