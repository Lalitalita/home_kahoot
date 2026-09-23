import { useEffect, useState } from "react";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

const emptyForm = { name: "", price: "", prep_time_minutes: "", allergens: "", notes: "" };

function formatEuro(value) {
  return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;
}

export default function AdminBudget() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [targetInput, setTargetInput] = useState("");
  const [error, setError] = useState(null);

  function load() {
    Promise.all([
      api.get("/api/admin/budget/items", { auth: true }),
      api.get("/api/admin/budget/summary", { auth: true }),
    ])
      .then(([itemsRes, summaryRes]) => {
        setItems(itemsRes);
        setSummary(summaryRes);
        setTargetInput(summaryRes.budget_target ?? "");
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
        showAllergens={false}
        onChange={load}
      />

      <BudgetSection
        title="Nourriture"
        category="food"
        items={food}
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
          danger ? "text-rose-600" : highlight ? "text-party-600" : "text-ink-50"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  );
}

function BudgetSection({ title, category, items, showAllergens, onChange }) {
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
              <th className="p-3">Préparation</th>
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
                <td className="p-3 w-28">
                  <EditableCell
                    value={item.prep_time_minutes != null ? String(item.prep_time_minutes) : ""}
                    onSave={(v) => updateField(item, "prep_time_minutes", v === "" ? null : Number(v))}
                  />
                  <span className="text-xs text-ink-500"> min</span>
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
      <span className="cursor-pointer hover:text-party-600" onClick={() => setEditing(true)}>
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
