import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Accueil", end: true },
  { to: "/invites", label: "Invités" },
  { to: "/quiz/proposer", label: "Proposer une question" },
  { to: "/mur", label: "Mur de messages" },
];

export default function NavBar() {
  return (
    <nav className="sticky top-0 z-40 bg-[#fbf6f1]/90 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto">
        <span className="text-lg mr-2 shrink-0">🎂</span>
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
      </div>
    </nav>
  );
}
