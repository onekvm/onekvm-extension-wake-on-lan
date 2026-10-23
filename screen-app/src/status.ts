import type { Status, Translator } from "@onekvm/screen-ui";

export function statusLabel(state: Status, t: Translator): string {
  return t(state.configured ? "canWake" : "unconfigured");
}

export function summary(state: Status, t: Translator): string {
  return t(state.configured ? "wakeConfigured" : "saveDevice");
}
