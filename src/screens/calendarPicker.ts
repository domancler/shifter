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
import { GoogleApiError, describeError, disconnectGoogle, getConnectedCalendar } from "../calendar/googleClient";

const NEW_CHOICE = "__new__";
const DEFAULT_NEW_NAME = "Turni";

let pickerOpen = false;

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

/**
 * Finestra "Dove salvo i tuoi turni?": Nuovo calendario, poi quelli su cui puoi scrivere.
 * Chiusa senza scegliere, se non c'era già una scelta si usa il calendario principale.
 */
export function openCalendarPicker(options: { notice?: string; onChosen?: () => void } = {}): void {
  if (pickerOpen) return;
  pickerOpen = true;

  const overlay = el("div", { className: "exit-dialog-overlay" });
  const dialog = el("section", { className: "exit-dialog calendar-picker" });
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const body = el("div", { className: "calendar-picker-body" });
  const actions = el("div", { className: "exit-dialog-actions" });
  dialog.append(
    el("div", { className: "exit-dialog-heading" }, [el("h2", { text: "Dove salvo i tuoi turni?" })]),
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

    body.replaceChildren(el("p", { className: "exit-dialog-message", text: message }));
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

    const status = el("p", { className: "calendar-picker-status" });
    const nameInput = el("input", { className: "calendar-picker-name" });
    nameInput.type = "text";
    nameInput.maxLength = 100;
    nameInput.value = DEFAULT_NEW_NAME;
    nameInput.setAttribute("aria-label", "Nome del nuovo calendario");

    const nameRow = el("div", { className: "calendar-picker-newname" }, [nameInput]);

    const refresh = () => {
      nameRow.hidden = choice !== NEW_CHOICE;
      for (const row of list.querySelectorAll<HTMLInputElement>("input[type=radio]")) {
        row.checked = row.value === choice;
      }
    };

    const addRow = (value: string, content: HTMLElement[]) => {
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "calendar-choice";
      radio.value = value;
      radio.addEventListener("change", () => {
        choice = value;
        refresh();
        if (value === NEW_CHOICE) nameInput.select();
      });
      list.append(el("label", { className: "calendar-picker-row" }, [radio, ...content]));
    };

    const list = el("div", { className: "calendar-picker-list" });

    addRow(NEW_CHOICE, [
      el("span", { className: "calendar-picker-plus" }, [createIcon("add")]),
      el("span", { className: "calendar-picker-name-text", text: "Nuovo calendario" }),
    ]);
    list.append(nameRow);

    for (const entry of entries) {
      const dot = el("span", { className: "calendar-picker-dot" });
      dot.style.backgroundColor = entry.color ?? "#9aa0a6";
      addRow(entry.id, [
        dot,
        el("span", { className: "calendar-picker-name-text", text: entry.name }),
        ...(entry.primary ? [el("span", { className: "calendar-picker-tag", text: "principale" })] : []),
      ]);
    }

    body.replaceChildren(
      ...(options.notice ? [el("p", { className: "exit-dialog-message", text: options.notice })] : []),
      list,
      status,
    );
    refresh();

    const confirmButton = dialogButton("Conferma", "calendar-picker-confirm", () => void confirm());

    const confirm = async () => {
      status.textContent = "";
      confirmButton.disabled = true;

      try {
        let chosen: SelectedCalendar;

        if (choice === NEW_CHOICE) {
          const parsed = normalizeCalendarName(nameInput.value);
          if ("error" in parsed) {
            status.textContent = parsed.error;
            return;
          }
          status.textContent = "Creo il calendario…";
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
        status.textContent =
          error instanceof GoogleApiError && error.status === 403
            ? "Per creare un calendario serve un permesso in più: esci, ripeti l'accesso e lascia selezionate tutte le voci."
            : describeError(error);
      } finally {
        confirmButton.disabled = false;
      }
    };

    actions.replaceChildren(cancelButton, confirmButton);
  };

  const load = async () => {
    body.replaceChildren(el("p", { className: "exit-dialog-message", text: "Carico i tuoi calendari…" }));
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
 * Da chiamare quando si apre il menu da collegati: la prima volta chiede dove salvare;
 * dopo controlla (una volta per sessione) che il calendario scelto esista ancora.
 */
export async function maybePromptForCalendar(): Promise<void> {
  if (!getConnectedCalendar()) return;

  const selected = getSelectedCalendar();
  if (!selected) {
    openCalendarPicker({ onChosen: () => go("menu") });
    return;
  }

  if (verified) return;

  try {
    const entries = await listWritableCalendars();
    verified = true;

    const found = entries.find((entry) => matches(selected, entry));
    if (!found) {
      clearSelectedCalendar();
      openCalendarPicker({
        notice: `Il calendario «${selected.name}» non è più disponibile. Scegli dove salvare i turni.`,
        onChosen: () => go("menu"),
      });
    } else if (found.name !== selected.name) {
      setSelectedCalendar({ id: selected.id, name: found.name }); // rinominato su Google
    }
  } catch {
    // offline o permessi vecchi: si riprova alla prossima apertura
  }
}
