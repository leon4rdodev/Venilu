import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCart, ParkedSale } from "./use-cart";
import type { Product, Customer } from "@shared/types/models";

// ─── Module mocks ────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  addSaleToShift: vi.fn(),
  shift: { current: { id: "shift-1" } as { id: string } | null },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("./use-shift", () => ({
  useShift: () => ({
    activeShift: h.shift.current,
    addSaleToShift: h.addSaleToShift,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: h.toastSuccess },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PARKED_KEY = "venilu_parked_sales";

function product(overrides: Record<string, unknown> = {}): Product {
  return {
    id: "p1",
    name: "Café",
    sale_price: 10,
    stock: 5,
    category: null,
    ...overrides,
  } as unknown as Product;
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return { id: "c1", name: "María", ...overrides } as unknown as Customer;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  h.shift.current = { id: "shift-1" };
  (window as any).ipcRenderer.invoke = vi.fn(async () => ({ success: true, data: null }));
});

// ─── addToCart ───────────────────────────────────────────────────────────────

describe("useCart · addToCart", () => {
  it("adds a new product with quantity 1", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0]).toMatchObject({ id: "p1", quantity: 1 });
  });

  it("increments quantity when the product is already in the cart", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    act(() => result.current.addToCart(product()));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
  });

  it("refuses to exceed the product stock and shows an error toast", () => {
    const { result } = renderHook(() => useCart());
    const p = { ...product(), stock: 1 } as Product;
    act(() => result.current.addToCart(p));
    act(() => result.current.addToCart(p));
    expect(result.current.cart[0].quantity).toBe(1);
    expect(h.toastError).toHaveBeenCalledWith("Sin stock suficiente", expect.anything());
  });

  it("does not add a product with zero stock", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart({ ...product(), stock: 0 } as Product));
    expect(result.current.cart).toHaveLength(0);
    expect(h.toastError).toHaveBeenCalled();
  });
});

// ─── updateQuantity / removeFromCart / clearCart ─────────────────────────────

describe("useCart · updateQuantity", () => {
  it("increments and decrements by delta", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    act(() => result.current.updateQuantity("p1", 2));
    expect(result.current.cart[0].quantity).toBe(3);
    act(() => result.current.updateQuantity("p1", -1));
    expect(result.current.cart[0].quantity).toBe(2);
  });

  it("rejects increments above stock and keeps the quantity unchanged", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart({ ...product(), stock: 2 } as Product));
    act(() => result.current.updateQuantity("p1", 5));
    expect(result.current.cart[0].quantity).toBe(1);
    expect(h.toastError).toHaveBeenCalledWith("Sin stock suficiente", expect.anything());
  });

  it("clamps to zero (never negative) and removes the item at zero", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    act(() => result.current.updateQuantity("p1", -99));
    expect(result.current.cart).toHaveLength(0);
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it("ignores unknown ids", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    act(() => result.current.updateQuantity("nope", 1));
    expect(result.current.cart[0].quantity).toBe(1);
  });
});

describe("useCart · removeFromCart / clearCart", () => {
  it("removes only the targeted item", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    act(() => result.current.addToCart({ ...product(), id: "p2", name: "Té" } as Product));
    act(() => result.current.removeFromCart("p1"));
    expect(result.current.cart.map((i) => i.id)).toEqual(["p2"]);
  });

  it("clearCart empties the cart and resets discount and customer", () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addToCart(product());
      result.current.setDiscountAmount(5);
      result.current.setSelectedCustomer(customer());
    });
    act(() => result.current.clearCart());
    expect(result.current.cart).toHaveLength(0);
    expect(result.current.discountAmount).toBe(0);
    expect(result.current.selectedCustomer).toBeNull();
  });
});

// ─── Totals (via handleProcessSale) ──────────────────────────────────────────

