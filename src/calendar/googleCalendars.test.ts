import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./googleClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleClient")>()),
  googleFetch: vi.fn(),
}));

import { googleFetch } from "./googleClient";
import { createCalendar, listWritableCalendars, normalizeCalendarName, sortCalendars } from "./googleCalendars";

const mockFetch = vi.mocked(googleFetch);

describe("listWritableCalendars", () => {
  beforeEach(() => mockFetch.mockReset());

  it("tiene solo calendari scrivibili, principale per primo, poi in ordine alfabetico", async () => {
    mockFetch
      .mockResolvedValueOnce({
        items: [
          { id: "z", summary: "Zeta", accessRole: "owner", backgroundColor: "#111" },
          { id: "me@gmail.com", summary: "me@gmail.com", primary: true, accessRole: "owner" },
          { id: "fest", summary: "Festività in Italia", accessRole: "reader" },
          { id: "old", summary: "Cancellato", accessRole: "owner", deleted: true },
        ],
        nextPageToken: "p2",
      })
      .mockResolvedValueOnce({
        items: [
          { id: "a", summary: "alfa", summaryOverride: "Lavoro", accessRole: "writer" },
          { id: "free", summary: "Solo disponibilità", accessRole: "freeBusyReader" },
        ],
      });

    const calendars = await listWritableCalendars();

    expect(calendars.map((c) => c.id)).toEqual(["me@gmail.com", "a", "z"]);
    expect(calendars[1].name).toBe("Lavoro"); // il nome personalizzato vince su quello originale
    expect(calendars[0].primary).toBe(true);
    expect(calendars[2].color).toBe("#111");

    const first = new URL("https://x" + mockFetch.mock.calls[0][0]);
    expect(first.pathname).toBe("/users/me/calendarList");
    expect(first.searchParams.get("minAccessRole")).toBe("writer");
    expect(new URL("https://x" + mockFetch.mock.calls[1][0]).searchParams.get("pageToken")).toBe("p2");
  });

  it("senza elementi restituisce un elenco vuoto", async () => {
    mockFetch.mockResolvedValueOnce({});
    await expect(listWritableCalendars()).resolves.toEqual([]);
  });
});

describe("sortCalendars", () => {
  it("ordina senza badare a maiuscole e accenti", () => {
    const sorted = sortCalendars([
      { id: "1", name: "turni", primary: false },
      { id: "2", name: "Èvento", primary: false },
      { id: "3", name: "Altro", primary: false },
    ]);
    expect(sorted.map((c) => c.name)).toEqual(["Altro", "Èvento", "turni"]);
  });
});

describe("normalizeCalendarName", () => {
  it("toglie spazi extra e rifiuta vuoto e nomi troppo lunghi", () => {
    expect(normalizeCalendarName("  Turni   di  lavoro ")).toEqual({ name: "Turni di lavoro" });
    expect(normalizeCalendarName("   ")).toHaveProperty("error");
    expect(normalizeCalendarName("x".repeat(101))).toHaveProperty("error");
    expect(normalizeCalendarName("x".repeat(100))).toEqual({ name: "x".repeat(100) });
  });
});

describe("createCalendar", () => {
  beforeEach(() => mockFetch.mockReset());

  it("crea il calendario con nome e fuso orario e restituisce l'ID", async () => {
    mockFetch.mockResolvedValueOnce({ id: "new@group.calendar.google.com", summary: "Turni" });

    const created = await createCalendar("Turni", "Europe/Rome");

    expect(created).toEqual({ id: "new@group.calendar.google.com", name: "Turni", primary: false });
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toContain("/calendars?");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toEqual({ summary: "Turni", timeZone: "Europe/Rome" });
  });

  it("senza fuso orario non lo invia", async () => {
    mockFetch.mockResolvedValueOnce({ id: "n", summary: "Turni" });
    await createCalendar("Turni");
    expect(JSON.parse(String(mockFetch.mock.calls[0][1]?.body))).toEqual({ summary: "Turni" });
  });
});
