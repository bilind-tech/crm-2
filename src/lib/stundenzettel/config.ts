// Konfiguration für die externe Stundenzettel-App.
// Läuft später als eigener Dienst auf dem Pi (z. B. http://mycleancenter.local:4001)
// und wird hier nur per iframe eingebettet. URL ist im Mock in localStorage,
// auf dem Pi später eine Einstellung im Backend.

const STORAGE_KEY = "mcc.stundenzettel.url";

export function getStundenzettelUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setStundenzettelUrl(url: string) {
  if (typeof window === "undefined") return;
  const trimmed = url.trim();
  if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("stundenzettel-url-changed"));
}
