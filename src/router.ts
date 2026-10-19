import { createIcon } from "./icons";

export type ScreenName =
  | "login"
  | "menu"
  | "photo"
  | "manual"
  | "wizard"
  | "review"
  | "import"
  | "calendar"
  | "export"
  | "word";

type Renderer = () => HTMLElement;
type Theme = "light" | "dark";

const screens = new Map<ScreenName, Renderer>();
const THEME_KEY = "shifter-theme";

function getSavedTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === "light"
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export function createThemeToggle(
  className = "global-theme-toggle",
): HTMLButtonElement {
  const button = document.createElement("button");

  button.type = "button";
  button.className = className;
  button.addEventListener("click", () => {
    const nextTheme: Theme =
      document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark";

    applyTheme(nextTheme);
    updateThemeButton(button, nextTheme);
  });

  updateThemeButton(button, getSavedTheme());

  return button;
}

function updateThemeButton(
  button: HTMLButtonElement,
  theme: Theme,
): void {
  button.replaceChildren(createIcon(theme === "dark" ? "sun" : "moon"));

  const label =
    theme === "dark"
      ? "Passa al tema chiaro"
      : "Passa al tema scuro";

  button.setAttribute("aria-label", label);
  button.title = label;
}

export function register(
  name: ScreenName,
  renderer: Renderer,
): void {
  screens.set(name, renderer);
}

export function go(name: ScreenName): void {
  const renderer = screens.get(name);

  if (!renderer) {
    throw new Error(`Schermata non registrata: ${name}`);
  }

  const root = document.getElementById("app");

  if (!root) {
    throw new Error("Elemento #app non trovato");
  }

  // Ripristina il tema salvato senza resettare i dati del wizard.
  applyTheme(getSavedTheme());

  root.replaceChildren(renderer());

  // Nella revisione il tema è integrato nella toolbar superiore.
  if (name !== "review") {
    root.append(createThemeToggle());
  }

  window.scrollTo(0, 0);
}
