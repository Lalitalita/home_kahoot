import { useEffect, useState } from "react";

import { api } from "../api.js";
import Loading from "../components/Loading.jsx";
import NavBar from "../components/NavBar.jsx";

const GROUP_COLORS = [
  "border-party-600/50 bg-party-950/30",
  "border-magenta-600/50 bg-magenta-950/20",
  "border-amber-600/50 bg-amber-950/20",
  "border-sky-600/50 bg-sky-950/20",
  "border-emerald-600/50 bg-emerald-950/20",
];

function groupGuests(guests) {
  const groups = new Map();
  const solo = [];
  for (const g of guests) {
    const key = (g.social_group || "").trim();
    if (!key) {
      solo.push(g);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  return { groups, solo };
}

export default function Social() {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/guests")
      .then(setGuests)
      .catch(() => setError("Impossible de charger les invités"))
      .finally(() => setLoading(false));
  }, []);

  const { groups, solo } = groupGuests(guests);
  const groupNames = [...groups.keys()].sort();

  return (
    <div>
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-ink-50">Qui est qui</h1>
          <p className="text-ink-500 text-sm mt-1">
            Comment Lana connaît tout le monde — repère les groupes avant la soirée pour briser la
            glace plus vite.
          </p>
        </div>

        {loading && <Loading />}
        {error && <p className="text-rose-600">{error}</p>}
        {!loading && guests.length === 0 && (
          <p className="text-ink-500">La liste des invités n'a pas encore été publiée.</p>
        )}

        {groupNames.map((name, i) => (
          <section key={name}>
            <h2 className="text-sm font-semibold text-party-400 uppercase tracking-wide mb-2">
              {name}
            </h2>
            <div
              className={`grid sm:grid-cols-2 gap-3 rounded-2xl border p-3 ${
                GROUP_COLORS[i % GROUP_COLORS.length]
              }`}
            >
              {groups.get(name).map((g) => (
                <GuestCard key={g.id} guest={g} />
              ))}
            </div>
          </section>
        ))}

        {solo.length > 0 && (
          <section>
            {groupNames.length > 0 && (
              <h2 className="text-sm font-semibold text-ink-500 uppercase tracking-wide mb-2">
                Autres invités
              </h2>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {solo.map((g) => (
                <GuestCard key={g.id} guest={g} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function GuestCard({ guest }) {
  return (
    <div className="card flex gap-3 items-center py-3">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-ink-800 shrink-0 flex items-center justify-center text-lg">
        {guest.photo_url ? (
          <img src={guest.photo_url} alt={guest.name} className="w-full h-full object-cover" />
        ) : (
          "🙂"
        )}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-ink-50 truncate">
          {guest.name}
          {guest.pseudo && <span className="text-party-400 font-normal"> ({guest.pseudo})</span>}
        </h3>
        {guest.description && (
          <p className="text-sm text-ink-400 truncate">{guest.description}</p>
        )}
      </div>
    </div>
  );
}
