
import type { Schedule } from "./types";

let activeSchedule: Schedule | null = null;
let wizardIndex = 0;
export type ScheduleSource = "wizard" | "import" | "calendar";

let scheduleSource: ScheduleSource = "wizard";
let scheduleSaved = false;

export function getActiveSchedule(): Schedule | null {
  return activeSchedule;
}

export function setActiveSchedule(schedule: Schedule | null): void {
  activeSchedule = schedule;

  if (schedule === null) {
    scheduleSource = "wizard";
    scheduleSaved = false;
  }
}

export function getWizardIndex(): number {
  return wizardIndex;
}

export function setWizardIndex(index: number): void {
  wizardIndex = index;
}

export function setScheduleSource(source: ScheduleSource): void {
  scheduleSource = source;
  // Backup e calendario contengono dati già salvati; solo il wizard parte da dati non salvati.
  scheduleSaved = source !== "wizard";
}

export function getScheduleSource(): ScheduleSource {
  return scheduleSource;
}

export function isScheduleSaved(): boolean {
  return scheduleSaved;
}

export function markScheduleSaved(): void {
  scheduleSaved = true;
}

export function markScheduleUnsaved(): void {
  scheduleSaved = false;
}
