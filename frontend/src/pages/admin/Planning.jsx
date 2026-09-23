import { useEffect, useState } from "react";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

const TYPE_LABEL = {
  activity: "Activité",
  meal_prep: "Repas / préparation",
  break: "Pause",
};

const TYPE_STYLE = {
  activity: "bg-party-600",
  meal_prep: "bg-amber-600",
  break: "bg-sky-700",
};

const emptyForm = { type: "activity", title: "", duration_minutes: 30, fixed_start_time: "", notes: "" };

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function computeTimeline(dayStart, items) {
  let clock = toMinutes(dayStart || "10:00");
  return items.map((item) => {
    if (item.fixed_start_time) clock = toMinutes(item.fixed_start_time);
    const start = clock;
    const end = clock + Number(item.duration_minutes || 0);
    clock = end;
    return { ...item, computedStart: toHHMM(start), computedEnd: toHHMM(end) };
  });
}

const emptyPartyInfo = {
  party_location_name: "",
  party_address: "",
  party_date: "",
  party_time: "",
};

export default function AdminPlanning() {
  const [dayStart, setDayStart] = useState("10:00");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [partyInfo, setPartyInfo] = useState(emptyPartyInfo);
  const [partyInfoSaved, setPartyInfoSaved] = useState(false);

  function load() {
    Promise.all([
      api.get("/api/admin/schedule/day-start", { auth: true }),
      api.get("/api/admin/schedule/items", { auth: true }),
      api.get("/api/settings"),
    ])
      .then(([daySettings, itemsRes, settingsRes]) => {
        setDayStart(daySettings.day_start_time);
        setItems(itemsRes);
        setPartyInfo({
          party_location_name: settingsRes.party_location_name || "",
          party_address: settingsRes.party_address || "",
          party_date: settingsRes.party_date || "",
          party_time: settingsRes.party_time || "",
        });
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function saveDayStart(e) {
    e.preventDefault();
    const res = await api.patch(
      "/api/admin/schedule/day-start",
      { day_start_time: dayStart },
      { auth: true }
    );
    setDayStart(res.day_start_time);
  }

  async function savePartyInfo(e) {
    e.preventDefault();
    setPartyInfoSaved(false);
    await api.patch("/api/admin/settings/party-info", partyInfo, { auth: true });
    setPartyInfoSaved(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.post(
      "/api/admin/schedule/items",
      {
        type: form.type,
        title: form.title,
        duration_minutes: Number(form.duration_minutes) || 0,
        fixed_start_time: form.fixed_start_time || null,
        notes: form.notes || null,
      },
      { auth: true }
    );
    setForm(emptyForm);
    load();
  }

  async function updateField(item, field, value) {
    await api.patch(`/api/admin/schedule/items/${item.id}`, { [field]: value }, { auth: true });
    load();
  }

  async function move(item, direction) {
    await api.post(`/api/admin/schedule/items/${item.id}/move?direction=${direction}`, {}, { auth: true });
    load();
  }

  async function remove(id) {
    if (!confirm("Supprimer ce bloc du planning ?")) return;
    await api.delete(`/api/admin/schedule/items/${id}`, { auth: true });
    load();
  }

  const timeline = computeTimeline(dayStart, items);

  return (
    <AdminLayout title="Planning de la journée">
      {error && <p className="text-rose-500 text-sm mb-4">{error}</p>}

      <form onSubmit={savePartyInfo} className="card mb-6 space-y-3">
        <div>
          <h2 className="font-semibold text-ink-50">Infos à partager avec les invités</h2>
          <p className="text-sm text-ink-500">
            Affichées sur la page d'accueil et la fiche RSVP de chaque invité, avec des liens
            Maps/Waze calculés à partir de l'adresse.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Nom du lieu</label>
            <input
              className="input"
              placeholder="Ex : Chez Lana"
              value={partyInfo.party_location_name}
              onChange={(e) => setPartyInfo({ ...partyInfo, party_location_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Adresse complète</label>
            <input
              className="input"
              placeholder="Ex : 12 rue de la Fête, 75000 Paris"
              value={partyInfo.party_address}
              onChange={(e) => setPartyInfo({ ...partyInfo, party_address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={partyInfo.party_date}
              onChange={(e) => setPartyInfo({ ...partyInfo, party_date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Heure</label>
            <input
              type="time"
              className="input"
              value={partyInfo.party_time}
              onChange={(e) => setPartyInfo({ ...partyInfo, party_time: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary" type="submit">
            Enregistrer
          </button>
          {partyInfoSaved && <span className="text-emerald-500 text-sm">Enregistré</span>}
        </div>
      </form>

      <div className="card mb-6 flex flex-wrap items-end gap-3">
        <form onSubmit={saveDayStart} className="flex items-end gap-2">
          <div>
            <label className="label">La journée commence à</label>
            <input
              type="time"
              className="input w-40"
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
            />
          </div>
          <button className="btn-secondary" type="submit">
            Enregistrer
          </button>
        </form>
        <p className="text-sm text-ink-500">
          Les horaires ci-dessous se recalculent automatiquement à partir de cette heure et de la
          durée de chaque bloc. Épingle une heure fixe sur un bloc (ex : arrivée des invités) pour
          recaler le planning à ce moment-là.
        </p>
      </div>

      <form onSubmit={handleCreate} className="card mb-6 grid sm:grid-cols-6 gap-3">
        <select
          className="input"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="activity">Activité</option>
          <option value="meal_prep">Repas / préparation</option>
          <option value="break">Pause</option>
        </select>
        <input
          className="input sm:col-span-2"
          placeholder="Titre"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          type="number"
          className="input"
          placeholder="Durée (min)"
          value={form.duration_minutes}
          onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
        />
        <input
          type="time"
          className="input"
          title="Heure fixe (optionnel)"
          value={form.fixed_start_time}
          onChange={(e) => setForm({ ...form, fixed_start_time: e.target.value })}
        />
        <button className="btn-primary" type="submit">
          Ajouter
        </button>
      </form>

      <div className="space-y-3">
        {timeline.map((item, i) => (
          <div key={item.id} className="card flex items-start gap-4">
            <div className="text-center shrink-0 w-20">
              <div className="text-lg font-semibold text-ink-50 font-mono">{item.computedStart}</div>
              <div className="text-xs text-ink-500 font-mono">→ {item.computedEnd}</div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${TYPE_STYLE[item.type]}`}>
                  {TYPE_LABEL[item.type]}
                </span>
                {item.fixed_start_time && (
                  <span className="text-xs text-ink-500">📌 heure fixe {item.fixed_start_time}</span>
                )}
              </div>
              <EditableCell value={item.title} onSave={(v) => updateField(item, "title", v)} bold />
              <div className="flex items-center gap-2 mt-1 text-sm text-ink-400">
                <EditableCell
                  value={String(item.duration_minutes)}
                  onSave={(v) => updateField(item, "duration_minutes", Number(v) || 0)}
                />
                <span>min</span>
              </div>
              {(item.notes || item.notes === "") && (
                <div className="mt-1 text-sm text-ink-400">
                  <EditableCell
                    value={item.notes || ""}
                    onSave={(v) => updateField(item, "notes", v || null)}
                    placeholder="Ajouter une note"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex gap-1">
                <button
                  className="text-ink-500 hover:text-ink-100 text-xs disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(item, "up")}
                >
                  ▲
                </button>
                <button
                  className="text-ink-500 hover:text-ink-100 text-xs disabled:opacity-30"
                  disabled={i === timeline.length - 1}
                  onClick={() => move(item, "down")}
                >
                  ▼
                </button>
              </div>
              <button className="text-rose-500 hover:text-rose-400 text-xs" onClick={() => remove(item.id)}>
                Supprimer
              </button>
            </div>
          </div>
        ))}
        {timeline.length === 0 && (
          <p className="text-ink-500 text-center py-8">Aucun bloc dans le planning pour l'instant.</p>
        )}
      </div>
    </AdminLayout>
  );
}

function EditableCell({ value, onSave, bold, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:text-party-400 ${bold ? "text-ink-50 font-semibold" : ""}`}
        onClick={() => setEditing(true)}
      >
        {value || <span className="text-ink-600">{placeholder || "—"}</span>}
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
