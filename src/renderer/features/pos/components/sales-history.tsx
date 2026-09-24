import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@components/ui/button";
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
  HandCoins,
  User2,
  MinusCircle,
  PlusCircle,
} from "lucide-react";
import { formatCurrency } from "@lib/currency";
import { computeShiftCash } from '@shared/cash-reconciliation';
import { Skeleton } from "@components/ui/skeleton";
import { formatDateTime, formatTime } from "@lib/formatters";
import { useUser } from "@renderer/features/auth";
import { usePermission } from "@renderer/features/auth/hooks/use-permission";
import { PERMISSIONS } from "@shared/permissions";
import { useShift } from "@renderer/features/pos/hooks/use-shift";
import { toast } from "sonner";
import { TransactionDetailsDialog } from "./transaction-details-dialog";
import { ForceCloseDialog } from "./force-close-dialog";
import { ViewExpensesDialog } from "./view-expenses-dialog";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { TransactionsList } from "./transactions-list";
import { cn } from "@lib/utils";
import { Sale } from "@shared/types/models";
import type { ShiftHistoryEntry } from "@renderer/features/pos/types";

interface SalesHistoryProps {
  setShowSalesHistory: (_show: boolean) => void;
}

const paymentMethodConfig: Record<
  string,
  { label: string; icon: typeof Banknote; color: string }
