import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@components/ui/button";

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defense: an uncaught render error used to unmount the whole
 * React tree and leave a white screen. This catches it and offers a reload
 * without losing the session (token lives in localStorage).
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Render crash:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Algo salió mal</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ocurrió un error inesperado en la interfaz. Tus datos están a salvo — recarga la
              aplicación para continuar.
            </p>
          </div>
          <p className="text-xs text-muted-foreground/70 font-mono break-all bg-muted/50 rounded-lg px-3 py-2">
            {this.state.error.message}
          </p>
          <Button className="w-full h-10 gap-2" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            Recargar aplicación
          </Button>
        </div>
      </div>
    );
  }
}
