// Signing in with a phone number and PIN, end to end through the local stack: the member-auth
// Edge Function, Supabase Auth, the Data API under RLS, and Storage.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { clients, localStack, uniquePhone } from "./stack.ts";

const stack = localStack();
const api = clients(stack);

async function addMember(pin: string, nameBn = "পরীক্ষা") {
  const phone = uniquePhone();
  const added = await api.operator({ action: "add-member", phone, nameBn, nameEn: "Test", pin });
  expect(added.status).toBe(201);
  const member = added.body.member as { id: string };
  return { phone, id: member.id };
}

async function signIn(phone: string, pin: string) {
  const result = await api.memberAuth({ action: "sign-in", phone, pin });
  expect(result.status).toBe(200);
  return result.body.session as { access_token: string; refresh_token: string };
}

afterAll(async () => {
  await api.cleanUp();
});

describe("adding members", () => {
  it("is for the operator and members, not for anyone signed out", async () => {
    const refused = await api.memberAuth({
      action: "add-member",
      phone: uniquePhone(),
      nameBn: "x",
      pin: "111111",
    });
    expect(refused).toEqual({ status: 401, body: { error: "not_allowed" } });

    const { phone } = await addMember("482913");
    const twice = await api.operator({
      action: "add-member",
      phone,
      nameBn: "আবার",
      pin: "111111",
    });
    expect(twice).toEqual({ status: 409, body: { error: "phone_taken" } });
  });
});

describe("signing in", () => {
  let member: { phone: string; id: string };

  beforeAll(async () => {
    member = await addMember("482913", "মা");
  });

  it("refuses a wrong PIN and says how many tries are left", async () => {
    expect(await api.memberAuth({ action: "sign-in", phone: member.phone, pin: "000000" })).toEqual(
      {
        status: 401,
        body: { error: "invalid_credentials", remaining: 4 },
      },
    );
  });

  it("gives the right PIN a session that sees members' data under RLS", async () => {
    const session = await signIn(member.phone, "482913");

    const profiles = await api.rest("profiles?select=id,display_name_bn", session.access_token);
    expect(profiles.status).toBe(200);
    expect(profiles.body.rows).toContainEqual({ id: member.id, display_name_bn: "মা" });

    const settings = await api.rest("business_settings?select=hotel_name_bn", session.access_token);
    expect(settings.body.rows).toEqual([{ hotel_name_bn: "আদর্শ মুন্সির হোটেল" }]);
  });

  it("accepts the phone however it is written", async () => {
    const bangla = member.phone.replace(/[0-9]/g, (digit) => "০১২৩৪৫৬৭৮৯".charAt(Number(digit)));
    await signIn(`+88 ${bangla.slice(0, 5)}-${bangla.slice(5)}`, "482913");
  });

  it("shows nothing to anyone signed out", async () => {
    const result = await api.rest("profiles?select=id");
    expect(result.status).toBe(401);
    expect(result.body.code).toBe("42501");
  });

  it("is the only way in: the PIN is useless against Auth itself, and nobody can sign up", async () => {
    const direct = await api.auth("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: `${member.id}@members.amh.invalid`, password: "482913" }),
    });
    expect(direct.status).toBe(400);
    expect(direct.body.error_code).toBe("invalid_credentials");

    const signUp = await api.auth("signup", {
      method: "POST",
      body: JSON.stringify({
        email: "someone@example.com",
        password: "a-password-long-enough-for-the-minimum",
      }),
    });
    expect(signUp.body.error_code).toBe("signup_disabled");
  });
});

describe("PINs", () => {
  it("can be changed by their member", async () => {
    const member = await addMember("482913");
    const session = await signIn(member.phone, "482913");

    const wrong = await api.memberAuth(
      { action: "change-pin", currentPin: "999999", newPin: "739104" },
      session.access_token,
    );
    expect(wrong.body.error).toBe("invalid_credentials");
    const changed = await api.memberAuth(
      { action: "change-pin", currentPin: "482913", newPin: "739104" },
      session.access_token,
    );
    expect(changed).toEqual({ status: 200, body: { ok: true } });

    expect(
      (await api.memberAuth({ action: "sign-in", phone: member.phone, pin: "482913" })).status,
    ).toBe(401);
    await signIn(member.phone, "739104");
  });

  it("lock their number after five mistakes, until another member resets it", async () => {
    const member = await addMember("482913");
    for (const pin of ["000001", "000002", "000003", "000004"]) {
      expect((await api.memberAuth({ action: "sign-in", phone: member.phone, pin })).status).toBe(
        401,
      );
    }
    const locked = await api.memberAuth({ action: "sign-in", phone: member.phone, pin: "000005" });
    expect(locked.status).toBe(423);
    expect(Date.parse(String(locked.body.retryAt)) - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(
      (await api.memberAuth({ action: "sign-in", phone: member.phone, pin: "482913" })).status,
    ).toBe(423);

    expect(await api.operator({ action: "reset-pin", phone: member.phone, pin: "550011" })).toEqual(
      {
        status: 200,
        body: { ok: true },
      },
    );
    await signIn(member.phone, "550011");
  });
});

describe("switching a member off", () => {
  it("ends their access at once, and switching back on restores it", async () => {
    const member = await addMember("482913");
    const session = await signIn(member.phone, "482913");

    const off = await api.operator({ action: "set-active", phone: member.phone, active: false });
    expect(off.status).toBe(200);

    expect((await api.rest("profiles?select=id", session.access_token)).body.rows).toEqual([]);
    const refresh = await api.auth("token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    expect(refresh.status).toBeGreaterThanOrEqual(400);
    expect(await api.memberAuth({ action: "sign-in", phone: member.phone, pin: "482913" })).toEqual(
      {
        status: 403,
        body: { error: "inactive" },
      },
    );

    expect(
      (await api.operator({ action: "set-active", phone: member.phone, active: true })).status,
    ).toBe(200);
    await signIn(member.phone, "482913");
  });
});

describe("files", () => {
  it("members upload order files, but only the server stores issued documents", async () => {
    const member = await addMember("482913");
    const session = await signIn(member.phone, "482913");
    const name = `integration-tests/${member.id}.pdf`;

    expect(
      (await api.upload("order-files", name, session.access_token, "application/pdf")).status,
    ).toBe(200);
    expect(
      (await api.upload("issued-documents", name, session.access_token, "application/pdf")).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await api.upload("order-files", `anonymous-${member.id}.pdf`, undefined, "application/pdf"))
        .status,
    ).toBeGreaterThanOrEqual(400);

    await fetch(`${stack.url}/storage/v1/object/order-files/${name}`, {
      method: "DELETE",
      headers: { apikey: stack.secretKey, Authorization: `Bearer ${stack.secretKey}` },
    });
  });
});
