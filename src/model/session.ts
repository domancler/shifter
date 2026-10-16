import type { Schedule } from "./types";

let activeSchedule: Schedule | null = null;
let wizardIndex = 0;

export function getActiveSchedule(): Schedule | null { return activeSchedule; }
export function setActiveSchedule(schedule: Schedule | null): void { activeSchedule = schedule; }
export function getWizardIndex(): number { return wizardIndex; }
export function setWizardIndex(index: number): void { wizardIndex = index; }
