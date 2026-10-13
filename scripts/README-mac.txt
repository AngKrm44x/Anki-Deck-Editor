Editor Deck Anki - macOS

1. Ekstrak zip, seret "Editor Deck Anki.app" ke folder Applications.
2. Pertama kali buka: klik kanan aplikasi > Open > Open.
   App ini tidak ditandatangani dengan sertifikat Apple Developer (hanya ad-hoc),
   jadi macOS bisa menampilkan peringatan.
3. Jika muncul "app is damaged" / "rusak", jalankan di Terminal:
   xattr -cr "/Applications/Editor Deck Anki.app"

File: ...-mac-arm64.zip untuk Mac chip Apple (M1/M2/M3/M4), ...-mac-x64.zip untuk Mac Intel.

English: right-click > Open the first time. If macOS says the app is damaged, run the xattr command above.
