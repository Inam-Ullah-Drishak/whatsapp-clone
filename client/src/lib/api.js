import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const TOKEN_KEY = "wa_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/** Turn a stored "/uploads/..." path into a full URL. */
export const mediaUrl = (p) => (p ? `${API_URL}${p}` : "");

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// Attach the token to every request rather than passing it at each call site
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or invalid token means the session is over. Clearing it here
// keeps every screen from having to handle 401 individually.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      // Avoid a redirect loop if we're already on the login screen
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

/** Pull a readable message out of an axios error. */
export const errorMessage = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong";

export default api;
