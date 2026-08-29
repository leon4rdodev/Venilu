import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrintLabelsDialog } from "./print-labels-dialog";
import { Product } from "@shared/types/models";

// jsdom cannot rasterize barcodes — stub JsBarcode to mark the SVG instead.
vi.mock("jsbarcode", () => ({
  default: vi.fn((element: SVGElement, value: string) => {
    element.setAttribute("data-barcode-value", value);
  }),
}));

const product = {
  id: "p1",
  name: "Café Molido <500g>",
  sale_price: 250,
  stock: 12,
  barcode: "7401234567890",
  sku: "CAF-500",
} as Product;

function mockIpc(overrides: Record<string, unknown> = {}) {
  const invoke = vi.fn(async (channel: string, ..._args: unknown[]) => {
    if (channel === "settings:get") {
      return { success: true, data: { paper_size: "80mm" } };
    }
    if (channel === "print-labels") {
      return { success: true, ...overrides };
    }
    return { success: true, data: null };
  });
  (window as unknown as { ipcRenderer: { invoke: unknown } }).ipcRenderer.invoke = invoke;
  return invoke;
}

function renderDialog(ui: { open?: boolean; product?: Product | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PrintLabelsDialog
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

describe("PrintLabelsDialog", () => {
  it("renders nothing without a product", () => {
    mockIpc();
    renderDialog({ product: null });
    expect(screen.queryByText("Imprimir Etiquetas")).not.toBeInTheDocument();
  });

  it("shows the disabled state when the product has neither barcode nor SKU", () => {
    mockIpc();
    renderDialog({ product: { ...product, barcode: undefined, sku: undefined } as Product });

    expect(screen.getByText("Este producto no tiene código de barras ni SKU")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimir Etiquetas" })).toBeDisabled();
  });

  it("falls back to the SKU when there is no barcode", async () => {
    const invoke = mockIpc();
    const user = userEvent.setup();
    renderDialog({ product: { ...product, barcode: undefined } as Product });

    await user.click(screen.getByRole("button", { name: "Imprimir Etiquetas" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("print-labels", expect.anything()));
    const [, payload] = invoke.mock.calls.find(([channel]) => channel === "print-labels")!;
    expect((payload as { html: string }).html).toContain("CAF-500");
  });

  it("prints N escaped label blocks on the configured paper", async () => {
    const invoke = mockIpc();
    const user = userEvent.setup();
    renderDialog();

    const quantityInput = screen.getByLabelText("Cantidad de etiquetas");
    await user.clear(quantityInput);
    await user.type(quantityInput, "3");
    await user.click(screen.getByRole("button", { name: "Imprimir Etiquetas" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("print-labels", expect.anything()));
    const [, payload] = invoke.mock.calls.find(([channel]) => channel === "print-labels")!;
    const html = (payload as { html: string }).html;

    // Name is HTML-escaped and repeated once per label
    const escapedName = "Café Molido &lt;500g&gt;";
    expect(html.split(escapedName).length - 1).toBe(3);
    expect(html).not.toContain("<500g>");
    expect(html.split('class="label"').length - 1).toBe(3);
    expect(html).toContain("@page { size: 80mm auto; margin: 0; }");
  });

  it("blocks printing for an out-of-range quantity", async () => {
    mockIpc();
    const user = userEvent.setup();
    renderDialog();

    const quantityInput = screen.getByLabelText("Cantidad de etiquetas");
    await user.clear(quantityInput);
    await user.type(quantityInput, "99");

    expect(screen.getByText(/Ingresa una cantidad entre 1 y 50/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimir Etiquetas" })).toBeDisabled();
  });

  it("shows an error toast message when printing fails", async () => {
    const invoke = mockIpc({ success: false, message: "Sin impresora" });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Imprimir Etiquetas" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("print-labels", expect.anything()));
    // Dialog stays open (button back to idle) after a failed print
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Imprimir Etiquetas" })).toBeEnabled()
    );
  });
});
