import { createElement } from "react"
import { Button } from "@components/ui/button"
import { Minus, Plus, X } from "lucide-react"
import { formatCurrency } from "@lib/currency"
import { productImageSrc } from "@lib/image"
import { getCategoryIcon, getCategoryColor } from "./product-card"
import { cn } from "@lib/utils"

import { Category } from "@shared/types/models"

export type CartItemType = {
  id: string
  name: string
  sale_price: number
  quantity: number
  /** Stock snapshot at add time — used for client-side quantity limits */
  stock: number
  category: Category | null
  /** Product photo (managed file name or legacy data URL) */
  image?: string | null
  /** true = exento de ITBIS — alimenta el desglose del panel del pedido */
  itbis_exempt?: boolean
}

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (_id: string, _delta: number) => void
  onRemoveFromCart: (_id: string) => void
}

export function CartItem({ item, onUpdateQuantity, onRemoveFromCart }: CartItemProps) {
  const categoryIcon = getCategoryIcon(item.category?.name || "Otros");
  const colorClasses = getCategoryColor(item.category?.name || "Otros");
  const imageSrc = productImageSrc(item.image);
  const lineTotal = formatCurrency(item.sale_price * item.quantity);
  const unitPrice = formatCurrency(item.sale_price);
  // Lowering to 0 removes the line — say so instead of "disminuir".
  const decreaseLabel = item.quantity <= 1 ? `Quitar ${item.name}` : `Disminuir cantidad de ${item.name}`;

  return (
    <div className="group relative flex gap-3 p-3 rounded-lg border border-border bg-card">
      {/* Photo (category icon as fallback) — decorative: the name sits right beside it */}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-md object-cover border border-border"
        />
      ) : (
        <div
          className={cn("h-12 w-12 shrink-0 rounded-md flex items-center justify-center", colorClasses)}
          aria-hidden="true"
        >
          {createElement(categoryIcon, { className: "h-5 w-5", strokeWidth: 1.75 })}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-between min-w-0">
        {/* Top Row: Name and Remove */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4
            className="font-medium text-sm leading-tight text-foreground line-clamp-2 pt-0.5"
            title={item.name}
          >
            {item.name}
          </h4>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 -mr-2 -mt-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => onRemoveFromCart(item.id)}
            aria-label={`Quitar ${item.name}`}
            title="Quitar del carrito"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>

        {/* Bottom Row: Controls and Price */}
        <div className="flex items-end justify-between gap-2">
          {/* Quantity Controls */}
          <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`Cantidad de ${item.name}`}>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => onUpdateQuantity(item.id, -1)}
              aria-label={decreaseLabel}
              title={item.quantity <= 1 ? "Quitar" : "Disminuir cantidad"}
            >
              <Minus className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <span
              className="w-8 text-center text-sm font-medium tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {item.quantity}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => onUpdateQuantity(item.id, 1)}
              aria-label={`Aumentar cantidad de ${item.name}`}
              title="Aumentar cantidad"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>

          {/* Price details */}
          <div className="text-right min-w-0">
            <p
              className="text-[11px] text-muted-foreground font-mono tabular-nums truncate mb-0.5"
              title={`${unitPrice} por unidad`}
            >
              {unitPrice} unid.
            </p>
            <p
              className="text-sm font-semibold text-foreground font-mono tabular-nums truncate"
              title={lineTotal}
            >
              {lineTotal}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
