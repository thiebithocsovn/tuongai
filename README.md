# Tường AI

Không gian cùng học: giáo viên chụp bài làm của học sinh hoặc học sinh nộp bài bằng điện thoại; AI chấm điểm, chỉ lỗi sai từng dòng và gợi ý luyện tập.

Mở trên web: https://thiebithocsovn.github.io/tuongai/

## Ai dùng thế nào

- **Giáo viên** đăng ký bằng email. Tài khoản dùng được sau khi Quản trị hệ thống duyệt. Mỗi giáo viên chỉ thấy bảng và bài làm của mình.
- **Học sinh** không cần tài khoản. Thầy cô mở **Chia sẻ** trên một bảng, bật "Cho học sinh nộp bài qua đường link", rồi gửi đường link hoặc mã QR. Học sinh mở link, nhập họ tên là nộp được bài. Em chỉ thấy bài của mình. Thầy cô tắt chia sẻ thì đường link ngừng hoạt động ngay.
- **Quản trị hệ thống** thấy dữ liệu của mọi giáo viên. Trang **Thành viên** dùng để duyệt, khóa hoặc mở khóa, đặt lại mật khẩu, tạo tài khoản, cấp hoặc bỏ quyền quản trị, xóa tài khoản và xem bảng của từng giáo viên. **Cài đặt hệ thống** dùng để đặt khóa Gemini chung cho AI chấm bài và bật hoặc tắt chế độ tự duyệt giáo viên mới.

## Tính năng chính

- Giao diện Tường Học Tập AI: thẻ bảng có tranh minh họa nhiều màu, nhãn Đã ghim, Lớp, Sôi nổi, Riêng tư, nút ⋯ để ghim, chia sẻ, lưu trữ; xem theo chiều ngang hoặc chiều dọc.
- Bảng lớp với 5 bố cục: Cột, Tường, Lưới, Dòng bài, Dòng thời gian; đổi nền, tìm và sắp xếp bài, thêm, đổi tên, xóa cột, lưu trữ, thùng rác.
- Mỗi bài: ghim lên đầu, đổi màu thẻ, chuyển cột, thả tim, trao đổi nhiều lượt nhận xét, đính kèm liên kết YouTube/Drive.
- Trình chiếu từng bài lên màn hình lớp; xem ảnh vở phóng to, xoay, toàn màn hình.
- Tiến bộ học sinh: điểm trung bình, xu hướng, xếp loại và kỹ năng cả lớp cần luyện.
- Xuất bảng điểm và nhận xét ra Excel, in hoặc lưu PDF.
- Chụp vở bằng camera điện thoại hoặc gõ bài trực tiếp. Ảnh lưu trong kho riêng tư.
- AI chấm theo đề và đáp án của giáo viên: điểm (làm tròn 0,25), lỗi sai kèm cách sửa, điểm làm tốt, định hướng luyện tập, bài tập gợi ý.
- Giáo viên duyệt điểm cuối và ghi lời phê. Bài học sinh mới nộp hiện ra ngay trên bảng của thầy cô.
- Bảng mẫu Toán 9 để thử (đường link `?lop=MAU009`).

## Cấu trúc

- `index.html`: toàn bộ giao diện (HTML, CSS, JavaScript), chạy trên GitHub Pages.
- `supabase/migrations/`: cơ sở dữ liệu, phân quyền (Row Level Security) và kho ảnh trên Supabase.
- `supabase/functions/tuongai/`: hàm máy chủ cho đăng ký, học sinh nộp bài, AI chấm bài và quản trị thành viên. Khóa AI và email quản trị chỉ lưu trên máy chủ, không nằm trong mã nguồn.
- `.github/workflows/pages.yml`: tự xuất bản lên GitHub Pages mỗi khi nhánh `main` thay đổi.
