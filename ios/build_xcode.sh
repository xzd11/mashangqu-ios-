#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v xcodebuild >/dev/null; then
  echo 'Widget extensions require macOS with Xcode. Linux ABI builds do not include widgets.' >&2
  exit 1
fi
if ! command -v xcodegen >/dev/null; then
  echo 'Install XcodeGen from its official Homebrew package: brew install xcodegen' >&2
  exit 1
fi
mkdir -p assets/generated
for spec in 'AppIcon60x60@2x:120' 'AppIcon60x60@3x:180' 'AppIcon76x76:76' 'AppIcon76x76@2x:152' 'AppIcon83.5x83.5@2x:167'; do
  sips -z "${spec#*:}" "${spec#*:}" assets/icon.png --out "assets/generated/${spec%:*}.png" >/dev/null
done
xcodegen generate --spec project.yml
xcodebuild -project Mashangqu.xcodeproj -scheme Mashangqu -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build/xcode \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
python3 validate_widget_build.py build/xcode/Build/Products/Release-iphoneos/Mashangqu.app
mkdir -p build/widget-ipa/Payload ../deliverables
rm -rf build/widget-ipa/Payload/Mashangqu.app
cp -R build/xcode/Build/Products/Release-iphoneos/Mashangqu.app build/widget-ipa/Payload/
(cd build/widget-ipa && /usr/bin/zip -qry ../../../deliverables/Mashangqu-iOS-1.2.0-widgets-self-sign.ipa Payload)
echo 'IPA includes PlugIns/MashangquWidgets.appex. Re-sign the app AND extension with matching App Groups.'
