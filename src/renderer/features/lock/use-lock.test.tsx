import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, fireEvent } from "@testing-library/react";
import { ReactNode } from "react";
import { LockProvider, useLock } from "./use-lock";
import type { User } from "@shared/types/models";

// ─── Module mocks ────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  user: {
    current: { id: "u1", username: "cajero", name: "Cajero" } as unknown as {
      id: string;
      username: string;
      name: string;
    } | null,
  },
  invoke: vi.fn(),
}));

vi.mock("@renderer/features/auth", () => ({
  useUser: () => ({
    user: h.user.current as unknown as User | null,
    sessionReady: true,
    setUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@lib/ipc", () => ({
  ipc: { invoke: h.invoke },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOCK_KEY = "venilu_locked";

const wrapper = ({ children }: { children: ReactNode }) => (
  <LockProvider>{children}</LockProvider>
);

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  h.user.current = { id: "u1", username: "cajero", name: "Cajero" };
  h.invoke.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useLock", () => {
  it("arranca desbloqueado y lock() bloquea persistiendo la marca en sessionStorage", () => {
    const { result } = renderHook(() => useLock(), { wrapper });

    expect(result.current.locked).toBe(false);

    act(() => result.current.lock());

    expect(result.current.locked).toBe(true);
    expect(window.sessionStorage.getItem(LOCK_KEY)).toBe("1");
  });

  it("arranca bloqueado si la marca de sessionStorage existe (recargo de ventana)", () => {
    window.sessionStorage.setItem(LOCK_KEY, "1");

    const { result } = renderHook(() => useLock(), { wrapper });

    expect(result.current.locked).toBe(true);
  });

  it("Ctrl+L bloquea la pantalla", () => {
    const { result } = renderHook(() => useLock(), { wrapper });

    fireEvent.keyDown(window, { key: "l", ctrlKey: true });

    expect(result.current.locked).toBe(true);
  });

  it("unlock con contraseña incorrecta mantiene el bloqueo y devuelve el mensaje", async () => {
    h.invoke.mockResolvedValue({ success: false, message: "Credenciales inválidas." });
    const { result } = renderHook(() => useLock(), { wrapper });

    act(() => result.current.lock());

    let res: { success: boolean; message?: string } | undefined;
    await act(async () => {
      res = await result.current.unlock("mala");
    });

    expect(res).toEqual({ success: false, message: "Contraseña incorrecta." });
    expect(result.current.locked).toBe(true);
    expect(window.sessionStorage.getItem(LOCK_KEY)).toBe("1");
  });

  it("unlock correcto re-autentica por login-request, guarda el nuevo token y desbloquea", async () => {
    h.invoke.mockResolvedValue({
      success: true,
      data: { user: { id: "u1", username: "cajero" }, token: "nuevo-token" },
    });
    const { result } = renderHook(() => useLock(), { wrapper });

    act(() => result.current.lock());

    let res: { success: boolean; message?: string } | undefined;
    await act(async () => {
      res = await result.current.unlock("1234");
    });

    expect(h.invoke).toHaveBeenCalledWith("login-request", {
      username: "cajero",
      password: "1234",
    });
    expect(res).toEqual({ success: true });
    expect(window.localStorage.getItem("session_token")).toBe("nuevo-token");
    expect(result.current.locked).toBe(false);
    expect(window.sessionStorage.getItem(LOCK_KEY)).toBeNull();
  });

  it("unlock con error de IPC devuelve un mensaje y no desbloquea", async () => {
    h.invoke.mockRejectedValue(new Error("ipc down"));
    const { result } = renderHook(() => useLock(), { wrapper });

    act(() => result.current.lock());

    let res: { success: boolean; message?: string } | undefined;
    await act(async () => {
      res = await result.current.unlock("1234");
    });

    expect(res?.success).toBe(false);
    expect(result.current.locked).toBe(true);
  });

  it("mientras está bloqueado corta F1–F4 en fase de captura (los atajos del POS no actúan)", async () => {
    const posShortcut = vi.fn();
    window.addEventListener("keydown", posShortcut); // listener global tipo POS
    try {
      const { result } = renderHook(() => useLock(), { wrapper });

      act(() => result.current.lock());

      // El evento nace en el body (como al teclear con el overlay activo):
      // la captura en window lo corta antes de llegar a los listeners de burbuja.
      fireEvent.keyDown(document.body, { key: "F1" });
      expect(posShortcut).not.toHaveBeenCalled();

      // Desbloqueado, las teclas vuelven a fluir
      h.invoke.mockResolvedValue({
        success: true,
        data: { user: { id: "u1", username: "cajero" }, token: "t" },
      });
      await act(async () => {
        await result.current.unlock("1234");
      });
      fireEvent.keyDown(document.body, { key: "F1" });
      expect(posShortcut).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", posShortcut);
    }
  });

  it("sin usuario logueado, lock() y Ctrl+L no hacen nada", () => {
    h.user.current = null;
    const { result } = renderHook(() => useLock(), { wrapper });

    act(() => result.current.lock());
    fireEvent.keyDown(window, { key: "l", ctrlKey: true });

    expect(result.current.locked).toBe(false);
  });
});
