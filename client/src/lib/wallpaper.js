/**
 * Per-chat wallpaper.
 *
 * Stored client-side: a wallpaper is a personal preference about how a
 * conversation looks, not shared state, so it needs no server round trip.
 */

const KEY = (chatId) => `wa_wallpaper:${chatId}`;
const EVENT = "wa-wallpaper-change";

export const WALLPAPERS = [
  { id: "default", label: "Default", light: "#efeae2", dark: "#0b141a" },
  { id: "slate", label: "Slate", light: "#e6e8ea", dark: "#131c21" },
  { id: "sand", label: "Sand", light: "#f2e9dd", dark: "#1c1710" },
  { id: "sage", label: "Sage", light: "#e4ece4", dark: "#0f1a14" },
  { id: "rose", label: "Rose", light: "#f4e6e8", dark: "#1d1114" },
  { id: "sky", label: "Sky", light: "#e3edf5", dark: "#0d1620" },
  { id: "violet", label: "Violet", light: "#ebe6f5", dark: "#161022" },
  { id: "ink", label: "Ink", light: "#e2e2e2", dark: "#000000" },
];

export const getWallpaper = (chatId) =>
  (chatId && localStorage.getItem(KEY(chatId))) || "default";

export const setWallpaper = (chatId, id) => {
  if (!chatId) return;

  if (id === "default") localStorage.removeItem(KEY(chatId));
  else localStorage.setItem(KEY(chatId), id);

  // Tell any open chat window to repaint; storage events only fire in
  // other tabs, so we dispatch our own.
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { chatId, id } }));
};

export const wallpaperColour = (id, theme) => {
  const w = WALLPAPERS.find((x) => x.id === id) || WALLPAPERS[0];
  return theme === "dark" ? w.dark : w.light;
};

export const onWallpaperChange = (handler) => {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
