// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showProgressToast, showToast } from "./toast";

const toasts = () => [...document.querySelectorAll(".toast")];
const lines = () => [...document.querySelectorAll(".toast-lines li")].map((node) => node.textContent);

describe("notifiche", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });
  afterEach(() => vi.useRealTimers());

  it("un testo semplice sparisce dopo la durata di default (3 secondi)", () => {
    showToast("Fatto", "success");
    expect(document.querySelector(".toast-message")?.textContent).toBe("Fatto");

    vi.advanceTimersByTime(3000 + 200);
    expect(toasts()).toHaveLength(0);
  });

  it("più righe vengono mostrate una sotto l'altra", () => {
    showToast(["3 eventi aggiunti", "2 eventi aggiornati", "1 evento eliminato"], "success", "Salvataggio completato", 0);
    expect(lines()).toEqual(["3 eventi aggiunti", "2 eventi aggiornati", "1 evento eliminato"]);
    expect(document.querySelector(".toast-title")?.textContent).toBe("Salvataggio completato");
    expect(document.querySelector(".toast-message")).toBeNull();
  });

  it("con durata 0 resta finché non viene chiusa", () => {
    showToast("Resto qui", "info", undefined, 0);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(toasts()).toHaveLength(1);

    document.querySelector<HTMLButtonElement>(".toast-close")!.click();
    vi.advanceTimersByTime(200);
    expect(toasts()).toHaveLength(0);
  });

  it("la barra mostra quante operazioni sono fatte su quante in totale", () => {
    const toast = showProgressToast("Salvataggio su Google Calendar", "Controllo del calendario…");
    expect(document.querySelector(".toast-progress-track")?.classList.contains("is-indeterminate")).toBe(true);

    toast.update({ message: "Aggiorno il calendario…", progress: { done: 0, total: 12 } });
    const fill = () => document.querySelector<HTMLElement>(".toast-progress-fill")!;
    const label = () => document.querySelector(".toast-progress-label")!.textContent;
    expect(label()).toBe("0 di 12");
    expect(fill().style.width).toBe("0%");
    expect(document.querySelector(".toast-progress-track")?.classList.contains("is-indeterminate")).toBe(false);

    toast.update({ progress: { done: 3, total: 12 } });
    expect(label()).toBe("3 di 12");
    expect(fill().style.width).toBe("25%");
    expect(document.querySelector(".toast-progress")?.getAttribute("aria-valuenow")).toBe("3");

    toast.update({ progress: { done: 12, total: 12 } });
    expect(fill().style.width).toBe("100%");
  });

  it("la notifica di avanzamento resta finché non cambia, anche se ci mette molto", () => {
    showProgressToast("Salvataggio", "In corso");
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(toasts()).toHaveLength(1);
  });

  it("a lavoro finito la stessa notifica diventa l'esito, senza barra e senza sparire", () => {
    const toast = showProgressToast("Salvataggio su Google Calendar", "Controllo del calendario…");
    toast.update({ progress: { done: 2, total: 2 } });

    toast.update({
      type: "success",
      title: "Salvataggio completato",
      message: ["2 eventi aggiunti"],
      progress: null,
      duration: 0,
    });

    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].classList.contains("toast-success")).toBe(true);
    expect(toasts()[0].classList.contains("toast-info")).toBe(false);
    expect(document.querySelector<HTMLElement>(".toast-progress")!.hidden).toBe(true);
    expect(document.querySelector(".toast-title")?.textContent).toBe("Salvataggio completato");
    expect(lines()).toEqual(["2 eventi aggiunti"]);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(toasts()).toHaveLength(1);
  });

  it("un errore dopo l'avanzamento resta visibile a lungo, poi sparisce", () => {
    const toast = showProgressToast("Salvataggio", "In corso");
    toast.update({ type: "error", message: "Qualcosa non va", progress: null, duration: 12000 });

    expect(toasts()[0].getAttribute("role")).toBe("alert");
    vi.advanceTimersByTime(11000);
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1200);
    expect(toasts()).toHaveLength(0);
  });

  it("dopo la chiusura gli aggiornamenti vengono ignorati", () => {
    const toast = showProgressToast("Salvataggio", "In corso");
    toast.close();
    vi.advanceTimersByTime(200);
    expect(() => toast.update({ progress: { done: 1, total: 2 } })).not.toThrow();
    expect(toasts()).toHaveLength(0);
  });
});
