import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function RequireAdmin({ children }) {
  const { isAuthenticated, checking } = useAuth();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Vérification...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/connexion" replace />;
  }

  return children;
}
