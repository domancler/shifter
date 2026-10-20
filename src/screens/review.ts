import { el } from "../ui";
import { showToast } from "../toast";
import { exportBackup } from "../model/backup";
import { go, createThemeToggle } from "../router";
import { buildWordBlob, wordFileName } from "../model/word";
import { saveScheduleToGoogle } from "../calendar/saveSchedule";
import {
  describeError,
  isGoogleConnected,
} from "../calendar/googleClient";
import {
  buildPdfBlob,
  pdfFileName 
} from "../model/pdf";
import {
  getActiveSchedule,
  setActiveSchedule,
  getScheduleSource,
  markScheduleSaved,
  isScheduleSaved,
  markScheduleUnsaved,
  setWizardIndex,
} from "../model/session";
import {
  entryForLeave,
  entryForShift,
  formatDate,
  formatShortDate,
} from "../model/schedule";
import {
  LEAVE_CODES,
  SHIFT_CODES,
  type Day,
  type Entry,
  type LeaveCode,
  type Schedule,
  type ShiftCode,
} from "../model/types";
import {
  createBrandIcon,
  createBackupBrandIcon,
  createChecklistBrandIcon,
  createGoogleCalendarIcon,
  createPdfBrandIcon,
  createIcon,
  setButtonIconLabel,
} from "../icons";

function button(
  text: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const result = el("button", { text, className, onClick });
  result.type = "button";
  return result;
}

function iconButton(
  iconName: "close" | "arrowLeft",
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const result = button("", className, onClick);
  result.append(createIcon(iconName));
  result.setAttribute("aria-label", label);
  result.title = label;
  return result;
}

function actionButton(
  icon: Element,
  text: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const result = document.createElement("button");
  result.type = "button";
  result.className = `review-action-button ${className}`;
  result.addEventListener("click", onClick);

  const iconElement = document.createElement("span");
  iconElement.className = "review-action-icon";
  iconElement.append(icon);

  const labelElement = document.createElement("span");
  labelElement.className = "review-action-label";
  labelElement.textContent = text;

  result.append(iconElement, labelElement);
  result.title = text;

  return result;
}

function entryLabel(entry: Entry): string {
  return entry ? entry.code : "Non compilato";
}

function countCompiledDays(days: { entry: Entry }[]): number {
  return days.filter((day) => day.entry !== null).length;
}


function getUncompiledDays(schedule: Schedule): Day[] {
  return schedule.days.filter((day) => day.entry === null);
}


function returnToMenuSafely(): void {
  const schedule = getActiveSchedule();

  if (!schedule || isScheduleSaved()) {
    setActiveSchedule(null);
    setWizardIndex(0);
    go("menu");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "exit-dialog-overlay";

  const dialog = document.createElement("section");
  dialog.className = "exit-dialog";
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "exit-dialog-title");
  dialog.setAttribute("aria-describedby", "exit-dialog-description");

  const heading = el("div", {
    className: "exit-dialog-heading",
  }, [
    el("h2", { text: "Programma non salvato" }),
    iconButton("close", "Chiudi finestra", "exit-dialog-close", closeDialog),
  ]);

  const message = el("p", {
    className: "exit-dialog-message",
    text: "Se torni al menu, perderai il programma temporaneo e tutte le modifiche non salvate. Vuoi continuare?",
  });
  message.id = "exit-dialog-description";

  const title = heading.querySelector("h2");
  if (title) title.id = "exit-dialog-title";

  const stayButton = button(
    "Resta qui",
    "exit-dialog-stay",
    closeDialog,
  );

  const exitButton = button(
    "Esci senza salvare",
    "exit-dialog-confirm",
    () => {
      closeDialog();
      setActiveSchedule(null);
      setWizardIndex(0);
      go("menu");
    },
  );

  const footer = el("div", {
    className: "exit-dialog-actions",
  }, [stayButton, exitButton]);

  dialog.append(heading, message, footer);
  overlay.append(dialog);

  function closeDialog(): void {
    window.removeEventListener("keydown", handleKeyDown);
    overlay.remove();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") closeDialog();
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDialog();
  });

  window.addEventListener("keydown", handleKeyDown);
  document.body.append(overlay);
  stayButton.focus();
}

