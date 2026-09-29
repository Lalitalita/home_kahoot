import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, hasToken, setToken } from './api'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const ACCENTS = { indigo: '99 102 241', teal: '20 184 166', rose: '244 63 94', amber: '245 158 11', sky: '14 165 233', violet: '139 92 246' }
export const ACCENT_NAMES = Object.keys(ACCENTS)

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }

export function AppProvider({ children }) {
  const [authed, setAuthed] = useState(hasToken())
  const [devices, setDevices] = useState([])
  const [links, setLinks] = useState([])
  const [meta, setMeta] = useState({ profiles: [], kinds: [], serial_ports: [] })
  const [selectedId, setSel] = useState(load('na_sel', null))
  const [toasts, setToasts] = useState([])
  const [prefs, setPrefs] = useState(load('na_prefs', { name: 'NetAdmin', accent: 'indigo', dark: true }))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!prefs.dark)
    document.documentElement.style.setProperty('--accent', ACCENTS[prefs.accent] || ACCENTS.indigo)
    document.title = prefs.name || 'NetAdmin'
    localStorage.setItem('na_prefs', JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    const f = () => setAuthed(false)
    window.addEventListener('na-logout', f)
    return () => window.removeEventListener('na-logout', f)
  }, [])

  const toast = useCallback((msg, kind = 'ok') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 3000)
  }, [])

  const reload = useCallback(async () => {
    const t = await api('/topology')
    setDevices(t.devices)
    setLinks(t.links)
    return t
  }, [])

  useEffect(() => {
    if (!authed) return
    reload().catch(() => {})
    api('/meta').then(setMeta).catch(() => {})
  }, [authed, reload])

  const setSelectedId = (id) => { setSel(id); localStorage.setItem('na_sel', JSON.stringify(id)) }
  const managed = useMemo(() => devices.filter((d) => d.managed), [devices])
  const selected = useMemo(() => managed.find((d) => d.id === selectedId) || managed[0] || null, [managed, selectedId])

  const value = {
    authed, devices, links, managed, meta, selected, setSelectedId, reload, toast, prefs, setPrefs,
    login: async (username, password) => {
      const r = await api('/auth/login', { method: 'POST', body: { username, password } })
      setToken(r.token); setAuthed(true); return r
    },
    logout: () => { setToken(''); setAuthed(false) },
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`card max-w-sm px-3 py-2 shadow-lg ${t.kind === 'err' ? 'border-red-500/60 text-red-500' : ''}`}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
