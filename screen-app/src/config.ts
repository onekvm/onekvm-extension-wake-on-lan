import type { AppConfig } from "@onekvm/screen-ui";

export const CONFIG: AppConfig = {
  "extension": "wake-on-lan",
  "title": "Wake on LAN",
  "icon": "src/logo.png",
  "statusMethod": "status",
  "kind": "wake",
  validateAction: state => state.configured === true ? undefined : "saveDevice",
  "actions": [
    {
      "method": "wake",
      "title": "Wake"
    }
  ]
};
