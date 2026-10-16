# Tường AI

Không gian cùng học: giáo viên chụp bài làm của học sinh, học sinh nộp bài bằng điện thoại, AI chấm điểm, chỉ lỗi sai từng dòng và gợi ý luyện tập.

Mở trên web: https://thiebithocsovn.github.io/tuongai/ (sau khi bật GitHub Pages).

## Tính năng

- Đăng ký, đăng nhập cho giáo viên và học sinh. Mật khẩu được mã hóa (PBKDF2) trước khi lưu.
- Tài khoản **Quản trị hệ thống** gắn với một email cố định (nhận ra qua mã băm, không ghi email trong mã nguồn). Lần đầu đăng nhập bằng email này, Tường AI mời đặt mật khẩu quản trị.
- Bảng lớp kiểu cột hoặc tường, ghim, đánh dấu, lưu trữ, thùng rác, mã lớp 6 ký tự cho học sinh.
- Chụp vở bằng camera điện thoại hoặc gõ bài trực tiếp.
- AI chấm theo đề và đáp án của giáo viên: điểm (làm tròn 0,25), lỗi sai kèm cách sửa, điểm làm tốt, định hướng luyện tập, bài tập gợi ý.
- Giáo viên duyệt điểm cuối và ghi lời phê.
- Bảng mẫu Toán 9 (mã MAU009) để thử ngay.

## Bật AI chấm bài

Đăng nhập tài khoản giáo viên, bấm nút bánh răng, chọn **Cài đặt AI chấm bài**, rồi dán khóa API:

- **Google Gemini** (có gói miễn phí): lấy khóa tại https://aistudio.google.com/apikey
- **Anthropic Claude** (trả phí theo lượt): tạo khóa trong Claude Console.

Khóa chỉ lưu trong trình duyệt của máy đó và chỉ được gửi tới dịch vụ AI đã chọn.

## Lưu ý

- Bản này là một trang web tĩnh, chưa có máy chủ. Tài khoản và bài làm lưu trên từng thiết bị (IndexedDB của trình duyệt), nên các máy khác nhau không thấy dữ liệu của nhau. Phù hợp khi giáo viên và học sinh dùng chung một máy trong lớp.
- Muốn mọi giáo viên và học sinh dùng chung dữ liệu qua mạng, cần thêm máy chủ (ví dụ Firebase hoặc Supabase) để lưu tài khoản, bài làm và gọi AI.

## Cấu trúc

Toàn bộ ứng dụng nằm trong một tệp `index.html` (HTML, CSS, JavaScript), không cần cài đặt hay build.
