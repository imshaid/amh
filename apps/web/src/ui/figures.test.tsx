import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { setLanguage } from "@/i18n/i18n";
import { renderUi } from "@/test/render-ui";

import { KpiTile } from "./kpi-tile";
import { Meter } from "./meter";
import { ProgressSteps } from "./progress-steps";

beforeEach(async () => {
  await setLanguage("bn");
});

describe("KpiTile", () => {
  it("settles on the exact amount from the server and states the change in words", async () => {
    renderUi(
      <KpiTile
        label="বাজারে আটকে আছে"
        value="238367.20"
        delta={{
          percent: "13.5",
          direction: "down",
          favourable: false,
          comparison: "আগস্টের তুলনায়",
        }}
      />,
    );
    // While counting, screen readers already get the exact amount; once settled, everyone does.
    expect(screen.getByText("৳২,৩৮,৩৬৭.২০")).toHaveClass("sr-only");
    await waitFor(() => {
      expect(screen.getByText("৳২,৩৮,৩৬৭.২০")).not.toHaveClass("sr-only");
    });
    expect(screen.getByText("কমেছে")).toHaveClass("sr-only");
    expect(screen.getByText("১৩.৫%", { exact: false })).toBeInTheDocument();
  });
});

describe("Meter", () => {
  it("reports its value to assistive technology", () => {
    renderUi(<Meter value={7} max={12} label="আজকের ডেলিভারি" valueText="১২টার মধ্যে ৭টা" />);
    const meter = screen.getByRole("progressbar", { name: "আজকের ডেলিভারি" });
    expect(meter).toHaveAttribute("aria-valuenow", "7");
    expect(meter).toHaveAttribute("aria-valuemax", "12");
    expect(meter).toHaveAttribute("aria-valuetext", "১২টার মধ্যে ৭টা");
  });
});

describe("ProgressSteps", () => {
  it("marks the step in progress and says which steps are done", () => {
    renderUi(
      <ProgressSteps
        label="অর্ডারের ধাপ"
        current={2}
        steps={[
          { id: "order", label: "অর্ডার" },
          { id: "delivery", label: "ডেলিভারি" },
          { id: "bill", label: "বিল" },
          { id: "payment", label: "জমা" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "অর্ডারের ধাপ" });
    const current = list.querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent("বিলএখন চলছে");
    expect(screen.getAllByText("শেষ হয়েছে")).toHaveLength(2);
    expect(screen.getAllByText("বাকি")).toHaveLength(1);
  });
});
