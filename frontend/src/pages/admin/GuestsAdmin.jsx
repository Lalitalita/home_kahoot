import { useEffect, useState } from "react";

import { api, downloadCsv } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

const emptyForm = { name: "", pseudo: "", description: "" };

const NON_ANSWERS = ["aucune", "aucun", "non", "rien"];

function hasContent(value) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && !NON_ANSWERS.includes(normalized);
}

function DietCell({ value }) {
  if (!hasContent(value)) return <span className="text-ink-500">{value || "-"}</span>;
  return <span className="text-amber-400 font-medium">{value}</span>;
}

export default function AdminGuests() {
  const [guests, setGuests] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [showDiet, setShowDiet] = useState(true);

  function load() {
    api.get("/api/admin/guests", { auth: true }).then(setGuests).catch(() => {});
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.post("/api/admin/guests", form, { auth: true });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdate(guest, field, value) {
    await api.patch(`/api/admin/guests/${guest.id}`, { [field]: value }, { auth: true });
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cet invité ?")) return;
    await api.delete(`/api/admin/guests/${id}`, { auth: true });
    load();
  }

  async function handlePhoto(guest, file) {
    const body = new FormData();
    body.append("file", file);
    await api.post(`/api/admin/guests/${guest.id}/photo`, body, { isForm: true, auth: true });
    load();
  }

  return (
    <AdminLayout title="Gestion des invités">
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          className="btn-secondary"
          onClick={() => downloadCsv("/api/admin/export/guests.csv", "invites.csv")}
        >
          Exporter la liste (CSV)
        </button>
        <button
          className="btn-secondary"
          onClick={() => downloadCsv("/api/admin/export/allergies.csv", "regimes_alimentaires.csv")}
        >
          Exporter les régimes (CSV)
        </button>
        <button className="btn-secondary" onClick={() => setShowDiet((v) => !v)}>
          {showDiet ? "Masquer" : "Afficher"} les infos alimentaires
        </button>
      </div>

      <form onSubmit={handleCreate} className="card mb-6 grid sm:grid-cols-4 gap-3">
        <input
          className="input"
          placeholder="Nom"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="Pseudo (optionnel)"
          value={form.pseudo}
          onChange={(e) => setForm({ ...form, pseudo: e.target.value })}
        />
        <input
          className="input sm:col-span-1"
          placeholder="Description (ex: collègue de travail)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button className="btn-primary" type="submit">
          Ajouter
        </button>
      </form>
      {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}

      <div className="overflow-x-auto card p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-500 border-b border-ink-700">
            <tr>
              <th className="p-3">Photo</th>
              <th className="p-3">Nom</th>
              <th className="p-3">Pseudo</th>
              <th className="p-3">Description</th>
              <th className="p-3">Amène</th>
              {showDiet && (
                <>
                  <th className="p-3">Allergies</th>
                  <th className="p-3">Régime</th>
                  <th className="p-3">Intolérances</th>
                  <th className="p-3">Commentaire</th>
                </>
              )}
              <th className="p-3">Lien personnel</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id} className="border-b border-ink-800">
                <td className="p-3">
                  <label className="block w-10 h-10 rounded-full overflow-hidden bg-ink-800 cursor-pointer shrink-0 flex items-center justify-center text-lg">
                    {g.photo_url ? (
                      <img src={g.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      "🙂"
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handlePhoto(g, e.target.files[0])}
                    />
                  </label>
                </td>
                <td className="p-3">
                  <EditableCell value={g.name} onSave={(v) => handleUpdate(g, "name", v)} />
                </td>
                <td className="p-3">
                  <EditableCell value={g.pseudo || ""} onSave={(v) => handleUpdate(g, "pseudo", v)} />
                </td>
                <td className="p-3 max-w-[16rem]">
                  <EditableCell
                    value={g.description || ""}
                    onSave={(v) => handleUpdate(g, "description", v)}
                  />
                </td>
                <td className="p-3 max-w-[14rem]">
                  <EditableCell
                    value={g.bringing_item || ""}
                    onSave={(v) => handleUpdate(g, "bringing_item", v)}
                  />
                </td>
                {showDiet && (
                  <>
                    <td className="p-3">
                      <DietCell value={g.allergies} />
                    </td>
                    <td className="p-3">
                      <DietCell value={g.diet} />
                    </td>
                    <td className="p-3">
                      <DietCell value={g.intolerances} />
                    </td>
                    <td className="p-3 text-ink-400 max-w-[12rem]">{g.dietary_comment || "-"}</td>
                  </>
                )}
                <td className="p-3">
                  <code className="text-xs bg-ink-800 text-ink-200 rounded px-2 py-1">/invites/{g.access_code}</code>
                </td>
                <td className="p-3">
                  <button className="text-rose-600 hover:text-rose-500 text-xs" onClick={() => handleDelete(g.id)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-ink-500">
                  Aucun invité pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  if (!editing) {
    return (
      <span className="cursor-pointer hover:text-party-400" onClick={() => setEditing(true)}>
        {value || <span className="text-ink-600">—</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      className="input py-1 px-2 text-sm"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (val !== value) onSave(val);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
      }}
    />
  );
}
