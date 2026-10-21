import { describe, expect, it, vi } from "vitest";
import { describeProbe, probeServer } from "./diagnostics";

describe("probeServer", () => {
  it("risposta valida", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok", { status: 200 }));
    const result = await probeServer("https://x/shifter/index.html", fetchMock as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(describeProbe(result)).toContain("OK (HTTP 200)");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("il server risponde con errore HTTP", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("no", { status: 502 }));
    const result = await probeServer("https://x", fetchMock as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(describeProbe(result)).toContain("HTTP 502");
  });

  it("connessione fallita: riporta il tipo di errore invece di nasconderlo", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => { throw new TypeError("Load failed"); });
    const result = await probeServer("https://x", fetchMock as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, error: "TypeError: Load failed" });
    expect(describeProbe(result)).toContain("NON RIUSCITA");
    expect(describeProbe(result)).toContain("Load failed");
  });
});
