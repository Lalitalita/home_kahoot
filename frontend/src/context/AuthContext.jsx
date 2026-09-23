import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, getToken, setToken as persistToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);

  const applyToken = useCallback((newToken) => {
    persistToken(newToken);
    setTokenState(newToken);
  }, []);

  const refreshMe = useCallback(async () => {
    const fresh = await api.get("/api/auth/me", { auth: true });
    setMe(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!token) {
        setChecking(false);
        return;
      }
      try {
        const fresh = await api.get("/api/auth/me", { auth: true });
        if (!cancelled) setMe(fresh);
      } catch {
        if (!cancelled) applyToken(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [token, applyToken]);

  const logout = useCallback(() => {
    applyToken(null);
    setMe(null);
  }, [applyToken]);

  const isOwner = me?.role === "owner";
  const permissions = me?.permissions || [];

  function hasPermission(section) {
    return isOwner || permissions.includes(section);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        me,
        username: me?.username || null,
        isOwner,
        permissions,
        hasPermission,
        isAuthenticated: !!token,
        checking,
        setToken: applyToken,
        refreshMe,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
