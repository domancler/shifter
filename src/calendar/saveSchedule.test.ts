import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./googleClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleClient")>()),
  googleFetch: vi.fn(),
}));

import { createSchedule, entryForLeave, entryForShift } from "../model/schedule";
import type { Day } from "../model/types";
import type { RemoteEvent } from "./provider";
import { GoogleApiError, googleFetch } from "./googleClient";
import { isEventUpToDate, saveScheduleToGoogle, type SaveProgress } from "./saveSchedule";

const mockFetch = vi.mocked(googleFetch);

function schedule() {
  const s = createSchedule("2026-11", "2026-11-02", "2026-11-03");
  s.days[0].entry = entryForShift(s.days[0].date, "07-15");
  return s;
}

describe("saveScheduleToGoogle sul calendario scelto", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Nessun window.confirm: se il salvataggio provasse a chiedere una conferma, qui andrebbe in errore.
    vi.stubGlobal("window", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  function select(id: string | null) {
    const storage = new Map<string, string>();
    if (id) storage.set("shifter-calendar", JSON.stringify({ id, name: "Turni" }));
    vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null });
  }

  function respondWithCreatedEvent() {
    mockFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (!init?.method) return { items: [] }; // elenco degli eventi marcati: ancora vuoto
      return {
        id: "shifter20261102", etag: '"1"', updated: "2026-10-22T10:00:00Z",
        summary: "Turno 07-15", description: "",
        start: { dateTime: "2026-11-02T07:00:00+01:00" }, end: { dateTime: "2026-11-02T15:00:00+01:00" },
        extendedProperties: { private: {} },
      };
    });
  }

  it("legge e scrive nel calendario scelto, mai nel principale", async () => {
    select("abc@group.calendar.google.com");
    respondWithCreatedEvent();

    await saveScheduleToGoogle(schedule());

    const paths = mockFetch.mock.calls.map(([path]) => String(path));
    expect(paths.length).toBeGreaterThanOrEqual(2);
    for (const path of paths) {
      expect(path.startsWith("/calendars/abc%40group.calendar.google.com/events")).toBe(true);
      expect(path).not.toContain("/calendars/primary/");
    }
    expect(mockFetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
  });

  it("salva senza chiedere conferme e restituisce i conteggi", async () => {
    select(null);
    respondWithCreatedEvent();

    await expect(saveScheduleToGoogle(schedule())).resolves.toEqual({ created: 1, updated: 0, deleted: 0, unchanged: 0 });
  });

  it("senza scelta usa il calendario principale, come prima", async () => {
    select(null);
    respondWithCreatedEvent();

    await saveScheduleToGoogle(schedule());

    for (const [path] of mockFetch.mock.calls) {
      expect(String(path).startsWith("/calendars/primary/events")).toBe(true);
    }
  });
});

// ── Conflitti 409: l'ID fisso dell'evento esiste già ────────────────────────

interface Call { method: string; path: string; body?: any; headers?: Record<string, string> }

