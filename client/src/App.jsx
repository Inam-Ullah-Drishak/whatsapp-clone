import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";

/** Full-screen splash while the stored token is being checked. */
const Splash = () => (
  <div className="flex h-screen items-center justify-center bg-neutral-50">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-600" />
  </div>
);

/** Blocks a route until the user is authenticated. */
const RequireAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Splash />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/** Keeps a signed-in user off the login screen. */
const RedirectIfAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Splash />;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuth>
            <Login />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}