import { createSchedule, entryForLeave, entryForShift, formatShortDate } from "../model/schedule";
import type { Day, Schedule } from "../model/types";
import { isLeaveCode, isShiftCode, MARKER_SCHEMA, parseMarkers } from "./markers";
import type { RemoteEvent } from "./provider";

export interface RecoveredSchedule {
  schedule: Schedule;
  /** Giorni del periodo per cui è stato trovato un evento dell'app. */
  foundDays: number;
  /** Segnalazioni da mostrare all'utente (non bloccanti). */
  warnings: string[];
}

function sameInstant(a: string, b: string): boolean {
  const first = Date.parse(a);
  const second = Date.parse(b);
  return Number.isFinite(first) && Number.isFinite(second) && first === second;
}

/**
 * Ricostruisce il programmato di un periodo dagli eventi dell'app.
 * Ogni evento va nel giorno indicato da turniDay; gli eventi senza marcatore o fuori periodo sono ignorati.
 */
export function buildScheduleFromEvents(
  period: { label: string; start: string; end: string },
  events: RemoteEvent[],
): RecoveredSchedule {
  const schedule = createSchedule(period.label, period.start, period.end);
  const daysByDate = new Map<string, Day>(schedule.days.map((day) => [day.date, day]));
  const updatedByDate = new Map<string, string>();
  const warnings: string[] = [];

  for (const event of events) {
    const markers = parseMarkers(event.markers);
    if (!markers) continue; // non è un evento dell'app

    const day = daysByDate.get(markers.day);
    if (!day) continue; // fuori dal periodo (es. evento del giorno prima/dopo letto per margine)

    const label = formatShortDate(day.date);

    if (markers.schema !== MARKER_SCHEMA) {
      warnings.push(`${label}: evento creato con una versione dell'app non supportata, ignorato.`);
      continue;
    }

    let entry: Day["entry"];
    if (markers.kind === "shift" && isShiftCode(markers.code)) {
      entry = entryForShift(day.date, markers.code);
    } else if (markers.kind === "leave" && isLeaveCode(markers.code)) {
      entry = entryForLeave(markers.code);
    } else {
      warnings.push(`${label}: codice "${markers.code}" non riconosciuto, evento ignorato.`);
      continue;
    }

    // Due eventi dell'app sullo stesso giorno non dovrebbero esistere: teniamo il più recente.
    if (day.entry) {
      const previousUpdated = updatedByDate.get(day.date) ?? "";
      warnings.push(`${label}: trovati più eventi per lo stesso giorno, usato il più recente.`);
      if ((event.updated ?? "") < previousUpdated) continue;
    }

    // Se l'orario è stato cambiato a mano su Google, il prossimo salvataggio lo riporterebbe allo standard.
    if (entry?.type === "shift" && (event.allDay || !sameInstant(event.start, entry.start) || !sameInstant(event.end, entry.end))) {
      warnings.push(`${label}: l'orario su Google è diverso dal turno ${entry.code}; salvando tornerà a quello standard.`);
    }

    day.entry = entry;
    day.note = event.description;
    delete day.isEssential;
    if (markers.essential) day.isEssential = true;
    day.calendarRef = { provider: "google", eventId: event.id, etag: event.etag, updated: event.updated };
    updatedByDate.set(day.date, event.updated ?? "");
  }

  return {
    schedule,
    foundDays: schedule.days.filter((day) => day.entry !== null).length,
    warnings,
  };
}