describe("evento con ID già esistente (409)", () => {
  const calls: Call[] = [];
  let listed: unknown[] = [];
  let lookup: () => unknown;
  let postWithIdConflicts = true;

  beforeEach(() => {
    calls.length = 0;
    listed = [];
    postWithIdConflicts = true;
    lookup = () => { throw new GoogleApiError(404, "notFound", "non trovato"); };
    mockFetch.mockReset();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => null });

    mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, path: String(path), body, headers: init?.headers as Record<string, string> | undefined });

      if (method === "GET" && String(path).includes("/events?")) return { items: listed };
      if (method === "GET") return lookup();
      if (method === "POST") {
        if (body.id && postWithIdConflicts) throw new GoogleApiError(409, "duplicate", "The requested identifier already exists.");
        return { id: body.id ?? "idgenerato", etag: '"n"', updated: "2026-10-23T10:00:00Z" };
      }
      return { id: "shifter20261102", etag: '"p"', updated: "2026-10-23T10:00:00Z" }; // PATCH
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const ourEvent = (overrides: Record<string, unknown> = {}) => ({
    id: "shifter20261102", etag: '"1"', updated: "2026-10-01T00:00:00Z", summary: "07-15", description: "",
    start: { dateTime: "2026-11-02T07:00:00+01:00" }, end: { dateTime: "2026-11-02T15:00:00+01:00" },
    extendedProperties: { private: { turniApp: "turni-calendar", turniSchema: "1", turniDay: "2026-11-02", turniKind: "shift", turniCode: "07-15" } },
    ...overrides,
  });

  it("evento eliminato (ID riservato): lo ricrea con un ID nuovo invece di fermarsi", async () => {
    lookup = () => ({ id: "shifter20261102", status: "cancelled" });

    const result = await saveScheduleToGoogle(schedule());

    expect(result).toEqual({ created: 1, updated: 0, deleted: 0, unchanged: 0 });
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0].body.id).toBe("shifter20261102"); // primo tentativo con l'ID fisso
    expect(posts[1].body.id).toBeUndefined(); // secondo tentativo: ID scelto da Google
    expect(posts[1].body.extendedProperties.private).toMatchObject({ turniApp: "turni-calendar", turniDay: "2026-11-02" });
  });

  it("conflitto ma evento non trovato: stessa strada", async () => {
    await expect(saveScheduleToGoogle(schedule())).resolves.toEqual({ created: 1, updated: 0, deleted: 0, unchanged: 0 });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);
  });

  it("evento di Shifter con quel giorno ma turno diverso: lo aggiorna (con If-Match) invece di dare errore", async () => {
    lookup = () => ourEvent({ extendedProperties: { private: { turniApp: "turni-calendar", turniSchema: "1", turniDay: "2026-11-02", turniKind: "shift", turniCode: "23-07" } } });

    const result = await saveScheduleToGoogle(schedule());

    expect(result).toEqual({ created: 0, updated: 1, deleted: 0, unchanged: 0 });
    const patch = calls.find((call) => call.method === "PATCH")!;
    expect(patch.headers).toMatchObject({ "If-Match": '"1"' });
    expect(patch.body.extendedProperties.private).toMatchObject({ turniCode: "07-15" });
  });

  it("evento con quell'ID ma di un altro giorno: errore chiaro e nessuna modifica", async () => {
    lookup = () => ourEvent({ extendedProperties: { private: { turniApp: "turni-calendar", turniDay: "2026-12-25" } } });

    await expect(saveScheduleToGoogle(schedule())).rejects.toThrow(/non è un evento di Shifter per quel giorno/);
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("un evento già salvato che passa da turno a giornata intera azzera l'orario vecchio", async () => {
    postWithIdConflicts = false;
    listed = [ourEvent()];
    const changed = createSchedule("2026-11", "2026-11-02", "2026-11-03");
    changed.days[0].entry = entryForLeave("RS");

    await saveScheduleToGoogle(changed);

    const patch = calls.find((call) => call.method === "PATCH")!;
    expect(patch.body.start).toEqual({ date: "2026-11-02", dateTime: null, timeZone: null });
    expect(patch.body.end).toEqual({ date: "2026-11-03", dateTime: null, timeZone: null });
  });

  it("e da giornata intera a turno azzera la data", async () => {
    postWithIdConflicts = false;
    listed = [ourEvent({
      summary: "RS", start: { date: "2026-11-02" }, end: { date: "2026-11-03" },
      extendedProperties: { private: { turniApp: "turni-calendar", turniSchema: "1", turniDay: "2026-11-02", turniKind: "leave", turniCode: "RS" } },
    })];

    await saveScheduleToGoogle(schedule()); // il 02.11 è un turno 07-15

    const patch = calls.find((call) => call.method === "PATCH")!;
    expect(patch.body.start.date).toBeNull();
    expect(patch.body.start.dateTime).toBe("2026-11-02T07:00:00+01:00");
    expect(patch.body.start.timeZone).toBe("Europe/Rome");
  });

  it("le creazioni normali non portano null nel corpo della richiesta", async () => {
    postWithIdConflicts = false;
    await saveScheduleToGoogle(schedule());
    const post = calls.find((call) => call.method === "POST")!;
    expect(JSON.stringify(post.body)).not.toContain("null");
  });
});

