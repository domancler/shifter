import JSZip from "jszip";
import { parseISO } from "./dates";
import type { Day, Schedule } from "./types";

/**
 * Genera il Word "Programmato" replicando il documento di riferimento:
 * A4, Arial 11, titolo e nome centrati in grassetto 20pt, una riga per giorno
 * ("GG.MM" + 9 spazi + turno/giustificativo), riga vuota dopo ogni domenica,
 * giorni di esigenza in rosso (980000) con graffa e etichetta "ESIGENZA".
 */

export const AGENT_NAME = "Agente Dell’Erba Giovanna";

const MONTHS = [
  "GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
  "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE",
];

const ESSENTIAL_COLOR = "980000";
const DATE_GAP = " ".repeat(9);
const TITLE_PREFIX = " ".repeat(7);

// Altezza di una riga: Arial 11pt, interlinea 1,15 (≈ 14,6pt) in EMU.
const LINE_EMU = 185420;
const BRACE_X = 1104900;
const BRACE_W = 400000;
const BRACE_LINE = 76200;
const LABEL_X = BRACE_X + BRACE_W + 60000;
const LABEL_W = 1100000;

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function run(text: string, rPr = ""): string {
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function paragraph(inner = "", pPr = ""): string {
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${inner}</w:p>`;
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

interface Block {
  /** Indice del paragrafo (dopo l'intestazione) a cui ancorare la graffa. */
  startLine: number;
  /** Numero di righe coperte, comprese le righe vuote tra le settimane. */
  lines: number;
}

function brace(id: number, lines: number): string {
  const height = Math.round(lines * LINE_EMU);
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${id}" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${BRACE_X}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${BRACE_W}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Graffa ${id}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${BRACE_W}" cy="${height}"/></a:xfrm><a:prstGeom prst="rightBrace"><a:avLst><a:gd name="adj1" fmla="val 50000"/><a:gd name="adj2" fmla="val 50000"/></a:avLst></a:prstGeom><a:noFill/><a:ln w="${BRACE_LINE}" cap="flat"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:prstDash val="solid"/></a:ln></wps:spPr><wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

function label(id: number, lines: number): string {
  const height = Math.round(lines * LINE_EMU);
  const text = paragraph(run("ESIGENZA", '<w:color w:val="000000"/>'), '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>');
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${LABEL_X}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${LABEL_W}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Etichetta ${id}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LABEL_W}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent>${text}</w:txbxContent></wps:txbx><wps:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

export function buildDocumentXml(schedule: Schedule): string {
  const monthIndex = Number(schedule.period.label.split("-")[1]) - 1;
  const monthName = MONTHS[monthIndex] ?? "";

  const header = [
    paragraph(),
    paragraph(
      run(TITLE_PREFIX, '<w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/>') +
        run(`PROGRAMMATO ${monthName}`, '<w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/>'),
      '<w:jc w:val="center"/>',
    ),
    paragraph(
      run(AGENT_NAME, '<w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/>'),
      '<w:jc w:val="center"/>',
    ),
    paragraph(),
    paragraph(),
  ];

  // Righe del corpo: giorni e righe vuote dopo le domeniche.
  interface Line { day: Day | null; essential: boolean }
  const lines: Line[] = [];
  schedule.days.forEach((day, index) => {
    lines.push({ day, essential: day.isEssential === true });
    const isLast = index === schedule.days.length - 1;
    if (isSunday(day.date) && !isLast) {
      // La riga vuota è rossa se il giorno prima e quello dopo sono esigenza.
      const next = schedule.days[index + 1];
      lines.push({ day: null, essential: day.isEssential === true && next.isEssential === true });
    }
  });

  // Gruppi consecutivi di esigenza da almeno 2 giorni ricevono la graffa.
  const blocks: Block[] = [];
  let start = -1;
  const close = (end: number): void => {
    const count = lines.slice(start, end).filter((line) => line.day !== null).length;
    if (start >= 0 && count >= 2) blocks.push({ startLine: start, lines: end - start });
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

  let drawingId = 1;
  const body = lines.map((line, index) => {
    const rPr = line.essential ? `<w:color w:val="${ESSENTIAL_COLOR}"/>` : "";
    if (!line.day) return paragraph("", rPr ? `<w:rPr>${rPr}</w:rPr>` : "");
    let inner = run(formatDay(line.day), rPr);
    const block = blocks.find((candidate) => candidate.startLine === index);
    if (block) {
      inner += brace(drawingId++, block.lines) + label(drawingId++, block.lines);
    }
    return paragraph(inner);
  });

  const sectPr =
    '<w:sectPr><w:pgSz w:w="11909" w:h="16834"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document ${NS}><w:body>${[...header, ...body].join("")}${sectPr}</w:body></w:document>`
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr>' +
  '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>' +
  '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  "</w:styles>";

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const DOCUMENT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

export async function buildWordBlob(schedule: Schedule): Promise<Blob> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", ROOT_RELS_XML);
  zip.file("word/document.xml", buildDocumentXml(schedule));
  zip.file("word/styles.xml", STYLES_XML);
  zip.file("word/_rels/document.xml.rels", DOCUMENT_RELS_XML);
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}

/** Es. label "2026-11" → "202611_Programmato.docx". */
export function wordFileName(schedule: Schedule): string {
  return `${schedule.period.label.replace("-", "")}_Programmato.docx`;
}
