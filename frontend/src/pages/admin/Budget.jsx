import { useEffect, useState } from "react";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";
import { TYPE_LABEL, TYPE_STYLE } from "../../components/scheduleTypes.js";

const emptyForm = { name: "", price: "", prep_time_minutes: "", allergens: "", notes: "" };

function formatEuro(value) {
  return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

export default function AdminBudget() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [targetInput, setTargetInput] = useState("");
  const [error, setError] = useState(null);

  function load() {
    Promise.all([
      api.get("/api/admin/budget/items", { auth: true }),
      api.get("/api/admin/budget/summary", { auth: true }),
      api.get("/api/admin/budget/tasks", { auth: true }),
    ])
      .then(([itemsRes, summaryRes, tasksRes]) => {
        setItems(itemsRes);
        setSummary(summaryRes);
        setTargetInput(summaryRes.budget_target ?? "");
        setTasks(tasksRes);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function saveTarget(e) {
    e.preventDefault();
    const value = targetInput === "" ? null : Number(targetInput);
    const updated = await api.patch(
      "/api/admin/budget/target",
      { budget_target: value },
      { auth: true }
    );
    setSummary(updated);
  }

  const activities = items.filter((i) => i.category === "activity");
  const food = items.filter((i) => i.category === "food");

  return (
    <AdminLayout title="Budget & listes">
      {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}

      <div className="card mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form onSubmit={saveTarget} className="flex items-end gap-2">
            <div>
              <label className="label">Budget prévisionnel</label>
              <input
                className="input w-40"
                type="number"
                step="0.01"
                placeholder="Ex : 200"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
              />
            </div>
            <button className="btn-secondary" type="submit">
              Enregistrer
            </button>
          </form>

          {summary && (
            <div className="flex gap-6 text-right">
              <Stat label="Activités" value={formatEuro(summary.total_activities)} />
              <Stat label="Nourriture" value={formatEuro(summary.total_food)} />
              <Stat label="Total prévu" value={formatEuro(summary.total)} highlight />
              {summary.remaining !== null && (
                <Stat
                  label="Reste"
                  value={formatEuro(summary.remaining)}
                  danger={summary.remaining < 0}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <BudgetSection
        title="Activités"
        category="activity"
        items={activities}
        tasks={tasks}
        showAllergens={false}
        onChange={load}
      />

      <BudgetSection
        title="Nourriture"
        category="food"
        items={food}
        tasks={tasks}
        showAllergens
        onChange={load}
      />
    </AdminLayout>
  );
}

function Stat({ label, value, highlight, danger }) {
  return (
    <div>
      <div
        className={`text-lg font-semibold ${
          danger ? "text-rose-600" : highlight ? "text-party-400" : "text-ink-50"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  );
}

function BudgetSection({ title, category, items, tasks, showAllergens, onChange }) {
  const [form, setForm] = useState(emptyForm);
  const total = items.reduce((sum, i) => sum + Number(i.price || 0), 0);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post(
      "/api/admin/budget/items",
      {
        category,
        name: form.name,
        price: form.price === "" ? 0 : Number(form.price),
        prep_time_minutes: form.prep_time_minutes === "" ? null : Number(form.prep_time_minutes),
        allergens: showAllergens ? form.allergens || null : null,
        notes: form.notes || null,
      },
      { auth: true }
    );
    setForm(emptyForm);
    onChange();
  }

  async function updateField(item, field, value) {
    await api.patch(`/api/admin/budget/items/${item.id}`, { [field]: value }, { auth: true });
    onChange();
  }

  async function remove(id) {
    if (!confirm("Supprimer cet élément ?")) return;
    await api.delete(`/api/admin/budget/items/${id}`, { auth: true });
    onChange();
  }

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-semibold text-ink-50">{title}</h2>
        <span className="text-sm text-ink-400">Sous-total : {formatEuro(total)}</span>
      </div>

      <form
        onSubmit={handleCreate}
        className={`card mb-4 grid gap-3 ${
          showAllergens ? "sm:grid-cols-6" : "sm:grid-cols-4"
        }`}
      >
        <input
          className="input sm:col-span-2"
          placeholder="Nom"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input"
          type="number"
          step="0.01"
          placeholder="Prix (€)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        <input
          className="input"
          type="number"
          placeholder="Préparation (min)"
          value={form.prep_time_minutes}
          onChange={(e) => setForm({ ...form, prep_time_minutes: e.target.value })}
        />
        {showAllergens && (
          <input
            className="input"
            placeholder="Allergènes (ex : arachides, gluten)"
            value={form.allergens}
            onChange={(e) => setForm({ ...form, allergens: e.target.value })}
          />
        )}
        <button className="btn-primary" type="submit">
          Ajouter
        </button>
      </form>

      <div className="overflow-x-auto card p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-500 border-b border-ink-700">
            <tr>
              <th className="p-3">Fait</th>
              <th className="p-3">Nom</th>
              <th className="p-3">Prix</th>
              <th className="p-3">Temps de préparation</th>
              {showAllergens && <th className="p-3">Allergènes</th>}
              {showAllergens && <th className="p-3">Compatibilité invités</th>}
              <th className="p-3">Notes</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-ink-800 align-top">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={item.is_done}
                    onChange={(e) => updateField(item, "is_done", e.target.checked)}
                    className="w-5 h-5 accent-party-500"
                  />
                </td>
                <td className={`p-3 ${item.is_done ? "text-ink-500 line-through" : ""}`}>
                  <EditableCell value={item.name} onSave={(v) => updateField(item, "name", v)} />
                </td>
                <td className="p-3 w-24">
                  <EditableCell
                    value={String(item.price)}
                    onSave={(v) => updateField(item, "price", Number(v) || 0)}
                  />
                  <span className="text-xs text-ink-500"> €</span>
                </td>
                <td className="p-3 w-48">
                  <PrepTimeCell item={item} tasks={tasks} onSave={updateField} onChange={onChange} />
                </td>
                {showAllergens && (
                  <td className="p-3 max-w-[10rem]">
                    <EditableCell
                      value={item.allergens || ""}
                      onSave={(v) => updateField(item, "allergens", v || null)}
                    />
                  </td>
                )}
                {showAllergens && (
                  <td className="p-3 max-w-[14rem]">
                    <AllergyCompat item={item} />
                  </td>
                )}
                <td className="p-3 max-w-[12rem] text-ink-400">
                  <EditableCell
                    value={item.notes || ""}
                    onSave={(v) => updateField(item, "notes", v || null)}
                  />
                </td>
                <td className="p-3">
                  <button
                    className="text-rose-600 hover:text-rose-500 text-xs"
                    onClick={() => remove(item.id)}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={showAllergens ? 8 : 6} className="p-6 text-center text-ink-500">
                  Rien pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Shows either the manual "prep_time_minutes" (free entry, no tasks linked)
// or the sum of every linked planning task's duration once at least one is
// linked — that total then becomes read-only, since it's computed.
function PrepTimeCell({ item, tasks, onSave, onChange }) {
  const [modalOpen, setModalOpen] = useState(false);
  const linked = item.linked_tasks || [];

  return (
    <div>
      {linked.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1 mb-1">
            {linked.map((t) => (
              <span key={t.id} className="text-[10px] bg-ink-800 text-ink-300 rounded-full px-2 py-0.5">
                {t.title}
              </span>
            ))}
          </div>
          <p className="text-sm text-ink-100 font-medium">
            {item.linked_minutes} min <span className="text-ink-500 font-normal text-xs">(total lié)</span>
          </p>
        </>
      ) : (
        <div className="flex items-baseline gap-1">
          <EditableCell
            value={item.prep_time_minutes != null ? String(item.prep_time_minutes) : ""}
            onSave={(v) => onSave(item, "prep_time_minutes", v === "" ? null : Number(v))}
          />
          <span className="text-xs text-ink-500">min</span>
        </div>
      )}
      <button
        type="button"
        className="text-xs text-party-400 hover:underline mt-0.5"
        onClick={() => setModalOpen(true)}
      >
        {linked.length > 0 ? "Modifier les tâches liées" : "Lier des tâches"}
      </button>
      {modalOpen && (
        <TaskLinkModal
          item={item}
          tasks={tasks}
          onClose={() => setModalOpen(false)}
          onChange={onChange}
        />
      )}
    </div>
  );
}

// A search-and-select popup rather than a cramped inline checklist — shows
// each task's type, start time and duration so there's no doubt about which
// "Préparer le gâteau" is meant when several blocks share a similar name.
function TaskLinkModal({ item, tasks, onClose, onChange }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState((item.linked_tasks || []).map((t) => t.id));
  const [saving, setSaving] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? tasks.filter((t) => t.title.toLowerCase().includes(normalizedQuery))
    : tasks;

  function toggle(taskId) {
    setSelected((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(
        `/api/admin/budget/items/${item.id}/tasks`,
        { schedule_item_ids: selected },
        { auth: true }
      );
      onChange();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const totalMinutes = tasks
    .filter((t) => selected.includes(t.id))
    .reduce((sum, t) => sum + t.duration_minutes, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-ink-800">
          <h3 className="font-semibold text-ink-50">Lier des tâches — {item.name}</h3>
          <input
            autoFocus
            className="input mt-3"
            placeholder="Rechercher une tâche du planning..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="text-sm text-ink-500 text-center py-8">
              {tasks.length === 0
                ? "Aucun bloc dans le planning pour l'instant."
                : "Aucune tâche ne correspond à cette recherche."}
            </p>
          )}
          {filtered.map((t) => {
            const isSelected = selected.includes(t.id);
            return (
              <label
                key={t.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border mb-1 ${
                  isSelected
                    ? "bg-party-950/40 border-party-700/60"
                    : "border-transparent hover:bg-ink-800"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(t.id)}
                  className="accent-party-500 shrink-0"
                />
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full text-white shrink-0 ${TYPE_STYLE[t.type]}`}
                >
                  {TYPE_LABEL[t.type]}
                </span>
                <span className="flex-1 min-w-0 text-sm text-ink-100 truncate">{t.title}</span>
                <span className="text-xs text-ink-400 font-mono shrink-0">
                  {t.start_label ? `${t.start_label} · ` : ""}
                  {t.duration_minutes} min
                </span>
              </label>
            );
          })}
        </div>

        <div className="p-4 border-t border-ink-800 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-400">
            {selected.length > 0
              ? `${selected.length} tâche(s) — ${totalMinutes} min`
              : "Aucune tâche liée"}
          </span>
          <div className="flex gap-2 shrink-0">
            <button type="button" className="btn-secondary py-2 px-4 text-sm" onClick={onClose}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
              onClick={save}
              disabled={saving}
            >
              {saving ? "..." : "Valider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AllergyCompat({ item }) {
  if (!item.allergens) {
    return <span className="text-ink-600 text-xs">—</span>;
  }
  if (item.conflicts.length === 0) {
    return <span className="text-emerald-600 text-xs">Convient à tous</span>;
  }
  return (
    <div className="space-y-1">
      {item.conflicts.map((c) => (
        <div key={c.guest_id} className="text-amber-600 text-xs">
          {c.guest_name} ({c.matched_allergen})
        </div>
      ))}
    </div>
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
