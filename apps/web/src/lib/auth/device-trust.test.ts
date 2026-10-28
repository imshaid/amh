import { beforeEach, describe, expect, it } from "vitest";

import { isTrustedDevice, sessionStorageAdapter, setTrustedDevice } from "./device-trust";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("device trust", () => {
  it("trusts a device unless told otherwise", () => {
    expect(isTrustedDevice()).toBe(true);
    setTrustedDevice(false);
    expect(isTrustedDevice()).toBe(false);
    setTrustedDevice(true);
    expect(isTrustedDevice()).toBe(true);
  });

  it("keeps the session until sign-out on a trusted device", () => {
    sessionStorageAdapter.setItem("amh:session", "token");
    expect(localStorage.getItem("amh:session")).toBe("token");
    expect(sessionStorage.getItem("amh:session")).toBeNull();
  });

  it("keeps it only while the browser is open on someone else's device", () => {
    setTrustedDevice(false);
    sessionStorageAdapter.setItem("amh:session", "token");
    expect(sessionStorage.getItem("amh:session")).toBe("token");
    expect(localStorage.getItem("amh:session")).toBeNull();
    expect(sessionStorageAdapter.getItem("amh:session")).toBe("token");
  });

  it("moves an existing session when the choice changes, and forgets it on sign-out", () => {
    sessionStorageAdapter.setItem("amh:session", "old");
    setTrustedDevice(false);
    sessionStorageAdapter.setItem("amh:session", "new");
    expect(localStorage.getItem("amh:session")).toBeNull();
    expect(sessionStorageAdapter.getItem("amh:session")).toBe("new");

    sessionStorageAdapter.removeItem("amh:session");
    expect(sessionStorageAdapter.getItem("amh:session")).toBeNull();
  });
});
