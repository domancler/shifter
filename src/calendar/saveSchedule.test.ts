import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./googleClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleClient")>()),
  googleFetch: vi.fn(),
}));

import { createSchedule, entryForLeave, entryForShift } from "../model/schedule";
import { GoogleApiError, googleFetch } from "./googleClient";
import { saveScheduleToGoogle, type SaveProgress } from "./saveSchedule";

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

    await expect(saveScheduleToGoogle(schedule())).resolves.toEqual({ created: 1, updated: 0, deleted: 0 });
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

    expect(result).toEqual({ created: 1, updated: 0, deleted: 0 });
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0].body.id).toBe("shifter20261102"); // primo tentativo con l'ID fisso
    expect(posts[1].body.id).toBeUndefined(); // secondo tentativo: ID scelto da Google
    expect(posts[1].body.extendedProperties.private).toMatchObject({ turniApp: "turni-calendar", turniDay: "2026-11-02" });
  });

  it("conflitto ma evento non trovato: stessa strada", async () => {
    await expect(saveScheduleToGoogle(schedule())).resolves.toEqual({ created: 1, updated: 0, deleted: 0 });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);
  });

  it("evento di Shifter con quel giorno ma turno diverso: lo aggiorna (con If-Match) invece di dare errore", async () => {
    lookup = () => ourEvent({ extendedProperties: { private: { turniApp: "turni-calendar", turniSchema: "1", turniDay: "2026-11-02", turniKind: "shift", turniCode: "23-07" } } });

    const result = await saveScheduleToGoogle(schedule());

    expect(result).toEqual({ created: 0, updated: 1, deleted: 0 });
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

    expect(result).toEqual({ created: 1, updated: 1, deleted: 1 });
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
    await expect(saveScheduleToGoogle(s)).resolves.toEqual({ created: 1, updated: 0, deleted: 0 });
  });
});
