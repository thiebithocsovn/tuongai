package vn.tuongai.learningwall;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
public class MainActivity extends Activity {
  private static final String SITE="https://thiebithocsovn.github.io/tuongai/";
  private WebView web;
  private ValueCallback<Uri[]> upload;
  private boolean trusted(Uri uri){
    return uri!=null && "https".equalsIgnoreCase(uri.getScheme()) &&
      "thiebithocsovn.github.io".equalsIgnoreCase(uri.getHost()) &&
      uri.getPath()!=null && uri.getPath().startsWith("/tuongai/");
  }
  private void openOutside(Uri uri){
    if(uri==null)return;
    String scheme=uri.getScheme();
    if("https".equals(scheme)||"mailto".equals(scheme)){
      try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(ActivityNotFoundException ignored){}
    }
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    web=new WebView(this);setContentView(web);
    WebSettings settings=web.getSettings();
    settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        if(trusted(request.getUrl()))return false;
        openOutside(request.getUrl());return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> cb,FileChooserParams params){
        if(upload!=null)upload.onReceiveValue(null);
        upload=cb;
        try{
          startActivityForResult(Intent.createChooser(params.createIntent(),"Chọn ảnh bài làm hoặc tài liệu"),105);
          return true;
        }catch(Exception error){upload=null;cb.onReceiveValue(null);return false;}
      }
      @Override public void onPermissionRequest(PermissionRequest r){
        runOnUiThread(()->r.deny()); // Không tự cấp quyền camera/mic trên WebView; chụp ảnh dùng bộ chọn tệp Android.
      }
    });
    web.loadUrl(SITE);
  }
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==105&&upload!=null){
      upload.onReceiveValue(result==RESULT_OK?WebChromeClient.FileChooserParams.parseResult(result,data):null);
      upload=null;
    }
  }
  @Override public void onBackPressed(){
    if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();
  }
  @Override protected void onDestroy(){
    if(upload!=null){upload.onReceiveValue(null);upload=null;}
    if(web!=null){web.destroy();web=null;}
    super.onDestroy();
  }
}
