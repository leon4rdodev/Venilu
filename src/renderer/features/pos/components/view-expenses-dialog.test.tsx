import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewExpensesDialog } from "./view-expenses-dialog";

const h = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  removeExpenseFromShift: vi.fn(),
  shiftExpenses: [] as any[],
}));

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: h.toastSuccess },
}));

vi.mock("../hooks/use-shift", () => ({
  useShift: () => ({
    shiftExpenses: h.shiftExpenses,
    removeExpenseFromShift: h.removeExpenseFromShift,
  }),
}));

vi.mock("@renderer/features/auth/hooks/use-permission", () => ({
  usePermission: () => true,
}));

const currentExpenses = [
  { id: "e1", amount: 150, reason: "Delivery", created_at: "2026-09-24T10:00:00" },
  { id: "e2", amount: 50, reason: "Hielo", created_at: "2026-09-24T11:00:00" },
];

function invokeMock(response: unknown) {
  const fn = vi.fn(async () => response);
  (window as any).ipcRenderer.invoke = fn;
  return fn;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.shiftExpenses = [...currentExpenses];
});

describe("ViewExpensesDialog", () => {
  it("lists current-shift expenses with total and offers undo per row", () => {
    render(<ViewExpensesDialog isOpen onClose={vi.fn()} />);
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Hielo")).toBeInTheDocument();
    expect(screen.getByText("RD$ 200.00")).toBeInTheDocument(); // total de ambas
    expect(screen.getAllByRole("button", { name: /Deshacer salida:/ })).toHaveLength(2);
  });

  it("undoes an expense with a two-step confirm: IPC + context removal + toast", async () => {
    const user = userEvent.setup();
    const invoke = invokeMock({ success: true });
    render(<ViewExpensesDialog isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Deshacer salida: Delivery" }));
    // Step 2: the confirm controls replace the amount on that row
    await user.click(screen.getByRole("button", { name: "Sí, deshacer" }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("shifts:delete-expense", { expenseId: "e1" })
    );
    expect(h.removeExpenseFromShift).toHaveBeenCalledWith("e1");
    expect(h.toastSuccess).toHaveBeenCalled();
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it("toasts the backend message and keeps the row when the undo fails", async () => {
    const user = userEvent.setup();
    invokeMock({ success: false, message: "No puedes deshacer salidas de un turno cerrado" });
    render(<ViewExpensesDialog isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Deshacer salida: Hielo" }));
    await user.click(screen.getByRole("button", { name: "Sí, deshacer" }));

    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("No puedes deshacer salidas de un turno cerrado")
    );
    expect(h.removeExpenseFromShift).not.toHaveBeenCalled();
    expect(screen.getByText("Hielo")).toBeInTheDocument();
  });

  it("hides undo controls when a historical shift list is passed", () => {
    render(<ViewExpensesDialog isOpen onClose={vi.fn()} expenses={currentExpenses} />);
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Deshacer salida:/ })).not.toBeInTheDocument();
  });
});
