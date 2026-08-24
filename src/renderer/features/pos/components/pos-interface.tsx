import { useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { ProductGrid } from "./product-grid";
import Cart from "./cart";
import { SalesHistory } from "./sales-history";
import { OpenShiftDialog } from "./open-shift-dialog";
import { NoShiftPrompt } from "./no-shift-prompt";
import { AddExpenseDialog } from "./add-expense-dialog";
import { ViewExpensesDialog } from "./view-expenses-dialog";
import { useCart } from "../hooks/use-cart";
import { usePOSProducts } from "../hooks/use-pos-products";
import { useShift } from "../hooks/use-shift";
import { useBarcodeScanner } from "../hooks/use-barcode-scanner";
import { useCategories } from "@renderer/features/settings";
import { PaymentMethod, Product } from "@shared/types/models";

export function POSInterface() {
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [showOpenShiftDialog, setShowOpenShiftDialog] = useState(false);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [showViewExpensesDialog, setShowViewExpensesDialog] = useState(false);

  // Server-driven catalog: search + category filtering run in the DATABASE,
  // so the POS sees the whole inventory, not just the first page.
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");

  const { activeShift } = useShift();
  const { categories } = useCategories();
  const { products, pagination, isLoading, loadMore, refresh } = usePOSProducts(search, categoryId);
  const {
    cart, addToCart, updateQuantity, removeFromCart, clearCart,
    handleProcessSale, discountAmount, setDiscountAmount,
    selectedCustomer, setSelectedCustomer,
    parkedSales, parkSale, resumeParkedSale, removeParkedSale,
  } = useCart();

  const categoryOptions = useMemo(
    () => [{ id: "all", name: "Todas" }, ...categories.map((c) => ({ id: c.id.toString(), name: c.name }))],
    [categories]
  );

  // A scanner types into the focused search input AND fires the global hook —
  // both paths land here, so one code within 500ms adds exactly once.
  const lastLookupRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  const handleCodeLookup = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (lastLookupRef.current.code === trimmed && now - lastLookupRef.current.time < 500) return;
    lastLookupRef.current = { code: trimmed, time: now };

    if (!activeShift) {
      toast.error("No hay turno activo", { description: "Abre un turno antes de escanear productos." });
      return;
    }

    try {
      // Exact barcode/SKU lookup in the DB — works for the entire catalog
      const result = await window.ipcRenderer.invoke("get-product-by-code", trimmed) as {
        success: boolean;
        data?: Product;
        message?: string;
      };

      if (result.success && result.data) {
        addToCart(result.data);
        toast.success("Producto escaneado", { description: `${result.data.name} agregado al carrito.` });
        setSearch("");
      } else {
        toast.error("Producto no encontrado", { description: `Ningún producto con el código ${trimmed}.` });
      }
    } catch {
      toast.error("Error al buscar el producto");
    }
  }, [activeShift, addToCart]);

  useBarcodeScanner({ onScan: handleCodeLookup });

  return (
    <>
      <div className="flex gap-5 h-[calc(100vh-6.5rem)]">
        {showSalesHistory ? (
          <div className="w-full h-full">
              <SalesHistory setShowSalesHistory={setShowSalesHistory} />
          </div>
        ) : !activeShift ? (
            <NoShiftPrompt
              onOpenShift={() => setShowOpenShiftDialog(true)}
              onViewHistory={() => setShowSalesHistory(true)}
            />
        ) : (
          <div className="flex gap-6 flex-1 min-w-0">
              <ProductGrid
                products={products}
                categories={categoryOptions}
                search={search}
                onSearchChange={setSearch}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                isLoading={isLoading}
                totalItems={pagination.totalItems}
                hasMore={pagination.hasNextPage}
                onLoadMore={loadMore}
                onSubmitCode={handleCodeLookup}
                onAddToCart={addToCart}
                showSalesHistory={showSalesHistory}
                setShowSalesHistory={setShowSalesHistory}
                onAddExpense={() => setShowAddExpenseDialog(true)}
                onViewExpenses={() => setShowViewExpensesDialog(true)}
              />
              <Cart
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemoveFromCart={removeFromCart}
                onClearCart={clearCart}
                discountAmount={discountAmount}
                setDiscountAmount={setDiscountAmount}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                onProcessSale={(paymentMethod: PaymentMethod, amountPaid: number, changeGiven: number) =>
                  handleProcessSale(paymentMethod, amountPaid, changeGiven, refresh)
                }
                parkedSales={parkedSales}
                onParkSale={parkSale}
                onResumeParked={resumeParkedSale}
                onRemoveParked={removeParkedSale}
              />
          </div>
        )}
      </div>

      <OpenShiftDialog
        isOpen={showOpenShiftDialog}
        onClose={() => setShowOpenShiftDialog(false)}
      />

      <AddExpenseDialog
        isOpen={showAddExpenseDialog}
        onClose={() => setShowAddExpenseDialog(false)}
      />
      <ViewExpensesDialog
        isOpen={showViewExpensesDialog}
        onClose={() => setShowViewExpensesDialog(false)}
      />
    </>
  );
}
