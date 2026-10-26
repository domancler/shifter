import { el } from "../ui";
import { createIcon } from "../icons";
import { formatDate } from "../model/schedule";

/** "Lun 3 nov": giorno della settimana, giorno e mese abbreviati, con l'iniziale maiuscola. */
export function formatMissingDay(iso: string): string {
  const text = formatDate(iso, { weekday: "short", day: "numeric", month: "short" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Avviso prima di salvare con giornate senza turno o giustificativo.
 * Restituisce true se l'utente vuole salvare comunque, false se torna a compilare.
 */
export function confirmMissingDays(dates: string[]): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const count = dates.length;
    const single = count === 1;

    const overlay = el("div", { className: "exit-dialog-overlay" });
    const dialog = el("section", { className: "exit-dialog missing-days" });
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "missing-days-title");

    const heading = el("h2", { text: single ? "Una giornata senza turno" : "Giornate senza turno" });
    heading.id = "missing-days-title";

    const list = el("ul", { className: "missing-days-list" });
    for (const date of dates) list.append(el("li", { className: "missing-days-chip", text: formatMissingDay(date) }));

    let finished = false;
    const finish = (answer: boolean) => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(answer);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(false);
    };

    const stay = el("button", {
      className: "exit-dialog-stay",
      text: "Torna a compilare",
      onClick: () => finish(false),
    });
    const save = el("button", {
      className: "missing-days-confirm",
      text: "Salva comunque",
      onClick: () => finish(true),
    });

    dialog.append(
      el("header", { className: "missing-days-header" }, [
        el("span", { className: "missing-days-badge" }, [createIcon("warning")]),
        heading,
      ]),
      el("p", {
        className: "missing-days-intro",
        text: single
          ? "C'è 1 giornata senza turno o giustificativo:"
          : `Ci sono ${count} giornate senza turno o giustificativo:`,
      }),
      list,
      el("p", {
        className: "missing-days-note",
        text: single
          ? "Se Shifter aveva già salvato un evento in questa giornata, verrà rimosso dal calendario."
          : "Se Shifter aveva già salvato un evento in queste giornate, verrà rimosso dal calendario.",
      }),
      el("div", { className: "exit-dialog-actions missing-days-actions" }, [stay, save]),
    );

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });
    overlay.append(dialog);
    document.addEventListener("keydown", onKeyDown);
    document.body.append(overlay);

    // Il focus parte sull'opzione prudente: un Invio distratto non salva con giornate vuote.
    stay.focus();
  });
}
