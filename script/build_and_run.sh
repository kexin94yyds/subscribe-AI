#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="MonoExpire"
BUNDLE_ID="com.monoexpire.mac"
MIN_SYSTEM_VERSION="13.0"
SERVER_PORT="41731"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SWIFT_PACKAGE_DIR="$ROOT_DIR/macos"
WEB_DIST_DIR="$ROOT_DIR/dist"
RELEASE_DIR="$ROOT_DIR/release/mac"
APP_BUNDLE="$RELEASE_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_BINARY="$APP_MACOS/$APP_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"

usage() {
  echo "usage: $0 [run|--verify|--logs|--telemetry|--debug]" >&2
}

stop_existing_app() {
  pkill -x "$APP_NAME" >/dev/null 2>&1 || true
}

wait_for_port_free() {
  for _ in {1..30}; do
    if ! lsof -nP -iTCP:"$SERVER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  echo "Port $SERVER_PORT is still in use after stopping $APP_NAME." >&2
  return 1
}

stage_app_bundle() {
  local build_binary
  build_binary="$(swift build --package-path "$SWIFT_PACKAGE_DIR" -c release --show-bin-path)/$APP_NAME"

  rm -rf "$APP_BUNDLE"
  mkdir -p "$APP_MACOS" "$APP_RESOURCES"
  cp "$build_binary" "$APP_BINARY"
  chmod +x "$APP_BINARY"
  cp -R "$WEB_DIST_DIR" "$APP_RESOURCES/dist"

  cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MIN_SYSTEM_VERSION</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST
}

build_app() {
  stop_existing_app
  wait_for_port_free
  npm run build
  swift build --package-path "$SWIFT_PACKAGE_DIR" -c release
  stage_app_bundle
}

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

verify_app() {
  open_app

  for _ in {1..40}; do
    if pgrep -x "$APP_NAME" >/dev/null && curl -fsI "http://localhost:$SERVER_PORT/" >/dev/null; then
      echo "$APP_NAME is running at http://localhost:$SERVER_PORT/"
      return 0
    fi
    sleep 0.25
  done

  echo "$APP_NAME did not become healthy at http://localhost:$SERVER_PORT/." >&2
  return 1
}

case "$MODE" in
  run)
    build_app
    open_app
    ;;
  --verify|verify)
    build_app
    verify_app
    ;;
  --logs|logs)
    build_app
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    build_app
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --debug|debug)
    build_app
    lldb -- "$APP_BINARY"
    ;;
  *)
    usage
    exit 2
    ;;
esac

