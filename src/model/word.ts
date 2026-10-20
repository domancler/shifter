import JSZip from "jszip";
import {
  AGENT_NAME,
  BRACE_LINE,
  BRACE_TOP_INSET,
  BRACE_W,
  BRACE_X,
  ESSENTIAL_COLOR,
  LABEL_SIZE,
  LABEL_W,
  LABEL_X,
  LINE_EMU,
  LINE_TWIPS,
  buildProgramLayout,
  spanHeightEmu as spanHeight,
} from "./programLayout";
import type { Schedule } from "./types";

/**
 * Genera il Word "Programmato" replicando il documento di riferimento:
 * A4, Arial 11, titolo e nome centrati in grassetto 20pt, una riga per giorno
 * ("GG.MM" + 9 spazi + turno/giustificativo), riga vuota dopo ogni domenica,
 * giorni di esigenza in rosso (980000) con graffa e etichetta "ESIGENZA".
 * Dati e misure vengono da programLayout.ts, condiviso con il PDF.
 */

export { AGENT_NAME };

const BODY_PPR = `<w:spacing w:before="0" w:after="0" w:line="${LINE_TWIPS}" w:lineRule="exact"/>`;

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

function brace(id: number, lines: number): string {
  const height = spanHeight(lines);
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${id}" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${BRACE_X}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${BRACE_TOP_INSET}</wp:posOffset></wp:positionV><wp:extent cx="${BRACE_W}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Graffa ${id}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${BRACE_W}" cy="${height}"/></a:xfrm><a:prstGeom prst="rightBrace"><a:avLst><a:gd name="adj1" fmla="val 50000"/><a:gd name="adj2" fmla="val 50000"/></a:avLst></a:prstGeom><a:noFill/><a:ln w="${BRACE_LINE}" cap="flat"><a:solidFill><a:srgbClr val="000000"/></a:solidFill><a:prstDash val="solid"/></a:ln></wps:spPr><wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

function label(id: number, lines: number, braced: boolean): string {
  // Con la graffa l'etichetta è centrata sulla graffa; in ogni caso parte sempre dalla stessa X, così sono tutte allineate. Da sola, usa una casella
  // alta due righe centrata sul rosso della riga, così il testo da 16pt non viene tagliato.
  const spanH = spanHeight(lines);
  const height = braced ? spanH : 2 * LINE_EMU;
  const top = braced ? BRACE_TOP_INSET : Math.round(BRACE_TOP_INSET + spanH / 2 - height / 2);
  const labelSize = `<w:sz w:val="${LABEL_SIZE}"/><w:szCs w:val="${LABEL_SIZE}"/>`;
  const text = paragraph(run("ESIGENZA", `<w:color w:val="000000"/>${labelSize}`), '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>');
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>${LABEL_X}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${top}</wp:posOffset></wp:positionV><wp:extent cx="${LABEL_W}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Etichetta ${id}"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LABEL_W}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></wps:spPr><wps:txbx><w:txbxContent>${text}</w:txbxContent></wps:txbx><wps:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}

export function buildDocumentXml(schedule: Schedule): string {
  const layout = buildProgramLayout(schedule);

  const header = [
    paragraph(),
    paragraph(
      run(layout.title, '<w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/>'),
      '<w:jc w:val="center"/>',
    ),
    paragraph(
      run(layout.agentName, '<w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/>'),
      '<w:jc w:val="center"/>',
    ),
    paragraph(),
    paragraph(),
  ];

  let drawingId = 1;
  const body = layout.lines.map((line, index) => {
    const rPr = line.essential ? `<w:color w:val="${ESSENTIAL_COLOR}"/>` : "";
    if (line.blank) return paragraph("", BODY_PPR + (rPr ? `<w:rPr>${rPr}</w:rPr>` : ""));
    let inner = run(line.text, rPr);
    const block = layout.blocks.find((candidate) => candidate.startLine === index);
    if (block) {
      if (block.braced) inner += brace(drawingId++, block.lines);
      inner += label(drawingId++, block.lines, block.braced);
    }
    return paragraph(inner, BODY_PPR);
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
