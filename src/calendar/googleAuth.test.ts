import { describe, expect, it } from "vitest";
import {
  AuthError,
  GOOGLE_SCOPE,
  buildRedirectAuthUrl,
  createTokenStore,
  isRedirectSignInPreferred,
  parseRedirectHash,
} from "./googleAuth";

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

describe("accesso con reindirizzamento", () => {
  it("si attiva da solo solo per l'app installata su iPhone, salvo override", () => {
    // mode: "auto" rende il test indipendente da VITE_GOOGLE_LOGIN_MODE presente in .env.local
    expect(isRedirectSignInPreferred({ standalone: true, mode: "auto" })).toBe(true);
    expect(isRedirectSignInPreferred({ standalone: false, mode: "auto" })).toBe(false);
    expect(isRedirectSignInPreferred({ standalone: false, mode: "redirect" })).toBe(true);
    expect(isRedirectSignInPreferred({ standalone: true, mode: "popup" })).toBe(false);
  });

  it("costruisce l'indirizzo di Google con token, scope, ritorno e stato", () => {
    const url = new URL(buildRedirectAuthUrl({ clientId: "abc.apps", redirectUri: "https://x.github.io/shifter/", state: "s1" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("client_id")).toBe("abc.apps");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.github.io/shifter/");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SCOPE);
    expect(url.searchParams.get("state")).toBe("s1");
  });

  it("legge il ritorno riuscito", () => {
    const hash = `#state=s1&access_token=tok&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(GOOGLE_SCOPE)}`;
    expect(parseRedirectHash(hash, "s1")).toEqual({ status: "ok", token: "tok", expiresIn: 3599 });
  });

  it("nessun ritorno: non fa nulla", () => {
    expect(parseRedirectHash("", "s1")).toEqual({ status: "none" });
    expect(parseRedirectHash("#qualcosa=altro", "s1")).toEqual({ status: "none" });
  });

  it("scarta risultati senza lo stato atteso (non vengono da noi)", () => {
    const hash = `#state=altro&access_token=tok&scope=${encodeURIComponent(GOOGLE_SCOPE)}`;
    expect(parseRedirectHash(hash, "s1")).toMatchObject({ status: "error", code: "unknown" });
    expect(parseRedirectHash(hash, null)).toMatchObject({ status: "error", code: "unknown" });
  });

  it("riconosce accesso negato e permesso del calendario tolto", () => {
    expect(parseRedirectHash("#state=s1&error=access_denied", "s1")).toMatchObject({ status: "error", code: "access-denied" });
    expect(parseRedirectHash("#state=s1&access_token=tok&scope=email", "s1")).toMatchObject({ status: "error", code: "scope-denied" });
  });
});
