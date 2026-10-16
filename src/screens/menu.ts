
import { el } from "../ui";
import { go, type ScreenName } from "../router";

function menuAction(
  className: string,
  icon: string,
  title: string,
  description: string,
  target: ScreenName,
): HTMLElement {
  return el(
    "button",
    {
      className,
      onClick: () => go(target),
    },
    [
      el("span", { className: "home-action-icon", text: icon }),
      el("span", { className: "home-action-content" }, [
        el("span", { className: "home-action-title", text: title }),
        el("span", {
          className: "home-action-description",
          text: description,
        }),
      ]),
      el("span", {
        className: "home-action-arrow",
        text: "›",
      }),
    ],
  );
}

export function menuScreen(): HTMLElement {
  return el("main", { className: "screen home-screen" }, [
    el("header", { className: "brand-header home-header" }, [
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

    el("section", { className: "home-section" }, [
      el("h2", {
        className: "home-section-title",
        text: "Crea il tuo programmato",
      }),

      menuAction(
        "home-action home-action-primary",
        "＋",
        "Inserisci manualmente",
        "Compila il mese giorno per giorno.",
        "manual",
      ),

      menuAction(
        "home-action home-action-photo",
        "▧",
        "Crea da una foto",
        "Parti dal prospetto dei turni.",
        "photo",
      ),
    ]),

    el("section", { className: "home-section" }, [
      el("h2", {
        className: "home-section-title",
        text: "Esportazioni",
      }),

      el("div", { className: "home-card-grid" }, [
        el(
          "button",
          {
            className: "home-action home-action-card",
            onClick: () => go("word"),
          },
          [
            el("span", {
              className: "home-card-icon home-word-icon",
              text: "W",
            }),
            el("span", { className: "home-card-title", text: "Esporta Word" }),
            el("span", {
              className: "home-card-description",
              text: "Crea un documento.",
            }),
          ],
        ),

        el(
          "button",
          {
            className: "home-action home-action-card",
            onClick: () => go("export"),
          },
          [
            el("span", {
              className: "home-card-icon home-backup-icon",
              text: "↓",
            }),
            el("span", {
              className: "home-card-title",
              text: "Esporta backup",
            }),
            el("span", {
              className: "home-card-description",
              text: "Salva una copia.",
            }),
          ],
        ),
      ]),
    ]),

    el("section", { className: "home-section" }, [
      el("h2", {
        className: "home-section-title",
        text: "Importazioni",
      }),

      menuAction(
        "home-action home-action-import",
        "↑",
        "Importa backup",
        "Carica un programmato salvato.",
        "import",
      ),
    ]),
  ]);
}
