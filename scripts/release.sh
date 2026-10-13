#!/usr/bin/env bash
# Build semua: Windows (installer + portable), Linux zip, Mac zip (x64 + arm64).
# Di Linux butuh wine (+ wine32) untuk target Windows. Di Windows pakai build.bat.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install
rm -rf release
node build_app.js
npx electron-builder --win --x64
npx electron-builder --linux dir --x64
npx electron-builder --mac dir --x64 --arm64
bash scripts/package-zips.sh
ls -la release/*.exe release/*.zip
