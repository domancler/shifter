export const SHIFT_CODES = [
  "06-12", "07-15", "12-18", "13-19", "15-23", "18-00", "23-07", "00-06",
] as const;
export type ShiftCode = (typeof SHIFT_CODES)[number];

export const LEAVE_CODES = ["CO", "FS", "ROL", "RS"] as const;
export type LeaveCode = (typeof LEAVE_CODES)[number];

export type Entry =
  | { type: "shift"; code: ShiftCode }
  | { type: "leave"; code: LeaveCode }
  | null;

export interface Day {
  date: string; // "YYYY-MM-DD": la colonna del programmato
  entry: Entry;
  note: string;
}