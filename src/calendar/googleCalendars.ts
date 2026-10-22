import { googleFetch } from "./googleClient";

/** Elenco dei calendari su cui l'utente può scrivere, e creazione di un nuovo calendario. */

export interface CalendarEntry {
  id: string;
  name: string;
  primary: boolean;
  color?: string;
}

interface CalendarListItem {
  id: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
  deleted?: boolean;
}

interface CalendarListPage {
  items?: CalendarListItem[];
  nextPageToken?: string;
}

const LIST_FIELDS = "nextPageToken,items(id,summary,summaryOverride,primary,backgroundColor,accessRole,deleted)";

/** Il principale per primo, poi gli altri in ordine alfabetico. */
export function sortCalendars(entries: CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.name.localeCompare(b.name, "it", { sensitivity: "base" });
  });
}

/** Solo calendari su cui si può scrivere: compleanni, festività e calendari condivisi in sola lettura restano fuori. */
export async function listWritableCalendars(): Promise<CalendarEntry[]> {
  const entries: CalendarEntry[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ minAccessRole: "writer", maxResults: "250", fields: LIST_FIELDS });
    if (pageToken) params.set("pageToken", pageToken);

    const page = await googleFetch<CalendarListPage>(`/users/me/calendarList?${params}`);

    for (const item of page.items ?? []) {
      if (item.deleted) continue;
      if (item.accessRole !== "owner" && item.accessRole !== "writer") continue;

      entries.push({
        id: item.id,
        name: item.summaryOverride || item.summary || item.id,
        primary: item.primary === true,
        color: item.backgroundColor,
      });
    }

    pageToken = page.nextPageToken;
  } while (pageToken);

  return sortCalendars(entries);
}

export const MAX_CALENDAR_NAME = 100;

export function normalizeCalendarName(raw: string): { name: string } | { error: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name === "") return { error: "Scrivi un nome per il nuovo calendario." };
  if (name.length > MAX_CALENDAR_NAME) return { error: `Il nome può avere al massimo ${MAX_CALENDAR_NAME} caratteri.` };
  return { name };
}

export async function createCalendar(name: string, timeZone?: string): Promise<CalendarEntry> {
  const created = await googleFetch<{ id: string; summary?: string }>("/calendars?fields=id,summary", {
    method: "POST",
    body: JSON.stringify({ summary: name, ...(timeZone ? { timeZone } : {}) }),
  });

  return { id: created.id, name: created.summary ?? name, primary: false };
}
