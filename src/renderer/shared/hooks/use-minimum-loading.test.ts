import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMinimumLoading } from "./use-minimum-loading";

describe("useMinimumLoading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds true until the minimum window elapses when loading finishes early", () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useMinimumLoading(loading, 500),
      { initialProps: { loading: true } }
    );
    expect(result.current).toBe(true);

    // Real loading finishes after only 100ms
    act(() => vi.advanceTimersByTime(100));
    rerender({ loading: false });
    expect(result.current).toBe(true); // still held

    // 100 + 300 = 400ms < 500ms → still held
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe(true);

    // Crossing the 500ms mark releases the hold
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(false);
  });

  it("adds no extra wait when loading already lasted longer than the minimum", () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useMinimumLoading(loading, 500),
      { initialProps: { loading: true } }
    );

    act(() => vi.advanceTimersByTime(800));
    rerender({ loading: false });
    expect(result.current).toBe(false); // immediately, no residual timer

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });

  it("returns false with no flicker when it starts (and stays) not loading", () => {
    const { result } = renderHook(() => useMinimumLoading(false, 500));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });

  it("restarts the minimum window when loading begins again", () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useMinimumLoading(loading, 500),
      { initialProps: { loading: false } }
    );
    expect(result.current).toBe(false);

    rerender({ loading: true });
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    rerender({ loading: false });
    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });
});
