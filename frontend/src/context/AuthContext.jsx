import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, getToken, setToken as persistToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());
  const [username, setUsername] = useState(null);
  const [checking, setChecking] = useState(true);

  const applyToken = useCallback((newToken) => {
    persistToken(newToken);
    setTokenState(newToken);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!token) {
        setChecking(false);
        return;
      }
      try {
        const me = await api.get("/api/auth/me", { auth: true });
        if (!cancelled) setUsername(me.username);
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
    setUsername(null);
  }, [applyToken]);

  return (
    <AuthContext.Provider
      value={{ token, username, isAuthenticated: !!token, checking, setToken: applyToken, logout }}
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
