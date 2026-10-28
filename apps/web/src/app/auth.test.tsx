import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setLanguage } from "@/i18n/i18n";
import { createFakeSupabase, MOTHER, sessionReply } from "@/test/fake-supabase";
import type { FakeServer, FunctionReply } from "@/test/fake-supabase";
import { renderApp } from "@/test/render-app";

// A configured backend, played by the fake client.
const backend = vi.hoisted((): { client: unknown } => ({ client: null }));
vi.mock("@/lib/env", async () => {
  const { CONFIGURED_ENV } = await import("@/test/fake-supabase");
  return { clientEnv: CONFIGURED_ENV };
});
vi.mock("@/lib/supabase", () => ({ getSupabase: () => backend.client }));

let server: FakeServer;
let fake: ReturnType<typeof createFakeSupabase>;

function signedIn(profile = MOTHER) {
  server.session = { access_token: "access", refresh_token: "refresh", user: { id: profile.id } };
  server.profile = profile;
}

const WRONG_PIN: FunctionReply = {
  status: 401,
  body: { error: "invalid_credentials", remaining: 4 },
};

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  delete document.documentElement.dataset.theme;
  await setLanguage("bn");
  localStorage.clear();
  server = { session: null, profile: MOTHER, memberAuth: () => ({ status: 500, body: {} }) };
  fake = createFakeSupabase(server);
  backend.client = fake.client;
  // The live indicator asks the server whether it is up.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillSignIn(phone: string, pin: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/মোবাইল নম্বর/), phone);
  await user.type(screen.getByLabelText("পিন (৬ সংখ্যা)"), pin);
  return user;
}