// ── Avanzamento ─────────────────────────────────────────────────────────────

describe("avanzamento del salvataggio", () => {
  const events: { method: string; path: string }[] = [];
  let listed: unknown[] = [];
  let conflicts = false;

  beforeEach(() => {
    events.length = 0;
    listed = [];
    conflicts = false;
    mockFetch.mockReset();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => null });

    mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      events.push({ method, path: String(path) });
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;

      if (method === "GET" && String(path).includes("/events?")) return { items: listed };
      if (method === "GET") return { id: "x", status: "cancelled" };
      if (method === "POST") {
        if (body.id && conflicts) throw new GoogleApiError(409, "duplicate", "esiste");
        return { id: body.id ?? "nuovo", etag: '"n"', updated: "2026-10-23T10:00:00Z" };
      }
      return { id: "e", etag: '"p"', updated: "2026-10-23T10:00:00Z" }; // PATCH
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const marked = (day: string) => ({
    id: `shifter${day.replace(/-/g, "")}`, etag: '"1"', updated: "2026-10-01T00:00:00Z", summary: "07-15", description: "",
    start: { dateTime: `${day}T07:00:00+01:00` }, end: { dateTime: `${day}T15:00:00+01:00` },
    extendedProperties: { private: { turniApp: "turni-calendar", turniSchema: "1", turniDay: day, turniKind: "shift", turniCode: "07-15" } },
  });

  /** Prepara il programmato e la raccolta dell'avanzamento; il salvataggio parte solo con start(). */
  function prepare(s = createSchedule("2026-11", "2026-11-02", "2026-11-05")) {
    const progress: SaveProgress[] = [];
    return { s, progress, start: () => saveScheduleToGoogle(s, (p) => progress.push({ ...p })) };
  }

  it("prima legge il calendario, poi riporta fatte su totali, fino al totale", async () => {
    const { s, progress, start } = prepare();
    for (const day of s.days) day.entry = entryForShift(day.date, "07-15"); // 4 giorni da creare

    await start();

    expect(progress).toEqual([
      { phase: "reading", done: 0, total: 0 },
      { phase: "writing", done: 0, total: 4 },
      { phase: "writing", done: 1, total: 4 },
      { phase: "writing", done: 2, total: 4 },
      { phase: "writing", done: 3, total: 4 },
      { phase: "writing", done: 4, total: 4 },
    ]);
  });

  it("il totale comprende aggiornamenti, creazioni ed eliminazioni", async () => {
    const { s, progress, start } = prepare();
    listed = [marked("2026-11-02"), marked("2026-11-03")];
    s.days[0].entry = entryForShift("2026-11-02", "12-18"); // aggiorna
    // 03.11 svuotato → elimina; 04.11 compilato senza evento → crea
    s.days[2].entry = entryForShift("2026-11-04", "07-15");

    const result = await start();

    expect(result).toEqual({ created: 1, updated: 1, deleted: 1, unchanged: 0 });
    expect(progress.at(-1)).toEqual({ phase: "writing", done: 3, total: 3 });
    expect(progress.filter((p) => p.phase === "writing")).toHaveLength(4); // 0/3, 1/3, 2/3, 3/3
  });

  it("un giorno recuperato dopo un 409 conta come un solo passo", async () => {
    conflicts = true;
    const { s, progress, start } = prepare(createSchedule("2026-11", "2026-11-02", "2026-11-03"));
    s.days[0].entry = entryForShift("2026-11-02", "07-15");

    await start();

    expect(progress.at(-1)).toEqual({ phase: "writing", done: 1, total: 1 });
    expect(progress.filter((p) => p.phase === "writing")).toHaveLength(2); // 0/1 e 1/1
  });

  it("se non c'è nulla da fare riporta solo la lettura", async () => {
    const { progress, start } = prepare();
    await start();
    expect(progress).toEqual([{ phase: "reading", done: 0, total: 0 }]);
  });

  it("la callback è facoltativa", async () => {
    const s = createSchedule("2026-11", "2026-11-02", "2026-11-03");
    s.days[0].entry = entryForShift("2026-11-02", "07-15");
    await expect(saveScheduleToGoogle(s)).resolves.toEqual({ created: 1, updated: 0, deleted: 0, unchanged: 0 });
  });
});

