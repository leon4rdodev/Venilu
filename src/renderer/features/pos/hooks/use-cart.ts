import { useState, useCallback, useRef } from "react";
import { Product, PaymentMethod, Customer } from "@shared/types/models";
import { CartItemType } from "../components/cart-item";
import { toast } from "sonner";
import { round2 } from "@shared/money";
import { useShift } from "./use-shift";

/** A parked ("on hold") ticket — mature-POS feature to serve another customer mid-sale. */
export interface ParkedSale {
  id: string;
  createdAt: number;
  cart: CartItemType[];
  discountAmount: number;
  customer: Customer | null;
}

const PARKED_KEY = "venilu_parked_sales";

function readParkedSales(): ParkedSale[] {
  try {
    const raw = window.localStorage.getItem(PARKED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCart() {
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { activeShift, addSaleToShift, fetchActiveShift } = useShift();

  // Ref mirror of the cart so addToCart/updateQuantity can be IDENTITY-STABLE
  // (empty deps) — this lets memoized product cards skip re-renders while the
  // stock checks still read fresh state.
  const cartRef = useRef(cart);
  cartRef.current = cart;

  const addToCart = useCallback((product: Product) => {
    // Stock check uses the product's own snapshot — with server-side pagination
    // the full catalog is no longer guaranteed to be in memory.
    const existing = cartRef.current.find((item) => item.id === product.id);
    const currentQty = existing?.quantity ?? 0;

    if (currentQty + 1 > product.stock) {
      toast.error("Sin stock suficiente", {
        description: `Solo quedan ${product.stock} unidades de ${product.name}.`,
      });
      return;
    }

    setCart((prev) => {
      const found = prev.find((item) => item.id === product.id);
      if (found) {
        if (found.quantity + 1 > product.stock) return prev;
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, category: product.category || null }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    const item = cartRef.current.find((i) => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + delta);
    if (newQuantity > item.stock) {
      toast.error("Sin stock suficiente", {
        description: `Solo quedan ${item.stock} unidades de ${item.name}.`,
      });
      return;
    }

    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: newQuantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setSelectedCustomer(null);
  }, []);

  // ─── Parked (on hold) sales ────────────────────────────────────────────────

  const [parkedSales, setParkedSales] = useState<ParkedSale[]>(readParkedSales);

  const persistParked = useCallback((list: ParkedSale[]) => {
    setParkedSales(list);
    try {
      window.localStorage.setItem(PARKED_KEY, JSON.stringify(list));
    } catch {
      /* best-effort persistence */
    }
  }, []);

  /** Parks the current ticket (cart + discount + customer) and clears the cart. */
  const parkSale = useCallback(() => {
    const current = cartRef.current;
    if (current.length === 0) return;

    const entry: ParkedSale = {
      id: Math.random().toString(36).slice(2, 8).toUpperCase(),
      createdAt: Date.now(),
      cart: current,
      discountAmount,
      customer: selectedCustomer,
    };
    persistParked([entry, ...parkedSales]);
    clearCart();
    toast.success("Venta puesta en espera", {
      description: `Ticket ${entry.id} — reanúdalo cuando quieras.`,
    });
  }, [discountAmount, selectedCustomer, parkedSales, persistParked, clearCart]);

  /** Restores a parked ticket into the cart (requires the current cart to be empty). */
  const resumeParkedSale = useCallback((id: string) => {
    if (cartRef.current.length > 0) {
      toast.error("Carrito ocupado", {
        description: "Cobra, vacía o pon en espera la venta actual antes de reanudar otra.",
      });
      return;
    }
    const entry = parkedSales.find((p) => p.id === id);
    if (!entry) return;

    setCart(entry.cart);
    setDiscountAmount(entry.discountAmount);
    setSelectedCustomer(entry.customer);
    persistParked(parkedSales.filter((p) => p.id !== id));
    toast.success(`Ticket ${entry.id} reanudado`);
  }, [parkedSales, persistParked]);

  const removeParkedSale = useCallback((id: string) => {
    persistParked(parkedSales.filter((p) => p.id !== id));
  }, [parkedSales, persistParked]);

  const handleProcessSale = useCallback(
    async (
      paymentMethod: PaymentMethod,
      amountPaid: number,
      changeGiven: number,
      onSuccess: () => void
    ): Promise<{ success: boolean; saleId?: string; message?: string }> => {
      if (!activeShift) {
        toast.error("No hay turno activo", {
          description: "No se puede procesar la venta porque no hay un turno abierto.",
        });
        return { success: false, message: "No active shift." };
      }

      if (paymentMethod === 'credit' && !selectedCustomer) {
        toast.error("Cliente requerido", {
          description: "Selecciona un cliente para ventas a crédito.",
        });
        return { success: false, message: "Se requiere un cliente para ventas a crédito." };
      }

      const subtotal = round2(cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0));
      const totalAmount = round2(Math.max(0, subtotal - discountAmount));

      const saleItems = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));

      // The server recomputes all totals and attributes the sale to the session
      // user — we only send the operational fields.
      const saleData: Record<string, any> = {
        shift_id: activeShift.id,
        discount_amount: round2(discountAmount),
        payment_method: paymentMethod,
        amount_paid: round2(amountPaid),
        change_given: round2(changeGiven),
      };

      if (selectedCustomer) {
        saleData.customer_id = selectedCustomer.id;
      }

      try {
        const result = (await window.ipcRenderer.invoke("process-sale", { saleData, saleItems })) as {
          success: boolean;
          saleId?: string;
          message?: string;
        };

        if (result.success) {
          const isCredit = paymentMethod === 'credit';
          toast.success(isCredit ? "Venta a crédito registrada" : "Venta exitosa", {
            description: isCredit
              ? `Venta #${result.saleId} registrada a crédito para ${selectedCustomer?.name}.`
              : `Venta #${result.saleId} procesada correctamente.`,
          });
          addSaleToShift({
            total_amount: totalAmount,
            payment_method: paymentMethod,
            status: isCredit ? 'credit' : 'paid',
          });
          clearCart();
          onSuccess();
          return { success: true, saleId: result.saleId };
        } else {
          // Stale shift (e.g. after a backup restore replaced the DB): re-sync
          // so the POS shows the real state instead of a ghost open shift.
          if (result.message?.includes("Shift is not open") || result.message?.includes("turno no pertenece")) {
            toast.error("El turno ya no es válido", {
              description: "Se actualizó el estado de la caja. Abre un turno para continuar.",
            });
            void fetchActiveShift();
            return { success: false, message: result.message };
          }
          toast.error("Error al procesar venta", { description: result.message });
          return { success: false, message: result.message };
        }
      } catch (error: any) {
        console.error("Error processing sale:", error);
        toast.error("Error inesperado", {
          description: "Ocurrió un error al intentar procesar la venta.",
        });
        return { success: false, message: error.message || "Ocurrió un error inesperado." };
      }
    },
    [activeShift, cart, discountAmount, selectedCustomer, addSaleToShift, clearCart, fetchActiveShift]
  );

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    handleProcessSale,
    discountAmount,
    setDiscountAmount,
    selectedCustomer,
    setSelectedCustomer,
    parkedSales,
    parkSale,
    resumeParkedSale,
    removeParkedSale,
  };
}
