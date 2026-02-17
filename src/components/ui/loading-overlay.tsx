import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
    message?: string;
    className?: string;
}

export function LoadingOverlay({ message = "Cargando...", className }: LoadingOverlayProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center min-h-[400px] w-full", className)}>
            <Spinner className="size-8 mb-3" />
            <p className="text-sm text-muted-foreground">{message}</p>
        </div>
    );
}
