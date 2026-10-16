import { el } from "../ui";
import { go } from "../router";
import { getActiveSchedule, setActiveSchedule } from "../model/session";
import { entryForLeave, entryForShift, formatDate, formatShortDate } from "../model/schedule";
import { LEAVE_CODES, SHIFT_CODES, type Entry, type LeaveCode, type ShiftCode } from "../model/types";

function button(text: string, className: string, onClick: () => void): HTMLButtonElement { return el("button", { text, className, onClick }); }
function option(value: string, text: string, selected = false): HTMLOptionElement {
  const node = document.createElement("option"); node.value = value; node.textContent = text; node.selected = selected; return node;
}
function parseEntry(value: string, date: string): Entry {
  if (!value) return null;
  if ((SHIFT_CODES as readonly string[]).includes(value)) return entryForShift(date, value as ShiftCode);
  if ((LEAVE_CODES as readonly string[]).includes(value)) return entryForLeave(value as LeaveCode);
  return null;
}
function entryLabel(entry: Entry): string { return entry ? entry.code : "Giornata vuota"; }

export function reviewScreen(): HTMLElement {
  const schedule = getActiveSchedule();
  if (!schedule) return el("main", { className: "screen" }, [el("h1", { text: "Nessun programmato da revisionare" }), button("← Menu", "back", () => go("menu"))]);
  const list = el("div", { className: "review-list" });
  schedule.days.forEach((day, index) => {
    const select = el("select");
    select.append(option("", "Giornata vuota", !day.entry));
    SHIFT_CODES.forEach((code) => select.append(option(code, `Turno ${code}`, day.entry?.type === "shift" && day.entry.code === code)));
    LEAVE_CODES.forEach((code) => select.append(option(code, code, day.entry?.type === "leave" && day.entry.code === code)));
    const note = el("textarea"); note.rows = 2; note.value = day.note; note.placeholder = "Note (facoltative)";
    const status = el("span", { className: "muted", text: `Attuale: ${entryLabel(day.entry)}` });
    const card = el("article", { className: "review-card" });
    const save = button("Applica modifiche", "secondary-button", () => {
      const latest = getActiveSchedule(); if (!latest) return;
      latest.days[index].entry = parseEntry(select.value, day.date); latest.days[index].note = note.value;
      setActiveSchedule(latest); status.textContent = `Salvato: ${entryLabel(latest.days[index].entry)}`; card.classList.remove("needs-save");
    });
    select.addEventListener("change", () => card.classList.add("needs-save"));
    note.addEventListener("input", () => card.classList.add("needs-save"));
    card.append(
      el("div", { className: "review-card-heading" }, [el("strong", { text: formatDate(day.date, { weekday: "long", day: "2-digit", month: "long" }) }), el("span", { className: "review-date", text: formatShortDate(day.date) })]),
      status,
      el("label", { className: "field" }, [el("span", { text: "Turno o giustificativo" }), select]),
      el("label", { className: "field" }, [el("span", { text: "Note" }), note]), save,
    );
    list.append(card);
  });
  return el("main", { className: "screen review-screen" }, [
    button("← Menu", "back", () => go("menu")), el("h1", { text: "Revisione programmato" }),
    el("p", { text: `Periodo ${schedule.period.label}: ${formatShortDate(schedule.period.start)} – ${formatShortDate(schedule.period.end)} · ${schedule.days.length} giorni.` }),
    el("p", { className: "muted", text: "Modifica turno, giustificativo o note e premi «Applica modifiche». I dati sono temporanei e non sono ancora salvati su Google Calendar." }),
    el("div", { className: "review-toolbar" }, [
      button("← Torna al wizard", "secondary-button", () => go("wizard")),
      button("Completa revisione", "primary-button", () => {
        if (list.querySelector(".needs-save")) { window.alert("Hai modifiche non applicate. Premi prima «Applica modifiche» nelle giornate evidenziate."); return; }
        window.alert("Revisione completata. In questa fase i dati restano solo in memoria: Google Calendar non è stato modificato.");
      }),
    ]), list,
  ]);
}
