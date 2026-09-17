import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@lib/currency";
import { formatDateTime, formatPhone } from "@lib/formatters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { toast } from "sonner";
import { ipc } from "@lib/ipc";
import { Customer, Sale, DebtPayment } from "@shared/types/models";
import { CustomerSummaryResponse } from "../types";
import { usePermission } from "@renderer/features/auth/hooks/use-permission";
import { PERMISSIONS } from "@shared/permissions";
import { TransactionDetailsDialog } from "@renderer/features/pos/components/transaction-details-dialog";
import { ShoppingBag, HandCoins, User, Phone, Mail, MapPin, FileText, ArrowRightLeft, CreditCard, Banknote, Eye, Receipt, CalendarClock, Loader2, LucideIcon } from "lucide-react";
import { EmptyState } from "@renderer/shared/components/empty-state";
import { cn } from "@lib/utils";

// Pestañas subrayadas: mismo estilo que Suplidores e Historial de ventas.
const TAB_TRIGGER_CLASS =
  "flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-1 pb-3 text-sm font-medium text-muted-foreground gap-2 shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent";

/** Fila de contacto del encabezado: icono decorativo + etiqueta sr-only + valor truncado con tooltip. */
function ContactRow({
  icon: Icon,
  label,
  value,
  emptyText,
  tabular,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
  emptyText: string;
  tabular?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="sr-only">{label}:</span>
      {value ? (
        <span className={cn("truncate text-foreground", tabular && "tabular-nums")} title={value}>{value}</span>
      ) : (
        <span className="truncate text-muted-foreground/70 italic">{emptyText}</span>
      )}
    </div>
  );
}

/** Compact relative date in Spanish ("Hoy", "Ayer", "Hace 3 días", …). */
function formatRelativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? "Hace 1 año" : `Hace ${years} años`;
}

/** Compact inline mini-stat (flat card, dashboard metric-card style). */
function MiniStat({
  icon: Icon,
  label,
  value,
  loading,
  valueClassName,
  title,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  loading: boolean;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div
      className="bg-card border border-border rounded-lg p-3 min-w-0"
      role="group"
      aria-label={loading ? `${label}: cargando` : `${label}: ${value}`}
      aria-busy={loading || undefined}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="truncate" title={label}>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-5 w-16" />
      ) : (
        <p
          className={cn("text-sm font-semibold tracking-tight font-mono tabular-nums truncate", valueClassName)}
          title={title ?? String(value)}
        >
          {value}
        </p>
      )}
    </div>
  );
}

