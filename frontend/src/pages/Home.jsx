import { useState } from "react";
import { useNavigate } from "react-router-dom";

import NavBar from "../components/NavBar.jsx";

export default function Home() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  function goToProfile(e) {
    e.preventDefault();
    if (code.trim()) navigate(`/invites/${code.trim()}`);
  }

  return (
    <div>
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="text-6xl">🎂🎉</div>
          <h1 className="text-4xl font-bold text-white">Bienvenue à la fête !</h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Découvre qui sera là, renseigne tes préférences alimentaires, propose une question
            pour le quiz du soir, et retrouve-toi sur le mur de messages.
          </p>
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-white">Ma fiche invité(e)</h2>
          <p className="text-sm text-slate-400">
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
          <a href="/invites" className="card hover:border-party-600 transition">
            <div className="text-3xl mb-2">👀</div>
            <h3 className="font-semibold text-white">Voir les invités</h3>
            <p className="text-sm text-slate-400">Qui sera de la fête ?</p>
          </a>
          <a href="/quiz/proposer" className="card hover:border-party-600 transition">
            <div className="text-3xl mb-2">❓</div>
            <h3 className="font-semibold text-white">Proposer une question</h3>
            <p className="text-sm text-slate-400">Pour le grand quiz du soir</p>
          </a>
          <a href="/mur" className="card hover:border-party-600 transition">
            <div className="text-3xl mb-2">💬</div>
            <h3 className="font-semibold text-white">Mur de messages</h3>
            <p className="text-sm text-slate-400">Blagues, photos, mots doux</p>
          </a>
        </div>
      </div>
    </div>
  );
}
