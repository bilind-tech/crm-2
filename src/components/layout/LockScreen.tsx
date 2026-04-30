import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Lock } from "lucide-react";

export function LockScreen() {
  const { unlock, loading } = useAuth();
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    try {
      await unlock(passwort);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 p-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">MCC Reinigungs-CRM</CardTitle>
          <CardDescription>Bitte gib dein Master-Passwort ein, um zu entsperren.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">Master-Passwort</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw"
                  type="password"
                  autoFocus
                  className="pl-9"
                  value={passwort}
                  onChange={(e) => setPasswort(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            {fehler && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{fehler}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entsperren …" : "Entsperren"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Mock-Modus · Standard-Passwort: <code className="rounded bg-muted px-1 py-0.5">admin</code>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
