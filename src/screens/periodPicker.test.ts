// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { periodForMonth } from "../model/period";
import { createPeriodPicker, type PeriodPicker } from "./periodPicker";

const cells = (picker: PeriodPicker) => [...picker.element.querySelectorAll<HTMLElement>(".period-cell")];
const day = (picker: PeriodPicker, iso: string) =>
  picker.element.querySelector<HTMLButtonElement>(`.period-day[data-date="${iso}"]`)!;
const title = (picker: PeriodPicker) => picker.element.querySelector(".period-nav-title")!.textContent;
const info = (picker: PeriodPicker) => picker.element.querySelector(".period-info")!.textContent;
const pill = (picker: PeriodPicker, caption: "Inizio" | "Fine") =>
  [...picker.element.querySelectorAll<HTMLButtonElement>(".period-pill")].find((node) => node.textContent?.startsWith(caption))!;
const preset = (picker: PeriodPicker, name: string) =>
  [...picker.element.querySelectorAll<HTMLButtonElement>(".period-preset")].find((node) => node.textContent === name)!;
const nav = (picker: PeriodPicker, label: string) =>
  picker.element.querySelector<HTMLButtonElement>(`.period-nav-button[aria-label="${label}"]`)!;
const dateOf = (node: HTMLElement) => node.querySelector<HTMLElement>(".period-day")!.dataset.date;

function mount(options?: Parameters<typeof createPeriodPicker>[0]): PeriodPicker {
  const picker = createPeriodPicker(options);
  document.body.append(picker.element);
  return picker;
}

