# OneKVM Wake on LAN

English | [简体中文](README.zh-CN.md)

> **Build note:** This repository contains extension sources only. The
> extension is built and packaged by the OpenEmbedded recipes in
> `onekvm-distro`; this repository does not provide a standalone release build.

This extension stores up to 32 labelled MAC addresses and sends a standard UDP
Wake-on-LAN magic packet when the user clicks **Wake** for a device. It has no
resident process: the extension controller starts a short sandboxed action only
for the send operation. A separate one-time field can wake a MAC address without
saving it. The C++ binary has no third-party runtime dependency.
