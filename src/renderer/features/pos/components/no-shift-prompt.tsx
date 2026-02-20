import { Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@components/ui/button";

interface NoShiftPromptProps {
  onOpenShift: () => void;
  onViewHistory: () => void;
}

export function NoShiftPrompt({ onOpenShift, onViewHistory }: NoShiftPromptProps) {
  return (
    <motion.div
      key="no-shift"
      className="flex-1 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-md w-full px-6 text-center space-y-6">
        {/* Icon */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/5 scale-150" />
            <div className="relative p-5 rounded-full bg-primary/10 border border-primary/10">
              <Wallet className="h-10 w-10 text-primary" />
            </div>
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold tracking-tight">Punto de Venta</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Abre un turno de trabajo para comenzar a procesar ventas y registrar transacciones.
          </p>
        </motion.div>

        {/* Info cards */}
        <motion.div
          className="grid grid-cols-3 gap-3 text-left"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="rounded-lg border bg-card p-3 space-y-1.5">
            <div className="p-1.5 rounded-md bg-blue-500/10 w-fit">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <p className="text-xs font-medium">Control de Caja</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Registro preciso de efectivo</p>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1.5">
            <div className="p-1.5 rounded-md bg-green-500/10 w-fit">
              <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs font-medium">Turnos</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Seguimiento por horario</p>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1.5">
            <div className="p-1.5 rounded-md bg-purple-500/10 w-fit">
              <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-xs font-medium">Reportes</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Arqueo al cerrar</p>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="space-y-4"
        >
          <Button
            size="lg"
            className="w-full h-12 text-base font-semibold gap-2"
            onClick={onOpenShift}
          >
            <Wallet className="h-5 w-5" />
            Abrir Turno de Trabajo
          </Button>
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={onViewHistory}
          >
            Ver historial de ventas →
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
