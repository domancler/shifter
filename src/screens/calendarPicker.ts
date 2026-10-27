import { el } from "../ui";
import { go } from "../router";
import { showToast } from "../toast";
import { createIcon } from "../icons";
import {
  PRIMARY_CALENDAR_ID,
  clearSelectedCalendar,
  getSelectedCalendar,
  setSelectedCalendar,
  type SelectedCalendar,
} from "../calendar/calendarSelection";
import {
  createCalendar,
  listWritableCalendars,
  normalizeCalendarName,
  type CalendarEntry,
} from "../calendar/googleCalendars";
import {
  GoogleApiError,
  describeError,
  disconnectGoogle,
  getConnectedCalendar,
} from "../calendar/googleClient";

const NEW_CHOICE = "__new__";
const DEFAULT_NEW_NAME = "Turni";

let pickerOpen = false;
let idCounter = 0;

/** Il calendario principale si ricorda come "primary", così resta valido anche se cambia l'indirizzo. */
function toSelection(entry: CalendarEntry): SelectedCalendar {
  return { id: entry.primary ? PRIMARY_CALENDAR_ID : entry.id, name: entry.name };
}

function matches(selected: SelectedCalendar, entry: CalendarEntry): boolean {
  return selected.id === entry.id || (selected.id === PRIMARY_CALENDAR_ID && entry.primary);
}

function dialogButton(text: string, className: string, onClick: () => void): HTMLButtonElement {
  return el("button", { className, text, onClick });
}

interface ChoiceRow {
  value: string;
  input: HTMLInputElement;
  /** Elemento che riceve lo stato "selezionato" (la riga, o la scheda intera per "Nuovo calendario"). */
  card: HTMLElement;
}

/**
 * Finestra "Dove salvo i tuoi turni?": Nuovo calendario in cima, poi quelli su cui puoi scrivere.
 * Chiusa senza scegliere, se non c'era già una scelta si usa il calendario principale.
 */
