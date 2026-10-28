import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import "@/i18n/i18n";

import { Avatar } from "./avatar";
import { Checkbox } from "./checkbox";
import { Field } from "./field";
import { PinInput } from "./pin-input";

function Pin({ onComplete, error }: { onComplete?: (pin: string) => void; error?: string }) {
  const [value, setValue] = useState("");
  return (
    <Field label="পিন" error={error}>
      <PinInput value={value} onValueChange={setValue} onComplete={onComplete} />
    </Field>
  );
}

describe("PinInput", () => {
  it("takes digits only, Bangla or Latin, up to six", async () => {
    const user = userEvent.setup();
    render(<Pin />);
    const input = screen.getByLabelText("পিন");

    await user.type(input, "4a8২9-1৩77");
    expect(input).toHaveValue("482913");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("type", "password");
  });

  it("reports the completed PIN once", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(pin: string) => void>();
    render(<Pin onComplete={onComplete} />);

    await user.type(screen.getByLabelText("পিন"), "4829135");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("482913");
  });

  it("shows the digits on request", async () => {
    const user = userEvent.setup();
    render(<Pin />);
    const toggle = screen.getByRole("button", { name: "পিন দেখান" });

    await user.click(toggle);
    expect(screen.getByLabelText("পিন")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "পিন লুকান" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("takes the field's error", () => {
    render(<Pin error="ভুল" />);
    const input = screen.getByLabelText("পিন");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("ভুল");
  });
});

describe("Checkbox", () => {
  it("toggles from its label and is described by its hint", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn<(checked: boolean) => void>();
    render(
      <Checkbox
        label="এই ডিভাইসে লগ ইন থাকুক"
        hint="অন্যের ফোনে টিক তুলে দিন"
        checked
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "এই ডিভাইসে লগ ইন থাকুক" });
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAccessibleDescription("অন্যের ফোনে টিক তুলে দিন");
    await user.click(screen.getByText("এই ডিভাইসে লগ ইন থাকুক"));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});

describe("Avatar", () => {
  it("shows the first letter as people read it", () => {
    const { container } = render(
      <>
        <Avatar name="জিয়া" />
        <Avatar name=" alif" />
      </>,
    );
    expect([...container.querySelectorAll("span")].map((span) => span.textContent)).toEqual([
      "জি",
      "A",
    ]);
  });
});
