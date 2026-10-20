import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetToasts, toast, useToasts } from "./toast-store";

beforeEach(() => {
  vi.useFakeTimers();
  resetToasts();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toast store", () => {
  it("shows, updates and dismisses a toast, removing it after its exit animation", () => {
    const { result } = renderHook(() => useToasts());

    let id = "";
    act(() => {
      id = toast.show({ title: "PDF", progress: { done: 0, total: 28 } });
    });
    expect(result.current).toMatchObject([{ id, title: "PDF", open: true }]);

    act(() => {
      toast.update(id, { progress: { done: 14, total: 28 } });
    });
    expect(result.current[0]?.progress).toEqual({ done: 14, total: 28 });

    act(() => {
      toast.dismiss(id);
    });
    expect(result.current[0]?.open).toBe(false);

    act(() => {
      vi.runAllTimers();
    });
    expect(result.current).toEqual([]);
  });

  it("keeps at most three open, closing the oldest first", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      for (const title of ["one", "two", "three", "four"]) toast.show({ title });
    });
    expect(result.current.filter((record) => record.open).map((record) => record.title)).toEqual([
      "two",
      "three",
      "four",
    ]);
  });
});
