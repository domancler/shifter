import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

function fakeBrowser(hash: string, savedState: string | null) {
  const storage = new Map<string, string>();
  if (savedState) storage.set("shifter-google-oauth-state", savedState);

  const location = { hash, pathname: "/shifter/", search: "" };
  const replaceState = vi.fn((_data: unknown, _title: string, url: string) => {
    location.hash = ""; // come nel browser: l'indirizzo pulito non ha più il #
    expect(url).toBe("/shifter/");
  });

  vi.stubGlobal("window", { location, history: { replaceState } });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });

  return { storage, replaceState };
}

describe("ritorno da Google (accesso con reindirizzamento)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("completa il collegamento: salva il token, pulisce l'indirizzo, legge il calendario", async () => {
    const { storage, replaceState } = fakeBrowser(
      `#state=s1&access_token=tok&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(SCOPE)}`,
      "s1",
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ summary: "mario@gmail.com", timeZone: "Europe/Rome" }), { status: 200 }),
    );

    const client = await import("./googleClient");
    const resumed = await client.resumeRedirectSignIn();

    expect(resumed).toEqual({ status: "connected", calendar: { name: "mario@gmail.com", timeZone: "Europe/Rome" } });
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(storage.has("shifter-google-oauth-state")).toBe(false); // lo stato si usa una volta sola
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    expect(client.isGoogleConnected()).toBe(true);

    // un secondo avvio sulla stessa pagina non rifà nulla
    await expect(client.resumeRedirectSignIn()).resolves.toEqual({ status: "none" });
  });

  it("scarta un ritorno con stato diverso e non chiama Google", async () => {
    fakeBrowser(`#state=falso&access_token=tok&scope=${encodeURIComponent(SCOPE)}`, "s1");
    const client = await import("./googleClient");
    const resumed = await client.resumeRedirectSignIn();

    expect(resumed.status).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.isGoogleConnected()).toBe(false);
  });

  it("accesso negato su Google: messaggio chiaro, nessun token", async () => {
    fakeBrowser("#state=s1&error=access_denied", "s1");
    const client = await import("./googleClient");
    const resumed = await client.resumeRedirectSignIn();

    expect(resumed).toEqual({ status: "error", message: "Accesso negato da Google." });
    expect(client.isGoogleConnected()).toBe(false);
  });

  it("se Google risponde con errore dopo il ritorno, il token viene scartato", async () => {
    fakeBrowser(`#state=s1&access_token=tok&expires_in=3599&scope=${encodeURIComponent(SCOPE)}`, "s1");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "x", errors: [{ reason: "accessNotConfigured" }] } }), { status: 403 }),
    );
    const client = await import("./googleClient");
    const resumed = await client.resumeRedirectSignIn();

    expect(resumed.status).toBe("error");
    expect(client.isGoogleConnected()).toBe(false);
  });

  it("avvio normale (senza ritorno da Google): non fa nulla", async () => {
    fakeBrowser("", null);
    const client = await import("./googleClient");
    await expect(client.resumeRedirectSignIn()).resolves.toEqual({ status: "none" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
