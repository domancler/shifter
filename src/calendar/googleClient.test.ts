import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./googleAuth", () => {
  let token: string | null = "token-1";
  let renewals = 0;
  class AuthError extends Error {}
  return {
    AuthError,
    signIn: vi.fn(),
    isSignedIn: () => token !== null,
    clearAccessToken: () => { token = null; },
    ensureAccessToken: async () => {
      if (token === null) { renewals += 1; token = `token-${renewals + 1}`; }
      return token;
    },
  };
});

import { googleFetch, GoogleApiError } from "./googleClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}

describe("googleFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("manda il token e restituisce il JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const result = await googleFetch<{ ok: boolean }>("/calendars/primary/events");
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(init.headers.Authorization).toBe("Bearer token-1");
  });

  it("su 401 rinnova il token e riprova una sola volta", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: "Invalid Credentials" } }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await expect(googleFetch("/x")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer token-2");
  });

  it("traduce l'API non abilitata in un messaggio chiaro", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { error: { message: "disabled", errors: [{ reason: "accessNotConfigured" }] } }),
    );
    const error = await googleFetch("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleApiError);
    expect((error as GoogleApiError).message).toContain("non è abilitata");
  });

  it("gestisce 204 senza corpo", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));
    await expect(googleFetch("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
