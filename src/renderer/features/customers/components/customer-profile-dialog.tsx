import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@lib/currency";
import { formatDateTime, formatPhone } from "@lib/formatters";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@components/ui/dialog";
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
import { ShoppingBag, HandCoins, User, Phone, Mail, MapPin, FileText, ArrowRightLeft, CreditCard, Banknote, Eye, Receipt, CalendarClock, LucideIcon } from "lucide-react";
import { cn } from "@lib/utils";

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
    <div className="bg-card border border-border rounded-lg p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{label}</span>
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
  const creditFillClass =
    creditUsedRatio >= 1 ? "bg-destructive" : creditUsedRatio > 0.7 ? "bg-amber-500" : "bg-primary";
  const hasCreditActivity = effBalance > 0 || sales.some((s) => s.payment_method === "credit");

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
      case 'credit': return 'Credito';
      default: return method;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 pr-10 border-b border-border space-y-1 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" strokeWidth={1.75} />
                </span>
                {localCustomer.name}
              </DialogTitle>
              {canViewBalance && isOverLimit && (
                <span className="w-fit mt-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                  Límite excedido
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              {localCustomer.phone ? (
                <span className="text-sm font-medium">{formatPhone(localCustomer.phone)}</span>
              ) : (
                <span className="text-sm italic text-muted-foreground">No registrado</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" strokeWidth={1.75} />
              <span className="truncate">{localCustomer.email || 'Sin correo'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" strokeWidth={1.75} />
              <span className="truncate">{localCustomer.address || 'Sin dirección'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              <span className="truncate">{localCustomer.notes || 'Sin notas'}</span>
            </div>
          </div>

          <div className={cn("grid gap-2 mt-6 pt-4 border-t border-border", canViewBalance ? "grid-cols-5" : "grid-cols-2")}>
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
                    ? "text-emerald-600 dark:text-emerald-400"
                    : undefined
                }
              />
            )}
          </div>

          {canViewBalance && effCreditLimit !== null && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <span className="text-xs font-medium text-muted-foreground">Crédito</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-muted-foreground whitespace-nowrap truncate">
                  Usado {formatCurrency(effBalance)} de {formatCurrency(effCreditLimit)} · Disponible {formatCurrency(creditAvailable ?? 0)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", creditFillClass)}
                  style={{ width: `${Math.min(Math.max(creditUsedRatio, 0), 1) * 100}%` }}
                />
              </div>
            </div>
          )}
          {canViewBalance && effCreditLimit === null && hasCreditActivity && (
            <p className="mt-3 text-xs font-medium text-muted-foreground">Crédito ilimitado</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6 pt-4">
          <Tabs defaultValue="sales" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sales" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
                Historial de Compras ({sales.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <HandCoins className="h-4 w-4" strokeWidth={1.75} />
                Historial de Pagos ({payments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="flex-1 overflow-y-auto mt-4 pr-2 space-y-2">
              {isLoading ? (
                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3">
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
              ) : sales.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 mb-2 opacity-20" strokeWidth={1.75} />
                  <p className="text-sm font-medium">No hay compras registradas</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                   {sales.map((sale) => {
                    const isVoided = sale.status === 'voided';
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => handleViewTransaction(sale)}
                        className={cn(
                          "group w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-card hover:bg-accent/40 transition-colors cursor-pointer",
                          isVoided && "opacity-60 bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            {getPaymentMethodIcon(sale.payment_method)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-semibold text-sm", isVoided && "line-through")}>
                                Venta #{sale.id.slice(0, 8)}...
                              </span>
                              {isVoided ? (
                                <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-500/10 text-red-600 dark:text-red-400">
                                  Anulada
                                </span>
                              ) : (
                                sale.payment_method === 'credit' && (
                                  sale.status === 'paid' ? (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                      Crédito — Pagado
                                    </span>
                                  ) : sale.status === 'partial' ? (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                      Crédito — Parcial
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-500/10 text-red-600 dark:text-red-400">
                                      Crédito — Pendiente
                                    </span>
                                  )
                                )
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(sale.created_at)} • {getPaymentMethodLabel(sale.payment_method)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:mt-0 sm:text-right flex items-center justify-between sm:block">
                          <span className={cn("text-sm font-mono font-medium tabular-nums ml-11 sm:ml-0 flex items-center gap-2", isVoided && "line-through text-muted-foreground")}>
                            <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.75} />
                            {formatCurrency(sale.total_amount)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  </div>
                  {salesPage < salesTotalPages && (
                    <div className="flex justify-center pt-2 pb-6">
                      <Button variant="outline" size="sm" onClick={loadMoreSales} disabled={salesLoadingMore}>
                        Cargar más
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="payments" className="flex-1 overflow-y-auto mt-4 pr-2 space-y-2">
              {isLoading ? (
                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3">
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
              ) : payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <HandCoins className="h-8 w-8 mb-2 opacity-20" strokeWidth={1.75} />
                  <p className="text-sm font-medium">No hay pagos registrados</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {getPaymentMethodIcon(payment.payment_method)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">Abono</span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {getPaymentMethodLabel(payment.payment_method)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(payment.created_at)}
                          </p>
                          {payment.notes && (
                            <p className="text-xs mt-1 text-muted-foreground italic">
                              "{payment.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 sm:mt-0 sm:text-right flex items-center justify-between sm:block">
                        <span className="text-sm font-mono font-medium text-emerald-600 dark:text-emerald-400 tabular-nums ml-11 sm:ml-0">
                          +{formatCurrency(payment.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  </div>
                  {paymentsPage < paymentsTotalPages && (
                    <div className="flex justify-center pt-2 pb-6">
                      <Button variant="outline" size="sm" onClick={loadMorePayments} disabled={paymentsLoadingMore}>
                        Cargar más
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
