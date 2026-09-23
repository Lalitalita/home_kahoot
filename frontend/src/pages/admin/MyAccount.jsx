import { useState } from "react";

import { api } from "../../api.js";
import AdminLayout from "../../components/AdminLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function MyAccount() {
  const { me, refreshMe } = useAuth();

  return (
    <AdminLayout title="Mon compte">
      <div className="space-y-6 max-w-xl">
        <PhotoCard me={me} onUpdated={refreshMe} />
        <PasswordCard />
        <TwoFactorCard me={me} onUpdated={refreshMe} />
      </div>
    </AdminLayout>
  );
}

function PhotoCard({ me, onUpdated }) {
  const [error, setError] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      await api.post("/api/auth/me/photo", body, { isForm: true, auth: true });
      await onUpdated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card flex items-center gap-4">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-ink-800 shrink-0 flex items-center justify-center text-2xl">
        {me?.photo_url ? (
          <img src={me.photo_url} className="w-full h-full object-cover" alt="" />
        ) : (
          "🙂"
        )}
      </div>
      <div>
        <h2 className="font-semibold text-ink-50">{me?.username}</h2>
        <label className="text-xs text-party-400 cursor-pointer mt-1 inline-block">
          Changer la photo
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
        {error && <p className="text-rose-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (next !== confirm) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      await api.patch(
        "/api/auth/me/password",
        { current_password: current, new_password: next },
        { auth: true }
      );
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold text-ink-50">Changer mon mot de passe</h2>
      <div>
        <label className="label">Mot de passe actuel</label>
        <input
          type="password"
          className="input"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Nouveau mot de passe</label>
        <input
          type="password"
          className="input"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Confirmer le nouveau mot de passe</label>
        <input
          type="password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <p className="text-rose-500 text-sm">{error}</p>}
      {saved && <p className="text-emerald-500 text-sm">Mot de passe mis à jour.</p>}
      <button className="btn-primary" disabled={busy} type="submit">
        {busy ? "..." : "Enregistrer"}
      </button>
    </form>
  );
}

function TwoFactorCard({ me, onUpdated }) {
  const [step, setStep] = useState("idle"); // idle | password | confirm
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrKey, setQrKey] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function startReset(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/me/2fa/start", { current_password: password }, { auth: true });
      setQrKey((k) => k + 1);
      setStep("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/me/2fa/confirm", { code }, { auth: true });
      await onUpdated();
      setStep("idle");
      setPassword("");
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-ink-50">Double authentification (2FA)</h2>
      <p className="text-sm text-ink-400">
        Statut : {me?.totp_enabled ? "activée" : "désactivée"}
      </p>

      {step === "idle" && (
        <button className="btn-secondary" onClick={() => setStep("password")}>
          Réinitialiser ma 2FA
        </button>
      )}

      {step === "password" && (
        <form onSubmit={startReset} className="space-y-3">
          <div>
            <label className="label">Confirme ton mot de passe actuel</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-rose-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? "..." : "Continuer"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep("idle")}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {step === "confirm" && (
        <form onSubmit={confirmReset} className="space-y-3">
          <p className="text-sm text-ink-400">
            Scanne ce nouveau QR code avec ton application d'authentification, puis entre le
            code généré.
          </p>
          <img
            key={qrKey}
            src={`/api/auth/me/2fa-qr?t=${qrKey}`}
            alt="QR code 2FA"
            className="mx-auto rounded-xl bg-white p-2 w-40 h-40"
          />
          <input
            className="input text-center tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            autoFocus
          />
          {error && <p className="text-rose-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} type="submit">
              {busy ? "..." : "Activer"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep("idle")}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
