import { describe, expect, it } from "vitest";
import type { RemoteEvent } from "./provider";
import { buildScheduleFromEvents } from "./scheduleFromEvents";

const period = { label: "2026-11", start: "2026-11-02", end: "2026-12-06" };

function event(overrides: Partial<RemoteEvent> & { day: string; kind: string; code: string; essential?: boolean }): RemoteEvent {
  const { day, kind, code, essential, ...rest } = overrides;
  return {
    id: `id-${day}-${code}`,
    etag: '"1"',
    updated: "2026-10-10T08:00:00Z",
    summary: kind === "shift" ? `Turno ${code}` : code,
    description: "",
    allDay: kind === "leave",
    start: "2026-11-01T00:00:00+01:00",
    end: "2026-11-01T00:00:00+01:00",
    markers: {
      turniApp: "turni-calendar", turniSchema: "1", turniDay: day, turniKind: kind, turniCode: code,
      ...(essential ? { turniEssential: "1" } : {}),
    },
    ...rest,
  };
}

// 23-07 del 05.11: da giovedì 4 alle 23:00 a venerdì 5 alle 07:00 (ora solare, +01:00)
const night = event({ day: "2026-11-05", kind: "shift", code: "23-07", start: "2026-11-04T23:00:00+01:00", end: "2026-11-05T07:00:00+01:00", description: "Cambio con collega", essential: true });
const day = event({ day: "2026-11-03", kind: "shift", code: "07-15", start: "2026-11-03T07:00:00+01:00", end: "2026-11-03T15:00:00+01:00" });
const leave = event({ day: "2026-11-06", kind: "leave", code: "RS", start: "2026-11-06", end: "2026-11-07" });

describe("buildScheduleFromEvents", () => {
  it("ricostruisce turni, giustificativi, note ed esigenza senza warning", () => {
    const { schedule, foundDays, warnings } = buildScheduleFromEvents(period, [night, day, leave]);
    expect(warnings).toEqual([]);
    expect(foundDays).toBe(3);
    expect(schedule.days).toHaveLength(35);

    const d5 = schedule.days.find((d) => d.date === "2026-11-05")!;
    expect(d5.entry).toMatchObject({ type: "shift", code: "23-07" });
    expect(d5.note).toBe("Cambio con collega");
    expect(d5.isEssential).toBe(true);
    expect(d5.calendarRef).toEqual({ provider: "google", eventId: night.id, etag: '"1"', updated: night.updated });

    const d6 = schedule.days.find((d) => d.date === "2026-11-06")!;
    expect(d6.entry).toEqual({ type: "leave", code: "RS" });
    expect("isEssential" in d6).toBe(false);

    expect(schedule.days.find((d) => d.date === "2026-11-04")!.entry).toBeNull();
  });

  it("ignora eventi senza marcatore e fuori periodo", () => {
    const foreign = { ...day, id: "x", markers: {} };
    const outside = event({ day: "2026-10-30", kind: "shift", code: "07-15" });
    const { foundDays, warnings } = buildScheduleFromEvents(period, [foreign, outside]);
    expect(foundDays).toBe(0);
    expect(warnings).toEqual([]);
  });

  it("avvisa su codice sconosciuto e schema non supportato, ignorando l'evento", () => {
    const bad = event({ day: "2026-11-03", kind: "shift", code: "99-99" });
    const future = { ...day, id: "f", markers: { ...day.markers, turniSchema: "2" } };
    const { foundDays, warnings } = buildScheduleFromEvents(period, [bad, future]);
    expect(foundDays).toBe(0);
    expect(warnings).toHaveLength(2);
  });

  it("due eventi nello stesso giorno: tiene il più recente e avvisa", () => {
    const older = { ...day, id: "old", updated: "2026-10-01T00:00:00Z" };
    const newer = { ...day, id: "new", updated: "2026-10-09T00:00:00Z", description: "nuova" };
    for (const list of [[older, newer], [newer, older]]) {
      const { schedule, warnings } = buildScheduleFromEvents(period, list);
      expect(schedule.days.find((d) => d.date === "2026-11-03")!.calendarRef?.eventId).toBe("new");
      expect(warnings).toHaveLength(1);
    }
  });

  it("avvisa se l'orario su Google è stato cambiato a mano", () => {
    const moved = { ...day, start: "2026-11-03T08:00:00+01:00" };
    const { warnings } = buildScheduleFromEvents(period, [moved]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("07-15");
  });
});
