/**
 * Percentuale mostrata dal wizard: i giorni già superati sul totale.
 * Alla prima giornata è 0% (non ne è ancora stata compilata nessuna) e all'ultima non è mai 100%,
 * perché quella giornata è ancora da compilare. Si tronca invece di arrotondare, così anche con
 * periodi molto lunghi 100% non compare prima del tempo.
 */
export function wizardProgressPercent(index: number, total: number): number {
  if (total <= 0) return 0;

  const done = Math.min(Math.max(index, 0), total);
  return Math.floor((done / total) * 100);
}
