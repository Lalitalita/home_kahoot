import { Link } from "react-router-dom";

import { ConfettiIcon } from "./icons.jsx";
import Loading from "./Loading.jsx";
import { usePartyMode } from "../context/PartyModeContext.jsx";

// Hides the "before the party" pages once party mode has been switched on,
// and points people to the live quiz instead.
export default function PrepGate({ children }) {
  const { partyModeActive, error } = usePartyMode();

  if (partyModeActive === null && !error) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (partyModeActive) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center safe-p">
        <div className="card max-w-md space-y-4">
          <ConfettiIcon size={40} className="mx-auto text-party-400" />
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
