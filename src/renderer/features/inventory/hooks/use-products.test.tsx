import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProducts } from "./use-products";

const h = vi.hoisted(() => ({
  loadCategories: vi.fn(async () => {}),
}));

vi.mock("@renderer/features/settings", () => ({
  useCategories: () => ({
    categories: [{ id: 7, name: "Bebidas" }],
    loadCategories: h.loadCategories,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const emptyPage = {
  products: [{ id: "p1", name: "Café" }],
  pagination: {
    currentPage: 1,
    pageSize: 12,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

let invoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  invoke = vi.fn(async (channel: string) => {
    if (channel === "get-products") return { success: true, data: emptyPage };
    return { success: true, data: null };
  });
  (window as any).ipcRenderer.invoke = invoke;
});

describe("useProducts", () => {
  it("fetches page 1 with the default filters and exposes the products", async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("get-products", {
        page: 1,
        pageSize: 12,
        search: "",
        category: "all",
        sortBy: "name",
        sortOrder: "ASC",
        stockFilter: "all",
      })
    );
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.pagination.totalItems).toBe(1);
  });

  it("debounces the search and queries with the new term", async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() });
    await waitFor(() => expect(invoke).toHaveBeenCalled());

    act(() => result.current.setSearchQuery("cafe"));
    // Debounced 300ms — the query with the term arrives after the delay
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "get-products",
        expect.objectContaining({ search: "cafe", page: 1 })
      )
    );
  });

  it("requests the selected page on handlePageChange", async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() });
    await waitFor(() => expect(invoke).toHaveBeenCalled());

    act(() => result.current.handlePageChange(3));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "get-products",
        expect.objectContaining({ page: 3 })
      )
    );
  });

  it("resets to page 1 when a filter changes", async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() });
    await waitFor(() => expect(invoke).toHaveBeenCalled());

    act(() => result.current.handlePageChange(2));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("get-products", expect.objectContaining({ page: 2 }))
    );

    act(() => result.current.setStockFilter("low"));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "get-products",
        expect.objectContaining({ page: 1, stockFilter: "low" })
      )
    );
  });

  it("changing the page size goes back to page 1 with the new size", async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() });
    await waitFor(() => expect(invoke).toHaveBeenCalled());

    act(() => result.current.handlePageChange(2));
    act(() => result.current.handlePageSizeChange(24));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "get-products",
        expect.objectContaining({ page: 1, pageSize: 24 })
      )
    );
  });

  it("prepends the 'Todas las categorías' option to the category list", async () => {
    const { result } = renderHook(() => useProducts(), { wrapper: createWrapper() });
    expect(result.current.categories).toEqual([
      { id: "all", name: "Todas las categorías" },
      { id: "7", name: "Bebidas" },
    ]);
  });

  it("persists the view mode in localStorage and reads it back on init", async () => {
    const first = renderHook(() => useProducts(), { wrapper: createWrapper() });
    expect(first.result.current.viewMode).toBe("grid");

    act(() => first.result.current.setViewMode("table"));
    expect(window.localStorage.getItem("venilu_inventory_view")).toBe("table");
    first.unmount();

    const second = renderHook(() => useProducts(), { wrapper: createWrapper() });
    expect(second.result.current.viewMode).toBe("table");
  });
});
