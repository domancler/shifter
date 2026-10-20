import {
  BRACE_LINE,
  BRACE_TOP_INSET,
  BRACE_W,
  BRACE_X,
  EMU_PER_PT,
  ESSENTIAL_COLOR,
  LABEL_SIZE,
  LABEL_X,
  LINE_EMU,
  buildProgramLayout,
  spanHeightEmu,
  type LayoutBlock,
} from "./programLayout";
import type { Schedule } from "./types";

/**
 * PDF del "Programmato", identico al Word: stessa impaginazione (programLayout.ts),
 * pagina A4, Helvetica (metriche identiche ad Arial), titolo e nome centrati in grassetto 20pt,
 * una riga per giorno, esigenza in rosso con graffa e etichetta.
 *
 * Il file è scritto a mano (nessuna libreria): una pagina, due font standard non incorporati
 * (ogni lettore PDF li ha) e il disegno della graffa con curve di Bézier.
 */

// ── Pagina e posizioni (punti, misurate dall'alto della pagina) ───────────────
// Le posizioni verticali sono state misurate sul Word generato (rendering di riferimento):
// qui sono costanti perché il Word usa interlinea 1,15 per l'intestazione e 15pt esatti per il corpo.

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_LEFT = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;

const TITLE_BASELINE = 105.25;
const NAME_BASELINE = 131.7;
const BODY_FIRST_BASELINE = 180.4;
/** Distanza della linea di base dall'alto di una riga del corpo (alta 15pt). */
const BODY_BASELINE_IN_LINE = 11.94;
/** La linea di base dell'etichetta sta 5,8pt sotto il centro della graffa. */
const LABEL_BASELINE_BELOW_CENTER = 5.8;

const HEADER_SIZE = 20;
const BODY_SIZE = 11;

const LINE_PT = LINE_EMU / EMU_PER_PT;
const KAPPA = 0.5522847498; // approssimazione di un quarto di ellisse con una curva di Bézier

// ── Larghezze di Helvetica-Bold (millesimi di em), codici WinAnsi 0x20-0xFF ────

const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 556,
  556, 556, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 556, 611, 556,
  556, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 556, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 552,
  400, 549, 333, 333, 333, 576, 556, 333, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 549, 611, 611, 611, 611, 611, 556, 611, 556,
];

const WINANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function toWinAnsi(codePoint: number): number {
  if (codePoint < 0x80 || (codePoint >= 0xa0 && codePoint <= 0xff)) return codePoint;
  return WINANSI_EXTRA[codePoint] ?? 0x3f; // "?" per i caratteri non rappresentabili
}

/** Il testo come sequenza di caratteri a un byte (WinAnsi), così lunghezza in caratteri = lunghezza in byte. */
function encodeText(text: string): string {
  return Array.from(text, (char) => String.fromCharCode(toWinAnsi(char.codePointAt(0) ?? 0x3f))).join("");
}

function boldTextWidth(text: string, size: number): number {
  let total = 0;
  for (const char of encodeText(text)) {
    const code = char.charCodeAt(0);
    total += BOLD_WIDTHS[code - 0x20] ?? 556;
  }
  return (total * size) / 1000;
}

export function pdfString(text: string): string {
  return `(${encodeText(text).replace(/[\\()]/g, "\\$&")})`;
}

function num(value: number): string {
  return String(Number(value.toFixed(3)));
}

function rgb(hex: string): string {
  const channel = (start: number) => num(parseInt(hex.slice(start, start + 2), 16) / 255);
  return `${channel(0)} ${channel(2)} ${channel(4)}`;
}

const pt = (emu: number): number => emu / EMU_PER_PT;

// ── Contenuto della pagina ────────────────────────────────────────────────────

/** Coordinata Y del PDF (origine in basso) da una misura dall'alto della pagina. */
const pdfY = (fromTop: number): number => PAGE_H - fromTop;

function textOp(font: "F1" | "F2", size: number, x: number, baselineFromTop: number, text: string, color: string): string {
  return `BT ${color} rg /${font} ${size} Tf ${num(x)} ${num(pdfY(baselineFromTop))} Td ${pdfString(text)} Tj ET`;
}

/**
 * Graffa destra: stessa geometria del "rightBrace" di Word (adj1 = adj2 = 50%), con curve di Bézier.
 * (left, top) è l'angolo in alto a sinistra, tutto in punti dall'alto della pagina.
 */
function braceOps(left: number, top: number, width: number, height: number): string {
  const ss = Math.min(width, height);
  const adj2 = 50000;
  const maxAdj1 = (Math.min(100000 - adj2, adj2) / 2) * height / ss;
  const adj1 = Math.max(0, Math.min(50000, maxAdj1));
  const y1 = (ss * adj1) / 100000; // raggio verticale delle curve
  const y3 = (height * adj2) / 100000; // altezza della punta
  const y2 = y3 - y1;
  const y4 = height - y1;
  const rx = width / 2;
  const k = KAPPA;

  const P = (x: number, y: number): string => `${num(left + x)} ${num(pdfY(top + y))}`;

  return [
    `${P(0, 0)} m`,
    `${P(k * rx, 0)} ${P(rx, y1 - k * y1)} ${P(rx, y1)} c`,
    `${P(rx, y2)} l`,
    `${P(rx, y2 + k * y1)} ${P(width - k * rx, y3)} ${P(width, y3)} c`,
    `${P(width - k * rx, y3)} ${P(rx, y3 + y1 - k * y1)} ${P(rx, y3 + y1)} c`,
    `${P(rx, y4)} l`,
    `${P(rx, y4 + k * y1)} ${P(k * rx, height)} ${P(0, height)} c`,
    "S",
  ].join("\n");
}

