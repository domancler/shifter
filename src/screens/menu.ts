import { el } from "../ui";
import { go, type ScreenName } from "../router";

const ITEMS: { label: string; target: ScreenName }[] = [
  { label: "Crea programmato da foto", target: "photo" },
  { label: "Crea programmato a mano", target: "manual" },
  { label: "Importa programmato da backup", target: "import" },
  { label: "Esporta programmato come backup", target: "export" },
  { label: "Export programmato da inviare (Word)", target: "word" },
];

export function menuScreen(): HTMLElement {
  return el("main", { className: "screen" }, [
    el("h1", { text: "Turni Calendar" }),
    el(
      "div",
      { className: "menu" },
      ITEMS.map((item) =>
        el("button", {
          className: "menu-button",
          text: item.label,
          onClick: () => go(item.target),
        }),
      ),
    ),
  ]);
}