import { parseISO } from "./dates";
import type { Day, Schedule } from "./types";

/**
 * Impaginazione del "Programmato", condivisa da Word e PDF: i due documenti partono
 * dagli stessi dati e dalle stesse misure, quindi non possono divergere.
 * Le misure geometriche sono in EMU (1pt = 12700 EMU, come nei file Word).
 */

export const AGENT_NAME = "Agente Dell’Erba Giovanna";

export const MONTHS = [
  "GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
  "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE",
];

export const ESSENTIAL_COLOR = "980000";
export const DATE_GAP = " ".repeat(9);

export const EMU_PER_PT = 12700;

// Interlinea FISSA (15pt) per le righe del corpo: così l'altezza di ogni riga è
// identica in Word, LibreOffice e app mobili, e la graffa può essere precisa.
export const LINE_TWIPS = 300;
export const LINE_EMU = LINE_TWIPS * 635;
// Il rosso (testo Arial 11pt) occupa solo una parte della riga da 15pt:
// la graffa parte dalla cima delle cifre e finisce alla loro base.
export const BRACE_TOP_INSET = 63500;    // 5pt dall'alto della prima riga
export const BRACE_BOTTOM_INSET = 48260; // 3,8pt dal fondo dell'ultima riga
export const BRACE_X = 1104900;
export const BRACE_W = 400000;
export const BRACE_LINE = 19050;         // spessore 1,5pt
export const LABEL_X = BRACE_X + BRACE_W + 60000;
export const LABEL_W = 1600000;
export const LABEL_SIZE = 32;            // mezzi punti: 32 = 16pt

export interface LayoutLine {
  /** Testo della riga ("GG.MM" + spazi + turno); vuoto per la riga dopo una domenica. */
  text: string;
  /** true per le righe vuote inserite dopo le domeniche. */
  blank: boolean;
  essential: boolean;
}

export interface LayoutBlock {
  /** Indice della riga (nel corpo) a cui ancorare la graffa. */
  startLine: number;
  /** Numero di righe coperte, comprese le righe vuote tra le settimane. */
  lines: number;
  /** true se ci sono almeno 2 giorni: graffa + etichetta; altrimenti solo etichetta. */
  braced: boolean;
}

export interface ProgramLayout {
  title: string;
  agentName: string;
  lines: LayoutLine[];
  blocks: LayoutBlock[];
}

function formatDay(day: Day): string {
  const [, month, dayOfMonth] = day.date.split("-");
  const value = day.entry ? day.entry.code : "";
  const date = `${dayOfMonth}.${month}`;
  return value ? `${date}${DATE_GAP}${value}` : date;
}

function isSunday(iso: string): boolean {
  return parseISO(iso).getUTCDay() === 0;
}

/** Altezza (EMU) della graffa e della sua etichetta per un gruppo di righe. */
export function spanHeightEmu(lines: number): number {
  return Math.round(lines * LINE_EMU - BRACE_TOP_INSET - BRACE_BOTTOM_INSET);
}

export function buildProgramLayout(schedule: Schedule): ProgramLayout {
  const monthIndex = Number(schedule.period.label.split("-")[1]) - 1;
  const monthName = MONTHS[monthIndex] ?? "";

  // Righe del corpo: giorni e righe vuote dopo le domeniche.
  const lines: LayoutLine[] = [];
  schedule.days.forEach((day, index) => {
    lines.push({ text: formatDay(day), blank: false, essential: day.isEssential === true });
    const isLast = index === schedule.days.length - 1;
    if (isSunday(day.date) && !isLast) {
      // La riga vuota è rossa se il giorno prima e quello dopo sono esigenza.
      const next = schedule.days[index + 1];
      lines.push({ text: "", blank: true, essential: day.isEssential === true && next.isEssential === true });
    }
  });

  // Gruppi consecutivi di esigenza: da 2 giorni in su graffa + etichetta,
  // un giorno solo → solo etichetta accanto.
  const blocks: LayoutBlock[] = [];
  let start = -1;
  const close = (end: number): void => {
    const count = lines.slice(start, end).filter((line) => !line.blank).length;
    if (start >= 0 && count >= 1) blocks.push({ startLine: start, lines: end - start, braced: count >= 2 });
    start = -1;
  };
  lines.forEach((line, index) => {
    if (line.essential) {
      if (start < 0) start = index;
    } else if (start >= 0) {
      close(index);
    }
  });
  if (start >= 0) close(lines.length);

  return {
    title: `PROGRAMMATO ${monthName}`,
    agentName: AGENT_NAME,
    lines,
    blocks,
  };
}
