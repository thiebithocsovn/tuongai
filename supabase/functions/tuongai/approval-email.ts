/* Automatic one-time email when a teacher changes from pending to active.
   All credentials are server-only Supabase Edge Function secrets. */
const APP_URL = "https://tuonghoctap.vercel.app/";

function htmlEscape(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
export function approvalEmailTemplate(name: string) {
  const greeting = name.trim() ? "Thầy/Cô " + name.trim() : "Thầy/Cô";
  const title = "Chúc mừng! Tài khoản Tường học tập AI đã được phê duyệt";
  const text = `Xin chào ${greeting},

Chúc mừng Thầy/Cô đã đăng ký thành công tài khoản Tường học tập AI – Truy gốc lỗi!

Tài khoản của Thầy/Cô đã được quản trị hệ thống phê duyệt và có thể sử dụng ngay.

Đăng nhập tại: ${APP_URL}

Trân trọng,
Tường học tập AI – Truy gốc lỗi
(Đây là thư thông báo tự động, Thầy/Cô không cần trả lời.)`;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body style="margin:0;background:#f2f6fc;font-family:Arial,Helvetica,sans-serif;color:#16304f">
  <div style="max-width:580px;margin:32px auto;padding:30px 28px;background:#fff;border:1px solid #dfe8f7;border-radius:16px">
  <p style="color:#1661c4;font-size:14px;font-weight:bold;letter-spacing:.4px">TƯỜNG HỌC TẬP AI · TRUY GỐC LỖI</p>
  <h1 style="font-size:25px;line-height:1.3;margin:14px 0;color:#11335d">🎉 Chúc mừng đăng ký thành công!</h1>
  <p style="font-size:16px;line-height:1.7">Xin chào <strong>${htmlEscape(greeting)}</strong>,</p>
  <p style="font-size:16px;line-height:1.7">Tài khoản <strong>Tường học tập AI – Truy gốc lỗi</strong> của Thầy/Cô đã được quản trị hệ thống <strong>phê duyệt thành công</strong>. Thầy/Cô có thể đăng nhập và sử dụng ngay.</p>
  <div style="text-align:center;margin:28px 0"><a href="${APP_URL}" style="display:inline-block;background:#1959cb;color:white;text-decoration:none;padding:15px 25px;border-radius:9px;font-size:16px;font-weight:bold">Đăng nhập Tường học tập AI</a></div>
  <p style="font-size:13px;line-height:1.7">Hoặc mở liên kết: <a href="${APP_URL}" style="color:#1959cb">${APP_URL}</a></p>
  <hr style="border:0;border-top:1px solid #e7edf7;margin:22px 0">
  <p style="font-size:12px;line-height:1.6;color:#64748b">Đây là thông báo tự động sau khi quản trị viên duyệt đăng ký. Không cần trả lời email này.</p></div></body></html>`;
  return { subject: title, text, html };
}
export function approvalMailConfigured() {
  const key = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const from = (Deno.env.get("APPROVAL_EMAIL_FROM") || "").trim();
  return Boolean(key && from && from.includes("@") && !/[\r\n]/.test(from));
}
export async function queueApprovalEmail(db: any, profile: {id:string,email:string,full_name?:string}) {
  const {error} = await db.from("approval_email_notifications").upsert({
    profile_id: profile.id, recipient_email: profile.email, recipient_name: profile.full_name || ""
  }, {onConflict:"profile_id", ignoreDuplicates: true});
  if (error) {
    console.error("approval_email_queue_failed", error.code || "db");
    return { status:"failed", reason:"queue_failed" };
  }
  return await deliverApprovalEmail(db, profile.id);
}
export async function deliverApprovalEmail(db: any, id: string) {
  const table = "approval_email_notifications";
  const {data:row,error} = await db.from(table).select("*").eq("profile_id", id).maybeSingle();
  if (error || !row) return {status:"not_found"};
  if (row.status === "sent") return {status:"sent"};
  if (row.status === "sending") return {status:"processing"};
  if (!approvalMailConfigured()) {
    await db.from(table).update({
      status:"not_configured", last_error:"Thiếu RESEND_API_KEY hoặc APPROVAL_EMAIL_FROM.",
      updated_at:new Date().toISOString()
    }).eq("profile_id", id).neq("status","sent");
    return {status:"not_configured"};
  }
  const now = new Date().toISOString();
  const {data:claimed,error:claimError} = await db.from(table)
    .update({status:"sending", attempts:Number(row.attempts||0)+1,
      last_error:null, updated_at:now})
    .eq("profile_id",id).in("status",["pending","failed","not_configured"])
    .select("profile_id,recipient_email,recipient_name").maybeSingle();
  if (claimError || !claimed) return {status:"processing"};
  const letter = approvalEmailTemplate(claimed.recipient_name);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails",{
        method:"POST",signal:controller.signal,
        headers:{
          "Authorization":"Bearer "+Deno.env.get("RESEND_API_KEY")!.trim(),
          "Content-Type":"application/json",
          "Idempotency-Key":"tuongai-approval-"+id,
        },
        body:JSON.stringify({
          from:Deno.env.get("APPROVAL_EMAIL_FROM")!.trim(),
          to:[claimed.recipient_email],
          subject:letter.subject,text:letter.text,html:letter.html,
        }),
      });
    } finally {clearTimeout(timeout);}
    const outcome = await response.json().catch(() => ({}));
    if (!response.ok || !outcome?.id) {
      throw new Error("Nhà cung cấp email từ chối yêu cầu (HTTP "+response.status+").");
    }
    const {error:saveError} = await db.from(table).update({
      status:"sent", provider_message_id:String(outcome.id).slice(0,200),
      last_error:null,updated_at:new Date().toISOString(),sent_at:new Date().toISOString()
    }).eq("profile_id", id);
    if (saveError) console.error("approval_email_record_failed",saveError.code||"db");
    return {status:"sent"};
  } catch (error) {
    console.error("approval_email_send_failed",error instanceof Error ? error.name : "unknown");
    await db.from(table).update({
      status:"failed",last_error:error instanceof Error ? error.message.slice(0,240):"Lỗi gửi email",
      updated_at:new Date().toISOString()
    }).eq("profile_id",id).eq("status","sending");
    return {status:"failed"};
  }
}
