import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLanguage } from "@/i18n/i18n";
import { renderUi } from "@/test/render-ui";

import { ConfirmButton } from "./confirm-button";
import { Dialog } from "./dialog";
import { Field } from "./field";
import { Button } from "./button";
import { Input } from "./input";
import { OrderStatusPill } from "./pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

beforeEach(async () => {
  await setLanguage("bn");
});

describe("Field", () => {
  it("labels its control and links the hint and the error", () => {
    renderUi(
      <Field label="PO নম্বর" hint="যেমন PBD-2794325" error="নম্বরটা মিলছে না" required>
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "PO নম্বর" });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("নম্বরটা মিলছে না যেমন PBD-2794325");
  });
});

describe("Tabs", () => {
  it("moves between tabs with the arrow keys and shows the chosen panel", async () => {
    const user = userEvent.setup();
    renderUi(
      <Tabs defaultValue="schedule">
        <TabsList aria-label="অর্ডারের অংশ">
          <TabsTrigger value="schedule">শিডিউল</TabsTrigger>
          <TabsTrigger value="bill">বিল</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule">সারি</TabsContent>
        <TabsContent value="bill">বিলের প্রিভিউ</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "শিডিউল" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "শিডিউল" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "বিল" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("বিলের প্রিভিউ");
  });
});

describe("Dialog", () => {
  it("opens from its trigger, closes with Esc and gives focus back", async () => {
    const user = userEvent.setup();
    renderUi(
      <Dialog trigger={<Button>বাতিল</Button>} title="অর্ডার বাতিল করবেন?" description="REACTS-IN">
        <p>ইতিহাসে থেকে যাবে</p>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "বাতিল" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "অর্ডার বাতিল করবেন?" });
    expect(dialog).toHaveAccessibleDescription("REACTS-IN");
    expect(within(dialog).getByRole("button", { name: "বন্ধ করুন" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});

describe("ConfirmButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks on the first press, acts on the second, and disarms by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const onConfirm = vi.fn();
    renderUi(
      <ConfirmButton confirmLabel="নিশ্চিত? আবার চাপুন" onConfirm={onConfirm}>
        মুছুন
      </ConfirmButton>,
    );

    await user.click(screen.getByRole("button", { name: "মুছুন" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "নিশ্চিত? আবার চাপুন" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole("button", { name: "মুছুন" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "মুছুন" }));
    await user.click(screen.getByRole("button", { name: "নিশ্চিত? আবার চাপুন" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("OrderStatusPill", () => {
  it("names every status in words, in the UI language", async () => {
    const { rerender } = renderUi(<OrderStatusPill status="billed" />);
    expect(screen.getByText("বিল ইস্যু · জমা বাকি")).toBeInTheDocument();

    await setLanguage("en");
    rerender(<OrderStatusPill status="partially_paid" />);
    expect(screen.getByText("Partly paid")).toBeInTheDocument();
  });
});
