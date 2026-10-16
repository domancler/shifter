import { describe, it, expect } from "vitest";
import { periodForMonth } from "./period";
import { listDates } from "./dates";

describe("periodForMonth", () => {
  it("settembre 2026: 07/09 -> 04/10", () => {
    const p = periodForMonth(2026, 9);
    expect(p.start).toBe("2026-09-07");
    expect(p.end).toBe("2026-10-04");
  });

  it("ottobre 2026: 05/10 -> 01/11", () => {
    const p = periodForMonth(2026, 10);
    expect(p.start).toBe("2026-10-05");
    expect(p.end).toBe("2026-11-01");
  });

  it("novembre 2026: 02/11 -> 06/12 (5 settimane)", () => {
    const p = periodForMonth(2026, 11);
    expect(p.start).toBe("2026-11-02");
    expect(p.end).toBe("2026-12-06");
    expect(listDates(p.start, p.end)).toHaveLength(35);
  });

  it("giugno 2026: il 1° è lunedì, quindi parte il 01/06", () => {
    const p = periodForMonth(2026, 6);
    expect(p.start).toBe("2026-06-01");
    expect(p.end).toBe("2026-07-05");
  });

  it("dicembre 2026: il mese dopo è gennaio 2027", () => {
    const p = periodForMonth(2026, 12);
    expect(p.start).toBe("2026-12-07");
    expect(p.end).toBe("2027-01-03");
  });

  it("l'ora legale non altera le date (ottobre 2026 = 28 giorni)", () => {
    const p = periodForMonth(2026, 10);
    expect(listDates(p.start, p.end)).toHaveLength(28);
  });
});