import { useEffect, useState } from "react";

import { api } from "../api.js";
import { BalloonIcon, MapPinIcon, SparkleIcon } from "./icons.jsx";

function useCountdown(partyDate, partyTime) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!partyDate) return;
    const id = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(id);
  }, [partyDate]);

  if (!partyDate) return null;
  const target = new Date(`${partyDate}T${partyTime || "00:00"}:00`).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return { days: 0, hours: 0, past: true };
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  return { days, hours, past: false };
}

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

  const countdown = useCountdown(info?.party_date, info?.party_time);

  if (!info) return null;
  const { party_location_name, party_address, party_date, party_time } = info;
  if (!party_location_name && !party_address && !party_date && !party_time) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-ink-50 flex items-center gap-1.5">
          <MapPinIcon size={18} className="text-party-400" /> Infos pratiques
        </h2>
        {countdown && !countdown.past && (
          <span className="text-xs font-mono bg-party-950/50 border border-party-800/60 text-party-300 rounded-full px-3 py-1 flex items-center gap-1.5">
            <BalloonIcon size={14} /> J-{countdown.days}
            {countdown.days === 0 ? `, ${countdown.hours}h` : ""}
          </span>
        )}
        {countdown?.past && (
          <span className="text-xs font-mono bg-magenta-950/50 border border-magenta-800/60 text-magenta-300 rounded-full px-3 py-1 flex items-center gap-1.5">
            <SparkleIcon size={14} /> C'est le jour J !
          </span>
        )}
      </div>
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
