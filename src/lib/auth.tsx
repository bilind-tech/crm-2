// Auth-Provider — verwaltet Lock-State und Auto-Lock-Timer.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api/client";

interface AuthState {
  unlocked: boolean;
  loading: boolean;
  unlock: (passwort: string) => Promise<void>;
  lock: () => Promise<void>;
  setAutoLockMinutes: (m: number) => void;
  autoLockMinutes: number;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(30);
  const lastActivity = useRef<number>(Date.now());

  const unlock = useCallback(async (passwort: string) => {
    setLoading(true);
    try {
      await api.post<void>("/auth/unlock", { passwort });
      setUnlocked(true);
      lastActivity.current = Date.now();
    } finally {
      setLoading(false);
    }
  }, []);

  const lock = useCallback(async () => {
    try {
      await api.post<void>("/auth/lock");
    } catch {
      /* ignore */
    }
    setUnlocked(false);
  }, []);

  // Aktivitäts-Tracking
  useEffect(() => {
    if (!unlocked) return;
    const handler = () => {
      lastActivity.current = Date.now();
    };
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [unlocked]);

  // Auto-Lock-Timer
  useEffect(() => {
    if (!unlocked) return;
    const id = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs > autoLockMinutes * 60 * 1000) {
        void lock();
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [unlocked, autoLockMinutes, lock]);

  const value = useMemo<AuthState>(
    () => ({ unlocked, loading, unlock, lock, autoLockMinutes, setAutoLockMinutes }),
    [unlocked, loading, unlock, lock, autoLockMinutes],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return v;
}
