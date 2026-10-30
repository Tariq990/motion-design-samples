#!/usr/bin/env python3
"""Apply a minimal, reversible WebGPT 6.29 Android customization."""
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
here = Path(__file__).resolve().parent
source = root / "app/src/main/java/org/webgpt/app/MainActivity.java"
build = root / "app/build.gradle"
strings = root / "app/src/main/res/values/strings.xml"
outjs = root / "app/src/main/assets/gpt_auto_mobile.js"

def one(s, before, after):
    if s.count(before) != 1:
        raise RuntimeError("Upstream source mismatch: " + before[:55] + " count=" + str(s.count(before)))
    return s.replace(before, after, 1)

m = source.read_text(encoding="utf-8")
g = build.read_text(encoding="utf-8")
st = strings.read_text(encoding="utf-8")
if 'gpt_auto_mobile.js' in m:
    raise RuntimeError("Already patched")

g = one(g, 'applicationId "org.webgpt.app"', 'applicationId "io.tariq.gptautomobile"')
g = one(g, 'versionName "6.29"', 'versionName "6.29-auto.1"')
st = one(st, '<string name="app_name">WebGPT</string>',
         '<string name="app_name">GPT Auto Mobile</string>')

method = """
    private String autoMobileScript;

    private void injectAutoMobile(WebView view) {
        if (view == null || view != webview || isFinishing()) return;
        try {
            Uri u = Uri.parse(view.getUrl());
            if (!"https".equalsIgnoreCase(u.getScheme()) ||
                    !"chatgpt.com".equalsIgnoreCase(u.getHost())) return;
            if (autoMobileScript == null) {
                try (InputStream in = getAssets().open("gpt_auto_mobile.js");
                     java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                    byte[] buf = new byte[4096];
                    int len;
                    while ((len = in.read(buf)) != -1) out.write(buf, 0, len);
                    autoMobileScript = out.toString("UTF-8");
                }
            }
            view.evaluateJavascript(autoMobileScript, null);
        } catch (Exception e) {
            Log.e(TAG, "GPT Auto Mobile injection failed", e);
        }
    }

"""
m = one(m,
    '    /** onPageFinished fallback (and re-injection after SPA navigations). */\n    private void injectAllOverrides(WebView v) {',
    method + '    /** onPageFinished fallback (and re-injection after SPA navigations). */\n    private void injectAllOverrides(WebView v) {')
m = one(m, '            v.evaluateJavascript(PAGE_READY_WATCHER_JS, null);\n',
        '            v.evaluateJavascript(PAGE_READY_WATCHER_JS, null);\n            injectAutoMobile(v);\n')
m = one(m, '    void onDomReady() {\n        if (isFinishing() || initialLoadComplete) return;\n',
        '    void onDomReady() {\n        injectAutoMobile(webview);\n        if (isFinishing() || initialLoadComplete) return;\n')

# All anchor validation has succeeded; write modifications.
source.write_text(m, encoding="utf-8")
build.write_text(g, encoding="utf-8")
strings.write_text(st, encoding="utf-8")
outjs.parent.mkdir(parents=True, exist_ok=True)
outjs.write_text((here / "auto_controller.js").read_text(encoding="utf-8"), encoding="utf-8")
print("Applied GPT Auto Mobile patch (independent app ID).")
