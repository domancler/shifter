import { clearSelectedCalendar } from "./calendarSelection";
import {
  AuthError,
  clearAccessToken,
  completeRedirectSignIn,
  ensureAccessToken,
  isRedirectSignInPreferred,
  isSignedIn,
  signIn,
  startRedirectSignIn,
} from "./googleAuth";

const API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleApiError extends Error {
  status: number;
  reason: string;

  constructor(status: number, reason: string, message: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.reason = reason;
  }
}

function friendlyMessage(status: number, reason: string, fallback: string): string {
  if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED") {
    return "La Google Calendar API non è abilitata nel progetto Google Cloud.";
  }
  if (status === 403 && reason === "insufficientPermissions") {
    return "Mancano dei permessi sul calendario: esci, ripeti l'accesso e lascia selezionate tutte le voci.";
  }
  if (status === 403 && (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded")) {
    return "Troppe richieste a Google: riprova tra qualche secondo.";
  }
  if (status === 404) return "Elemento non trovato su Google Calendar.";
  if (status === 410) return "L'evento non esiste più su Google Calendar.";
  if (status === 412) return "L'evento è cambiato su Google Calendar nel frattempo.";
  return fallback || `Errore di Google Calendar (${status}).`;
}

async function toApiError(response: Response): Promise<GoogleApiError> {
  let reason = "";
  let message = "";

  try {
    const body = (await response.json()) as {
      error?: { message?: string; errors?: { reason?: string }[]; status?: string };
    };
    reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? "";
    message = body.error?.message ?? "";
  } catch {
    // risposta non JSON: usiamo il messaggio generico
  }

  return new GoogleApiError(response.status, reason, friendlyMessage(response.status, reason, message));
}

/** Chiamata alle API di Calendar; su 401 tenta un rinnovo e riprova una volta. */
export async function googleFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = async (token: string): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let response = await send(await ensureAccessToken());

  if (response.status === 401) {
    clearAccessToken();
    response = await send(await ensureAccessToken());
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ── Collegamento ───────────────────────────────────────────────────────────

export interface CalendarInfo {
  name: string;
  timeZone: string;
}

const CONNECTED_CALENDAR_KEY = "shifter-google-calendar";

function readConnectedCalendar(): CalendarInfo | null {
  try {
    const saved = sessionStorage.getItem(CONNECTED_CALENDAR_KEY);
    if (!saved) return null;
    const calendar = JSON.parse(saved) as Partial<CalendarInfo>;
    return typeof calendar.name === "string" && typeof calendar.timeZone === "string"
      ? { name: calendar.name, timeZone: calendar.timeZone }
      : null;
  } catch {
    return null;
  }
}

let connected: CalendarInfo | null = readConnectedCalendar();

function saveConnectedCalendar(calendar: CalendarInfo | null): void {
  connected = calendar;
  try {
    if (calendar) sessionStorage.setItem(CONNECTED_CALENDAR_KEY, JSON.stringify(calendar));
    else sessionStorage.removeItem(CONNECTED_CALENDAR_KEY);
  } catch {
    // Il collegamento resta valido in memoria anche se sessionStorage non è disponibile.
  }
}

/** Legge nome e fuso del calendario principale: serve anche a verificare che il token funzioni. */
export async function getPrimaryCalendarInfo(): Promise<CalendarInfo> {
  const data = await googleFetch<{ summary?: string; timeZone?: string }>(
    "/calendars/primary/events?maxResults=1&fields=summary,timeZone",
  );
  return { name: data.summary ?? "Calendario principale", timeZone: data.timeZone ?? "" };
}

export async function connectGoogle(): Promise<CalendarInfo> {
  if (isRedirectSignInPreferred()) {
    startRedirectSignIn();

    // La pagina sta per essere sostituita da quella di Google: non c'è nulla da restituire.
    // Se l'utente torna indietro senza accedere (pagina ripristinata dalla cache) si annulla l'attesa.
    return new Promise<CalendarInfo>((_resolve, reject) => {
      window.addEventListener(
        "pageshow",
        (event) => {
          if (event.persisted) reject(new AuthError("popup-closed"));
        },
        { once: true },
      );
    });
  }

  await signIn("select_account");

  try {
    const calendar = await getPrimaryCalendarInfo();
    saveConnectedCalendar(calendar);
    return calendar;
  } catch (error) {
    clearAccessToken();
    saveConnectedCalendar(null);
    throw error;
  }
}

export type ResumedSignIn =
  | { status: "none" }
  | { status: "connected"; calendar: CalendarInfo }
  | { status: "error"; message: string };

/** All'avvio: se si torna da Google (accesso con reindirizzamento) completa il collegamento. */
export async function resumeRedirectSignIn(): Promise<ResumedSignIn> {
  const result = completeRedirectSignIn();
  if (result.status === "none") return { status: "none" };
  if (result.status === "error") return { status: "error", message: new AuthError(result.code, result.detail).message };

  try {
    const calendar = await getPrimaryCalendarInfo();
    saveConnectedCalendar(calendar);
    return { status: "connected", calendar };
  } catch (error) {
    clearAccessToken();
    saveConnectedCalendar(null);
    return { status: "error", message: describeError(error) };
  }
}

export function disconnectGoogle(): void {
  clearSelectedCalendar(); // la scelta vale per un account: con un altro account si sceglie di nuovo
  clearAccessToken();
  saveConnectedCalendar(null);
}

export function isGoogleConnected(): boolean {
  return isSignedIn() && connected !== null;
}

export function getConnectedCalendar(): CalendarInfo | null {
  return isGoogleConnected() ? connected : null;
}

export function describeError(error: unknown): string {
  if (error instanceof AuthError || error instanceof GoogleApiError) return error.message;
  return "Qualcosa è andato storto. Riprova.";
}
