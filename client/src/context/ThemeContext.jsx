import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const KEY = "wa_theme";

/** Resolve "system" into an actual light/dark value. */
const systemTheme = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const ThemeProvider = ({ children }) => {
  // "light" | "dark" | "system"
  const [preference, setPreference] = useState(
    () => localStorage.getItem(KEY) || "system"
  );

  const resolved = preference === "system" ? systemTheme() : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    localStorage.setItem(KEY, preference);
  }, [preference, resolved]);

  // Follow the OS live while the preference is "system"
  useEffect(() => {
    if (preference !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      document.documentElement.classList.toggle("dark", mq.matches);

    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const toggle = () => setPreference(resolved === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ preference, setPreference, theme: resolved, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