// ── Giorni già identici su Google: nessuna scrittura ────────────────────────

function remoteFor(day: Day, overrides: Partial<RemoteEvent> = {}): RemoteEvent {
  const entry = day.entry!;
  const isShift = entry.type === "shift";
  return {
    id: `shifter${day.date.replace(/-/g, "")}`, etag: '"1"', updated: "2026-10-01T00:00:00Z",
    summary: entry.code, description: day.note, allDay: !isShift,
    start: isShift ? (entry as { start: string }).start : day.date,
    end: isShift ? (entry as { end: string }).end : (new Date(Date.parse(day.date) + 86400000)).toISOString().slice(0, 10),
    markers: {
      turniApp: "turni-calendar", turniSchema: "1", turniDay: day.date, turniKind: entry.type, turniCode: entry.code,
      turniEssential: day.isEssential === true ? "1" : "0",
    },
    ...overrides,
  };
}

describe("isEventUpToDate", () => {
  const shiftDay = (): Day => ({ date: "2026-11-02", entry: entryForShift("2026-11-02", "07-15"), note: "" });
  const leaveDay = (): Day => ({ date: "2026-11-03", entry: entryForLeave("RS"), note: "" });

  it("evento identico: turno e giustificativo", () => {
    expect(isEventUpToDate(remoteFor(shiftDay()), shiftDay(), "")).toBe(true);
    expect(isEventUpToDate(remoteFor(leaveDay()), leaveDay(), "")).toBe(true);
  });

  it("stesso istante scritto con un altro fuso orario è lo stesso evento", () => {
    const day = shiftDay();
    const event = remoteFor(day, { start: "2026-11-02T06:00:00Z", end: "2026-11-02T14:00:00Z" }); // 07:00–15:00 a Roma (+01:00)
    expect(isEventUpToDate(event, day, "")).toBe(true);
  });

  it("senza il marcatore esigenza vale come non esigenza", () => {
    const day = shiftDay();
    const event = remoteFor(day);
    delete event.markers.turniEssential;
    expect(isEventUpToDate(event, day, "")).toBe(true);
  });

  it("qualunque differenza porta alla scrittura", () => {
    const day = shiftDay();
    const base = remoteFor(day);
    const withMarkers = (changes: Record<string, string>) => ({ ...base, markers: { ...base.markers, ...changes } });

    expect(isEventUpToDate(withMarkers({ turniCode: "12-18" }), day, "")).toBe(false);          // altro turno
    expect(isEventUpToDate(withMarkers({ turniKind: "leave" }), day, "")).toBe(false);          // altro tipo
    expect(isEventUpToDate(withMarkers({ turniDay: "2026-11-09" }), day, "")).toBe(false);      // altro giorno
    expect(isEventUpToDate(withMarkers({ turniSchema: "2" }), day, "")).toBe(false);            // schema diverso
    expect(isEventUpToDate(withMarkers({ turniApp: "altra" }), day, "")).toBe(false);           // non è di Shifter
    expect(isEventUpToDate(withMarkers({ turniEssential: "1" }), day, "")).toBe(false);         // esigenza tolta in app
    expect(isEventUpToDate({ ...base, summary: "Turno 07-15" }, day, "")).toBe(false);          // titolo cambiato su Google
    expect(isEventUpToDate({ ...base, start: "2026-11-02T08:00:00+01:00" }, day, "")).toBe(false); // orario spostato
    expect(isEventUpToDate({ ...base, end: "2026-11-02T16:00:00+01:00" }, day, "")).toBe(false);
    expect(isEventUpToDate({ ...base, allDay: true }, day, "")).toBe(false);                    // diventato a giornata intera
    expect(isEventUpToDate(base, day, "una nota")).toBe(false);                                 // nota aggiunta in app
    expect(isEventUpToDate({ ...base, description: "scritta su Google" }, day, "")).toBe(false); // nota cambiata su Google
    expect(isEventUpToDate(base, { ...day, isEssential: true }, "")).toBe(false);               // esigenza aggiunta in app
  });

  it("giustificativo: data di inizio o fine diverse, o non più a giornata intera", () => {
    const day = leaveDay();
    const base = remoteFor(day);
    expect(isEventUpToDate({ ...base, start: "2026-11-04" }, day, "")).toBe(false);
    expect(isEventUpToDate({ ...base, end: "2026-11-05" }, day, "")).toBe(false);
    expect(isEventUpToDate({ ...base, allDay: false }, day, "")).toBe(false);
  });

  it("giorno vuoto: mai considerato aggiornato", () => {
    const empty: Day = { date: "2026-11-02", entry: null, note: "" };
    expect(isEventUpToDate(remoteFor(shiftDay()), empty, "")).toBe(false);
  });
});

