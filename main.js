'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');

const OPEN_EXT = /\.(apkg|colpkg|zip|csv|tsv|txt)$/i;
let win = null;
let rendererReady = false;
const pendingOpen = [];

/* ---------- config (bahasa) ---------- */
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
function readCfg() { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch (e) { return {}; } }
function writeCfg(c) { try { fs.mkdirSync(path.dirname(cfgPath()), { recursive: true }); fs.writeFileSync(cfgPath(), JSON.stringify(c, null, 2)); } catch (e) { } }
let LANG = 'en';
function initLang() {
  const c = readCfg();
  LANG = (c.lang === 'id' || c.lang === 'en') ? c.lang : ((app.getLocale() || '').toLowerCase().startsWith('id') ? 'id' : 'en');
}

/* ---------- teks native ---------- */
const TXT = {
  id: { file: 'Berkas', open: 'Buka…', new: 'Koleksi baru', import: 'Impor CSV/TXT…', save: 'Simpan / ekspor…', quit: 'Keluar', edit: 'Sunting', undoApp: 'Urungkan (editor)', redoApp: 'Ulangi (editor)', cut: 'Potong', copy: 'Salin', paste: 'Tempel', selectAll: 'Pilih semua', find: 'Cari & ganti…', view: 'Tampilan', theme: 'Ganti tema', zoomIn: 'Perbesar', zoomOut: 'Perkecil', zoomReset: 'Ukuran asli', fullscreen: 'Layar penuh', lang: 'Bahasa', help: 'Bantuan', helpItem: 'Bantuan & pintasan', changelog: 'Changelog', update: 'Cek pembaruan…', about: 'Tentang Editor Deck Anki', dirtyTitle: 'Perubahan belum disimpan', dirtyMsg: 'Ada perubahan yang belum disimpan. Tutup aplikasi dan buang perubahan itu?', leave: 'Tutup & buang', stay: 'Kembali', saveTitle: 'Simpan file', allFiles: 'Semua file', openTitle: 'Buka file' },
  en: { file: 'File', open: 'Open…', new: 'New collection', import: 'Import CSV/TXT…', save: 'Save / export…', quit: 'Quit', edit: 'Edit', undoApp: 'Undo (editor)', redoApp: 'Redo (editor)', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select all', find: 'Find & replace…', view: 'View', theme: 'Change theme', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Actual size', fullscreen: 'Full screen', lang: 'Language', help: 'Help', helpItem: 'Help & shortcuts', changelog: 'Changelog', update: 'Check for updates…', about: 'About Anki Deck Editor', dirtyTitle: 'Unsaved changes', dirtyMsg: 'There are unsaved changes. Close the app and discard them?', leave: 'Close & discard', stay: 'Go back', saveTitle: 'Save file', allFiles: 'All files', openTitle: 'Open file' }
};
const T = k => TXT[LANG][k];
const send = (ch, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); };
const act = id => () => send('menu', id);

