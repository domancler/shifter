import type { ShiftCode } from "./types";

export interface ShiftDef {
  code: ShiftCode;
  group: "giorno" | "notte";
  startHour: number;
  startDayOffset: number; // rispetto al giorno della colonna (D)
  endHour: number;
  endDayOffset: number;
}

export const SHIFTS: ShiftDef[] = [
  { code: "06-12", group: "giorno", startHour: 6,  startDayOffset: 0,  endHour: 12, endDayOffset: 0 },
  { code: "07-15", group: "giorno", startHour: 7,  startDayOffset: 0,  endHour: 15, endDayOffset: 0 },
  { code: "12-18", group: "giorno", startHour: 12, startDayOffset: 0,  endHour: 18, endDayOffset: 0 },
  { code: "13-19", group: "giorno", startHour: 13, startDayOffset: 0,  endHour: 19, endDayOffset: 0 },
  { code: "15-23", group: "giorno", startHour: 15, startDayOffset: 0,  endHour: 23, endDayOffset: 0 },
  { code: "18-00", group: "giorno", startHour: 18, startDayOffset: 0,  endHour: 0,  endDayOffset: 1 },
  { code: "23-07", group: "notte",  startHour: 23, startDayOffset: -1, endHour: 7,  endDayOffset: 0 },
  { code: "00-06", group: "notte",  startHour: 0,  startDayOffset: 0,  endHour: 6,  endDayOffset: 0 },
];

export function getShift(code: ShiftCode): ShiftDef {
  const def = SHIFTS.find((s) => s.code === code);
  if (!def) throw new Error(`Turno sconosciuto: ${code}`);
  return def;
}

export function shiftTitle(code: ShiftCode): string {
  return `Turno ${code}`;
}