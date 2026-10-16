
import type { Schedule } from "./types";

let activeSchedule: Schedule | null = null;
let wizardIndex = 0;
let scheduleSource: "wizard" | "import" = "wizard";
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

export function setScheduleSource(source: "wizard" | "import"): void {
  scheduleSource = source;
  scheduleSaved = source === "import";
}

export function getScheduleSource(): "wizard" | "import" {
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
