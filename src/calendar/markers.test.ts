import { describe, expect, it } from "vitest";
import { entryForLeave, entryForShift } from "../model/schedule";
import type { Day } from "../model/types";
import { buildMarkers, parseMarkers } from "./markers";

describe("marcatori", () => {
  it("scrivere e rileggere dà lo stesso risultato (turno con esigenza)", () => {
    const day: Day = { date: "2026-11-05", entry: entryForShift("2026-11-05", "23-07"), note: "", isEssential: true };
    const markers = buildMarkers(day);
    expect(markers).toMatchObject({ turniApp: "turni-calendar", turniSchema: "1", turniDay: "2026-11-05", turniKind: "shift", turniCode: "23-07", turniEssential: "1" });
    expect(parseMarkers(markers!)).toEqual({ schema: "1", day: "2026-11-05", kind: "shift", code: "23-07", essential: true });
  });

  it("giustificativo senza esigenza: niente turniEssential", () => {
    const day: Day = { date: "2026-11-06", entry: entryForLeave("RS"), note: "" };
    const markers = buildMarkers(day)!;
    expect(markers.turniKind).toBe("leave");
    expect("turniEssential" in markers).toBe(false);
    expect(parseMarkers(markers)?.essential).toBe(false);
  });

  it("giorno vuoto: nessun evento; evento altrui: non è dell'app", () => {
    expect(buildMarkers({ date: "2026-11-07", entry: null, note: "" })).toBeNull();
    expect(parseMarkers({})).toBeNull();
    expect(parseMarkers({ turniApp: "altra-app" })).toBeNull();
  });
});
