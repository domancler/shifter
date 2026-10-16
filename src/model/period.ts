import { addDays } from "./dates";

export interface Period {
  label: string; // "2026-10"
  start: string; // primo lunedì del mese
  end: string;   // domenica prima del primo lunedì del mese dopo
}

// month: da 1 a 12
export function firstMondayOfMonth(year: number, month: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dow = first.getUTCDay(); // 0 = domenica, 1 = lunedì, ... 6 = sabato
  const offset = (8 - dow) % 7;  // giorni da aggiungere per arrivare al lunedì
  const monday = new Date(Date.UTC(year, month - 1, 1 + offset));
  return monday.toISOString().slice(0, 10);
}

export function periodForMonth(year: number, month: number): Period {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    label: `${year}-${String(month).padStart(2, "0")}`,
    start: firstMondayOfMonth(year, month),
    end: addDays(firstMondayOfMonth(nextYear, nextMonth), -1),
  };
}