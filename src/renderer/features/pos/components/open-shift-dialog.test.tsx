import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpenShiftDialog } from "./open-shift-dialog";

const h = vi.hoisted(() => ({
  openShift: vi.fn(async (_cash: number) => ({ success: true } as any)),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../hooks/use-shift", () => ({
  useShift: () => ({ openShift: h.openShift }),
}));

vi.mock("@renderer/features/auth", () => ({
  useUser: () => ({ user: { id: "u1", username: "ana" } }),
}));

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: h.toastSuccess },
}));

function mockLastClosed(data: unknown) {
  (window as any).ipcRenderer.invoke = vi.fn(async (channel: string) => {
    if (channel === "shifts:getLastClosed") return { success: true, data };
    return { success: true, data: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  h.openShift.mockResolvedValue({ success: true });
  mockLastClosed(null);
});

const lastClosed = {
  id: "s1",
  end_time: new Date().toISOString(),
  initial_cash: 1000,
  final_cash: 3450.75,
};

describe("OpenShiftDialog", () => {
  it("renders the responsible user and the cash input", async () => {
    render(<OpenShiftDialog isOpen />);
    expect(screen.getByText("Abrir Caja")).toBeInTheDocument();
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
  });

  it("suggests the cash from the last closed shift and fills the input on click", async () => {
    mockLastClosed(lastClosed);
    render(<OpenShiftDialog isOpen />);

    const suggestion = await screen.findByText("Efectivo del último cierre");
    // Formatted with the default currency (DOP)
    expect(screen.getByText("RD$ 3,450.75")).toBeInTheDocument();

    fireEvent.click(suggestion.closest("button")!);
    expect(screen.getByPlaceholderText("0.00")).toHaveValue("3450.75");
    expect(screen.getByRole("button", { name: /Iniciar Turno/ })).toBeEnabled();
  });

  it("shows no suggestion when there is no closed shift", async () => {
    render(<OpenShiftDialog isOpen />);
    await waitFor(() =>
      expect((window as any).ipcRenderer.invoke).toHaveBeenCalledWith("shifts:getLastClosed")
    );
    expect(screen.queryByText("Efectivo del último cierre")).not.toBeInTheDocument();
  });

  it("keeps the submit button disabled without a valid amount", async () => {
    const user = userEvent.setup();
    render(<OpenShiftDialog isOpen />);

    const submit = screen.getByRole("button", { name: /Iniciar Turno/ });
    expect(submit).toBeDisabled();

    const input = screen.getByPlaceholderText("0.00");
    await user.type(input, "150.25");
    expect(submit).toBeEnabled();

    await user.clear(input);
    expect(submit).toBeDisabled();
  });

  it("rejects non-numeric input and more than two decimals", async () => {
    const user = userEvent.setup();
    render(<OpenShiftDialog isOpen />);
    const input = screen.getByPlaceholderText("0.00");

    await user.type(input, "abc");
    expect(input).toHaveValue("");
    await user.type(input, "12.345");
    expect(input).toHaveValue("12.34"); // third decimal ignored
  });

  it("calls openShift with the parsed number and closes on success", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<OpenShiftDialog isOpen onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("0.00"), "200.50");
    await user.click(screen.getByRole("button", { name: /Iniciar Turno/ }));

    await waitFor(() => expect(h.openShift).toHaveBeenCalledWith(200.5));
    expect(h.toastSuccess).toHaveBeenCalledWith("Turno iniciado", expect.anything());
    expect(onClose).toHaveBeenCalled();
  });

  it("submits with Enter from the input", async () => {
    const user = userEvent.setup();
    render(<OpenShiftDialog isOpen />);

    const input = screen.getByPlaceholderText("0.00");
    await user.type(input, "500{Enter}");
    await waitFor(() => expect(h.openShift).toHaveBeenCalledWith(500));
  });

  it("Enter does nothing without a valid amount", async () => {
    const user = userEvent.setup();
    render(<OpenShiftDialog isOpen />);
    await user.type(screen.getByPlaceholderText("0.00"), "{Enter}");
    expect(h.openShift).not.toHaveBeenCalled();
  });

  it("quick-select buttons fill the input", async () => {
    render(<OpenShiftDialog isOpen />);
    fireEvent.click(screen.getByRole("button", { name: "RD$ 2,000.00" }));
    expect(screen.getByPlaceholderText("0.00")).toHaveValue("2000");
    expect(screen.getByRole("button", { name: /Iniciar Turno/ })).toBeEnabled();
  });

  it("shows an error toast and stays open when openShift fails", async () => {
    const user = userEvent.setup();
    h.openShift.mockResolvedValue({ success: false, message: "Ya hay un turno abierto" });
    const onClose = vi.fn();
    render(<OpenShiftDialog isOpen onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("0.00"), "100");
    await user.click(screen.getByRole("button", { name: /Iniciar Turno/ }));

    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Error al abrir turno", {
        description: "Ya hay un turno abierto",
      })
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