describe("salvataggio di un mese già salvato", () => {
  const calls: { method: string; path: string }[] = [];
  let listed: RemoteEvent[] = [];

  beforeEach(() => {
    calls.length = 0;
    listed = [];
    mockFetch.mockReset();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => null });
    mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, path: String(path) });
      if (method === "GET") return { items: listed.map(toGoogleItem) };
      return { id: "id", etag: '"n"', updated: "2026-10-23T10:00:00Z" };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Come risponde Google nell'elenco: gli stessi dati dell'evento, in formato API. */
  function toGoogleItem(event: RemoteEvent) {
    return {
      id: event.id, etag: event.etag, updated: event.updated, summary: event.summary, description: event.description,
      start: event.allDay ? { date: event.start } : { dateTime: event.start },
      end: event.allDay ? { date: event.end } : { dateTime: event.end },
      extendedProperties: { private: event.markers },
    };
  }

  function thirtyDays() {
    const s = createSchedule("2026-11", "2026-11-02", "2026-12-01"); // 30 giorni
    s.days.forEach((day, i) => { day.entry = i % 5 === 4 ? entryForLeave("RS") : entryForShift(day.date, "07-15"); });
    return s;
  }

  const writes = () => calls.filter((call) => call.method !== "GET");

  it("se tutto è già identico su Google non scrive nulla e lo dice", async () => {
    const s = thirtyDays();
    listed = s.days.map((day) => remoteFor(day));
    const progress: SaveProgress[] = [];

    const result = await saveScheduleToGoogle(s, (p) => progress.push({ ...p }));

    expect(result).toEqual({ created: 0, updated: 0, deleted: 0, unchanged: 30 });
    expect(writes()).toHaveLength(0);
    expect(calls).toHaveLength(1); // solo la lettura iniziale
    expect(progress).toEqual([{ phase: "reading", done: 0, total: 0 }]);
    // i riferimenti locali restano collegati agli eventi esistenti
    expect(s.days[0].calendarRef).toMatchObject({ eventId: "shifter20261102", etag: '"1"' });
  });

  it("cambiando due giorni su trenta scrive solo quei due", async () => {
    const s = thirtyDays();
    listed = s.days.map((day) => remoteFor(day));
    s.days[3].entry = entryForShift(s.days[3].date, "12-18"); // turno cambiato
    s.days[10].note = "nota nuova"; // nota aggiunta

    const result = await saveScheduleToGoogle(s);

    expect(result).toEqual({ created: 0, updated: 2, deleted: 0, unchanged: 28 });
    expect(writes().map((call) => call.method)).toEqual(["PATCH", "PATCH"]);
    expect(writes().map((call) => decodeURIComponent(call.path))).toEqual(
      expect.arrayContaining([expect.stringContaining("shifter20261105"), expect.stringContaining("shifter20261112")]),
    );
  });

  it("un giorno con duplicati si riscrive sempre, anche se l'evento principale è identico", async () => {
    const s = thirtyDays();
    listed = s.days.map((day) => remoteFor(day));
    listed.push(remoteFor(s.days[0], { id: "doppione", updated: "2026-09-01T00:00:00Z" }));

    const result = await saveScheduleToGoogle(s);

    expect(result.unchanged).toBe(29);
    expect(result.updated).toBe(1);
    expect(result.deleted).toBe(1);
    expect(writes().map((call) => call.method).sort()).toEqual(["DELETE", "PATCH"]);
  });

  it("se cambia anche solo l'esigenza il giorno viene riscritto", async () => {
    const s = thirtyDays();
    listed = s.days.map((day) => remoteFor(day));
    s.days[7].isEssential = true;

    const result = await saveScheduleToGoogle(s);

    expect(result).toMatchObject({ updated: 1, unchanged: 29 });
  });

  it("l'evento non toccato non conta nel totale dell'avanzamento", async () => {
    const s = thirtyDays();
    listed = s.days.map((day) => remoteFor(day));
    s.days[3].entry = entryForShift(s.days[3].date, "12-18");
    const progress: SaveProgress[] = [];

    await saveScheduleToGoogle(s, (p) => progress.push({ ...p }));

    expect(progress.at(-1)).toEqual({ phase: "writing", done: 1, total: 1 });
  });
});

