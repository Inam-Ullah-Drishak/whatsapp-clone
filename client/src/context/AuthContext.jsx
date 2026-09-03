import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { setToken, clearToken, getToken } from "../lib/api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Starts true so the app can show a splash instead of flashing the login
  // screen while we check an existing token.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const requestOtp = useCallback(async (phone) => {
    const { data } = await api.post("/auth/request-otp", { phone });
    return data;
  }, []);

  const verifyOtp = useCallback(async (phone, code) => {
    const { data } = await api.post("/auth/verify-otp", { phone, code });
    setToken(data.token);
    setUser(data.user);
    return data; // includes isNewUser
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = {
    user,
    setUser,
    loading,
    isAuthenticated: Boolean(user),
    requestOtp,
    verifyOtp,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
