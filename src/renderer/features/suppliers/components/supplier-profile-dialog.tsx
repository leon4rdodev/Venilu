import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { Truck, Phone, Mail, MapPin, FileText, User, HandCoins, ShoppingCart, CalendarClock, CalendarDays, Banknote, ArrowLeftRight, CircleDollarSign, LucideIcon } from "lucide-react";
import { EmptyState } from "@renderer/shared/components/empty-state";
import { ipc } from "@lib/ipc";
import { cn } from "@lib/utils";
import { formatCurrency } from "@lib/currency";
import { formatDateTime, formatPhone, formatRNC } from "@lib/formatters";
import { Supplier, SupplierPayment } from "@shared/types/models";
import { usePermission } from "@renderer/features/auth/hooks/use-permission";
import { PERMISSIONS } from "@shared/permissions";
import { PurchasesTable } from "./purchases-table";
import type { IpcResult, SupplierSummary, SupplierPaymentsResult } from "../types";

const TAB_TRIGGER_CLASS = "flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-1 pb-3 text-sm font-medium text-muted-foreground gap-2 shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent";

function MiniStat({ icon: Icon, label, value, loading, className }: { icon: LucideIcon; label: string; value: string | number; loading: boolean; className?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{label}</span>
      </div>
      {loading ? <Skeleton className="h-5 w-16" /> : <p className={cn("text-sm font-semibold tracking-tight font-mono tabular-nums truncate", className)} title={String(value)}>{value}</p>}
    </div>
  );
}

interface SupplierProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onPay?: (supplier: Supplier) => void;
}

export function SupplierProfileDialog({ open, onOpenChange, supplier, onPay }: SupplierProfileDialogProps) {
  const canPay = usePermission(PERMISSIONS.SUP_PAY);
  const [tab, setTab] = useState("purchases");

  const summaryQuery = useQuery({
    queryKey: ["supplier-summary", supplier?.id],
    queryFn: async () => {
      const result = (await ipc.invoke("suppliers:summary", supplier!.id)) as IpcResult<SupplierSummary>;
      if (!result.success || !result.data) throw new Error(result.message);
      return result.data;
    },
    enabled: open && !!supplier,
  });
  const summary = summaryQuery.data;

  const paymentsQuery = useQuery({
    queryKey: ["supplier-payments", supplier?.id],
    queryFn: async () => (await ipc.invoke("suppliers:payments", { supplierId: supplier!.id, page: 1, limit: 30 })) as SupplierPaymentsResult,
    enabled: open && !!supplier,
  });
  const payments: SupplierPayment[] = paymentsQuery.data?.success ? paymentsQuery.data.data ?? [] : [];

  if (!supplier) return null;
  const balance = summary?.balance ?? (Number(supplier.balance) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground shrink-0">
                <Truck className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-tight truncate flex items-center gap-2">
                  {supplier.name}
                  {!supplier.active && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Inactivo</span>}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                  {supplier.rnc && <span className="inline-flex items-center gap-1 tabular-nums"><FileText className="h-3 w-3 shrink-0" aria-hidden="true" />RNC {formatRNC(supplier.rnc)}</span>}
                  {supplier.contact_name && <span className="inline-flex items-center gap-1 max-w-[220px]" title={`Contacto: ${supplier.contact_name}`}><User className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{supplier.contact_name}</span></span>}
                  {supplier.phone && <span className="inline-flex items-center gap-1 tabular-nums" title="Teléfono"><Phone className="h-3 w-3 shrink-0" aria-hidden="true" />{formatPhone(supplier.phone)}</span>}
                  {supplier.email && <span className="inline-flex items-center gap-1 max-w-[240px]" title={supplier.email}><Mail className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{supplier.email}</span></span>}
                  {supplier.address && <span className="inline-flex items-center gap-1 max-w-[320px]" title={supplier.address}><MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{supplier.address}</span></span>}
                  {!supplier.rnc && !supplier.contact_name && !supplier.phone && !supplier.email && !supplier.address && <span>Sin datos de contacto</span>}
                </DialogDescription>
              </div>
            </div>
            {canPay && balance > 0 && onPay && (
              <Button size="sm" className="h-9 shrink-0" onClick={() => onPay(supplier)}>
                <HandCoins className="h-4 w-4" strokeWidth={1.75} />
                Pagar
              </Button>
            )}
          </div>
          {supplier.notes && <p className="mt-3 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-wrap break-words">{supplier.notes}</p>}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MiniStat icon={CircleDollarSign} label="Cuenta por pagar" value={formatCurrency(balance)} loading={summaryQuery.isPending} className={balance > 0 ? "text-amber-600 dark:text-amber-400" : undefined} />
            <MiniStat icon={CalendarClock} label="Vencido" value={formatCurrency(summary?.overdueAmount ?? 0)} loading={summaryQuery.isPending} className={(summary?.overdueAmount ?? 0) > 0 ? "text-red-600 dark:text-red-400" : undefined} />
            <MiniStat icon={ShoppingCart} label="Compras" value={summary?.purchasesCount ?? 0} loading={summaryQuery.isPending} />
            <MiniStat icon={Banknote} label="Total comprado" value={formatCurrency(summary?.totalPurchased ?? 0)} loading={summaryQuery.isPending} />
            <MiniStat icon={HandCoins} label="Total pagado" value={formatCurrency(summary?.totalPaid ?? 0)} loading={summaryQuery.isPending} />
            <MiniStat icon={CalendarDays} label="Crédito" value={supplier.credit_days > 0 ? `${supplier.credit_days} días` : "Contado"} loading={false} />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full h-auto justify-start bg-transparent p-0 gap-6 rounded-none border-b border-border">
              <TabsTrigger value="purchases" className={TAB_TRIGGER_CLASS}>Compras ({summary?.purchasesCount ?? 0})</TabsTrigger>
              <TabsTrigger value="payments" className={TAB_TRIGGER_CLASS}>Pagos ({summary?.paymentsCount ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="purchases" className="pt-4">
              <PurchasesTable supplier={supplier} compact />
            </TabsContent>
            <TabsContent value="payments" className="pt-4">
              {paymentsQuery.isPending ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : payments.length === 0 ? (
                <div className="rounded-lg border border-border">
                  <EmptyState icon={HandCoins} title="No hay pagos registrados" description={balance > 0 ? "Los pagos que hagas a este suplidor aparecerán aquí" : "Este suplidor no tiene cuenta por pagar"} />
                </div>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0" title={p.payment_method === "cash" ? "Efectivo" : "Transferencia"} aria-hidden="true">
                        {p.payment_method === "cash" ? <Banknote className="h-4 w-4" strokeWidth={1.75} /> : <ArrowLeftRight className="h-4 w-4" strokeWidth={1.75} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.purchase_id ? `Pago de la compra #${p.purchase_id}` : "Abono a cuenta"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDateTime(p.created_at)} · {p.payment_method === "cash" ? "Efectivo" : "Transferencia"}{p.username ? ` · ${p.username}` : ""}{p.notes && !p.purchase_id ? ` · ${p.notes}` : ""}
                        </p>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">−{formatCurrency(Number(p.amount))}</span>
                    </div>
                  ))}
                  {(paymentsQuery.data?.total ?? 0) > payments.length && (
                    <p className="px-3.5 py-2 text-xs text-muted-foreground tabular-nums">Mostrando los {payments.length} pagos más recientes de {paymentsQuery.data?.total}.</p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