/** Altezza dall'alto della pagina della riga `row` (0 = prima riga) di una pagina del corpo. */
function firstLineTop(page: number): number {
  return page === 0 ? BODY_FIRST_BASELINE - BODY_BASELINE_IN_LINE : MARGIN_TOP;
}

/** Quante righe da 15pt entrano in una pagina (la prima ha l'intestazione sopra). */
function rowsOnPage(page: number): number {
  return Math.floor((PAGE_H - MARGIN_BOTTOM - firstLineTop(page) + 1e-6) / LINE_PT);
}

/** Assegna ogni riga a una pagina, come fa Word quando le righe non entrano più. */
function placeLines(count: number): { page: number; row: number }[] {
  const placed: { page: number; row: number }[] = [];
  let page = 0;
  let row = 0;

  for (let index = 0; index < count; index++) {
    if (row >= rowsOnPage(page)) {
      page += 1;
      row = 0;
    }
    placed.push({ page, row });
    row += 1;
  }

  return placed;
}

/** Graffa (se braced) ed etichetta per `lines` righe che partono dalla riga `row` di una pagina. */
function blockOps(page: number, row: number, lines: number, braced: boolean): string[] {
  const lineTop = firstLineTop(page) + row * LINE_PT;
  const top = lineTop + pt(BRACE_TOP_INSET);
  const height = pt(spanHeightEmu(lines));
  const ops: string[] = [];

  if (braced) {
    ops.push(
      `q 0 0 0 RG ${num(pt(BRACE_LINE))} w`,
      braceOps(MARGIN_LEFT + pt(BRACE_X), top, pt(BRACE_W), height),
      "Q",
    );
  }

  ops.push(
    textOp("F1", LABEL_SIZE / 2, MARGIN_LEFT + pt(LABEL_X), top + height / 2 + LABEL_BASELINE_BELOW_CENTER, "ESIGENZA", "0 0 0"),
  );

  return ops;
}

/**
 * Un'esigenza a cavallo di due pagine viene disegnata a pezzi, uno per pagina.
 * Le righe vuote a inizio o fine pezzo non contano: la graffa copre solo i giorni.
 */
function blockSegments(block: LayoutBlock, placed: { page: number; row: number }[], blank: boolean[]) {
  const segments: { page: number; row: number; lines: number; days: number }[] = [];
  const byPage = new Map<number, number[]>();

  for (let index = block.startLine; index < block.startLine + block.lines; index++) {
    const indexes = byPage.get(placed[index].page) ?? [];
    indexes.push(index);
    byPage.set(placed[index].page, indexes);
  }

  for (const [page, indexes] of byPage) {
    const days = indexes.filter((index) => !blank[index]);
    if (days.length === 0) continue;

    const first = days[0];
    const last = days[days.length - 1];
    segments.push({ page, row: placed[first].row, lines: last - first + 1, days: days.length });
  }

  return segments;
}

/** Il contenuto di ogni pagina, già in operatori PDF. */
function buildPages(schedule: Schedule): string[] {
  const layout = buildProgramLayout(schedule);
  const black = "0 0 0";
  const red = rgb(ESSENTIAL_COLOR);
  const placed = placeLines(layout.lines.length);
  const pages: string[][] = [[]];

  const ensurePage = (page: number): string[] => {
    while (pages.length <= page) pages.push([]);
    return pages[page];
  };

  const center = (text: string) => (PAGE_W - boldTextWidth(text, HEADER_SIZE)) / 2;
  pages[0].push(
    textOp("F2", HEADER_SIZE, center(layout.title), TITLE_BASELINE, layout.title, black),
    textOp("F2", HEADER_SIZE, center(layout.agentName), NAME_BASELINE, layout.agentName, black),
  );

  layout.lines.forEach((line, index) => {
    if (line.blank) return;
    const { page, row } = placed[index];
    const baseline = firstLineTop(page) + row * LINE_PT + BODY_BASELINE_IN_LINE;
    ensurePage(page).push(textOp("F1", BODY_SIZE, MARGIN_LEFT, baseline, line.text, line.essential ? red : black));
  });

  const blank = layout.lines.map((line) => line.blank);
  for (const block of layout.blocks) {
    for (const segment of blockSegments(block, placed, blank)) {
      ensurePage(segment.page).push(...blockOps(segment.page, segment.row, segment.lines, segment.days >= 2));
    }
  }

  return pages.map((ops) => ops.join("\n"));
}

// ── Struttura del file ────────────────────────────────────────────────────────

function buildPdfString(schedule: Schedule): string {
  const contents = buildPages(schedule);

  // Numerazione: 1 catalogo, 2 pagine, 3-4 font, 5 info, poi (pagina, contenuto) per ogni foglio.
  const pageRef = (index: number) => 6 + index * 2;
  const kids = contents.map((_, index) => `${pageRef(index)} 0 R`).join(" ");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${contents.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Title ${pdfString(`Programmato ${schedule.period.label}`)} /Creator (Shifter) /Producer (Shifter) >>`,
  ];

  contents.forEach((content, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageRef(index) + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  // L'intestazione ha quattro byte alti: indica ai programmi che il file è binario.
  let output = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return output;
}

export function buildPdfBytes(schedule: Schedule): Uint8Array<ArrayBuffer> {
  const text = buildPdfString(schedule);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes;
}

export async function buildPdfBlob(schedule: Schedule): Promise<Blob> {
  return new Blob([buildPdfBytes(schedule)], { type: "application/pdf" });
}

/** Es. label "2026-11" → "202611_Programmato.pdf". */
export function pdfFileName(schedule: Schedule): string {
  return `${schedule.period.label.replace("-", "")}_Programmato.pdf`;
}
