import { CreditCard, ShoppingBag, Trash2, Lock, Pause, PauseCircle, User2, X } from "lucide-react";
import { CartItem, CartItemType } from "./cart-item";
import { PaymentDialog } from "./payment-dialog";
import { ParkedSalesDialog } from "./parked-sales-dialog";
import { formatCurrency, getCurrencySymbol } from "@lib/currency";
import { useSettings } from "@renderer/features/settings";
import { round2 } from "@shared/money";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { PaymentMethod, Customer } from "@shared/types/models";
import { usePermission } from "@renderer/features/auth/hooks/use-permission";
import { cn } from "@lib/utils";
import type { ParkedSale, FiscalData } from "../hooks/use-cart";

interface CartProps {
  cart: CartItemType[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onSetQuantity: (id: string, qty: number) => boolean;
  onRemoveFromCart: (id: string) => void;
  onClearCart: () => void;
  discountAmount: number;
  setDiscountAmount: (val: number) => void;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onProcessSale: (paymentMethod: PaymentMethod, amountPaid: number, changeGiven: number, fiscal?: FiscalData) => Promise<{ success: boolean, saleId?: string, ncf?: string, message?: string }>;
  parkedSales: ParkedSale[];
  onParkSale: () => void;
  onResumeParked: (id: string) => void;
  onRemoveParked: (id: string) => void;
  /** Controlled from POSInterface so the F2/F4 shortcuts can open them */
  paymentDialogOpen: boolean;
  onPaymentDialogOpenChange: (open: boolean) => void;
  parkedDialogOpen: boolean;
  onParkedDialogOpenChange: (open: boolean) => void;
}

export default function Cart({
  cart,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveFromCart,
  onClearCart,
  discountAmount,
  setDiscountAmount,
  selectedCustomer,
  onSelectCustomer,
  onProcessSale,
  parkedSales,
  onParkSale,
  onResumeParked,
  onRemoveParked,
  paymentDialogOpen,
  onPaymentDialogOpenChange,
  parkedDialogOpen,
  onParkedDialogOpenChange,
}: CartProps) {
  const canDiscount = usePermission('pos:apply_discount');
  const { settings } = useSettings();
  const subtotal = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Desglose de ITBIS (incluido en los precios) — solo con facturación activa.
  // Espeja el cálculo del backend: exentos en 0 y descuento prorrateado.
  const fiscalEnabled = !!settings?.fiscal_enabled;
  const itbisRate = Number(settings?.itbis_rate ?? 18);
  const taxedAmount = cart.reduce(
    (sum, item) => sum + (item.itbis_exempt ? 0 : item.sale_price * item.quantity), 0,
  );
  const discountFactor = subtotal > 0 ? total / subtotal : 1;
  const itbisIncluded = round2(taxedAmount * discountFactor * itbisRate / (100 + itbisRate));

  return (
    <div className="w-96">
      <div
        className="flex flex-col border border-border rounded-lg bg-card overflow-hidden"
        style={{ height: "clamp(500px, calc(100vh - 6.5rem), 720px)" }}
      >
        {/* HEADER */}
        <div className="shrink-0 px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Pedido Actual</h2>
            <p className="text-xs text-muted-foreground truncate tabular-nums">
              {cart.length === 0
                ? "Sin artículos"
                : `${totalItems} artículo${totalItems !== 1 ? 's' : ''} • ${cart.length} producto${cart.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* On-hold tickets */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 min-w-9 px-2.5 gap-1 text-xs",
                parkedSales.length > 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onParkedDialogOpenChange(true)}
              title="Ventas en espera (F4)"
              aria-label={
                parkedSales.length > 0
                  ? `Ventas en espera (${parkedSales.length})`
                  : "Ventas en espera"
              }
            >
              <PauseCircle className="h-4 w-4" strokeWidth={1.75} />
              {parkedSales.length > 0 && (
                <span className="font-semibold tabular-nums">{parkedSales.length}</span>
              )}
            </Button>
            {cart.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={onParkSale}
                  title="Poner esta venta en espera (F3)"
                  aria-label="Poner esta venta en espera"
                >
                  <Pause className="h-4 w-4" strokeWidth={1.75} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={onClearCart}
                  title="Vaciar carrito"
                  aria-label="Vaciar carrito"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Attached customer chip */}
        {selectedCustomer && (
          <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/40 flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted shrink-0">
              <User2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <span className="font-medium truncate flex-1 min-w-0" title={selectedCustomer.name}>
              {selectedCustomer.name}
            </span>
            {Number(selectedCustomer.balance) > 0 && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap font-mono tabular-nums">
                Deuda {formatCurrency(Number(selectedCustomer.balance))}
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelectCustomer(null)}
              className="flex h-7 w-7 -mr-1 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
              title="Quitar cliente"
              aria-label={`Quitar cliente ${selectedCustomer.name}`}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* CONTENIDO SCROLLEABLE */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 text-center" role="status">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <ShoppingBag className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground">Carrito vacío</p>
              <p className="text-xs text-muted-foreground mt-1">Toca un producto para agregarlo</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onSetQuantity={onSetQuantity}
                  onRemoveFromCart={onRemoveFromCart}
                />
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-border bg-card p-4 space-y-3">
          {/* Subtotal, Descuento e ITBIS — una sola pila con ritmo de 8px */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground font-mono tabular-nums">
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className={cn("flex justify-between items-center text-sm gap-3", !canDiscount && "opacity-60")}>
              <label
                htmlFor="pos-cart-discount"
                className="flex items-center gap-1.5 text-muted-foreground"
                title={canDiscount ? undefined : "Sin permiso para aplicar descuentos"}
              >
                Descuento
                {!canDiscount && <Lock className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />}
              </label>
              <div className="flex items-center gap-1.5 w-28">
                <span id="pos-cart-discount-currency" className="text-muted-foreground text-xs shrink-0">
                  {getCurrencySymbol()}
                </span>
                <Input
                  id="pos-cart-discount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={subtotal}
                  step="0.01"
                  disabled={!canDiscount}
                  aria-describedby="pos-cart-discount-currency"
                  value={discountAmount === 0 ? "" : discountAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val < 0) {
                      setDiscountAmount(0);
                    } else if (val > subtotal) {
                      setDiscountAmount(subtotal);
                    } else {
                      setDiscountAmount(val);
                    }
                  }}
                  className={cn(
                    "h-9 text-right text-xs bg-background font-mono tabular-nums",
                    !canDiscount && "cursor-not-allowed"
                  )}
                  placeholder={canDiscount ? "0.00" : "Bloqueado"}
                />
              </div>
            </div>

            {fiscalEnabled && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  ITBIS incluido ({itbisRate % 1 === 0 ? itbisRate : itbisRate.toFixed(2)}%)
                </span>
                <span className="text-muted-foreground font-mono tabular-nums">
                  {formatCurrency(itbisIncluded)}
                </span>
              </div>
            )}
          </div>

          <div className="w-full h-px bg-border" role="separator" />

          {/* Total */}
          <div className="flex justify-between items-baseline gap-3">
            <span className="text-sm font-medium text-muted-foreground">Total a pagar</span>
            <span
              className="text-2xl font-semibold tracking-tight tabular-nums text-foreground truncate"
              title={formatCurrency(total)}
              aria-live="polite"
              aria-atomic="true"
            >
              {formatCurrency(total)}
            </span>
          </div>

          {/* Botón de pago */}
          <Button
            className="w-full h-11 text-base font-semibold gap-2"
            disabled={cart.length === 0}
            onClick={() => onPaymentDialogOpenChange(true)}
            title={cart.length === 0 ? "Agrega productos para cobrar" : undefined}
          >
            <CreditCard className="h-5 w-5" strokeWidth={1.75} />
            Proceder al Pago
            <kbd className="ml-1 rounded-md border border-primary-foreground/30 px-1.5 py-0.5 text-[10px] font-mono font-medium leading-none opacity-80">
              F2
            </kbd>
          </Button>
        </div>
      </div>

      {/* Diálogo de Pago */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={onPaymentDialogOpenChange}
        subtotal={subtotal}
        discountAmount={discountAmount}
        total={total}
        itbisIncluded={fiscalEnabled ? itbisIncluded : undefined}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={onSelectCustomer}
        onComplete={async (paymentMethod, amountPaid, changeGiven, fiscal) => {
          const result = await onProcessSale(paymentMethod as PaymentMethod, amountPaid, changeGiven, fiscal);
          return result;
        }}
      />

      {/* Ventas en espera */}
      <ParkedSalesDialog
        open={parkedDialogOpen}
        onOpenChange={onParkedDialogOpenChange}
        parkedSales={parkedSales}
        onResume={onResumeParked}
        onRemove={onRemoveParked}
      />
    </div>
  );
}
