import { useEffect, useState } from "react";

import { api } from "../api.js";
import NavBar from "../components/NavBar.jsx";

export default function GuestList() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/guests")
      .then(setGuests)
      .catch(() => setError("Impossible de charger la liste des invités"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-ink-50">Qui sera là ?</h1>

        {loading && <p className="text-ink-500">Chargement...</p>}
        {error && <p className="text-rose-600">{error}</p>}
        {!loading && guests.length === 0 && (
          <p className="text-ink-500">La liste des invités n'a pas encore été publiée.</p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {guests.map((g) => (
            <div key={g.id} className="card flex gap-4 items-start">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-ink-800 shrink-0 flex items-center justify-center text-xl">
                {g.photo_url ? (
                  <img src={g.photo_url} alt={g.name} className="w-full h-full object-cover" />
                ) : (
                  "🙂"
                )}
              </div>
              <div>
                <h3 className="font-semibold text-ink-50">
                  {g.name}
                  {g.pseudo && <span className="text-party-600 font-normal"> ({g.pseudo})</span>}
                </h3>
                {g.description && <p className="text-sm text-ink-400 mt-1">{g.description}</p>}
                {g.bringing_item && (
                  <p className="text-sm text-party-700 mt-1">Amène : {g.bringing_item}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
