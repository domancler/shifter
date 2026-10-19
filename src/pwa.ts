const OFFLINE_MESSAGE = "Connessione assente. Ricollegati per accedere e usare Google Calendar.";

function setupConnectivityNotice(): void {
  const notice = document.createElement("div");
  notice.className = "connection-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.textContent = OFFLINE_MESSAGE;
  notice.hidden = navigator.onLine;
  document.body.append(notice);

  window.addEventListener("offline", () => {
    notice.hidden = false;
  });
  window.addEventListener("online", () => {
    notice.hidden = true;
  });
}

export function initializePwa(): void {
  setupConnectivityNotice();

  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker.register(
    new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.origin),
    { scope: import.meta.env.BASE_URL, updateViaCache: "none" },
  ).catch((error: unknown) => {
    console.warn("Registrazione PWA non riuscita:", error);
  });
}
