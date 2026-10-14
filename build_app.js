// Menyusun app/index.html dari web/ + overlay/ (tanpa Python). Pakai: node build_app.js  (UPDATE_URL=https://... opsional)
const fs = require('fs'), path = require('path');
const root = __dirname, web = path.join(root, 'web'), out = path.join(root, 'app');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
const rd = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const css = rd(web, 'style.css');
let js = ['a_util.js', 'b_data.js', 'c_engine.js', 'd_ui.js', 'e_editor.js', 'f_dialogs.js', 'i_translate.js'].map(f => rd(web, f) + '\n').join('');
js += rd(web, 'g_io.js').replace('async function saveBlob(', 'async function saveBlobWeb(') + '\n';
js += rd(root, 'overlay', 'i18n_en.js') + '\n';
js += rd(root, 'overlay', 'h_desktop.js').split('__UPDATE_URL__').join(process.env.UPDATE_URL || '');
js = js.split('di browser kamu').join('di komputer kamu');
js = js.split('Tempat ini hanya mengizinkan unduhan dengan ekstensi tertentu, dan .apkg tidak termasuk. Simpan sebagai .zip (isinya sama persis dengan .apkg). Anki di komputer biasanya bisa mengimpor .zip langsung; kalau tidak, ganti ekstensinya menjadi .apkg.').join('Simpan lewat Simpan / ekspor (Ctrl+S). Dialog simpan sistem akan muncul, dan paket Anki disimpan dengan ekstensi .apkg.');
let page = rd(web, 'page.html')
  .split('Editor butuh sql.js dan JSZip dari jsDelivr. Periksa koneksi, lalu muat ulang halaman.').join('Pustaka bawaan gagal dimuat. Pasang ulang aplikasi.')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>\n?/, '')
  .split('https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-asm.js').join('vendor/sql-asm.js')
  .split('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js').join('vendor/jszip.min.js')
  .replace(/^<title>[^<]*<\/title>\n/, '');
page = page.replace('/*CSS*/', () => css).replace('/*JS*/', () => js.split('</script').join('<\\/script'));
const html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'wasm-unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob: https:; media-src \'self\' data: blob: https:; font-src \'self\' data:; connect-src \'self\' blob: data:; object-src \'none\'; base-uri \'none\'">' +
  '<title>Editor Deck Anki</title>' +
  '<style>html,body{height:100%}body{margin:0;font:14px system-ui,"Segoe UI","Noto Sans JP",sans-serif;background:#fafaf8}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>';
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(require.resolve('sql.js/dist/sql-asm.js'), path.join(out, 'vendor', 'sql-asm.js'));
fs.copyFileSync(require.resolve('jszip/dist/jszip.min.js'), path.join(out, 'vendor', 'jszip.min.js'));
console.log('app/index.html', html.length, 'bytes');
