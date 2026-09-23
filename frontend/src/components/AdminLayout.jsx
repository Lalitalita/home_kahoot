import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

const links = [
  { to: "/admin", label: "Tableau de bord", end: true },
  { to: "/admin/invites", label: "Invités" },
  { to: "/admin/budget", label: "Budget & listes" },
  { to: "/admin/questions", label: "Questions du quiz" },
  { to: "/admin/messages", label: "Mur de messages" },
  { to: "/admin/soiree", label: "Mode soirée" },
];

export default function AdminLayout({ title, children }) {
  const { logout, username } = useAuth();

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 bg-[#fbf6f1]/90 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-party-600 text-white"
                    : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="text-xs text-stone-400 hidden sm:inline">{username}</span>
            <button onClick={logout} className="text-sm text-stone-500 hover:text-rose-600">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {title && <h1 className="text-2xl font-semibold text-stone-900 mb-5">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
