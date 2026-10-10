import { describe, it, expect, vi, beforeEach } from "vitest";
import { printTicket } from "./print-ticket";

const h = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: h.toastSuccess, error: h.toastError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { ipcRenderer: unknown }).ipcRenderer = {
    invoke: vi.fn(async () => ({ success: true })),
    send: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };
});

describe("printTicket", () => {
  it("prints the receipt and notifies success", async () => {
    const invoke = vi.fn(async () => ({ success: true }));
    (window as unknown as { ipcRenderer: { invoke: unknown } }).ipcRenderer =
      { invoke };

    await expect(printTicket("S1")).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("print-receipt", { saleId: "S1" });
    expect(h.toastSuccess).toHaveBeenCalledWith("Ticket impreso correctamente");
  });

  it("notifies the backend error message when printing fails", async () => {
    (window as unknown as { ipcRenderer: { invoke: unknown } }).ipcRenderer = {
      invoke: vi.fn(async () => ({ success: false, message: "Sin papel" })),
    };

    await expect(printTicket("S2")).resolves.toBe(false);
    expect(h.toastError).toHaveBeenCalledWith(
      "Error al imprimir",
      expect.objectContaining({ description: "Sin papel" }),
    );
  });

  it("notifies when the printing system is unavailable", async () => {
    (window as unknown as { ipcRenderer: unknown }).ipcRenderer = undefined;

    await expect(printTicket("S3")).resolves.toBe(false);
    expect(h.toastError).toHaveBeenCalledWith(
      "Error al imprimir",
      expect.objectContaining({
        description: "Sistema de impresión no disponible",
      }),
    );
  });

  it("notifies a generic error when the IPC call throws", async () => {
    (window as unknown as { ipcRenderer: { invoke: unknown } }).ipcRenderer = {
      invoke: vi.fn(async () => {
        throw new Error("boom");
      }),
    };

    await expect(printTicket("S4")).resolves.toBe(false);
    expect(h.toastError).toHaveBeenCalledWith("Error al imprimir");
  });
});
