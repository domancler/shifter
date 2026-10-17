import { addDays } from "../model/dates";
import type { Day, Schedule } from "../model/types";
import { buildMarkers, MARKER_KEYS } from "./markers";
import { googleFetch, GoogleApiError } from "./googleClient";
import { GoogleCalendarProvider } from "./googleProvider";
import type { RemoteEvent } from "./provider";

interface GoogleEventResource {
    id?: string;
    etag?: string;
    updated?: string;
    summary: string;
    description: string;
    start: {
        date?: string;
        dateTime?: string;
        timeZone?: string;
    };
    end: {
        date?: string;
        dateTime?: string;
        timeZone?: string;
    };
    extendedProperties: {
        private: Record<string, string>;
    };
}

interface SaveResult {
    created: number;
    updated: number;
    deleted: number;
}

interface PendingUpdate {
    day: Day;
    event: RemoteEvent;
    description: string;
}

interface PreservedNote {
    sourceId: string;
    content: string;
    priority: number;
}

const NOTE_HEADER =
    /^--- Nota conservata dall'evento Google Calendar \(ID: ([^)]+)\) ---\n/gm;

function eventIdForDay(date: string): string {
    return `shifter${date.replace(/-/g, "")}`;
}

export async function saveScheduleToGoogle(
    schedule: Schedule,
): Promise<SaveResult | null> {
    const provider = new GoogleCalendarProvider();

    // Legge esclusivamente gli eventi contrassegnati come Shifter.
    const events = await provider.listMarkedEvents(
        schedule.period.start,
        schedule.period.end,
    );

    const eventsByDay = new Map<string, RemoteEvent[]>();

    for (const event of events) {
        const day = event.markers[MARKER_KEYS.day];

        if (
            !day ||
            day < schedule.period.start ||
            day > schedule.period.end
        ) {
            continue;
        }

        const matches = eventsByDay.get(day) ?? [];
        matches.push(event);
        eventsByDay.set(day, matches);
    }

    const updates: PendingUpdate[] = [];
    const creations: Day[] = [];
    const deletions = new Map<string, RemoteEvent>();

    for (const day of schedule.days) {
        const matches = [...(eventsByDay.get(day.date) ?? [])];

        if (!day.entry) {
            // Non eliminare eventi vuoti di turno che contengono note:
            // senza un nuovo evento perderemmo il posto in cui conservarle.
            const withNotes = matches.filter(
                (event) => event.description.trim().length > 0,
            );

            if (withNotes.length > 0) {
                throw new Error(
                    `Il giorno ${day.date} è senza turno o giustificativo, ` +
                    "ma esistono eventi Shifter con note. Completa il giorno " +
                    "prima di salvare, per evitare di perdere informazioni.",
                );
            }

            for (const event of matches) {
                deletions.set(event.id, event);
            }

            continue;
        }

        // Mantiene come principale l'evento già associato alla giornata,
        // quando il suo ID è ancora presente tra gli eventi trovati.
        const preferredIndex = day.calendarRef
            ? matches.findIndex(
                (event) => event.id === day.calendarRef?.eventId,
            )
            : -1;

        const selectedIndex = preferredIndex >= 0 ? preferredIndex : 0;
        const existing = matches.splice(selectedIndex, 1)[0];

        if (existing) {
            updates.push({
                day,
                event: existing,
                description: mergeDescriptions(day.note, [
                    existing,
                    ...matches,
                ]),
            });
        } else {
            creations.push(day);
        }

        // I duplicati sono eliminati solo dopo aver trasferito le note
        // nell'evento principale ed eseguito tutte le altre scritture.
        for (const duplicate of matches) {
            deletions.set(duplicate.id, duplicate);
        }
    }

    if (
        updates.length === 0 &&
        creations.length === 0 &&
        deletions.size === 0
    ) {
        return { created: 0, updated: 0, deleted: 0 };
    }

    const confirmed = window.confirm(
        [
            `Salvare il programmato ${schedule.period.label} su Google Calendar?`,
            "",
            `Nuovi eventi: ${creations.length}`,
            `Eventi da aggiornare: ${updates.length}`,
            `Eventi da rimuovere: ${deletions.size}`,
            "",
            "Saranno modificati esclusivamente gli eventi riconosciuti come creati da Shifter.",
            "Le note degli eventuali duplicati saranno conservate nell'evento principale.",
        ].join("\n"),
    );

    if (!confirmed) return null;

    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Prima aggiorna gli eventi esistenti, conservando i riferimenti.
    for (const item of updates) {
        const { day, event, description } = item;

        const response = await googleFetch<GoogleEventResource>(
            `/calendars/primary/events/${encodeURIComponent(event.id)}`,
            {
                method: "PATCH",
                headers: event.etag
                    ? { "If-Match": event.etag }
                    : {},
                body: JSON.stringify(eventBody(day, description)),
            },
        );

        day.calendarRef = {
            provider: "google",
            eventId: response.id ?? event.id,
            ...(response.etag ? { etag: response.etag } : {}),
            ...(response.updated ? { updated: response.updated } : {}),
        };

        updated++;
    }


    for (const day of creations) {
        const eventId = eventIdForDay(day.date);
        let response: GoogleEventResource;
        let recovered = false;

        try {
            response = await googleFetch<GoogleEventResource>(
                "/calendars/primary/events",
                {
                    method: "POST",
                    body: JSON.stringify(
                        eventBody(day, day.note, eventId),
                    ),
                },
            );
        } catch (error) {
            if (!(error instanceof GoogleApiError && error.status === 409)) {
                throw error;
            }

            const existing = await provider.getEventById(eventId);

            const isExpectedEvent =
                existing !== null &&
                existing.markers[MARKER_KEYS.app] === "turni-calendar" &&
                existing.markers[MARKER_KEYS.day] === day.date &&
                existing.markers[MARKER_KEYS.kind] === day.entry?.type &&
                existing.markers[MARKER_KEYS.code] === day.entry?.code;

            if (!existing || !isExpectedEvent) {
                throw new Error(
                    `Esiste già un evento con l'ID previsto per il ${day.date}, ` +
                    "ma i suoi marcatori non corrispondono al turno atteso. " +
                    "Non è stato modificato.",
                );
            }


            if (!existing.etag) {
                throw new Error(
                    `Impossibile recuperare in sicurezza l'evento del ${day.date}: ` +
                    "Google non ha restituito l'etag. Nessuna modifica eseguita.",
                );
            }

            const description = mergeDescriptions(day.note, [existing]);

            response = await googleFetch<GoogleEventResource>(
                `/calendars/primary/events/${encodeURIComponent(existing.id)}`,
                {
                    method: "PATCH",
                    headers: {
                        "If-Match": existing.etag,
                    },
                    body: JSON.stringify(
                        eventBody(day, description),
                    ),
                },
            );

            recovered = true;

        }

        if (!response.id) {
            throw new Error(
                `Google non ha restituito l'ID dell'evento del ${day.date}.`,
            );
        }

        day.calendarRef = {
            provider: "google",
            eventId: response.id,
            ...(response.etag ? { etag: response.etag } : {}),
            ...(response.updated ? { updated: response.updated } : {}),
        };

        if (recovered) {
            updated++;
        } else {
            created++;
        }
    }


    // Solo dopo aver completato aggiornamenti e creazioni,
    // elimina gli eventi Shifter che sono stati sostituiti.
    for (const event of deletions.values()) {
        await googleFetch<void>(
            `/calendars/primary/events/${encodeURIComponent(event.id)}`,
            {
                method: "DELETE",
                headers: event.etag
                    ? { "If-Match": event.etag }
                    : {},
            },
        );

        deleted++;
    }

    // Pulisce i riferimenti locali delle giornate vuote.
    for (const day of schedule.days) {
        if (!day.entry) {
            delete day.calendarRef;
        }
    }

    return { created, updated, deleted };
}

