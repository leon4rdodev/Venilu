import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StockMovementsDialog } from "./stock-movements-dialog";
import { Product, StockMovementEntry } from "@shared/types/models";

const product = {
  id: "p1",
  name: "Café Molido 500g",
  sale_price: 250,
  stock: 12,
} as Product;

const movements: StockMovementEntry[] = [
  {
    id: "m1",
    product_id: "p1",
    type: "sale",
    quantity_delta: -2,
    stock_after: 12,
    reference: "1042",
    username: "ana",
    note: null,
    // IPC structured-clone delivers entity dates as REAL Date objects — this
    // case is the regression guard for the white-screen crash.
    created_at: new Date("2026-01-10T09:30:00") as unknown as string,
  },
  {
    id: "m2",
    product_id: "p1",
    type: "adjustment",
    quantity_delta: 5,
    stock_after: 14,
    reference: null,
    username: "leo",
    note: "Reposición",
    created_at: "2026-01-09 18:00:00",
  },
];

function mockMovements(items: StockMovementEntry[], total = items.length) {
  const invoke = vi.fn(async (channel: string, _args?: unknown) => {
    if (channel === "get-stock-movements") {
      return {
        success: true,
        data: { items, total, page: 1, pageSize: 15, totalPages: Math.max(1, Math.ceil(total / 15)) },
      };
    }
    return { success: true, data: null };
  });
  (window as any).ipcRenderer.invoke = invoke;
  return invoke;
}

function renderDialog(ui: { open?: boolean; product?: Product | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StockMovementsDialog
        open={ui.open ?? true}
        onOpenChange={() => {}}
        product={ui.product === undefined ? product : ui.product}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StockMovementsDialog", () => {
  it("renders nothing without a product", () => {
    renderDialog({ product: null });
    expect(screen.queryByText("Movimientos de Stock")).not.toBeInTheDocument();
  });

  it("shows header with product name and current stock, then the movement rows", async () => {
    const invoke = mockMovements(movements);
    renderDialog();

    expect(screen.getByText("Movimientos de Stock")).toBeInTheDocument();
    expect(screen.getByText(/Café Molido 500g/)).toBeInTheDocument();

    // Rows appear after the minimum-loading window (500ms)
    expect(await screen.findByText("Venta", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText("Ajuste")).toBeInTheDocument();

    // Signed deltas with the resulting stock
    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();

    // Detail: sale reference + username / note + username
    expect(screen.getByText("Venta #1042 · ana")).toBeInTheDocument();
    expect(screen.getByText("Reposición · leo")).toBeInTheDocument();

    expect(invoke).toHaveBeenCalledWith("get-stock-movements", {
      productId: "p1",
      page: 1,
      pageSize: 15,
    });
  });

  it("shows the empty state when there are no movements", async () => {
    mockMovements([]);
    renderDialog();

    expect(
      await screen.findByText("Sin movimientos registrados", {}, { timeout: 2000 })
    ).toBeInTheDocument();
  });

  it("does not fetch while closed", async () => {
    const invoke = mockMovements(movements);
    renderDialog({ open: false });

    await waitFor(() => expect(invoke).not.toHaveBeenCalled());
  });
});
