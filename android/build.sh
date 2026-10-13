#!/usr/bin/env bash
# Build APK tanpa Gradle (Debian/Ubuntu):
#   sudo apt install openjdk-17-jdk-headless aapt apksigner zipalign dalvik-exchange android-sdk-platform-23
# Pakai: bash android/build.sh        (hasil: android/out/Editor-Deck-Anki-<versi>-android.apk)
# Opsi:  KEYSTORE=/path.jks KS_PASS=... KEY_ALIAS=... untuk memakai kunci tanda tangan sendiri.
set -euo pipefail
cd "$(dirname "$0")"; ROOT=$(cd .. && pwd)
VER=$(node -p "require('$ROOT/package.json').version")
CODE=${VERSION_CODE:-1}
JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
BT=${BUILD_TOOLS:-/usr/lib/android-sdk/build-tools/debian}
DX=${DX:-$BT/dx}; [ -x "$DX" ] || DX=$(command -v dx)
KEYSTORE=${KEYSTORE:-$PWD/release.jks}; KS_PASS=${KS_PASS:-ankieditor}; KEY_ALIAS=${KEY_ALIAS:-ankieditor}
[ -f "$ROOT/app/index.html" ] || (cd "$ROOT" && node build_app.js)
rm -rf out build; mkdir -p out build/classes build/assets
cp -r "$ROOT/app/." build/assets/
rm -f build/assets/*.map
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=Editor Deck Anki" >/dev/null 2>&1
fi
javac -source 8 -target 8 -Xlint:-options -bootclasspath "$JAR" -d build/classes $(find src -name '*.java')
"$DX" --dex --output=build/classes.dex build/classes
aapt package -f -M AndroidManifest.xml -S res -A build/assets -I "$JAR" -F build/base.apk \
  --min-sdk-version 24 --target-sdk-version 33 --version-code "$CODE" --version-name "$VER"
(cd build && aapt add base.apk classes.dex >/dev/null)
zipalign -f -p 4 build/base.apk build/aligned.apk
APK="out/Editor-Deck-Anki-$VER-android.apk"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --ks-key-alias "$KEY_ALIAS" \
  --min-sdk-version 24 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "$APK" build/aligned.apk
apksigner verify --min-sdk-version 24 "$APK" && echo "OK $APK ($(du -h "$APK" | cut -f1))"
