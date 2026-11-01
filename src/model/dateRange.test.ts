import { describe, expect, it } from "vitest";
import {
  clickDay,
  daysInRange,
  focusOn,
  isComplete,
  monthGrid,
  presetPeriods,
  referenceMonth,
  samePeriod,
  shiftMonth,
  weekdayIndex,
  type RangeSelection,
} from "./dateRange";
import { periodForMonth } from "./period";

const empty: RangeSelection = { start: null, end: null, focus: "start" };

describe("clickDay: scegliere inizio e fine", () => {
  it("dal vuoto: il primo tocco è l'inizio, il secondo la fine", () => {
    const first = clickDay(empty, "2026-11-02");
    expect(first).toEqual({ start: "2026-11-02", end: null, focus: "end" });
    expect(isComplete(first)).toBe(false);

    const second = clickDay(first, "2026-12-06");
    expect(second).toEqual({ start: "2026-11-02", end: "2026-12-06", focus: "end" });
    expect(isComplete(second)).toBe(true);
  });

  it("con la fine in primo piano un altro tocco sposta solo la fine", () => {
    const range: RangeSelection = { start: "2026-11-02", end: "2026-12-06", focus: "end" };
    expect(clickDay(range, "2026-12-13")).toEqual({ start: "2026-11-02", end: "2026-12-13", focus: "end" });
    expect(clickDay(range, "2026-11-02")).toEqual({ start: "2026-11-02", end: "2026-11-02", focus: "end" }); // un giorno solo
  });

  it("toccando un giorno prima dell'inizio mentre si sceglie la fine, il periodo riparte da lì", () => {
    const range: RangeSelection = { start: "2026-11-02", end: "2026-12-06", focus: "end" };
    expect(clickDay(range, "2026-10-20")).toEqual({ start: "2026-10-20", end: null, focus: "end" });
  });

  it("con l'inizio in primo piano cambia solo l'inizio e tiene la fine se è ancora valida", () => {
    const range = focusOn({ start: "2026-11-02", end: "2026-12-06", focus: "end" }, "start");
    expect(clickDay(range, "2026-11-04")).toEqual({ start: "2026-11-04", end: "2026-12-06", focus: "end" });
    expect(clickDay(range, "2026-10-26")).toEqual({ start: "2026-10-26", end: "2026-12-06", focus: "end" });
  });

  it("se il nuovo inizio supera la fine, la fine va riscelta", () => {
    const range = focusOn({ start: "2026-11-02", end: "2026-12-06", focus: "end" }, "start");
    expect(clickDay(range, "2026-12-20")).toEqual({ start: "2026-12-20", end: null, focus: "end" });
  });

  it("l'inizio può coincidere con la fine", () => {
    const range = focusOn({ start: "2026-11-02", end: "2026-11-10", focus: "end" }, "start");
    expect(clickDay(range, "2026-11-10")).toEqual({ start: "2026-11-10", end: "2026-11-10", focus: "end" });
  });

  it("clickDay non modifica lo stato di partenza", () => {
    const before: RangeSelection = { start: "2026-11-02", end: "2026-12-06", focus: "end" };
    const copy = { ...before };
    clickDay(before, "2026-12-13");
    expect(before).toEqual(copy);
  });
});

describe("monthGrid", () => {
  it("novembre 2026: sei settimane da lunedì 26 ottobre a domenica 6 dicembre", () => {
    const grid = monthGrid(2026, 11);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid[6]).toBe("2026-11-01"); // il 1 novembre è domenica
    expect(grid[41]).toBe("2026-12-06");
    expect(weekdayIndex(grid[0])).toBe(0);
    expect(weekdayIndex(grid[41])).toBe(6);
  });

  it("un mese che inizia di lunedì parte proprio da quel giorno", () => {
    const grid = monthGrid(2027, 2); // 1 febbraio 2027 è lunedì
    expect(grid[0]).toBe("2027-02-01");
    expect(grid[41]).toBe("2027-03-14");
  });

  it("ogni griglia ha 42 giorni consecutivi, a cavallo dell'anno compreso", () => {
    for (const [year, month] of [[2026, 12], [2027, 1], [2028, 2]]) {
      const grid = monthGrid(year, month);
      expect(grid).toHaveLength(42);
      grid.slice(1).forEach((day, index) => expect(day > grid[index]).toBe(true));
      expect(grid.some((day) => day === `${year}-${String(month).padStart(2, "0")}-01`)).toBe(true);
    }
  });
});

describe("referenceMonth", () => {
  it("i periodi proposti dall'app danno sempre il mese scelto", () => {
    for (let month = 1; month <= 12; month++) {
      const period = periodForMonth(2026, month);
      expect(referenceMonth(period.start, period.end).label).toBe(period.label);
    }
    // anche per anni diversi (inizio gennaio, fine dicembre)
    for (const year of [2025, 2026, 2027, 2028]) {
      const period = periodForMonth(year, 1);
      expect(referenceMonth(period.start, period.end).label).toBe(period.label);
    }
  });

  it("un periodo personalizzato prende il mese con più giorni", () => {
    expect(referenceMonth("2026-11-25", "2026-12-20")).toMatchObject({ year: 2026, month: 12, label: "2026-12" });
    expect(referenceMonth("2026-10-28", "2026-11-30")).toMatchObject({ label: "2026-11" });
  });

  it("a parità vale il mese in cui il periodo inizia", () => {
    expect(referenceMonth("2026-11-15", "2026-12-14").label).toBe("2026-11"); // 16 giorni a novembre, 14 a dicembre → novembre
    expect(referenceMonth("2026-11-16", "2026-12-15").label).toBe("2026-11"); // 15 e 15: parità → inizio
  });

  it("un solo giorno", () => {
    expect(referenceMonth("2026-11-02", "2026-11-02")).toEqual({ year: 2026, month: 11, label: "2026-11" });
  });
});

describe("altre funzioni", () => {
  it("daysInRange conta gli estremi", () => {
    expect(daysInRange("2026-11-02", "2026-12-06")).toBe(35);
    expect(daysInRange("2026-11-02", "2026-11-02")).toBe(1);
  });

  it("presetPeriods: mese precedente, corrente e successivo, anche a cavallo dell'anno", () => {
    const labels = (date: Date) => presetPeriods(date).map((period) => period.label);
    expect(labels(new Date(2026, 10, 10))).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(labels(new Date(2026, 11, 20))).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(labels(new Date(2027, 0, 5))).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(presetPeriods(new Date(2026, 10, 10))[1]).toEqual(periodForMonth(2026, 11));
  });

  it("samePeriod confronta inizio e fine", () => {
    const period = periodForMonth(2026, 11);
    expect(samePeriod({ start: period.start, end: period.end, focus: "end" }, period)).toBe(true);
    expect(samePeriod({ start: period.start, end: "2026-12-07", focus: "end" }, period)).toBe(false);
    expect(samePeriod(empty, period)).toBe(false);
  });

  it("shiftMonth gestisce il cambio d'anno", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, 0)).toEqual({ year: 2026, month: 6 });
  });
});
