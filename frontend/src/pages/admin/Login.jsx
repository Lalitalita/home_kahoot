import { useState } from "react";
import { Navigate } from "react-router-dom";

import { api } from "../../api.js";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AdminLogin() {
  const { isAuthenticated, setToken } = useAuth();
  const [step, setStep] = useState("credentials"); // credentials | setup2fa | verify2fa
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  async function handleCredentials(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post("/api/auth/login", { username, password });
      setChallengeToken(res.challenge_token);
      setStep(res.requires_2fa_setup ? "setup2fa" : "verify2fa");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post("/api/auth/verify-2fa", {
        challenge_token: challengeToken,
        code,
      });
      setToken(res.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmSetup(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post("/api/auth/setup-2fa/confirm", {
        challenge_token: challengeToken,
        code,
      });
      setToken(res.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-ink-50">Administration</h1>
        </div>

        {step === "credentials" && (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="label">Identifiant</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? "..." : "Continuer"}
            </button>
          </form>
        )}

        {step === "setup2fa" && (
          <form onSubmit={handleConfirmSetup} className="space-y-4">
            <p className="text-sm text-ink-400">
              Première connexion : scanne ce QR code avec Google Authenticator, Authy ou une app
              équivalente pour activer la double authentification.
            </p>
            <img
              src={`/api/auth/2fa-qr?token=${encodeURIComponent(challengeToken)}`}
              alt="QR code 2FA"
              className="mx-auto rounded-xl bg-white p-2 w-48 h-48"
            />
            <div>
              <label className="label">Code à 6 chiffres</label>
              <input
                className="input tracking-widest text-center text-lg"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                autoFocus
              />
            </div>
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? "..." : "Activer la 2FA et se connecter"}
            </button>
          </form>
        )}

        {step === "verify2fa" && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-ink-400">
              Entre le code généré par ton application d'authentification.
            </p>
            <input
              className="input tracking-widest text-center text-lg"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              autoFocus
            />
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? "..." : "Se connecter"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
