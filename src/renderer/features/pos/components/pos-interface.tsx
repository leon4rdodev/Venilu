import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductGrid } from "./product-grid";
import Cart from "./cart";
import { SalesHistory } from "./sales-history";
import { OpenShiftDialog } from "./open-shift-dialog";
import { NoShiftPrompt } from "./no-shift-prompt";
import { useCart } from "../hooks/use-cart";
import { usePOSProducts } from "../hooks/use-pos-products";
import { useShift } from "../hooks/use-shift";
import { PaymentMethod } from "@shared/types/models";
import { useToast } from "@renderer/features/layout";
import { useBarcodeScanner } from "../hooks/use-barcode-scanner";
import { useCallback } from "react";
export function POSInterface() {
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [showOpenShiftDialog, setShowOpenShiftDialog] = useState(false);

  const { activeShift } = useShift();
  const { products, loadProducts: fetchProducts } = usePOSProducts();
  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean))) as string[];
    return ["Todos", ...unique];
  }, [products]);
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart, handleProcessSale, discountAmount, setDiscountAmount, selectedCustomer, setSelectedCustomer } = useCart();
  const { toast } = useToast();

  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!activeShift) {
      toast({
        title: "No hay turno activo",
        description: "Abre un turno antes de escanear productos.",
        variant: "destructive"
      });
      return;
    }

    const product = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (product) {
      addToCart(product, products);
      toast({
        title: "Producto Escaneado",
        description: `${product.name} agregado al carrito.`,
      });
    } else {
      toast({
        title: "Producto no encontrado",
        description: `No se encontró ningún producto con el código ${barcode}.`,
        variant: "destructive"
      });
    }
  }, [products, activeShift, addToCart, toast]);

  useBarcodeScanner({ onScan: handleBarcodeScan });

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
            <NoShiftPrompt
              onOpenShift={() => setShowOpenShiftDialog(true)}
              onViewHistory={() => setShowSalesHistory(true)}
            />
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
                onAddToCart={(product) => addToCart(product, products)}
                showSalesHistory={showSalesHistory}
                setShowSalesHistory={setShowSalesHistory}
              />
              <Cart
                cart={cart}
                onUpdateQuantity={(id, delta) => updateQuantity(id, delta, products)}
                onRemoveFromCart={removeFromCart}
                onClearCart={clearCart}
                discountAmount={discountAmount}
                setDiscountAmount={setDiscountAmount}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                onProcessSale={(paymentMethod: PaymentMethod, amountPaid: number, changeGiven: number) =>
                  handleProcessSale(paymentMethod, amountPaid, changeGiven, fetchProducts)
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <OpenShiftDialog
        isOpen={showOpenShiftDialog}
        onClose={() => setShowOpenShiftDialog(false)}
      />
    </>
  );
}
