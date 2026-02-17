import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  RefreshCw,
  Eye,
  Printer,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Clock,
  ChevronRight,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Spinner } from "../ui/spinner";
import { formatDateTime, formatTime } from "@/lib/formatters";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { TransactionDetailsDialog } from "./transaction-details-dialog";
import { cn } from "@/lib/utils";

interface SalesHistoryProps {
  setShowSalesHistory: (show: boolean) => void;
}

interface Sale {
  id: string;
  total_amount: number;
  payment_method: string;
  sale_date: string;
  amount_paid?: number;
  change_given?: number;
}

interface Shift {
  id: number;
  user_name: string;
  start_time: string;
  end_time: string | null;
  initial_cash: number;
  final_cash: number | null;
  expected_cash: number | null;
  difference: number | null;
  status: string;
  sales: Sale[];
}

const paymentMethodConfig: Record<
  string,
  { label: string; icon: typeof Banknote; color: string }
> = {
  cash: {
    label: "Efectivo",
    icon: Banknote,
    color: "text-green-600 dark:text-green-400",
  },
  card: {
    label: "Tarjeta",
    icon: CreditCard,
    color: "text-blue-600 dark:text-blue-400",
  },
  transfer: {
    label: "Transferencia",
    icon: ArrowRightLeft,
    color: "text-purple-600 dark:text-purple-400",
  },
};

const getMethodConfig = (method: string) =>
  paymentMethodConfig[method.toLowerCase()] || {
    label: method,
    icon: Receipt,
    color: "text-muted-foreground",
  };

