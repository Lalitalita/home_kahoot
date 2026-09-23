import { useEffect, useState } from "react";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

const SECTION_LABEL = {
  guests: "Invités",
  budget: "Budget & listes",
  planning: "Planning",
  questions: "Questions du quiz",
  messages: "Mur de messages",
  party: "Mode soirée",
  results: "Résultats",
};

const emptyForm = { username: "", password: "", guest_name: "", permissions: [] };

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  function load() {
    Promise.all([
      api.get("/api/admin/accounts", { auth: true }),
      api.get("/api/admin/accounts/sections", { auth: true }),
    ])
      .then(([accountsRes, sectionsRes]) => {
        setAccounts(accountsRes);
        setSections(sectionsRes);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function togglePermission(perm) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    if (!form.username.trim() || !form.password || !form.guest_name.trim()) {
      setError("Identifiant, mot de passe et nom sont requis.");
      return;
    }
    try {
      await api.post("/api/admin/accounts", form, { auth: true });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updatePermissions(account, permissions) {
    await api.patch(`/api/admin/accounts/${account.id}`, { permissions }, { auth: true });
    load();
  }

  async function resetPassword(account) {
    const newPassword = window.prompt(`Nouveau mot de passe pour ${account.username} :`);
    if (!newPassword) return;
    try {
      await api.post(
        `/api/admin/accounts/${account.id}/reset-password`,
        { new_password: newPassword },
        { auth: true }
      );
      alert("Mot de passe réinitialisé. La 2FA de ce compte a été désactivée.");
    } catch (err) {
      alert(err.message);
    }
  }

  async function uploadPhoto(account, file) {
    const body = new FormData();
    body.append("file", file);
    await api.post(`/api/admin/accounts/${account.id}/photo`, body, { isForm: true, auth: true });
    load();
  }

  async function remove(account) {
    if (!confirm(`Supprimer le compte de ${account.username} ?`)) return;
    await api.delete(`/api/admin/accounts/${account.id}`, { auth: true });
    load();
  }

  return (
    <AdminLayout title="Comptes admin">
      <p className="text-sm text-ink-400 mb-6">
        Crée des comptes pour d'autres personnes (elles seront aussi ajoutées comme invités) et
        choisis à quelles parties de l'administration elles ont accès.
      </p>

      <form onSubmit={handleCreate} className="card mb-6 space-y-3">
        <h2 className="font-semibold text-ink-50">Nouveau compte</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Identifiant"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            className="input"
            placeholder="Nom (fiche invité créée automatiquement)"
            value={form.guest_name}
            onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
          />
        </div>
        <div>
          <p className="label mb-2">Accès autorisés</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <label
                key={s}
                className={`text-sm rounded-full px-3 py-1.5 cursor-pointer transition ${
                  form.permissions.includes(s)
                    ? "bg-party-500 text-ink-900 font-medium"
                    : "bg-ink-800 text-ink-400 border border-ink-600"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={form.permissions.includes(s)}
                  onChange={() => togglePermission(s)}
                />
                {SECTION_LABEL[s] || s}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-rose-500 text-sm">{error}</p>}
        <button className="btn-primary" type="submit">
          Créer le compte
        </button>
      </form>

      <div className="space-y-3">
        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            sections={sections}
            onUpdatePermissions={(perms) => updatePermissions(a, perms)}
            onResetPassword={() => resetPassword(a)}
            onUploadPhoto={(file) => uploadPhoto(a, file)}
            onDelete={() => remove(a)}
          />
        ))}
      </div>
    </AdminLayout>
  );
}

function AccountRow({ account, sections, onUpdatePermissions, onResetPassword, onUploadPhoto, onDelete }) {
  const isOwner = account.role === "owner";

  function toggle(section) {
    const next = account.permissions.includes(section)
      ? account.permissions.filter((p) => p !== section)
      : [...account.permissions, section];
    onUpdatePermissions(next);
  }

  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-ink-800 shrink-0 flex items-center justify-center text-xl">
          {account.photo_url ? (
            <img src={account.photo_url} className="w-full h-full object-cover" alt="" />
          ) : (
            "🙂"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink-50">{account.username}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isOwner ? "bg-magenta-600 text-white" : "bg-ink-700 text-ink-300"
              }`}
            >
              {isOwner ? "Compte principal" : "Staff"}
            </span>
            {account.guest_name && (
              <span className="text-xs text-ink-500">invité : {account.guest_name}</span>
            )}
            <span className="text-xs text-ink-500">
              2FA {account.totp_enabled ? "activée" : "désactivée"}
            </span>
          </div>
          {!isOwner && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sections.map((s) => (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  className={`text-xs rounded-full px-2.5 py-1 transition ${
                    account.permissions.includes(s)
                      ? "bg-party-500 text-ink-900 font-medium"
                      : "bg-ink-800 text-ink-500 border border-ink-600"
                  }`}
                >
                  {SECTION_LABEL[s] || s}
                </button>
              ))}
            </div>
          )}
        </div>
        {!isOwner && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <label className="text-xs text-party-400 cursor-pointer">
              Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUploadPhoto(e.target.files[0])}
              />
            </label>
            <button className="text-xs text-ink-400 hover:text-ink-100" onClick={onResetPassword}>
              Reset mdp
            </button>
            <button className="text-xs text-rose-500 hover:text-rose-400" onClick={onDelete}>
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