export function reviewScreen(): HTMLElement {
  const schedule = getActiveSchedule();

  if (!schedule) {
    return el("main", { className: "screen" }, [
      el("h1", { text: "Nessun programmato da revisionare" }),
      (() => {
        const back = button("Menu", "back", () => go("menu"));
        setButtonIconLabel(back, "arrowLeft", "Menu");
        return back;
      })(),
    ]);
  }

  const list = el("div", { className: "review-list" });

  const compiledCount = el("span", {
    className: "review-period-days",
    text: `${countCompiledDays(schedule.days)} / ${schedule.days.length} giorni`,
  });

  const rowStates: {
    entry: HTMLElement;
    note: HTMLElement;
    essential: HTMLButtonElement;
  }[] = [];

  function refreshCount(): void {
    const latest = getActiveSchedule();
    if (!latest) return;

    compiledCount.textContent =
      `${countCompiledDays(latest.days)} / ${latest.days.length} giorni`;
  }


  function updateEssentialButton(
    element: HTMLButtonElement,
    isEssential: boolean,
    isCompiled: boolean,
  ): void {
    element.classList.toggle("is-active", isEssential);
    element.replaceChildren(createIcon("alert", "essential-icon"));
    element.title = isEssential
      ? "Disattiva esigenza"
      : "Attiva esigenza";

    element.setAttribute(
      "aria-label",
      isEssential ? "Disattiva esigenza" : "Attiva esigenza",
    );
    element.setAttribute("aria-pressed", String(isEssential));

    // Un giorno non compilato non può diventare esigenza.
    // Se è già esigenza, deve comunque essere possibile disattivarla.
    element.disabled = !isCompiled && !isEssential;
  }


  function openEditor(index: number): void {
    const currentSchedule = getActiveSchedule();
    if (!currentSchedule) return;

    const currentDay = currentSchedule.days[index];

    let draftEntry: Entry = currentDay.entry;
    let draftNote = currentDay.note;

    const previousOverflow = document.body.style.overflow;

    const overlay = document.createElement("div");
    overlay.className = "review-modal-overlay";

    const dialog = document.createElement("section");
    dialog.className = "review-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute(
      "aria-label",
      `Modifica ${formatDate(currentDay.date, {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })}`,
    );

    overlay.append(dialog);

    function closeModal(): void {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      overlay.remove();
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") closeModal();
    }

    function makeChoice(
      text: string,
      selected: boolean,
      onClick: () => void,
    ): HTMLButtonElement {
      const choice = button(
        text,
        `review-choice${selected ? " is-selected" : ""}`,
        onClick,
      );
      choice.setAttribute("aria-pressed", String(selected));
      return choice;
    }

    function renderModal(): void {
      const heading = el("div", {
        className: "review-modal-heading",
      }, [
        el("h2", {
          text: formatDate(currentDay.date, {
            weekday: "long",
            day: "2-digit",
            month: "long",
          }),
        }),
        iconButton("close", "Chiudi finestra", "review-modal-close", closeModal),
      ]);

      const leaveGrid = el(
        "div",
        { className: "review-choice-grid review-leave-grid" },
        LEAVE_CODES.map((code) =>
          makeChoice(
            code,
            draftEntry?.type === "leave" &&
            draftEntry.code === code,
            () => {
              draftEntry = entryForLeave(code as LeaveCode);
              renderModal();
            },
          ),
        ),
      );

      const shiftGrid = el(
        "div",
        { className: "review-choice-grid review-shift-grid" },
        SHIFT_CODES.map((code) =>
          makeChoice(
            code,
            draftEntry?.type === "shift" &&
            draftEntry.code === code,
            () => {
              draftEntry = entryForShift(
                currentDay.date,
                code as ShiftCode,
              );
              renderModal();
            },
          ),
        ),
      );

      const note = document.createElement("textarea");
      note.className = "review-modal-notes";
      note.rows = 3;
      note.value = draftNote;
      note.placeholder = "Aggiungi eventuali note…";
      note.addEventListener("input", () => {
        draftNote = note.value;
      });

      const applyButton = button(
        "Applica modifiche",
        "primary-button review-apply",
        () => {
          const latest = getActiveSchedule();
          if (!latest) return;

          latest.days[index].entry = draftEntry;
          latest.days[index].note = draftNote;

          setActiveSchedule(latest);
          markScheduleUnsaved();

          const rowState = rowStates[index];

          rowState.entry.textContent =
            entryLabel(latest.days[index].entry);
          rowState.entry.classList.toggle(
            "is-empty",
            latest.days[index].entry === null,
          );

          if (latest.days[index].note.trim()) {
            rowState.note.replaceChildren(createIcon("note", "review-note-icon"));
          } else {
            rowState.note.replaceChildren();
          }
          rowState.note.title =
            latest.days[index].note.trim()
              ? "Questa giornata contiene note"
              : "";

          updateEssentialButton(
            rowState.essential,
            latest.days[index].isEssential === true,
            latest.days[index].entry !== null,
          );

          refreshCount();
          closeModal();
        },
      );

      dialog.replaceChildren(
        heading,
        el("div", { className: "review-modal-content" }, [
          el("h3", { text: "Giustificativi" }),
          leaveGrid,

          el("h3", { text: "Turni" }),
          shiftGrid,

          el("h3", { text: "Note" }),
          note,
        ]),
        el("div", { className: "review-modal-footer" }, [
          applyButton,
        ]),
      );
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal();
    });

    window.addEventListener("keydown", handleKeyDown);

    document.body.style.overflow = "hidden";
    renderModal();
    document.body.append(overlay);
  }

  schedule.days.forEach((day, index) => {
    const date = el("span", {
      className: "review-day-date",
      text: formatDate(day.date, {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }),
    });

    const entry = el("span", {
      className: `review-day-entry${day.entry ? "" : " is-empty"}`,
      text: entryLabel(day.entry),
    });

    const noteIndicator = el("span", {
      className: "review-day-note",
    });
    if (day.note.trim()) {
      noteIndicator.append(createIcon("note", "review-note-icon"));
    }
    noteIndicator.title = day.note.trim()
      ? "Questa giornata contiene note"
      : "";

    const arrow = el("span", {
      className: "review-day-arrow",
    });
    arrow.append(createIcon("chevron", "review-day-chevron"));

    const isMonday =
      new Date(`${day.date}T12:00:00`).getDay() === 1;

    /*
     * Il contenitore esterno separa la card dal pulsante Esigenza.
     * Il punto esclamativo non occupa più spazio nella griglia della card.
     */
    const item = document.createElement("div");
    item.className =
      `review-day-item${isMonday ? " review-week-start" : ""}`;

    const row = document.createElement("div");
    row.className = "review-day-row";
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    row.setAttribute(
      "aria-label",
      `${formatDate(day.date, {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })}: ${entryLabel(day.entry)}. Apri per modificare.`,
    );

    row.addEventListener("click", () => {
      openEditor(index);
    });

    row.addEventListener("keydown", (event) => {
      if (event.target !== row) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openEditor(index);
      }
    });

    row.append(date, entry, noteIndicator, arrow);

    const essential = document.createElement("button");
    essential.type = "button";
    essential.className = "review-day-essential";
    updateEssentialButton(
      essential,
      day.isEssential === true,
      day.entry !== null,
    );

    essential.addEventListener("click", (event) => {
      event.stopPropagation();

      const latest = getActiveSchedule();
      if (!latest) return;

      const currentDay = latest.days[index];
      currentDay.isEssential = currentDay.isEssential !== true;

      setActiveSchedule(latest);
      markScheduleUnsaved();


      updateEssentialButton(
        essential,
        currentDay.isEssential === true,
        currentDay.entry !== null,
      );


      essential.blur();
    });

    item.append(row, essential);
    list.append(item);

    rowStates.push({
      entry,
      note: noteIndicator,
      essential,
    });
  });

  const calendarAction = actionButton(
    createGoogleCalendarIcon(),
    "Inserisci nel Calendar",
    "review-action-calendar",
    async () => {
      const currentSchedule = getActiveSchedule();

      if (!isGoogleConnected()) {
        showToast(
          "Collegati a Google Calendar dalla home prima di usare questa funzione.",
          "warning",
        );
        return;
      }

      if (!currentSchedule) {
        showToast(
          "Non c'è nessun programmato da salvare.",
          "warning",
        );
        return;
      }

      calendarAction.disabled = true;

      try {
        const missingDays = getUncompiledDays(currentSchedule);

        if (missingDays.length > 0) {
          const dates = missingDays
            .map((day) =>
              formatDate(day.date, {
                weekday: "long",
                day: "2-digit",
                month: "long",
              }),
            )
            .map((date) => date.charAt(0).toUpperCase() + date.slice(1));

          const message = [
            `Attenzione: ci sono ${missingDays.length} giornate senza turno o giustificativo.`,
            "",
            ...dates.map((date) => `• ${date}`),
            "",
            "Vuoi salvare comunque il programma?",
          ].join("\n");

          if (!window.confirm(message)) {
            showToast(
              "Salvataggio annullato. Completa le giornate mancanti e riprova.",
              "info",
            );
            return;
          }
        }

        showToast(
          "Preparazione del salvataggio su Google Calendar…",
          "info",
        );

        
        const result = await saveScheduleToGoogle(currentSchedule);


        if (result === null) {
          showToast("Salvataggio annullato.", "info");
          return;
        }

        setActiveSchedule(currentSchedule);
        markScheduleSaved();

        showToast(
          `Salvataggio completato. Creati: ${result.created}, aggiornati: ${result.updated}, rimossi: ${result.deleted}.`,
          "success",
        );
      } catch (error) {
        console.error(
          "Errore durante il salvataggio su Google Calendar:",
          error,
        );

        markScheduleUnsaved();
        showToast(describeError(error), "error");
      } finally {
        calendarAction.disabled = false;
      }
    },
  );
  calendarAction.disabled = !isGoogleConnected();
  calendarAction.title = isGoogleConnected()
    ? "Inserisci il programmato in Google Calendar"
    : "Collegati a Google Calendar dalla home per usare questa funzione";

  const screen = el("main", {
    className: "screen review-screen",
  }, [
    (() => {
      const fromWizard = getScheduleSource() === "wizard";
      const back = button(
        fromWizard ? "Torna al wizard" : "Torna al menu",
        "back",
        () => {
          if (fromWizard) {
            go("wizard");
          } else {
            returnToMenuSafely();
          }
        },
      );
      setButtonIconLabel(
        back,
        "arrowLeft",
        fromWizard ? "Torna al wizard" : "Torna al menu",
      );
      return back;
    })(),

    el("h1", { text: "Review" }),

    el("div", { className: "review-period" }, [
      el("span", {
        text: `Periodo: ${formatShortDate(schedule.period.start)} – ${formatShortDate(schedule.period.end)}`,
      }),
      compiledCount,
    ]),

    el("section", { className: "review-actions" }, [
      el("h2", {
        className: "review-actions-title",
        text: "Operazioni",
      }),

      el("div", { className: "review-actions-grid" }, [
        el("div", { className: "review-actions-secondary" }, [
          actionButton(
            createChecklistBrandIcon(),
            "Controllo turni",
            "review-action-check",
            () => showToast(
              "Il controllo dei turni sarà disponibile in un prossimo aggiornamento.",
              "info",
            ),
          ),

          actionButton(
            createBrandIcon("microsoftWord", "Microsoft Word"),
            "Word",
            "review-action-word",
            async () => {
              const currentSchedule = getActiveSchedule();

              if (!currentSchedule) {
                showToast("Non c'è nessun programmato da esportare.", "warning");
                return;
              }

              try {
                const blob = await buildWordBlob(currentSchedule);
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = url;
                link.download = wordFileName(currentSchedule);

                document.body.append(link);
                link.click();
                link.remove();

                window.setTimeout(() => URL.revokeObjectURL(url), 1000);

                showToast("Il documento Word è stato generato e il download è stato avviato.", "success");
              } catch (error) {
                console.error("Errore durante l'esportazione Word:", error);
                showToast("Non è stato possibile generare il Word. Riprova.", "error");
              }
            },
          ),

          actionButton(
            createPdfBrandIcon(),
            "PDF",
            "review-action-pdf",
            async () => {
              const currentSchedule = getActiveSchedule();

              if (!currentSchedule) {
                showToast("Non c'è nessun programmato da esportare.", "warning");
                return;
              }

              try {
                const blob = await buildPdfBlob(currentSchedule);
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = url;
                link.download = pdfFileName(currentSchedule);

                document.body.append(link);
                link.click();
                link.remove();

                window.setTimeout(() => URL.revokeObjectURL(url), 1000);

                showToast("Il documento Word è stato generato e il download è stato avviato.", "success");
              } catch (error) {
                console.error("Errore durante l'esportazione Word:", error);
                showToast("Non è stato possibile generare il Word. Riprova.", "error");
              }
            },
          ),

          actionButton(
            createBackupBrandIcon(),
            "Backup",
            "review-action-backup",
            () => {
              const currentSchedule = getActiveSchedule();

              if (!currentSchedule) {
                showToast(
                  "Non c'è nessun programmato da esportare.",
                  "warning",
                );
                return;
              }

              try {
                const json = exportBackup(currentSchedule);
                const blob = new Blob([json], {
                  type: "application/json;charset=utf-8",
                });

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                const month =
                  currentSchedule.period.start.slice(0, 7);

                link.href = url;
                link.download = `Shifter_backup_${month}.json`;

                document.body.append(link);
                link.click();
                link.remove();

                window.setTimeout(
                  () => URL.revokeObjectURL(url),
                  1000,
                );

                markScheduleSaved();
                showToast(
                  "Il backup JSON è stato generato e il download è stato avviato.",
                  "success",
                );
              } catch (error) {
                console.error(
                  "Errore durante l'esportazione del backup:",
                  error,
                );

                showToast(
                  "Non è stato possibile esportare il backup. Riprova.",
                  "error",
                );
              }
            },
          ),
        ]),

        el("div", { className: "review-actions-primary" }, [
          calendarAction,
        ]),
      ]),
    ]),

    list,
  ]);

  const floatingToolbar = document.createElement("div");
  floatingToolbar.className = "review-floating-toolbar";

  const backButton = iconButton(
    "arrowLeft",
    "Torna al menu",
    "review-toolbar-back",
    returnToMenuSafely,
  );

  const toolbarTitle = el("span", {
    className: "review-toolbar-title",
    text: "Review",
  });

  floatingToolbar.append(
    backButton,
    toolbarTitle,
    createThemeToggle("review-theme-toggle"),
  );

  const backToTop = button("", "review-back-to-top", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  backToTop.append(createIcon("arrowUp"));

  backToTop.setAttribute("aria-label", "Torna all'inizio");
  backToTop.title = "Torna all'inizio";

  const originalThemeButton = createThemeToggle();

  screen.append(
    floatingToolbar,
    backToTop,
    originalThemeButton,
  );

  const updateFloatingControls = () => {
    if (!screen.isConnected) {
      window.removeEventListener("scroll", updateFloatingControls);
      return;
    }

    const scrollY = window.scrollY;
    const toolbarProgress = Math.min(scrollY / 120, 1);

    floatingToolbar.style.opacity = String(toolbarProgress);
    floatingToolbar.style.transform =
      `translateY(${(1 - toolbarProgress) * -12}px)`;
    floatingToolbar.style.pointerEvents =
      toolbarProgress > 0.1 ? "auto" : "none";
    floatingToolbar.setAttribute(
      "aria-hidden",
      toolbarProgress > 0.1 ? "false" : "true",
    );

    originalThemeButton.style.opacity =
      String(1 - toolbarProgress);
    originalThemeButton.style.pointerEvents =
      toolbarProgress > 0.1 ? "none" : "auto";
    originalThemeButton.setAttribute(
      "aria-hidden",
      toolbarProgress > 0.1 ? "true" : "false",
    );

    const topProgress = Math.min(
      Math.max((scrollY - 80) / 120, 0),
      1,
    );

    backToTop.style.opacity = String(topProgress);
    backToTop.style.pointerEvents =
      topProgress > 0.1 ? "auto" : "none";
    backToTop.style.transform =
      `translateY(${(1 - topProgress) * 12}px)`;
  };

  window.addEventListener("scroll", updateFloatingControls, {
    passive: true,
  });

  window.requestAnimationFrame(updateFloatingControls);

  return screen;
}
