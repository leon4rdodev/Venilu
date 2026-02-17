import { useEffect, useState, useCallback } from "react"
import { ProductGrid } from "./product-grid"
import Cart from "./cart"
import { Product, PaymentMethod } from "@shared/types/models"
import { CartItemType } from "./cart-item"
import { useToast } from "@hooks/use-toast"
import { SalesHistory } from "./sales-history"
import { useShift } from "@hooks/use-shift"
import { Button } from "@components/ui/button"
import { OpenShiftDialog } from "./open-shift-dialog"
import { Wallet } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function POSInterface() {
  const [cart, setCart] = useState<CartItemType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>(["Todos"])
  const [showSalesHistory, setShowSalesHistory] = useState(false)
  const [showOpenShiftDialog, setShowOpenShiftDialog] = useState(false)
  const { toast } = useToast()
  const { activeShift, addSaleToShift } = useShift()

  const fetchProducts = useCallback(async () => {
    interface GetProductsResponse {
      success: boolean;
      products: any[];
      message?: string;
    }

    try {
      const result = (await window.ipcRenderer.invoke('get-products')) as GetProductsResponse;
      if (result.success) {
        const fetchedProducts: Product[] = result.products.map((p: any) => ({
          ...p,
          created_at: p.created_at || new Date(),
          updated_at: p.updated_at || new Date(),
        }));
        setProducts(fetchedProducts);

        const uniqueCategories = Array.from(new Set(fetchedProducts.map(p => p.category?.name).filter(Boolean))) as string[];
        setCategories(["Todos", ...uniqueCategories]);
      } else {
        console.error("Failed to fetch products:", result.message);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      const productInStock = products.find((p) => p.id === product.id);

      if (!productInStock) {
        toast({
          title: "Error",
          description: "Producto no encontrado en el inventario.",
          variant: "destructive",
        });
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
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      } else {
        if (1 > productInStock.stock) {
          toast({
            title: "Sin Stock Suficiente",
            description: `Solo quedan ${productInStock.stock} unidades de ${product.name}.`,
            variant: "destructive",
          });
          return prev;
        }
      }
      return [...prev, { ...product, quantity: 1, category: product.category || null }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const productInStock = products.find((p) => p.id === id);
            if (!productInStock) {
              toast({
                title: "Error",
                description: "Producto no encontrado en el inventario.",
                variant: "destructive",
              });
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
        .filter((item) => item.quantity > 0),
    )
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
  }

  const handleProcessSale = async (paymentMethod: PaymentMethod, amountPaid: number, changeGiven: number): Promise<{ success: boolean, saleId?: string, message?: string }> => {
    if (!activeShift) {
      toast({
        title: "Error: No hay turno activo",
        description: "No se puede procesar la venta porque no hay un turno abierto.",
        variant: "destructive",
      });
      return { success: false, message: "No active shift." };
    }

    const totalAmount = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
    const saleItems = cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      price_at_sale: item.sale_price,
    }));

    const saleData = {
      user_id: activeShift.user_id, // Add user_id to sale data
      shift_id: activeShift.id, // Add shift_id to sale data
      total_amount: totalAmount,
      payment_method: paymentMethod,
      amount_paid: amountPaid,
      change_given: changeGiven,
      sale_date: new Date().toISOString(),
    };

    interface ProcessSaleResponse {
      success: boolean;
      saleId?: string;
      message?: string;
    }

    try {
      const result = (await window.ipcRenderer.invoke('process-sale', { saleData, saleItems })) as ProcessSaleResponse;
      if (result.success) {
        toast({
          title: "Venta Exitosa",
          description: `Venta #${result.saleId} procesada correctamente.`,
        });
        // Add the sale to the shift's context to update totals in real-time
        addSaleToShift({ total_amount: saleData.total_amount, payment_method: saleData.payment_method as PaymentMethod });
        clearCart();
        fetchProducts(); // Re-fetch products to update stock
        return { success: true, saleId: result.saleId }; // Indicate success and return saleId
      } else {
        toast({
          title: "Error al Procesar Venta",
          description: result.message,
          variant: "destructive",
        });
        return { success: false, message: result.message }; // Indicate failure with message
      }
    } catch (error: any) {
      console.error("Error processing sale:", error);
      toast({
        title: "Error Inesperado",
        description: "Ocurrió un error al intentar procesar la venta.",
        variant: "destructive",
      });
      return { success: false, message: error.message || "Ocurrió un error inesperado al procesar la venta." }; // Indicate failure with message
    }
  };

  return (
    <>
      <div className="flex gap-6 h-[calc(100vh-7rem)]">
        <AnimatePresence mode="wait">
          {showSalesHistory ? (
            <motion.div
              key="sales-history"
              className="w-full h-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <SalesHistory setShowSalesHistory={setShowSalesHistory} />
            </motion.div>
          ) : !activeShift ? (
            <motion.div
              key="no-shift"
              className="flex-1 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="max-w-md w-full px-6 text-center space-y-6">
                {/* Icon */}
                <motion.div
                  className="flex justify-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/5 scale-150" />
                    <div className="relative p-5 rounded-full bg-primary/10 border border-primary/10">
                      <Wallet className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                </motion.div>

                {/* Text */}
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <h2 className="text-2xl font-bold tracking-tight">
                    Punto de Venta
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    Abre un turno de trabajo para comenzar a procesar ventas y registrar transacciones.
                  </p>
                </motion.div>

                {/* Info cards */}
                <motion.div
                  className="grid grid-cols-3 gap-3 text-left"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <div className="rounded-lg border bg-card p-3 space-y-1.5">
                    <div className="p-1.5 rounded-md bg-blue-500/10 w-fit">
                      <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium">Control de Caja</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">Registro preciso de efectivo</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3 space-y-1.5">
                    <div className="p-1.5 rounded-md bg-green-500/10 w-fit">
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium">Turnos</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">Seguimiento por horario</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3 space-y-1.5">
                    <div className="p-1.5 rounded-md bg-purple-500/10 w-fit">
                      <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium">Reportes</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">Arqueo al cerrar</p>
                  </div>
                </motion.div>

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="space-y-4"
                >
                  <Button
                    size="lg"
                    className="w-full h-12 text-base font-semibold gap-2"
                    onClick={() => setShowOpenShiftDialog(true)}
                  >
                    <Wallet className="h-5 w-5" />
                    Abrir Turno de Trabajo
                  </Button>

                  {/* Secondary link */}
                  <button
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowSalesHistory(true)}
                  >
                    Ver historial de ventas →
                  </button>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="active-pos"
              className="flex gap-6 flex-1 min-w-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <ProductGrid
                products={products}
                categories={categories}
                onAddToCart={addToCart}
                showSalesHistory={showSalesHistory}
                setShowSalesHistory={setShowSalesHistory}
              />
              <Cart
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemoveFromCart={removeFromCart}
                onClearCart={clearCart}
                onProcessSale={handleProcessSale}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Open Shift Dialog */}
      <OpenShiftDialog
        isOpen={showOpenShiftDialog}
        onClose={() => setShowOpenShiftDialog(false)}
      />
    </>
  )
}