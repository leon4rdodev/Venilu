import { createElement, useState } from "react"
import { Button } from "@components/ui/button"
import { Minus, Plus, X } from "lucide-react"
import { formatCurrency } from "@lib/currency"
import { productImageSrc } from "@lib/image"
import { getCategoryIcon, getCategoryColor } from "./product-card"
import { cn } from "@lib/utils"
import { Input } from "@components/ui/input"
import { QTY_EPSILON, unitDef } from "@shared/units"

import { Category } from "@shared/types/models"

export type CartItemType = {
  id: string
  name: string
  sale_price: number
  quantity: number
  /** Stock snapshot at add time — used for client-side quantity limits */
  stock: number
  /** Unidad de medida ('unidad' | libra | kilo…) — ver @shared/units */
  unit?: string
  category: Category | null
  /** Product photo (managed file name or legacy data URL) */
  image?: string | null
  /** true = exento de ITBIS — alimenta el desglose del panel del pedido */
  itbis_exempt?: boolean
}

interface CartItemProps {
  item: CartItemType
  onUpdateQuantity: (_id: string, _delta: number) => void
  /** Fija la cantidad escrita a mano; false = rechazada (inválida/sin stock) */
  onSetQuantity: (_id: string, _qty: number) => boolean
  onRemoveFromCart: (_id: string) => void
}

export function CartItem({ item, onUpdateQuantity, onSetQuantity, onRemoveFromCart }: CartItemProps) {
  const categoryIcon = getCategoryIcon(item.category?.name || "Otros");
  const colorClasses = getCategoryColor(item.category?.name || "Otros");
  const imageSrc = productImageSrc(item.image);
  const lineTotal = formatCurrency(item.sale_price * item.quantity);
  const unitPrice = formatCurrency(item.sale_price);
  const unit = unitDef(item.unit);
  const step = unit.step;
  // Precio unitario con la medida para medidas fraccionables: "RD$120 / lb".
  const unitPriceLabel = unit.value === "unidad" ? unitPrice : `${unitPrice} / ${unit.abbr}`;
  // Cantidad escrita a mano: estado local mientras se edita. Cuando la
  // cantidad confirmada del carrito cambia (±, otro origen), se resincroniza
  // con el patrón "adjusting state when props change" de React.
  const [qtyText, setQtyText] = useState(String(item.quantity));
  const [lastQuantity, setLastQuantity] = useState(item.quantity);
  if (lastQuantity !== item.quantity) {
    setLastQuantity(item.quantity);
    setQtyText(String(item.quantity));
  }
  const commitQty = () => {
    const parsed = Number(qtyText.trim().replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setQtyText(String(item.quantity));
      return;
    }
    if (parsed === 0) {
      onRemoveFromCart(item.id);
      setQtyText("0");
      return;
    }
    onSetQuantity(item.id, parsed);
    // Si fue rechazada (sin stock/inválida) la cantidad no cambió: se
    // restaura lo que había. Si cambió, el bloque de arriba resincroniza.
    setQtyText(String(item.quantity));
  };
  // Bajar hasta (casi) 0 borra la línea — decirlo en vez de "disminuir".
  const decreaseLabel = item.quantity <= step + QTY_EPSILON
    ? `Quitar ${item.name}`
    : `Disminuir cantidad de ${item.name}`;

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
          {/* Quantity Controls — ±paso de la medida; el centro es escribible */}
          <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`Cantidad de ${item.name}`}>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => onUpdateQuantity(item.id, -step)}
              aria-label={decreaseLabel}
              title={item.quantity <= step + QTY_EPSILON ? "Quitar" : `Disminuir cantidad (${step} ${unit.singular})`}
            >
              <Minus className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <Input
              type="text"
              inputMode="decimal"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
              onBlur={commitQty}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitQty();
                }
              }}
              aria-label={`Cantidad de ${item.name} (${unit.plural})`}
              className="w-20 px-1 h-9 text-center text-sm font-medium tabular-nums"
              disabled={false}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => onUpdateQuantity(item.id, step)}
              aria-label={`Aumentar cantidad de ${item.name}`}
              title={`Aumentar (${step} ${unit.singular})`}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>

          {/* Price details */}
          <div className="text-right min-w-0">
            <p
              className="text-[11px] text-muted-foreground font-mono tabular-nums truncate mb-0.5"
              title={unit.value === "unidad" ? `${unitPrice} por unidad` : `${unitPrice} por ${unit.singular}`}
            >
              {unitPriceLabel}
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
