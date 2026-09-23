import { useEffect, useState } from "react";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);

  function load() {
    api.get("/api/messages").then(setMessages).catch(() => {});
  }

  useEffect(load, []);

  async function remove(id) {
    if (!confirm("Supprimer ce message ?")) return;
    await api.delete(`/api/admin/messages/${id}`, { auth: true });
    load();
  }

  return (
    <AdminLayout title="Mur de messages">
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="card flex justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-stone-900">{m.author_name}</span>
                <span className="text-xs text-stone-400">
                  {new Date(m.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
              {m.content && <p className="text-stone-600 mt-1">{m.content}</p>}
              {m.photo_url && <img src={m.photo_url} alt="" className="mt-2 max-h-40 rounded-lg" />}
            </div>
            <button className="btn-danger h-fit shrink-0" onClick={() => remove(m.id)}>
              Supprimer
            </button>
          </div>
        ))}
        {messages.length === 0 && <p className="text-stone-400 text-center py-8">Aucun message.</p>}
      </div>
    </AdminLayout>
  );
}
