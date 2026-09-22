import { createContext, useContext, useEffect, useState } from "react";

import { api } from "../api.js";

const PartyModeContext = createContext(null);

export function PartyModeProvider({ children }) {
  const [partyModeActive, setPartyModeActive] = useState(null); // null = loading
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.get("/api/settings");
        if (!cancelled) {
          setPartyModeActive(data.party_mode_active);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <PartyModeContext.Provider value={{ partyModeActive, error }}>
      {children}
    </PartyModeContext.Provider>
  );
}

export function usePartyMode() {
  const ctx = useContext(PartyModeContext);
  if (!ctx) throw new Error("usePartyMode must be used within PartyModeProvider");
  return ctx;
}
