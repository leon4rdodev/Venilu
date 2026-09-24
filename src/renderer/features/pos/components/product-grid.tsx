import { useEffect, useRef, useState } from "react"
import { Input } from "@components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Search, History, Package, LayoutGrid, X, MinusCircle, PlusCircle, ChevronDown } from "lucide-react"
import { cn } from "@lib/utils"
import { ProductCard } from "./product-card"
import { Product } from "@shared/types/models"
import { Button } from "@components/ui/button"
import { Skeleton } from "@components/ui/skeleton"
import { useMinimumLoading } from "@renderer/shared/hooks/use-minimum-loading"
import { usePermission } from "@renderer/features/auth/hooks/use-permission"
import { useShift } from "@renderer/features/pos/hooks/use-shift"
import { PERMISSIONS } from "@shared/permissions"

interface ProductGridProps {
  products: Product[];
  categories: { id: string; name: string }[];
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  isLoading: boolean;
  totalItems: number;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Enter in the search box → exact barcode/SKU lookup in the DB */
  onSubmitCode: (code: string) => void;
  onAddToCart: (product: Product) => void;
  showSalesHistory: boolean;
  setShowSalesHistory: (show: boolean) => void;
  onAddExpense: () => void;
  onAddCapital: () => void;
  onViewExpenses: () => void;
  /** Shared ref so the POS F1 shortcut can focus the search box from outside */
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function ProductGrid({
  products,
  categories,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  isLoading,
  totalItems,
  hasMore,
  onLoadMore,
  onSubmitCode,
  onAddToCart,
  showSalesHistory,
  setShowSalesHistory,
  onAddExpense,
  onAddCapital,
  onViewExpenses,
  searchInputRef,
}: ProductGridProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const [morePickerOpen, setMorePickerOpen] = useState(false)

  // Focus the search input on mount so the cashier can scan/type immediately.
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Keep the active category chip visible when it changes (e.g. picked from "Más")
  useEffect(() => {
    chipsRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" })
  }, [categoryId])

  const { shiftExpenses } = useShift()
  const canManageExpenses = usePermission(PERMISSIONS.SHIFTS_EXPENSES)

  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name
  const isFiltered = Boolean(search) || categoryId !== "all"

  // Hold the skeleton for a minimum window so it never flashes for ~50ms
  const showSkeleton = useMinimumLoading(isLoading && products.length === 0, 500)

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-x-clip">
      {/* Header toolbar */}
      {/* Toolbar — flat single row: compact search, category chips, quick actions.
          overflow-x-clip keeps the column shrinkable (min-width:0) so narrow
          windows never push the cart off-screen, while overflow-y stays visible
          so the focus rings / expenses counter badge render upward into the
          layout padding uncropped. */}
      <div className="flex items-center gap-2 shrink-0 px-0.5">
        <div className="relative w-88 shrink-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Input
            ref={(el) => {
              searchRef.current = el
              if (searchInputRef) searchInputRef.current = el
            }}
            placeholder="Buscar o escanear · F1"
            aria-label="Buscar o escanear producto"
            autoComplete="off"
            spellCheck={false}
            className="h-9 pl-9 pr-9 bg-card"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search) {
                onSubmitCode(search)
              }
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Category chips fill the flexible middle — mouse wheel scrolls them
            horizontally, and with many categories a "Más" picker lists them all */}
        {categories.length > 1 ? (
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <div
              ref={chipsRef}
              role="group"
              aria-label="Filtrar por categoría"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 px-0.5 py-0.5"
              onWheel={(e) => {
                if (e.deltaY !== 0 && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
                  e.currentTarget.scrollLeft += e.deltaY
                }
              }}
            >
              {categories.map((category) => {
                const isActive = categoryId === category.id
                return (
                  <button
                    key={category.id}
                    type="button"
                    data-active={isActive}
                    aria-pressed={isActive}
                    onClick={() => onCategoryChange(category.id)}
                    title={category.name}
                    className={cn(
                      "shrink-0 px-3 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                      "outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring",
                      isActive
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {category.name}
                  </button>
                )
              })}
            </div>

            {categories.length > 8 && (
              <Popover open={morePickerOpen} onOpenChange={setMorePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 flex items-center gap-1 px-3 h-9 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring"
                    title="Ver todas las categorías"
                    aria-label="Ver todas las categorías"
                  >
                    Más
                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 max-h-72 overflow-y-auto p-1">
                  {categories.map((category) => {
                    const isActive = categoryId === category.id
                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          onCategoryChange(category.id)
                          setMorePickerOpen(false)
                        }}
                        title={category.name}
                        className={cn(
                          "w-full text-left px-2.5 min-h-9 py-1.5 rounded-md text-sm leading-snug transition-colors outline-none focus-visible:bg-muted focus-visible:text-foreground",
                          isActive
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {category.name}
                      </button>
                    )
                  })}
                </PopoverContent>
              </Popover>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex gap-2 shrink-0">
          {canManageExpenses && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                onClick={onAddCapital}
                title="Inyectar capital a la caja"
                aria-label="Inyectar capital a la caja"
              >
                <PlusCircle className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                  onClick={onAddExpense}
                  title="Registrar gasto de caja"
                  aria-label="Registrar gasto de caja"
                >
                  <MinusCircle className="h-4 w-4" strokeWidth={1.75} />
                </Button>
                {shiftExpenses.length > 0 && (
                  <button
                    type="button"
                    onClick={onViewExpenses}
                    title="Ver gastos del turno"
                    aria-label={`Ver gastos del turno (${shiftExpenses.length})`}
                    className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-destructive text-[10px] leading-none font-semibold tabular-nums text-white ring-2 ring-background animate-in zoom-in duration-300 motion-reduce:animate-none outline-none focus-visible:ring-ring"
                  >
                    {shiftExpenses.length}
                  </button>
                )}
              </div>
            </>
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowSalesHistory(!showSalesHistory)}
            title="Historial de ventas"
            aria-label="Historial de ventas"
          >
            <History className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      {/* Product count */}
      <div
        className="flex items-center gap-2 text-xs text-muted-foreground px-0.5 min-h-5"
        aria-live="polite"
        aria-atomic="true"
      >
        <LayoutGrid className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="tabular-nums">
          {totalItems} producto{totalItems !== 1 ? "s" : ""}
        </span>
        {categoryId !== "all" && selectedCategoryName && (
          <span className="text-foreground font-medium truncate" title={selectedCategoryName}>
            • {selectedCategoryName}
          </span>
        )}
        {isLoading && (
          <Skeleton className="h-3.5 w-16 rounded-full" aria-label="Actualizando" />
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto pt-1 pb-2 px-0.5">
        {showSkeleton ? (
          // Loading: EXACT replica of the real card grid — same container,
          // columns, and card anatomy (photo + badge + name + category +
          // divider + price label + price) in the same positions, so the
          // swap to real content is seamless.
          <div
            className="grid grid-cols-2 2xl:grid-cols-3 gap-4"
            role="status"
            aria-busy="true"
            aria-label="Cargando productos"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border border-border rounded-lg overflow-hidden flex flex-col bg-card h-full"
              >
                {/* Photo block with the stock badge in its corner */}
                <div className="relative w-full aspect-square bg-muted/30 shrink-0">
                  <Skeleton className="absolute inset-0 rounded-none" />
                  <Skeleton className="absolute top-2 right-2 h-6 w-16 rounded-full bg-background/70" />
                </div>
                {/* Info block mirroring ProductCard's p-3 / gap-1.5 layout */}
                <div className="p-3 flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                  <div className="pt-2 border-t border-border/50 mt-auto space-y-1.5">
                    <Skeleton className="h-2.5 w-10" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {isFiltered
                ? "No se encontraron productos"
                : "No hay productos disponibles"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              {isFiltered
                ? "Intenta ajustar los filtros de búsqueda o categoría"
                : "Agrega productos en la sección de Inventario para comenzar a vender"}
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                className="mt-4 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onSearchChange("")
                  onCategoryChange("all")
                }}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* 2 columns so the product photo reads large; 3 on big screens */}
            <div className="grid grid-cols-2 2xl:grid-cols-3 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4 pb-2">
                <Button
                  variant="outline"
                  onClick={onLoadMore}
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                  <span className="tabular-nums">
                    {isLoading ? "Cargando…" : `Cargar más (${products.length} de ${totalItems})`}
                  </span>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
