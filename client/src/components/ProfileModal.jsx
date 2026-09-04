import { useState, useRef } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

export default function ProfileModal({ onClose, firstTime = false }) {
  const { user, setUser, logout } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [about, setAbout] = useState(user?.about || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef(null);

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Content-Type is left unset on purpose — the browser adds the
      // multipart boundary, and overriding it breaks the upload.
      const { data } = await api.post("/uploads/avatar", form);
      setUser(data.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = ""; // allow re-picking the same file
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const { data } = await api.patch("/users/me", {
        name: name.trim(),
        about: about.trim(),
      });
      setUser(data.user);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
      // First-time setup can't be dismissed by clicking away
      onClick={firstTime ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-neutral-900">
              {firstTime ? "Set up your profile" : "Profile"}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {firstTime
                ? "Add a name so people know who they're talking to."
                : "This is how you appear to others."}
            </p>
          </div>
          {!firstTime && (
            <button
              onClick={onClose}
              className="text-2xl leading-none text-neutral-400 hover:text-neutral-700"
              aria-label="Close"
            >
              &times;
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Avatar src={mediaUrl(user?.avatar)} name={name || user?.phone} size="lg" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"
          >
            {uploading ? "Uploading..." : user?.avatar ? "Change photo" : "Add photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={pickAvatar}
            className="hidden"
          />
        </div>

        <form onSubmit={save} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Your name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              autoFocus
              placeholder="Enter your name"
              className="mt-1 w-full border-b-2 border-neutral-200 pb-2 outline-none focus:border-emerald-600"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">
              {50 - name.length}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
              About
            </label>
            <input
              value={about}
              onChange={(e) => setAbout(e.target.value.slice(0, 139))}
              className="mt-1 w-full border-b-2 border-neutral-200 pb-2 outline-none focus:border-emerald-600"
            />
          </div>

          <p className="text-sm text-neutral-500">
            Phone <span className="text-neutral-800">{user?.phone}</span>
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full rounded bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            {saving ? "Saving..." : firstTime ? "Continue" : "Save"}
          </button>

          {firstTime && (
            <button
              type="button"
              onClick={logout}
              className="w-full text-sm text-neutral-500 hover:text-neutral-800"
            >
              Use a different number
            </button>
          )}
        </form>
      </div>
    </div>
  );
}