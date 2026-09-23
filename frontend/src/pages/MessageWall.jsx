import { useEffect, useState } from "react";

import { api } from "../api.js";
import NavBar from "../components/NavBar.jsx";

export default function MessageWall() {
  const [messages, setMessages] = useState([]);
  const [author, setAuthor] = useState(localStorage.getItem("guest_display_name") || "");
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  function load() {
    api
      .get("/api/messages")
      .then(setMessages)
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!author.trim() || (!content.trim() && !file)) {
      setError("Indique ton nom et un message ou une photo.");
      return;
    }
    setError(null);
    setSending(true);
    localStorage.setItem("guest_display_name", author);
    try {
      if (file) {
        const body = new FormData();
        body.append("author_name", author);
        body.append("file", file);
        if (content.trim()) body.append("content", content);
        const code = localStorage.getItem("guest_access_code");
        if (code) body.append("guest_access_code", code);
        await api.post("/api/messages/photo", body, { isForm: true });
      } else {
        const code = localStorage.getItem("guest_access_code");
        await api.post("/api/messages", {
          author_name: author,
          content,
          guest_access_code: code || null,
        });
      }
      setContent("");
      setFile(null);
      load();
    } catch {
      setError("Impossible d'envoyer, réessaie.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-ink-50">Mur de messages</h1>
        <p className="text-ink-400 text-sm">
          Un petit mot, une blague, une photo souvenir... tout est bienvenu !
        </p>

        <form onSubmit={handleSubmit} className="card space-y-3">
          <input
            className="input"
            placeholder="Ton nom"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Ton message..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm text-ink-400"
          />
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={sending} type="submit">
            {sending ? "Envoi..." : "Publier"}
          </button>
        </form>

        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="card">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-ink-50">{m.author_name}</span>
                <span className="text-xs text-ink-500">
                  {new Date(m.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
              {m.content && <p className="text-ink-200 mt-1 whitespace-pre-wrap">{m.content}</p>}
              {m.photo_url && (
                <img src={m.photo_url} alt="" className="mt-3 rounded-xl max-h-80 w-full object-cover" />
              )}
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-ink-500 text-center py-6">Aucun message pour l'instant.</p>
          )}
        </div>
      </div>
    </div>
  );
}
