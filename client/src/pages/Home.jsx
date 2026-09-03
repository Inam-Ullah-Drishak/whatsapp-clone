import { useAuth } from "../context/AuthContext.jsx";

/**
 * Placeholder. Replaced by the real chat layout in the next step —
 * for now it just proves the token survives a refresh.
 */
export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50">
      <div className="rounded-lg bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">Signed in as</p>
        <p className="mt-1 text-lg font-medium text-teal-800">
          {user?.name || user?.phone}
        </p>
        <p className="mt-1 text-sm text-neutral-500">{user?.about}</p>

        <button
          onClick={logout}
          className="mt-6 rounded bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-300"
        >
          Log out
        </button>
      </div>
    </div>
  );
}