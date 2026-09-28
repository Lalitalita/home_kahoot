import { useEffect, useState } from "react";

import { api } from "../api.js";
import Loading from "../components/Loading.jsx";
import NavBar from "../components/NavBar.jsx";

export default function Gallery() {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [iframeFailed, setIframeFailed] = useState(false);

  useEffect(() => {
    api
      .get("/api/settings")
      .then((s) => setUrl(s.gallery_url || ""))
      .catch(() => setUrl(""))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
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
              📸 Ouvrir l'album partagé
            </a>

            {!iframeFailed && (
              <div className="card p-0 overflow-hidden">
                <iframe
                  src={url}
                  title="Album photo"
                  className="w-full aspect-[4/3] sm:aspect-video border-0"
                  loading="lazy"
                  onError={() => setIframeFailed(true)}
                />
              </div>
            )}
            <p className="text-xs text-ink-600">
              Si l'aperçu ne s'affiche pas ci-dessus, utilise le bouton pour ouvrir l'album dans un
              nouvel onglet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
