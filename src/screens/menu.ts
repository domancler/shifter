
import { el } from "../ui";
import { openBackupPicker } from "./import";
import { go, type ScreenName } from "../router";
import { disconnectGoogle, getConnectedCalendar } from "../calendar/googleClient";
import { connectFromUi } from "./googleConnect";
import { getSelectedCalendar } from "../calendar/calendarSelection";
import { maybePromptForCalendar, openCalendarPicker } from "./calendarPicker";
import { createGoogleAssistantIcon, createGoogleCalendarIcon, createIcon, createImportFileIcon, createPhotoScanIcon } from "../icons";

function menuAction(
  className: string,
  icon: Element,
  title: string,
  description: string,
  target: ScreenName,
): HTMLButtonElement {
  return el(
    "button",
    {
      className,
      onClick: () => go(target),
    },
    [
      el("span", { className: "home-action-icon" }, [icon]),
      el("span", { className: "home-action-content" }, [
        el("span", { className: "home-action-title", text: title }),
        el("span", {
          className: "home-action-description",
          text: description,
        }),
      ]),
      el("span", { className: "home-action-arrow" }, [createIcon("chevron")]),
    ],
  );
}

function googleStatusBar(): HTMLElement {
  const calendar = getConnectedCalendar();

  const button = el("button", {
    className: "google-status-button",
    text: calendar ? "Esci" : "Collegati",
    onClick: () => {
      if (calendar) {
        disconnectGoogle();
        go("login");
        return;
      }

      void connectFromUi(button).then((ok) => {
        if (ok) go("menu");
      });
    },
  });

  return el(
    "section",
    { className: `google-status${calendar ? " is-connected" : ""}` },
    [
      createGoogleAssistantIcon(),
      el("span", {
        className: "google-status-text",
        text: calendar
          ? `Account: ${calendar.name} ` //`Account Google collegato · ${calendar.name}`
          : "Account Google non collegato",
      }),
      button,
    ],
  );
}

function calendarRow(): HTMLElement {
  const name = getSelectedCalendar()?.name ?? "Calendario principale";

  return el("section", { className: "google-status is-connected calendar-row" }, [
    el("span", { className: "google-status-text", text: `Calendario: ${name}` }),
    el("button", {
      className: "google-status-button",
      text: "Cambia",
      onClick: () => openCalendarPicker({ onChosen: () => go("menu") }),
    }),
  ]);
}

export function menuScreen(): HTMLElement {
  const calendarImport = menuAction(
    "home-action home-action-import home-action-calendar",
    createGoogleCalendarIcon(),
    "Recupera da Google Calendar",
    "Apri un periodo già salvato nel calendario.",
    "calendar",
  );
  const connected = Boolean(getConnectedCalendar());
  calendarImport.disabled = !connected;
  calendarImport.title = connected
    ? "Recupera un periodo da Google Calendar"
    : "Collegati a Google Calendar per usare questa funzione";

  // La prima volta (o se il calendario scelto non esiste più) chiede dove salvare i turni.
  if (connected) window.setTimeout(() => void maybePromptForCalendar(), 0);

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

    googleStatusBar(),
    ...(connected ? [calendarRow()] : []),

    el("section", { className: "home-section" }, [
      el("h2", {
        className: "home-section-title",
        text: "Crea il tuo programmato",
      }),

      menuAction(
        "home-action home-action-primary",
        createIcon("add"),
        "Inserisci manualmente",
        "Compila il mese giorno per giorno.",
        "manual",
      ),

      menuAction(
        "home-action home-action-photo",
        createPhotoScanIcon(),
        "Crea da una foto",
        "Parti dal prospetto dei turni.",
        "photo",
      ),
    ]),

    // el("section", { className: "home-section" }, [
    //   el("h2", {
    //     className: "home-section-title",
    //     text: "Esportazioni",
    //   }),

    //   el("div", { className: "home-card-grid" }, [
    //     el(
    //       "button",
    //       {
    //         className: "home-action home-action-card",
    //         onClick: () => go("word"),
    //       },
    //       [
    //         el("span", {
    //           className: "home-card-icon home-word-icon",
    //           text: "W",
    //         }),
    //         el("span", { className: "home-card-title", text: "Esporta Word" }),
    //         el("span", {
    //           className: "home-card-description",
    //           text: "Crea un documento.",
    //         }),
    //       ],
    //     ),

    //     el(
    //       "button",
    //       {
    //         className: "home-action home-action-card",
    //         onClick: () => go("export"),
    //       },
    //       [
    //         el("span", {
    //           className: "home-card-icon home-backup-icon",
    //           text: "↓",
    //         }),
    //         el("span", {
    //           className: "home-card-title",
    //           text: "Esporta backup",
    //         }),
    //         el("span", {
    //           className: "home-card-description",
    //           text: "Salva una copia.",
    //         }),
    //       ],
    //     ),
    //   ]),
    // ]),

    el("section", { className: "home-section" }, [
      el("h2", {
        className: "home-section-title",
        text: "Importazioni",
      }),

      calendarImport,

      el(
        "button",
        {
          className: "home-action home-action-import home-action-backup",
          onClick: openBackupPicker,
        },
        [
          el("span", { className: "home-action-icon" }, [createImportFileIcon()]),
          el("span", { className: "home-action-content" }, [
            el("span", {
              className: "home-action-title",
              text: "Importa backup",
            }),
            el("span", {
              className: "home-action-description",
              text: "Carica un programmato salvato.",
            }),
          ]),
          el("span", { className: "home-action-arrow" }, [createIcon("chevron")]),
        ],
      ),
    ]),
  ]);
}
