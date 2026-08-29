import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const h = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => h.navigate };
});

type Handler = (payload?: any) => any;

/** Redefines the ipcRenderer.invoke stub with per-channel handlers. */
function mockIpc(handlers: Record<string, Handler>) {
  const invoke = vi.fn(async (channel: string, payload?: any) => {
    const handler = handlers[channel];
    if (handler) return handler(payload);
    return { success: true, data: null };
  });
  (window as any).ipcRenderer.invoke = invoke;
  return invoke;
}

const ana = { id: "u1", name: "Ana Gómez", username: "ana", roleLabel: "Administradora" };
const bob = { id: "u2", name: "Bob Pérez", username: "bob", roleLabel: "Cajero" };

const defaultHandlers = {
  "settings:get": () => ({ success: true, data: {} }),
  "login:list-users": () => ({ success: true, data: [ana, bob] }),
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("LoginPage · user picker", () => {
  it("renders one tile per user with name and role", async () => {
    mockIpc(defaultHandlers);
    render(<LoginPage onLogin={vi.fn(async () => {})} />);

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Bob Pérez")).toBeInTheDocument();
    expect(screen.getByText("Administradora")).toBeInTheDocument();
    expect(screen.getByText("Cajero")).toBeInTheDocument();
    expect(screen.getByText("Selecciona tu usuario para continuar")).toBeInTheDocument();
  });

  it("marks the last-used account with the 'Último acceso' pill and sorts it first", async () => {
    window.localStorage.setItem("venilu_last_username", "bob");
    mockIpc(defaultHandlers);
    render(<LoginPage onLogin={vi.fn(async () => {})} />);

    const pill = await screen.findByText("Último acceso");
    const bobTile = pill.closest("button")!;
    expect(within(bobTile).getByText("Bob Pérez")).toBeInTheDocument();

    // Bob (last used) is listed before Ana
    const tiles = screen.getAllByRole("button").filter((b) => b.textContent?.includes("Pérez") || b.textContent?.includes("Gómez"));
    expect(tiles[0]).toHaveTextContent("Bob Pérez");
  });

  it("clicking a tile moves to the password step with that user pinned, and 'Cambiar' goes back", async () => {
    const user = userEvent.setup();
    mockIpc(defaultHandlers);
    render(<LoginPage onLogin={vi.fn(async () => {})} />);

    await user.click(await screen.findByText("Ana Gómez"));

    // Password step: pinned user card + password field, no picker
    expect(screen.getByText("Ingresa tu contraseña para continuar")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Bob Pérez")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cambiar/ }));
    expect(await screen.findByText("Bob Pérez")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
  });

  it("with a single account it skips the picker and hides 'Cambiar'", async () => {
    mockIpc({ ...defaultHandlers, "login:list-users": () => ({ success: true, data: [ana] }) });
    render(<LoginPage onLogin={vi.fn(async () => {})} />);

    expect(await screen.findByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cambiar/ })).not.toBeInTheDocument();
    // No user picker step
    expect(screen.queryByText("Selecciona tu usuario para continuar")).not.toBeInTheDocument();
  });

  it("falls back to a manual username+password form when the user list fails", async () => {
    mockIpc({ ...defaultHandlers, "login:list-users": () => ({ success: false }) });
    render(<LoginPage onLogin={vi.fn(async () => {})} />);

    expect(await screen.findByLabelText("Usuario")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });
});

describe("LoginPage · submit", () => {
  it("logs in the selected user, persists the session token and last username, then navigates", async () => {
    const user = userEvent.setup();
    const invoke = mockIpc({
      ...defaultHandlers,
      "login-request": (payload: any) => ({
        success: true,
        data: { user: { id: "u1", username: payload.username }, token: "tok-123" },
      }),
    });
    const onLogin = vi.fn(async () => {});
    render(<LoginPage onLogin={onLogin} />);

    await user.click(await screen.findByText("Ana Gómez"));
    await user.type(screen.getByLabelText("Contraseña"), "secreta");
    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/ }));

    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/dashboard"));
    expect(invoke).toHaveBeenCalledWith("login-request", { username: "ana", password: "secreta" });
    expect(window.localStorage.getItem("session_token")).toBe("tok-123");
    expect(window.localStorage.getItem("venilu_last_username")).toBe("ana");
    expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ username: "ana" }));
  });

  it("shows the backend error and clears the password on bad credentials", async () => {
    const user = userEvent.setup();
    mockIpc({
      ...defaultHandlers,
      "login-request": () => ({ success: false, message: "Credenciales inválidas." }),
    });
    const onLogin = vi.fn(async () => {});
    render(<LoginPage onLogin={onLogin} />);

    await user.click(await screen.findByText("Ana Gómez"));
    const passwordInput = screen.getByLabelText("Contraseña");
    await user.type(passwordInput, "mala");
    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/ }));

    expect(await screen.findByText("Credenciales inválidas.")).toBeInTheDocument();
    expect(passwordInput).toHaveValue("");
    expect(onLogin).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("session_token")).toBeNull();
  });

  it("submits the typed username in manual fallback mode", async () => {
    const user = userEvent.setup();
    const invoke = mockIpc({
      ...defaultHandlers,
      "login:list-users": () => {
        throw new Error("ipc down");
      },
      "login-request": () => ({
        success: true,
        data: { user: { id: "u9", username: "manual" }, token: "tok-9" },
      }),
    });
    render(<LoginPage onLogin={vi.fn(async () => {})} />);

    await user.type(await screen.findByLabelText("Usuario"), "manual");
    await user.type(screen.getByLabelText("Contraseña"), "clave");
    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/ }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("login-request", { username: "manual", password: "clave" })
    );
  });

  it("disables the submit button until credentials are complete", async () => {
    const user = userEvent.setup();
    mockIpc(defaultHandlers);
    render(<LoginPage onLogin={vi.fn(async () => {})} />);

    await user.click(await screen.findByText("Ana Gómez"));
    const submit = screen.getByRole("button", { name: /Iniciar Sesión/ });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Contraseña"), "x");
    expect(submit).toBeEnabled();
  });
});
