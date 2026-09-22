import { useEffect, useState } from "react";

import { api, downloadCsv } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

const STATUS_STYLE = {
  pending: "bg-amber-500/20 text-amber-300",
  accepted: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
};

const emptyForm = {
  text: "",
  choice_1: "",
  choice_2: "",
  choice_3: "",
  choice_4: "",
  correct_index: 0,
};

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get("/api/admin/questions", { auth: true }).then(setQuestions).catch(() => {});
  }

  useEffect(load, []);

  async function setStatus(q, status) {
    await api.patch(`/api/admin/questions/${q.id}`, { status }, { auth: true });
    load();
  }

  async function updateField(q, field, value) {
    await api.patch(`/api/admin/questions/${q.id}`, { [field]: value }, { auth: true });
    load();
  }

  async function remove(id) {
    if (!confirm("Supprimer cette question ?")) return;
    await api.delete(`/api/admin/questions/${id}`, { auth: true });
    load();
  }

  async function uploadImage(q, file) {
    const body = new FormData();
    body.append("file", file);
    await api.post(`/api/admin/questions/${q.id}/image`, body, { isForm: true, auth: true });
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.text.trim() || [form.choice_1, form.choice_2, form.choice_3, form.choice_4].some((c) => !c.trim())) {
      return;
    }
    await api.post("/api/admin/questions", form, { auth: true });
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  const filtered = questions.filter((q) => filter === "all" || q.status === filter);

  return (
    <AdminLayout title="Questions du quiz">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {["all", "pending", "accepted", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f ? "bg-party-600 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            {{ all: "Toutes", pending: "En attente", accepted: "Acceptées", rejected: "Refusées" }[f]}
          </button>
        ))}
        <button className="btn-secondary ml-auto" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuler" : "+ Ajouter une question"}
        </button>
        <button
          className="btn-secondary"
          onClick={() => downloadCsv("/api/admin/export/questions.csv", "questions_quiz.csv")}
        >
          Exporter (CSV)
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-3">
          <textarea
            className="input"
            placeholder="Question"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
          />
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <input
                type="radio"
                checked={form.correct_index === n - 1}
                onChange={() => setForm({ ...form, correct_index: n - 1 })}
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
          <button className="btn-primary" type="submit">
            Ajouter (acceptée automatiquement)
          </button>
        </form>
      )}

      <div className="space-y-4">
        {filtered.map((q) => (
          <div key={q.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <textarea
                  className="input mb-2"
                  value={q.text}
                  onChange={(e) => updateField(q, "text", e.target.value)}
                />
                <div className="grid sm:grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                          q.correct_index === n - 1
                            ? "bg-green-500 text-white"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {n}
                      </span>
                      <input
                        className="input py-1.5"
                        value={q[`choice_${n}`]}
                        onChange={(e) => updateField(q, `choice_${n}`, e.target.value)}
                      />
                      <button
                        type="button"
                        title="Marquer comme bonne réponse"
                        className="text-xs text-slate-500 hover:text-green-400 shrink-0"
                        onClick={() => updateField(q, "correct_index", n - 1)}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
                {q.image_url && (
                  <img src={q.image_url} alt="" className="mt-3 max-h-40 rounded-lg" />
                )}
                <label className="text-xs text-party-400 cursor-pointer mt-2 inline-block">
                  {q.image_url ? "Changer l'image" : "Ajouter une image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadImage(q, e.target.files[0])}
                  />
                </label>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[q.status]}`}>
                  {q.status}
                </span>
                <span className="text-xs text-slate-500">
                  {q.guest_id ? "Proposée par un invité" : "Admin"}
                </span>
                <div className="flex gap-1">
                  {q.status !== "accepted" && (
                    <button className="btn-primary py-1 px-2 text-xs" onClick={() => setStatus(q, "accepted")}>
                      Accepter
                    </button>
                  )}
                  {q.status !== "rejected" && (
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => setStatus(q, "rejected")}>
                      Refuser
                    </button>
                  )}
                  <button className="btn-danger py-1 px-2 text-xs" onClick={() => remove(q.id)}>
                    Suppr.
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-500 text-center py-8">Aucune question ici.</p>
        )}
      </div>
    </AdminLayout>
  );
}
