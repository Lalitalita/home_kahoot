import { Cable, FileText, Layers, LayoutDashboard, List, LogOut, Menu, Moon, Network, Radar, Route, ScrollText, Settings, Sun, Table2, Terminal, Waypoints } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useApp } from '../store'

const GROUPS = [
  { title: 'Vue d\'ensemble', items: [['/', 'Tableau de bord', LayoutDashboard], ['/topologie', 'Topologie', Waypoints]] },
  { title: 'Inventaire', items: [['/appareils', 'Appareils', List]] },
  { title: 'Configuration', items: [
    ['/interfaces', 'Interfaces', Cable], ['/vlans', 'VLANs', Layers], ['/routage', 'Routage', Route],
    ['/voisins', 'Voisins LLDP / CDP', Radar], ['/tables', 'Tables MAC / ARP', Table2], ['/systeme', 'Système', Network]] },
  { title: 'Maintenance', items: [['/config', 'Config & sauvegardes', FileText], ['/console', 'Console CLI', Terminal], ['/journal', 'Journal', ScrollText]] },
  { title: 'Paramètres', items: [['/reglages', 'Réglages', Settings]] },
]

export default function Layout() {
  const { prefs, setPrefs, logout } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex h-full">
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-line bg-panel transition-transform md:static md:translate-x-0 ${open ? '' : '-translate-x-full'}`}>
        <div className="flex h-12 items-center gap-2 px-4">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-accent text-white"><Waypoints size={14} /></div>
          <span className="truncate font-semibold">{prefs.name}</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="mt-4">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-mute/70">{g.title}</div>
              {g.items.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
                  className={({ isActive }) => `flex items-center gap-2.5 rounded-md px-2 py-1.5 transition ${isActive ? 'bg-accent/15 font-medium text-accent' : 'text-mute hover:bg-line/50 hover:text-ink'}`}>
                  <Icon size={15} />{label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-line p-2">
          <button className="btn btn-ghost !px-2" title="Thème" onClick={() => setPrefs({ ...prefs, dark: !prefs.dark })}>{prefs.dark ? <Sun size={15} /> : <Moon size={15} />}</button>
          <button className="btn btn-ghost !px-2" title="Déconnexion" onClick={logout}><LogOut size={15} /></button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-20 flex h-12 items-center border-b border-line bg-bg/80 px-3 backdrop-blur md:hidden">
          <button className="btn btn-ghost !px-2" onClick={() => setOpen(true)}><Menu size={16} /></button>
          <span className="ml-2 font-semibold">{prefs.name}</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
