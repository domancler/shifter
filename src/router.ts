export type ScreenName =
  | "menu"
  | "photo"
  | "manual"
  | "import"
  | "export"
  | "word";

type Renderer = () => HTMLElement;

const screens = new Map<ScreenName, Renderer>();

export function register(name: ScreenName, renderer: Renderer): void {
  screens.set(name, renderer);
}

export function go(name: ScreenName): void {
  const renderer = screens.get(name);
  if (!renderer) throw new Error(`Schermata non registrata: ${name}`);
  const root = document.getElementById("app");
  if (!root) throw new Error("Elemento #app non trovato");
  root.replaceChildren(renderer());
  window.scrollTo(0, 0);
}