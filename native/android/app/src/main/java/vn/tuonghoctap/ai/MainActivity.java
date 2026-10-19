package vn.tuonghoctap.ai;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOME = "https://thiebithocsovn.github.io/tuongai/";
    private static final int FILE_REQUEST = 311;
    private static final int CAMERA_REQUEST = 312;
    private WebView web;
    private ValueCallback<Uri[]> upload;
    private PermissionRequest cameraPermission;

    private boolean isTrustedOrigin(Uri u) {
        return u != null && "https".equalsIgnoreCase(u.getScheme())
                && "thiebithocsovn.github.io".equalsIgnoreCase(u.getHost());
    }

    private boolean isTrusted(Uri u) {
        return u != null && "https".equalsIgnoreCase(u.getScheme())
                && "thiebithocsovn.github.io".equalsIgnoreCase(u.getHost())
                && (u.getPath().equals("/tuongai") || u.getPath().startsWith("/tuongai/"));
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(20,62,115));
        getWindow().setNavigationBarColor(Color.rgb(245,248,251));
        getWindow().getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(245,248,251));
        web.setLayoutParams(new ViewGroup.LayoutParams(-1,-1));
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isTrusted(uri)) return false;
                // OAuth, help links and other external pages open in the user's browser.
                try {
                    if ("https".equalsIgnoreCase(uri.getScheme()) || "mailto".equalsIgnoreCase(uri.getScheme())) {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    }
                } catch (Exception ignored) {}
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                String html = "<!doctype html><html lang='vi'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                    + "<style>body{font:16px system-ui;background:#f5f8fb;color:#183a62;text-align:center;"
                    + "padding:24vh 20px}a{display:inline-block;background:#145397;color:white;"
                    + "padding:14px 26px;border-radius:12px;text-decoration:none}</style>"
                    + "<h2>Chưa kết nối được Tường học tập AI</h2>"
                    + "<p>Kiểm tra Wi-Fi hoặc dữ liệu di động và thử mở lại.</p>"
                    + "<a href='" + HOME + "'>Thử kết nối lại</a></html>";
                view.loadDataWithBaseURL(HOME, html, "text/html", "UTF-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (upload != null) upload.onReceiveValue(null);
                upload = callback;
                try {
                    Intent chooser = params.createIntent();
                    startActivityForResult(chooser, FILE_REQUEST);
                } catch (Exception error) {
                    upload.onReceiveValue(null);
                    upload = null;
                    return false;
                }
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!isTrustedOrigin(request.getOrigin()) || !isTrusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) {
                        request.deny();
                        return;
                    }
                    boolean wantsCamera = false;
                    for (String resource : request.getResources())
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) wantsCamera = true;
                    if (!wantsCamera) { request.deny(); return; }
                    if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        cameraPermission = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_REQUEST);
                    } else {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    }
                });
            }
        });
        if (state == null) web.loadUrl(HOME);
        else web.restoreState(state);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        if (requestCode == FILE_REQUEST && upload != null) {
            upload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, intent));
            upload = null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == CAMERA_REQUEST && cameraPermission != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED)
                cameraPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else cameraPermission.deny();
            cameraPermission = null;
        }
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        web.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override protected void onDestroy() {
        if (upload != null) { upload.onReceiveValue(null); upload = null; }
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
