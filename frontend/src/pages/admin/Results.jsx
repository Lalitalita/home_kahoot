import { useEffect, useState } from "react";

import { api, downloadFile } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminResults() {
  const [sessions, setSessions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  function load() {
    api.get("/api/admin/sessions", { auth: true }).then(setSessions).catch(() => {});
  }

  useEffect(load, []);

  async function toggleExpand(session) {
    if (expandedId === session.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(session.id);
    setLoadingDetail(true);
    try {
      const d = await api.get(`/api/admin/sessions/${session.id}`, { auth: true });
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer cette session et tous ses résultats ?")) return;
    await api.delete(`/api/admin/sessions/${id}`, { auth: true });
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
    }
    load();
  }

  async function refreshDetail() {
    if (!expandedId) return;
    const d = await api.get(`/api/admin/sessions/${expandedId}`, { auth: true });
    setDetail(d);
  }

  async function updatePlayerEmail(playerId, email) {
    await api.patch(`/api/admin/players/${playerId}/email`, { email }, { auth: true });
    refreshDetail();
  }

  async function resendPlayerEmail(playerId, overrideEmail) {
    try {
      const res = await api.post(
        `/api/admin/players/${playerId}/resend-email`,
        overrideEmail ? { email: overrideEmail } : {},
        { auth: true }
      );
      alert(`Récap renvoyé à ${res.sent_to}`);
      refreshDetail();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <AdminLayout title="Résultats du quiz">
      <p className="text-sm text-ink-500 mb-6">
        Chaque fois que le quiz est réinitialisé ou lancé, une nouvelle session est créée — tu
        peux donc faire plusieurs essais avant la soirée et retrouver les résultats de chacun
        séparément.
      </p>

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                className="text-left flex-1 min-w-0"
                onClick={() => toggleExpand(s)}
              >
                <div className="font-semibold text-ink-50">{s.label}</div>
                <div className="text-sm text-ink-500">
                  {formatDate(s.started_at)}
                  {s.ended_at ? ` → terminée` : ` → en cours`} · {s.players_count} joueur(s) ·
                  meilleur score {s.top_score}
                </div>
              </button>
              <div className="flex gap-2 shrink-0">
                <button
                  className="btn-secondary py-1.5 px-3 text-xs"
                  onClick={() => downloadFile(`/api/admin/sessions/${s.id}/export.csv`, `resultats_${s.label}.csv`)}
                >
                  CSV
                </button>
                <button
                  className="btn-secondary py-1.5 px-3 text-xs"
                  onClick={() => downloadFile(`/api/admin/sessions/${s.id}/export.pdf`, `resultats_${s.label}.pdf`)}
                >
                  PDF
                </button>
                <button className="btn-danger py-1.5 px-3 text-xs" onClick={() => remove(s.id)}>
                  Suppr.
                </button>
              </div>
            </div>

            {expandedId === s.id && (
              <div className="mt-4 pt-4 border-t border-ink-700">
                {loadingDetail && <p className="text-ink-500 text-sm">Chargement...</p>}
                {!loadingDetail && detail && (
                  <SessionDetail
                    detail={detail}
                    onEmailChange={updatePlayerEmail}
                    onResend={resendPlayerEmail}
                  />
                )}
              </div>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="text-ink-500 text-center py-8">
            Aucune session pour l'instant — lance le quiz depuis "Mode soirée" pour en créer une.
          </p>
        )}
      </div>
    </AdminLayout>
  );
}

function SessionDetail({ detail, onEmailChange, onResend }) {
  const ranked = [...detail.players].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-4">
      <ol className="space-y-1">
        {ranked.map((p, i) => (
          <li key={p.player_id} className="flex justify-between text-sm text-ink-200">
            <span>
              #{i + 1} {p.nickname}
            </span>
            <span className="font-mono">{p.score} pts</span>
          </li>
        ))}
      </ol>

      {ranked.map((p) => (
        <div key={p.player_id}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-party-400">
              {p.nickname} — {p.score} pts
            </h4>
            <PlayerEmailControls
              player={p}
              onEmailChange={(email) => onEmailChange(p.player_id, email)}
              onResend={(overrideEmail) => onResend(p.player_id, overrideEmail)}
            />
          </div>
          {p.answers.length === 0 ? (
            <p className="text-xs text-ink-500">Aucune réponse.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-ink-500 border-b border-ink-800">
                  <tr>
                    <th className="p-2">Question</th>
                    <th className="p-2">Réponse donnée</th>
                    <th className="p-2">Bonne réponse</th>
                    <th className="p-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {p.answers.map((a) => (
                    <tr key={a.question_id} className="border-b border-ink-800/60">
                      <td className="p-2 text-ink-200">{a.question_text}</td>
                      <td
                        className={`p-2 ${
                          !a.answered
                            ? "text-ink-500"
                            : a.is_correct
                            ? "text-emerald-500"
                            : "text-rose-500"
                        }`}
                      >
                        {a.answered ? a.choices[a.choice_index] ?? "—" : "Pas de réponse"}
                      </td>
                      <td className="p-2 text-ink-400">{a.choices[a.correct_index]}</td>
                      <td className="p-2 text-ink-200">{a.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PlayerEmailControls({ player, onEmailChange, onResend }) {
  const [email, setEmail] = useState(player.email || "");
  const [sending, setSending] = useState(false);

  async function handleResend(custom) {
    setSending(true);
    try {
      await onResend(custom);
    } finally {
      setSending(false);
    }
  }

  function handleResendCustom() {
    const custom = window.prompt("Renvoyer le récap à quelle adresse ?", email || "");
    if (custom && custom.trim()) handleResend(custom.trim());
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <input
        className="input py-1 px-2 text-xs w-48"
        type="email"
        placeholder="Email (optionnel)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => {
          if (email.trim() !== (player.email || "")) onEmailChange(email.trim());
        }}
      />
      <button
        className="btn-secondary py-1 px-2 text-xs"
        disabled={!email.trim() || sending}
        onClick={() => handleResend()}
      >
        {sending ? "Envoi..." : "Renvoyer"}
      </button>
      <button className="text-ink-500 hover:text-ink-200" onClick={handleResendCustom}>
        Autre adresse…
      </button>
      {player.recap_emailed_at && (
        <span className="text-ink-600">
          Envoyé le {new Date(player.recap_emailed_at).toLocaleString("fr-FR")}
        </span>
      )}
    </div>
  );
}
