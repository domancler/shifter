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

describe("la finestra non si apre da sola", () => {
  it("senza una scelta salvata non si apre né si chiama Google: si usa il principale", async () => {
    const { picker, calendars } = await setup();
    await picker.verifySelectedCalendar();
    await flush();

    expect(dialog()).toBeNull();
    expect(calendars.listWritableCalendars).not.toHaveBeenCalled();
    expect(localStorage.getItem("shifter-calendar")).toBeNull();
  });

  it("con una scelta valida non disturba: nessuna finestra e nessuna notifica", async () => {
    const { picker, toast } = await setup({ id: "fam", name: "Famiglia" });
    await picker.verifySelectedCalendar();
    await flush();

    expect(dialog()).toBeNull();
    expect(toast.showToast).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("shifter-calendar")!).id).toBe("fam");
  });

  it("se il calendario scelto non esiste più lo dice con una notifica e torna al principale, senza aprire nulla", async () => {
    const { picker, toast, router } = await setup({ id: "sparito", name: "Vecchio" });
    await picker.verifySelectedCalendar();
    await flush();

    expect(dialog()).toBeNull();
    expect(localStorage.getItem("shifter-calendar")).toBeNull();
    const [message, type] = vi.mocked(toast.showToast).mock.calls[0];
    expect(message).toContain("Vecchio");
    expect(message).toContain("principale");
    expect(type).toBe("warning");
    expect(router.go).toHaveBeenCalledWith("menu");
  });

  it("controlla una sola volta per sessione", async () => {
    const { picker, calendars } = await setup({ id: "fam", name: "Famiglia" });
    await picker.verifySelectedCalendar();
    await picker.verifySelectedCalendar();
    expect(calendars.listWritableCalendars).toHaveBeenCalledTimes(1);
  });

  it("se non riesce a controllare (rete assente) resta zitto e riprova la volta dopo", async () => {
    const { picker, calendars, toast } = await setup({ id: "fam", name: "Famiglia" });
    vi.mocked(calendars.listWritableCalendars).mockRejectedValueOnce(new Error("offline"));

    await picker.verifySelectedCalendar();
    await flush();
    expect(dialog()).toBeNull();
    expect(toast.showToast).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("shifter-calendar")!).id).toBe("fam");

    await picker.verifySelectedCalendar();
    expect(calendars.listWritableCalendars).toHaveBeenCalledTimes(2);
  });

  it("se il calendario è stato rinominato su Google aggiorna il nome ricordato", async () => {
    const { picker } = await setup({ id: "fam", name: "Nome vecchio" });
    await picker.verifySelectedCalendar();
    expect(JSON.parse(localStorage.getItem("shifter-calendar")!)).toEqual({ id: "fam", name: "Famiglia" });
  });

  it("il principale scelto resta valido anche se il suo nome cambia", async () => {
    const { picker, toast } = await setup({ id: "primary", name: "vecchia@mail.it" });
    await picker.verifySelectedCalendar();
    expect(toast.showToast).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("shifter-calendar")!)).toEqual({ id: "primary", name: "me@gmail.com" });
  });

  it("«Cambia» la apre quando l'utente vuole, con la scelta attuale selezionata", async () => {
    const { picker } = await setup({ id: "fam", name: "Famiglia" });
    picker.openCalendarPicker();
    await flush();

    expect(dialog()).not.toBeNull();
    expect(radio("fam").checked).toBe(true);
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
