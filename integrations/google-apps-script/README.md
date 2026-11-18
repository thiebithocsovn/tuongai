# Kết nối Gmail với Tường học tập AI

1. Vào https://script.google.com/ bằng tài khoản Gmail bạn chọn làm địa chỉ gửi thư → **Dự án mới**.
2. Mở `Code.gs`, xóa mã mẫu rồi dán toàn bộ nội dung của file `Code.gs` trong thư mục này. Bấm **Lưu**.
3. Đăng nhập quản trị tại https://tuonghoctap.vercel.app/ → **Thành viên** → **Cấu hình Gmail** → nhấn **Tạo mã kết nối**; sao chép mã bảo mật vừa tạo.
4. Trở lại Apps Script → **Project Settings (Cài đặt dự án)** → **Script properties (Thuộc tính tập lệnh)** → thêm thuộc tính `TUONGAI_MAIL_TOKEN` với giá trị là mã vừa sao chép; bấm **Save**. Không đưa mã này lên GitHub, không gửi mã trong chat.
5. Ở Apps Script: **Deploy → New deployment → Web app**, Execute as **Me**, Who has access **Anyone**. Google sẽ yêu cầu bạn cấp quyền gửi thư lần đầu. Hoàn thành cấp quyền theo hướng dẫn.
6. Sao chép URL Web App kết thúc bằng `/exec`. Quay lại **Thành viên → Cấu hình Gmail**, dán URL vào ô và bấm **Lưu liên kết**.
7. Bấm **Gửi email kiểm tra** tới chính tài khoản quản trị, kiểm tra cả Inbox/Spam. Khi đã thành công, quản trị duyệt giáo viên khác để tự động gửi email chúc mừng. Những tài khoản đã duyệt trước đó có thể bấm **Gửi lại email**.

## Lưu ý an toàn

- Quyền truy cập Web App phải là `Anyone` để máy chủ Supabase có thể gọi mà không cần đăng nhập Google; mọi yêu cầu gửi thư đều phải có mã bí mật dài, chỉ nằm trong Supabase và Script properties.
- Không sử dụng Gmail/App Script để gửi thư hàng loạt ngoài hạn mức Google.
- Chỉ tài khoản admin được thay đổi cấu hình kết nối.
- Có thể xoay mã bằng nút **Tạo lại mã kết nối**. Sau đó phải cập nhật `TUONGAI_MAIL_TOKEN` trong Apps Script.
- Apps Script báo đã chấp nhận thư không đồng nghĩa thư đã tới Inbox; kiểm tra mục Thư đã gửi và trạng thái phía người nhận.
