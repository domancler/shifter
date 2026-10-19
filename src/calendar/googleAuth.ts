/**
 * Accesso a Google con Google Identity Services (modello "token", senza backend).
 * Il token è conservato nella sessione della scheda per sopravvivere ai refresh,
 * poi viene rimosso alla chiusura della scheda o alla scadenza (circa 1 ora).
 * Non esiste refresh token: alla scadenza serve un nuovo consenso.
 */

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const EXPIRY_MARGIN_MS = 60_000;

// ── Tipi minimi di Google Identity Services ────────────────────────────────

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
  scope?: string;
}

interface GisErrorResponse {
  type: string;
  message?: string;
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GisOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: GisErrorResponse) => void;
  }): GisTokenClient;
  hasGrantedAllScopes(response: GisTokenResponse, ...scopes: string[]): boolean;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GisOAuth2 } };
  }
}

// ── Errori ─────────────────────────────────────────────────────────────────

export type AuthErrorCode =
  | "missing-client-id"
  | "script-load"
  | "popup-blocked"
  | "popup-closed"
  | "access-denied"
  | "scope-denied"
  | "session-expired"
  | "unknown";

const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  "missing-client-id":
    "Manca il Client ID di Google. Controlla VITE_GOOGLE_CLIENT_ID in .env.local e riavvia npm run dev.",
  "script-load":
    "Non riesco a caricare il servizio di accesso di Google. Controlla la connessione e riprova.",
  "popup-blocked":
    "Il browser ha bloccato la finestra di Google. Consenti i popup per questo sito e riprova.",
  "popup-closed": "La finestra di accesso è stata chiusa prima di completare.",
  "access-denied": "Accesso negato da Google.",
  "scope-denied":
    "Per usare il calendario devi autorizzare la modifica degli eventi: ripeti l'accesso e lascia selezionata la voce del calendario.",
  "session-expired": "La sessione Google è scaduta: ricollegati.",
  unknown: "Accesso a Google non riuscito. Riprova.",
};

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, detail?: string) {
    super(AUTH_MESSAGES[code]);
    this.name = "AuthError";
    this.code = code;
    if (detail) this.cause = detail;
  }
}

// ── Archivio del token (sessione della scheda, con scadenza) ───────────────

export interface TokenStore {
  set(token: string, expiresInSeconds: number): void;
  get(): string | null;
  clear(): void;
}

export interface TokenPersistence {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const TOKEN_STORAGE_KEY = "shifter-google-token";

export function createTokenStore(
  now: () => number = Date.now,
  persistence?: TokenPersistence,
): TokenStore {
  let token: string | null = null;
  let expiresAt = 0;

  try {
    const saved = persistence?.getItem(TOKEN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { token?: unknown; expiresAt?: unknown };
      if (
        typeof parsed.token === "string" &&
        typeof parsed.expiresAt === "number" &&
        now() < parsed.expiresAt
      ) {
        token = parsed.token;
        expiresAt = parsed.expiresAt;
      } else {
        persistence?.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    try {
      persistence?.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // sessionStorage può non essere disponibile in modalità privata.
    }
  }

  return {
    set(value, expiresInSeconds) {
      token = value;
      expiresAt = now() + expiresInSeconds * 1000 - EXPIRY_MARGIN_MS;
      try {
        persistence?.setItem(
          TOKEN_STORAGE_KEY,
          JSON.stringify({ token, expiresAt }),
        );
      } catch {
        // Il login resta utilizzabile anche se sessionStorage non è disponibile.
      }
    },
    get() {
      if (token !== null && now() < expiresAt) return token;
      token = null;
      expiresAt = 0;
      try {
        persistence?.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        // Ignora gli errori di storage e considera comunque scaduta la sessione.
      }
      return null;
    },
    clear() {
      token = null;
      expiresAt = 0;
      try {
        persistence?.removeItem(TOKEN_STORAGE_KEY);
      } catch {
        // Ignora gli errori di storage: il token in memoria è già stato rimosso.
      }
    },
  };
}

function getSessionStorage(): TokenPersistence | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

const store = createTokenStore(Date.now, getSessionStorage());

// ── Caricamento dello script Google ───────────────────────────────────────

let gisPromise: Promise<GisOAuth2> | null = null;

function loadGis(): Promise<GisOAuth2> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google.accounts.oauth2);
  }

  gisPromise ??= new Promise<GisOAuth2>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new AuthError("script-load"));
    };
    script.onerror = () => reject(new AuthError("script-load"));
    document.head.append(script);
  }).catch((error: unknown) => {
    gisPromise = null; // permette un nuovo tentativo
    throw error;
  });

  return gisPromise;
}

// ── API pubblica ───────────────────────────────────────────────────────────

export function getClientId(): string {
  const id = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
  if (!id) throw new AuthError("missing-client-id");
  return id;
}

export function isSignedIn(): boolean {
  return store.get() !== null;
}

export function getAccessToken(): string | null {
  return store.get();
}

export function clearAccessToken(): void {
  store.clear();
}

/**
 * Apre la finestra di Google e salva il token in memoria.
 * Da chiamare in risposta a un tocco dell'utente (altrimenti il browser blocca il popup).
 */
export async function signIn(
  prompt: "" | "consent" | "select_account" = "select_account",
): Promise<void> {
  const clientId = getClientId();
  const oauth2 = await loadGis();

  await new Promise<void>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPE,
      prompt,
      callback: (response) => {
        if (response.error) {
          reject(
            new AuthError(
              response.error === "access_denied" ? "access-denied" : "unknown",
              response.error_description ?? response.error,
            ),
          );
          return;
        }

        // L'utente può togliere la spunta al calendario nella schermata di consenso.
        if (!response.access_token || !oauth2.hasGrantedAllScopes(response, GOOGLE_SCOPE)) {
          reject(new AuthError("scope-denied"));
          return;
        }

        store.set(response.access_token, Number(response.expires_in ?? 3600));
        resolve();
      },
      error_callback: (error) => {
        if (error.type === "popup_failed_to_open") reject(new AuthError("popup-blocked"));
        else if (error.type === "popup_closed") reject(new AuthError("popup-closed"));
        else reject(new AuthError("unknown", error.message));
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Restituisce un token valido. Se è scaduto prova un rinnovo senza chiedere nulla;
 * se non è possibile (serve un tocco dell'utente) lancia AuthError("session-expired").
 */
export async function ensureAccessToken(): Promise<string> {
  const current = store.get();
  if (current) return current;

  try {
    await signIn("");
  } catch {
    throw new AuthError("session-expired");
  }

  const renewed = store.get();
  if (!renewed) throw new AuthError("session-expired");
  return renewed;
}
