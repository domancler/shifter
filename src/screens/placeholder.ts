import { el } from "../ui";
import { go } from "../router";

export function placeholderScreen(title: string): HTMLElement {
  return el("main", { className: "screen" }, [
    el("button", { className: "back", text: "← Menu", onClick: () => go("menu") }),
    el("h1", { text: title }),
    el("p", { text: "Schermata non ancora realizzata." }),
  ]);
}