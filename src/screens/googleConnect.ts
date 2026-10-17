import { connectGoogle, describeError } from "../calendar/googleClient";
import { showToast } from "../toast";

/**
 * Avvia il collegamento a Google da un pulsante: lo disabilita mentre lavora,
 * mostra l'esito e restituisce true se il collegamento è riuscito.
 */
export async function connectFromUi(
  button: HTMLButtonElement,
  status?: HTMLElement,
): Promise<boolean> {
  const originalLabel = button.textContent;
  button.disabled = true;
  if (status) status.textContent = "Apertura di Google…";

  try {
    const calendar = await connectGoogle();
    if (status) status.textContent = "";
    showToast(`Collegato a ${calendar.name}.`, "success", "Google Calendar collegato");
    return true;
  } catch (error) {
    const message = describeError(error);
    if (status) status.textContent = message;
    showToast(message, "error");
    return false;
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}
