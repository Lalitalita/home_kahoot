import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function RequireAdmin({ children, section, ownerOnly }) {
  const { isAuthenticated, checking, hasPermission, isOwner } = useAuth();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        Vérification...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/connexion" replace />;
  }

  if ((section && !hasPermission(section)) || (ownerOnly && !isOwner)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="card max-w-sm space-y-2">
          <h1 className="text-lg font-semibold text-ink-50">Accès non autorisé</h1>
          <p className="text-sm text-ink-400">
            Ton compte n'a pas accès à cette section. Demande à l'admin principal de te
            l'autoriser si besoin.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
