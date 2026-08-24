import { Wallet, ShieldCheck, Clock, BarChart3 } from "lucide-react";
import { Button } from "@components/ui/button";

interface NoShiftPromptProps {
  onOpenShift: () => void;
  onViewHistory: () => void;
}

export function NoShiftPrompt({ onOpenShift, onViewHistory }: NoShiftPromptProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md w-full px-6 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-muted text-foreground flex items-center justify-center">
            <Wallet className="h-7 w-7" strokeWidth={1.75} />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Punto de Venta</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Abre un turno de trabajo para comenzar a procesar ventas y registrar transacciones.
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3 text-left">
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-medium">Control de Caja</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Registro preciso de efectivo</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-medium">Turnos</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Seguimiento por horario</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center">
              <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-medium">Reportes</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Arqueo al cerrar</p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full h-11 font-medium gap-2"
            onClick={onOpenShift}
          >
            <Wallet className="h-4 w-4" strokeWidth={1.75} />
            Abrir Turno de Trabajo
          </Button>
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={onViewHistory}
          >
            Ver historial de ventas →
          </button>
        </div>
      </div>
    </div>
  );
}
