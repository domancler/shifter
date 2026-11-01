import { el } from "../ui";
import { createIcon } from "../icons";
import { formatDate, formatShortDate } from "../model/schedule";
import {
  clickDay,
  daysInRange,
  focusOn,
  isComplete,
  monthGrid,
  presetPeriods,
  referenceMonth,
  samePeriod,
  shiftMonth,
  type RangeFocus,
  type RangeSelection,
} from "../model/dateRange";
import { periodForMonth, type Period } from "../model/period";

export interface ChosenPeriod {
  label: string; // mese di riferimento, es. "2026-11"
  start: string;
  end: string;
}

export interface PeriodPicker {
  element: HTMLElement;
  /** Il periodo scelto, o null se manca ancora l'inizio o la fine. */
  getPeriod(): ChosenPeriod | null;
}

const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const monthName = (year: number, month: number, withYear = false): string =>
  capitalize(
    formatDate(`${year}-${String(month).padStart(2, "0")}-01`, {
      weekday: undefined, // formatDate li aggiunge di suo: qui serve solo il nome del mese
      day: undefined,
      month: "long",
      ...(withYear ? { year: "numeric" } : {}),
    }),
  );

const shortMonthName = (year: number, month: number): string =>
  capitalize(
    formatDate(`${year}-${String(month).padStart(2, "0")}-01`, {
      weekday: undefined,
      day: undefined,
      month: "short",
    }),
  );

/** Testo dei tasti rapidi: nome intero nell'anno corrente, "Gen 2027" negli altri (resta su una riga sola). */
const chipLabel = (year: number, month: number, currentYear: number): string =>
  year === currentYear ? monthName(year, month) : `${shortMonthName(year, month)} ${year}`;

/**
 * Selettore di periodo: si tocca il giorno di inizio e poi quello di fine direttamente sul calendario.
 * Sopra ci sono le scorciatoie (mese precedente, corrente, successivo) e due riquadri "Inizio" e "Fine":
 * toccandone uno si sceglie quale dei due estremi cambiare col prossimo tocco.
 */
