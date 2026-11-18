/**
 * TƯỜNG HỌC TẬP AI — Gmail approval notifications (Google Apps Script).
 *
 * 1. Open https://script.google.com/ → New project.
 * 2. Paste this file into Code.gs.
 * 3. Project Settings → Script properties → Add property:
 *       TUONGAI_MAIL_TOKEN = <the one-time token shown to the system administrator>
 * 4. Deploy → New deployment → Web app.
 *       Execute as: Me; Who has access: Anyone.
 * 5. Authorize MailApp as the Gmail owner. Copy the /exec URL into
 *    Tường học tập AI → Quản trị → Thành viên → Cấu hình Gmail.
 *
 * This endpoint is public to call, but every request MUST carry a
 * long random server-side token. Do not publish/share that token.
 */
var APP_LOGIN_URL = 'https://tuonghoctap.vercel.app/';
var TOKEN_PROPERTY = 'TUONGAI_MAIL_TOKEN';
var SENT_PREFIX = 'tuongai_sent_';

function response_(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function equalSecret_(a, b) {
  if (!a || !b) return false;
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  var difference = 0;
  for (var i = 0; i < a.length; i++) difference |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return difference === 0;
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// Opening the URL in a browser does not send an email.
function doGet(e) {
  return response_({ok:true,service:'tuongai-gmail',message:'POST only for authorized mail requests'});
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (_) {
    return response_({ok:false,error:'invalid_json'});
  }

  var configuredToken = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  if (!configuredToken || configuredToken.length < 48 ||
      !equalSecret_(configuredToken, payload && payload.token)) {
    return response_({ok:false,error:'unauthorized'});
  }

  var id = String(payload.id || '');
  var email = String(payload.email || '').trim();
  var name = String(payload.name || '').trim().slice(0, 160);
  if (!/^[a-zA-Z0-9-]{8,120}$/.test(id) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return response_({ok:false,error:'invalid_recipient'});
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (_) {
    return response_({ok:false,error:'busy'});
  }

  try {
    var properties = PropertiesService.getScriptProperties();
    var marker = SENT_PREFIX + id;
    if (properties.getProperty(marker)) {
      return response_({ok:true,duplicate:true,id:'gmail-' + id});
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      return response_({ok:false,error:'mail_quota_exceeded'});
    }

    var hello = name ? 'Thầy/Cô ' + name : 'Thầy/Cô';
    var subject = 'Chúc mừng! Tài khoản Tường học tập AI đã được phê duyệt';
    var text = 'Xin chào ' + hello + ',\n\n' +
      'Chúc mừng Thầy/Cô đã đăng ký thành công tài khoản Tường học tập AI – Truy gốc lỗi!\n\n' +
      'Tài khoản đã được quản trị hệ thống phê duyệt và có thể sử dụng ngay.\n' +
      'Đăng nhập tại: ' + APP_LOGIN_URL + '\n\n' +
      'Trân trọng,\nTường học tập AI – Truy gốc lỗi\n' +
      '(Đây là thư thông báo tự động, không cần trả lời.)';
    var html = '<!doctype html><html lang="vi"><meta charset="utf-8">' +
      '<body style="background:#f4f7fc;font-family:Arial,sans-serif;padding:24px;color:#16304f">' +
      '<div style="max-width:560px;margin:auto;background:white;border-radius:14px;padding:26px;' +
      'border:1px solid #e1e9f4">' +
      '<p style="font-size:14px;font-weight:bold;color:#1456ac">TƯỜNG HỌC TẬP AI · TRUY GỐC LỖI</p>' +
      '<h1 style="font-size:24px">🎉 Chúc mừng đăng ký thành công!</h1>' +
      '<p>Xin chào <strong>' + escapeHtml_(hello) + '</strong>,</p>' +
      '<p>Tài khoản của Thầy/Cô đã được <strong>quản trị hệ thống phê duyệt thành công</strong>.' +
      ' Thầy/Cô có thể đăng nhập và bắt đầu sử dụng ngay.</p>' +
      '<p style="text-align:center;margin:28px 0"><a href="' + APP_LOGIN_URL + '"' +
      ' style="display:inline-block;background:#1959cb;padding:14px 24px;border-radius:8px;' +
      'color:white;text-decoration:none;font-weight:bold">Đăng nhập Tường học tập AI</a></p>' +
      '<p>Liên kết: <a href="' + APP_LOGIN_URL + '">' + APP_LOGIN_URL + '</a></p>' +
      '<p style="color:#64748b;font-size:12px">Thông báo tự động; không cần trả lời.</p>' +
      '</div></body></html>';

    MailApp.sendEmail({to:email,subject:subject,body:text,htmlBody:html,name:'Tường học tập AI'});
    // Record after MailApp accepts the request; duplicates are ignored on retried requests.
    properties.setProperty(marker, new Date().toISOString());
    return response_({ok:true,duplicate:false,id:'gmail-' + id});
  } catch (error) {
    console.error('TUONGAI_GMAIL_SEND_FAILED', String(error && error.name || 'Error'));
    return response_({ok:false,error:'send_failed'});
  } finally {
    lock.releaseLock();
  }
}
