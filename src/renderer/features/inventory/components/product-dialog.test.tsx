import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductDialog } from "./product-dialog";
import { Product } from "@shared/types/models";

const parent = {
  id: "prod-1",
  name: "Refresco Rojo",
  sale_price: 100,
  cost_price: 60,
  stock: 10,
  category_id: "cat-1",
  itbis_exempt: true,
  min_stock: 5,
} as Product;

const variant = {
  id: "var-1",
  name: "Refresco Rojo Pequeño",
  variant_name: "Pequeño 250ml",
  parent_product_id: "prod-1",
  sale_price: 50,
  cost_price: 30,
  stock: 24,
  category_id: "cat-1",
  itbis_exempt: true,
  min_stock: 5,
} as Product;

function mockIpc() {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === "get-categories") {
      return { success: true, data: [{ id: "cat-1", name: "Bebidas" }] };
    }
    if (channel === "get-product-variants") {
      return { success: true, data: [variant] };
    }
    return { success: true, data: null };
  });
  (window as unknown as { ipcRenderer: { invoke: unknown } }).ipcRenderer.invoke = invoke;
  return invoke;
}

type DialogProps = Partial<Parameters<typeof ProductDialog>[0]>;

function renderDialog(props: DialogProps = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProductDialog
        open
        onOpenChange={() => {}}
        product={null}
        onSave={() => {}}
        {...props}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProductDialog — presentaciones", () => {
  it("prefills the variant-creation mode from the parent", async () => {
    mockIpc();
    renderDialog({ variantParent: parent });

    // Nombre heredado como prefijo + banner con el nombre del padre
    expect(screen.getByLabelText("Nombre del Producto")).toHaveValue("Refresco Rojo ");
    expect(screen.getByText(/Presentación de/)).toBeInTheDocument();
    expect(screen.getByText("Refresco Rojo")).toBeInTheDocument();

    // Campo propio del modo presentación + ITBIS heredado
    expect(screen.getByLabelText("Nombre de presentación")).toHaveValue("");
    expect(screen.getByLabelText("Exento de ITBIS")).toHaveAttribute("aria-checked", "true");

    // La categoría del padre queda seleccionada
    await waitFor(() => expect(screen.getByText("Bebidas")).toBeInTheDocument());
  });

  it("requires the variant name and sends parent_product_id + variant_name on save", async () => {
    mockIpc();
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderDialog({ variantParent: parent, onSave });

    await user.type(screen.getByLabelText("Precio de Compra ($)"), "30");
    await user.type(screen.getByLabelText("Precio de Venta ($)"), "50");
    await user.type(screen.getByLabelText("Stock"), "24");

    const saveButton = screen.getByRole("button", { name: "Agregar Presentación" });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText("Nombre de presentación"), "Pequeño 250ml");
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_product_id: "prod-1",
        variant_name: "Pequeño 250ml",
        itbis_exempt: true,
        sale_price: 50,
        stock: 24,
      })
    );
  });

  it("lists the parent's variants and wires the edit/add actions", async () => {
    mockIpc();
    const onEditVariant = vi.fn();
    const onAddVariant = vi.fn();
    const user = userEvent.setup();
    renderDialog({ product: parent, onEditVariant, onAddVariant });

    await waitFor(() => expect(screen.getByText("Pequeño 250ml")).toBeInTheDocument());
    expect(screen.getByText("Refresco Rojo Pequeño")).toBeInTheDocument();

    await user.click(screen.getByTitle("Editar presentación"));
    expect(onEditVariant).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "var-1",
        parent: expect.objectContaining({ id: "prod-1" }),
      })
    );

    await user.click(screen.getByRole("button", { name: "Agregar presentación" }));
    expect(onAddVariant).toHaveBeenCalledWith(expect.objectContaining({ id: "prod-1" }));
  });

  it("shows the parent banner and the variant name when editing a variant", () => {
    mockIpc();
    renderDialog({ product: { ...variant, parent } as Product });

    expect(screen.getByText(/Presentación de/)).toBeInTheDocument();
    expect(screen.getByText("Refresco Rojo")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de presentación")).toHaveValue("Pequeño 250ml");
  });
});
