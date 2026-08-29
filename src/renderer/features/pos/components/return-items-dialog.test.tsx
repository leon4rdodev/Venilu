import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReturnItemsDialog } from "./return-items-dialog";
import type { Sale } from "@shared/types/models";

const h = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: h.toastSuccess },
}));

// Venta con descuento: subtotal 200, total 180 → factor 0.9
const sale = {
  id: "1042",
  subtotal: 200,
  total_amount: 180,
  payment_method: "cash",
  status: "completed",
  ncf: "B0200000015",
} as unknown as Sale;

const saleItems = [
  { id: "i1", product_name: "Cerveza Presidente", quantity: 3, unit_price: 50 },
  { id: "i2", product_name: "Agua Planeta Azul", quantity: 1, unit_price: 50 },
];

function invokeMock(response: unknown) {
  const fn = vi.fn(async () => response);
  (window as any).ipcRenderer.invoke = fn;
  return fn;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function renderDialog(overrides: Partial<Parameters<typeof ReturnItemsDialog>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    transaction: sale,
    saleItems,
    alreadyReturned: { i2: 1 },
    onSuccess: vi.fn(),
    ...overrides,
  };
  const view = render(<ReturnItemsDialog {...props} />);
  return { props, view };
}

describe("ReturnItemsDialog", () => {
  it("renders the sale lines with sold/returned info and a pill for exhausted lines", () => {
    renderDialog();
    expect(screen.getByText("Devolver Artículos")).toBeInTheDocument();
    expect(screen.getByText("Venta #1042")).toBeInTheDocument();
    expect(screen.getByText(/Vendidos: 3 · Ya devueltos: 0/)).toBeInTheDocument();
    // The fully-returned line shows the pill and no stepper
    expect(screen.getByText(/Vendidos: 1 · Ya devueltos: 1/)).toBeInTheDocument();
    expect(screen.getByText("Devuelto")).toBeInTheDocument();
    // NCF sale announces the credit note
    expect(screen.getByText("Se emitirá una Nota de Crédito (B04).")).toBeInTheDocument();
  });

  it("caps the stepper at the remaining quantity and applies the sale discount factor", async () => {
    const user = userEvent.setup();
    renderDialog();

    const submit = screen.getByRole("button", { name: /Procesar Devolución/ });
    expect(submit).toBeDisabled();

    const plus = screen.getByRole("button", { name: /Agregar una unidad de Cerveza Presidente/ });
    await user.click(plus);
    await user.click(plus);
    expect(submit).toBeEnabled();
    // 2 × RD$50 × 0.9 = RD$90
    expect(screen.getByText("RD$ 90.00")).toBeInTheDocument();

    await user.click(plus); // 3 (max)
    expect(plus).toBeDisabled();
    expect(screen.getByText("RD$ 135.00")).toBeInTheDocument();
  });

  it("submits the return, toasts with the credit note, calls onSuccess and closes", async () => {
    const user = userEvent.setup();
    const invoke = invokeMock({
      success: true,
      returnId: "7",
      totalRefunded: 90,
      creditNoteNcf: "B0400000003",
    });
    const { props } = renderDialog();

    const plus = screen.getByRole("button", { name: /Agregar una unidad de Cerveza Presidente/ });
    await user.click(plus);
    await user.click(plus);
    await user.type(screen.getByLabelText(/Motivo/), "Producto defectuoso");
    await user.click(screen.getByRole("button", { name: /Procesar Devolución/ }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("sales:return", {
        saleId: "1042",
        items: [{ sale_item_id: "i1", quantity: 2 }],
        note: "Producto defectuoso",
      })
    );
    expect(h.toastSuccess).toHaveBeenCalledWith(
      "Devolución #7 procesada — RD$ 90.00 reembolsados · NC B0400000003"
    );
    expect(props.onSuccess).toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the backend message and stays open on failure", async () => {
    const user = userEvent.setup();
    invokeMock({ success: false, message: "Solo quedan 1 unidades por devolver" });
    const { props } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Agregar una unidad de Cerveza Presidente/ }));
    await user.click(screen.getByRole("button", { name: /Procesar Devolución/ }));

    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Solo quedan 1 unidades por devolver")
    );
    expect(props.onSuccess).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("resets quantities and note when reopened", async () => {
    const user = userEvent.setup();
    const { props, view } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Agregar una unidad de Cerveza Presidente/ }));
    await user.type(screen.getByLabelText(/Motivo/), "cambio de opinión");
    expect(screen.getByText("RD$ 45.00")).toBeInTheDocument();

    view.rerender(<ReturnItemsDialog {...props} open={false} />);
    view.rerender(<ReturnItemsDialog {...props} open={true} />);

    expect(screen.getByText("RD$ 0.00")).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo/)).toHaveValue("");
    expect(screen.getByRole("button", { name: /Procesar Devolución/ })).toBeDisabled();
  });
});
