
import { useState, useEffect, useRef } from "react"
import { Input } from "@components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select"
import { Search, History, Package, ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react"
import { ProductCard } from "./product-card"
import { Product } from "@shared/types/models"
import { Button } from "@components/ui/button"

interface ProductGridProps {
  products: Product[];
  categories: string[];
  onAddToCart: (product: Product) => void
  showSalesHistory: boolean;
  setShowSalesHistory: (show: boolean) => void;
}

const ITEMS_PER_PAGE = 25;

export function ProductGrid({ products, categories, onAddToCart, showSalesHistory, setShowSalesHistory }: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState("Todos")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus the search input on mount so the cashier can scan/type immediately.
  // useEffect is the accessibility-correct alternative to autoFocus — focus
  // fires after mount, giving screen readers time to announce the page first.
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === "Todos" || product.category?.name === selectedCategory
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = searchQuery === "" || 
      product.name.toLowerCase().includes(searchLower) ||
      (product.sku && product.sku.toLowerCase().includes(searchLower))
    return matchesCategory && matchesSearch
  })


  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentProducts = filteredProducts.slice(startIndex, endIndex)

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
      {/* Header toolbar */}
      {/* Header toolbar - Redesigned */}
      <div className="bg-card rounded-xl border shadow-sm p-3 flex flex-col sm:flex-row gap-3 items-center sticky top-0 z-10">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Buscar productos por nombre o SKU..."
            className="pl-9 pr-9 h-10! bg-background/50 border-input/60 focus:bg-background transition-all"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery) {
                const product = products.find(p => p.barcode === searchQuery || p.sku === searchQuery);
                if (product) {
                  onAddToCart(product);
                  setSearchQuery("");
                }
              }
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <Select
            value={selectedCategory}
            onValueChange={(value) => {
              setSelectedCategory(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px] h-10! bg-background/50 border-input/60 focus:bg-background">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="secondary"
            className="h-10! w-10! shrink-0 border border-input/60 bg-background/50 hover:bg-muted"
            onClick={() => setShowSalesHistory(!showSalesHistory)}
            title="Historial de ventas"
          >
            <History className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Product count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-0.5">
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</span>
        {selectedCategory !== "Todos" && (
          <span className="text-primary font-medium">• {selectedCategory}</span>
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto pt-1 pb-2 px-0.5">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {searchQuery || selectedCategory !== "Todos"
                ? "No se encontraron productos"
                : "No hay productos disponibles"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchQuery || selectedCategory !== "Todos"
                ? "Intenta ajustar los filtros de búsqueda o categoría"
                : "Agrega productos en la sección de Inventario para comenzar a vender"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {currentProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredProducts.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between border-t pt-2.5 px-0.5">
          <span className="text-xs text-muted-foreground">
            {startIndex + 1}–{Math.min(endIndex, filteredProducts.length)} de {filteredProducts.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium px-2 min-w-16 text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
