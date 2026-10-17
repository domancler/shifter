import { el } from "../ui";
import { go } from "../router";
import { showToast } from "../toast";
import { periodForMonth } from "../model/period";
import { formatShortDate } from "../model/schedule";
import { setActiveSchedule, setScheduleSource, setWizardIndex } from "../model/session";
import { describeError, isGoogleConnected } from "../calendar/googleClient";
import { GoogleCalendarProvider } from "../calendar/googleProvider";
import { buildScheduleFromEvents, type RecoveredSchedule } from "../calendar/scheduleFromEvents";
import { connectFromUi } from "./googleConnect";

function field(labelText: string, input: HTMLInputElement): HTMLElement {
  return el("label", { className: "field" }, [el("span", { text: labelText }), input]);
}

export function calendarImportScreen(): HTMLElement {
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

  const status = el("p", { className: "import-status" });
  const result = el("section", { className: "panel calendar-result" });
  result.hidden = true;

  const fetchButton = el("button", {
    className: "primary-button",
    text: "Recupera da Google Calendar",
    onClick: () => void run(),
  });

  function showResult(outcome: RecoveredSchedule): void {
    const { schedule, foundDays, warnings } = outcome;
    const range = `${formatShortDate(schedule.period.start)} – ${formatShortDate(schedule.period.end)}`;

    result.replaceChildren();
    result.hidden = false;

    if (foundDays === 0) {
      result.append(
        el("p", {
          text: `Nessun turno trovato nel periodo ${range}. Per ora l'app riconosce solo gli eventi creati da Shifter, non quelli inseriti a mano nel calendario.`,
        }),
      );
      return;
    }

    result.append(
      el("p", {
        className: "calendar-result-summary",
        text: `Trovati ${foundDays} giorni compilati su ${schedule.days.length} (periodo ${range}).`,
      }),
    );

    if (warnings.length > 0) {
      const list = el("ul", { className: "calendar-warnings" });
      for (const warning of warnings) list.append(el("li", { text: warning }));
      result.append(
        el("p", { className: "calendar-warnings-title", text: `Da controllare (${warnings.length}):` }),
        list,
      );
    }

    result.append(
      el("button", {
        className: "primary-button",
        text: "Apri nella revisione",
        onClick: () => {
          setActiveSchedule(schedule);
          setWizardIndex(0);
          setScheduleSource("calendar");
          go("review");
        },
      }),
    );
  }

  async function run(): Promise<void> {
    status.textContent = "";
    result.hidden = true;

    if (!month.value || !start.value || !end.value) {
      status.textContent = "Seleziona il mese e le date.";
      return;
    }

    if (start.value > end.value) {
      status.textContent = "La data iniziale deve precedere quella finale.";
      return;
    }

    fetchButton.disabled = true;

    try {
      // Se manca il collegamento (o è scaduto) si riparte da un tocco dell'utente, altrimenti il browser blocca il popup.
      if (!isGoogleConnected()) {
        const connected = await connectFromUi(fetchButton, status);
        if (!connected) return;
        fetchButton.disabled = true;
      }

      status.textContent = "Lettura del calendario in corso…";

      const events = await new GoogleCalendarProvider().listMarkedEvents(start.value, end.value);
      const outcome = buildScheduleFromEvents(
        { label: month.value, start: start.value, end: end.value },
        events,
      );

      status.textContent = "";
      showResult(outcome);
    } catch (error) {
      console.error("Errore durante il recupero da Google Calendar:", error);
      const message = describeError(error);
      status.textContent = message;
      showToast(message, "error");
    } finally {
      fetchButton.disabled = false;
    }
  }

  return el("main", { className: "screen" }, [
    el("button", { className: "back", text: "← Menu", onClick: () => go("menu") }),
    el("h1", { text: "Recupera da Google Calendar" }),
    el("section", { className: "panel" }, [
      el("p", {
        text: "Scegli il mese di riferimento. Shifter legge dal tuo calendario i turni che ha creato e li apre nella revisione. Non modifica nulla su Google.",
      }),
      field("Mese di riferimento", month),
      field("Inizio programmato", start),
      field("Fine programmato", end),
      fetchButton,
      status,
    ]),
    result,
  ]);
}
