import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import NavBar from "../components/NavBar.jsx";
import EventInfoCard from "../components/EventInfoCard.jsx";
import { getStoredGuestCode, setStoredGuestCode } from "../guestCode.js";

export default function Home() {
  const [code, setCode] = useState("");
  const [storedCode, setStoredCodeState] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const existing = getStoredGuestCode();
    if (existing) {
      setStoredCodeState(existing);
      setCode(existing);
    }
  }, []);

  function goToProfile(e) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setStoredGuestCode(trimmed);
    navigate(`/invites/${trimmed}`);
  }

  return (
    <div>
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="text-3xl">🎉</div>
          <h1 className="text-3xl font-semibold text-ink-50">Bienvenue à la fête</h1>
          <p className="text-ink-400 max-w-lg mx-auto">
            Découvre qui sera là, renseigne tes préférences alimentaires, propose une question
            pour le quiz du soir, et retrouve-toi sur le mur de messages.
          </p>
        </div>

        <EventInfoCard />

        {storedCode && (
          <div className="card flex flex-wrap items-center justify-between gap-3 border-party-500/60">
            <div>
              <h2 className="font-semibold text-ink-50">Bon retour !</h2>
              <p className="text-sm text-ink-400">Ta fiche invité(e) est enregistrée sur cet appareil.</p>
            </div>
            <a href={`/invites/${storedCode}`} className="btn-primary shrink-0">
              Retrouver ma fiche
            </a>
          </div>
        )}

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-ink-50">Ma fiche invité(e)</h2>
          <p className="text-sm text-ink-400">
            Entre le code que tu as reçu (par SMS ou sur ton carton d'invitation) pour accéder à
            ta fiche personnelle.
          </p>
          <form onSubmit={goToProfile} className="flex gap-2">
            <input
              className="input"
              placeholder="Ton code d'accès"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="btn-primary shrink-0" type="submit">
              Accéder
            </button>
          </form>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <a href="/invites" className="card hover:border-party-300 transition">
            <h3 className="font-semibold text-ink-50">Voir les invités</h3>
            <p className="text-sm text-ink-400 mt-1">Qui sera de la fête ?</p>
          </a>
          <a href="/quiz/proposer" className="card hover:border-party-300 transition">
            <h3 className="font-semibold text-ink-50">Proposer une question</h3>
            <p className="text-sm text-ink-400 mt-1">Pour le grand quiz du soir</p>
          </a>
          <a href="/mur" className="card hover:border-party-300 transition">
            <h3 className="font-semibold text-ink-50">Mur de messages</h3>
            <p className="text-sm text-ink-400 mt-1">Blagues, photos, mots doux</p>
          </a>
        </div>
      </div>
    </div>
  );
}
