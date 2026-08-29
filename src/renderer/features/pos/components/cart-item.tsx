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

  return (
    <div className="group relative flex gap-3 p-3 rounded-lg border border-border bg-card">
      {/* Photo (category icon as fallback) */}
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={item.name}
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-md object-cover border border-border"
        />
      ) : (
        <div className={cn("h-12 w-12 shrink-0 rounded-md flex items-center justify-center", colorClasses)}>
          {createElement(categoryIcon, { className: "h-5 w-5", strokeWidth: 1.75 })}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-between min-w-0">
        {/* Top Row: Name and Remove */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4
            className="font-medium text-sm leading-tight text-foreground line-clamp-2"
            title={item.name}
          >
            {item.name}
          </h4>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => onRemoveFromCart(item.id)}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>

        {/* Bottom Row: Controls and Price */}
        <div className="flex items-end justify-between gap-2">
          {/* Quantity Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(item.id, -1)}
            >
              <Minus className="h-3 w-3" strokeWidth={1.75} />
            </Button>
            <span className="w-8 text-center text-sm font-medium tabular-nums">
              {item.quantity}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => onUpdateQuantity(item.id, 1)}
            >
              <Plus className="h-3 w-3" strokeWidth={1.75} />
            </Button>
          </div>

          {/* Price details */}
          <div className="text-right min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
              {formatCurrency(item.sale_price)} <span className="lowercase">unid.</span>
            </p>
            <p
              className="text-sm font-semibold text-foreground font-mono tabular-nums truncate"
              title={formatCurrency(item.sale_price * item.quantity)}
            >
              {formatCurrency(item.sale_price * item.quantity)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
