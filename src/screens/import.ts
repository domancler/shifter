
import { el } from "../ui";
import { go } from "../router";
import { importBackup } from "../model/backup";
import { showToast } from "../toast";
import { setButtonIconLabel } from "../icons";
import {
  setActiveSchedule,
  setWizardIndex,
  setScheduleSource,
} from "../model/session";

function button(
  text: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  return el("button", { text, className, onClick });
}

export function importScreen(): HTMLElement {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;

  const status = el("p", {
    className: "import-status",
    text: "Seleziona un backup JSON esportato da Shifter.",
  });

  const chooseButton = button(
    "Seleziona backup JSON",
    "primary-button",
    () => fileInput.click(),
  );

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    chooseButton.disabled = true;
    status.textContent = "Controllo del backup in corso…";

    try {
      const json = await file.text();
      const schedule = importBackup(json);

      setActiveSchedule(schedule);
      setWizardIndex(0);
      setScheduleSource("import");

      showToast("Backup importato correttamente.", "success");
      go("review");
    } catch (error) {
      console.error("Errore durante l'importazione del backup:", error);

      status.textContent =
        "Non è stato possibile importare il file. Seleziona un backup Shifter valido.";

      showToast(
        error instanceof Error
          ? error.message
          : "Il file non è un backup Shifter valido.",
        "error",
      );

      chooseButton.disabled = false;
      fileInput.value = "";
    }
  });

  const backButton = button("Menu", "back", () => go("menu"));
  setButtonIconLabel(backButton, "arrowLeft", "Menu");

  const screen = el("main", { className: "screen import-screen" }, [
    backButton,
    el("h1", { text: "Importa backup" }),
    el("p", {
      text: "Carica un backup JSON per recuperare il tuo programma e aprirlo direttamente nella Review.",
    }),
    chooseButton,
    status,
    fileInput,
  ]);

  return screen;
}


export function openBackupPicker(): void {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      fileInput.remove();
      return;
    }

    try {
      const json = await file.text();
      const schedule = importBackup(json);

      setActiveSchedule(schedule);
      setWizardIndex(0);
      setScheduleSource("import");

      showToast("Backup importato correttamente.", "success");
      go("review");
    } catch (error) {
      console.error("Errore durante l'importazione del backup:", error);

      showToast(
        error instanceof Error
          ? error.message
          : "Il file non è un backup Shifter valido.",
        "error",
      );
    } finally {
      fileInput.remove();
    }
  });

  document.body.appendChild(fileInput);
  fileInput.click();
}
