// Demo-Daten in diesem Browser löschen.
// Sichtbar im Demo-Modus (kein expliziter Backend-Endpunkt) ODER wenn noch
// alte mcc_mock_*/mcc.* LocalStorage-Keys herumliegen. Wirkt rein clientseitig.
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isBackendUrlExplicit } from "@/lib/api/backendUrl";

const MOCK_KEY_PREFIXES = ["mcc_mock", "mcc."];

function listMockKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && MOCK_KEY_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
  }
  return keys;
}

export function MockDataResetCard() {
  const [keys, setKeys] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setKeys(listMockKeys());
  }, []);

  const demoMode = !isBackendUrlExplicit();
  if (!demoMode && keys.length === 0) return null;

  const handleConfirm = () => {
    for (const k of listMockKeys()) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    // Hard-Reload, damit alle React-Query-Caches sauber starten.
    window.location.reload();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-content-center rounded-lg bg-muted">
          <Trash2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Demo-Daten in diesem Browser löschen</h2>
          <p className="text-sm text-muted-foreground">
            Entfernt alle lokal gespeicherten Test-Daten ({keys.length}{" "}
            {keys.length === 1 ? "Eintrag" : "Einträge"}). Beeinflusst nichts
            am Pi-Backend — wirkt nur in diesem Browser. Empfohlen vor dem
            ersten Wechsel auf das echte Pi-Backend.
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        className="rounded-full px-5"
        onClick={() => setConfirmOpen(true)}
        disabled={keys.length === 0}
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        {keys.length === 0 ? "Nichts zu löschen" : "Demo-Daten löschen"}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Demo-Daten endgültig löschen?"
        description={
          <span>
            Es werden <strong>{keys.length}</strong> lokale Einträge entfernt.
            Anschließend wird die App neu geladen.
          </span>
        }
        confirmLabel="Löschen & neu laden"
        variant="destructive"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
