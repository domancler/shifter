
export type ToastType = "success" | "info" | "warning" | "error";

let container: HTMLDivElement | null = null;
let nextId = 0;

const ICONS: Record<ToastType, string> = {
  success: "✓",
  info: "i",
  warning: "!",
  error: "×",
};

const TITLES: Record<ToastType, string> = {
  success: "Perfetto!",
  info: "Ti aggiorniamo",
  warning: "Attenzione",
  error: "Ops, qualcosa non va",
};

function getContainer(): HTMLDivElement {
  if (container?.isConnected) return container;

  container = document.createElement("div");
  container.className = "toast-container";
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-atomic", "false");

  document.body.append(container);
  return container;
}

export function showToast(
  message: string,
  type: ToastType = "info",
  title?: string,
  duration = 3000,
): void {
  const host = getContainer();
  const id = ++nextId;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.dataset.toastId = String(id);
  toast.setAttribute(
    "role",
    type === "error" ? "alert" : "status",
  );

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = ICONS[type];
  icon.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "toast-content";

  const heading = document.createElement("strong");
  heading.className = "toast-title";
  heading.textContent = title ?? TITLES[type];

  const text = document.createElement("p");
  text.className = "toast-message";
  text.textContent = message;

  content.append(heading, text);

  const close = document.createElement("button");
  close.className = "toast-close";
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Chiudi messaggio");

  let removed = false;
  let timer = 0;

  const removeToast = () => {
    if (removed) return;
    removed = true;
    window.clearTimeout(timer);
    toast.classList.add("toast-leaving");

    window.setTimeout(() => toast.remove(), 180);
  };

  close.addEventListener("click", removeToast);
  toast.addEventListener("click", (event) => {
    if (event.target === toast) removeToast();
  });

  toast.append(icon, content, close);
  host.append(toast);

  // Permette al browser di applicare lo stile iniziale
  // prima di avviare l'animazione.
  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  if (duration > 0) {
    timer = window.setTimeout(removeToast, duration);
  }
}
