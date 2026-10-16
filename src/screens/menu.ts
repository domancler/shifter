
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
    el("header", { className: "brand-header" }, [
      el("p", {
        className: "eyebrow",
        text: "PROGRAMMAZIONE TURNI",
      }),
      el("h1", { text: "Shifter" }),
      el("p", {
        className: "muted",
        text: "Il tuo programmato, senza complicazioni.",
      }),
    ]),

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

    el("p", {
      className: "footer-note",
      text: "Prototipo in sviluppo · i dati non vengono ancora salvati.",
    }),
  ]);
}