describe("useCart · totals with round2", () => {
  it("computes subtotal - discount rounded to 2 decimals and reports it to the shift", async () => {
    const invoke = vi.fn(async () => ({ success: true, saleId: "S1" }));
    (window as any).ipcRenderer.invoke = invoke;

    const { result } = renderHook(() => useCart());
    // 3 × 0.1 = 0.30000000000000004 without rounding
    const p = { ...product(), sale_price: 0.1, stock: 10 } as Product;
    act(() => result.current.addToCart(p));
    act(() => result.current.updateQuantity("p1", 2));
    act(() => result.current.setDiscountAmount(0.1));

    await act(async () => {
      await result.current.handleProcessSale("cash" as any, 1, 0.8, () => {});
    });

    // subtotal round2(0.3) = 0.3 → total round2(0.3 - 0.1) = 0.2
    expect(h.addSaleToShift).toHaveBeenCalledWith(
      expect.objectContaining({ total_amount: 0.2, payment_method: "cash", status: "paid" })
    );
    expect(invoke).toHaveBeenCalledWith(
      "process-sale",
      expect.objectContaining({
        saleData: expect.objectContaining({
          shift_id: "shift-1",
          discount_amount: 0.1,
          amount_paid: 1,
          change_given: 0.8,
        }),
        saleItems: [{ product_id: "p1", quantity: 3 }],
      })
    );
  });

  it("clamps the total at zero when the discount exceeds the subtotal", async () => {
    (window as any).ipcRenderer.invoke = vi.fn(async () => ({ success: true, saleId: "S2" }));
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product())); // subtotal 10
    act(() => result.current.setDiscountAmount(50));

    await act(async () => {
      await result.current.handleProcessSale("cash" as any, 0, 0, () => {});
    });
    expect(h.addSaleToShift).toHaveBeenCalledWith(
      expect.objectContaining({ total_amount: 0 })
    );
  });
});

// ─── handleProcessSale guards and outcomes ───────────────────────────────────

describe("useCart · handleProcessSale", () => {
  it("fails without an active shift", async () => {
    h.shift.current = null;
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    let res: any;
    await act(async () => {
      res = await result.current.handleProcessSale("cash" as any, 10, 0, () => {});
    });
    expect(res.success).toBe(false);
    expect(h.toastError).toHaveBeenCalledWith("No hay turno activo", expect.anything());
    expect((window as any).ipcRenderer.invoke).not.toHaveBeenCalled();
  });

  it("requires a customer for credit sales", async () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    let res: any;
    await act(async () => {
      res = await result.current.handleProcessSale("credit" as any, 0, 0, () => {});
    });
    expect(res.success).toBe(false);
    expect(h.toastError).toHaveBeenCalledWith("Cliente requerido", expect.anything());
  });

  it("on success clears the cart, calls onSuccess and returns the saleId", async () => {
    (window as any).ipcRenderer.invoke = vi.fn(async () => ({ success: true, saleId: "S9" }));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));

    let res: any;
    await act(async () => {
      res = await result.current.handleProcessSale("cash" as any, 20, 10, onSuccess);
    });
    expect(res).toEqual({ success: true, saleId: "S9" });
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.cart).toHaveLength(0);
    expect(h.toastSuccess).toHaveBeenCalled();
  });

  it("sends fiscal data when provided and returns the issued NCF", async () => {
    const invoke = vi.fn(async () => ({ success: true, saleId: "S10", ncf: "B0100000042" }));
    (window as any).ipcRenderer.invoke = invoke;
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));

    let res: any;
    await act(async () => {
      res = await result.current.handleProcessSale("cash" as any, 10, 0, () => {}, {
        ncfType: "B01",
        customerRnc: "131234567",
        customerName: "Empresa SRL",
      });
    });

    expect(invoke).toHaveBeenCalledWith(
      "process-sale",
      expect.objectContaining({
        saleData: expect.objectContaining({
          fiscal: { ncfType: "B01", customerRnc: "131234567", customerName: "Empresa SRL" },
        }),
      })
    );
    expect(res).toEqual({ success: true, saleId: "S10", ncf: "B0100000042" });
    expect(h.toastSuccess).toHaveBeenCalledWith(
      "Venta exitosa",
      expect.objectContaining({ description: expect.stringContaining("NCF B0100000042") })
    );
  });

  it("omits fiscal from saleData when not provided", async () => {
    const invoke = vi.fn(async () => ({ success: true, saleId: "S11" }));
    (window as any).ipcRenderer.invoke = invoke;
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));

    let res: any;
    await act(async () => {
      res = await result.current.handleProcessSale("cash" as any, 10, 0, () => {});
    });

    const payload = (invoke as any).mock.calls[0][1];
    expect(payload.saleData).not.toHaveProperty("fiscal");
    expect(res).toEqual({ success: true, saleId: "S11", ncf: undefined });
  });

  it("on backend failure keeps the cart and returns the message", async () => {
    (window as any).ipcRenderer.invoke = vi.fn(async () => ({ success: false, message: "Sin stock" }));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));

    let res: any;
    await act(async () => {
      res = await result.current.handleProcessSale("cash" as any, 20, 10, onSuccess);
    });
    expect(res).toEqual({ success: false, message: "Sin stock" });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.cart).toHaveLength(1);
    expect(h.addSaleToShift).not.toHaveBeenCalled();
  });
});

