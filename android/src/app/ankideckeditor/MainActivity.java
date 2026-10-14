package app.ankideckeditor;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Editor Deck Anki: pembungkus WebView. Semua konten dilayani dari assets lewat https://app.local/ (tanpa jaringan). */
public class MainActivity extends Activity {
    static final String HOST = "app.local";
    static final int REQ_PICK = 101, REQ_SAVE = 102;
    static final int MIN_WEBVIEW = 80;

    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private volatile OutputStream saveOut;
    private volatile boolean pageReady = false;
    private String pendingName, pendingFile;
    private File sharedDir;
    private int shareSeq = 0;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        sharedDir = new File(getCacheDir(), "shared");
        cleanDir(sharedDir);
        sharedDir.mkdirs();

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u != null && HOST.equals(u.getHost())) return serve(u);
                return null;
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                Uri u = Uri.parse(url);
                if (HOST.equals(u.getHost())) return false;
                if ("https".equals(u.getScheme())) openExternal(url);
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                if (p != null && p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE)
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(Intent.createChooser(i, null), REQ_PICK);
                } catch (ActivityNotFoundException e) {
                    chooser = null;
                    cb.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        if (b == null) web.loadUrl("https://" + HOST + "/index.html");
        else web.restoreState(b);
        handleIntent(getIntent());
        checkWebView();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        handleIntent(i);
    }

    @Override
    protected void onDestroy() {
        closeQuietly(saveOut);
        if (chooser != null) { chooser.onReceiveValue(null); chooser = null; }
        if (web != null) { web.removeJavascriptInterface("AndroidBridge"); web.destroy(); }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return window.__androidBack?window.__androidBack():'exit'}catch(e){return 'exit'}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String v) {
                        if (v == null || v.contains("exit")) finish();
                    }
                });
    }

    /* ---------- hasil activity: pilih dan simpan file ---------- */
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_PICK) {
            ValueCallback<Uri[]> cb = chooser;
            chooser = null;
            if (cb == null) return;
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                ClipData cd = data.getClipData();
                if (cd != null && cd.getItemCount() > 0) {
                    out = new Uri[cd.getItemCount()];
                    for (int i = 0; i < out.length; i++) out[i] = cd.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    out = new Uri[]{data.getData()};
                }
            }
            cb.onReceiveValue(out);
        } else if (req == REQ_SAVE) {
            boolean ok = false;
            if (res == RESULT_OK && data != null && data.getData() != null) {
                try {
                    saveOut = getContentResolver().openOutputStream(data.getData(), "wt");
                    ok = saveOut != null;
                } catch (Exception e) {
                    ok = false;
                }
            }
            js("window.__andSaveReady && window.__andSaveReady(" + ok + ")");
        } else {
            super.onActivityResult(req, res, data);
        }
    }

    /* ---------- file dari "Buka dengan" ---------- */
    private void handleIntent(Intent i) {
        if (i == null || !Intent.ACTION_VIEW.equals(i.getAction()) || i.getData() == null) return;
        final Uri u = i.getData();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String name = displayName(u);
                    File f = new File(sharedDir, (++shareSeq) + "_" + safeName(name));
                    InputStream in = getContentResolver().openInputStream(u);
                    if (in == null) return;
                    OutputStream o = new FileOutputStream(f);
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                    o.close();
                    in.close();
                    pendingName = name;
                    pendingFile = f.getName();
                    runOnUiThread(new Runnable() { public void run() { deliverPending(); } });
                } catch (Exception e) { /* abaikan: file tidak terbaca */ }
            }
        }).start();
    }

    private void deliverPending() {
        if (!pageReady || pendingFile == null) return;
        String f = pendingFile, n = pendingName;
        pendingFile = null;
        pendingName = null;
        js("window.__andOpen && window.__andOpen('https://" + HOST + "/__shared/" + Uri.encode(f) + "'," + JSONObject.quote(n) + ")");
    }

    private String displayName(Uri u) {
        String name = null;
        if ("content".equals(u.getScheme())) {
            Cursor c = null;
            try {
                c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
                if (c != null && c.moveToFirst()) name = c.getString(0);
            } catch (Exception e) { /* tanpa nama */ } finally {
                if (c != null) c.close();
            }
        }
        if (name == null) name = u.getLastPathSegment();
        return name == null ? "deck.apkg" : name;
    }

    private static String safeName(String n) {
        String s = n.replaceAll("[^A-Za-z0-9._-]", "_");
        return s.length() > 80 ? s.substring(s.length() - 80) : s;
    }

    /* ---------- layanan aset https://app.local/ ---------- */
    private WebResourceResponse serve(Uri u) {
        String path = u.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        try {
            InputStream in;
            if (path.startsWith("/__shared/")) {
                File f = new File(sharedDir, new File(path.substring(10)).getName());
                if (!f.isFile()) return notFound();
                in = new FileInputStream(f);
            } else {
                if (path.contains("..")) return notFound();
                in = getAssets().open(path.substring(1));
            }
            Map<String, String> h = new HashMap<String, String>();
            h.put("Cache-Control", "no-store");
            return new WebResourceResponse(mime(path), "utf-8", 200, "OK", h, in);
        } catch (IOException e) {
            return notFound();
        }
    }

    private WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".wasm")) return "application/wasm";
        String ext = MimeTypeMapExt(p);
        return ext != null ? ext : "application/octet-stream";
    }

    private static String MimeTypeMapExt(String p) {
        int i = p.lastIndexOf('.');
        if (i < 0) return null;
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(p.substring(i + 1));
    }

    /* ---------- util ---------- */
    private void js(final String code) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(code, null);
            }
        });
    }

    private void openExternal(String url) {
        if (url == null || !url.startsWith("https://")) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException e) { /* tidak ada browser */ }
    }

    private static void closeQuietly(OutputStream o) {
        if (o == null) return;
        try { o.close(); } catch (IOException e) { /* abaikan */ }
    }

    private static void cleanDir(File d) {
        File[] fs = d.listFiles();
        if (fs != null) for (File f : fs) f.delete();
    }

    private static String webViewVersion(String ua) {
        Matcher m = Pattern.compile("Chrome/(\\d+)").matcher(ua == null ? "" : ua);
        return m.find() ? m.group(1) : "0";
    }

    private void checkWebView() {
        int v = 0;
        try { v = Integer.parseInt(webViewVersion(web.getSettings().getUserAgentString())); } catch (Exception e) { /* tidak terbaca */ }
        if (v >= MIN_WEBVIEW || v == 0) return;
        final boolean id = Locale.getDefault().getLanguage().equals("in") || Locale.getDefault().getLanguage().equals("id");
        new AlertDialog.Builder(this)
                .setTitle(id ? "Perbarui WebView" : "Update WebView")
                .setMessage(id ? "Aplikasi ini butuh Android System WebView versi " + MIN_WEBVIEW + " atau lebih baru (terpasang: " + v + "). Perbarui lewat Google Play, lalu buka ulang aplikasi."
                        : "This app needs Android System WebView " + MIN_WEBVIEW + " or newer (installed: " + v + "). Update it from Google Play, then reopen the app.")
                .setPositiveButton("Google Play", new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface d, int w) {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.webview")));
                        } catch (ActivityNotFoundException e) {
                            openExternal("https://play.google.com/store/apps/details?id=com.google.android.webview");
                        }
                    }
                })
                .setNegativeButton("OK", null)
                .show();
    }

    /* ---------- jembatan JavaScript ---------- */
    private class Bridge {
        @JavascriptInterface
        public String info() {
            try {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                JSONObject o = new JSONObject();
                o.put("version", pi.versionName);
                o.put("platform", "android");
                o.put("arch", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "");
                o.put("androidRelease", Build.VERSION.RELEASE);
                o.put("sdk", Build.VERSION.SDK_INT);
                o.put("chrome", webViewVersion(web.getSettings().getUserAgentString()));
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void ready() {
            runOnUiThread(new Runnable() {
                public void run() {
                    pageReady = true;
                    deliverPending();
                }
            });
        }

        @JavascriptInterface
        public void saveStart(final String name) {
            runOnUiThread(new Runnable() {
                public void run() {
                    closeQuietly(saveOut);
                    saveOut = null;
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    String n = name == null ? "deck" : name;
                    String l = n.toLowerCase(Locale.ROOT);
                    String type = l.endsWith(".csv") ? "text/csv" : l.endsWith(".txt") ? "text/plain" : l.endsWith(".json") ? "application/json" : "application/octet-stream";
                    i.setType(type);
                    i.putExtra(Intent.EXTRA_TITLE, n);
                    try {
                        startActivityForResult(i, REQ_SAVE);
                    } catch (ActivityNotFoundException e) {
                        js("window.__andSaveReady && window.__andSaveReady(false)");
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveChunk(String b64) {
            OutputStream o = saveOut;
            if (o == null) throw new IllegalStateException("no output");
            try {
                o.write(Base64.decode(b64, Base64.DEFAULT));
            } catch (IOException e) {
                throw new RuntimeException(e.getMessage());
            }
        }

        @JavascriptInterface
        public void saveFinish() {
            OutputStream o = saveOut;
            saveOut = null;
            if (o == null) return;
            try {
                o.flush();
                o.close();
            } catch (IOException e) {
                throw new RuntimeException(e.getMessage());
            }
        }

        @JavascriptInterface
        public void saveAbort() {
            closeQuietly(saveOut);
            saveOut = null;
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            runOnUiThread(new Runnable() { public void run() { openExternal(url); } });
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() { public void run() { finish(); } });
        }

        @JavascriptInterface
        public void httpGet(final String id, final String url) {
            new Thread(new Runnable() {
                public void run() {
                    boolean ok = false;
                    String out;
                    HttpURLConnection c = null;
                    try {
                        if (url == null || !url.startsWith("https://")) throw new IOException("URL harus diawali https://");
                        c = (HttpURLConnection) new URL(url).openConnection();
                        c.setConnectTimeout(12000);
                        c.setReadTimeout(12000);
                        c.setRequestProperty("Accept", "application/json");
                        c.setRequestProperty("User-Agent", "EditorDeckAnki-Android");
                        int code = c.getResponseCode();
                        if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
                        InputStream in = c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            bo.write(buf, 0, n);
                            if (bo.size() > 1000000) throw new IOException("Respons terlalu besar");
                        }
                        out = bo.toString("UTF-8");
                        ok = true;
                    } catch (Exception e) {
                        out = String.valueOf(e.getMessage());
                    } finally {
                        if (c != null) c.disconnect();
                    }
                    js("window.__andCb && window.__andCb(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(out) + ")");
                }
            }).start();
        }

        @JavascriptInterface
        public void httpRequest(final String id, final String specJson) {
            new Thread(new Runnable() {
                public void run() {
                    boolean ok = false;
                    String out;
                    HttpURLConnection c = null;
                    try {
                        JSONObject spec = new JSONObject(specJson);
                        String url = spec.optString("url", "");
                        if (!url.startsWith("https://")) throw new IOException("URL harus diawali https://");
                        String method = spec.optString("method", "GET").toUpperCase(Locale.ROOT);
                        if (!method.equals("GET") && !method.equals("POST")) throw new IOException("Metode tidak diizinkan");
                        c = (HttpURLConnection) new URL(url).openConnection();
                        c.setConnectTimeout(15000);
                        c.setReadTimeout(15000);
                        c.setRequestMethod(method);
                        c.setRequestProperty("User-Agent", "EditorDeckAnki-Android");
                        JSONObject hd = spec.optJSONObject("headers");
                        if (hd != null) {
                            java.util.Iterator<String> it = hd.keys();
                            while (it.hasNext()) {
                                String k = it.next();
                                if (k.equalsIgnoreCase("content-type") || k.equalsIgnoreCase("accept") || k.equalsIgnoreCase("authorization"))
                                    c.setRequestProperty(k, hd.getString(k));
                            }
                        }
                        if (method.equals("POST") && !spec.isNull("body")) {
                            byte[] bytes = spec.getString("body").getBytes("UTF-8");
                            if (bytes.length > 200000) throw new IOException("Permintaan terlalu besar");
                            c.setDoOutput(true);
                            OutputStream os = c.getOutputStream();
                            os.write(bytes);
                            os.close();
                        }
                        int code = c.getResponseCode();
                        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        if (in != null) {
                            byte[] buf = new byte[8192];
                            int n;
                            while ((n = in.read(buf)) > 0) {
                                bo.write(buf, 0, n);
                                if (bo.size() > 2000000) throw new IOException("Respons terlalu besar");
                            }
                        }
                        JSONObject r = new JSONObject();
                        r.put("ok", code >= 200 && code < 300);
                        r.put("status", code);
                        r.put("text", bo.toString("UTF-8"));
                        out = r.toString();
                        ok = true;
                    } catch (Exception e) {
                        out = String.valueOf(e.getMessage());
                    } finally {
                        if (c != null) c.disconnect();
                    }
                    js("window.__andCb && window.__andCb(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(out) + ")");
                }
            }).start();
        }
    }
}
