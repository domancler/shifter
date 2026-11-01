// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../router", () => ({ go: vi.fn() }));
vi.mock("../toast", () => ({ showToast: vi.fn() }));
vi.mock("../model/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../model/session")>()),
  setActiveSchedule: vi.fn(),
  setWizardIndex: vi.fn(),
  setScheduleSource: vi.fn(),
  getActiveSchedule: vi.fn(() => null),
  getWizardIndex: vi.fn(() => 0),
}));
vi.mock("../calendar/googleClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../calendar/googleClient")>()),
  isGoogleConnected: vi.fn(() => true),
}));
vi.mock("../calendar/googleProvider", () => ({
  GoogleCalendarProvider: class {
    listMarkedEvents = listMarkedEvents;
  },
}));

const listMarkedEvents = vi.hoisted(() => vi.fn(async (_from: string, _to: string) => []));

import { go } from "../router";
import { setActiveSchedule, setWizardIndex } from "../model/session";
import { calendarImportScreen } from "./calendarImport";
import { manualScreen } from "./manual";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const byText = (root: ParentNode, text: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.trim() === text)!;
/** I riquadri «Inizio» e «Fine» contengono anche la data: si riconoscono dall'etichetta. */
const pill = (root: ParentNode, caption: "Inizio" | "Fine") =>
  [...root.querySelectorAll<HTMLButtonElement>(".period-pill")].find((node) => node.textContent?.startsWith(caption))!;
const day = (root: ParentNode, iso: string) => root.querySelector<HTMLButtonElement>(`.period-day[data-date="${iso}"]`)!;

describe("schermate che scelgono il periodo", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 12));
  });
  afterEach(() => vi.useRealTimers());

  describe("inserimento a mano", () => {
    it("senza toccare nulla parte dal periodo del mese corrente", () => {
      const screen = manualScreen();
      document.body.append(screen);

      byText(screen, "Inizia il programmato").click();

      const schedule = vi.mocked(setActiveSchedule).mock.calls[0][0]!;
      expect(schedule.period).toEqual({ label: "2026-11", start: "2026-11-02", end: "2026-12-06" });
      expect(schedule.days).toHaveLength(35);
      expect(setWizardIndex).toHaveBeenCalledWith(0);
      expect(go).toHaveBeenCalledWith("wizard");
    });

    it("con la scorciatoia «Dicembre» crea il programmato di dicembre", () => {
      const screen = manualScreen();
      document.body.append(screen);

      byText(screen, "Dicembre").click();
      byText(screen, "Inizia il programmato").click();

      expect(vi.mocked(setActiveSchedule).mock.calls[0][0]!.period).toEqual({
        label: "2026-12",
        start: "2026-12-07",
        end: "2027-01-03",
      });
    });

    it("scegliendo gennaio 2027 da «Altro mese» crea il programmato di gennaio", () => {
      const screen = manualScreen();
      document.body.append(screen);

      byText(screen, "Altro mese").click();
      screen.querySelector<HTMLButtonElement>('.period-months .period-nav-button[aria-label="Anno successivo"]')!.click();
      screen.querySelector<HTMLButtonElement>('.period-month[data-month="2027-01"]')!.click();
      byText(screen, "Inizia il programmato").click();

      const schedule = vi.mocked(setActiveSchedule).mock.calls[0][0]!;
      expect(schedule.period).toEqual({ label: "2027-01", start: "2027-01-04", end: "2027-01-31" });
      expect(schedule.days).toHaveLength(28);
    });

    it("con un periodo scelto a mano usa le date toccate", () => {
      const screen = manualScreen();
      document.body.append(screen);

      pill(screen, "Inizio").click();
      day(screen, "2026-11-04").click();
      day(screen, "2026-11-29").click();
      byText(screen, "Inizia il programmato").click();

      const schedule = vi.mocked(setActiveSchedule).mock.calls[0][0]!;
      expect(schedule.period).toEqual({ label: "2026-11", start: "2026-11-04", end: "2026-11-29" });
      expect(schedule.days).toHaveLength(26);
    });

    it("se manca la fine non parte e spiega cosa fare; l'avviso sparisce appena si sceglie", () => {
      const screen = manualScreen();
      document.body.append(screen);
      const error = () => screen.querySelector(".error")!.textContent;

      day(screen, "2026-10-28").click(); // prima dell'inizio: la fine va riscelta
      byText(screen, "Inizia il programmato").click();

      expect(error()).toBe("Scegli il giorno di inizio e quello di fine.");
      expect(setActiveSchedule).not.toHaveBeenCalled();
      expect(go).not.toHaveBeenCalled();

      day(screen, "2026-11-30").click();
      expect(error()).toBe("");
    });
  });

  describe("recupero da Google Calendar", () => {
    it("legge il periodo scelto", async () => {
      const screen = calendarImportScreen();
      document.body.append(screen);

      byText(screen, "Recupera da Google Calendar").click();
      await flush();

      expect(listMarkedEvents).toHaveBeenCalledWith("2026-11-02", "2026-12-06");
      expect(screen.querySelector(".calendar-result")!.textContent).toContain("Nessun turno trovato");
    });

    it("rispetta il periodo cambiato a mano", async () => {
      const screen = calendarImportScreen();
      document.body.append(screen);

      pill(screen, "Fine").click();
      day(screen, "2026-11-22").click();
      byText(screen, "Recupera da Google Calendar").click();
      await flush();

      expect(listMarkedEvents).toHaveBeenCalledWith("2026-11-02", "2026-11-22");
    });

    it("senza la fine non chiama Google e lo dice", async () => {
      const screen = calendarImportScreen();
      document.body.append(screen);

      day(screen, "2026-10-28").click();
      byText(screen, "Recupera da Google Calendar").click();
      await flush();

      expect(listMarkedEvents).not.toHaveBeenCalled();
      expect(screen.querySelector(".import-status")!.textContent).toBe("Scegli il giorno di inizio e quello di fine.");
    });
  });
});
