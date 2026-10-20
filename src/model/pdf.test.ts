import { describe, expect, it } from "vitest";
import { createSchedule, entryForLeave, entryForShift } from "./schedule";
import { buildPdfBlob, buildPdfBytes, pdfFileName, pdfString } from "./pdf";
import type { Schedule } from "./types";

function sample(): Schedule {
  const schedule = createSchedule("2026-11", "2026-11-02", "2026-11-29");
  schedule.days.forEach((day, i) => {
    day.entry = i % 7 === 3 ? entryForLeave("RS") : entryForShift(day.date, "15-23");
  });
  // 05.11–09.11 (a cavallo di una domenica → graffa), 20.11 isolato (solo etichetta)
  for (const i of [3, 4, 5, 6, 7, 18]) schedule.days[i].isEssential = true;
  return schedule;
}

function textOf(schedule: Schedule): string {
  return Array.from(buildPdfBytes(schedule), (byte) => String.fromCharCode(byte)).join("");
}

describe("PDF", () => {
  it("è un PDF A4 valido, con la tabella xref che punta agli oggetti giusti", () => {
    const pdf = textOf(sample());

    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/MediaBox [0 0 595.28 841.89]");

    const startxref = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");

    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) \d{5} n $/gm)];
    expect(entries.length).toBe(7);
    entries.forEach((entry, index) => {
      const offset = Number(entry[1]);
      expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });

    // la lunghezza dichiarata dello stream coincide con quella reale
    const length = Number(/\/Length (\d+) >>\nstream\n/.exec(pdf)![1]);
    const streamStart = pdf.indexOf("stream\n") + "stream\n".length;
    expect(pdf.slice(streamStart + length, streamStart + length + "\nendstream".length)).toBe("\nendstream");
    expect(pdf).toContain("/Count 1");
  });

  it("contiene titolo, nome, righe dei giorni e colori come il Word", () => {
    const pdf = textOf(sample());

    expect(pdf).toContain("(PROGRAMMATO NOVEMBRE) Tj");
    expect(pdf).toContain("(Agente Dell\x92Erba Giovanna) Tj"); // apostrofo tipografico in WinAnsi
    expect(pdf).toContain("(02.11         15-23) Tj");
    expect(pdf).toContain("(05.11         RS) Tj");

    // 5 giorni rossi (05–09.11) + 20.11 = 6 righe in rosso 980000, le altre in nero
    expect(pdf.match(/BT 0\.596 0 0 rg/g)?.length).toBe(6);
  });

  it("disegna una graffa per il gruppo da 5 giorni e 2 etichette (gruppo + giorno singolo)", () => {
    const pdf = textOf(sample());
    expect(pdf.match(/\) Tj ET/g)).not.toBeNull();
    expect(pdf.match(/\(ESIGENZA\) Tj/g)?.length).toBe(2);
    expect(pdf.match(/^S$/gm)?.length).toBe(1); // un solo tratto = una sola graffa
    expect(pdf.match(/ c$/gm)?.length).toBe(4); // quattro curve per graffa
  });

  it("senza esigenze non ci sono graffe né etichette", () => {
    const schedule = sample();
    schedule.days.forEach((day) => delete day.isEssential);
    const pdf = textOf(schedule);
    expect(pdf).not.toContain("ESIGENZA");
    expect(pdf).not.toMatch(/^S$/m);
  });

  it("gestisce i giorni vuoti", () => {
    const pdf = textOf(createSchedule("2026-12", "2026-12-07", "2026-12-13"));
    expect(pdf).toContain("(07.12) Tj"); // giorno senza turno: solo la data
    expect(pdf).toContain("PROGRAMMATO DICEMBRE");
  });

  it("protegge i caratteri speciali del PDF e converte gli accenti in WinAnsi", () => {
    expect(pdfString("a (b) \\ c")).toBe("(a \\(b\\) \\\\ c)");
    expect(pdfString("è’“”–")).toBe("(\xe8\x92\x93\x94\x96)");
    expect(pdfString("日")).toBe("(?)");
  });

  it("se le righe non entrano in una pagina continua sulla successiva, come Word", () => {
    // 8 settimane: 56 giorni + 7 righe vuote = 63 righe; la prima pagina ne contiene 40, la seconda le altre 23
    const schedule = createSchedule("2026-11", "2026-11-02", "2026-12-27");
    schedule.days.forEach((day) => { day.entry = entryForShift(day.date, "07-15"); });
    // 05.12 → 08.12: due giorni prima e due dopo il cambio pagina (la riga vuota dopo la domenica 06.12 è l'ultima della pagina 1)
    for (const date of ["2026-12-05", "2026-12-06", "2026-12-07", "2026-12-08"]) {
      schedule.days.find((day) => day.date === date)!.isEssential = true;
    }

    const pdf = textOf(schedule);
    expect(Number(/\/Count (\d+)/.exec(pdf)![1])).toBe(2);

    // tutte le righe sono presenti e nessuna sta fuori dal foglio (margine inferiore di 72pt)
    expect(pdf.match(/ 07-15\) Tj/g)?.length).toBe(56);
    const ys = [...pdf.matchAll(/ (\S+) Td \([^)]*\) Tj/g)].map((m) => Number(m[1]));
    expect(ys.every((y) => y >= 72 && y <= 841.89)).toBe(true);

    // l'esigenza è disegnata a pezzi, uno per pagina: due graffe e due etichette
    expect(pdf.match(/\(ESIGENZA\) Tj/g)?.length).toBe(2);
    expect(pdf.match(/^S$/gm)?.length).toBe(2);
  });

  it("buildPdfBlob e il nome del file", async () => {
    const schedule = sample();
    const blob = await buildPdfBlob(schedule);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(buildPdfBytes(schedule).length);
    expect(pdfFileName(schedule)).toBe("202611_Programmato.pdf");
  });

  it("è deterministico: stesso programmato, stesso file", () => {
    expect(textOf(sample())).toBe(textOf(sample()));
  });
});
