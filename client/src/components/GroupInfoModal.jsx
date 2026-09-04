import { useState, useRef, useMemo } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import { useChats } from "../context/ChatContext.jsx";
import { otherParticipant } from "../lib/chatUtils.js";
import Avatar from "./Avatar.jsx";
import DisappearingSelect from "./DisappearingSelect.jsx";

export default function GroupInfoModal({ chat, onClose }) {
  const { chats, currentUserId, loadChats, setActiveChatId } = useChats();

  const [name, setName] = useState(chat.groupName || "");
  const [editingName, setEditingName] = useState(false);
  const [phone, setPhone] = useState("+92");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const memberIds = (chat.participants || []).map((p) => p._id);

  /** Direct-chat contacts who aren't already in this group. */
  const candidates = useMemo(() => {
    const seen = new Map();
    chats
      .filter((c) => !c.isGroup)
      .forEach((c) => {
        const other = otherParticipant(c, currentUserId);
        if (other && !memberIds.includes(other._id) && !seen.has(other._id)) {
          seen.set(other._id, other);
        }
      });
    return [...seen.values()];
  }, [chats, currentUserId, chat.participants]);

  const admins = (chat.groupAdmins || []).map((a) => (a._id ? a._id : a).toString());
  const iAmAdmin = admins.includes(currentUserId);
  const isAdmin = (id) => admins.includes(id);

  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      await loadChats();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Two steps: upload the file to get a path, then save that path on the
   * group. The media endpoint already accepts images, so no new backend
   * route is needed.
   */
  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/uploads/media", form);

      if (data.type !== "image") {
        setError("Group photo must be an image");
        return;
      }

      await api.patch(`/chats/${chat._id}/group`, { avatar: data.mediaUrl });
      await loadChats();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const rename = () =>
    run(async () => {
      await api.patch(`/chats/${chat._id}/group`, { name: name.trim() });
      setEditingName(false);
    });

  const addById = (userId) =>
    run(async () => {
      await api.post(`/chats/${chat._id}/participants`, { participants: [userId] });
      setShowAdd(false);
    });

  const addMember = (e) => {
    e.preventDefault();
    run(async () => {
      const { data } = await api.get("/users/search", { params: { phone } });
      await api.post(`/chats/${chat._id}/participants`, {
        participants: [data.user._id],
      });
      setPhone("+92");
      setShowAdd(false);
    });
  };

  const removeMember = (userId) =>
    run(() => api.delete(`/chats/${chat._id}/participants/${userId}`));

  const promote = (userId) =>
    run(() => api.post(`/chats/${chat._id}/admins/${userId}`));

  const removeGroup = async () => {
    if (
      !confirm(
        `Delete "${chat.groupName}" for everyone? All its messages will be permanently removed. This cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await api.delete(`/chats/${chat._id}/group`);
      setActiveChatId(null);
      await loadChats();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!confirm("Leave this group? You'll stop receiving its messages.")) return;
    setBusy(true);
    try {
      await api.delete(`/chats/${chat._id}/participants/${currentUserId}`);
      setActiveChatId(null);
      await loadChats();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-100 p-6 pb-4">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-medium text-neutral-900">Group info</h2>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-neutral-400 hover:text-neutral-700"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar src={mediaUrl(chat.groupAvatar)} name={chat.groupName} size="lg" />
              {iAmAdmin && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white opacity-0 transition hover:opacity-100 disabled:opacity-100"
                  title="Change group photo"
                >
                  {uploading ? "..." : "Change"}
                </button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={pickAvatar}
              className="hidden"
            />

            {editingName ? (
              <div className="flex w-full gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 100))}
                  autoFocus
                  className="flex-1 border-b-2 border-emerald-600 pb-1 text-center outline-none"
                />
                <button
                  onClick={rename}
                  disabled={busy || !name.trim()}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-medium text-neutral-900">{chat.groupName}</p>
                {iAmAdmin && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-sm text-emerald-700 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4">
            <DisappearingSelect chat={chat} disabled={!iAmAdmin} />
          </div>

          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {chat.participants?.length || 0} members
          </p>

          <div className="mt-2 space-y-1">
            {chat.participants?.map((p) => {
              const isMe = p._id === currentUserId;
              return (
                <div
                  key={p._id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-50"
                >
                  <Avatar
                    src={mediaUrl(p.avatar)}
                    name={p.name || p.phone}
                    size="sm"
                    online={p.isOnline}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-800">
                      {isMe ? "You" : p.name || p.phone}
                    </p>
                    <p className="truncate text-xs text-neutral-500">{p.phone}</p>
                  </div>

                  {isAdmin(p._id) && (
                    <span className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Admin
                    </span>
                  )}

                  {iAmAdmin && !isMe && (
                    <div className="flex shrink-0 gap-1">
                      {!isAdmin(p._id) && (
                        <button
                          onClick={() => promote(p._id)}
                          disabled={busy}
                          className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40"
                          title="Make admin"
                        >
                          Promote
                        </button>
                      )}
                      <button
                        onClick={() => removeMember(p._id)}
                        disabled={busy}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {iAmAdmin &&
            (showAdd ? (
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Add from your contacts
                </p>

                {candidates.length === 0 && (
                  <p className="mt-2 text-sm text-neutral-400">
                    Everyone you chat with is already in this group.
                  </p>
                )}

                <div className="mt-2 space-y-1">
                  {candidates.map((person) => (
                    <button
                      key={person._id}
                      onClick={() => addById(person._id)}
                      disabled={busy}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-neutral-50 disabled:opacity-40"
                    >
                      <Avatar
                        src={mediaUrl(person.avatar)}
                        name={person.name || person.phone}
                        size="sm"
                        online={person.isOnline}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-800">
                          {person.name || person.phone}
                        </p>
                        <p className="truncate text-xs text-neutral-500">{person.phone}</p>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-emerald-700">Add</span>
                    </button>
                  ))}
                </div>

                <form onSubmit={addMember} className="mt-3 flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Or add by phone number"
                    className="flex-1 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm outline-none placeholder:text-neutral-400"
                  />
                  <button
                    type="submit"
                    disabled={busy || phone.trim().length < 8}
                    className="rounded-lg bg-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-300 disabled:opacity-40"
                  >
                    Add
                  </button>
                </form>

                <button
                  onClick={() => setShowAdd(false)}
                  className="mt-2 text-sm text-neutral-500 hover:text-neutral-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-4 text-sm font-medium text-emerald-700 hover:underline"
              >
                + Add member
              </button>
            ))}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="space-y-2 border-t border-neutral-100 p-6 pt-4">
          <button
            onClick={leave}
            disabled={busy}
            className="w-full rounded border border-neutral-300 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            Leave group
          </button>

          {iAmAdmin && (
            <button
              onClick={removeGroup}
              disabled={busy}
              className="w-full rounded bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              Delete group for everyone
            </button>
          )}
        </div>
      </div>
    </div>
  );
}