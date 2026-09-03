import { initial } from "../lib/chatUtils.js";

const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
};

export default function Avatar({ src, name, size = "md", online = false }) {
  return (
    <div className="relative shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${SIZES[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${SIZES[size]} flex items-center justify-center rounded-full bg-teal-700 font-medium text-white`}
        >
          {initial(name)}
        </div>
      )}

      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
      )}
    </div>
  );
}
