import { useEffect, useState } from "react";

import { api } from "../api.js";
import NavBar from "../components/NavBar.jsx";

const STATUS_LABEL = {
  pending: { text: "En attente de validation", cls: "text-amber-600" },
  accepted: { text: "Acceptée", cls: "text-emerald-600" },
  rejected: { text: "Refusée", cls: "text-rose-600" },
};

const emptyForm = { text: "", choice_1: "", choice_2: "", choice_3: "", choice_4: "" };

export default function QuestionSubmit() {
  const [code, setCode] = useState(localStorage.getItem("guest_access_code") || "");
  const [form, setForm] = useState(emptyForm);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (code) {
      localStorage.setItem("guest_access_code", code);
      api
        .get(`/api/questions/mine/${code}`)
        .then(setMine)
        .catch(() => setMine([]));
    }
  }, [code, success]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (
      !form.text.trim() ||
      !form.choice_1.trim() ||
      !form.choice_2.trim() ||
      !form.choice_3.trim() ||
      !form.choice_4.trim()
    ) {
      setError("Merci de remplir la question et les 4 réponses.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/questions", {
        ...form,
        correct_index: correctIndex,
        guest_access_code: code || null,
      });
      setForm(emptyForm);
      setCorrectIndex(0);
      setSuccess(true);
    } catch {
      setError("Impossible d'envoyer la question, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900">Proposer une question</h1>
        <p className="text-stone-500 text-sm">
          Propose une question à choix multiple (4 réponses). L'organisateur validera ta question
          avant de l'ajouter au quiz de la soirée.
        </p>

        <div>
          <label className="label">Ton code d'accès (facultatif, pour suivre tes questions)</label>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="Ton code d'invité"
          />
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Question</label>
            <textarea
              className="input"
              rows={2}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="Ex : En quelle année s'est-on rencontrés ?"
            />
          </div>

          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <input
                type="radio"
                name="correct"
                checked={correctIndex === n - 1}
                onChange={() => setCorrectIndex(n - 1)}
                className="w-5 h-5 accent-party-500 shrink-0"
              />
              <input
                className="input"
                placeholder={`Réponse ${n}`}
                value={form[`choice_${n}`]}
                onChange={(e) => setForm({ ...form, [`choice_${n}`]: e.target.value })}
              />
            </div>
          ))}
          <p className="text-xs text-stone-400">
            Sélectionne le rond à côté de la bonne réponse.
          </p>

          {error && <p className="text-rose-600 text-sm">{error}</p>}
          {success && <p className="text-emerald-600 text-sm">Question envoyée, merci !</p>}

          <button className="btn-primary w-full" disabled={submitting} type="submit">
            {submitting ? "Envoi..." : "Envoyer ma question"}
          </button>
        </form>

        {code && mine.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-stone-900">Mes questions proposées</h2>
            {mine.map((q) => (
              <div key={q.id} className="card">
                <p className="text-stone-900">{q.text}</p>
                <p className={`text-sm mt-1 ${STATUS_LABEL[q.status].cls}`}>
                  {STATUS_LABEL[q.status].text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
