import { LEAVE_CODES, SHIFT_CODES, type Day } from "../model/types";

/** Marcatori che identificano in modo affidabile gli eventi creati dall'app. */
export const MARKER_KEYS = {
  app: "turniApp",
  schema: "turniSchema",
  day: "turniDay",
  kind: "turniKind",
  code: "turniCode",
  essential: "turniEssential",
} as const;

export const MARKER_APP = "turni-calendar";
export const MARKER_SCHEMA = "1";

export interface Markers {
  schema: string;
  day: string;
  kind: string;
  code: string;
  essential: boolean;
}

/** Restituisce i marcatori se l'evento è dell'app, altrimenti null (evento di altri: intoccabile). */
export function parseMarkers(props: Record<string, string>): Markers | null {
  if (props[MARKER_KEYS.app] !== MARKER_APP) return null;

  return {
    schema: props[MARKER_KEYS.schema] ?? "",
    day: props[MARKER_KEYS.day] ?? "",
    kind: props[MARKER_KEYS.kind] ?? "",
    code: props[MARKER_KEYS.code] ?? "",
    essential: props[MARKER_KEYS.essential] === "1",
  };
}

/** Marcatori da scrivere sull'evento di un giorno; null se il giorno è vuoto (nessun evento). */
export function buildMarkers(day: Day): Record<string, string> | null {
  if (!day.entry) return null;

  const markers: Record<string, string> = {
    [MARKER_KEYS.app]: MARKER_APP,
    [MARKER_KEYS.schema]: MARKER_SCHEMA,
    [MARKER_KEYS.day]: day.date,
    [MARKER_KEYS.kind]: day.entry.type,
    [MARKER_KEYS.code]: day.entry.code,
  };

  if (day.isEssential === true) markers[MARKER_KEYS.essential] = "1";
  return markers;
}

export function isShiftCode(code: string): code is (typeof SHIFT_CODES)[number] {
  return (SHIFT_CODES as readonly string[]).includes(code);
}

export function isLeaveCode(code: string): code is (typeof LEAVE_CODES)[number] {
  return (LEAVE_CODES as readonly string[]).includes(code);
}
