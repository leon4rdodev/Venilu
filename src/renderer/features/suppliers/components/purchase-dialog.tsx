import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Switch } from "@components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { PackagePlus, Search, Trash2, Banknote, ArrowLeftRight, HandCoins, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ipc } from "@lib/ipc";
import { cn } from "@lib/utils";
import { formatCurrency, getCurrencySymbol } from "@lib/currency";
import { round2 } from "@shared/money";
import { Product, Purchase, Supplier } from "@shared/types/models";
import { useShift } from "@renderer/features/pos/hooks/use-shift";
import { usePermission } from "@renderer/features/auth/hooks/use-permission";
import { PERMISSIONS } from "@shared/permissions";
import type { IpcResult } from "../types";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Suplidor preseleccionado (desde su ficha). */
  supplier?: Supplier | null;
  onCreated: (purchase: Purchase) => void;
}

interface Line {
  product_id: string;
  product_name: string;
  current_stock: number;
  current_cost: number | null;
  quantity: string;
  unit_cost: string;
}

type PayMethod = "cash" | "transfer" | "credit";

const todayPlus = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Registro de una compra: líneas de producto (entran al inventario), forma
 * de pago (contado o a crédito del suplidor) y actualización de costos.
 */
export function PurchaseDialog({ open, onOpenChange, supplier: presetSupplier = null, onCreated }: PurchaseDialogProps) {
  const { activeShift, fetchActiveShift } = useShift();
  const canSeeCosts = usePermission(PERMISSIONS.INV_VIEW_COSTS);

  const [supplierId, setSupplierId] = useState<string>(presetSupplier?.id ?? "");
  const [invoice, setInvoice] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [updateCosts, setUpdateCosts] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setSupplierId(presetSupplier?.id ?? "");
    setInvoice(""); setNotes(""); setLines([]); setMethod("cash"); setAmountPaid("");
    setDueDate(""); setUpdateCosts(true); setProductSearch(""); setError(null);
    const id = setTimeout(() => searchRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [open, presetSupplier?.id]);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers-active"],
    queryFn: async () => {
      const result = (await ipc.invoke("suppliers:active")) as IpcResult<Supplier[]>;
      if (!result.success) throw new Error(result.message);
      return result.data ?? [];
    },
    enabled: open,
  });
  const suppliers = suppliersQuery.data ?? [];
  const supplier = suppliers.find((s) => s.id === supplierId) ?? (presetSupplier?.id === supplierId ? presetSupplier : null);

  // Búsqueda de productos (misma base que Inventario)
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(productSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [productSearch]);
  const productsQuery = useQuery({
    queryKey: ["purchase-product-search", debounced],
    queryFn: async () => {
      const result = (await ipc.invoke("get-products", { page: 1, pageSize: 10, search: debounced })) as
        IpcResult<{ products: Product[] }>;
      if (!result.success) throw new Error(result.message);
      return result.data?.products ?? [];
    },
    enabled: open && debounced.length > 0,
  });
  const results = productsQuery.data ?? [];

  const addProduct = (p: Product) => {
    setLines((prev) => {
      if (prev.some((l) => l.product_id === p.id)) {
        return prev.map((l) => l.product_id === p.id ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l);
      }
      const cost = p.cost_price != null ? Number(p.cost_price) : null;
      return [...prev, {
        product_id: p.id, product_name: p.name, current_stock: Number(p.stock) || 0,
        current_cost: cost, quantity: "1", unit_cost: cost != null ? String(cost) : "",
      }];
    });
    setProductSearch("");
    searchRef.current?.focus();
  };

  const updateLine = (id: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => l.product_id === id ? { ...l, ...patch } : l));
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.product_id !== id));

  const total = useMemo(
    () => round2(lines.reduce((sum, l) => sum + (Number.parseInt(l.quantity, 10) || 0) * (Number.parseFloat(l.unit_cost) || 0), 0)),
    [lines],
  );
  const paid = method === "credit" ? 0 : amountPaid === "" ? total : (Number.parseFloat(amountPaid) || 0);
  const outstanding = round2(Math.max(0, total - paid));
  const creditDays = supplier?.credit_days ?? 0;
  const effectiveDue = dueDate || todayPlus(creditDays);

  const isLineValid = (l: Line) => {
    const q = Number.parseInt(l.quantity, 10); const c = Number.parseFloat(l.unit_cost);
    return Number.isInteger(q) && q > 0 && Number.isFinite(c) && c >= 0;
  };
  const linesValid = lines.length > 0 && lines.every(isLineValid);
  const needsShift = method === "cash" && paid > 0 && !activeShift;
  const canSubmit = !!supplierId && linesValid && !needsShift && paid <= total && paid >= 0 && !saving;

  // Solo presentación: por qué el botón principal sigue deshabilitado (HIG Feedback:
  // "muestra cuándo una orden no puede ejecutarse y ayuda a entender por qué").
  const blocker = saving || error
    ? null
    : !supplierId ? "Selecciona un suplidor para continuar."
    : lines.length === 0 ? "Agrega al menos un producto recibido."
    : !linesValid ? "Indica cantidad y costo unitario en los productos marcados."
    : null;
  const totalUnits = lines.reduce((sum, l) => sum + (Number.parseInt(l.quantity, 10) || 0), 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const result = (await ipc.invoke("purchases:create", {
        supplier_id: supplierId,
        invoice_number: invoice.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({ product_id: l.product_id, quantity: Number.parseInt(l.quantity, 10), unit_cost: Number.parseFloat(l.unit_cost) })),
        payment_method: method,
        amount_paid: method === "credit" ? 0 : paid,
        due_date: outstanding > 0 ? effectiveDue : null,
        update_costs: updateCosts,
      })) as IpcResult<Purchase>;
      if (!result.success || !result.data) {
        setError(result.message || "No se pudo registrar la compra");
        return;
      }
      toast.success("Compra registrada", {
        description: `#${result.data.id} · ${lines.length} producto${lines.length !== 1 ? "s" : ""} entraron al inventario`,
      });
      window.dispatchEvent(new Event("inventory-updated"));
      window.dispatchEvent(new Event("suppliers-updated"));
      if (method === "cash" && paid > 0) void fetchActiveShift();
      onCreated(result.data);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
              <PackagePlus className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">Nueva Compra</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            La mercancía entra al inventario al guardar; lo que no pagues queda como cuenta por pagar del suplidor.
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          {/* Suplidor + factura */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="purchase-supplier">Suplidor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={!!presetSupplier}>
                <SelectTrigger id="purchase-supplier" className="h-10 bg-background">
                  <SelectValue placeholder={suppliers.length === 0 && !presetSupplier ? "No hay suplidores activos" : "Selecciona un suplidor"} />
                </SelectTrigger>
                <SelectContent>
                  {(presetSupplier && !suppliers.some((s) => s.id === presetSupplier.id) ? [presetSupplier, ...suppliers] : suppliers).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.credit_days > 0 ? ` · ${s.credit_days} días` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-invoice">Factura / NCF del suplidor</Label>
              <Input id="purchase-invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Opcional" autoComplete="off" className="h-10" />
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-2 border-t border-border pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="purchase-product-search">Productos</Label>
              {lines.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{totalUnits} uds · {lines.length} línea{lines.length !== 1 ? "s" : ""}</span>}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              <Input
                id="purchase-product-search"
                ref={searchRef}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && results.length > 0) { e.preventDefault(); addProduct(results[0]); } }}
                placeholder="Buscar por nombre, SKU o código para agregar…"
                autoComplete="off"
                aria-describedby="purchase-product-search-help"
                className="h-10 pl-9 bg-background"
              />
              {debounced && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-md max-h-56 overflow-y-auto" aria-label="Resultados de productos" aria-live="polite">
                  {productsQuery.isPending ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados para «{debounced}»</p>
                  ) : results.map((p, index) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 outline-none transition-colors",
                        index === 0 && "bg-muted/30",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="font-medium truncate block" title={p.name}>{p.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{p.sku || p.barcode || "Sin código"} · stock {p.stock}{index === 0 ? " · Enter para agregar" : ""}</span>
                      </span>
                      {canSeeCosts && p.cost_price != null && (
                        <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">costo {formatCurrency(Number(p.cost_price))}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p id="purchase-product-search-help" className="text-xs text-muted-foreground">Escribe para buscar; con Enter agregas el primer resultado. Un producto repetido suma 1 a su cantidad.</p>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <caption className="sr-only">Productos recibidos en esta compra</caption>
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left font-medium px-3 py-2">Producto</th>
                    <th scope="col" className="text-right font-medium px-3 py-2 w-24">Cantidad</th>
                    <th scope="col" className="text-right font-medium px-3 py-2 w-32">Costo unit.</th>
                    <th scope="col" className="text-right font-medium px-3 py-2 w-28">Subtotal</th>
                    <th scope="col" className="w-10"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Busca y agrega los productos que recibiste.</td></tr>
                  ) : lines.map((l) => {
                    const q = Number.parseInt(l.quantity, 10) || 0; const c = Number.parseFloat(l.unit_cost) || 0;
                    const costChanged = l.current_cost != null && Number.isFinite(c) && round2(c) !== round2(l.current_cost);
                    const qInvalid = !(Number.isInteger(Number.parseInt(l.quantity, 10)) && Number.parseInt(l.quantity, 10) > 0);
                    const cInvalid = !(Number.isFinite(Number.parseFloat(l.unit_cost)) && Number.parseFloat(l.unit_cost) >= 0);
                    return (
                      <tr key={l.product_id} className={cn(!isLineValid(l) && "bg-destructive/5")}>
                        <td className="px-3 py-2">
                          <p className="font-medium truncate max-w-[260px]" title={l.product_name}>{l.product_name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Stock {l.current_stock} → {l.current_stock + q}
                            {costChanged && updateCosts && canSeeCosts && (
                              <span className="ml-2 text-amber-600 dark:text-amber-400">costo {formatCurrency(l.current_cost!)} → {formatCurrency(c)}</span>
                            )}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="1" step="1" inputMode="numeric" value={l.quantity} onChange={(e) => updateLine(l.product_id, { quantity: e.target.value.replace(/\D/g, "") })} className="h-8 text-right tabular-nums" aria-label={`Cantidad de ${l.product_name}`} aria-invalid={qInvalid || undefined} />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="0.01" inputMode="decimal" value={l.unit_cost} onChange={(e) => updateLine(l.product_id, { unit_cost: e.target.value })} className="h-8 text-right tabular-nums" placeholder="0.00" aria-label={`Costo unitario de ${l.product_name}`} aria-invalid={cInvalid || undefined} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">{formatCurrency(round2(q * c))}</td>
                        <td className="px-1 py-2 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLine(l.product_id)} title="Quitar" aria-label={`Quitar ${l.product_name}`}>
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lines.length > 0 && !linesValid && (
              <p role="alert" className="text-xs text-destructive px-1">Indica cantidad (entera, mayor que 0) y costo unitario en los productos marcados.</p>
            )}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
              <div className="min-w-0">
                <Label htmlFor="purchase-update-costs" className="text-sm font-medium cursor-pointer">Actualizar costo de los productos</Label>
                <p className="text-xs text-muted-foreground mt-1">Usa el costo de esta compra como nuevo costo (afecta márgenes en reportes)</p>
              </div>
              <Switch id="purchase-update-costs" checked={updateCosts} onCheckedChange={setUpdateCosts} aria-label="Actualizar costos" />
            </div>
          </div>

          {/* Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-5">
            <div className="space-y-2">
              <p id="purchase-method-label" className="flex items-center text-sm leading-none font-medium select-none">Forma de pago</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="purchase-method-label">
                {([["cash", "Efectivo", Banknote], ["transfer", "Transferencia", ArrowLeftRight], ["credit", "A crédito", HandCoins]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={method === id}
                    onClick={() => setMethod(id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 h-14 rounded-lg border text-xs font-medium transition-colors outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring",
                      method === id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {label}
                  </button>
                ))}
              </div>
              {method !== "credit" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="purchase-paid" className="text-xs text-muted-foreground">Monto pagado ahora</Label>
                    <button type="button" className="text-xs font-semibold hover:underline rounded-sm disabled:opacity-50" onClick={() => setAmountPaid("")} disabled={amountPaid === ""}>Pagar completo</button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{getCurrencySymbol()}</span>
                    <Input
                      id="purchase-paid"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={paid > total || undefined}
                      aria-describedby={paid > total ? "purchase-paid-error" : undefined}
                      value={amountPaid}
                      placeholder={total.toFixed(2)}
                      onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setAmountPaid(v); }}
                      className="h-10 pl-12 text-right font-mono tabular-nums"
                    />
                  </div>
                  {paid > total && <p id="purchase-paid-error" role="alert" className="text-xs text-destructive px-1">No puede superar el total de la compra ({formatCurrency(total)}).</p>}
                </div>
              )}
              {needsShift && (
                <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  El efectivo sale de tu caja: abre un turno en el POS o paga por transferencia / a crédito.
                </div>
              )}
              {method === "cash" && paid > 0 && activeShift && (
                <p className="text-xs text-muted-foreground">Se registrará como salida de caja de tu turno.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="flex items-center text-sm leading-none font-medium select-none">Resumen</p>
              <div className="rounded-lg border border-border divide-y divide-border text-sm">
                <div className="flex justify-between px-3.5 py-2"><span className="text-muted-foreground">Productos</span><span className="tabular-nums">{totalUnits} uds · {lines.length} línea{lines.length !== 1 ? "s" : ""}</span></div>
                <div className="flex justify-between px-3.5 py-2 bg-muted/40"><span className="font-semibold">Total compra</span><span className="font-mono font-semibold tabular-nums">{formatCurrency(total)}</span></div>
                <div className="flex justify-between px-3.5 py-2"><span className="text-muted-foreground">Pagado ahora</span><span className="font-mono tabular-nums">{formatCurrency(Math.min(paid, total))}</span></div>
                <div className="flex justify-between px-3.5 py-2"><span className={cn("text-muted-foreground", outstanding > 0 && "text-amber-600 dark:text-amber-400")}>Queda a crédito</span><span className={cn("font-mono tabular-nums", outstanding > 0 && "text-amber-600 dark:text-amber-400 font-semibold")}>{formatCurrency(outstanding)}</span></div>
              </div>
              {outstanding > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="purchase-due" className="text-xs text-muted-foreground">
                    Vence el {creditDays > 0 ? `(${creditDays} días de crédito del suplidor)` : "(suplidor de contado)"}
                  </Label>
                  <Input id="purchase-due" type="date" value={effectiveDue} onChange={(e) => setDueDate(e.target.value)} className="h-10 tabular-nums" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase-notes">Nota <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input id="purchase-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Camión, condiciones, faltantes…" autoComplete="off" className="h-10" />
          </div>

          {error && (
            <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 border-t border-border shrink-0 space-y-3">
          {blocker && <p className="text-xs text-muted-foreground text-center" aria-live="polite">{blocker}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 h-10">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1 h-10" aria-busy={saving}>
              <PackagePlus className="h-4 w-4" strokeWidth={1.75} />
              {saving ? "Guardando..." : `Registrar compra · ${formatCurrency(total)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
