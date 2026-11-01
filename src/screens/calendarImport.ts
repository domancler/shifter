import { el } from "../ui";
import { createPeriodPicker } from "./periodPicker";
import { go } from "../router";
import { showToast } from "../toast";
import { formatShortDate } from "../model/schedule";
import { setActiveSchedule, setScheduleSource, setWizardIndex } from "../model/session";
import { describeError, isGoogleConnected } from "../calendar/googleClient";
import { GoogleCalendarProvider } from "../calendar/googleProvider";
import { buildScheduleFromEvents, type RecoveredSchedule } from "../calendar/scheduleFromEvents";
import { connectFromUi } from "./googleConnect";
import { setButtonIconLabel } from "../icons";

export function calendarImportScreen(): HTMLElement {
  const status = el("p", { className: "import-status" });

  const picker = createPeriodPicker({ onChange: () => { status.textContent = ""; } });

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

    const period = picker.getPeriod();

    if (!period) {
      status.textContent = "Scegli il giorno di inizio e quello di fine.";
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

      const events = await new GoogleCalendarProvider().listMarkedEvents(period.start, period.end);
      const outcome = buildScheduleFromEvents(
        { label: period.label, start: period.start, end: period.end },
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

  const backButton = el("button", { className: "back", onClick: () => go("menu") });
  setButtonIconLabel(backButton, "arrowLeft", "Menu");

  return el("main", { className: "screen" }, [
    backButton,
    el("h1", { text: "Recupera da Google Calendar" }),
    el("section", { className: "panel" }, [
      picker.element,
      fetchButton,
      status,
    ]),
    result,
  ]);
}
