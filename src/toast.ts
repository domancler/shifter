import { createIcon, type IconName } from "./icons";

export type ToastType = "success" | "info" | "warning" | "error";

/** done/total → barra con il conteggio ("3 di 12"); "indeterminate" → barra che scorre, quando il totale non è noto. */
export type ToastProgress = { done: number; total: number } | "indeterminate";

export interface ToastUpdate {
  type?: ToastType;
  title?: string;
  /** Un testo, oppure più righe mostrate una sotto l'altra. */
  message?: string | string[];
  /** null toglie la barra. */
  progress?: ToastProgress | null;
  /** Nuova durata in ms dopo l'aggiornamento; 0 = resta finché non viene chiusa. */
  duration?: number;
}

export interface ToastHandle {
  update(changes: ToastUpdate): void;
  close(): void;
}

let container: HTMLDivElement | null = null;
let nextId = 0;

const ICONS: Record<ToastType, IconName> = {
  success: "checkCircle",
  info: "info",
  warning: "warning",
  error: "close",
};

const TITLES: Record<ToastType, string> = {
  success: "Perfetto!",
  info: "Ti aggiorniamo",
  warning: "Attenzione",
  error: "Ops, qualcosa non va",
};

const ALL_TYPES = Object.keys(ICONS) as ToastType[];

function getContainer(): HTMLDivElement {
  if (container?.isConnected) return container;

  container = document.createElement("div");
  container.className = "toast-container";
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-atomic", "false");

  document.body.append(container);
  return container;
}

/**
 * Mostra una notifica e restituisce una maniglia per aggiornarla (testo, barra di avanzamento, tipo)
 * o chiuderla. duration = 0 la lascia finché l'utente non la chiude.
 */
export function showToast(
  message: string | string[],
  type: ToastType = "info",
  title?: string,
  duration = 3000,
): ToastHandle {
  const host = getContainer();
  const id = ++nextId;

  const toast = document.createElement("div");
  toast.dataset.toastId = String(id);

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "toast-content";

  const heading = document.createElement("strong");
  heading.className = "toast-title";

  const body = document.createElement("div");
  body.className = "toast-body";

  const progressBox = document.createElement("div");
  progressBox.className = "toast-progress";
  progressBox.hidden = true;
  progressBox.setAttribute("role", "progressbar");

  const track = document.createElement("div");
  track.className = "toast-progress-track";
  const fill = document.createElement("div");
  fill.className = "toast-progress-fill";
  track.append(fill);

  const label = document.createElement("span");
  label.className = "toast-progress-label";
  progressBox.append(track, label);

  content.append(heading, body, progressBox);

  const close = document.createElement("button");
  close.className = "toast-close";
  close.type = "button";
  close.append(createIcon("close", "toast-close-icon"));
  close.setAttribute("aria-label", "Chiudi messaggio");

  let removed = false;
  let timer = 0;
  let customTitle = title;
  let currentType = type;

  const setType = (next: ToastType) => {
    currentType = next;
    toast.classList.remove(...ALL_TYPES.map((name) => `toast-${name}`));
    toast.classList.add(`toast-${next}`);
    toast.setAttribute("role", next === "error" ? "alert" : "status");
    icon.replaceChildren(createIcon(ICONS[next], "toast-status-icon"));
    heading.textContent = customTitle ?? TITLES[next];
  };

  const setMessage = (next: string | string[]) => {
    if (Array.isArray(next)) {
      const list = document.createElement("ul");
      list.className = "toast-lines";
      for (const line of next) {
        const item = document.createElement("li");
        item.textContent = line;
        list.append(item);
      }
      body.replaceChildren(list);
      return;
    }

    const text = document.createElement("p");
    text.className = "toast-message";
    text.textContent = next;
    body.replaceChildren(text);
  };

  const setProgress = (next: ToastProgress | null) => {
    if (next === null) {
      progressBox.hidden = true;
      return;
    }

    progressBox.hidden = false;

    if (next === "indeterminate") {
      track.classList.add("is-indeterminate");
      fill.style.width = "";
      label.textContent = "";
      progressBox.removeAttribute("aria-valuenow");
      progressBox.removeAttribute("aria-valuemax");
      return;
    }

    const percent = next.total > 0 ? Math.min(100, Math.round((next.done / next.total) * 100)) : 0;
    track.classList.remove("is-indeterminate");
    fill.style.width = `${percent}%`;
    label.textContent = `${next.done} di ${next.total}`;
    progressBox.setAttribute("aria-valuemin", "0");
    progressBox.setAttribute("aria-valuemax", String(next.total));
    progressBox.setAttribute("aria-valuenow", String(next.done));
  };

  const removeToast = () => {
    if (removed) return;
    removed = true;
    window.clearTimeout(timer);
    toast.classList.add("toast-leaving");

    window.setTimeout(() => toast.remove(), 180);
  };

  const armTimer = (ms: number) => {
    window.clearTimeout(timer);
    if (ms > 0) timer = window.setTimeout(removeToast, ms);
  };

  close.addEventListener("click", removeToast);
  toast.addEventListener("click", (event) => {
    if (event.target === toast) removeToast();
  });

  toast.className = "toast";
  setType(type);
  setMessage(message);

  toast.append(icon, content, close);
  host.append(toast);

  // Permette al browser di applicare lo stile iniziale
  // prima di avviare l'animazione.
  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  armTimer(duration);

  return {
    update(changes) {
      if (removed) return;

      if (changes.title !== undefined) customTitle = changes.title;
      if (changes.type !== undefined || changes.title !== undefined) setType(changes.type ?? currentType);
      if (changes.message !== undefined) setMessage(changes.message);
      if (changes.progress !== undefined) setProgress(changes.progress);
      if (changes.duration !== undefined) armTimer(changes.duration);
    },
    close: removeToast,
  };
}

/** Notifica di lavoro in corso: resta finché non la si aggiorna o chiude, con la barra che scorre. */
export function showProgressToast(title: string, message: string): ToastHandle {
  const handle = showToast(message, "info", title, 0);
  handle.update({ progress: "indeterminate" });
  return handle;
}
