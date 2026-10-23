import type { AppConfig } from "./types";

export const CONFIG: AppConfig = {
  "extension": "wake-on-lan",
  "title": "Wake on LAN",
  "glyph": "W",
  "statusMethod": "status",
  "kind": "wake",
  "actions": [
    {
      "method": "wake",
      "title": "Wake"
    }
  ]
};
