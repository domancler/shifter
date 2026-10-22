import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./googleClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleClient")>()),
  googleFetch: vi.fn(),
}));

import { createSchedule, entryForShift } from "../model/schedule";
import { googleFetch } from "./googleClient";
import { saveScheduleToGoogle } from "./saveSchedule";

const mockFetch = vi.mocked(googleFetch);

function schedule() {
  const s = createSchedule("2026-11", "2026-11-02", "2026-11-03");
  s.days[0].entry = entryForShift(s.days[0].date, "07-15");
  return s;
}

describe("saveScheduleToGoogle sul calendario scelto", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("window", { confirm: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  function select(id: string | null) {
    const storage = new Map<string, string>();
    if (id) storage.set("shifter-calendar", JSON.stringify({ id, name: "Turni" }));
    vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null });
  }

  function respondWithCreatedEvent() {
    mockFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (!init?.method) return { items: [] }; // elenco degli eventi marcati: ancora vuoto
      return {
        id: "shifter20261102", etag: '"1"', updated: "2026-10-22T10:00:00Z",
        summary: "Turno 07-15", description: "",
        start: { dateTime: "2026-11-02T07:00:00+01:00" }, end: { dateTime: "2026-11-02T15:00:00+01:00" },
        extendedProperties: { private: {} },
      };
    });
  }

  it("legge e scrive nel calendario scelto, mai nel principale", async () => {
    select("abc@group.calendar.google.com");
    respondWithCreatedEvent();

    await saveScheduleToGoogle(schedule());

    const paths = mockFetch.mock.calls.map(([path]) => String(path));
    expect(paths.length).toBeGreaterThanOrEqual(2);
    for (const path of paths) {
      expect(path.startsWith("/calendars/abc%40group.calendar.google.com/events")).toBe(true);
      expect(path).not.toContain("/calendars/primary/");
    }
    expect(mockFetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
  });

  it("senza scelta usa il calendario principale, come prima", async () => {
    select(null);
    respondWithCreatedEvent();

    await saveScheduleToGoogle(schedule());

    for (const [path] of mockFetch.mock.calls) {
      expect(String(path).startsWith("/calendars/primary/events")).toBe(true);
    }
  });
});
