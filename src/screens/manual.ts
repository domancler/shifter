
import { wizardProgressPercent } from "../model/progress";
import { el } from "../ui";
import { go } from "../router";
import { periodForMonth } from "../model/period";
import {
  createSchedule,
  entryForLeave,
  entryForShift,
  formatDate,
} from "../model/schedule";
import {
  LEAVE_CODES,
  SHIFT_CODES,
  type LeaveCode,
  type ShiftCode,
} from "../model/types";
import {
  getActiveSchedule,
  setActiveSchedule,
  getWizardIndex,
  setWizardIndex,
} from "../model/session";
import { setButtonIconLabel } from "../icons";

function button(
  text: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  return el("button", { text, className, onClick });
}

function backButton(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const result = button(label, className, onClick);
  setButtonIconLabel(result, "arrowLeft", label);
  return result;
}

function field(labelText: string, input: HTMLInputElement): HTMLElement {
  return el("label", { className: "field" }, [
    el("span", { text: labelText }),
    input,
  ]);
}

export function manualScreen(): HTMLElement {
  const now = new Date();

  const month = el("input");
  month.type = "month";
  month.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const start = el("input");
  start.type = "date";

  const end = el("input");
  end.type = "date";

  const updateRange = () => {
    if (!month.value) return;

    const [year, m] = month.value.split("-").map(Number);
    const period = periodForMonth(year, m);

    start.value = period.start;
    end.value = period.end;
  };

  updateRange();
  month.addEventListener("change", updateRange);

  const error = el("p", { className: "error" });

  const content = el("section", { className: "panel" }, [
    el("p", {
      text: "Scegli il mese di riferimento. Shifter propone il periodo da lunedì a domenica; puoi correggere le date se necessario.",
    }),

    field("Mese di riferimento", month),
    field("Inizio programmato", start),
    field("Fine programmato", end),
    error,

    button("Inizia il programmato", "primary-button", () => {
      error.textContent = "";

      if (!month.value || !start.value || !end.value) {
        error.textContent = "Seleziona il mese e le date.";
        return;
      }

      if (start.value > end.value) {
        error.textContent = "La data iniziale deve precedere quella finale.";
        return;
      }

      setActiveSchedule(
        createSchedule(month.value, start.value, end.value),
      );
      setWizardIndex(0);
      go("wizard");
    }),
  ]);

  return el("main", { className: "screen" }, [
    backButton("Menu", "back", () => go("menu")),
    el("h1", { text: "Crea programmato a mano" }),
    content,
  ]);
}

export function resumeWizardScreen(): HTMLElement {
  const schedule = getActiveSchedule();

  if (!schedule) return manualScreen();

  const host = el("main", { className: "screen" });

  renderWizardDay(getWizardIndex(), host);

  return host;
}

function renderWizardDay(index: number, host: HTMLElement): void {
  const schedule = getActiveSchedule();

  if (!schedule) {
    go("manual");
    return;
  }

  if (index >= schedule.days.length) {
    setWizardIndex(schedule.days.length - 1);
    go("review");
    return;
  }

  setWizardIndex(index);

  const day = schedule.days[index];
  // Giorni già superati sul totale: alla prima giornata 0%, all'ultima non ancora 100%.
  const progress = wizardProgressPercent(index, schedule.days.length);


  let selectionInProgress = false;

  const choose = (
    entry: ReturnType<typeof entryForShift>,
    clickedButton: HTMLButtonElement,
  ) => {
    if (selectionInProgress) return;

    selectionInProgress = true;

    const current = getActiveSchedule();

    if (!current) return;

    current.days[index].entry = entry;
    setActiveSchedule(current);

    clickedButton.classList.add("choice-selected");

    // Breve conferma visiva prima di passare al giorno successivo.
    window.setTimeout(() => {
      renderWizardDay(index + 1, host);
    }, 180);
  };

  const shiftButton = (code: ShiftCode) => {
    const btn = button(code, "choice-button", () => {
      choose(entryForShift(day.date, code), btn);
    });

    return btn;
  };

  const leaveButton = (code: LeaveCode) => {
    const btn = button(code, "choice-button leave-choice", () => {
      choose(entryForLeave(code), btn);
    });

    return btn;
  };


  const dateHeading = el("h1", {
    className: "wizard-date",
    text: formatDate(day.date, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).replace(".", ""),
  });


  const panel = el("section", { className: "panel wizard" }, [
    el("div", { className: "wizard-top" }, [
      el("div", { className: "wizard-progress" }, [
        el("div", { className: "wizard-progress-labels" }, [
          el("strong", {
            text: `${progress}% del programmato`,
          }),
          el("span", {
            className: "wizard-day-count",
            text: `${index + 1} / ${schedule.days.length} giorni`,
          }),
        ]),

        el("div", { className: "progress-track" }, [
          el("div", { className: "progress-fill" }),
        ]),
      ]),

    ]),

    el("h3", { text: "Giustificativi" }),
    el(
      "div",
      { className: "choice-grid choice-grid-leave" },
      LEAVE_CODES.map(leaveButton),
    ),

    el("h3", { text: "Turni giorno" }),
    el(
      "div",
      { className: "choice-grid" },
      SHIFT_CODES.slice(0, 6).map(shiftButton),
    ),

    el("h3", { text: "Turni notte" }),
    el(
      "div",
      { className: "choice-grid choice-grid-night" },
      SHIFT_CODES.slice(6).map(shiftButton),
    ),

    el("div", { className: "wizard-actions" }, [
      backButton("Indietro", "secondary-button", () =>
        index === 0
          ? go("manual")
          : renderWizardDay(index - 1, host),
      ),

      button("Revisione", "secondary-button", () =>
        go("review"),
      ),
    ]),
  ]);

  const fill = panel.querySelector<HTMLElement>(".progress-fill");

  if (fill) {
    fill.style.width = `${progress}%`;
  }

  // const dateHeading = panel.querySelector<HTMLElement>(
  //   ".wizard-top h2",
  // );

  // if (dateHeading) {
  //   dateHeading.classList.add("day-changed");
  // }

  host.replaceChildren(
    backButton("Menu", "back", () => go("menu")),
    dateHeading,
    panel,
  );
}
