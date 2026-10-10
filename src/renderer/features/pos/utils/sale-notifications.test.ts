import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyQuickSaleSuccess } from "./sale-notifications";

const h = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: h.toastSuccess, error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyQuickSaleSuccess", () => {
  it("notifies a cash sale with its sale id", () => {
    notifyQuickSaleSuccess({ saleId: "S1" }, "cash");
    expect(h.toastSuccess).toHaveBeenCalledWith(
      "Venta exitosa",
      expect.objectContaining({
        description: expect.stringContaining("Venta #S1 procesada correctamente."),
      }),
    );
  });

  it("notifies a credit sale with the customer name", () => {
    notifyQuickSaleSuccess({ saleId: "S2" }, "credit", "María");
    expect(h.toastSuccess).toHaveBeenCalledWith(
      "Venta a crédito registrada",
      expect.objectContaining({
        description: expect.stringContaining("a crédito para María."),
      }),
    );
  });

  it("appends the issued NCF to the description", () => {
    notifyQuickSaleSuccess({ saleId: "S3", ncf: "B0200000001" }, "transfer");
    expect(h.toastSuccess).toHaveBeenCalledWith(
      "Venta exitosa",
      expect.objectContaining({
        description: expect.stringContaining("NCF B0200000001"),
      }),
    );
  });
});
