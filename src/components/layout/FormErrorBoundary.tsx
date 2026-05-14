import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  /** Wird beim Klick auf „Erneut versuchen" aufgerufen — z. B. Dialog schließen. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Lokale Fehlergrenze für Formulare. Verhindert, dass ein Render-Fehler im
 * Dialog/SlideOver die ganze App auf den globalen „Something went wrong"-
 * Bildschirm wirft.
 */
export class FormErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Hilfreich beim Debuggen — landet in den Browser-Konsolen-Logs.
    console.error("[FormErrorBoundary]", error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="max-w-md space-y-1">
          <h2 className="text-base font-semibold">Formular konnte nicht geladen werden</h2>
          <p className="text-sm text-muted-foreground">
            {this.state.error.message || "Unbekannter Fehler beim Aufbau des Formulars."}
          </p>
        </div>
        <Button variant="outline" onClick={this.reset} className="gap-1.5">
          <RotateCcw className="h-4 w-4" /> Erneut versuchen
        </Button>
      </div>
    );
  }
}