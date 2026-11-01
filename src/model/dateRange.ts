import { listDates, parseISO, toISO } from "./dates";
import { periodForMonth, type Period } from "./period";

/**
 * Logica del selettore di periodo: cosa succede a ogni tocco, la griglia del mese,
 * a quale mese di riferimento appartiene un periodo. Nessun DOM, così si può provare da sola.
 */

/** Quale estremo si sta scegliendo: l'inizio o la fine. */
export type RangeFocus = "start" | "end";

export interface RangeSelection {
  start: string | null;
  end: string | null;
  focus: RangeFocus;
}

export interface CompleteRange {
  start: string;
  end: string;
}

export function isComplete(selection: RangeSelection): boolean {
  return selection.start !== null && selection.end !== null;
}

/** Sceglie quale estremo cambiare col prossimo tocco su un giorno. */
export function focusOn(selection: RangeSelection, focus: RangeFocus): RangeSelection {
  return { ...selection, focus };
}

/**
 * Tocco su un giorno.
 *  - Scegliendo l'inizio: il giorno diventa l'inizio. La fine resta se è ancora valida, altrimenti va riscelta.
 *    Poi si passa alla fine.
 *  - Scegliendo la fine: il giorno diventa la fine; se è prima dell'inizio il periodo riparte da quel giorno.
 * Per correggere un solo estremo basta toccare "Inizio" o "Fine" e poi il giorno.
 */
export function clickDay(selection: RangeSelection, day: string): RangeSelection {
  if (selection.focus === "start") {
    const end = selection.end !== null && selection.end >= day ? selection.end : null;
    return { start: day, end, focus: "end" };
  }

  if (selection.start === null || day < selection.start) {
    return { start: day, end: null, focus: "end" };
  }

  return { start: selection.start, end: day, focus: "end" };
}

/** Le 42 date (6 settimane, da lunedì a domenica) che coprono il mese: l'altezza non cambia da un mese all'altro. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // giorni dal lunedì precedente
  const start = new Date(Date.UTC(year, month - 1, 1 - offset));

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return toISO(day);
  });
}

export interface ReferenceMonth {
  year: number;
  month: number; // 1-12
  label: string; // "2026-11"
}

/**
 * Il mese di riferimento di un periodo (serve per il titolo e il nome del file): quello che contiene più giorni.
 * A parità vale il mese in cui il periodo inizia. Per i periodi "da lunedì a domenica" proposti dall'app
 * coincide sempre con il mese scelto.
 */
export function referenceMonth(start: string, end: string): ReferenceMonth {
  const counts = new Map<string, number>();

  for (const day of listDates(start, end)) {
    const key = day.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best = start.slice(0, 7);
  let bestCount = 0;

  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }

  const [year, month] = best.split("-").map(Number);
  return { year, month, label: best };
}

export function daysInRange(start: string, end: string): number {
  return listDates(start, end).length;
}

/** Mese precedente, corrente e successivo come periodi da lunedì a domenica. */
export function presetPeriods(now: Date): Period[] {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  return [-1, 0, 1].map((shift) => {
    const target = new Date(Date.UTC(year, month + shift, 1));
    return periodForMonth(target.getUTCFullYear(), target.getUTCMonth() + 1);
  });
}

export function samePeriod(selection: RangeSelection, period: Period): boolean {
  return selection.start === period.start && selection.end === period.end;
}

/** Sposta (anno, mese) avanti o indietro di `shift` mesi. */
export function shiftMonth(year: number, month: number, shift: number): { year: number; month: number } {
  const target = new Date(Date.UTC(year, month - 1 + shift, 1));
  return { year: target.getUTCFullYear(), month: target.getUTCMonth() + 1 };
}

/** Il giorno della settimana (0 = lunedì … 6 = domenica) di una data. */
export function weekdayIndex(iso: string): number {
  return (parseISO(iso).getUTCDay() + 6) % 7;
}
