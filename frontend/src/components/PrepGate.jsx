import { Link } from "react-router-dom";

import { usePartyMode } from "../context/PartyModeContext.jsx";

// Hides the "before the party" pages once party mode has been switched on,
// and points people to the live quiz instead.
export default function PrepGate({ children }) {
  const { partyModeActive, error } = usePartyMode();

  if (partyModeActive === null && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        Chargement...
      </div>
    );
  }

  if (partyModeActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="card max-w-md space-y-4">
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-semibold text-ink-50">C'est parti !</h1>
          <p className="text-ink-400">
            Le mode soirée est activé, les pages de préparation sont fermées.
          </p>
          <Link to="/soiree" className="btn-primary w-full">
            Rejoindre la soirée
          </Link>
          <Link to="/mur" className="btn-secondary w-full">
            Voir le mur de messages
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
