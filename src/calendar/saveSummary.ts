import type { SaveResult } from "./saveSchedule";

function line(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** L'esito del salvataggio come righe da mostrare in colonna; le voci a zero non compaiono. */
export function describeSaveResult(result: SaveResult): string[] {
  const lines: string[] = [];

  if (result.created > 0) lines.push(line(result.created, "evento aggiunto", "eventi aggiunti"));
  if (result.updated > 0) lines.push(line(result.updated, "evento aggiornato", "eventi aggiornati"));
  if (result.deleted > 0) lines.push(line(result.deleted, "evento eliminato", "eventi eliminati"));

  return lines.length > 0 ? lines : ["Nessuna modifica: il calendario era già aggiornato."];
}
