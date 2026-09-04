import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const StatusContext = createContext(null);

export const StatusProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [mine, setMine] = useState(null);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/status");
      setMine(data.mine);
      setOthers(data.others);
    } catch {
      setMine(null);
      setOthers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadFeed();
    else {
      setMine(null);
      setOthers([]);
    }
  }, [isAuthenticated, loadFeed]);

  // Statuses expire after 24h, so refresh periodically to drop stale rings
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(loadFeed, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isAuthenticated, loadFeed]);

  const createStatus = useCallback(
    async (payload) => {
      await api.post("/status", payload);
      await loadFeed();
    },
    [loadFeed]
  );

  const markViewed = useCallback(async (statusId) => {
    try {
      await api.post(`/status/${statusId}/view`);
    } catch {
      // A failed view receipt isn't worth interrupting playback for
    }
  }, []);

  const deleteStatus = useCallback(
    async (statusId) => {
      await api.delete(`/status/${statusId}`);
      await loadFeed();
    },
    [loadFeed]
  );

  const value = {
    mine,
    others,
    loading,
    loadFeed,
    createStatus,
    markViewed,
    deleteStatus,
  };

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
};

export const useStatus = () => {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error("useStatus must be used inside StatusProvider");
  return ctx;
};
