import { describe, expect, it, vi } from "vitest";
import { GoogleApiError } from "./googleClient";
import { isRateLimitError, runPool, withRetry } from "./concurrency";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("runPool", () => {
  it("non supera il numero di lavori in contemporanea e li esegue tutti", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let completed = 0;

    const tasks = Array.from({ length: 10 }, () => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await wait(5);
      inFlight--;
      completed++;
    });

    await runPool(tasks, 3);

    expect(completed).toBe(10);
    expect(maxInFlight).toBe(3);
  });

  it("con limite 1 va in fila, con limite più alto dei lavori non ne parte di più", async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    const task = async () => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); await wait(2); inFlight--; };

    await runPool([task, task, task], 1);
    expect(maxInFlight).toBe(1);

    maxInFlight = 0;
    await runPool([task, task], 50);
    expect(maxInFlight).toBe(2);
  });

  it("senza lavori non fa nulla", async () => {
    await expect(runPool([], 3)).resolves.toBeUndefined();
  });

  it("al primo errore non parte nessun altro lavoro, quelli in corso finiscono e l'errore viene rilanciato", async () => {
    const started: number[] = [];
    const finished: number[] = [];

    const tasks = Array.from({ length: 10 }, (_, index) => async () => {
      started.push(index);
      await wait(5);
      if (index === 1) throw new Error("rotto");
      finished.push(index);
    });

    await expect(runPool(tasks, 3)).rejects.toThrow("rotto");

    expect(started.length).toBeLessThan(10); // non sono partiti tutti
    expect(started).toEqual(expect.arrayContaining([0, 1, 2])); // il primo gruppo sì
    expect(finished).toEqual(expect.arrayContaining([0, 2])); // quelli già in corso sono finiti
    expect(finished).not.toContain(1);
  });
});

describe("isRateLimitError", () => {
  it("riconosce solo le richieste troppo ravvicinate", () => {
    expect(isRateLimitError(new GoogleApiError(429, "", "x"))).toBe(true);
    expect(isRateLimitError(new GoogleApiError(403, "rateLimitExceeded", "x"))).toBe(true);
    expect(isRateLimitError(new GoogleApiError(403, "userRateLimitExceeded", "x"))).toBe(true);
    expect(isRateLimitError(new GoogleApiError(403, "quotaExceeded", "x"))).toBe(true);

    expect(isRateLimitError(new GoogleApiError(403, "insufficientPermissions", "x"))).toBe(false);
    expect(isRateLimitError(new GoogleApiError(409, "duplicate", "x"))).toBe(false);
    expect(isRateLimitError(new GoogleApiError(412, "conditionNotMet", "x"))).toBe(false);
    expect(isRateLimitError(new GoogleApiError(500, "", "x"))).toBe(false);
    expect(isRateLimitError(new Error("x"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("se riesce subito non aspetta", async () => {
    const sleep = vi.fn(async () => {});
    await expect(withRetry(async () => "ok", { sleep })).resolves.toBe("ok");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("con 'troppe richieste' aspetta e riprova, con pause crescenti", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new GoogleApiError(403, "rateLimitExceeded", "troppe");
        return "fatto";
      },
      { sleep, delays: [600, 1500, 3500] },
    );

    expect(result).toBe("fatto");
    expect(attempts).toBe(3);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([600, 1500]);
  });

  it("dopo l'ultimo tentativo si arrende con l'errore di Google", async () => {
    const sleep = vi.fn(async () => {});
    const run = withRetry(async () => { throw new GoogleApiError(429, "", "troppe"); }, { sleep, delays: [10, 20] });

    await expect(run).rejects.toMatchObject({ status: 429 });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("gli altri errori non si ritentano (un conflitto resta un conflitto)", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;

    await expect(
      withRetry(async () => { attempts++; throw new GoogleApiError(409, "duplicate", "esiste"); }, { sleep }),
    ).rejects.toMatchObject({ status: 409 });

    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
