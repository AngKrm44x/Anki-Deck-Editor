import pathlib, shutil, os, re, sys
root = pathlib.Path(__file__).resolve().parent
tool = root.parent / 'tool'
src = tool / 'src'
out = root / 'app'
if out.exists(): shutil.rmtree(out)
(out / 'vendor').mkdir(parents=True)
css = (src / 'style.css').read_text()
parts = ['a_util.js', 'b_data.js', 'c_engine.js', 'd_ui.js', 'e_editor.js', 'f_dialogs.js']
js = ''.join((src / f).read_text() + '\n' for f in parts)
g = (src / 'g_io.js').read_text().replace('async function saveBlob(', 'async function saveBlobWeb(')
js += g + '\n'
js += (root / 'overlay' / 'i18n_en.js').read_text() + '\n'
js += (root / 'overlay' / 'h_desktop.js').read_text().replace('__UPDATE_URL__', os.environ.get('UPDATE_URL', ''))
js = js.replace('di browser kamu', 'di komputer kamu')
js = js.replace('Tempat ini hanya mengizinkan unduhan dengan ekstensi tertentu, dan .apkg tidak termasuk. Simpan sebagai .zip (isinya sama persis dengan .apkg). Anki di komputer biasanya bisa mengimpor .zip langsung; kalau tidak, ganti ekstensinya menjadi .apkg.', 'Simpan lewat Simpan / ekspor (Ctrl+S). Dialog simpan sistem akan muncul, dan paket Anki disimpan dengan ekstensi .apkg.')
page = (src / 'page.html').read_text().replace('Editor butuh sql.js dan JSZip dari jsDelivr. Periksa koneksi, lalu muat ulang halaman.', 'Pustaka bawaan gagal dimuat. Pasang ulang aplikasi.')
page = re.sub(r'<link rel="stylesheet" href="https://fonts[^>]*>\n?', '', page)
page = page.replace('https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-asm.js', 'vendor/sql-asm.js').replace('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'vendor/jszip.min.js')
page = re.sub(r'^<title>[^<]*</title>\n', '', page)
page = page.replace('/*CSS*/', css).replace('/*JS*/', js.replace('</script', '<\\/script'))
html = ('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'wasm-unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob: https:; media-src \'self\' data: blob: https:; font-src \'self\' data:; connect-src \'self\' blob: data:; object-src \'none\'; base-uri \'none\'">'
        '<title>Editor Deck Anki</title>'
        '<style>html,body{height:100%}body{margin:0;font:14px system-ui,"Segoe UI","Noto Sans JP",sans-serif;background:#fafaf8}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>')
(out / 'index.html').write_text(html)
shutil.copy(tool / 'node_modules/sql.js/dist/sql-asm.js', out / 'vendor/sql-asm.js')
shutil.copy(tool / 'node_modules/jszip/dist/jszip.min.js', out / 'vendor/jszip.min.js')
print('ok', len(html))
