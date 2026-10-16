import "./style.css";
import { register, go } from "./router";
import { menuScreen } from "./screens/menu";
import { placeholderScreen } from "./screens/placeholder";

register("menu", menuScreen);
register("photo", () => placeholderScreen("Crea programmato da foto"));
register("manual", () => placeholderScreen("Crea programmato a mano"));
register("import", () => placeholderScreen("Importa programmato da backup"));
register("export", () => placeholderScreen("Esporta programmato come backup"));
register("word", () => placeholderScreen("Export programmato da inviare (Word)"));

go("menu");