function buildMenu() {
  const mac = process.platform === 'darwin';
  const tpl = [];
  if (mac) tpl.push({ label: app.name, submenu: [{ label: T('about'), click: act('about') }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit', label: T('quit') }] });
  tpl.push({ label: T('file'), submenu: [
    { label: T('open'), accelerator: 'CmdOrCtrl+O', click: act('open') },
    { label: T('new'), click: act('new') },
    { label: T('import'), click: act('import') },
    { type: 'separator' },
    { label: T('save'), accelerator: 'CmdOrCtrl+S', click: act('save') },
    ...(mac ? [] : [{ type: 'separator' }, { role: 'quit', label: T('quit') }])
  ] });
  tpl.push({ label: T('edit'), submenu: [
    { label: T('undoApp'), click: act('undo') },
    { label: T('redoApp'), click: act('redo') },
    { type: 'separator' },
    { role: 'cut', label: T('cut') }, { role: 'copy', label: T('copy') }, { role: 'paste', label: T('paste') }, { role: 'selectAll', label: T('selectAll') },
    { type: 'separator' },
    { label: T('find'), click: act('find') }
  ] });
  tpl.push({ label: T('view'), submenu: [
    { label: T('theme'), click: act('theme') },
    { type: 'separator' },
    { role: 'zoomIn', label: T('zoomIn') }, { role: 'zoomOut', label: T('zoomOut') }, { role: 'resetZoom', label: T('zoomReset') },
    { type: 'separator' },
    { role: 'togglefullscreen', label: T('fullscreen') },
    ...(process.env.ADE_DEBUG ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : [])
  ] });
  tpl.push({ label: T('lang'), submenu: [
    { label: 'Bahasa Indonesia', type: 'radio', checked: LANG === 'id', click: act('lang-id') },
    { label: 'English', type: 'radio', checked: LANG === 'en', click: act('lang-en') }
  ] });
  tpl.push({ label: T('help'), submenu: [
    { label: T('helpItem'), accelerator: 'F1', click: act('help') },
    { label: T('changelog'), click: act('changelog') },
    { label: T('update'), click: act('update') },
    ...(mac ? [] : [{ type: 'separator' }, { label: T('about'), click: act('about') }])
  ] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

/* ---------- jendela ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 420, minHeight: 520, show: false,
    title: 'Editor Deck Anki', backgroundColor: '#fafaf8', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false }
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url); } });
  win.webContents.on('will-prevent-unload', e => {
    const r = dialog.showMessageBoxSync(win, { type: 'warning', buttons: [T('leave'), T('stay')], defaultId: 1, cancelId: 1, title: T('dirtyTitle'), message: T('dirtyMsg') });
    if (r === 0) e.preventDefault();
  });
  win.on('closed', () => { win = null; rendererReady = false; });
}

function queueOpen(p) {
  if (!p || !OPEN_EXT.test(p) || !fs.existsSync(p)) return;
  if (win && rendererReady) deliverOpen(p); else pendingOpen.push(p);
}
function deliverOpen(p) {
  try { const buf = fs.readFileSync(p); send('open-file', { name: path.basename(p), data: new Uint8Array(buf) }); } catch (e) { }
}
const argFiles = argv => argv.slice(1).filter(a => !a.startsWith('-') && OPEN_EXT.test(a));

/* ---------- IPC ---------- */
ipcMain.on('get-lang', e => { e.returnValue = LANG; });
ipcMain.on('get-info', e => { e.returnValue = { version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform, arch: process.arch, portable: !!process.env.PORTABLE_EXECUTABLE_DIR }; });
ipcMain.handle('set-lang', (_e, l) => { if (l === 'id' || l === 'en') { LANG = l; const c = readCfg(); c.lang = l; writeCfg(c); buildMenu(); } return LANG; });
ipcMain.handle('ready', () => { rendererReady = true; while (pendingOpen.length) deliverOpen(pendingOpen.shift()); return true; });
ipcMain.handle('save-file', async (_e, name, data) => {
  const safe = String(name || 'deck').replace(/[\\/:*?"<>|]+/g, '_');
  const ext = path.extname(safe).replace('.', '');
  const last = readCfg().lastDir; let dir = app.getPath('documents'); try { if (last && fs.statSync(last).isDirectory()) dir = last; } catch (e) { }
  const r = await dialog.showSaveDialog(win, { title: T('saveTitle'), defaultPath: path.join(dir, safe), filters: [...(ext ? [{ name: '.' + ext, extensions: [ext] }] : []), { name: T('allFiles'), extensions: ['*'] }] });
  if (r.canceled || !r.filePath) return { status: 'declined' };
  fs.writeFileSync(r.filePath, Buffer.from(data));
  const c = readCfg(); c.lastDir = path.dirname(r.filePath); writeCfg(c);
  return { status: 'saved', path: r.filePath };
});
ipcMain.handle('check-update', async (_e, url) => {
  try {
    if (!/^https:\/\//i.test(String(url))) return { ok: false, error: 'URL harus diawali https://' };
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const res = await net.fetch(url, { signal: ctl.signal, headers: { 'Accept': 'application/json', 'User-Agent': 'EditorDeckAnki/' + app.getVersion() } });
    clearTimeout(t);
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const text = await res.text(); if (text.length > 1e6) return { ok: false, error: 'Respons terlalu besar' };
    return { ok: true, text };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});
ipcMain.handle('open-external', (_e, url) => { if (/^https:\/\//i.test(String(url))) { shell.openExternal(url); return true; } return false; });

/* ---------- siklus hidup ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else {
  app.on('second-instance', (_e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } argFiles(argv).forEach(queueOpen); });
  app.on('open-file', (e, p) => { e.preventDefault(); queueOpen(p); });
  app.whenReady().then(() => {
    initLang(); buildMenu(); createWindow();
    argFiles(process.argv).forEach(p => pendingOpen.push(p));
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