/**
 * Unisce la nota del programma con le descrizioni degli eventi.
 * Le note recuperate vengono identificate dall'ID sorgente,
 * per non duplicarle se un salvataggio viene ripetuto.
 */
function mergeDescriptions(
    scheduleNote: string,
    events: RemoteEvent[],
): string {
    const notes = new Map<string, PreservedNote>();

    for (const event of events) {
        const description = event.description.trim();

        if (!description) continue;

        const extracted = extractPreservedNotes(description, event.id);

        for (const note of extracted) {
            const current = notes.get(note.sourceId);

            if (!current || note.priority > current.priority) {
                notes.set(note.sourceId, note);
            }
        }
    }

    const sections: string[] = [];
    const seenContents = new Set<string>();
    const baseNote = scheduleNote.trim();

    if (baseNote) {
        sections.push(baseNote);
        seenContents.add(baseNote);
    }

    for (const note of notes.values()) {
        const content = note.content.trim();

        if (!content || seenContents.has(content)) continue;

        sections.push(
            `--- Nota conservata dall'evento Google Calendar (ID: ${note.sourceId}) ---\n${content}`,
        );

        seenContents.add(content);
    }

    return sections.join("\n\n");
}

/**
 * Se la descrizione è già stata generata da Shifter, estrae le
 * sezioni esistenti. Altrimenti considera tutto il testo come
 * la nota originale dell'evento.
 */
function extractPreservedNotes(
    description: string,
    eventId: string,
): PreservedNote[] {
    const matches = [...description.matchAll(NOTE_HEADER)];

    if (matches.length === 0) {
        return [{
            sourceId: eventId,
            content: description.trim(),
            priority: 2,
        }];
    }

    const notes: PreservedNote[] = [];

    for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const sourceId = match[1];
        const contentStart = (match.index ?? 0) + match[0].length;
        const nextStart = matches[index + 1]?.index ?? description.length;
        const content = description.slice(contentStart, nextStart).trim();

        if (sourceId && content) {
            notes.push({
                sourceId,
                content,
                priority: 1,
            });
        }
    }

    return notes;
}

function eventBody(
    day: Day,
    description: string,
    eventId?: string,
): GoogleEventResource {
    if (!day.entry) {
        throw new Error(
            `Impossibile creare un evento per il giorno vuoto ${day.date}.`,
        );
    }

    const markers = buildMarkers(day);

    if (!markers) {
        throw new Error(
            `Impossibile generare i marcatori Shifter per ${day.date}.`,
        );
    }

    // Scrive esplicitamente il valore per evitare di mantenere
    // un vecchio marcatore Esigenza attivo.
    markers[MARKER_KEYS.essential] =
        day.isEssential === true ? "1" : "0";

    const common = {
        ...(eventId ? { id: eventId } : {}),
        summary: day.entry.code,
        description,
        extendedProperties: {
            private: markers,
        },
    };

    if (day.entry.type === "leave") {
        return {
            ...common,
            start: { date: day.date },
            end: { date: addDays(day.date, 1) },
        };
    }

    return {
        ...common,
        start: {
            dateTime: day.entry.start,
            timeZone: "Europe/Rome",
        },
        end: {
            dateTime: day.entry.end,
            timeZone: "Europe/Rome",
        },
    };
}