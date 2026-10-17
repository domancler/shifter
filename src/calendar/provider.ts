/**
 * Strato calendario indipendente dal fornitore (oggi Google, in futuro anche Outlook).
 * Il resto dell'app parla solo con questa interfaccia.
 */

export interface RemoteEvent {
  id: string;
  etag?: string;
  updated?: string;
  summary: string;
  /** Campo "descrizione" dell'evento = nota del giorno. */
  description: string;
  allDay: boolean;
  /** Data (YYYY-MM-DD) se a giornata intera, altrimenti data e ora ISO con offset. */
  start: string;
  end: string;
  /** Marcatori applicativi (extendedProperties.private). */
  markers: Record<string, string>;
}

export interface CalendarProvider {
  readonly name: "google";
  /**
   * Eventi creati dall'app (solo quelli marcati) che interessano l'intervallo di date indicato,
   * estremi inclusi. Gli eventi senza marcatore non vengono mai restituiti.
   */
  listMarkedEvents(fromDate: string, toDate: string): Promise<RemoteEvent[]>;
}
