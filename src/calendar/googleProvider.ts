import { addDays } from "../model/dates";
import { calendarEventsPath } from "./calendarSelection";
import { googleFetch } from "./googleClient";
import { MARKER_APP, MARKER_KEYS } from "./markers";
import type { CalendarProvider, EventLookup, RemoteEvent } from "./provider";

interface GoogleEventTime {
  date?: string;
  dateTime?: string;
}

interface GoogleEvent {
  id: string;
  etag?: string;
  updated?: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  extendedProperties?: { private?: Record<string, string> };
}

interface EventsPage {
  items?: GoogleEvent[];
  nextPageToken?: string;
}

const EVENT_FIELDS =
  "nextPageToken,items(id,etag,updated,status,summary,description,start,end,extendedProperties/private)";

function toRemoteEvent(event: GoogleEvent): RemoteEvent | null {
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;

  return {
    id: event.id,
    etag: event.etag,
    updated: event.updated,
    summary: event.summary ?? "",
    description: event.description ?? "",
    allDay: event.start?.dateTime === undefined,
    start,
    end,
    markers: event.extendedProperties?.private ?? {},
  };
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google" as const;

  async listMarkedEvents(fromDate: string, toDate: string): Promise<RemoteEvent[]> {
    // Finestra volutamente un po' più larga (in UTC): un 23-07 della prima colonna parte il giorno prima
    // e un 18-00 dell'ultima finisce il giorno dopo. L'assegnazione al giorno usa poi turniDay.
    const timeMin = `${addDays(fromDate, -2)}T00:00:00Z`;
    const timeMax = `${addDays(toDate, 3)}T00:00:00Z`;

    const events: RemoteEvent[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        singleEvents: "true",
        showDeleted: "false",
        maxResults: "2500",
        timeMin,
        timeMax,
        privateExtendedProperty: `${MARKER_KEYS.app}=${MARKER_APP}`,
        fields: EVENT_FIELDS,
      });
      if (pageToken) params.set("pageToken", pageToken);

      const page = await googleFetch<EventsPage>(`${calendarEventsPath()}?${params}`);

      for (const item of page.items ?? []) {
        if (item.status === "cancelled") continue;
        const event = toRemoteEvent(item);
        if (event) events.push(event);
      }

      pageToken = page.nextPageToken;
    } while (pageToken);

    return events;
  }

  async lookupEventById(eventId: string): Promise<EventLookup> {
    try {
      const event = await googleFetch<GoogleEvent>(
        `${calendarEventsPath()}/${encodeURIComponent(eventId)}`,
      );

      if (event.status === "cancelled") return { state: "cancelled" };

      const remote = toRemoteEvent(event);
      return remote ? { state: "found", event: remote } : { state: "missing" };
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        error.status === 404
      ) {
        return { state: "missing" };
      }

      throw error;
    }
  }

  async getEventById(eventId: string): Promise<RemoteEvent | null> {
    const lookup = await this.lookupEventById(eventId);
    return lookup.state === "found" ? lookup.event : null;
  }
}
