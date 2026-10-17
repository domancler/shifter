import { AuthError, clearAccessToken, ensureAccessToken, isSignedIn, signIn } from "./googleAuth";

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
    return "Mancano i permessi sul calendario: ripeti l'accesso e autorizza la modifica degli eventi.";
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

/** Chiamata alle API di Calendar con il token in memoria; su 401 tenta un rinnovo e riprova una volta. */
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

let connected: CalendarInfo | null = null;

/** Legge nome e fuso del calendario principale: serve anche a verificare che il token funzioni. */
export async function getPrimaryCalendarInfo(): Promise<CalendarInfo> {
  const data = await googleFetch<{ summary?: string; timeZone?: string }>(
    "/calendars/primary/events?maxResults=1&fields=summary,timeZone",
  );
  return { name: data.summary ?? "Calendario principale", timeZone: data.timeZone ?? "" };
}

export async function connectGoogle(): Promise<CalendarInfo> {
  await signIn("select_account");

  try {
    connected = await getPrimaryCalendarInfo();
  } catch (error) {
    clearAccessToken();
    connected = null;
    throw error;
  }

  return connected;
}

export function disconnectGoogle(): void {
  clearAccessToken();
  connected = null;
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