// ── Scritture a gruppi ─────────────────────────────────────────────────────

describe("scritture a gruppi", () => {
  const log: { method: string; path: string }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let failOn: ((call: { method: string; body: any }) => unknown) | null = null;
  let listed: unknown[] = [];

  beforeEach(() => {
    log.length = 0;
    inFlight = 0;
    maxInFlight = 0;
    failOn = null;
    listed = [];
    mockFetch.mockReset();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => null });

    mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") return { items: listed };

      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      log.push({ method, path: String(path) });
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;

      const problem = failOn?.({ method, body });
      if (problem) throw problem;
      return { id: body?.id ?? "nuovo", etag: '"n"', updated: "2026-10-23T10:00:00Z" };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const noSleep = { sleep: async () => {} };

  function month(days = 10) {
    const s = createSchedule("2026-11", "2026-11-02", "2026-12-06");
    s.days.slice(0, days).forEach((day) => { day.entry = entryForShift(day.date, "07-15"); });
    return s;
  }

  it("scrive al massimo tre eventi insieme, non uno per volta", async () => {
    const result = await saveScheduleToGoogle(month(12), undefined, noSleep);

    expect(result.created).toBe(12);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("il numero di scritture insieme si può cambiare", async () => {
    await saveScheduleToGoogle(month(6), undefined, { ...noSleep, concurrency: 1 });
    expect(maxInFlight).toBe(1);
  });

  it("l'avanzamento sale sempre e arriva al totale", async () => {
    const progress: SaveProgress[] = [];
    await saveScheduleToGoogle(month(9), (p) => progress.push({ ...p }), noSleep);

    const dones = progress.filter((p) => p.phase === "writing").map((p) => p.done);
    expect(dones[0]).toBe(0);
    expect(dones.at(-1)).toBe(9);
    expect(dones).toEqual([...dones].sort((a, b) => a - b));
  });

  it("le eliminazioni partono solo dopo che tutte le creazioni sono finite", async () => {
    const s = month(8);
    // due eventi di giorni svuotati da eliminare
    listed = ["2026-11-20", "2026-11-21"].map((day) => ({
      id: `shifter${day.replace(/-/g, "")}`, etag: '"1"', updated: "2026-10-01T00:00:00Z", summary: "07-15", description: "",
      start: { dateTime: `${day}T07:00:00+01:00` }, end: { dateTime: `${day}T15:00:00+01:00` },
      extendedProperties: { private: { turniApp: "turni-calendar", turniSchema: "1", turniDay: day, turniKind: "shift", turniCode: "07-15" } },
    }));

    const result = await saveScheduleToGoogle(s, undefined, noSleep);

    expect(result).toMatchObject({ created: 8, deleted: 2 });
    const methods = log.map((entry) => entry.method);
    const firstDelete = methods.indexOf("DELETE");
    expect(firstDelete).toBeGreaterThan(-1);
    expect(methods.slice(0, firstDelete).every((method) => method === "POST")).toBe(true);
    expect(methods.slice(firstDelete).every((method) => method === "DELETE")).toBe(true);
  });

  it("al primo errore non ne parte nessun altro, non elimina nulla e rilancia l'errore", async () => {
    const s = month(10);
    listed = [{
      id: "shifter20261120", etag: '"1"', updated: "2026-10-01T00:00:00Z", summary: "07-15", description: "",
      start: { dateTime: "2026-11-20T07:00:00+01:00" }, end: { dateTime: "2026-11-20T15:00:00+01:00" },
      extendedProperties: { private: { turniApp: "turni-calendar", turniSchema: "1", turniDay: "2026-11-20", turniKind: "shift", turniCode: "07-15" } },
    }];
    let posts = 0;
    failOn = ({ method }) => (method === "POST" && ++posts === 2 ? new GoogleApiError(400, "invalid", "richiesta non valida") : null);

    await expect(saveScheduleToGoogle(s, undefined, noSleep)).rejects.toMatchObject({ status: 400 });

    expect(log.filter((entry) => entry.method === "POST").length).toBeLessThan(10);
    expect(log.some((entry) => entry.method === "DELETE")).toBe(false);
  });

  it("con 'troppe richieste' aspetta e riprova invece di fallire", async () => {
    const sleeps: number[] = [];
    let attempts = 0;
    failOn = ({ method }) => (method === "POST" && ++attempts <= 2 ? new GoogleApiError(403, "rateLimitExceeded", "troppe") : null);

    const result = await saveScheduleToGoogle(month(1), undefined, {
      sleep: async (ms) => { sleeps.push(ms); },
      retryDelays: [600, 1500, 3500],
    });

    expect(result.created).toBe(1);
    expect(sleeps).toEqual([600, 1500]);
  });

  it("se Google continua a rifiutare per troppe richieste, alla fine lo segnala", async () => {
    failOn = ({ method }) => (method === "POST" ? new GoogleApiError(429, "", "troppe") : null);

    await expect(
      saveScheduleToGoogle(month(1), undefined, { sleep: async () => {}, retryDelays: [1, 1] }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("un conflitto 409 non viene ritentato come fosse 'troppe richieste'", async () => {
    // il recupero del 409 è gestito a parte (evento eliminato → ID nuovo): qui il GET dell'evento risponde "non trovato"
    mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && String(path).includes("/events?")) return { items: [] };
      if (method === "GET") throw new GoogleApiError(404, "notFound", "no");
      const body = JSON.parse(String(init!.body));
      log.push({ method, path: String(path) });
      if (body.id) throw new GoogleApiError(409, "duplicate", "esiste");
      return { id: "nuovo", etag: '"n"', updated: "x" };
    });

    const sleeps: number[] = [];
    const result = await saveScheduleToGoogle(month(1), undefined, { sleep: async (ms) => { sleeps.push(ms); } });

    expect(result.created).toBe(1);
    expect(sleeps).toEqual([]);
    expect(log).toHaveLength(2); // POST con ID fisso (409) + POST con ID nuovo
  });
});
