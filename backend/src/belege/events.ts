// Bridge zum zentralen Event-Bus (Step 7).
// Behält die alten Listener-APIs für Step 5/6, leitet jedes Event aber zusätzlich
// in den typisierten Bus weiter, damit Aktivitäts-Wireup + SSE alles bekommen.

import type { BelegArt } from "../pdf/cache.js";
import { emit } from "../events/bus.js";

type BelegMutationListener = (art: BelegArt, id: string) => void;
type BelegSentListener = (art: BelegArt, id: string) => void;

const onMutationListeners: BelegMutationListener[] = [];
const onSentListeners: BelegSentListener[] = [];

export function onBelegMutated(l: BelegMutationListener): void {
  onMutationListeners.push(l);
}
export function emitBelegMutated(
  art: BelegArt,
  id: string,
  meta?: { statusVorher?: string | null; statusNachher?: string | null },
): void {
  for (const l of onMutationListeners) {
    try { l(art, id); } catch (e) { console.error("belegMutated listener", e); }
  }
  emit("beleg:mutated", {
    art, id,
    statusVorher: meta?.statusVorher ?? null,
    statusNachher: meta?.statusNachher ?? null,
  });
}

export function onBelegVersendet(l: BelegSentListener): void {
  onSentListeners.push(l);
}
export function emitBelegVersendet(art: BelegArt, id: string): void {
  for (const l of onSentListeners) {
    try { l(art, id); } catch (e) { console.error("belegVersendet listener", e); }
  }
}
