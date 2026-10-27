import { describe, expect, it } from "vitest";
import { describeSaveResult } from "./saveSummary";

describe("describeSaveResult", () => {
  it("una riga per voce, con singolare e plurale", () => {
    expect(describeSaveResult({ created: 3, updated: 2, deleted: 1 })).toEqual([
      "3 eventi aggiunti",
      "2 eventi aggiornati",
      "1 evento eliminato",
    ]);
    expect(describeSaveResult({ created: 1, updated: 1, deleted: 2 })).toEqual([
      "1 evento aggiunto",
      "1 evento aggiornato",
      "2 eventi eliminati",
    ]);
  });

  it("le voci a zero non compaiono", () => {
    expect(describeSaveResult({ created: 0, updated: 5, deleted: 0 })).toEqual(["5 eventi aggiornati"]);
  });

  it("se non è cambiato nulla lo dice", () => {
    expect(describeSaveResult({ created: 0, updated: 0, deleted: 0 })).toEqual([
      "Nessuna modifica: il calendario era già aggiornato.",
    ]);
  });
});
