import type { Translator } from "./i18n";
import type { Status } from "./types";

export function statusLabel(state: Status, t: Translator): string {
  return t(state.configured ? "canWake" : "unconfigured");
}

export function summary(state: Status, t: Translator): string {
  return t(state.configured ? "wakeConfigured" : "saveDevice");
}
