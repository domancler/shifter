import { describe, expect, it } from "vitest";
import { wizardProgressPercent } from "./progress";

describe("wizardProgressPercent", () => {
  it("alla prima giornata è 0%", () => {
    expect(wizardProgressPercent(0, 35)).toBe(0);
    expect(wizardProgressPercent(0, 1)).toBe(0);
  });

  it("cresce con i giorni già superati", () => {
    expect(wizardProgressPercent(1, 35)).toBe(2);
    expect(wizardProgressPercent(7, 35)).toBe(20);
    expect(wizardProgressPercent(17, 35)).toBe(48);
  });

  it("all'ultima giornata non è 100%", () => {
    expect(wizardProgressPercent(34, 35)).toBe(97);
    expect(wizardProgressPercent(27, 28)).toBe(96);
  });

  it("nemmeno con periodi molto lunghi arriva a 100% prima del tempo", () => {
    expect(wizardProgressPercent(364, 365)).toBe(99);
    expect(wizardProgressPercent(999, 1000)).toBe(99);
  });

  it("è 100% solo quando tutte le giornate sono superate", () => {
    expect(wizardProgressPercent(35, 35)).toBe(100);
  });

  it("valori fuori misura non producono numeri strani", () => {
    expect(wizardProgressPercent(-3, 35)).toBe(0);
    expect(wizardProgressPercent(80, 35)).toBe(100);
    expect(wizardProgressPercent(5, 0)).toBe(0);
  });
});
