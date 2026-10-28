/**
 * Where this device keeps the session (BLUEPRINT §5.9: long sessions on trusted devices).
 *
 * On a trusted device, the member's own phone or PC and the default, the session lives in
 * localStorage and lasts until they sign out. On someone else's device it lives in sessionStorage,
 * so closing the browser signs them out. The choice is made on the sign-in screen and remembered.
 */

const TRUST_KEY = "amh:untrusted-device";

function attempt<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    // Storage can be unavailable (private windows, blocked site data).
    return fallback;
  }
}

export function isTrustedDevice(): boolean {
  return attempt(() => localStorage.getItem(TRUST_KEY) === null, true);
}

export function setTrustedDevice(trusted: boolean): void {
  attempt(() => {
    if (trusted) localStorage.removeItem(TRUST_KEY);
    else localStorage.setItem(TRUST_KEY, "1");
  }, undefined);
}

/** The storage Supabase Auth keeps its session in, following the device's trust. */
export const sessionStorageAdapter = {
  getItem(key: string): string | null {
    return attempt(() => localStorage.getItem(key) ?? sessionStorage.getItem(key), null);
  },
  setItem(key: string, value: string): void {
    attempt(() => {
      const [keep, drop] = isTrustedDevice()
        ? [localStorage, sessionStorage]
        : [sessionStorage, localStorage];
      keep.setItem(key, value);
      drop.removeItem(key);
    }, undefined);
  },
  removeItem(key: string): void {
    attempt(() => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }, undefined);
  },
};