export function SalesHistory({ setShowSalesHistory }: SalesHistoryProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Sale | null>(
    null,
  );
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  const { user } = useUser();

  const fetchHistory = async () => {
    if (!user) {
      setError("No hay usuario autenticado");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!window.ipcRenderer) {
        throw new Error("IPC Renderer not available");
      }

      const result = (await window.ipcRenderer.invoke("history:get", {
        user,
      })) as {
        success: boolean;
        shifts?: Shift[];
        message?: string;
      };

      if (result.success) {
        setShifts(result.shifts || []);
      } else {
        const errorMsg =
          result.message || "Error al cargar el historial de turnos";
        setError(errorMsg);
        toast.error("Error", { description: errorMsg });
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      const errorMsg = "Error de conexión al cargar el historial";
      setError(errorMsg);
      toast.error("Error", { description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleViewTransaction = (sale: Sale) => {
    setSelectedTransaction(sale);
    setTransactionDialogOpen(true);
  };

  const handlePrintReceipt = async (sale: Sale) => {
    try {
      if (!window.ipcRenderer) {
        toast.error("Error", {
          description: "Sistema de impresión no disponible",
        });
        return;
      }

      const result = (await window.ipcRenderer.invoke("print-receipt", {
        saleId: sale.id,
      })) as {
        success: boolean;
        message?: string;
      };

      if (result.success) {
        toast.success("Ticket impreso", { description: `Venta #${sale.id}` });
      } else {
        toast.error("Error al imprimir", {
          description: result.message || "No se pudo imprimir el ticket",
        });
      }
    } catch (error) {
      console.error("Error printing receipt:", error);
      toast.error("Error al imprimir", {
        description: "Ocurrió un error inesperado",
      });
    }
  };

  const toggleShift = (shiftId: number) => {
    setExpandedShift(expandedShift === shiftId ? null : shiftId);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center gap-3 pb-4 border-b mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSalesHistory(false)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">
            Historial de Ventas
          </h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Error al cargar el historial</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button onClick={fetchHistory} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSalesHistory(false)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Historial de Ventas
          </h1>
          <p className="text-sm text-muted-foreground">
            {shifts.length} turno{shifts.length !== 1 ? "s" : ""} registrado
            {shifts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetchHistory}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pt-3 pb-4 pr-3 space-y-2">
        {shifts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">No hay turnos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Los turnos aparecerán aquí al abrirlos
            </p>
          </div>
        ) : (
          shifts.map((shift) => {
            const totalShiftSales = shift.sales.reduce(
              (sum, sale) => sum + sale.total_amount,
              0,
            );
            const cashSales = shift.sales
              .filter((s) => s.payment_method === "cash")
              .reduce((sum, s) => sum + s.total_amount, 0);
            const cardSales = shift.sales
              .filter((s) => s.payment_method === "card")
              .reduce((sum, s) => sum + s.total_amount, 0);
            const transferSales = shift.sales
              .filter((s) => s.payment_method === "transfer")
              .reduce((sum, s) => sum + s.total_amount, 0);
            const isExpanded = expandedShift === shift.id;
            const isOpen = shift.status === "open";

            return (
              <div
                key={shift.id}
                className="rounded-lg border bg-card overflow-hidden"
              >
                {/* Shift Header */}
                <button
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggleShift(shift.id)}
                >
                  <div className="shrink-0">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-300",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">
                        Turno #{shift.id}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                          isOpen
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isOpen ? "Activo" : "Cerrado"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                      <span className="truncate" title={shift.user_name}>{shift.user_name}</span>
                      <span>·</span>
                      <span className="truncate">{formatDateTime(shift.start_time)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 whitespace-nowrap">
                    <p className="text-base font-bold tabular-nums">
                      {formatCurrency(totalShiftSales)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shift.sales.length} venta
                      {shift.sales.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>

                {/* Expanded Content — animated with CSS grid-rows */}
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                  style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="border-t">
                      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
                        {/* Sales List */}
                        <div className="p-4 space-y-2">
                          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            <Receipt className="h-3 w-3" />
                            Detalle de Ventas
                          </div>

                          {shift.sales.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-lg">
                              Este turno no tuvo ventas
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {shift.sales.map((sale) => {
                                const config = getMethodConfig(
                                  sale.payment_method,
                                );
                                const MethodIcon = config.icon;
                                return (
                                  <div
                                    key={sale.id}
                                    className="group flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-colors"
                                  >
                                    <div className="shrink-0">
                                      <MethodIcon
                                        className={cn("h-4 w-4", config.color)}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                          #{sale.id}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate">
                                          {formatTime(sale.sale_date)}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-sm font-semibold tabular-nums whitespace-nowrap shrink-0">
                                      {formatCurrency(sale.total_amount)}
                                    </span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewTransaction(sale);
                                        }}
                                        className="p-1 rounded hover:bg-muted"
                                        title="Ver detalles"
                                      >
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePrintReceipt(sale);
                                        }}
                                        className="p-1 rounded hover:bg-muted"
                                        title="Imprimir"
                                      >
                                        <Printer className="h-4 w-4 text-muted-foreground" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Cash Reconciliation */}
                        <div className="p-4 space-y-3">
                          {/* Payment breakdown */}
                          <div>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              <TrendingUp className="h-3 w-3" />
                              Resumen por Método
                            </div>
                            <div className="rounded-lg border divide-y text-sm">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  <span className="text-sm">Efectivo</span>
                                </div>
                                <span className="text-sm font-semibold tabular-nums">
                                  {formatCurrency(cashSales)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  <span className="text-sm">Tarjeta</span>
                                </div>
                                <span className="text-sm font-semibold tabular-nums">
                                  {formatCurrency(cardSales)}
                                </span>
                              </div>
                              {transferSales > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    <span className="text-sm">
                                      Transferencia
                                    </span>
                                  </div>
                                  <span className="text-sm font-semibold tabular-nums">
                                    {formatCurrency(transferSales)}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                                <span className="text-sm font-semibold">
                                  Total
                                </span>
                                <span className="text-base font-bold tabular-nums">
                                  {formatCurrency(totalShiftSales)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Cash register */}
                          <div>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              <Wallet className="h-3 w-3" />
                              Arqueo de Caja
                            </div>
                            <div className="rounded-lg border divide-y text-sm">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-sm text-muted-foreground">
                                  Fondo inicial
                                </span>
                                <span className="text-sm font-medium tabular-nums">
                                  {formatCurrency(shift.initial_cash)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-sm text-muted-foreground">
                                  + Ventas en efectivo
                                </span>
                                <span className="text-sm font-medium text-green-700 dark:text-green-400 tabular-nums">
                                  +{formatCurrency(cashSales)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                                <span className="text-sm font-semibold">
                                  Efectivo esperado
                                </span>
                                <span className="text-base font-bold tabular-nums">
                                  {formatCurrency(
                                    shift.expected_cash ??
                                      shift.initial_cash + cashSales,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Shift result */}
                          {isOpen ? (
                            <div className="flex items-center gap-2 justify-center py-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                Turno activo — pendiente de cierre
                              </span>
                            </div>
                          ) : (
                            <div className="rounded-lg border divide-y text-sm">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-sm text-muted-foreground">
                                  Efectivo contado
                                </span>
                                <span className="text-sm font-medium tabular-nums">
                                  {formatCurrency(shift.final_cash ?? 0)}
                                </span>
                              </div>
                              <div
                                className={cn(
                                  "flex items-center justify-between px-3.5 py-2.5",
                                  shift.difference === 0
                                    ? "bg-muted/40"
                                    : (shift.difference ?? 0) < 0
                                      ? "bg-red-500/10"
                                      : "bg-green-500/10",
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-sm font-semibold",
                                    shift.difference === 0
                                      ? ""
                                      : (shift.difference ?? 0) < 0
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-green-600 dark:text-green-400",
                                  )}
                                >
                                  {shift.difference === 0
                                    ? "Cuadre perfecto"
                                    : (shift.difference ?? 0) < 0
                                      ? "Faltante"
                                      : "Sobrante"}
                                </span>
                                <span
                                  className={cn(
                                    "text-sm font-bold tabular-nums",
                                    shift.difference === 0
                                      ? ""
                                      : (shift.difference ?? 0) < 0
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-green-600 dark:text-green-400",
                                  )}
                                >
                                  {(shift.difference ?? 0) > 0 ? "+" : ""}
                                  {formatCurrency(shift.difference ?? 0)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        transaction={selectedTransaction}
      />
    </div>
  );
}
