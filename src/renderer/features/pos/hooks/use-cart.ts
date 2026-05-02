import { useState, useCallback } from "react";
import { Product, PaymentMethod, Customer } from "@shared/types/models";
import { CartItemType } from "../components/cart-item";
import { useToast } from "@renderer/features/layout";
import { useShift } from "./use-shift";

export function useCart() {
  const [cart, setCart] = useState<CartItemType[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();
  const { activeShift, addSaleToShift } = useShift();

  const addToCart = useCallback(
    (product: Product, products: Product[]) => {
      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        const productInStock = products.find((p) => p.id === product.id);

        if (!productInStock) {
          toast({ title: "Error", description: "Producto no encontrado.", variant: "destructive" });
          return prev;
        }

        if (existing) {
          if (existing.quantity + 1 > productInStock.stock) {
            toast({
              title: "Sin Stock Suficiente",
              description: `Solo quedan ${productInStock.stock} unidades de ${product.name}.`,
              variant: "destructive",
            });
            return prev;
          }
          return prev.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          if (productInStock.stock < 1) {
            toast({
              title: "Sin Stock Suficiente",
              description: `Solo quedan ${productInStock.stock} unidades de ${product.name}.`,
              variant: "destructive",
            });
            return prev;
          }
        }
        return [...prev, { ...product, quantity: 1, category: product.category || null }];
      });
    },
    [toast]
  );

  const updateQuantity = useCallback(
    (id: string, delta: number, products: Product[]) => {
      setCart((prev) =>
        prev
          .map((item) => {
            if (item.id === id) {
              const productInStock = products.find((p) => p.id === id);
              if (!productInStock) {
                toast({ title: "Error", description: "Producto no encontrado.", variant: "destructive" });
                return item;
              }
              const newQuantity = Math.max(0, item.quantity + delta);
              if (newQuantity > productInStock.stock) {
                toast({
                  title: "Sin Stock Suficiente",
                  description: `Solo quedan ${productInStock.stock} unidades de ${item.name}.`,
                  variant: "destructive",
                });
                return item;
              }
              return { ...item, quantity: newQuantity };
            }
            return item;
          })
          .filter((item) => item.quantity > 0)
      );
    },
    [toast]
  );

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setSelectedCustomer(null);
  }, []);

  const handleProcessSale = useCallback(
    async (
      paymentMethod: PaymentMethod,
      amountPaid: number,
      changeGiven: number,
      onSuccess: () => void
    ): Promise<{ success: boolean; saleId?: string; message?: string }> => {
      if (!activeShift) {
        toast({
          title: "Error: No hay turno activo",
          description: "No se puede procesar la venta porque no hay un turno abierto.",
          variant: "destructive",
        });
        return { success: false, message: "No active shift." };
      }

      // Credit sales require a customer
      if (paymentMethod === 'credit' && !selectedCustomer) {
        toast({
          title: "Cliente requerido",
          description: "Selecciona un cliente para ventas a crédito (Credito).",
          variant: "destructive",
        });
        return { success: false, message: "Se requiere un cliente para ventas a crédito." };
      }

      const subtotal = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
      const totalAmount = Math.max(0, subtotal - discountAmount);
      
      const saleItems = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        price_at_sale: item.sale_price,
      }));

      const saleData: Record<string, any> = {
        user_id: activeShift.user_id,
        shift_id: activeShift.id,
        subtotal: subtotal,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        change_given: changeGiven,
        sale_date: new Date().toISOString(),
      };

      // Add customer if selected
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
          toast({
            title: isCredit ? "Venta a Crédito Registrada" : "Venta Exitosa",
            description: isCredit
              ? `Venta #${result.saleId} registrada a crédito para ${selectedCustomer?.name}.`
              : `Venta #${result.saleId} procesada correctamente.`,
          });
          addSaleToShift({ 
            total_amount: saleData.total_amount, 
            payment_method: saleData.payment_method as PaymentMethod,
            status: isCredit ? 'credit' : 'paid' 
          });
          clearCart();
          onSuccess();
          return { success: true, saleId: result.saleId };
        } else {
          toast({ title: "Error al Procesar Venta", description: result.message, variant: "destructive" });
          return { success: false, message: result.message };
        }
      } catch (error: any) {
        console.error("Error processing sale:", error);
        toast({ title: "Error Inesperado", description: "Ocurrió un error al intentar procesar la venta.", variant: "destructive" });
        return { success: false, message: error.message || "Ocurrió un error inesperado." };
      }
    },
    [activeShift, cart, discountAmount, selectedCustomer, toast, addSaleToShift, clearCart]
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
  };
}
