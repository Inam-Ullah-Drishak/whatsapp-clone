/**
 * Desktop notifications.
 *
 * Browsers only grant permission from a user gesture, so nothing here
 * asks on page load — the sidebar exposes a button that calls
 * requestNotificationPermission().
 */

export const notificationsSupported = () => "Notification" in window;

export const notificationPermission = () =>
  notificationsSupported() ? Notification.permission : "denied";

export const requestNotificationPermission = async () => {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
};

/**
 * Show a notification. `tag` replaces any earlier notification with the
 * same tag, so ten messages from one chat stack into one alert rather
 * than burying the desktop.
 */
export const showNotification = ({ title, body, tag, icon, onClick }) => {
  if (!notificationsSupported() || Notification.permission !== "granted") return;

  try {
    const n = new Notification(title, { body, tag, icon, renotify: false });
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
  } catch {
    // Some browsers throw if called outside a service worker context
  }
};

/** Show the unread total in the tab title. */
export const setTitleBadge = (count) => {
  const base = "WhatsApp Clone";
  document.title = count > 0 ? `(${count}) ${base}` : base;
};
