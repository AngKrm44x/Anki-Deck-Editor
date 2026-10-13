#!/usr/bin/env bash
# Membuat zip Linux dan Mac dari hasil electron-builder (release/*-unpacked).
# Perlu karena electron-builder di Linux/Windows meratakan symlink .app di zip Mac, sehingga app rusak dan ukurannya bengkak.
# Pakai: bash scripts/package-zips.sh     (RCODESIGN=/path/rcodesign untuk tanda tangan ad-hoc di Linux)
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -p "require('./package.json').version"); R=release; APP="Editor Deck Anki"
rm -rf "$R/stage"; mkdir -p "$R/stage"
if [ -d "$R/linux-unpacked" ]; then
  N="Editor-Deck-Anki-$VER-linux-x64"; D="$R/stage/$N"; mkdir -p "$D"; cp -a "$R/linux-unpacked/." "$D/"
  cp scripts/start-linux.sh "$D/start.sh"; chmod +x "$D/start.sh" "$D/anki-deck-editor"; cp scripts/README-linux.txt "$D/README.txt"
  rm -f "$R/$N.zip"; (cd "$R/stage" && zip -qry "../$N.zip" "$N"); echo "ok $N.zip"
fi
sign() {
  if [ "$(uname)" = Darwin ]; then codesign --force --deep --sign - "$1"
  elif [ -n "${RCODESIGN:-}" ]; then "$RCODESIGN" sign "$1" >/dev/null
  elif command -v rcodesign >/dev/null; then rcodesign sign "$1" >/dev/null
  else echo "  (tanpa tanda tangan ad-hoc: Mac Apple Silicon mungkin butuh: codesign --force --deep --sign - app)"; fi
}
for pair in "mac:x64" "mac-arm64:arm64"; do
  dir=${pair%%:*}; arch=${pair##*:}
  if [ -d "$R/$dir/$APP.app" ]; then
    N="Editor-Deck-Anki-$VER-mac-$arch"; D="$R/stage/$N"; mkdir -p "$D"; cp -a "$R/$dir/$APP.app" "$D/"
    sign "$D/$APP.app"; cp scripts/README-mac.txt "$D/BACA-DULU.txt"
    rm -f "$R/$N.zip"; (cd "$R/stage" && zip -qry "../$N.zip" "$N"); echo "ok $N.zip"
  fi
done
rm -rf "$R/stage"
