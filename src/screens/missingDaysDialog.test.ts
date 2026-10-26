// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { confirmMissingDays, formatMissingDay } from "./missingDaysDialog";

const overlay = () => document.querySelector(".missing-days");
const chips = () => [...document.querySelectorAll(".missing-days-chip")].map((node) => node.textContent);
const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!.click();

describe("avviso giornate senza turno", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  afterEach(() => { document.body.innerHTML = ""; });

  it("formatta i giorni in modo leggibile", () => {
    expect(formatMissingDay("2026-11-02")).toBe("Lun 2 nov");
    expect(formatMissingDay("2026-12-31")).toBe("Gio 31 dic");
  });

  it("elenca le giornate e dice quante sono", () => {
    void confirmMissingDays(["2026-11-02", "2026-11-05", "2026-11-13"]);
    expect(chips()).toEqual(["Lun 2 nov", "Gio 5 nov", "Ven 13 nov"]);
    expect(document.querySelector(".missing-days-intro")?.textContent).toBe("Ci sono 3 giornate senza turno o giustificativo:");
    expect(document.querySelector(".missing-days h2")?.textContent).toBe("Giornate senza turno");
  });

  it("usa il singolare con una sola giornata", () => {
    void confirmMissingDays(["2026-11-02"]);
    expect(document.querySelector(".missing-days-intro")?.textContent).toBe("C'è 1 giornata senza turno o giustificativo:");
    expect(document.querySelector(".missing-days h2")?.textContent).toBe("Una giornata senza turno");
    expect(document.querySelector(".missing-days-note")?.textContent).toContain("questa giornata");
  });

  it("avvisa che l'evento già salvato in quelle giornate verrà rimosso", () => {
    void confirmMissingDays(["2026-11-02", "2026-11-03"]);
    expect(document.querySelector(".missing-days-note")?.textContent).toContain("verrà rimosso dal calendario");
  });

  it("«Salva comunque» conferma e chiude", async () => {
    const answer = confirmMissingDays(["2026-11-02"]);
    click(".missing-days-confirm");
    await expect(answer).resolves.toBe(true);
    expect(overlay()).toBeNull();
  });

  it("«Torna a compilare» annulla e chiude", async () => {
    const answer = confirmMissingDays(["2026-11-02"]);
    click(".exit-dialog-stay");
    await expect(answer).resolves.toBe(false);
    expect(overlay()).toBeNull();
  });

  it("Esc e un tocco fuori dalla finestra annullano", async () => {
    const first = confirmMissingDays(["2026-11-02"]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(first).resolves.toBe(false);

    const second = confirmMissingDays(["2026-11-02"]);
    document.querySelector<HTMLElement>(".exit-dialog-overlay")!.click();
    await expect(second).resolves.toBe(false);
    expect(overlay()).toBeNull();
  });

  it("il focus parte sull'opzione prudente", () => {
    void confirmMissingDays(["2026-11-02"]);
    expect(document.activeElement?.textContent).toBe("Torna a compilare");
  });
});
