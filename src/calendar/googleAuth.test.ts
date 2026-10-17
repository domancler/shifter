import { describe, expect, it } from "vitest";
import { AuthError, createTokenStore } from "./googleAuth";

describe("token store", () => {
  it("restituisce il token finché è valido e lo scarta alla scadenza", () => {
    let now = 1_000_000;
    const store = createTokenStore(() => now);

    expect(store.get()).toBeNull();

    store.set("abc", 3600);
    expect(store.get()).toBe("abc");

    now += 3500 * 1000; // 58 min 20 s: ancora valido
    expect(store.get()).toBe("abc");

    now += 41 * 1000; // oltre i 60 s di margine prima della scadenza
    expect(store.get()).toBeNull();
  });

  it("clear() dimentica il token", () => {
    const store = createTokenStore(() => 0);
    store.set("abc", 3600);
    store.clear();
    expect(store.get()).toBeNull();
  });
});

describe("AuthError", () => {
  it("espone codice e messaggio in italiano", () => {
    const error = new AuthError("popup-blocked");
    expect(error.code).toBe("popup-blocked");
    expect(error.message).toContain("popup");
  });
});
