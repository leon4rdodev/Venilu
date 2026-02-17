
import { useState } from "react";
import { CreditCard, ShoppingBag, Trash2 } from "lucide-react";
import { CartItem, CartItemType } from "./cart-item";
import { PaymentDialog } from "./payment-dialog";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";

interface CartProps {
  cart: CartItemType[];
  onUpdateQuantity: (id: number, delta: number) => void;
  onRemoveFromCart: (id: number) => void;
  onClearCart: () => void;
  onProcessSale: (paymentMethod: string, amountPaid: number, changeGiven: number) => Promise<{ success: boolean, saleId?: string, message?: string }>;
}

export default function Cart({
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
  onProcessSale,
}: CartProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="w-96">
      <div
        className="flex flex-col border rounded-xl bg-card shadow-md overflow-hidden"
        style={{ height: "clamp(500px, calc(100vh - 7rem), 700px)" }}
      >
        {/* HEADER */}
        <div className="shrink-0 px-4 py-3 border-b bg-background flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Pedido Actual</h2>
            <p className="text-xs text-muted-foreground">
              {cart.length === 0
                ? "Sin artículos"
                : `${totalItems} artículo${totalItems !== 1 ? 's' : ''} • ${cart.length} producto${cart.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={onClearCart}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Vaciar
            </Button>
          )}
        </div>

        {/* CONTENIDO SCROLLEABLE */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4 text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium">Carrito vacío</p>
              <p className="text-xs mt-1">Toca un producto para agregarlo</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemoveFromCart={onRemoveFromCart}
                />
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t bg-background p-4 space-y-3">
          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-primary tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          {/* Botón de pago */}
          <Button
            className="w-full h-11 text-base font-semibold gap-2"
            disabled={cart.length === 0}
            onClick={() => setPaymentDialogOpen(true)}
          >
            <CreditCard className="h-5 w-5" />
            Proceder al Pago
          </Button>
        </div>
      </div>

      {/* Diálogo de Pago */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        total={total}
        onComplete={async (paymentMethod, amountPaid, changeGiven) => {
          const result = await onProcessSale(paymentMethod, amountPaid, changeGiven);
          return result;
        }}
      />
    </div>
  );
}
