# OpenEmbedded layer

This layer packages the Wake-on-LAN extension for OneKVM. It supports the
`wrynose` release and depends on OE-Core plus the distro-owned `onekvm` layer,
which provides `onekvm-extension.bbclass`.

The integrating distro must set `ONEKVM_COMPONENT_SRCREV` to the same fixed
component commit that supplies this layer. OneKVM release builds derive that
value from the distro component lock instead of storing a self-referential
commit in this recipe.
