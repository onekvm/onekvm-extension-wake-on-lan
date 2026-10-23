# OneKVM Wake-on-LAN Extension

English | [简体中文](README.zh-CN.md)

Wake computers and other network devices from OneKVM by sending a standard UDP
Wake-on-LAN magic packet to a saved or directly entered MAC address.

> **Build note:** The component-owned OpenEmbedded layer is in
> `oe-recipes`. Release images and the fixed component
> revision are still composed by `onekvm-distro`.

## Features

- Save up to 32 devices with a display name and MAC address
- Wake any saved device with one action
- Enter a MAC address for a one-time wake without saving it
- Validate and normalize MAC addresses in the extension page
- No resident service or third-party runtime dependency

## Install and enable

The package name is `onekvm-extension-wake-on-lan`. Install it through your
OneKVM distribution package or image, then manage it with the plugin manager:

```sh
onekvm-extension enable wake-on-lan
onekvm-extension disable wake-on-lan
```

## Usage

Open the **Wake on LAN** extension page. Add a name and MAC address to the saved
device list, or use the one-time field, then select **Wake**. The controller
starts a short sandboxed action only while it sends the magic packet.

The target must support Wake-on-LAN and have it enabled in firmware and the
operating system. UDP broadcasts are normally limited to the local network;
routers and VLAN boundaries may require explicit forwarding configuration.

The console toolbox also provides a **Wake on LAN** window with the same quick-wake field and saved device list. Pin it to the toolbar for direct access.

The screen App is available when the extension is enabled. With a touch or
rotary display it sends the packet to the first saved device; use the web page
to change the saved-device order or send to a different MAC address.

## How it works

The standalone C++20 binary constructs a standard magic packet and sends it as
a UDP broadcast. Saved entries are extension settings; there is no daemon left
running between wake requests.

## License

This project is licensed under the GNU General Public License v3.0. See
[`LICENSE`](LICENSE).

The optional screen App has modular TypeScript/TSX source in
[`screen-app/src`](screen-app/src). See [`screen-app/README.md`](screen-app/README.md)
for its components and build command. JS/PAK runtime files are generated during
packaging and are not tracked in Git.
