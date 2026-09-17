import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog";
import { buttonVariants } from "@components/ui/button";
import { cn } from "@lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  onConfirm: () => void;
  isLoading?: boolean;
  confirmLabel?: string;
}

/**
 * Destructive confirmation (delete / deactivate). The confirm action is always
 * red so the irreversible choice is unmistakable; Cancel keeps the default
 * focus so Enter never deletes by accident.
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = "¿Estás seguro?",
  description = "Esta acción no se puede deshacer.",
  onConfirm,
  isLoading = false,
  confirmLabel = "Eliminar",
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <AlertDialogHeader className="p-6 pb-4 border-b border-border space-y-0 text-left">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0"
            >
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <AlertDialogTitle className="text-lg font-semibold tracking-tight">
              {title}
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        {/* Body */}
        <div className="p-6">
          <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </AlertDialogDescription>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3">
          <AlertDialogCancel disabled={isLoading} className="flex-1 h-10 mt-0">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            className={cn(buttonVariants({ variant: "destructive" }), "flex-1 h-10")}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                Eliminando…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
