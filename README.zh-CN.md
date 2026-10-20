# OneKVM 网络唤醒扩展

[English](README.md) | 简体中文

向已保存或临时填写的 MAC 地址发送标准 UDP Wake-on-LAN 魔术包，从
OneKVM 唤醒计算机或其他网络设备。

> **构建说明：** 组件自带的 OpenEmbedded layer 位于
> `oe-recipes`。正式镜像组合与组件固定 revision 仍由
> `onekvm-distro` 管理。

## 功能

- 最多保存 32 个带名称和 MAC 地址的设备
- 一键唤醒任意已保存设备
- 临时输入 MAC 地址进行一次唤醒，无需保存
- 在扩展页面校验并规范化 MAC 地址
- 没有常驻服务，也没有第三方运行时依赖

## 安装与启用

软件包名称是 `onekvm-extension-wake-on-lan`。请通过 OneKVM 发行版的软件包
或镜像安装，然后使用插件管理器控制扩展：

```sh
onekvm-extension enable wake-on-lan
onekvm-extension disable wake-on-lan
```

## 使用

打开 **网络唤醒** 扩展页面。可以将名称和 MAC 地址添加到设备列表，也可以
使用临时输入框，然后点击 **唤醒**。控制器只在发送魔术包时启动一个短生命
周期、受沙箱限制的动作。

目标设备必须支持 Wake-on-LAN，并在固件和操作系统中启用该功能。UDP
广播通常只能到达本地网络；跨路由器或 VLAN 使用时可能需要显式配置转发。

## 实现说明

独立的 C++20 二进制文件会构造标准魔术包并通过 UDP 广播发送。设备列表
保存在扩展设置中，两次唤醒操作之间不会有后台守护进程运行。

## 许可证

本项目使用 GNU General Public License v3.0，完整条款见
[`LICENSE`](LICENSE)。

控制台工具箱也提供**网络唤醒**窗口，复用临时唤醒和已保存设备列表，可固定到工具栏。

启用扩展后，屏幕 App 也会出现。触摸或旋钮操作会唤醒已保存列表中的第一台设备；需要更换目标顺序或填写其他 MAC 地址时，请使用网页端。
