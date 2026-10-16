import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createSchedule, entryForLeave, entryForShift } from "./schedule";
import { buildDocumentXml, buildWordBlob, wordFileName } from "./word";

function sample() {
  const schedule = createSchedule("2026-11", "2026-11-02", "2026-11-29");
  const shifts = ["15-23", "07-15", "23-07", "12-18"] as const;
  schedule.days.forEach((day, i) => {
    day.entry = i === 3 ? entryForLeave("RS") : entryForShift(day.date, shifts[i % 4]);
  });
  // 05.11 → 08.11 (attraversa la domenica) è esigenza; 20.11 è esigenza singola
  for (const i of [3, 4, 5, 6, 7, 18]) schedule.days[i].isEssential = true;
  return schedule;
}

describe("export Word", () => {
  it("replica intestazione, righe, domeniche e esigenza", () => {
    const xml = buildDocumentXml(sample());
    expect(xml).toContain("PROGRAMMATO NOVEMBRE");
    expect(xml).toContain("Agente Dell’Erba Giovanna");
    expect(xml).toContain("02.11         15-23");
    expect(xml).toContain("05.11         RS");
    expect(xml.match(/rightBrace/g)?.length).toBe(1); // solo il gruppo da 5 giorni
    expect(xml).toContain('w:val="980000"');
    // 4 domeniche interne (08, 15, 22 e 29 è l'ultimo giorno → nessuna riga vuota)
    expect(xml.match(/<w:p><\/w:p>/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("produce uno zip con le parti OOXML e il nome file corretto", async () => {
    const schedule = sample();
    const blob = await buildWordBlob(schedule);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toContain("word/document.xml");
    expect(wordFileName(schedule)).toBe("202611_Programmato.docx");
  });
});