// ─── Parked sales ────────────────────────────────────────────────────────────

describe("useCart · parked sales", () => {
  it("parkSale stores the ticket (cart + discount + customer), clears the cart and persists to localStorage", () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addToCart(product());
      result.current.setDiscountAmount(2);
      result.current.setSelectedCustomer(customer());
    });
    act(() => result.current.parkSale());

    expect(result.current.cart).toHaveLength(0);
    expect(result.current.discountAmount).toBe(0);
    expect(result.current.parkedSales).toHaveLength(1);
    expect(result.current.parkedSales[0]).toMatchObject({
      discountAmount: 2,
      customer: expect.objectContaining({ id: "c1" }),
    });
    expect(result.current.parkedSales[0].cart[0]).toMatchObject({ id: "p1", quantity: 1 });

    const stored = JSON.parse(window.localStorage.getItem(PARKED_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(result.current.parkedSales[0].id);
    expect(h.toastSuccess).toHaveBeenCalledWith("Venta puesta en espera", expect.anything());
  });

  it("parkSale is a no-op with an empty cart", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.parkSale());
    expect(result.current.parkedSales).toHaveLength(0);
    expect(window.localStorage.getItem(PARKED_KEY)).toBeNull();
  });

  it("loads previously parked sales from localStorage on init", () => {
    const seeded: ParkedSale[] = [
      { id: "ABC123", createdAt: 1, cart: [], discountAmount: 0, customer: null },
    ];
    window.localStorage.setItem(PARKED_KEY, JSON.stringify(seeded));
    const { result } = renderHook(() => useCart());
    expect(result.current.parkedSales).toEqual(seeded);
  });

  it("ignores corrupted localStorage content", () => {
    window.localStorage.setItem(PARKED_KEY, "{not json");
    const { result } = renderHook(() => useCart());
    expect(result.current.parkedSales).toEqual([]);
  });

  it("resumeParkedSale restores cart, discount and customer, and removes the entry from storage", () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addToCart(product());
      result.current.setDiscountAmount(3);
      result.current.setSelectedCustomer(customer());
    });
    act(() => result.current.parkSale());
    const parkedId = result.current.parkedSales[0].id;

    act(() => result.current.resumeParkedSale(parkedId));

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0]).toMatchObject({ id: "p1", quantity: 1 });
    expect(result.current.discountAmount).toBe(3);
    expect(result.current.selectedCustomer).toMatchObject({ id: "c1" });
    expect(result.current.parkedSales).toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(PARKED_KEY)!)).toEqual([]);
  });

  it("resumeParkedSale is blocked while the cart is busy", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    act(() => result.current.parkSale());
    const parkedId = result.current.parkedSales[0].id;

    // Start a new sale, then try to resume the parked one
    act(() => result.current.addToCart({ ...product(), id: "p2" } as Product));
    act(() => result.current.resumeParkedSale(parkedId));

    expect(h.toastError).toHaveBeenCalledWith("Carrito ocupado", expect.anything());
    expect(result.current.parkedSales).toHaveLength(1);
    expect(result.current.cart.map((i) => i.id)).toEqual(["p2"]);
  });

  it("removeParkedSale deletes the entry and updates localStorage", () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(product()));
    act(() => result.current.parkSale());
    const parkedId = result.current.parkedSales[0].id;

    act(() => result.current.removeParkedSale(parkedId));
    expect(result.current.parkedSales).toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(PARKED_KEY)!)).toEqual([]);
  });
});
