
import {
  LEAVE_CODES,
  SHIFT_CODES,
  type Day,
  type Entry,
  type LeaveCode,
  type Schedule,
  type ShiftCode,
} from "./types";
import { getShift } from "./catalog";
import { addDays } from "./dates";

interface BackupFile {
  format: "shifter-backup";
  version: 1;
  exportedAt: string;
  timezone: "Europe/Rome";
  period: {
    label: string;
    start: string;
    end: string;
  };
  days: {
    date: string;
    entry: Entry;
    note: string;
    isEssential?: boolean;
  }[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function isValidEntry(value: unknown, date: string): value is Entry {
  if (value === null) return true;
  if (!isObject(value)) return false;

  if (value.type === "leave") {
    return LEAVE_CODES.includes(value.code as LeaveCode) &&
      Object.keys(value).every((key) => ["type", "code"].includes(key));
  }

  if (value.type !== "shift" ||
    !SHIFT_CODES.includes(value.code as ShiftCode) ||
    typeof value.start !== "string" ||
    typeof value.end !== "string") {
    return false;
  }

  if (!Number.isFinite(Date.parse(value.start)) ||
    !Number.isFinite(Date.parse(value.end)) ||
    Date.parse(value.end) <= Date.parse(value.start)) {
    return false;
  }

  const shift = getShift(value.code as ShiftCode);
  const expectedStartDate = addDays(date, shift.startDayOffset);
  const expectedEndDate = addDays(date, shift.endDayOffset);

  return value.start.startsWith(expectedStartDate + "T") &&
    value.end.startsWith(expectedEndDate + "T");
}

function validateBackup(value: unknown): BackupFile {
  if (!isObject(value) ||
    value.format !== "shifter-backup" ||
    value.version !== 1 ||
    value.timezone !== "Europe/Rome" ||
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isObject(value.period) ||
    typeof value.period.label !== "string" ||
    !isDate(value.period.start) ||
    !isDate(value.period.end) ||
    value.period.start > value.period.end ||
    !Array.isArray(value.days)) {
    throw new Error("Il file non è un backup Shifter valido.");
  }

  const expectedDates: string[] = [];
  let current = value.period.start;

  while (current <= value.period.end) {
    expectedDates.push(current);
    current = addDays(current, 1);
  }

  if (value.days.length !== expectedDates.length) {
    throw new Error("Il backup non contiene tutti i giorni del periodo.");
  }

  const days = value.days.map((item, index) => {
    if (!isObject(item) ||
      item.date !== expectedDates[index] ||
      typeof item.note !== "string" ||
      !isValidEntry(item.entry, item.date as string)) {
      throw new Error(
        `Dati non validi nel giorno ${expectedDates[index]}.`,
      );
    }

    if (
      item.isEssential !== undefined &&
      typeof item.isEssential !== "boolean"
    ) {
      throw new Error(
        `Valore esigenza non valido nel giorno ${expectedDates[index]}.`,
      );
    }

    return {
      date: item.date as string,
      entry: item.entry,
      note: item.note,
      isEssential: item.isEssential === true,
    };
  });

  return {
    format: "shifter-backup",
    version: 1,
    exportedAt: value.exportedAt,
    timezone: "Europe/Rome",
    period: {
      label: value.period.label,
      start: value.period.start,
      end: value.period.end,
    },
    days,
  };
}

export function exportBackup(schedule: Schedule): string {
  const backup: BackupFile = {
    format: "shifter-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    timezone: "Europe/Rome",
    period: { ...schedule.period },
    days: schedule.days.map((day: Day) => ({
      date: day.date,
      entry: day.entry ? { ...day.entry } : null,
      note: day.note,
      isEssential: day.isEssential === true,
    })),
  };

  return JSON.stringify(backup, null, 2);
}

export function importBackup(json: string): Schedule {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Il file non contiene JSON valido.");
  }

  const backup = validateBackup(parsed);

  return {
    formatVersion: 1,
    app: "turni-calendar",
    exportedAt: backup.exportedAt,
    timezone: "Europe/Rome",
    period: { ...backup.period },
    days: backup.days.map((day) => ({
      ...day,
      entry: day.entry ? { ...day.entry } : null,
      isEssential: day.isEssential === true,
    })),
  };
}
