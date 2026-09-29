import { Download, Upload } from 'lucide-react'
import { useRef } from 'react'
import { api } from '../api'
import { Field, Page } from '../components/ui'
import { ACCENT_NAMES, useApp } from '../store'

const SWATCH = { indigo: '#6366f1', teal: '#14b8a6', rose: '#f43f5e', amber: '#f59e0b', sky: '#0ea5e9', violet: '#8b5cf6' }

export default function Settings() {
  const { prefs, setPrefs, reload, toast } = useApp()
  const file = useRef()
  const exportAll = async () => {
    const d = await api('/export')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }))
    a.download = 'netadmin-export.json'; a.click()
  }
  const importAll = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text())
      const r = await api('/import', { method: 'POST', body: data })
      await reload(); toast(`Import terminé (${r.devices_created} appareil(s) créés)`)
    } catch (x) { toast('Import impossible : ' + x.message, 'err') }
    e.target.value = ''
  }
  return (
    <Page title="Réglages" subtitle="Rends l'interface à ton image">
      <div className="max-w-xl space-y-6">
        <div className="card space-y-4 p-4">
          <Field label="Nom de l'application"><input className="input" value={prefs.name} onChange={(e) => setPrefs({ ...prefs, name: e.target.value })} /></Field>
          <div>
            <span className="label">Couleur d'accent</span>
            <div className="flex gap-2">
              {ACCENT_NAMES.map((a) => (
                <button key={a} title={a} onClick={() => setPrefs({ ...prefs, accent: a })}
                  className={`h-7 w-7 rounded-full border-2 ${prefs.accent === a ? 'border-ink' : 'border-transparent'}`} style={{ background: SWATCH[a] }} />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.dark} onChange={(e) => setPrefs({ ...prefs, dark: e.target.checked })} />Thème sombre</label>
        </div>
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Export / import du schéma</h2>
          <p className="text-mute">Appareils et liens au format JSON, sans mots de passe.</p>
          <div className="flex gap-2">
            <button className="btn" onClick={exportAll}><Download size={14} />Exporter</button>
            <button className="btn" onClick={() => file.current.click()}><Upload size={14} />Importer</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={importAll} />
          </div>
        </div>
        <p className="text-mute">L'identifiant et le mot de passe d'accès se changent dans le fichier <code>.env</code> (ADMIN_USER / ADMIN_PASSWORD), puis <code>docker compose up -d</code>.</p>
      </div>
    </Page>
  )
}
