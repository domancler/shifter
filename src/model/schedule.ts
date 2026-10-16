import { addDays, listDates } from "./dates";
import { getShift } from "./catalog";
import type { Day, Entry, Schedule, ShiftCode, LeaveCode } from "./types";

export function createSchedule(label: string, start: string, end: string): Schedule {
  if (start > end) throw new Error("La data iniziale deve precedere quella finale.");
  return {
    formatVersion: 1,
    app: "turni-calendar",
    exportedAt: new Date().toISOString(),
    timezone: "Europe/Rome",
    period: { label, start, end },
    days: listDates(start, end).map((date): Day => ({ date, entry: null, note: "" })),
  };
}

function localIso(date: string, hour: number): string {
  const [year, month, day] = date.split("-").map(Number);
  // Trova l'offset Europe/Rome valido per la data specifica, inclusa l'ora legale.
  const target = new Date(Date.UTC(year, month - 1, day, hour));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", timeZoneName: "longOffset", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(target);
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+01:00";
  const offset = zone.replace("GMT", "") || "+00:00";
  return `${date}T${String(hour).padStart(2, "0")}:00:00${offset}`;
}

export function entryForShift(columnDate: string, code: ShiftCode): Entry {
  const def = getShift(code);
  const startDate = addDays(columnDate, def.startDayOffset);
  const endDate = addDays(columnDate, def.endDayOffset);
  return { type: "shift", code, start: localIso(startDate, def.startHour), end: localIso(endDate, def.endHour) };
}

export function entryForLeave(code: LeaveCode): Entry { return { type: "leave", code }; }

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = {}): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long", ...options })
    .format(new Date(year, month - 1, day, 12));
}
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit" }).format(new Date(year, month - 1, day, 12));
}
export function formatShiftForReview(entry: Entry, columnDate: string): string {
  if (!entry) return "—";
  if (entry.type === "leave") return entry.code;
  // Il 23-07 è mostrato sulla colonna di fine turno: la data coincide con columnDate.
  return `${entry.code}`;
}
