import { useState, useMemo } from "react";
import api, { errorMessage, mediaUrl } from "../lib/api.js";
import { useChats } from "../context/ChatContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { otherParticipant } from "../lib/chatUtils.js";
import Avatar from "./Avatar.jsx";

export default function NewGroupModal({ onClose }) {
  const { chats, setChats, selectChat, currentUserId } = useChats();
  const { emit } = useSocket();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+92");
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /** Everyone you already have a direct chat with. */
  const contacts = useMemo(() => {
    const seen = new Map();
    chats
      .filter((c) => !c.isGroup)
      .forEach((c) => {
        const other = otherParticipant(c, currentUserId);
        if (other && !seen.has(other._id)) seen.set(other._id, other);
      });
    return [...seen.values()];
  }, [chats, currentUserId]);

  const isSelected = (id) => members.some((m) => m._id === id);

  const toggle = (person) => {
    setError("");
    setMembers((prev) =>
      prev.some((m) => m._id === person._id)
        ? prev.filter((m) => m._id !== person._id)
        : [...prev, person]
    );
  };

  const addByPhone = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.get("/users/search", { params: { phone } });
      if (isSelected(data.user._id)) {
        setError("That person is already selected");
      } else {
        setMembers((prev) => [...prev, data.user]);
        setPhone("+92");
        setShowPhoneInput(false);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/chats/group", {
        name: name.trim(),
        participants: members.map((m) => m._id),
      });

      // Created after the socket connected, so join its room explicitly
      emit("chat:join", data.chat._id);

      setChats((prev) => [data.chat, ...prev]);
      selectChat(data.chat._id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  // People added by phone who aren't in the contacts list
  const extraMembers = members.filter(
    (m) => !contacts.some((c) => c._id === m._id)
  );

  const canCreate = name.trim().length > 0 && members.length > 0 && !busy;

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
            <div>
              <h2 className="text-lg font-medium text-neutral-900">New group</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Name it, then choose who to add.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-neutral-400 hover:text-neutral-700"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 100))}
            placeholder="Group name"
            autoFocus
            className="mt-4 w-full border-b-2 border-neutral-200 pb-2 outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Your contacts
            </p>
            <span className="text-xs text-neutral-400">
              {members.length} selected
            </span>
          </div>

          {contacts.length === 0 && (
            <p className="mt-3 text-sm text-neutral-400">
              No contacts yet. Add someone by phone number below.
            </p>
          )}

          <div className="mt-2 space-y-1">
            {contacts.map((person) => (
              <button
                key={person._id}
                onClick={() => toggle(person)}
                className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                  isSelected(person._id) ? "bg-emerald-50" : "hover:bg-neutral-50"
                }`}
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

                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected(person._id)
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-neutral-300"
                  }`}
                >
                  {isSelected(person._id) && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
              </button>
            ))}

            {extraMembers.map((person) => (
              <button
                key={person._id}
                onClick={() => toggle(person)}
                className="flex w-full items-center gap-3 rounded-lg bg-emerald-50 p-2 text-left"
              >
                <Avatar
                  src={mediaUrl(person.avatar)}
                  name={person.name || person.phone}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-800">
                    {person.name || person.phone}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{person.phone}</p>
                </div>
                <span className="shrink-0 px-1 text-xl leading-none text-neutral-400 hover:text-red-600">
                  &times;
                </span>
              </button>
            ))}
          </div>

          {showPhoneInput ? (
            <form onSubmit={addByPhone} className="mt-4 flex gap-2">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+923001234567"
                autoFocus
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
          ) : (
            <button
              type="button"
              onClick={() => setShowPhoneInput(true)}
              className="mt-4 text-sm font-medium text-emerald-700 hover:underline"
            >
              + Add by phone number
            </button>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-neutral-100 p-6 pt-4">
          <button
            onClick={create}
            disabled={!canCreate}
            className="w-full rounded bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            {busy ? "Creating..." : "Create group"}
          </button>
          <p className="mt-3 text-center text-xs text-neutral-400">
            You'll be added automatically as the group admin.
          </p>
        </div>
      </div>
    </div>
  );
}