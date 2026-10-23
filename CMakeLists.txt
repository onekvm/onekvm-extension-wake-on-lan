cmake_minimum_required(VERSION 3.16)
project(onekvm_wake_on_lan LANGUAGES CXX)

set(ONEKVM_EXTENSION_VERSION "0.0.0-dev" CACHE STRING "Extension version")
set(ONEKVM_EXTENSION_ARCH "unknown" CACHE STRING "Target architecture")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(onekvm-wake-on-lan src/main.cpp)
target_compile_options(onekvm-wake-on-lan PRIVATE -Wall -Wextra -Wpedantic)

set(VERSION "${ONEKVM_EXTENSION_VERSION}")
set(ARCH "${ONEKVM_EXTENSION_ARCH}")
configure_file(manifest.json.in manifest.json @ONLY)

install(TARGETS onekvm-wake-on-lan RUNTIME DESTINATION bin)
install(FILES web/page.js DESTINATION web)
install(FILES web/page.js DESTINATION web RENAME tool.js)
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/manifest.json" DESTINATION .)
set(ONEKVM_SCREEN_APP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/screen-app/dist" CACHE PATH
  "Directory containing the compiled screen App")
install(FILES "${ONEKVM_SCREEN_APP_DIR}/main.vue-vapor.js"
  "${ONEKVM_SCREEN_APP_DIR}/main.vue-vapor.pak" DESTINATION screen-app)
