import { Link, NavLink } from "react-router-dom";

import { CameraIcon, ChatIcon, HomeIcon, QuestionIcon, UsersIcon } from "./icons.jsx";
import { LogoMark } from "./Logo.jsx";

const links = [
  { to: "/", label: "Accueil", end: true },
  { to: "/invites", label: "Invités" },
  { to: "/quiz/proposer", label: "Proposer une question" },
  { to: "/mur", label: "Mur de messages" },
  { to: "/galerie", label: "Galerie photo" },
];

// Same destinations as the desktop pill nav, shown as a native-style bottom
// tab bar on phones — the header row scrolls horizontally and doesn't read
// as "app-like", so on small screens it's replaced by this instead.
const tabs = [
  { to: "/", Icon: HomeIcon, label: "Accueil", end: true },
  { to: "/invites", Icon: UsersIcon, label: "Invités" },
  { to: "/quiz/proposer", Icon: QuestionIcon, label: "Quiz" },
  { to: "/mur", Icon: ChatIcon, label: "Mur" },
  { to: "/galerie", Icon: CameraIcon, label: "Galerie" },
];

export default function NavBar() {
  return (
    <>
      <nav
        className="sticky top-0 z-40 bg-ink-900/90 backdrop-blur-sm border-b border-ink-700"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/" className="mr-1 shrink-0">
            <LogoMark size={26} />
          </Link>
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar">
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
          <span className="sm:hidden font-display font-bold text-ink-50">Anniv Lana</span>
        </div>
      </nav>

      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-ink-900/95 backdrop-blur-sm border-t border-ink-700 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
                isActive ? "text-party-400" : "text-ink-500"
              }`
            }
          >
            <t.Icon size={22} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
