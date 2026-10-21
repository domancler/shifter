import { getRedirectUri, isRedirectSignInPreferred } from "./calendar/googleAuth";
import { el } from "./ui";

/**
 * Diagnostica temporanea della connessione, per capire cosa succede dall'app installata
 * (che si apre anche offline grazie alla cache) quando serve una richiesta HTTPS vera al server.
 * Compare nella schermata di login solo dall'app installata su iPhone o con ?diag=1 nell'indirizzo.
 */

export interface ProbeResult {
  ok: boolean;
  status?: number;
  ms: number;
  error?: string;
}

/** Richiesta diretta alla rete (senza cache) con tempo massimo. */
export async function probeServer(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<ProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { cache: "no-store", signal: controller.signal });
    return { ok: response.ok, status: response.status, ms: Date.now() - startedAt };
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, ms: Date.now() - startedAt, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

export function describeProbe(result: ProbeResult): string {
  if (result.ok) return `OK (HTTP ${result.status}) in ${result.ms} ms`;
  if (result.status !== undefined) return `Il server ha risposto con HTTP ${result.status} (${result.ms} ms)`;
  return `NON RIUSCITA dopo ${result.ms} ms → ${result.error}`;
}

export function shouldShowDiagnostics(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || new URLSearchParams(window.location.search).has("diag");
}

export function diagnosticsPanel(): HTMLElement {
  const redirectUri = getRedirectUri();
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const lines = el("div", { className: "diag-lines" });
  const addLine = (label: string, value: string) =>
    lines.append(el("p", { className: "diag-line", text: `${label}: ${value}` }));

  addLine("Modalità", standalone ? "app installata" : "browser");
  addLine("Accesso Google", isRedirectSignInPreferred() ? "reindirizzamento" : "popup");
  addLine("Rete (navigator.onLine)", navigator.onLine ? "sì" : "no");
  addLine("Indirizzo di questa pagina", window.location.origin + window.location.pathname);
  addLine("Indirizzo di ritorno usato da Google", redirectUri);
  if (window.location.hash === "#diag-ok") addLine("Ricarica da rete", "riuscita");

  const result = el("p", { className: "diag-result", text: "" });

  const fetchButton = el("button", {
    className: "diag-button",
    text: "1. Prova richiesta al server",
    onClick: () => {
      fetchButton.disabled = true;
      result.textContent = "Prova in corso…";
      void probeServer(`${redirectUri}index.html?probe=${Date.now()}`).then((probe) => {
        result.textContent = `Richiesta: ${describeProbe(probe)}`;
        fetchButton.disabled = false;
      });
    },
  });

  const navigateButton = el("button", {
    className: "diag-button",
    text: "2. Prova ritorno all'indirizzo dell'app",
    // Una navigazione vera, come quella che fa Google al ritorno: se la connessione sicura fallisce comparirà lo stesso errore.
    onClick: () => window.location.assign(`${redirectUri}?probe=${Date.now()}#diag-ok`),
  });

  const details = document.createElement("details");
  details.className = "diag-panel";
  const summary = document.createElement("summary");
  summary.textContent = "Diagnostica connessione";
  details.append(summary, lines, fetchButton, navigateButton, result);
  return details;
}
