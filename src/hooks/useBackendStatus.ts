import { useSyncExternalStore } from "react";
import {
  fetchHealth,
  getBackendUrl,
  subscribeBackendUrl,
  type HealthInfo,
} from "@/lib/api/backendUrl";

export type BackendStatus = "connected" | "disconnected" | "checking" | "maintenance";

export interface BackendStatusResult {
  status: BackendStatus;
  url: string;
  health: HealthInfo | null;
  lastError: string | null;
  lastCheck: Date | null;
  refresh: () => void;
}

const POLL_MS = 30_000;

export function useBackendUrl(): string {
  return useSyncExternalStore(subscribeBackendUrl, getBackendUrl, getBackendUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// Geteilter Singleton-Poller
//
// Vorher wurde useBackendStatus pro Mount (auth.tsx, LockScreen,
// BackendVerbindungTab …) jeweils ein eigener setInterval-Loop angelegt — das
// hat /health 2-3× pro Intervall gefeuert und das Rate-Limit-Bucket schneller
// geleert als nötig. Jetzt teilt sich die ganze App genau EINEN Poller.
// ─────────────────────────────────────────────────────────────────────────────

interface SharedState {
  status: BackendStatus;
  health: HealthInfo | null;
  lastError: string | null;
  lastCheck: Date | null;
}

let state: SharedState = {
  status: "checking",
  health: null,
  lastError: null,
  lastCheck: null,
};

const listeners = new Set<() => void>();
let intervalId: number | null = null;
let activeCtrl: AbortController | null = null;
let lastUrl = getBackendUrl();
let urlUnsub: (() => void) | null = null;

function emit(): void {
  for (const l of listeners) l();
}

async function runOnce(): Promise<void> {
  if (activeCtrl) activeCtrl.abort();
  const ctrl = new AbortController();
  activeCtrl = ctrl;
  try {
    const h = await fetchHealth(ctrl.signal);
    if (ctrl.signal.aborted) return;
    const status: BackendStatus =
      h.maintenance?.active || h.status === "maintenance"
        ? "maintenance"
        : h.status === "ok"
          ? "connected"
          : "disconnected";
    state = { status, health: h, lastError: null, lastCheck: new Date() };
  } catch (err) {
    if (ctrl.signal.aborted) return;
    state = {
      status: "disconnected",
      health: null,
      lastError: err instanceof Error ? err.message : String(err),
      lastCheck: new Date(),
    };
  } finally {
    if (activeCtrl === ctrl) activeCtrl = null;
    emit();
  }
}

function start(): void {
  if (intervalId !== null) return;
  void runOnce();
  intervalId = window.setInterval(() => void runOnce(), POLL_MS);
  urlUnsub = subscribeBackendUrl(() => {
    const next = getBackendUrl();
    if (next === lastUrl) return;
    lastUrl = next;
    state = { ...state, status: "checking" };
    emit();
    void runOnce();
  });
}

function stop(): void {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  if (urlUnsub) {
    urlUnsub();
    urlUnsub = null;
  }
  if (activeCtrl) {
    activeCtrl.abort();
    activeCtrl = null;
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stop();
  };
}

function getSnapshot(): SharedState {
  return state;
}

export function useBackendStatus(_pollMs: number = POLL_MS): BackendStatusResult {
  const url = useBackendUrl();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    status: snap.status,
    url,
    health: snap.health,
    lastError: snap.lastError,
    lastCheck: snap.lastCheck,
    refresh: () => void runOnce(),
  };
}
