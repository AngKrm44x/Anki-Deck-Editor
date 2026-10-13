Editor Deck Anki - Linux (x64)

1. Ekstrak zip ini.
2. Jalankan:  ./start.sh
   (jika belum bisa dieksekusi: chmod +x start.sh anki-deck-editor)
3. Opsional: bisa membuka file langsung:  ./start.sh deck.apkg

Catatan: butuh libgtk-3, libnss3, libasound2 (sudah ada di kebanyakan desktop Linux).

English: extract, then run ./start.sh. The launcher passes --no-sandbox because a zip cannot set the SUID bit on chrome-sandbox.