> = {
  cash: {
    label: "Efectivo",
    icon: Banknote,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  card: {
    label: "Tarjeta",
    icon: CreditCard,
    color: "text-muted-foreground",
  },
  transfer: {
    label: "Transferencia",
    icon: ArrowRightLeft,
    color: "text-muted-foreground",
  },
  credit: {
    label: "Crédito",
    icon: HandCoins,
    color: "text-amber-600 dark:text-amber-400",
  },
};

const TAB_TRIGGER_CLASS =
  "flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-1 pb-3 text-sm font-medium text-muted-foreground gap-2 shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent";

const getMethodConfig = (method: string) =>
  paymentMethodConfig[method.toLowerCase()] || {
    label: method,
    icon: Receipt,
    color: "text-muted-foreground",
  };

export function SalesHistory({ setShowSalesHistory }: SalesHistoryProps) {
  const [shifts, setShifts] = useState<ShiftHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Sale | null>(
    null,
  );
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [expandedShift, setExpandedShift] = useState<string | null>(null);
  const [forceCloseDialogOpen, setForceCloseDialogOpen] = useState(false);
  const [shiftToForceClose, setShiftToForceClose] = useState<ShiftHistoryEntry | null>(null);
  const [showExpensesDialog, setShowExpensesDialog] = useState(false);
  const [expensesToView, setExpensesToView] = useState<any[]>([]);
  const [expensesViewTitle, setExpensesViewTitle] = useState("");
  const { user } = useUser();
  const { fetchActiveShift } = useShift();
  const canForceClose = usePermission(PERMISSIONS.SHIFTS_FORCE);
  const [activeTab, setActiveTab] = useState("transactions");
  const [txRefreshKey, setTxRefreshKey] = useState(0);

  const handleForceCloseSuccess = () => {
    fetchHistory();
    fetchActiveShift();
  };

  /** Refreshes whichever tab is currently active. */
  const handleRefresh = () => {
    if (activeTab === "transactions") {
      setTxRefreshKey((k) => k + 1);
    } else {
      void fetchHistory();
    }
  };

  const fetchHistory = useCallback(async () => {
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
        data?: ShiftHistoryEntry[];
        message?: string;
      };

      if (result.success) {
        setShifts(result.data || []);
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
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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

  const toggleShift = (shiftId: string) => {
    setExpandedShift(expandedShift === shiftId ? null : shiftId);
  };

  const handleForceCloseClick = (shift: ShiftHistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setShiftToForceClose(shift);
    setForceCloseDialogOpen(true);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSalesHistory(false)}
          aria-label="Volver al punto de venta"
          title="Volver al punto de venta"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
        <WidgetHeader
          icon={Receipt}
          title="Historial de Ventas"
          subtitle={
            activeTab === "shifts"
              ? `${shifts.length} turno${shifts.length !== 1 ? "s" : ""} registrado${shifts.length !== 1 ? "s" : ""}`
              : "Todas las transacciones registradas"
          }
          className="flex-1"
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={activeTab === "shifts" && isLoading}
              aria-label={activeTab === "shifts" ? "Actualizar turnos" : "Actualizar transacciones"}
              title="Actualizar"
            >
              <RefreshCw
                className={cn("h-4 w-4", activeTab === "shifts" && isLoading && "animate-spin")}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </Button>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        <TabsList className="w-full h-auto justify-start bg-transparent p-0 pt-3 gap-6 rounded-none border-b border-border shrink-0">
          <TabsTrigger value="transactions" className={TAB_TRIGGER_CLASS}>
            <Receipt className="h-4 w-4" strokeWidth={1.75} />
            Transacciones
          </TabsTrigger>
          <TabsTrigger value="shifts" className={TAB_TRIGGER_CLASS}>
            <Clock className="h-4 w-4" strokeWidth={1.75} />
            Turnos
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="transactions"
          forceMount
          className="flex-1 min-h-0 m-0 pt-3 data-[state=inactive]:hidden focus-visible:outline-none focus-visible:ring-0"
        >
          <TransactionsList refreshKey={txRefreshKey} />
        </TabsContent>

        <TabsContent
          value="shifts"
          forceMount
          className="flex-1 min-h-0 m-0 overflow-y-auto pt-3 pb-4 pr-3 space-y-2 data-[state=inactive]:hidden focus-visible:outline-none focus-visible:ring-0"
        >
        {isLoading ? (
          <div role="status" aria-live="polite" aria-label="Cargando turnos" className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Error al cargar el historial</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button onClick={fetchHistory} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : shifts.length === 0 ? (
          <div role="status" className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <Clock className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">No hay turnos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Los turnos aparecerán aquí al abrirlos
            </p>
          </div>
        ) : (
          shifts.map((shift) => {
            const activeSales = shift.sales.filter(s => s.status !== 'voided');
            const totalShiftSales = activeSales.reduce(
              (sum, sale) => sum + sale.total_amount,
              0,
            );
            const cashSales = activeSales
              .filter((s) => s.payment_method === "cash")
              .reduce((sum, s) => sum + s.total_amount, 0);
            const cardSales = activeSales
              .filter((s) => s.payment_method === "card")
              .reduce((sum, s) => sum + s.total_amount, 0);
            const transferSales = activeSales
              .filter((s) => s.payment_method === "transfer")
              .reduce((sum, s) => sum + s.total_amount, 0);
            const creditSales = activeSales
              .filter((s) => s.payment_method === "credit")
              .reduce((sum, s) => sum + s.total_amount, 0);

            // Expenses
            const expenses = shift.expenses || [];
            // Inyecciones de capital (aportes que SUMAN a la caja)
            const capitals = shift.capitals || [];

            // Arqueo — same formula as the backend (@shared/cash-reconciliation):
            // cash abonos and capital injections add, refunds / expenses /
            // partial returns subtract.
            const cash = computeShiftCash({
              initialCash: shift.initial_cash,
              sales: shift.sales,
              debtPayments: shift.debt_payments || [],
              expenses,
              capital: capitals,
              returns: shift.returns || [],
            });
            const totalExpenses = cash.totalExpenses;
            const totalCapital = cash.totalCapital;
            const cashDebtTotal = cash.cashDebtReceived;
            const cashRefunds = cash.cashRefunds;
            const transferDebtTotal = cash.transferDebtReceived;
            const totalReturns = cash.totalReturns;
            const computedExpectedCash = cash.expectedCash;
            const isExpanded = expandedShift === shift.id;
            const isOpen = shift.status === "open";

            return (
              <div
                key={shift.id}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                {/* Shift Header */}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left outline-none focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => toggleShift(shift.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`shift-panel-${shift.id}`}
                >
                  <span className="shrink-0">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-300",
                        isExpanded && "rotate-90",
                      )}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-foreground" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0 pr-4 block">
                    <span className="flex items-center gap-2">
                      <span className="text-base font-semibold tracking-tight tabular-nums">
                        Turno #{shift.id}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                          isOpen
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {isOpen ? "Activo" : "Cerrado"}
                      </span>
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground min-w-0">
                        <span className="truncate" title={shift.user_name}>{shift.user_name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate tabular-nums" title={formatDateTime(shift.start_time)}>
                          {formatDateTime(shift.start_time)}
                        </span>
                      </span>
                      {shift.force_closed && (
                        <span className="flex">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                            Cerrado forzosamente
                          </span>
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-right shrink-0 whitespace-nowrap block">
                    <span className="block text-base font-semibold font-mono tabular-nums">
                      {formatCurrency(totalShiftSales)}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {activeSales.length} venta{activeSales.length !== 1 ? "s" : ""}
                      {shift.sales.length > activeSales.length && (
                         <span className="text-red-600 dark:text-red-400 ml-1">({shift.sales.length - activeSales.length} anulada{shift.sales.length - activeSales.length !== 1 ? 's' : ''})</span>
                      )}
                    </span>
                  </span>
                </button>

                {/* Expanded Content — animated with CSS grid-rows */}
                <div
                  id={`shift-panel-${shift.id}`}
                  role="region"
                  aria-label={`Detalle del turno #${shift.id}`}
                  aria-hidden={!isExpanded}
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                  style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-border">
                      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                        {/* Sales List */}
                        <div className="p-4 space-y-2">
                          <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                            <Receipt className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                            Detalle de Ventas
                          </h3>

                          {shift.sales.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6 bg-muted/40 border border-border rounded-lg">
                              Este turno no tuvo ventas
                            </p>
                          ) : (
                            <div className="divide-y divide-border">
                              {shift.sales.map((sale) => {
                                const config = getMethodConfig(
                                  sale.payment_method,
                                );
                                const MethodIcon = config.icon;
                                const isVoided = sale.status === 'voided';
                                return (
                                  <div
                                    key={sale.id}
                                    className={cn(
                                      "group flex items-center gap-3 px-2 py-2.5 hover:bg-muted/40 transition-colors",
                                      isVoided && "opacity-60"
                                    )}
                                  >
                                    <div className="shrink-0">
                                      <MethodIcon
                                        className={cn("h-4 w-4", isVoided ? "text-muted-foreground" : config.color)}
                                        strokeWidth={1.75}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={cn("text-sm font-medium tabular-nums", isVoided && "line-through text-muted-foreground")}>
                                          #{sale.id}
                                        </span>
                                        {isVoided && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                                            Anulada
                                          </span>
                                        )}
                                        {sale.status === 'credit' && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                            Crédito
                                          </span>
                                        )}
                                        <span className="text-xs text-muted-foreground truncate tabular-nums" title={formatDateTime(sale.sale_date)}>
                                          {formatTime(sale.sale_date)}
                                        </span>
                                      </div>
                                      {sale.customer_name && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <User2 className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                                          <span className="text-xs text-muted-foreground truncate" title={sale.customer_name}>{sale.customer_name}</span>
                                        </div>
                                      )}
                                    </div>
                                    <span className={cn("text-sm font-medium font-mono tabular-nums text-right whitespace-nowrap shrink-0", isVoided && "line-through text-muted-foreground")}>
                                      {formatCurrency(sale.total_amount)}
                                    </span>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        tabIndex={isExpanded ? 0 : -1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewTransaction(sale);
                                        }}
                                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        title="Ver detalles"
                                        aria-label={`Ver detalles de la venta #${sale.id}`}
                                      >
                                        <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        tabIndex={isExpanded ? 0 : -1}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePrintReceipt(sale);
                                        }}
                                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                        title={isVoided ? "No se imprime una venta anulada" : "Imprimir ticket"}
                                        aria-label={`Imprimir ticket de la venta #${sale.id}`}
                                        disabled={isVoided}
                                      >
                                        <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Reconciliation */}
                        <div className="p-4 space-y-4">
                          {/* Payment breakdown */}
                          <div>
                            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                              <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                              Resumen por Método
                            </h3>
                            <div className="rounded-lg border border-border divide-y divide-border text-sm">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                                  <span className="text-sm">Efectivo</span>
                                </div>
                                <span className="text-sm font-medium font-mono tabular-nums text-right">
                                  {formatCurrency(cashSales)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                                  <span className="text-sm">Tarjeta</span>
                                </div>
                                <span className="text-sm font-medium font-mono tabular-nums text-right">
                                  {formatCurrency(cardSales)}
                                </span>
                              </div>
                              {transferSales > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                                    <span className="text-sm">
                                      Transferencia
                                    </span>
                                  </div>
                                  <span className="text-sm font-medium font-mono tabular-nums text-right">
                                    {formatCurrency(transferSales)}
                                  </span>
                                </div>
                              )}
                              {creditSales > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <HandCoins className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
                                    <span className="text-sm">
                                      Crédito
                                    </span>
                                  </div>
                                  <span className="text-sm font-medium font-mono tabular-nums text-right">
                                    {formatCurrency(creditSales)}
                                  </span>
                                </div>
                              )}
                              {/* Debt payments received during this shift */}
                              {cashDebtTotal > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <HandCoins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                                    <span className="text-sm">Abonos (efectivo)</span>
                                  </div>
                                  <span className="text-sm font-medium font-mono tabular-nums text-right text-emerald-600 dark:text-emerald-400">
                                    +{formatCurrency(cashDebtTotal)}
                                  </span>
                                </div>
                              )}
                              {transferDebtTotal > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                                    <span className="text-sm">Abonos (transferencia)</span>
                                  </div>
                                  <span className="text-sm font-medium font-mono tabular-nums text-right">
                                    {formatCurrency(transferDebtTotal)}
                                  </span>
                                </div>
                              )}
                              {cashRefunds > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <MinusCircle className="h-4 w-4 text-red-600 dark:text-red-400" strokeWidth={1.75} />
                                    <span className="text-sm">Reembolsos (fiados anulados)</span>
                                  </div>
                                  <span className="text-sm font-medium font-mono tabular-nums text-right text-red-600 dark:text-red-400">
                                    -{formatCurrency(cashRefunds)}
                                  </span>
                                </div>
                              )}
                              {totalReturns > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <MinusCircle className="h-4 w-4 text-red-600 dark:text-red-400" strokeWidth={1.75} />
                                    <span className="text-sm">Devoluciones (efectivo)</span>
                                  </div>
                                  <span className="text-sm font-medium font-mono tabular-nums text-right text-red-600 dark:text-red-400">
                                    -{formatCurrency(totalReturns)}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                                <span className="text-sm font-semibold">
                                  Total Neto
                                </span>
                                <span className="text-base font-semibold font-mono tabular-nums text-right">
                                  {formatCurrency(totalShiftSales)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expenses */}
                          {expenses.length > 0 && (
                            <div>
                              <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                                <MinusCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" strokeWidth={1.75} aria-hidden="true" />
                                Salidas de Caja (Gastos)
                              </h3>
                              <div className="rounded-lg border border-border divide-y divide-border text-sm">
                                {expenses.map((expense, idx) => (
                                  <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                                    <span className="text-sm text-muted-foreground truncate" title={expense.reason}>{expense.reason}</span>
                                    <span className="text-sm font-medium text-red-600 dark:text-red-400 font-mono tabular-nums text-right shrink-0">
                                      -{formatCurrency(expense.amount)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between px-3.5 py-2 bg-muted/40">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold">Total Gastos</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      tabIndex={isExpanded ? 0 : -1}
                                      aria-label={`Ver salidas de caja del turno #${shift.id}`}
                                      title="Ver detalle de salidas"
                                      onClick={() => {
                                        setExpensesToView(expenses);
                                        setExpensesViewTitle(`Salidas del Turno #${shift.id}`);
                                        setShowExpensesDialog(true);
                                      }}
                                    >
                                      <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                    </Button>
                                  </div>
                                  <span className="text-sm font-semibold text-red-600 dark:text-red-400 font-mono tabular-nums text-right">
                                    -{formatCurrency(totalExpenses)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Inyecciones de capital */}
                          {capitals.length > 0 && (
                            <div>
                              <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                                <PlusCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                                Inyecciones de Capital
                              </h3>
                              <div className="rounded-lg border border-border divide-y divide-border text-sm">
                                {capitals.map((cap: any, idx: number) => (
                                  <div key={cap.id ?? idx} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                                    <span className="text-sm text-muted-foreground truncate" title={cap.reason}>{cap.reason || 'Aporte a caja'}</span>
                                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-mono tabular-nums text-right shrink-0">
                                      +{formatCurrency(Number(cap.amount))}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between px-3.5 py-2 bg-muted/40">
                                  <span className="text-sm font-semibold">Total Inyecciones</span>
                                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums text-right">
                                    +{formatCurrency(totalCapital)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Cash register */}
                          <div>
                            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                              <Wallet className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                              Arqueo de Caja
                            </h3>
                            <div className="rounded-lg border border-border divide-y divide-border text-sm">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-sm text-muted-foreground">
                                  Fondo inicial
                                </span>
                                <span className="text-sm font-medium font-mono tabular-nums text-right">
                                  {formatCurrency(shift.initial_cash)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-sm text-muted-foreground">
                                  + Ventas en efectivo
                                </span>
                                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-mono tabular-nums text-right">
                                  +{formatCurrency(cashSales)}
                                </span>
                              </div>
                              {cashDebtTotal > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <span className="text-sm text-muted-foreground">
                                    + Abonos en efectivo
                                  </span>
                                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-mono tabular-nums text-right">
                                    +{formatCurrency(cashDebtTotal)}
                                  </span>
                                </div>
                              )}
                              {totalCapital > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <span className="text-sm text-muted-foreground">
                                    + Inyecciones de capital
                                  </span>
                                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 font-mono tabular-nums text-right">
                                    +{formatCurrency(totalCapital)}
                                  </span>
                                </div>
                              )}
                              {cashRefunds > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <span className="text-sm text-red-600 dark:text-red-400">
                                    - Reembolsos en efectivo
                                  </span>
                                  <span className="text-sm font-medium text-red-600 dark:text-red-400 font-mono tabular-nums text-right">
                                    -{formatCurrency(cashRefunds)}
                                  </span>
                                </div>
                              )}
                              {totalReturns > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <span className="text-sm text-red-600 dark:text-red-400">
                                    - Devoluciones (efectivo)
                                  </span>
                                  <span className="text-sm font-medium text-red-600 dark:text-red-400 font-mono tabular-nums text-right">
                                    -{formatCurrency(totalReturns)}
                                  </span>
                                </div>
                              )}
                              {totalExpenses > 0 && (
                                <div className="flex items-center justify-between px-3.5 py-2.5">
                                  <span className="text-sm text-red-600 dark:text-red-400">
                                    - Salidas de caja
                                  </span>
                                  <span className="text-sm font-medium text-red-600 dark:text-red-400 font-mono tabular-nums text-right">
                                    -{formatCurrency(totalExpenses)}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                                <span className="text-sm font-semibold">
                                  Efectivo esperado
                                </span>
                                <span className="text-base font-semibold font-mono tabular-nums text-right">
                                  {formatCurrency(shift.expected_cash ?? computedExpectedCash)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Shift result */}
                          {isOpen ? (
                            <div className="space-y-3">
                              <div role="status" className="flex items-center gap-2 justify-center py-3 rounded-lg bg-muted/40 border border-border">
                                <span className="relative flex h-2 w-2" aria-hidden="true">
                                  <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                <span className="text-sm font-medium text-muted-foreground">
                                  Turno activo — pendiente de cierre
                                </span>
                              </div>
                              {canForceClose && user?.id !== shift.user_id && (
                                <Button
                                  variant="destructive"
                                  className="w-full h-9"
                                  size="sm"
                                  tabIndex={isExpanded ? 0 : -1}
                                  onClick={(e) => handleForceCloseClick(shift, e)}
                                >
                                  Cerrar forzosamente
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-border divide-y divide-border text-sm">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <span className="text-sm text-muted-foreground">
                                  Efectivo contado
                                </span>
                                <span className="text-sm font-medium font-mono tabular-nums text-right">
                                  {formatCurrency(shift.final_cash ?? 0)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                                <span
                                  className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium",
                                    shift.difference === 0
                                      ? "bg-muted text-foreground"
                                      : (shift.difference ?? 0) < 0
                                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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
                                    "text-sm font-semibold font-mono tabular-nums text-right",
                                    shift.difference === 0
                                      ? ""
                                      : (shift.difference ?? 0) < 0
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-emerald-600 dark:text-emerald-400",
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
        </TabsContent>
      </Tabs>

      <TransactionDetailsDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        transaction={selectedTransaction}
        onVoidSuccess={() => {
          // Refresh the history AND the live shift context so the expected
          // cash in the header/close-shift dialog reflects the voided sale.
          fetchHistory();
          void fetchActiveShift();
        }}
      />

      <ForceCloseDialog
        open={forceCloseDialogOpen}
        onOpenChange={setForceCloseDialogOpen}
        shiftId={shiftToForceClose?.id}
        onSuccess={handleForceCloseSuccess}
      />

      <ViewExpensesDialog
        isOpen={showExpensesDialog}
        onClose={() => setShowExpensesDialog(false)}
        expenses={expensesToView}
        title={expensesViewTitle}
      />
    </div>
  );
}
