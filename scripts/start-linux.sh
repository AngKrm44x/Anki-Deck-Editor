#!/usr/bin/env bash
# Peluncur Linux. Memakai --no-sandbox karena zip tidak bisa menyetel SUID pada chrome-sandbox.
# Jika kamu sudah menjalankan: sudo chown root chrome-sandbox && sudo chmod 4755 chrome-sandbox
# hapus flag --no-sandbox di bawah.
cd "$(dirname "$(readlink -f "$0")")"
exec ./anki-deck-editor --no-sandbox "$@"
