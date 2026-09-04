import { useState } from "react";
import api, { errorMessage } from "../lib/api.js";
import { useChats } from "../context/ChatContext.jsx";

export const DURATIONS = [
  { hours: 0, label: "Off" },
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
  { hours: 2160, label: "90 days" },
];

export const durationLabel = (hours) =>
  DURATIONS.find((d) => d.hours === hours)?.label || "Off";

export default function DisappearingSelect({ chat, disabled }) {
  const { setChats } = useChats();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const change = async (hours) => {
    setError("");
    setBusy(true);
    try {
      await api.patch(`/chats/${chat._id}/disappearing`, { hours });
      setChats((prev) =>
        prev.map((c) =>
          c._id === chat._id ? { ...c, disappearingAfter: hours } : c
        )
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Disappearing messages
      </p>

      <select
        value={chat.disappearingAfter || 0}
        onChange={(e) => change(Number(e.target.value))}
        disabled={disabled || busy}
        className="mt-1 w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm outline-none disabled:opacity-50"
      >
        {DURATIONS.map((d) => (
          <option key={d.hours} value={d.hours}>
            {d.label}
          </option>
        ))}
      </select>

      <p className="mt-1 text-xs text-neutral-500">
        {chat.disappearingAfter
          ? "New messages will be removed after this time. Existing ones are unaffected."
          : "Messages stay until someone deletes them."}
      </p>

      {disabled && (
        <p className="mt-1 text-xs text-neutral-400">Only group admins can change this.</p>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}