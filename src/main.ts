
import "./style.css";
import { register, go } from "./router";
import { menuScreen } from "./screens/menu";
import { loginScreen } from "./screens/login";
import { placeholderScreen } from "./screens/placeholder";
import { manualScreen, resumeWizardScreen } from "./screens/manual";
import { reviewScreen } from "./screens/review";

register("login", loginScreen);
register("menu", menuScreen);
register("photo", () => placeholderScreen("Crea programmato da foto"));
register("manual", manualScreen);
register("wizard", resumeWizardScreen);
register("review", reviewScreen);
register("import", () => placeholderScreen("Importa programmato da backup"));
register("export", () => placeholderScreen("Esporta programmato come backup"));
register("word", () => placeholderScreen("Export programmato da inviare (Word)"));

go("login");