describe("selettore di periodo", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 12)); // 10 novembre 2026
  });
  afterEach(() => vi.useRealTimers());

  describe("all'apertura", () => {
    it("propone il periodo del mese corrente, da lunedì a domenica", () => {
      const picker = mount();
      expect(picker.getPeriod()).toEqual({ label: "2026-11", start: "2026-11-02", end: "2026-12-06" });
      expect(title(picker)).toBe("Novembre 2026");
      expect(info(picker)).toBe("35 giorni · Mese di riferimento: novembre 2026");
    });

    it("mostra sei settimane da lunedì, con la fascia dal 2 novembre al 6 dicembre", () => {
      const picker = mount();
      const all = cells(picker);

      expect(all).toHaveLength(42);
      expect(dateOf(all[0])).toBe("2026-10-26");
      expect(dateOf(all[41])).toBe("2026-12-06");

      expect(all.filter((cell) => cell.classList.contains("range-start")).map(dateOf)).toEqual(["2026-11-02"]);
      expect(all.filter((cell) => cell.classList.contains("range-end")).map(dateOf)).toEqual(["2026-12-06"]);
      expect(all.filter((cell) => cell.classList.contains("in-range"))).toHaveLength(33); // 3 nov – 5 dic
      expect(all.slice(0, 7).some((cell) => cell.classList.contains("in-range"))).toBe(false); // la prima riga è prima dell'inizio
    });

    it("la fascia che unisce inizio e fine c'è solo a periodo completo e di più giorni", () => {
      const picker = mount();
      const band = (cls: string) => cells(picker).filter((cell) => cell.classList.contains(cls)).map(dateOf);

      expect(band("band-right")).toEqual(["2026-11-02"]);
      expect(band("band-left")).toEqual(["2026-12-06"]);

      day(picker, "2026-10-28").click(); // inizio senza fine: niente fascia
      expect(band("band-right")).toEqual([]);
      expect(band("band-left")).toEqual([]);

      day(picker, "2026-10-28").click(); // fine = inizio: un giorno solo, niente fascia
      expect(picker.getPeriod()).toMatchObject({ start: "2026-10-28", end: "2026-10-28" });
      expect(band("band-right")).toEqual([]);
      expect(band("band-left")).toEqual([]);
    });

    it("i giorni degli altri mesi sono visibili e attenuati; oggi è segnato", () => {
      const picker = mount();
      expect(day(picker, "2026-10-26").closest(".period-cell")!.classList.contains("is-outside")).toBe(true);
      expect(day(picker, "2026-12-03").closest(".period-cell")!.classList.contains("is-outside")).toBe(true);
      expect(day(picker, "2026-11-10").closest(".period-cell")!.classList.contains("is-today")).toBe(true);
      expect(picker.element.querySelectorAll(".is-today")).toHaveLength(1);
    });

    it("i giorni hanno un nome leggibile per chi usa uno screen reader", () => {
      const picker = mount();
      expect(day(picker, "2026-11-02").getAttribute("aria-label")).toBe("lunedì 2 novembre 2026");
      expect(day(picker, "2026-11-02").getAttribute("aria-pressed")).toBe("true");
      expect(day(picker, "2026-11-03").getAttribute("aria-pressed")).toBe("false");
    });

    it("si può partire da un periodo dato", () => {
      const picker = mount({ initial: periodForMonth(2027, 2) });
      expect(title(picker)).toBe("Febbraio 2027");
      expect(picker.getPeriod()).toEqual({ label: "2027-02", start: "2027-02-01", end: "2027-02-28" }); // 1 febbraio e 1 marzo 2027 sono lunedì
    });
  });

  describe("scorciatoie", () => {
    it("mese precedente, corrente e successivo, con quello corrente evidenziato", () => {
      const picker = mount();
      const chips = [...picker.element.querySelectorAll(".period-preset")];
      expect(chips.map((chip) => chip.textContent)).toEqual(["Ottobre", "Novembre", "Dicembre", "Altro mese"]);
      expect(preset(picker, "Novembre").classList.contains("is-active")).toBe(true);
      expect(preset(picker, "Dicembre").classList.contains("is-active")).toBe(false);
    });

    it("toccando «Dicembre» cambia periodo e mese mostrato", () => {
      const picker = mount();
      preset(picker, "Dicembre").click();

      expect(picker.getPeriod()).toEqual({ label: "2026-12", start: "2026-12-07", end: "2027-01-03" });
      expect(title(picker)).toBe("Dicembre 2026");
      expect(preset(picker, "Dicembre").classList.contains("is-active")).toBe(true);
      expect(preset(picker, "Novembre").classList.contains("is-active")).toBe(false);
    });

    it("a fine anno aggiunge l'anno ai mesi dell'anno dopo", () => {
      vi.setSystemTime(new Date(2026, 11, 20, 12));
      const picker = mount();
      expect([...picker.element.querySelectorAll(".period-preset")].map((chip) => chip.textContent)).toEqual([
        "Novembre",
        "Dicembre",
        "Gen 2027",
        "Altro mese",
      ]);
    });

    it("se si modifica il periodo a mano la scorciatoia non risulta più attiva", () => {
      const picker = mount();
      day(picker, "2026-11-30").click(); // nuova fine
      expect(preset(picker, "Novembre").classList.contains("is-active")).toBe(false);
    });
  });

  describe("altro mese", () => {
    const other = (picker: PeriodPicker) => picker.element.querySelector<HTMLButtonElement>(".period-preset.is-other")!;
    const chooser = (picker: PeriodPicker) => picker.element.querySelector(".period-months");
    const monthButton = (picker: PeriodPicker, key: string) =>
      picker.element.querySelector<HTMLButtonElement>(`.period-month[data-month="${key}"]`)!;
    const year = (picker: PeriodPicker) => picker.element.querySelector(".period-months-year")!.textContent;

    it("all'inizio il selettore è chiuso; «Altro mese» lo apre e lo richiude", () => {
      const picker = mount();
      expect(chooser(picker)).toBeNull();
      expect(other(picker).textContent).toBe("Altro mese");
      expect(other(picker).getAttribute("aria-expanded")).toBe("false");

      other(picker).click();
      expect(chooser(picker)).not.toBeNull();
      expect(other(picker).getAttribute("aria-expanded")).toBe("true");

      other(picker).click();
      expect(chooser(picker)).toBeNull();
    });

    it("mostra l'anno del periodo scelto e dodici mesi, con quello scelto evidenziato", () => {
      const picker = mount();
      other(picker).click();

      expect(year(picker)).toBe("2026");
      const months = [...picker.element.querySelectorAll<HTMLButtonElement>(".period-month")];
      expect(months.map((node) => node.textContent)).toEqual([
        "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
      ]);
      expect(months.filter((node) => node.classList.contains("is-active")).map((node) => node.dataset.month)).toEqual(["2026-11"]);
      expect(monthButton(picker, "2026-11").classList.contains("is-current")).toBe(true); // oggi è novembre
      expect(monthButton(picker, "2026-11").getAttribute("aria-label")).toBe("Novembre 2026");
    });

    it("per andare a gennaio 2027: anno successivo e «Gen»", () => {
      const picker = mount();
      other(picker).click();
      picker.element.querySelector<HTMLButtonElement>('.period-months .period-nav-button[aria-label="Anno successivo"]')!.click();
      expect(year(picker)).toBe("2027");

      monthButton(picker, "2027-01").click();

      const january = periodForMonth(2027, 1);
      expect(picker.getPeriod()).toEqual({ label: "2027-01", start: january.start, end: january.end });
      expect(title(picker)).toBe("Gennaio 2027"); // il calendario si sposta sul mese scelto
      expect(chooser(picker)).toBeNull(); // il selettore si chiude da solo
    });

    it("dopo la scelta il tasto prende il nome del mese, evidenziato, e le scorciatoie non lo sono", () => {
      const picker = mount();
      other(picker).click();
      picker.element.querySelector<HTMLButtonElement>('.period-months .period-nav-button[aria-label="Anno successivo"]')!.click();
      monthButton(picker, "2027-01").click();

      expect(other(picker).textContent).toBe("Gen 2027");
      expect(other(picker).getAttribute("aria-label")).toBe("Gennaio 2027");
      expect(other(picker).classList.contains("is-active")).toBe(true);
      expect([...picker.element.querySelectorAll(".period-preset.is-active")]).toHaveLength(1);
    });

    it("un mese già tra le scorciatoie si evidenzia lì e «Altro mese» resta com'è", () => {
      const picker = mount();
      other(picker).click();
      monthButton(picker, "2026-12").click();

      expect(preset(picker, "Dicembre").classList.contains("is-active")).toBe(true);
      expect(other(picker).textContent).toBe("Altro mese");
      expect(other(picker).classList.contains("is-active")).toBe(false);
    });

    it("un mese dell'anno corrente fuori dalle scorciatoie mantiene il nome intero", () => {
      const picker = mount();
      other(picker).click();
      monthButton(picker, "2026-03").click();
      expect(other(picker).textContent).toBe("Marzo");
      expect(other(picker).classList.contains("is-active")).toBe(true);
    });

    it("anche gli anni passati si possono raggiungere", () => {
      const picker = mount();
      other(picker).click();
      const back = () => picker.element.querySelector<HTMLButtonElement>('.period-months .period-nav-button[aria-label="Anno precedente"]')!.click();
      back();
      back();
      expect(year(picker)).toBe("2024");
      monthButton(picker, "2024-02").click();
      expect(picker.getPeriod()).toMatchObject({ label: "2024-02" });
      expect(other(picker).textContent).toBe("Feb 2024");
    });

    it("se il periodo è stato modificato a mano il tasto torna «Altro mese» e il selettore parte dall'anno mostrato", () => {
      const picker = mount();
      other(picker).click();
      monthButton(picker, "2026-12").click();
      day(picker, "2026-12-18").click(); // fine spostata: non è più il periodo di un mese
      nav(picker, "Mese successivo").click();
      nav(picker, "Mese successivo").click(); // calendario su febbraio 2027

      expect(other(picker).textContent).toBe("Altro mese");
      expect(other(picker).classList.contains("is-active")).toBe(false);

      other(picker).click();
      expect(year(picker)).toBe("2027"); // l'anno del calendario che si sta guardando
      expect(picker.element.querySelectorAll(".period-month.is-active")).toHaveLength(0);
    });

    it("avvisa chi lo usa quando si sceglie un mese, ma non aprendo o chiudendo il selettore o cambiando anno", () => {
      const onChange = vi.fn();
      const picker = mount({ onChange });

      other(picker).click();
      picker.element.querySelector<HTMLButtonElement>('.period-months .period-nav-button[aria-label="Anno successivo"]')!.click();
      other(picker).click();
      expect(onChange).not.toHaveBeenCalled();

      other(picker).click();
      monthButton(picker, "2026-11").click();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("scegliendo un mese il periodo è quello da lunedì a domenica, come per le scorciatoie", () => {
      const picker = mount();
      other(picker).click();
      picker.element.querySelector<HTMLButtonElement>('.period-months .period-nav-button[aria-label="Anno successivo"]')!.click();
      monthButton(picker, "2027-02").click();
      expect(picker.getPeriod()).toEqual({ label: "2027-02", start: "2027-02-01", end: "2027-02-28" });
    });
  });

  describe("scegliere inizio e fine", () => {
    it("dopo la scelta di un periodo si passa alla fine: un tocco cambia la fine", () => {
      const picker = mount();
      expect(pill(picker, "Fine").getAttribute("aria-pressed")).toBe("true");

      day(picker, "2026-11-30").click();
      expect(picker.getPeriod()).toEqual({ label: "2026-11", start: "2026-11-02", end: "2026-11-30" });
      expect(info(picker)).toBe("29 giorni · Mese di riferimento: novembre 2026");
    });

    it("toccando «Inizio» si cambia solo l'inizio e la fine resta", () => {
      const picker = mount();
      pill(picker, "Inizio").click();
      expect(pill(picker, "Inizio").getAttribute("aria-pressed")).toBe("true");

      day(picker, "2026-10-28").click();

      expect(picker.getPeriod()).toEqual({ label: "2026-11", start: "2026-10-28", end: "2026-12-06" });
      expect(pill(picker, "Fine").getAttribute("aria-pressed")).toBe("true"); // si passa alla fine
    });

    it("scegliendo la fine un giorno prima dell'inizio il periodo riparte da lì e chiede la fine", () => {
      const picker = mount();
      day(picker, "2026-10-28").click(); // prima dell'inizio (2 novembre)

      expect(picker.getPeriod()).toBeNull();
      expect(pill(picker, "Fine").textContent).toContain("Da scegliere");
      expect(info(picker)).toBe("Ora tocca il giorno di fine.");

      day(picker, "2026-11-30").click();
      expect(picker.getPeriod()).toEqual({ label: "2026-11", start: "2026-10-28", end: "2026-11-30" });
    });

    it("un nuovo inizio dopo la fine svuota la fine", () => {
      const picker = mount();
      pill(picker, "Inizio").click();
      nav(picker, "Mese successivo").click();
      day(picker, "2026-12-20").click(); // dopo la fine (6 dicembre)

      expect(picker.getPeriod()).toBeNull();
      expect(day(picker, "2026-12-20").getAttribute("aria-pressed")).toBe("true");
    });

    it("un solo giorno è un periodo valido", () => {
      const picker = mount();
      pill(picker, "Inizio").click();
      day(picker, "2026-11-10").click(); // inizio 10 novembre, fine 6 dicembre
      pill(picker, "Fine").click();
      day(picker, "2026-11-10").click(); // fine 10 novembre

      expect(picker.getPeriod()).toEqual({ label: "2026-11", start: "2026-11-10", end: "2026-11-10" });
      expect(info(picker)).toBe("1 giorno · Mese di riferimento: novembre 2026");
    });

    it("il mese di riferimento segue i giorni scelti, non il mese mostrato", () => {
      const picker = mount();
      pill(picker, "Inizio").click();
      nav(picker, "Mese successivo").click();
      day(picker, "2026-12-01").click(); // inizio 1 dicembre
      day(picker, "2026-12-31").click(); // fine 31 dicembre (focus passato alla fine)

      expect(picker.getPeriod()).toEqual({ label: "2026-12", start: "2026-12-01", end: "2026-12-31" });
    });

    it("dopo il tocco il focus resta sul giorno scelto (tastiera)", () => {
      const picker = mount();
      day(picker, "2026-11-30").click();
      expect((document.activeElement as HTMLElement).dataset.date).toBe("2026-11-30");
    });
  });

  describe("calendario", () => {
    it("scorre i mesi avanti e indietro, anche a cavallo dell'anno", () => {
      const picker = mount();
      nav(picker, "Mese successivo").click();
      expect(title(picker)).toBe("Dicembre 2026");
      nav(picker, "Mese successivo").click();
      expect(title(picker)).toBe("Gennaio 2027");
      nav(picker, "Mese precedente").click();
      nav(picker, "Mese precedente").click();
      nav(picker, "Mese precedente").click();
      expect(title(picker)).toBe("Ottobre 2026");
    });

    it("cambiare mese non cambia il periodo scelto", () => {
      const picker = mount();
      nav(picker, "Mese successivo").click();
      nav(picker, "Mese successivo").click();
      expect(picker.getPeriod()).toEqual({ label: "2026-11", start: "2026-11-02", end: "2026-12-06" });
    });

    it("la fascia si vede anche sul mese successivo, fino alla fine", () => {
      const picker = mount();
      nav(picker, "Mese successivo").click();
      const inRange = cells(picker).filter((cell) => cell.classList.contains("in-range")).map(dateOf);
      expect(inRange[0]).toBe("2026-11-30"); // la griglia di dicembre parte da lunedì 30 novembre
      expect(inRange.at(-1)).toBe("2026-12-05");
      expect(cells(picker).filter((cell) => cell.classList.contains("range-end")).map(dateOf)).toEqual(["2026-12-06"]);
    });
  });

  describe("notifiche e messaggi", () => {
    it("avvisa chi lo usa a ogni scelta, ma non quando si sfoglia il calendario", () => {
      const onChange = vi.fn();
      const picker = mount({ onChange });

      nav(picker, "Mese successivo").click();
      expect(onChange).not.toHaveBeenCalled();

      day(picker, "2026-12-13").click();
      preset(picker, "Ottobre").click();
      pill(picker, "Inizio").click();
      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });
});
