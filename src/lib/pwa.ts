const BLOCKED_HOST_PREFIXES = ["id-preview--", "preview--"];
const BLOCKED_HOST_SUFFIXES = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "beta.lovable.dev",
];

/** True when the current context is a Lovable preview / dev / iframe context. */
export function isPreviewContext() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  if (window.self !== window.top) return true;
  if (BLOCKED_HOST_PREFIXES.some((p) => host.startsWith(p))) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return true;
  return false;
}

function isRefused() {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  return isPreviewContext();
}

/** Registers the offline service worker, but never in dev or Lovable preview contexts. */
export function setupServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (isRefused()) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) {
          if (reg.active?.scriptURL.endsWith("/sw.js")) void reg.unregister();
        }
      })
      .catch(() => {});
    return;
  }

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
