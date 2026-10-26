// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

vi.mock("../calendar/googleCalendars", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../calendar/googleCalendars")>()),
  listWritableCalendars: vi.fn(),
  createCalendar: vi.fn(),
}));
vi.mock("../toast", () => ({ showToast: vi.fn() }));
vi.mock("../router", () => ({ go: vi.fn() }));

const entries = [
  { id: "me@gmail.com", name: "me@gmail.com", primary: true, color: "#4285f4" },
  { id: "fam", name: "Famiglia", primary: false, color: "#0b8043" },
  { id: "lav@group", name: "Lavoro", primary: false },
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setup(selection?: { id: string; name: string }) {
  vi.resetModules();
  document.body.innerHTML = "";
  localStorage.clear();
  if (selection) localStorage.setItem("shifter-calendar", JSON.stringify(selection));

  const calendars = await import("../calendar/googleCalendars");
  vi.mocked(calendars.listWritableCalendars).mockResolvedValue(entries);

  const client = await import("../calendar/googleClient");
  vi.spyOn(client, "getConnectedCalendar").mockReturnValue({ name: "me@gmail.com", timeZone: "Europe/Rome" });

  return {
    calendars,
    client,
    picker: await import("./calendarPicker"),
    toast: await import("../toast"),
    router: await import("../router"),
  };
}

const dialog = () => document.querySelector<HTMLElement>(".calendar-picker");
const titles = () => [...document.querySelectorAll(".calendar-picker-title")].map((node) => node.textContent);
const radio = (value: string) => document.querySelector<HTMLInputElement>(`.calendar-picker-radio[value="${value}"]`)!;
const confirmButton = () => document.querySelector<HTMLButtonElement>(".calendar-picker-confirm")!;
const nameInput = () => document.querySelector<HTMLInputElement>(".calendar-picker-field-input")!;
const status = () => document.querySelector(".calendar-picker-status")!;

function choose(value: string) {
  const input = radio(value);
  input.checked = true;
  input.dispatchEvent(new Event("change"));
}

describe("quando compare la scelta del calendario", () => {
  it("la prima volta (nessuna scelta salvata)", async () => {
    const { picker } = await setup();
    await picker.maybePromptForCalendar();
    await flush();
    expect(dialog()).not.toBeNull();
  });

  it("subito dopo un nuovo accesso, anche se una scelta esiste già, con quella preselezionata", async () => {
    const { picker, client } = await setup({ id: "fam", name: "Famiglia" });
    client.markFreshLogin();

    await picker.maybePromptForCalendar();
    await flush();

    expect(dialog()).not.toBeNull();
    expect(radio("fam").checked).toBe(true);
  });

  it("con una scelta valida e senza nuovo accesso non disturba", async () => {
    const { picker } = await setup({ id: "fam", name: "Famiglia" });
    await picker.maybePromptForCalendar();
    await flush();
    expect(dialog()).toBeNull();
  });

  it("dopo il nuovo accesso compare una volta sola", async () => {
    const { picker, client } = await setup({ id: "fam", name: "Famiglia" });
    client.markFreshLogin();
    await picker.maybePromptForCalendar();
    await flush();
    document.querySelector<HTMLButtonElement>(".exit-dialog-stay")!.click(); // Annulla

    await picker.maybePromptForCalendar();
    await flush();
    expect(dialog()).toBeNull();
  });

  it("se il calendario scelto non esiste più lo dice e fa scegliere di nuovo", async () => {
    const { picker } = await setup({ id: "sparito", name: "Vecchio" });
    await picker.maybePromptForCalendar();
    await flush();

    expect(dialog()).not.toBeNull();
    expect(document.querySelector(".calendar-picker-notice")?.textContent).toContain("Vecchio");
    expect(localStorage.getItem("shifter-calendar")).toBeNull();
  });
});

describe("contenuto della finestra", () => {
  it("«Nuovo calendario» per primo, poi i calendari esistenti con il principale indicato", async () => {
    const { picker } = await setup();
    picker.openCalendarPicker();
    await flush();

    expect(titles()).toEqual(["Nuovo calendario", "me@gmail.com", "Famiglia", "Lavoro"]);
    expect([...document.querySelectorAll(".calendar-picker-sub")].map((node) => node.textContent)).toEqual([
      "Crea un calendario dedicato ai tuoi turni",
      "Calendario principale",
    ]);
    expect(radio("me@gmail.com").checked).toBe(true); // senza scelta salvata si parte dal principale
    expect(confirmButton().textContent).toBe("Conferma");
  });

  it("il campo del nome compare solo scegliendo «Nuovo calendario»", async () => {
    const { picker } = await setup();
    picker.openCalendarPicker();
    await flush();

    const field = document.querySelector<HTMLElement>(".calendar-picker-field")!;
    expect(field.hidden).toBe(true);

    choose("__new__");
    expect(field.hidden).toBe(false);
    expect(nameInput().value).toBe("Turni");
    expect(confirmButton().textContent).toBe("Crea calendario");
    expect(document.querySelector(".calendar-picker-new")?.classList.contains("is-selected")).toBe(true);

    choose("fam");
    expect(field.hidden).toBe(true);
    expect(confirmButton().textContent).toBe("Conferma");
  });
});

describe("scelta e creazione", () => {
  it("sceglie un calendario esistente e lo ricorda", async () => {
    const { picker, router, toast } = await setup();
    const onChosen = vi.fn();
    picker.openCalendarPicker({ onChosen });
    await flush();

    choose("lav@group");
    confirmButton().click();
    await flush();

    expect(JSON.parse(localStorage.getItem("shifter-calendar")!)).toEqual({ id: "lav@group", name: "Lavoro" });
    expect(dialog()).toBeNull();
    expect(onChosen).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.showToast).mock.calls[0][0]).toContain("Lavoro");
    expect(router.go).not.toHaveBeenCalled();
  });

  it("il calendario principale si ricorda come «primary»", async () => {
    const { picker } = await setup();
    picker.openCalendarPicker();
    await flush();

    confirmButton().click(); // il principale è già selezionato
    await flush();

    expect(JSON.parse(localStorage.getItem("shifter-calendar")!)).toEqual({ id: "primary", name: "me@gmail.com" });
  });

  it("crea un nuovo calendario con il nome scritto e lo usa", async () => {
    const { picker, calendars } = await setup();
    vi.mocked(calendars.createCalendar).mockResolvedValue({ id: "nuovo@group", name: "Turni Ospedale", primary: false });
    const onChosen = vi.fn();
    picker.openCalendarPicker({ onChosen });
    await flush();

    choose("__new__");
    nameInput().value = "  Turni   Ospedale ";
    confirmButton().click();
    await flush();

    expect(calendars.createCalendar).toHaveBeenCalledWith("Turni Ospedale", "Europe/Rome");
    expect(JSON.parse(localStorage.getItem("shifter-calendar")!)).toEqual({ id: "nuovo@group", name: "Turni Ospedale" });
    expect(dialog()).toBeNull();
    expect(onChosen).toHaveBeenCalled();
  });

  it("con il nome vuoto non crea nulla e spiega il motivo", async () => {
    const { picker, calendars } = await setup();
    picker.openCalendarPicker();
    await flush();

    choose("__new__");
    nameInput().value = "   ";
    confirmButton().click();
    await flush();

    expect(calendars.createCalendar).not.toHaveBeenCalled();
    expect(status().textContent).toContain("nome");
    expect(status().classList.contains("is-error")).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  it("Invio nel campo del nome crea il calendario", async () => {
    const { picker, calendars } = await setup();
    vi.mocked(calendars.createCalendar).mockResolvedValue({ id: "n", name: "Turni", primary: false });
    picker.openCalendarPicker();
    await flush();

    choose("__new__");
    nameInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flush();

    expect(calendars.createCalendar).toHaveBeenCalledWith("Turni", "Europe/Rome");
  });

  it("se manca il permesso per creare, lo dice e lascia la finestra aperta", async () => {
    const { picker, calendars } = await setup();
    const { GoogleApiError } = await import("../calendar/googleClient");
    vi.mocked(calendars.createCalendar).mockRejectedValue(new GoogleApiError(403, "insufficientPermissions", "x"));
    picker.openCalendarPicker();
    await flush();

    choose("__new__");
    confirmButton().click();
    await flush();

    expect(status().textContent).toContain("permesso");
    expect(dialog()).not.toBeNull();
    expect(confirmButton().disabled).toBe(false);
    expect(localStorage.getItem("shifter-calendar")).toBeNull();
  });

  it("cambiando calendario avvisa che gli eventi già salvati restano nel vecchio", async () => {
    const { picker, toast } = await setup({ id: "fam", name: "Famiglia" });
    picker.openCalendarPicker();
    await flush();

    choose("lav@group");
    confirmButton().click();
    await flush();

    expect(vi.mocked(toast.showToast).mock.calls[0][0]).toContain("«Famiglia» restano lì");
  });
});

describe("annullare e problemi", () => {
  it("Annulla senza una scelta precedente usa il principale", async () => {
    const { picker } = await setup();
    picker.openCalendarPicker();
    await flush();

    document.querySelector<HTMLButtonElement>(".exit-dialog-stay")!.click();

    expect(JSON.parse(localStorage.getItem("shifter-calendar")!).id).toBe("primary");
    expect(dialog()).toBeNull();
  });

  it("Annulla non cambia una scelta già fatta", async () => {
    const { picker } = await setup({ id: "fam", name: "Famiglia" });
    picker.openCalendarPicker();
    await flush();

    choose("lav@group");
    document.querySelector<HTMLButtonElement>(".exit-dialog-stay")!.click();

    expect(JSON.parse(localStorage.getItem("shifter-calendar")!).id).toBe("fam");
  });

  it("con permessi vecchi propone di uscire e riaccedere", async () => {
    const { picker, calendars } = await setup();
    const { GoogleApiError } = await import("../calendar/googleClient");
    vi.mocked(calendars.listWritableCalendars).mockRejectedValue(new GoogleApiError(403, "insufficientPermissions", "x"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    picker.openCalendarPicker();
    await flush();

    expect(document.querySelector(".calendar-picker-confirm")?.textContent).toBe("Esci e riaccedi");
    expect(document.querySelector(".calendar-picker-notice")?.textContent).toContain("permessi");
  });

  it("non apre due finestre insieme", async () => {
    const { picker } = await setup();
    picker.openCalendarPicker();
    picker.openCalendarPicker();
    await flush();
    expect(document.querySelectorAll(".calendar-picker").length).toBe(1);
  });
});
