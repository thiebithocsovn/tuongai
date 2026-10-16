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
- Giao diện trong lớp theo Tường học tập Ai: thanh trên có Trình chiếu, Chia sẻ, cài đặt; thanh công cụ có Đổi nền, Chiều ngang/Chiều dọc, sắp xếp, Tiến bộ học sinh, bố cục, Chờ duyệt; thẻ bài có nút ✨ Phân tích AI, lượt thích và nhận xét; nền mặc định Hồng phấn.
- Chờ duyệt: danh sách bài chưa chấm hoặc AI đã chấm nhưng thầy cô chưa duyệt điểm, kèm nút chấm cả loạt bằng AI.
- Mỗi bài: ghim lên đầu, đổi màu thẻ, chuyển cột, thả tim, trao đổi nhiều lượt nhận xét, đính kèm liên kết YouTube/Drive.
- Trình chiếu từng bài lên màn hình lớp; xem ảnh vở phóng to, xoay, toàn màn hình.
- Tiến bộ học sinh: điểm trung bình, xu hướng, xếp loại và kỹ năng cả lớp cần luyện.
- Xuất bảng điểm và nhận xét ra Excel, in hoặc lưu PDF (nút ở cuối hộp Tiến bộ học sinh).
- Chụp vở bằng camera điện thoại hoặc gõ bài trực tiếp. Ảnh lưu trong kho riêng tư.
- AI chấm theo đề và đáp án của giáo viên, kết quả có 5 phần hiện trong mục Nhận xét của giáo viên khi mở bài: Đọc bài (nội dung AI đọc được, đánh dấu chỗ ảnh mờ hoặc chưa đọc chắc), Tìm lỗi (câu, bước làm sai, giải thích, cách sửa), Phân tích (nguyên nhân có thể để giáo viên kiểm chứng), Đánh giá (điểm đề xuất theo đáp án và thang điểm, điểm từng câu), Luyện tập (phần kiến thức còn yếu và bài tập phù hợp).
- Kết nối AI không cần khóa API, giống Hệ sinh thái 4.0: thầy cô chấm bài và dùng Trợ lý AI bằng **Gemini · Google** (Firebase AI Logic) ngay trong trình duyệt. Đây là lựa chọn mặc định cho giáo viên; đổi ở ô "Chọn AI cho bài làm" trong Trợ lý AI. Nếu dự án Firebase bật App Check, Quản trị dán khóa trang reCAPTCHA (bắt đầu bằng 6L, lấy ở Firebase Console → App Check) vào Cài đặt hệ thống. Máy học sinh không gọi AI trực tiếp: khi chưa đặt khóa chung, bài học sinh được chấm lúc thầy cô mở bài hoặc bấm Chờ duyệt → Chấm bằng AI; khi có khóa chung, máy chủ vẫn tự chấm ngay lúc em nộp.
- Giáo viên duyệt điểm cuối và ghi lời phê. Bài học sinh mới nộp hiện ra ngay trên bảng của thầy cô.
- Trợ lý AI cho bài làm, trong mục nhận xét khi mở một bài (chỉ giáo viên thấy): 1. Chat và đánh giá (hỏi AI về bài, đưa nhận xét đề xuất vào ô Viết nhận xét, đề bài và tiêu chí dùng cho AI), 2. Giáo viên duyệt (kiểm chứng từng lỗi và nguyên nhân, duyệt nhận xét và điểm), 3. Luyện tập (AI soạn bài theo lỗi đã xác nhận, tải phiếu cho học sinh), 4. Tiến bộ (ghi lần luyện tập, theo dõi kỹ năng đã khắc phục). Dữ liệu lưu ở `teacher.assist`; máy chủ không gửi phần này cho học sinh.
- Bảng mẫu Toán 9 để thử (đường link `?lop=MAU009`).

## Cấu trúc

- `index.html`: toàn bộ giao diện (HTML, CSS, JavaScript), chạy trên GitHub Pages.
- `firebase-ai.js`: bản đóng gói Firebase JS SDK 12.11.0 (app, App Check, AI) cho kết nối Gemini · Google, chỉ tải khi thầy cô dùng AI.
- `supabase/migrations/`: cơ sở dữ liệu, phân quyền (Row Level Security) và kho ảnh trên Supabase.
- `supabase/functions/tuongai/`: hàm máy chủ cho đăng ký, học sinh nộp bài, AI chấm bài và quản trị thành viên. Khóa AI và email quản trị chỉ lưu trên máy chủ, không nằm trong mã nguồn.
- `.github/workflows/pages.yml`: tự xuất bản lên GitHub Pages mỗi khi nhánh `main` thay đổi.
