import type { ElementType } from 'react';
import { Skeleton } from '@components/ui/skeleton';
import { FileCheck2, FileClock, FileWarning, Inbox, Send, ShieldCheck } from 'lucide-react';
import { cn } from '@lib/utils';
import { EcfStats as Stats } from '../types';

interface Celda {
  label: string;
  valor: number | undefined;
  icon: ElementType;
  /** Clases del chip de color. */
  acento?: string;
}

const NEUTRO = 'bg-muted text-foreground';

function Tarjeta({ label, valor, icon: Icon, acento = NEUTRO }: Celda) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3.5 flex items-center gap-3 min-w-0">
      <span className={cn('h-8 w-8 rounded-md flex items-center justify-center shrink-0', acento)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums leading-tight">{valor ?? '–'}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

export function EcfStatsBar({ stats, loading }: { stats?: Stats; loading: boolean }) {
  if (loading) return <Skeleton className="h-[68px] w-full" />;

  const pendientes =
    (stats?.draft ?? 0) + (stats?.signed ?? 0) + (stats?.queued ?? 0);

  const celdas: Celda[] = [
    { label: 'Emitidos', valor: stats?.total, icon: Inbox },
    {
      label: 'Pendientes',
      valor: pendientes,
      icon: FileClock,
      acento: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Enviados',
      valor: stats?.sent,
      icon: Send,
      acento: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    {
      label: 'Aceptados',
      valor: stats?.accepted,
      icon: ShieldCheck,
      acento: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Rechazados',
      valor: stats?.rejected,
      icon: FileWarning,
      acento: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
    {
      label: 'Firmados',
      valor: stats?.signed,
      icon: FileCheck2,
      acento: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {celdas.map((c) => (
        <Tarjeta key={c.label} {...c} />
      ))}
    </div>
  );
}
