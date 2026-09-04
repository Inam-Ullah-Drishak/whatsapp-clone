import dns from "dns/promises";
import net from "net";

const TIMEOUT_MS = 4000;
const MAX_BYTES = 512 * 1024; // only need the <head>

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** First http(s) link in a message, or null. */
export const firstUrl = (text = "") => {
  const match = text.match(URL_RE);
  if (!match) return null;

  // Trim punctuation people type after a link
  return match[0].replace(/[.,);:!?]+$/, "");
};

/**
 * Reject addresses that point back into our own network.
 *
 * Without this, a message containing http://169.254.169.254/ or
 * http://localhost:27017 would make the server fetch its own cloud
 * metadata or database — the classic SSRF hole in link previews.
 */
const isPrivateAddress = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === "::1" || s === "::") return true;
    if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
    if (s.startsWith("fe80")) return true; // link local
    // IPv4-mapped, e.g. ::ffff:127.0.0.1
    const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true; // unknown format, refuse
};

const safeUrl = async (raw) => {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  // Resolve first, then check. A hostname can point anywhere.
  let addresses;
  try {
    addresses = await dns.lookup(url.hostname, { all: true });
  } catch {
    return null;
  }

  if (addresses.length === 0) return null;
  if (addresses.some((a) => isPrivateAddress(a.address))) return null;

  return url;
};

const decode = (s = "") =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const metaTag = (html, prop) => {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decode(m[1]);
  }
  return "";
};

/**
 * Fetch Open Graph tags for a URL. Returns null rather than throwing —
 * a preview is a nice-to-have and must never fail a message send.
 */
export const fetchLinkPreview = async (raw) => {
  const url = await safeUrl(raw);
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some sites serve OG tags only to crawlers
        "User-Agent": "Mozilla/5.0 (compatible; WhatsAppCloneBot/1.0)",
        Accept: "text/html",
      },
    });

    if (!res.ok) return null;

    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) return null;

    // Read only the first chunk: everything we need is in <head>
    const reader = res.body?.getReader();
    if (!reader) return null;

    let html = "";
    let received = 0;
    const decoder = new TextDecoder();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      received += value.length;
      html += decoder.decode(value, { stream: true });

      if (received >= MAX_BYTES || html.includes("</head>")) {
        await reader.cancel();
        break;
      }
    }

    const title =
      metaTag(html, "og:title") ||
      decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "");

    if (!title) return null;

    return {
      url: url.href,
      title: title.slice(0, 200),
      description: (metaTag(html, "og:description") || metaTag(html, "description")).slice(0, 300),
      image: metaTag(html, "og:image").slice(0, 500),
      siteName: (metaTag(html, "og:site_name") || url.hostname).slice(0, 100),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
