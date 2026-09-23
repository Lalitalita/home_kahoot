import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

const links = [
  { to: "/admin", label: "Tableau de bord", end: true, section: null },
  { to: "/admin/invites", label: "Invités", section: "guests" },
  { to: "/admin/budget", label: "Budget & listes", section: "budget" },
  { to: "/admin/planning", label: "Planning", section: "planning" },
  { to: "/admin/questions", label: "Questions du quiz", section: "questions" },
  { to: "/admin/messages", label: "Mur de messages", section: "messages" },
  { to: "/admin/soiree", label: "Mode soirée", section: "party" },
  { to: "/admin/resultats", label: "Résultats", section: "results" },
];

export default function AdminLayout({ title, children }) {
  const { logout, username, hasPermission, isOwner, me } = useAuth();

  const visibleLinks = links.filter((l) => !l.section || hasPermission(l.section));

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 bg-ink-900/90 backdrop-blur-sm border-b border-ink-700">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {visibleLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-party-600 text-white"
                    : "text-ink-400 hover:text-ink-50 hover:bg-ink-800"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {isOwner && (
            <NavLink
              to="/admin/comptes"
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-magenta-600 text-white"
                    : "text-magenta-400 hover:text-magenta-300 hover:bg-ink-800"
                }`
              }
            >
              Comptes
            </NavLink>
          )}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <Link
              to="/admin/mon-compte"
              className="flex items-center gap-2 text-xs text-ink-400 hover:text-ink-50"
            >
              {me?.photo_url ? (
                <img src={me.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-[10px]">
                  {username?.[0]?.toUpperCase()}
                </span>
              )}
              <span className="hidden sm:inline">{username}</span>
            </Link>
            <button onClick={logout} className="text-sm text-ink-400 hover:text-rose-500">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {title && <h1 className="text-2xl font-semibold text-ink-50 mb-5">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
