/**
 * Il calendario su cui Shifter legge e scrive i turni. Se l'utente non ha scelto, si usa quello principale.
 * La scelta si ricorda sul dispositivo (localStorage) e non contiene dati sensibili: solo ID e nome.
 */

export const PRIMARY_CALENDAR_ID = "primary";

const STORAGE_KEY = "shifter-calendar";

export interface SelectedCalendar {
  id: string;
  name: string;
}

function readStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function getSelectedCalendar(): SelectedCalendar | null {
  try {
    const raw = readStorage()?.getItem(STORAGE_KEY);
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<SelectedCalendar>;
    return typeof value.id === "string" && value.id !== "" && typeof value.name === "string"
      ? { id: value.id, name: value.name }
      : null;
  } catch {
    return null;
  }
}

export function setSelectedCalendar(calendar: SelectedCalendar): void {
  try {
    readStorage()?.setItem(STORAGE_KEY, JSON.stringify(calendar));
  } catch {
    // senza storage la scelta vale solo fino alla chiusura: si userà il principale
  }
}

export function clearSelectedCalendar(): void {
  try {
    readStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // niente da fare
  }
}

export function getSelectedCalendarId(): string {
  return getSelectedCalendar()?.id ?? PRIMARY_CALENDAR_ID;
}

/** Percorso degli eventi del calendario scelto, ad esempio "/calendars/primary/events". */
export function calendarEventsPath(): string {
  return `/calendars/${encodeURIComponent(getSelectedCalendarId())}/events`;
}
