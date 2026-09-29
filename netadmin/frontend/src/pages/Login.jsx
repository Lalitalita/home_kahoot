import { Waypoints } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../store'

export default function Login() {
  const { login, prefs } = useApp()
  const [u, setU] = useState('admin')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    try { await login(u, p) } catch (x) { setErr(x.message) }
  }
  return (
    <div className="grid h-full place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-xs space-y-4 p-6">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white"><Waypoints size={15} /></div>
          <span className="text-base font-semibold">{prefs.name}</span>
        </div>
        <div><span className="label">Utilisateur</span><input className="input" value={u} onChange={(e) => setU(e.target.value)} /></div>
        <div><span className="label">Mot de passe</span><input className="input" type="password" autoFocus value={p} onChange={(e) => setP(e.target.value)} /></div>
        {err && <p className="text-red-500">{err}</p>}
        <button className="btn btn-primary w-full justify-center">Se connecter</button>
      </form>
    </div>
  )
}
