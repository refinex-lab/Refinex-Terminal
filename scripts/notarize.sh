#!/bin/bash
set -e

# macOS Notarization Script for Refinex Terminal
# Usage: ./scripts/notarize.sh "path/to/Refinex Terminal.app"

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-app-bundle>"
  exit 1
fi

APP_PATH="$1"
ZIP_PATH="$APP_PATH.zip"

# Check required environment variables
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo "Error: Required environment variables not set"
  echo "Please set: APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID"
  exit 1
fi

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
  echo "Error: App bundle not found at $APP_PATH"
  exit 1
fi

echo "📦 Creating archive for notarization..."
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "🚀 Submitting for notarization..."
xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "📌 Stapling notarization ticket..."
xcrun stapler staple "$APP_PATH"

echo "✅ Verifying signature and notarization..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl -a -vvv -t install "$APP_PATH"
xcrun stapler validate "$APP_PATH"

echo "🎉 Done! App is signed and notarized."
rm "$ZIP_PATH"
