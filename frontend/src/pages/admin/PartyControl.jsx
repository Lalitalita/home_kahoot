import { useEffect, useRef, useState } from "react";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";
import { wsUrl } from "../../ws.js";

const PHASE_LABEL = {
  lobby: "En attente dans le salon",
  question: "Question en cours",
  reveal: "Correction affichée",
  leaderboard: "Classement affiché",
  finished: "Quiz terminé",
};

export default function AdminPartyControl() {
  const [partyMode, setPartyMode] = useState(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    api.get("/api/settings").then((s) => setPartyMode(s.party_mode_active));
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl("/ws/admin"));
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.type === "state") setState(data);
    };
    return () => ws.close();
  }, []);

  async function togglePartyMode(active) {
    setBusy(true);
    try {
      await api.post("/api/admin/settings/party-mode", { active }, { auth: true });
      setPartyMode(active);
    } finally {
      setBusy(false);
    }
  }

  async function callControl(action) {
    setBusy(true);
    try {
      await api.post(`/api/admin/quiz/${action}`, {}, { auth: true });
    } finally {
      setBusy(false);
    }
  }

  const origin = window.location.origin;

  return (
    <AdminLayout title="Mode soirée">
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">Basculer l'application en mode soirée</h2>
          <p className="text-sm text-slate-400">
            Ferme les pages de préparation et réinitialise le quiz avec les questions acceptées.
          </p>
        </div>
        {partyMode === false && (
          <button className="btn-primary" disabled={busy} onClick={() => togglePartyMode(true)}>
            Activer le mode soirée 🎉
          </button>
        )}
        {partyMode === true && (
          <button className="btn-danger" disabled={busy} onClick={() => togglePartyMode(false)}>
            Désactiver le mode soirée
          </button>
        )}
      </div>

      {partyMode && (
        <>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="card">
              <h3 className="font-semibold text-white mb-2">Écran TV</h3>
              <p className="text-sm text-slate-400 mb-2">
                À afficher sur la télé/le vidéoprojecteur.
              </p>
              <code className="text-xs bg-slate-800 rounded px-2 py-1 block break-all">
                {origin}/soiree/ecran
              </code>
            </div>
            <div className="card">
              <h3 className="font-semibold text-white mb-2">Rejoindre (invités)</h3>
              <p className="text-sm text-slate-400 mb-2">À partager avec tout le monde.</p>
              <code className="text-xs bg-slate-800 rounded px-2 py-1 block break-all">
                {origin}/soiree
              </code>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-white">
                  {state ? PHASE_LABEL[state.phase] : "Connexion..."}
                </h3>
                {state && (
                  <p className="text-sm text-slate-400">
                    {state.players_count} joueur(s) connecté(s) · Question{" "}
                    {Math.min(state.question_index + 1, state.total_questions)}/{state.total_questions}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={busy} onClick={() => callControl("reset")}>
                  Réinitialiser
                </button>
                {state?.phase === "lobby" && (
                  <button className="btn-primary" disabled={busy} onClick={() => callControl("start")}>
                    Démarrer le quiz
                  </button>
                )}
                {state && state.phase !== "lobby" && state.phase !== "finished" && (
                  <button className="btn-primary" disabled={busy} onClick={() => callControl("advance")}>
                    Suivant ▶
                  </button>
                )}
              </div>
            </div>

            {state?.question && (
              <div className="bg-slate-800/60 rounded-xl p-4">
                <p className="text-white font-medium">{state.question.text}</p>
              </div>
            )}

            {state?.leaderboard?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Classement</h4>
                <ol className="space-y-1">
                  {state.leaderboard.map((p, i) => (
                    <li key={p.player_id} className="flex justify-between text-sm text-slate-300">
                      <span>
                        {i + 1}. {p.nickname}
                      </span>
                      <span className="font-mono">{p.score}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
