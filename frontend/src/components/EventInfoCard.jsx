import { useEffect, useState } from "react";

import { api } from "../api.js";

function formatDate(isoDate) {
  try {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function formatTime(hhmm) {
  return hhmm ? hhmm.replace(":", "h") : null;
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function wazeUrl(address) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

// Shown on the home page and each guest's RSVP page: date, time, place, and
// one-tap links into Maps/Waze. Renders nothing until the admin has filled
// in at least one of these in Admin → Planning, so it never looks broken.
export default function EventInfoCard() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api.get("/api/settings").then(setInfo).catch(() => {});
  }, []);

  if (!info) return null;
  const { party_location_name, party_address, party_date, party_time } = info;
  if (!party_location_name && !party_address && !party_date && !party_time) return null;

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold text-ink-50">📍 Infos pratiques</h2>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        {party_date && (
          <div>
            <div className="text-ink-500">Date</div>
            <div className="text-ink-100 font-medium capitalize">{formatDate(party_date)}</div>
          </div>
        )}
        {party_time && (
          <div>
            <div className="text-ink-500">Heure</div>
            <div className="text-ink-100 font-medium">{formatTime(party_time)}</div>
          </div>
        )}
        {(party_location_name || party_address) && (
          <div>
            <div className="text-ink-500">Lieu</div>
            <div className="text-ink-100 font-medium">
              {party_location_name}
              {party_location_name && party_address && <br />}
              {party_address}
            </div>
          </div>
        )}
      </div>
      {party_address && (
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            className="btn-secondary py-1.5 px-3 text-sm"
            href={mapsUrl(party_address)}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir dans Google Maps
          </a>
          <a
            className="btn-secondary py-1.5 px-3 text-sm"
            href={wazeUrl(party_address)}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir dans Waze
          </a>
        </div>
      )}
    </div>
  );
}
