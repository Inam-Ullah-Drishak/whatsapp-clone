import { useState } from "react";
import {
  WALLPAPERS,
  getWallpaper,
  setWallpaper,
  wallpaperColour,
} from "../lib/wallpaper.js";
import { useTheme } from "../context/ThemeContext.jsx";

export default function WallpaperPicker({ chatId }) {
  const { theme } = useTheme();
  const [current, setCurrent] = useState(() => getWallpaper(chatId));

  const pick = (id) => {
    setWallpaper(chatId, id);
    setCurrent(id);
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Wallpaper
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {WALLPAPERS.map((w) => (
          <button
            key={w.id}
            onClick={() => pick(w.id)}
            title={w.label}
            aria-label={w.label}
            style={{ background: wallpaperColour(w.id, theme) }}
            className={`h-8 w-8 rounded-full border transition ${
              current === w.id
                ? "border-emerald-500 ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-neutral-900"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          />
        ))}
      </div>

      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Only changes how this chat looks for you.
      </p>
    </div>
  );
}