/** Placeholder de lista mientras carga el historial (misma silueta que las filas reales). */
function HistorySkeleton() {
  return (
    <div className="rounded-lg border border-border divide-y divide-border overflow-hidden" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

interface CustomerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export function CustomerProfileDialog({ open, onOpenChange, customer }: CustomerProfileDialogProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [totalSpent, setTotalSpent] = useState(0);
  const [salesLoadingMore, setSalesLoadingMore] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsLoadingMore, setPaymentsLoadingMore] = useState(false);
  const [localCustomer, setLocalCustomer] = useState<Customer | null>(customer);

  const [selectedTransaction, setSelectedTransaction] = useState<Sale | null>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const canViewBalance = usePermission(PERMISSIONS.CUST_VIEW_BALANCE);

  const { data: summaryResult, isLoading: summaryLoading } = useQuery({
    queryKey: ["customer-summary", customer?.id],
    queryFn: async () =>
      (await ipc.invoke("get-customer-summary", customer!.id)) as CustomerSummaryResponse,
    enabled: open && !!customer,
  });
  const summary = summaryResult?.success ? summaryResult.data : undefined;

  const fetchHistoryData = useCallback(async () => {
    if (!customer) return;
    setIsLoading(true);
    setSalesPage(1);
    setPaymentsPage(1);
    try {
      // Fetch sales and payments in parallel
      const [salesResult, paymentsResult] = await Promise.all([
        ipc.invoke("customers:getSales", { customerId: customer.id, page: 1, limit: 15 }) as Promise<{ success: boolean; data?: Sale[]; totalPages?: number; totalSpent?: number; message?: string }>,
        ipc.invoke("customers:getPayments", { customerId: customer.id, page: 1, limit: 15 }) as Promise<{ success: boolean; data?: DebtPayment[]; totalPages?: number; message?: string }>,
      ]);

      if (salesResult.success && salesResult.data) {
        setSales(salesResult.data);
        setSalesTotalPages(salesResult.totalPages || 1);
        setTotalSpent(salesResult.totalSpent || 0);
      } else {
        toast.error("Error al cargar ventas", { description: salesResult.message });
      }

      if (paymentsResult.success && paymentsResult.data) {
        setPayments(paymentsResult.data);
        setPaymentsTotalPages(paymentsResult.totalPages || 1);
      } else {
        toast.error("Error al cargar pagos", { description: paymentsResult.message });
      }
    } catch (error: unknown) {
      console.error("Error fetching customer history:", error);
      toast.error("Error", { description: "No se pudo cargar el historial del cliente." });
    } finally {
      setIsLoading(false);
    }
  }, [customer]);

  const fetchCustomer = useCallback(async () => {
    if (!customer) return;
    try {
      const result = await ipc.invoke("get-customer", customer.id) as { success: boolean; data: Customer };
      if (result.success) {
        setLocalCustomer(result.data);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    }
  }, [customer]);

  const handleVoidSuccess = useCallback(() => {
    fetchHistoryData();
    fetchCustomer();
    queryClient.invalidateQueries({ queryKey: ["customer-summary", customer?.id] });
  }, [fetchHistoryData, fetchCustomer, queryClient, customer?.id]);

  useEffect(() => {
    if (open && customer) {
      setLocalCustomer(customer);
      fetchHistoryData();
    } else {
      setSales([]);
      setPayments([]);
      setSalesPage(1);
      setPaymentsPage(1);
      setSalesTotalPages(1);
      setPaymentsTotalPages(1);
    }
  }, [open, customer, fetchHistoryData]);

  const loadMoreSales = async () => {
    if (!customer || salesPage >= salesTotalPages) return;
    setSalesLoadingMore(true);
    try {
      const nextPage = salesPage + 1;
      const result = await ipc.invoke("customers:getSales", { customerId: customer.id, page: nextPage, limit: 15 }) as { success: boolean; data?: Sale[]; totalPages?: number };
      if (result.success && result.data) {
        setSales(prev => [...prev, ...(result.data ?? [])]);
        setSalesPage(nextPage);
        setSalesTotalPages(result.totalPages || 1);
      }
    } catch (error: unknown) {
      console.error("Error loading more sales:", error);
      toast.error("Error", { description: "Carga de compras fallida." });
    } finally {
      setSalesLoadingMore(false);
    }
  };

  const loadMorePayments = async () => {
    if (!customer || paymentsPage >= paymentsTotalPages) return;
    setPaymentsLoadingMore(true);
    try {
      const nextPage = paymentsPage + 1;
      const result = await ipc.invoke("customers:getPayments", { customerId: customer.id, page: nextPage, limit: 15 }) as { success: boolean; data?: DebtPayment[]; totalPages?: number };
      if (result.success && result.data) {
        setPayments(prev => [...prev, ...(result.data ?? [])]);
        setPaymentsPage(nextPage);
        setPaymentsTotalPages(result.totalPages || 1);
      }
    } catch (error: unknown) {
      console.error("Error loading more payments:", error);
      toast.error("Error", { description: "Carga de pagos fallida." });
    } finally {
      setPaymentsLoadingMore(false);
    }
  };

  const handleViewTransaction = (sale: Sale) => {
    setSelectedTransaction(sale);
    setTransactionDialogOpen(true);
  };

  if (!localCustomer) return null;

  const creditLimit = localCustomer.credit_limit != null ? Number(localCustomer.credit_limit) : null;
  const balance = Number(localCustomer.balance || 0);
  const isOverLimit = creditLimit !== null && balance >= creditLimit;

  // Prefer fresh summary figures; fall back to the customer record while loading
  const effCreditLimit = summary !== undefined ? summary.creditLimit : creditLimit;
  const effBalance = summary !== undefined ? summary.balance : balance;
  const creditAvailable =
    summary?.creditAvailable ??
    (effCreditLimit !== null ? Math.max(effCreditLimit - effBalance, 0) : null);
  const creditUsedRatio =
    effCreditLimit === null ? 0 : effCreditLimit > 0 ? effBalance / effCreditLimit : 1;
  const creditUsedPercent = Math.round(Math.min(Math.max(creditUsedRatio, 0), 1) * 100);
  // Color + texto (porcentaje y montos): nunca color solo para transmitir el estado.
  const creditFillClass =
    creditUsedRatio >= 1 ? "bg-red-600 dark:bg-red-500" : creditUsedRatio > 0.7 ? "bg-amber-600 dark:bg-amber-500" : "bg-foreground";
  const hasCreditActivity = effBalance > 0 || sales.some((s) => s.payment_method === "credit");
  // Contadores reales (del resumen), no solo la página cargada.
  const salesCount = summary?.purchasesCount ?? sales.length;
  const paymentsCount = summary?.paymentsCount ?? payments.length;

  // Helpers for formatting
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />;
      case 'card': return <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />;
      case 'transfer': return <ArrowRightLeft className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />;
      case 'credit': return <HandCoins className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />;
      default: return null;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      case 'credit': return 'Crédito';
      default: return method;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 pr-12 border-b border-border space-y-0 shrink-0 text-left">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="w-10 h-10 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0 text-sm font-semibold select-none"
              aria-hidden="true"
            >
              {localCustomer.name.trim().charAt(0).toUpperCase() || <User className="h-4 w-4" strokeWidth={1.75} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-tight truncate" title={localCustomer.name}>
                  {localCustomer.name}
                </DialogTitle>
                {canViewBalance && isOverLimit && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium bg-red-500/10 text-red-700 dark:text-red-400">
                    Límite excedido
                  </span>
                )}
              </div>
              <DialogDescription className="text-sm text-muted-foreground">
                Perfil del cliente: contacto, resumen e historial de compras y pagos.
              </DialogDescription>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-5">
            <ContactRow icon={Phone} label="Teléfono" value={localCustomer.phone ? formatPhone(localCustomer.phone) : null} emptyText="Sin teléfono" tabular />
            <ContactRow icon={Mail} label="Correo" value={localCustomer.email} emptyText="Sin correo" />
            <ContactRow icon={MapPin} label="Dirección" value={localCustomer.address} emptyText="Sin dirección" />
            <ContactRow icon={FileText} label="Notas" value={localCustomer.notes} emptyText="Sin notas" />
          </div>

          <div className={cn("grid gap-2 mt-5 pt-4 border-t border-border", canViewBalance ? "grid-cols-5" : "grid-cols-2")}>
            {canViewBalance && (
              <MiniStat
                icon={Banknote}
                label="Gastado Total"
                value={formatCurrency(summary ? summary.totalSpent : totalSpent)}
                loading={summaryLoading}
              />
            )}
            <MiniStat
              icon={ShoppingBag}
              label="Compras"
              value={summary?.purchasesCount ?? 0}
              loading={summaryLoading}
            />
            {canViewBalance && (
              <MiniStat
                icon={Receipt}
                label="Ticket Promedio"
                value={summary ? formatCurrency(summary.averageTicket) : "—"}
                loading={summaryLoading}
              />
            )}
            <MiniStat
              icon={CalendarClock}
              label="Última Compra"
              value={summary?.lastPurchaseAt ? formatRelativeDate(summary.lastPurchaseAt) : "—"}
              loading={summaryLoading}
              title={summary?.lastPurchaseAt ? formatDateTime(summary.lastPurchaseAt) : undefined}
            />
            {canViewBalance && (
              <MiniStat
                icon={HandCoins}
                label="Total Abonado"
                value={summary ? formatCurrency(summary.totalPaidDebt) : "—"}
                loading={summaryLoading}
                valueClassName={
                  summary && summary.totalPaidDebt > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : undefined
                }
              />
            )}
          </div>

          {canViewBalance && effCreditLimit !== null && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span id="credit-usage-label" className="text-xs font-medium text-muted-foreground">
                    Crédito usado
                  </span>
                  <span
                    className={cn(
                      "text-xs font-mono tabular-nums font-medium",
                      creditUsedRatio >= 1
                        ? "text-red-700 dark:text-red-400"
                        : creditUsedRatio > 0.7
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-foreground"
                    )}
                  >
                    {creditUsedPercent}%
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-muted-foreground whitespace-nowrap truncate">
                  <span className="text-foreground">{formatCurrency(effBalance)}</span> de {formatCurrency(effCreditLimit)}
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  Disponible <span className="text-foreground">{formatCurrency(creditAvailable ?? 0)}</span>
                </span>
              </div>
              <div
                className="h-1.5 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-labelledby="credit-usage-label"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={creditUsedPercent}
                aria-valuetext={`${formatCurrency(effBalance)} de ${formatCurrency(effCreditLimit)} usados, ${formatCurrency(creditAvailable ?? 0)} disponibles`}
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", creditFillClass)}
                  style={{ width: `${Math.min(Math.max(creditUsedRatio, 0), 1) * 100}%` }}
                />
              </div>
            </div>
          )}
          {canViewBalance && effCreditLimit === null && hasCreditActivity && (
            <p className="mt-3 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Crédito sin límite
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 pb-6 pt-2 flex flex-col min-h-0">
          <Tabs defaultValue="sales" className="h-full flex flex-col min-h-0 gap-0">
            <TabsList className="w-full h-auto justify-start bg-transparent p-0 pt-1 gap-6 rounded-none border-b border-border shrink-0">
              <TabsTrigger value="sales" className={TAB_TRIGGER_CLASS}>
                <ShoppingBag className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Compras
                <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${salesCount} compras`}>
                  ({salesCount})
                </span>
              </TabsTrigger>
              <TabsTrigger value="payments" className={TAB_TRIGGER_CLASS}>
                <HandCoins className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Pagos
                <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${paymentsCount} pagos`}>
                  ({paymentsCount})
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="flex-1 min-h-0 overflow-y-auto mt-4 pr-1 space-y-2 focus-visible:outline-none">
              {isLoading ? (
                <HistorySkeleton />
              ) : sales.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="No hay compras registradas"
                  description="Las ventas de este cliente aparecerán aquí."
                />
              ) : (
                <>
                  <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden" aria-label="Historial de compras">
                    {sales.map((sale) => {
                      const isVoided = sale.status === 'voided';
                      const shortId = sale.id.slice(0, 8);
                      return (
                        <li key={sale.id}>
                          <button
                            type="button"
                            onClick={() => handleViewTransaction(sale)}
                            aria-label={`Ver detalle de la venta ${shortId}, ${formatCurrency(sale.total_amount)}${isVoided ? ", anulada" : ""}`}
                            className={cn(
                              "group w-full text-left flex items-center justify-between gap-4 px-3.5 py-2.5 bg-card hover:bg-accent/40 transition-colors cursor-pointer",
                              "focus-visible:outline-none focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                              isVoided && "bg-muted/30"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn("w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0", isVoided && "opacity-60")} aria-hidden="true">
                                {getPaymentMethodIcon(sale.payment_method)}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn("font-medium text-sm font-mono tabular-nums", isVoided && "line-through text-muted-foreground")}>
                                    Venta #{shortId}
                                  </span>
                                  {isVoided ? (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium whitespace-nowrap bg-red-500/10 text-red-700 dark:text-red-400">
                                      Anulada
                                    </span>
                                  ) : (
                                    sale.payment_method === 'credit' && (
                                      sale.status === 'paid' ? (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium whitespace-nowrap bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                          Crédito — Pagado
                                        </span>
                                      ) : sale.status === 'partial' ? (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium whitespace-nowrap bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                          Crédito — Parcial
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium whitespace-nowrap bg-red-500/10 text-red-700 dark:text-red-400">
                                          Crédito — Pendiente
                                        </span>
                                      )
                                    )
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate" title={formatDateTime(sale.created_at)}>
                                  {formatDateTime(sale.created_at)} · {getPaymentMethodLabel(sale.payment_method)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Eye
                                className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              <span className={cn("text-sm font-mono font-medium tabular-nums whitespace-nowrap", isVoided && "line-through text-muted-foreground")}>
                                {formatCurrency(sale.total_amount)}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {salesPage < salesTotalPages && (
                    <div className="flex justify-center pt-2 pb-4">
                      <Button variant="outline" size="sm" onClick={loadMoreSales} disabled={salesLoadingMore} aria-busy={salesLoadingMore || undefined}>
                        {salesLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                        {salesLoadingMore ? "Cargando…" : "Cargar más compras"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="payments" className="flex-1 min-h-0 overflow-y-auto mt-4 pr-1 space-y-2 focus-visible:outline-none">
              {isLoading ? (
                <HistorySkeleton />
              ) : payments.length === 0 ? (
                <EmptyState
                  icon={HandCoins}
                  title="No hay pagos registrados"
                  description="Los abonos a deuda de este cliente aparecerán aquí."
                />
              ) : (
                <>
                  <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden" aria-label="Historial de pagos">
                    {payments.map((payment) => (
                      <li key={payment.id} className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-card hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0" aria-hidden="true">
                            {getPaymentMethodIcon(payment.payment_method)}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm">Abono</span>
                              <span className="text-xs font-medium text-muted-foreground">
                                {getPaymentMethodLabel(payment.payment_method)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate" title={formatDateTime(payment.created_at)}>
                              {formatDateTime(payment.created_at)}
                            </p>
                            {payment.notes && (
                              <p className="text-xs text-muted-foreground italic truncate" title={payment.notes}>
                                “{payment.notes}”
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-mono font-medium text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap shrink-0">
                          +{formatCurrency(payment.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {paymentsPage < paymentsTotalPages && (
                    <div className="flex justify-center pt-2 pb-4">
                      <Button variant="outline" size="sm" onClick={loadMorePayments} disabled={paymentsLoadingMore} aria-busy={paymentsLoadingMore || undefined}>
                        {paymentsLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
                        {paymentsLoadingMore ? "Cargando…" : "Cargar más pagos"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
      <TransactionDetailsDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        transaction={selectedTransaction}
        hideCustomerName={true}
        onVoidSuccess={handleVoidSuccess}
      />
    </Dialog>
  );
}
