import { Link, NavLink } from "react-router-dom";

import { LogoMark } from "./Logo.jsx";

const links = [
  { to: "/", label: "Accueil", end: true },
  { to: "/invites", label: "Invités" },
  { to: "/qui-est-qui", label: "Qui est qui" },
  { to: "/quiz/proposer", label: "Proposer une question" },
  { to: "/mur", label: "Mur de messages" },
  { to: "/galerie", label: "Galerie photo" },
];

export default function NavBar() {
  return (
    <nav className="sticky top-0 z-40 bg-ink-900/90 backdrop-blur-sm border-b border-ink-700">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <Link to="/" className="mr-1 shrink-0">
          <LogoMark size={26} />
        </Link>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-party-600 text-white"
                  : "text-ink-400 hover:text-ink-50 hover:bg-ink-800"
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
