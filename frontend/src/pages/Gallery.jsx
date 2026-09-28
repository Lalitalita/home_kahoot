import { useEffect, useState } from "react";

import { api } from "../api.js";
import { CameraIcon, LockIcon } from "../components/icons.jsx";
import Loading from "../components/Loading.jsx";
import NavBar from "../components/NavBar.jsx";

export default function Gallery() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get("/api/settings")
      .then(setSettings)
      .catch(() => setSettings({}))
      .finally(() => setLoading(false));
  }, []);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(settings.gallery_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the password is still shown on screen.
    }
  }

  const url = settings?.gallery_url;

  return (
    <div>
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 sm:pb-8 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-ink-50">Galerie photo</h1>
          <p className="text-ink-500 text-sm mt-1">
            Toutes les photos de la soirée, partagées en direct. Ajoute les tiennes, elles
            apparaîtront pour tout le monde !
          </p>
        </div>

        {loading && <Loading />}

        {!loading && !url && (
          <p className="text-ink-500">
            L'album photo n'a pas encore été configuré — reviens un peu plus tard.
          </p>
        )}

        {!loading && url && (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 w-full sm:w-auto justify-center py-3.5 text-base"
            >
              <CameraIcon size={20} /> Ouvrir l'album partagé
            </a>

            {settings.gallery_password && (
              <div className="card space-y-2">
                <p className="text-sm text-ink-400 flex items-center gap-1.5">
                  <LockIcon size={16} className="text-party-400" /> L'album est protégé par un mot de passe :
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-ink-950/60 border border-ink-700 rounded-lg px-3 py-2.5 text-lg font-mono text-party-300 tracking-wide">
                    {settings.gallery_password}
                  </code>
                  <button
                    className="btn-secondary py-2.5 px-4 shrink-0"
                    onClick={copyPassword}
                    type="button"
                  >
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
