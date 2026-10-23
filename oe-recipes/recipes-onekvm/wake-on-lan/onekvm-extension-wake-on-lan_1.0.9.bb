SUMMARY = "OneKVM Wake on LAN extension"
HOMEPAGE = "https://github.com/onekvm/onekvm-extension-wake-on-lan"
LICENSE = "GPL-3.0-only"
LIC_FILES_CHKSUM = "file://LICENSE;md5=1ebbd3e34237af26da5dc08a4e440464"
PR = "r6"

ONEKVM_COMPONENT_GIT_URI ??= "git://github.com/onekvm/onekvm-extension-wake-on-lan.git;protocol=https;branch=main"
ONEKVM_COMPONENT_SRCREV ??= ""
SRC_URI = "${ONEKVM_COMPONENT_GIT_URI}"
SRCREV = "${ONEKVM_COMPONENT_SRCREV}"

inherit cmake onekvm-extension onekvm-screen-app

ONEKVM_EXTENSION_ID = "wake-on-lan"
ONEKVM_EXTENSION_API_VERSION = "2"
ONEKVM_EXTENSION_MANIFEST_TEMPLATE = "${S}/manifest.json.in"

EXTRA_OECMAKE += " \
    -DCMAKE_INSTALL_PREFIX=${ONEKVM_EXTENSION_ROOT} \
    -DONEKVM_EXTENSION_VERSION=${PV} \
    -DONEKVM_EXTENSION_ARCH=${TARGET_ARCH} \
"

FILES:${PN} += "${ONEKVM_EXTENSION_ROOT}/screen-app"
