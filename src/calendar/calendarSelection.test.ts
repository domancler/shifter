import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calendarEventsPath,
  clearSelectedCalendar,
  getSelectedCalendar,
  getSelectedCalendarId,
  setSelectedCalendar,
} from "./calendarSelection";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  });
  return data;
}

describe("calendario scelto", () => {
  beforeEach(() => fakeStorage());
  afterEach(() => vi.unstubAllGlobals());

  it("senza scelta si usa il calendario principale", () => {
    expect(getSelectedCalendar()).toBeNull();
    expect(getSelectedCalendarId()).toBe("primary");
    expect(calendarEventsPath()).toBe("/calendars/primary/events");
  });

  it("la scelta si ricorda e cambia il percorso, codificando l'ID", () => {
    setSelectedCalendar({ id: "abc123@group.calendar.google.com", name: "Turni" });
    expect(getSelectedCalendar()).toEqual({ id: "abc123@group.calendar.google.com", name: "Turni" });
    expect(calendarEventsPath()).toBe("/calendars/abc123%40group.calendar.google.com/events");
  });

  it("clear torna al principale", () => {
    setSelectedCalendar({ id: "x", name: "X" });
    clearSelectedCalendar();
    expect(getSelectedCalendarId()).toBe("primary");
  });

  it("dati rovinati o incompleti vengono ignorati", () => {
    for (const raw of ["non json", "{}", '{"id":"","name":"x"}', '{"id":5,"name":"x"}', "null"]) {
      fakeStorage({ "shifter-calendar": raw });
      expect(getSelectedCalendar()).toBeNull();
    }
  });

  it("senza localStorage (es. navigazione privata) non va in errore", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    expect(() => setSelectedCalendar({ id: "x", name: "X" })).not.toThrow();
    expect(getSelectedCalendar()).toBeNull();
    expect(() => clearSelectedCalendar()).not.toThrow();
  });
});
