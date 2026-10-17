import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./googleClient", () => ({ googleFetch: vi.fn() }));

import { googleFetch } from "./googleClient";
import { GoogleCalendarProvider } from "./googleProvider";

const mockFetch = vi.mocked(googleFetch);

describe("GoogleCalendarProvider.listMarkedEvents", () => {
  beforeEach(() => mockFetch.mockReset());

  it("filtra per marcatore, allarga la finestra e segue la paginazione", async () => {
    mockFetch
      .mockResolvedValueOnce({
        items: [
          {
            id: "a", etag: '"1"', updated: "2026-10-10T08:00:00Z", summary: "Turno 07-15", description: "nota",
            start: { dateTime: "2026-11-03T07:00:00+01:00" }, end: { dateTime: "2026-11-03T15:00:00+01:00" },
            extendedProperties: { private: { turniApp: "turni-calendar", turniDay: "2026-11-03" } },
          },
          { id: "x", status: "cancelled", start: { date: "2026-11-04" }, end: { date: "2026-11-05" } },
        ],
        nextPageToken: "p2",
      })
      .mockResolvedValueOnce({
        items: [{ id: "b", summary: "RS", start: { date: "2026-11-06" }, end: { date: "2026-11-07" }, extendedProperties: { private: { turniApp: "turni-calendar" } } }],
      });

    const events = await new GoogleCalendarProvider().listMarkedEvents("2026-11-02", "2026-12-06");

    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(events[0]).toMatchObject({ description: "nota", allDay: false, markers: { turniDay: "2026-11-03" } });
    expect(events[1]).toMatchObject({ allDay: true, start: "2026-11-06", description: "" });

    const first = new URL("https://x" + mockFetch.mock.calls[0][0]);
    expect(first.pathname).toBe("/calendars/primary/events");
    expect(first.searchParams.get("privateExtendedProperty")).toBe("turniApp=turni-calendar");
    expect(first.searchParams.get("timeMin")).toBe("2026-10-31T00:00:00Z");
    expect(first.searchParams.get("timeMax")).toBe("2026-12-09T00:00:00Z");
    expect(first.searchParams.get("singleEvents")).toBe("true");

    const second = new URL("https://x" + mockFetch.mock.calls[1][0]);
    expect(second.searchParams.get("pageToken")).toBe("p2");
  });
});