export function createPeriodPicker(options: { initial?: Period; onChange?: () => void } = {}): PeriodPicker {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const presets = presetPeriods(today);
  const initial = options.initial ?? presets[1];

  let selection: RangeSelection = { start: initial.start, end: initial.end, focus: "end" };
  let view = (() => {
    const { year, month } = referenceMonth(initial.start, initial.end);
    return { year, month };
  })();
  let focusDate: string | null = null;
  let chooserOpen = false;
  let chooserYear = view.year;

  const element = el("div", { className: "period-picker" });

  const change = () => {
    render();
    options.onChange?.();
  };

  const setFocus = (focus: RangeFocus) => {
    selection = focusOn(selection, focus);
    change();
  };

  const choosePeriod = (period: Period) => {
    selection = { start: period.start, end: period.end, focus: "end" };
    const { year, month } = referenceMonth(period.start, period.end);
    view = { year, month };
    chooserOpen = false;
    change();
  };

  /** Il mese di riferimento della selezione, se questa è proprio il periodo di quel mese (da lunedì a domenica). */
  const selectedMonthPeriod = (): { year: number; month: number; period: Period } | null => {
    if (selection.start === null || selection.end === null) return null;

    const { year, month } = referenceMonth(selection.start, selection.end);
    const period = periodForMonth(year, month);
    return samePeriod(selection, period) ? { year, month, period } : null;
  };

  const toggleChooser = () => {
    chooserOpen = !chooserOpen;
    if (chooserOpen) chooserYear = (selectedMonthPeriod() ?? view).year;
    render();
  };

  const pick = (day: string) => {
    selection = clickDay(selection, day);
    focusDate = day;
    change();
  };

  function renderPresets(): HTMLElement {
    const row = el("div", { className: "period-presets" });
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Periodi rapidi");

    for (const period of presets) {
      const [year, month] = period.label.split("-").map(Number);
      const chip = el("button", {
        className: `period-preset${samePeriod(selection, period) ? " is-active" : ""}`,
        text: chipLabel(year, month, today.getFullYear()),
        onClick: () => choosePeriod(period),
      });
      chip.type = "button";
      chip.setAttribute("aria-label", monthName(year, month, true));
      chip.title = `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
      chip.setAttribute("aria-pressed", String(samePeriod(selection, period)));
      row.append(chip);
    }

    // «Altro mese»: apre la scelta di un mese qualsiasi. Se il periodo scelto è quello di un mese
    // che non è tra le tre scorciatoie, il tasto prende il nome di quel mese.
    const chosen = selectedMonthPeriod();
    const isOther = chosen !== null && !presets.some((period) => samePeriod(selection, period));
    const other = el("button", {
      className: `period-preset is-other${isOther ? " is-active" : ""}`,
      text: isOther && chosen ? chipLabel(chosen.year, chosen.month, today.getFullYear()) : "Altro mese",
      onClick: toggleChooser,
    });
    other.type = "button";
    if (isOther && chosen) other.setAttribute("aria-label", monthName(chosen.year, chosen.month, true));
    other.setAttribute("aria-expanded", String(chooserOpen));
    other.setAttribute("aria-haspopup", "true");
    row.append(other);

    return row;
  }

  function renderMonthChooser(): HTMLElement {
    const yearButton = (label: string, shift: number, iconName: "chevronLeft" | "chevronRight") => {
      const button = el("button", {
        className: "period-nav-button",
        onClick: () => {
          chooserYear += shift;
          render();
        },
      }, [createIcon(iconName)]);
      button.type = "button";
      button.setAttribute("aria-label", label);
      return button;
    };

    const year = el("strong", { className: "period-months-year", text: String(chooserYear) });
    year.setAttribute("aria-live", "polite");

    const grid = el("div", { className: "period-months-grid" });

    for (let month = 1; month <= 12; month++) {
      const period = periodForMonth(chooserYear, month);
      const isActive = samePeriod(selection, period);
      const isCurrent = chooserYear === today.getFullYear() && month === today.getMonth() + 1;

      const button = el("button", {
        className: `period-month${isActive ? " is-active" : ""}${isCurrent ? " is-current" : ""}`,
        text: shortMonthName(chooserYear, month),
        onClick: () => choosePeriod(period),
      });
      button.type = "button";
      button.dataset.month = `${chooserYear}-${String(month).padStart(2, "0")}`;
      button.title = `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
      button.setAttribute("aria-label", monthName(chooserYear, month, true));
      button.setAttribute("aria-pressed", String(isActive));
      grid.append(button);
    }

    return el("div", { className: "period-months" }, [
      el("div", { className: "period-months-header" }, [
        yearButton("Anno precedente", -1, "chevronLeft"),
        year,
        yearButton("Anno successivo", 1, "chevronRight"),
      ]),
      grid,
    ]);
  }

  function pill(focus: RangeFocus, caption: string, value: string | null): HTMLElement {
    const isActive = selection.focus === focus;
    const button = el("button", {
      className: `period-pill${isActive ? " is-active" : ""}${value === null ? " is-empty" : ""}`,
      onClick: () => setFocus(focus),
    }, [
      el("small", { text: caption }),
      el("strong", {
        text: value ? formatDate(value, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Da scegliere",
      }),
    ]);
    button.type = "button";
    button.setAttribute("aria-pressed", String(isActive));
    return button;
  }

  function renderInfo(): HTMLElement {
    let text: string;

    if (selection.start === null) {
      text = "Tocca sul calendario il giorno di inizio.";
    } else if (selection.end === null) {
      text = "Ora tocca il giorno di fine.";
    } else {
      const days = daysInRange(selection.start, selection.end);
      const reference = referenceMonth(selection.start, selection.end);
      text = `${days} ${days === 1 ? "giorno" : "giorni"} · Mese di riferimento: ${monthName(reference.year, reference.month, true).toLowerCase()}`;
    }

    const info = el("p", { className: "period-info", text });
    info.setAttribute("role", "status");
    return info;
  }

  function renderCalendar(): HTMLElement {
    const { start, end } = selection;

    const navButton = (label: string, shift: number, iconName: "chevronLeft" | "chevronRight") => {
      const button = el("button", {
        className: "period-nav-button",
        onClick: () => {
          view = shiftMonth(view.year, view.month, shift);
          render();
        },
      }, [createIcon(iconName)]);
      button.type = "button";
      button.setAttribute("aria-label", label);
      return button;
    };

    const nav = el("div", { className: "period-nav" }, [
      navButton("Mese precedente", -1, "chevronLeft"),
      el("strong", { className: "period-nav-title", text: monthName(view.year, view.month, true) }),
      navButton("Mese successivo", 1, "chevronRight"),
    ]);

    const weekdays = el("div", { className: "period-weekdays" });
    for (const letter of WEEKDAYS) weekdays.append(el("span", { text: letter }));

    const grid = el("div", { className: "period-grid" });

    for (const day of monthGrid(view.year, view.month)) {
      const classes = ["period-cell"];
      if (Number(day.slice(5, 7)) !== view.month) classes.push("is-outside");
      if (day === todayIso) classes.push("is-today");
      if (start !== null && end !== null && day > start && day < end) classes.push("in-range");
      if (day === start) classes.push("range-start");
      if (day === end) classes.push("range-end");
      // La fascia che unisce inizio e fine si disegna solo a periodo completo e di più di un giorno.
      if (start !== null && end !== null && start < end) {
        if (day === start) classes.push("band-right");
        if (day === end) classes.push("band-left");
      }

      const isEdge = day === start || day === end;
      const button = el("button", {
        className: "period-day",
        text: String(Number(day.slice(8, 10))),
        onClick: () => pick(day),
      });
      button.type = "button";
      button.dataset.date = day;
      button.setAttribute("aria-label", formatDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      button.setAttribute("aria-pressed", String(isEdge));

      grid.append(el("div", { className: classes.join(" ") }, [button]));
    }

    return el("div", { className: "period-calendar" }, [nav, weekdays, grid]);
  }

  function render() {
    element.replaceChildren(
      renderPresets(),
      ...(chooserOpen ? [renderMonthChooser()] : []),
      el("div", { className: "period-summary" }, [
        pill("start", "Inizio", selection.start),
        pill("end", "Fine", selection.end),
      ]),
      renderInfo(),
      renderCalendar(),
    );

    // Il ridisegno sostituisce i pulsanti: si rimette il focus sul giorno appena toccato (per chi usa la tastiera).
    if (focusDate) {
      element.querySelector<HTMLButtonElement>(`.period-day[data-date="${focusDate}"]`)?.focus();
      focusDate = null;
    }
  }

  render();

  return {
    element,
    getPeriod() {
      if (!isComplete(selection) || selection.start === null || selection.end === null) return null;
      return {
        label: referenceMonth(selection.start, selection.end).label,
        start: selection.start,
        end: selection.end,
      };
    },
  };
}