export function openCalendarPicker(options: { notice?: string; onChosen?: () => void } = {}): void {
  if (pickerOpen) return;
  pickerOpen = true;

  const titleId = `calendar-picker-title-${++idCounter}`;
  const overlay = el("div", { className: "exit-dialog-overlay" });
  const dialog = el("section", { className: "exit-dialog calendar-picker" });
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);

  const heading = el("h2", { text: "Dove salvo i tuoi turni?" });
  heading.id = titleId;

  const body = el("div", { className: "calendar-picker-body" });
  const actions = el("div", { className: "exit-dialog-actions calendar-picker-actions" });

  dialog.append(
    el("header", { className: "calendar-picker-header" }, [
      el("span", { className: "calendar-picker-badge" }, [createIcon("calendar")]),
      el("div", {}, [
        heading,
        el("p", {
          className: "calendar-picker-subtitle",
          text: "Scegli il calendario di Google che userà Shifter.",
        }),
      ]),
    ]),
    body,
    actions,
  );
  overlay.append(dialog);
  document.body.append(overlay);

  const close = () => {
    overlay.remove();
    pickerOpen = false;
  };

  const cancel = () => {
    if (!getSelectedCalendar()) {
      setSelectedCalendar({ id: PRIMARY_CALENDAR_ID, name: getConnectedCalendar()?.name ?? "Calendario principale" });
    }
    close();
  };

  const cancelButton = dialogButton("Annulla", "exit-dialog-stay", cancel);

  const showFailure = (error: unknown) => {
    const needsLogin = error instanceof GoogleApiError && (error.status === 401 || error.status === 403);
    const message = needsLogin
      ? "Per scegliere il calendario servono permessi in più: esci e ripeti l'accesso lasciando selezionate tutte le voci."
      : describeError(error);

    body.replaceChildren(el("p", { className: "calendar-picker-notice", text: message }));
    actions.replaceChildren(
      cancelButton,
      needsLogin
        ? dialogButton("Esci e riaccedi", "calendar-picker-confirm", () => {
            disconnectGoogle();
            close();
            go("login");
          })
        : dialogButton("Riprova", "calendar-picker-confirm", () => void load()),
    );
  };

  const render = (entries: CalendarEntry[]) => {
    const selected = getSelectedCalendar();
    const preferred = entries.find((entry) => (selected ? matches(selected, entry) : entry.primary)) ?? entries[0];
    let choice = preferred ? preferred.id : NEW_CHOICE;

    const rows: ChoiceRow[] = [];
    const status = el("p", { className: "calendar-picker-status" });
    status.setAttribute("role", "status");

    const setStatus = (text: string, isError = false) => {
      status.textContent = text;
      status.classList.toggle("is-error", isError);
    };

    // ── Nuovo calendario: scheda con il campo del nome che compare quando è scelta ──
    const nameId = `calendar-picker-name-${++idCounter}`;
    const nameInput = el("input", { className: "calendar-picker-field-input" });
    nameInput.id = nameId;
    nameInput.type = "text";
    nameInput.maxLength = 100;
    nameInput.value = DEFAULT_NEW_NAME;
    nameInput.autocomplete = "off";
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void confirm();
      }
    });

    const nameLabel = el("label", { className: "calendar-picker-field-label", text: "Nome del calendario" });
    nameLabel.htmlFor = nameId;

    const newField = el("div", { className: "calendar-picker-field" }, [
      nameLabel,
      nameInput,
      el("p", {
        className: "calendar-picker-hint",
        text: "Lo creo nel tuo account Google, solo per i turni.",
      }),
    ]);

    const makeRow = (
      value: string,
      lead: HTMLElement,
      title: string,
      subtitle: string | null,
      card?: HTMLElement,
    ): HTMLElement => {
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "calendar-choice";
      radio.value = value;
      radio.className = "calendar-picker-radio";
      radio.addEventListener("change", () => {
        choice = value;
        refresh();
        if (value === NEW_CHOICE) {
          nameInput.focus();
          nameInput.select();
        }
      });

      const row = el("label", { className: "calendar-picker-row" }, [
        radio,
        lead,
        el("span", { className: "calendar-picker-text" }, [
          el("span", { className: "calendar-picker-title", text: title }),
          ...(subtitle ? [el("span", { className: "calendar-picker-sub", text: subtitle })] : []),
        ]),
        el("span", { className: "calendar-picker-check" }),
      ]);

      rows.push({ value, input: radio, card: card ?? row });
      return row;
    };

    const newCard = el("div", { className: "calendar-picker-new" });
    newCard.append(
      makeRow(
        NEW_CHOICE,
        el("span", { className: "calendar-picker-plus" }, [createIcon("add")]),
        "Nuovo calendario",
        "Crea un calendario dedicato ai tuoi turni",
        newCard,
      ),
      newField,
    );

    const existing = el("div", { className: "calendar-picker-group" });
    for (const entry of entries) {
      const dot = el("span", { className: "calendar-picker-dot" });
      dot.style.backgroundColor = entry.color ?? "#9aa0a6";
      existing.append(makeRow(entry.id, dot, entry.name, entry.primary ? "Calendario principale" : null));
    }

    const confirmButton = dialogButton("Conferma", "calendar-picker-confirm", () => void confirm());

    function refresh() {
      for (const row of rows) {
        const isChosen = row.value === choice;
        row.input.checked = isChosen;
        row.card.classList.toggle("is-selected", isChosen);
      }
      newField.hidden = choice !== NEW_CHOICE;
      confirmButton.textContent = choice === NEW_CHOICE ? "Crea calendario" : "Conferma";
    }

    async function confirm() {
      setStatus("");
      confirmButton.disabled = true;

      try {
        let chosen: SelectedCalendar;

        if (choice === NEW_CHOICE) {
          const parsed = normalizeCalendarName(nameInput.value);
          if ("error" in parsed) {
            setStatus(parsed.error, true);
            nameInput.focus();
            return;
          }
          setStatus("Creo il calendario…");
          const created = await createCalendar(parsed.name, getConnectedCalendar()?.timeZone || undefined);
          chosen = { id: created.id, name: created.name };
        } else {
          chosen = toSelection(entries.find((entry) => entry.id === choice) ?? entries[0]);
        }

        const previous = getSelectedCalendar();
        setSelectedCalendar(chosen);
        close();

        showToast(
          previous && previous.id !== chosen.id
            ? `Calendario: ${chosen.name}. Gli eventi già salvati in «${previous.name}» restano lì.`
            : `Calendario: ${chosen.name}.`,
          "success",
        );
        options.onChosen?.();
      } catch (error) {
        setStatus(
          error instanceof GoogleApiError && error.status === 403
            ? "Per creare un calendario serve un permesso in più: esci, ripeti l'accesso e lascia selezionate tutte le voci."
            : describeError(error),
          true,
        );
      } finally {
        confirmButton.disabled = false;
      }
    }

    body.replaceChildren(
      ...(options.notice ? [el("p", { className: "calendar-picker-notice", text: options.notice })] : []),
      newCard,
      ...(entries.length > 0 ? [el("p", { className: "calendar-picker-section", text: "I tuoi calendari" })] : []),
      existing,
      status,
    );

    refresh();
    actions.replaceChildren(cancelButton, confirmButton);
  };

  const load = async () => {
    body.replaceChildren(el("p", { className: "calendar-picker-notice", text: "Carico i tuoi calendari…" }));
    actions.replaceChildren(cancelButton);

    try {
      render(await listWritableCalendars());
    } catch (error) {
      console.error("Errore durante la lettura dei calendari:", error);
      showFailure(error);
    }
  };

  void load();
}

let verified = false;

/**
 * Controllo silenzioso, da fare quando si apre il menu da collegati. La finestra di scelta non si apre mai
 * da sola: chi vuole cambiare calendario usa «Cambia». Senza una scelta si usa il calendario principale.
 * Se il calendario scelto non esiste più (eliminato o non più condiviso) si torna al principale e lo si dice
 * con una notifica. Il controllo si fa una volta per sessione.
 */
export async function verifySelectedCalendar(): Promise<void> {
  if (verified || !getConnectedCalendar()) return;

  const selected = getSelectedCalendar();
  if (!selected) return;

  try {
    const entries = await listWritableCalendars();
    verified = true;

    const found = entries.find((entry) => matches(selected, entry));

    if (!found) {
      clearSelectedCalendar();
      showToast(
        `Il calendario «${selected.name}» non è più disponibile: uso quello principale. Puoi sceglierne un altro da «Cambia».`,
        "warning",
        undefined,
        8000,
      );
      go("menu"); // aggiorna la riga "Calendario: …"
    } else if (found.name !== selected.name) {
      setSelectedCalendar({ id: selected.id, name: found.name }); // rinominato su Google
    }
  } catch {
    // offline o permessi vecchi: si riprova alla prossima apertura
  }
}
