import { Wallet, ShieldCheck, Clock, BarChart3 } from "lucide-react";
import { Button } from "@components/ui/button";

interface NoShiftPromptProps {
  onOpenShift: () => void;
  onViewHistory: () => void;
}

export function NoShiftPrompt({ onOpenShift, onViewHistory }: NoShiftPromptProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      {/* gap (not space-y): the cards <ul> resets its margins with m-0, which would cancel space-y's bottom margin */}
      <div className="max-w-md w-full px-6 text-center flex flex-col gap-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-muted text-foreground flex items-center justify-center" aria-hidden="true">
            <Wallet className="h-7 w-7" strokeWidth={1.75} />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Punto de Venta</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Abre un turno de trabajo para comenzar a procesar ventas y registrar transacciones.
          </p>
        </div>

        {/* Info cards */}
        <ul className="grid grid-cols-3 gap-3 text-left list-none p-0 m-0">
          <li className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center" aria-hidden="true">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-medium text-foreground">Control de Caja</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Registro preciso de efectivo</p>
          </li>
          <li className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center" aria-hidden="true">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-medium text-foreground">Turnos</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Seguimiento por horario</p>
          </li>
          <li className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center" aria-hidden="true">
              <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <p className="text-xs font-medium text-foreground">Reportes</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Arqueo al cerrar</p>
          </li>
        </ul>

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
          <Button
            variant="ghost"
            className="h-9 px-3 text-sm font-normal text-muted-foreground hover:text-foreground"
            onClick={onViewHistory}
          >
            Ver historial de ventas →
          </Button>
        </div>
      </div>
    </div>
  );
}
