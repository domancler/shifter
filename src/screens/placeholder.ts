import { el } from "../ui";
import { go } from "../router";
import { setButtonIconLabel } from "../icons";

export function placeholderScreen(title: string): HTMLElement {
  const backButton = el("button", { className: "back", onClick: () => go("menu") });
  setButtonIconLabel(backButton, "arrowLeft", "Menu");

  return el("main", { className: "screen" }, [
    backButton,
    el("h1", { text: title }),
    el("p", { text: "Schermata non ancora realizzata." }),
  ]);
}
