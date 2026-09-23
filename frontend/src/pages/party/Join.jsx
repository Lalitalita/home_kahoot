import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Join() {
  const [nickname, setNickname] = useState(localStorage.getItem("player_nickname") || "");
  const [code, setCode] = useState(localStorage.getItem("guest_access_code") || "");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) return;
    localStorage.setItem("player_nickname", trimmed);
    if (code.trim()) localStorage.setItem("guest_access_code", code.trim());
    // A new nickname means a fresh player (score restarts).
    localStorage.removeItem("player_id");
    navigate("/soiree/manette");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ink-900">
      <div className="card w-full max-w-sm space-y-5 text-center">
        <div className="text-5xl">🎮</div>
        <h1 className="text-2xl font-bold text-white">Rejoindre le quiz</h1>
        <p className="text-sm text-ink-400">
          Choisis un pseudo pour le grand quiz de la soirée. Regarde l'écran principal pour suivre
          les questions !
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="input text-center text-lg"
            placeholder="Ton pseudo"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            autoFocus
          />
          <input
            className="input text-center text-sm"
            placeholder="Code invité (optionnel)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn-primary w-full text-lg" type="submit">
            C'est parti !
          </button>
        </form>
      </div>
    </div>
  );
}
