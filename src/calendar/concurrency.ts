import { GoogleApiError } from "./googleClient";

/** Quante scritture verso Google partono insieme. Poche: Google limita la frequenza delle richieste. */
export const WRITE_CONCURRENCY = 3;

/** Attese (ms) prima di ritentare una richiesta rifiutata per troppe richieste ravvicinate. */
export const RETRY_DELAYS = [600, 1500, 3500];

const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"]);

/** "Troppe richieste": si può ritentare dopo una pausa. Gli altri errori (conflitti, permessi…) no. */
export function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof GoogleApiError &&
    (error.status === 429 || (error.status === 403 && RATE_LIMIT_REASONS.has(error.reason)))
  );
}

export interface RetryOptions {
  delays?: number[];
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Esegue la richiesta; se Google dice "troppe richieste" aspetta e riprova, poi si arrende. */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const delays = options.delays ?? RETRY_DELAYS;
  const sleep = options.sleep ?? realSleep;

  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= delays.length) throw error;
      await sleep(delays[attempt]);
    }
  }
}

/**
 * Esegue i lavori a gruppi di `limit`. Al primo errore non ne parte nessun altro: quelli già in corso
 * finiscono (così non restano a metà) e l'errore viene rilanciato.
 */
export async function runPool(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  let failed = false;
  let failure: unknown;

  const lane = async (): Promise<void> => {
    while (!failed) {
      const index = next++;
      if (index >= tasks.length) return;

      try {
        await tasks[index]();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
        return;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), tasks.length) }, lane));

  if (failed) throw failure;
}
