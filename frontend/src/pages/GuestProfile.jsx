import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api.js";
import NavBar from "../components/NavBar.jsx";

export default function GuestProfile() {
  const { accessCode } = useParams();
  const [guest, setGuest] = useState(null);
  const [form, setForm] = useState({
    pseudo: "",
    allergies: "",
    diet: "",
    intolerances: "",
    dietary_comment: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get(`/api/guests/me/${accessCode}`)
      .then((g) => {
        setGuest(g);
        setForm({
          pseudo: g.pseudo || "",
          allergies: g.allergies || "",
          diet: g.diet || "",
          intolerances: g.intolerances || "",
          dietary_comment: g.dietary_comment || "",
        });
      })
      .catch(() => setError("Code invalide, vérifie ton lien d'invitation."))
      .finally(() => setLoading(false));
  }, [accessCode]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.patch(`/api/guests/me/${accessCode}`, form);
      setGuest(updated);
      setSaved(true);
    } catch {
      setError("Impossible d'enregistrer, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const updated = await api.post(`/api/guests/me/${accessCode}/photo`, body, {
        isForm: true,
      });
      setGuest(updated);
    } catch {
      setError("Photo trop lourde ou format non supporté.");
    }
  }

  return (
    <div>
      <NavBar />
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {loading && <p className="text-slate-400">Chargement...</p>}
        {error && !guest && <p className="text-red-400">{error}</p>}

        {guest && (
          <>
            <div className="card flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center text-3xl">
                {guest.photo_url ? (
                  <img src={guest.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  "🙂"
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{guest.name}</h1>
                {guest.description && (
                  <p className="text-sm text-slate-400">{guest.description}</p>
                )}
                <label className="text-xs text-party-400 cursor-pointer mt-1 inline-block">
                  Changer la photo
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="card space-y-4">
              <h2 className="text-lg font-semibold text-white">Mes informations</h2>

              <div>
                <label className="label">Pseudo (facultatif)</label>
                <input
                  className="input"
                  value={form.pseudo}
                  onChange={(e) => setForm({ ...form, pseudo: e.target.value })}
                  placeholder="Comment on t'appelle ?"
                />
              </div>

              <div>
                <label className="label">Allergies alimentaires</label>
                <input
                  className="input"
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  placeholder="Ex : arachides, fruits de mer..."
                />
              </div>

              <div>
                <label className="label">Régime alimentaire</label>
                <input
                  className="input"
                  value={form.diet}
                  onChange={(e) => setForm({ ...form, diet: e.target.value })}
                  placeholder="Ex : végétarien, vegan, halal..."
                />
              </div>

              <div>
                <label className="label">Intolérances</label>
                <input
                  className="input"
                  value={form.intolerances}
                  onChange={(e) => setForm({ ...form, intolerances: e.target.value })}
                  placeholder="Ex : lactose, gluten..."
                />
              </div>

              <div>
                <label className="label">Commentaire libre</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.dietary_comment}
                  onChange={(e) => setForm({ ...form, dietary_comment: e.target.value })}
                  placeholder="Autre chose à préciser ?"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
              {saved && <p className="text-green-400 text-sm">Enregistré ✅</p>}

              <button className="btn-primary w-full" disabled={saving} type="submit">
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
