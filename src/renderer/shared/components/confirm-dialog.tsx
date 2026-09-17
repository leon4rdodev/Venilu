import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog";
import { Button } from "@components/ui/button";
import { AlertTriangle, CircleHelp, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Defaults to "Confirmar" */
  confirmLabel?: string;
  /** Defaults to "Cancelar" */
  cancelLabel?: string;
  /** destructive renders the confirm button in red */
  variant?: "default" | "destructive";
  /** Shown on the confirm button while `loading` */
  loadingLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Design-system replacement for window.confirm (which freezes the Electron
 * renderer event loop). Follows the app modal pattern: p-6 header/body,
 * bordered footer, h-10 pill buttons.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loadingLabel,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const isDestructive = variant === "destructive";
  // A warning glyph only when something is at stake; neutral confirmations ask a question.
  const Icon = isDestructive ? AlertTriangle : CircleHelp;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <AlertDialogHeader className="p-6 pb-4 border-b border-border space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className={
                isDestructive
                  ? "w-9 h-9 shrink-0 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"
                  : "w-9 h-9 shrink-0 rounded-full bg-muted text-foreground flex items-center justify-center"
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <AlertDialogTitle className="text-lg font-semibold tracking-tight">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="p-6 pt-4 flex-row justify-end gap-3">
          <Button
            variant="outline"
            className="h-10"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            className="h-10 min-w-[7rem]"
            disabled={loading}
            aria-busy={loading || undefined}
            onClick={() => void onConfirm()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                {loadingLabel ?? "Procesando…"}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
