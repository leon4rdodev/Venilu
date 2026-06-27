import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@lib/currency";
import { formatDateTime, formatPhone } from "@lib/formatters";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Spinner } from "@components/ui/spinner";
import { toast } from "sonner";
import { ipc } from "@lib/ipc";
import { Customer, Sale, DebtPayment } from "@shared/types/models";
import { TransactionDetailsDialog } from "@renderer/features/pos/components/transaction-details-dialog";
import { ShoppingBag, HandCoins, User, Phone, Mail, MapPin, FileText, ArrowRightLeft, CreditCard, Banknote, Eye } from "lucide-react";
import { cn } from "@lib/utils";

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
  }, [fetchHistoryData, fetchCustomer]);

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

  // Helpers for formatting
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'card': return <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'transfer': return <ArrowRightLeft className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      case 'credit': return <HandCoins className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
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
      <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 pr-10 border-b shrink-0 bg-muted/20">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <User className="h-6 w-6 text-primary" />
                {localCustomer.name}
              </DialogTitle>
              {isOverLimit && (
                <Badge variant="destructive" className="w-fit text-[10px] mt-1 uppercase tracking-wider">
                  Límite excedido
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {localCustomer.phone ? (
                <span className="text-sm font-medium">{formatPhone(localCustomer.phone)}</span>
              ) : (
                <span className="text-sm italic text-muted-foreground">No registrado</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{localCustomer.email || 'Sin correo'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{localCustomer.address || 'Sin dirección'}</span>
            </div>
            {localCustomer.rnc && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="truncate">RNC: {localCustomer.rnc}</span>
              </div>
            )}
            {localCustomer.business_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="truncate">{localCustomer.business_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="truncate">{localCustomer.notes || 'Sin notas'}</span>
            </div>
          </div>

          <div className="flex gap-6 mt-6 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total Comprado</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Límite de Crédito</p>
              <p className="text-lg font-semibold tabular-nums">
                {creditLimit !== null ? formatCurrency(creditLimit) : "Ilimitado"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Deuda Actual</p>
              <p className={cn("text-lg font-semibold tabular-nums", isOverLimit ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6 pt-4">
          <Tabs defaultValue="sales" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sales" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Historial de Compras ({sales.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <HandCoins className="h-4 w-4" />
                Historial de Pagos ({payments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="flex-1 overflow-y-auto mt-4 pr-2 space-y-2">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner className="h-8 w-8 text-primary" />
                </div>
              ) : sales.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No hay compras registradas</p>
                </div>
              ) : (
                <>
                   {sales.map((sale) => {
                    const isVoided = sale.status === 'voided';
                    return (
                      <button
                        key={sale.id}
                        type="button"
                        onClick={() => handleViewTransaction(sale)}
                        className={cn(
                          "group w-full text-left flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors cursor-pointer",
                          isVoided && "opacity-60 bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("mt-0.5 p-2 rounded-full", isVoided ? "bg-muted" : "bg-primary/10")}>
                            {getPaymentMethodIcon(sale.payment_method)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-semibold text-sm", isVoided && "line-through")}>
                                Venta #{sale.id.slice(0, 8)}...
                              </span>
                              {isVoided ? (
                                <Badge variant="destructive" className="text-[9px] h-4 px-1.5 uppercase tracking-tighter">
                                  Anulada
                                </Badge>
                              ) : (
                                sale.payment_method === 'credit' && (
                                  sale.status === 'paid' ? (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-green-500/10 text-green-600 border-green-500/20">
                                      Crédito — Pagado
                                    </Badge>
                                  ) : sale.status === 'partial' ? (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">
                                      Crédito — Parcial
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-red-500/10 text-red-600 border-red-500/20">
                                      Crédito — Pendiente
                                    </Badge>
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
                          <span className={cn("text-sm font-bold tabular-nums ml-11 sm:ml-0 flex items-center gap-2", isVoided && "line-through text-muted-foreground")}>
                            <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            {formatCurrency(sale.total_amount)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {salesPage < salesTotalPages && (
                    <div className="flex justify-center pt-2 pb-6">
                      <Button variant="outline" size="sm" onClick={loadMoreSales} disabled={salesLoadingMore}>
                        {salesLoadingMore ? <Spinner className="mr-2 h-4 w-4" /> : null}
                        Cargar más
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="payments" className="flex-1 overflow-y-auto mt-4 pr-2 space-y-2">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner className="h-8 w-8 text-primary" />
                </div>
              ) : payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                  <HandCoins className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No hay pagos registrados</p>
                </div>
              ) : (
                <>
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-2 rounded-full bg-green-500/10">
                          {getPaymentMethodIcon(payment.payment_method)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">Abono</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
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
                        <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums ml-11 sm:ml-0">
                          +{formatCurrency(payment.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {paymentsPage < paymentsTotalPages && (
                    <div className="flex justify-center pt-2 pb-6">
                      <Button variant="outline" size="sm" onClick={loadMorePayments} disabled={paymentsLoadingMore}>
                        {paymentsLoadingMore ? <Spinner className="mr-2 h-4 w-4" /> : null}
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
