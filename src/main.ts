
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
import { isGoogleConnected } from "./calendar/googleClient";

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

go(isGoogleConnected() ? "menu" : "login");
