
import "./style.css";
import { initializePwa } from "./pwa";
import { register, go } from "./router";
import { menuScreen } from "./screens/menu";
import { loginScreen } from "./screens/login";
import { placeholderScreen } from "./screens/placeholder";
import { manualScreen, resumeWizardScreen } from "./screens/manual";
import { reviewScreen } from "./screens/review";
import { importScreen } from "./screens/import";
import { calendarImportScreen } from "./screens/calendarImport";
import { isGoogleConnected, resumeRedirectSignIn } from "./calendar/googleClient";
import { hasRedirectPayload } from "./calendar/googleAuth";
import { showToast } from "./toast";

initializePwa();

register("login", loginScreen);
register("menu", menuScreen);
register("photo", () => placeholderScreen("Crea programmato da foto"));
register("manual", manualScreen);
register("wizard", resumeWizardScreen);
register("review", reviewScreen);
register("import", importScreen);
register("calendar", calendarImportScreen);
register("export", () => placeholderScreen("Esporta programmato come backup"));
register("word", () => placeholderScreen("Export programmato da inviare (Word)"));

async function start(): Promise<void> {
  // Ritorno da Google (accesso con reindirizzamento, usato dall'app installata su iPhone):
  // finché si completa il collegamento si mostra una breve attesa invece del login.
  if (hasRedirectPayload()) {
    const waiting = document.createElement("p");
    waiting.className = "import-status";
    waiting.style.padding = "24px";
    waiting.textContent = "Collegamento a Google in corso…";
    document.querySelector("#app")?.replaceChildren(waiting);
  }

  const resumed = await resumeRedirectSignIn();

  go(isGoogleConnected() ? "menu" : "login");

  if (resumed.status === "connected") {
    showToast(`Collegato a ${resumed.calendar.name}.`, "success", "Google Calendar collegato");
  } else if (resumed.status === "error") {
    showToast(resumed.message, "error");
  }
}

void start();
