export type Product = {
  id: number
  name: string
  category_id: number
  category: string
  purchase_price: number
  sale_price: number
  stock: number
  sku?: string
  min_stock?: number
  has_sales?: boolean
}