describe("signing in", () => {
  it("sends someone signed out to sign in, then on to where they were going", async () => {
    server.memberAuth = (body) =>
      body.phone === "01711000001" && body.pin === "482913" ? sessionReply() : WRONG_PIN;
    const { router } = renderApp("/orders");

    expect(await screen.findByRole("heading", { level: 1, name: "লগ ইন" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/sign-in");
    expect(document.title).toBe("লগ ইন · আদর্শ মুন্সির হোটেল");

    // Bangla digits and a dash; the sixth PIN digit signs in by itself.
    await fillSignIn("০১৭১১-০০০০০১", "৪৮২৯১৩");

    expect(await screen.findByRole("heading", { level: 1, name: "অর্ডার" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/orders");
    expect(fake.client.functions.invoke).toHaveBeenCalledWith("member-auth", {
      body: { action: "sign-in", phone: "01711000001", pin: "482913" },
    });
    expect(screen.getByRole("button", { name: "মা: পিন বদলানো আর লগ আউট" })).toBeInTheDocument();
  });

  it("explains a wrong PIN, counts the tries left and clears the PIN", async () => {
    server.memberAuth = () => WRONG_PIN;
    renderApp("/sign-in");

    await fillSignIn("01711000001", "000000");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("মোবাইল নম্বর বা পিন মেলেনি।");
    expect(alert).toHaveTextContent("আর ৪ বার চেষ্টা করা যাবে");
    expect(screen.getByLabelText("পিন (৬ সংখ্যা)")).toHaveValue("");
    expect(screen.getByLabelText("পিন (৬ সংখ্যা)")).toHaveFocus();
  });

  it("says when a number is locked and how long to wait", async () => {
    const retryAt = new Date(Date.now() + 15 * 60_000).toISOString();
    server.memberAuth = () => ({ status: 423, body: { error: "locked", retryAt } });
    renderApp("/sign-in");

    await fillSignIn("01711000001", "000000");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("নম্বরটি এখন আটকে আছে");
    expect(alert).toHaveTextContent("১৫ মিনিট পর আবার চেষ্টা করুন");
  });

  it("checks the phone number before asking the server", async () => {
    renderApp("/sign-in");

    await fillSignIn("12345", "482913");

    expect(await screen.findByText(/নম্বরটা ঠিক হয়নি/)).toBeInTheDocument();
    expect(fake.client.functions.invoke).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/মোবাইল নম্বর/)).toHaveFocus();
  });

  it("says so when there is no internet", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    server.memberAuth = () => ({ status: "network" });
    renderApp("/sign-in");

    await fillSignIn("01711000001", "482913");

    expect(await screen.findByRole("alert")).toHaveTextContent("ইন্টারনেট নেই।");
  });

  it("remembers a device that is not the member's own", async () => {
    server.memberAuth = () => sessionReply();
    const user = userEvent.setup();
    renderApp("/sign-in");

    await user.click(await screen.findByRole("checkbox", { name: "এই ডিভাইসে লগ ইন থাকুক" }));
    await user.type(screen.getByLabelText(/মোবাইল নম্বর/), "01711000001");
    await user.type(screen.getByLabelText("পিন (৬ সংখ্যা)"), "482913");

    expect(
      await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("amh:untrusted-device")).toBe("1");
  });

  it("takes a signed-in member straight past the sign-in screen", async () => {
    signedIn();
    const { router } = renderApp("/sign-in");

    expect(
      await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("never sends a member off to another site after signing in", async () => {
    server.memberAuth = () => sessionReply();
    const { router } = renderApp("/sign-in?redirect=%2F%5Cevil.example");

    await fillSignIn("01711000001", "482913");

    expect(
      await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });
});

describe("membership", () => {
  it("signs out someone who is no longer a member and says why", async () => {
    signedIn();
    server.profile = null; // RLS shows switched-off members nothing, not even their own profile.
    const { router } = renderApp("/orders");

    expect(await screen.findByText(/এই অ্যাকাউন্টে আর ঢোকার অনুমতি নেই/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/sign-in");
    expect(fake.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("brings the member's language along to a new device", async () => {
    signedIn({ ...MOTHER, language: "en" });
    renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("saves a language change to the member's profile", async () => {
    signedIn();
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" });

    await user.click(screen.getByRole("button", { name: "EN (English)" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    await waitFor(() => {
      expect(server.profile?.language).toBe("en");
    });
  });

  it("signs out from the member menu, on this device only", async () => {
    signedIn();
    const user = userEvent.setup();
    const { router } = renderApp("/packages");
    await screen.findByRole("heading", { level: 1, name: "প্যাকেজ ও দাম" });

    await user.click(screen.getByRole("button", { name: "মা: পিন বদলানো আর লগ আউট" }));
    await user.click(await screen.findByRole("menuitem", { name: "লগ আউট" }));

    expect(await screen.findByRole("heading", { level: 1, name: "লগ ইন" })).toBeInTheDocument();
    expect(fake.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(router.state.location.search).toEqual({ redirect: "/packages" });
  });
});

describe("changing the PIN", () => {
  async function openChangePin() {
    signedIn();
    const user = userEvent.setup();
    renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "ড্যাশবোর্ড" });
    await user.click(screen.getByRole("button", { name: "মা: পিন বদলানো আর লগ আউট" }));
    await user.click(await screen.findByRole("menuitem", { name: "পিন বদলান" }));
    const dialog = await screen.findByRole("dialog", { name: "পিন বদলান" });
    return { user, dialog: within(dialog) };
  }

  it("checks the current PIN, then keeps the new one", async () => {
    server.memberAuth = (body) =>
      body.action === "change-pin" ? { status: 200, body: { ok: true } } : WRONG_PIN;
    const { user, dialog } = await openChangePin();

    expect(dialog.getByLabelText("এখনকার পিন")).toHaveFocus();
    await user.type(dialog.getByLabelText("এখনকার পিন"), "482913");
    await user.type(dialog.getByLabelText("নতুন পিন"), "739104");
    await user.type(dialog.getByLabelText("নতুন পিন আবার"), "739104");
    await user.click(dialog.getByRole("button", { name: "নতুন পিন রাখুন" }));

    expect(await screen.findByText(/পিন বদলানো হয়েছে/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "পিন বদলান" })).not.toBeInTheDocument();
    expect(fake.client.functions.invoke).toHaveBeenCalledWith("member-auth", {
      body: { action: "change-pin", currentPin: "482913", newPin: "739104" },
    });
  });

  it("catches a new PIN typed differently twice, without asking the server", async () => {
    const { user, dialog } = await openChangePin();

    await user.type(dialog.getByLabelText("এখনকার পিন"), "482913");
    await user.type(dialog.getByLabelText("নতুন পিন"), "739104");
    await user.type(dialog.getByLabelText("নতুন পিন আবার"), "739105");
    await user.click(dialog.getByRole("button", { name: "নতুন পিন রাখুন" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("নতুন পিন দুবার একরকম হয়নি।");
    expect(fake.client.functions.invoke).not.toHaveBeenCalled();
  });

  it("explains a wrong current PIN", async () => {
    server.memberAuth = () => ({
      status: 401,
      body: { error: "invalid_credentials", remaining: 2 },
    });
    const { user, dialog } = await openChangePin();

    await user.type(dialog.getByLabelText("এখনকার পিন"), "000000");
    await user.type(dialog.getByLabelText("নতুন পিন"), "739104");
    await user.type(dialog.getByLabelText("নতুন পিন আবার"), "739104");
    await user.click(dialog.getByRole("button", { name: "নতুন পিন রাখুন" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "এখনকার পিন মেলেনি। আর ২ বার চেষ্টা করা যাবে।",
    );
  });
});
