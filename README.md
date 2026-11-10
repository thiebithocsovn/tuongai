# Tường học tập AI - Truy gốc lỗi

**English name:** Learning Wall AI – Error Root Tracer

Không gian cùng học: giáo viên chụp bài làm của học sinh hoặc học sinh nộp bài bằng điện thoại; AI chấm điểm, chỉ lỗi sai từng dòng và gợi ý luyện tập.

Mở trên web: https://thiebithocsovn.github.io/tuongai/

## Ai dùng thế nào

- **Giáo viên** đăng ký bằng email. Tài khoản dùng được sau khi Quản trị hệ thống duyệt. Mỗi giáo viên chỉ thấy bảng và bài làm của mình.
- **Học sinh** không cần tài khoản. Thầy cô mở **Chia sẻ** trên một bảng, bật "Cho học sinh nộp bài qua đường link", rồi gửi đường link hoặc mã QR. Học sinh mở link, nhập họ tên là nộp được bài. Phiên học sinh được lưu trên trình duyệt: đóng tab rồi mở lại vẫn nhận đúng bài của em. Khi dùng máy chung, chọn **Thoát lớp** để xóa phiên đã lưu. Thầy cô tắt chia sẻ thì đường link ngừng hoạt động.
- **Xem bài trong lớp:** Bài chưa duyệt chỉ chủ bài và giáo viên xem được. Sau khi duyệt, cả lớp xem được bài cùng nhận xét của giáo viên; điểm chỉ chủ bài xem được. API không trả điểm, kết quả AI hay bài luyện tập cá nhân của bạn khác, và không trả điểm hoặc nhận xét nháp trước khi duyệt. Cả lớp đồng bộ lại mỗi 20 giây và khi quay lại tab.
- Nếu đã đóng phiên trước bản cập nhật, bấm **Tìm bài em đã nộp** và nhập đúng họ tên trên trình duyệt đã nộp trước đây để khôi phục bài cũ. Việc nhận bài riêng gắn với mã thiết bị trên trình duyệt, không phải chỉ dựa vào họ tên; không tự nhận bài riêng khi chuyển sang thiết bị khác hoặc xóa dữ liệu trình duyệt.
- **Chế độ chỉ xem bài của bạn:** Ẩn liên kết tải và tệp gốc, chặn chọn chữ, sao chép, kéo ảnh, menu chuột phải và phím lưu/in trong vùng bài của bạn; ảnh phóng to có dấu Chỉ xem. PDF, DOCX (phần văn bản), XLS/XLSX, TXT/CSV, video và âm thanh có bản xem trực tiếp. Các định dạng khác hiển thị thông tin tệp; chủ bài và giáo viên vẫn tải được. Đây là hạn chế thao tác trong giao diện, không thể ngăn tuyệt đối ảnh chụp màn hình hoặc việc trích xuất dữ liệu đã hiển thị trên trình duyệt.
- **Ảnh đại diện:** Giáo viên và quản trị viên bấm ảnh tài khoản hoặc vào menu tài khoản → **Đổi ảnh đại diện**, chọn ảnh JPG/PNG/WebP (tối đa 8 MB). Ảnh tự căn vuông, lưu trong kho riêng tư Supabase, và được tải lại khi đăng nhập.
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
- Kết nối thêm tài khoản AI của riêng giáo viên: **Gemini** (khóa của tôi), **ChatGPT · OpenAI**, **Claude · Anthropic**. Mở menu tài khoản → Kết nối AI chấm bài (hoặc nút "Kết nối ChatGPT, Claude, Gemini" trong Trợ lý AI), dán khóa API, bấm Kiểm tra kết nối rồi Lưu. Khóa lưu trong bảng `ai_keys` (chỉ chủ tài khoản đọc được, Quản trị cũng không xem); khi chấm, trình duyệt gửi thẳng tới AI đã chọn. Gói ChatGPT Plus hay Claude Pro không thay được khóa API.
- Giáo viên duyệt điểm cuối và ghi lời phê. Bài học sinh mới nộp hiện ra ngay trên bảng của thầy cô.
- Trợ lý AI cho bài làm, trong mục nhận xét khi mở một bài (chỉ giáo viên thấy): 1. Chat và đánh giá (hỏi AI về bài, đưa nhận xét đề xuất vào ô Viết nhận xét, đề bài và tiêu chí dùng cho AI), 2. Giáo viên duyệt (kiểm chứng từng lỗi và nguyên nhân, duyệt nhận xét và điểm), 3. Luyện tập (AI soạn bài theo lỗi đã xác nhận, tải phiếu cho học sinh), 4. Tiến bộ (ghi lần luyện tập, theo dõi kỹ năng đã khắc phục). Dữ liệu lưu ở `teacher.assist`; máy chủ không gửi phần này cho học sinh.
- Bảng mẫu Toán 9 để thử (đường link `?lop=MAU009`). Thầy cô xóa được bảng mẫu (nút Xóa trên thẻ) và hiện lại từ menu tài khoản.

## SchoolManager – Quản lý AI Agent cho nhiều trường

- **Mở:** tài khoản quản trị toàn hệ thống đăng nhập → **Quản lý trường** ngay tại trang **Bảng toàn hệ thống**, hoặc mục **Thành viên** hoặc thanh điều hướng (**kể cả Android**). Mục **SchoolManager · Quản lý trường** cũng giữ trong menu tài khoản cho giáo viên có quyền SchoolManager. Quản trị trường do quản trị hệ thống chỉ định bằng vai trò thành viên SchoolManager, KHÔNG phải vai trò admin toàn hệ thống.
- Mã trường duy nhất. Mỗi giáo viên có thể là thành viên nhiều trường. Bảng lớp chỉ được liên kết với một trường, và chỉ sau khi chủ bảng đã được gán vào trường.
- **Không chuyển dữ liệu cũ:** các bảng và bài hiện có, đặc biệt TN1–TN4, không được tự phân loại theo chuỗi tên trường; chỉ khi quản trị chủ động gắn liên kết mới thuộc báo cáo trường.
- Quản trị trường xem danh sách giáo viên, bảng đã được liên kết, số bài đã nộp và số bài có điểm giáo viên duyệt, nhật ký thay đổi; không được xem bài làm/đáp án/nhận xét riêng của học sinh từ dashboard trường. Quản trị trường có thể thêm/gỡ giáo viên hiện hữu, bật/tắt AgentReview, ProgressTracker, ClassReport trong trường mình. Chỉ quản trị toàn hệ thống bổ nhiệm quản trị trường và gắn/bỏ liên kết bảng lớp.
- **Phân tách quyền:** Supabase tạo các bảng riêng school_manager_schools / members / boards / audit với RLS mặc định từ chối và REVOKE cho anon, authenticated. Chỉ Edge Function tuongai xác thực người gọi và trả dữ liệu phù hợp quyền.
- **Chính sách AI:** chỉ áp dụng với bảng đã liên kết. AgentReview kiểm tra cả trong máy chủ và hàng chờ; ProgressTracker và ClassReport kiểm tra từ máy chủ trước khi mở. Các chức năng AI cũ ngoài ba module không bị chính sách này thay đổi.
- **Triển khai thứ tự:** migration 20261110111000_school_manager.sql → cập nhật Edge Function tuongai cùng school-manager.ts → cập nhật giao diện Vercel. Không có thao tác UPDATE/DELETE dữ liệu học sinh hay thay đổi quyền của các bảng cũ.
- **Kiểm thử:** node --test tests/school-manager.test.mjs và kiểm thử hồi quy AgentReview, ProgressTracker, ClassReport. Trước khi mở rộng nhiều trường cần chạy kiểm thử xác thực trực tiếp với tài khoản ở hai trường khác nhau, bao gồm Data API và quyền của người dùng đã bị gỡ khỏi trường.

## ClassReport – Trợ lý báo cáo lớp (chỉ giáo viên)

- Trong bảng lớp do mình quản lý, chọn **ClassReport · Báo cáo**.
- Báo cáo tự tổng hợp theo kỳ **toàn bộ / 7 ngày / 30 ngày / tùy chọn**, gồm: số bài học sinh nộp, số bài có điểm giáo viên duyệt, số bài chờ, tỷ lệ duyệt, điểm trung bình thang 10, lỗi/kỹ năng được giáo viên xác minh, lượt luyện tập đã đánh giá và xu hướng theo tuần.
- **Tải báo cáo Excel** gồm 4 trang: Tổng quan, Bài nộp, Kỹ năng và Theo tuần. Khi thư viện XLSX không tải được, cung cấp CSV UTF-8 thay thế và thông báo rõ.
- **In / Lưu PDF** tạo báo cáo có tiêu đề, thời kỳ, bảng thống kê, đề xuất công việc dựa trên dữ liệu, nguồn/giới hạn thống kê và ô trống người lập ký tên. Chọn “Lưu thành PDF” trong hộp thoại in.
- Chỉ sử dụng điểm đã có teacher.approvedAt và teacher.score hợp lệ; không tính điểm nháp AI là kết quả chính thức. Chỉ đếm lỗi nếu giáo viên đã xác nhận nguyên nhân kèm bằng chứng; không tự suy diễn nguyên nhân học sinh sai.
- Báo cáo nội bộ chỉ giáo viên được quyền quản lý bảng truy cập. Không xuất bài làm nguyên văn, mã xem bài, token hay bản nháp AI; nhận xét giáo viên đã duyệt chỉ có trong file Excel.
- **Chỉ đọc:** không ghi Supabase, không đổi hồ sơ nghiên cứu TN1–TN4, không dùng số liệu mô phỏng và không tự tạo minh chứng. “Số phiên học sinh” không đồng nghĩa số học sinh duy nhất; mức tăng điểm trên đề khác độ khó chỉ có giá trị mô tả.
- Kiểm thử: node --test tests/class-report.test.mjs tests/progress-tracker.test.mjs tests/agent-review.test.mjs.

## ProgressTracker – Theo dõi tiến bộ học sinh (giáo viên xác minh)

- **Cách mở:** đăng nhập giáo viên → vào bảng lớp → chọn **ProgressTracker · AI Agent** trên thanh công cụ.
- Hệ thống tự tổng hợp điểm đã được giáo viên duyệt (quy về thang 10), lỗi có nguyên nhân và căn cứ giáo viên xác nhận, và các lượt luyện tập đã được giáo viên đánh giá.
- Trạng thái kỹ năng: **Chưa đủ đánh giá**, **Còn mắc lỗi**, **Đang cải thiện**, **Đã khắc phục**. Chỉ ghi “Đã khắc phục” khi tất cả bài luyện tập liên quan có lượt đánh giá gần nhất đạt và có căn cứ giáo viên.
- Dữ liệu theo từng bảng, chỉ chủ bảng/giáo viên được phân quyền quản lý xem. Không cho học sinh hoặc khách truy cập xem bảng tổng hợp cá nhân. Không tự ghép học sinh chỉ qua tên khi thiếu định danh; học sinh dùng thiết bị khác có thể được tính là phiên riêng.
- **Không sửa số liệu cũ:** tính toán trên bản ghi đang có ở trình duyệt, không tạo bảng SQL mới, không tự chấm điểm, không gọi mô hình AI và không sửa hồ sơ minh chứng TN1–TN4.
- Xu hướng điểm chỉ là so sánh mô tả; nếu đề khác độ khó thì không thể tự quy kết mức tăng điểm là tác động của phần mềm.
- Kiểm thử bằng `node --test tests/progress-tracker.test.mjs tests/agent-review.test.mjs`.

## AgentReview

- Bài học sinh mới nộp vào bảng bật tự chấm sẽ vào hàng chờ. Với khóa Gemini chung, máy chủ dùng kết quả chấm tự động để tạo bản nháp. Nếu chưa có khóa chung, phiên web của giáo viên chủ lớp tự chạy hàng chờ qua Gemini · Google và Firebase App Check. Bài chỉ có tệp đính kèm cần giáo viên bổ sung phần chữ ở bước 1.
- Mở bài nộp, vào **AgentReview → Giáo viên duyệt**. Với mỗi lỗi, xác nhận và ghi căn cứ, chọn chưa đủ căn cứ hoặc loại nhận định. Sau khi duyệt nhận xét và điểm, AgentReview tự soạn luyện tập cho các nguyên nhân đã xác nhận. Giáo viên kiểm tra đề và đáp án rồi chọn **Duyệt và giao luyện tập** để học sinh nhận đề và gợi ý.
- Khi triển khai, áp dụng migration `20261109235755_agent_review.sql` trước, sau đó triển khai Edge Function `tuongai` với cấu hình JWT hiện có và cập nhật trang web.

## Thống kê trực tuyến và lượt truy cập

- Ở dưới menu bên trái, thay thông báo quyền riêng tư bằng **Hoạt động hệ thống** gồm **Đang trực tuyến** và **Truy cập hôm nay**.
- **Đang trực tuyến**: số phiên kết nối đang mở qua Supabase Realtime Presence, cập nhật trực tiếp. Số liệu là số phiên hoạt động, không nhất thiết là số người duy nhất. Không thu thập tên, email hay dữ liệu học sinh để tính chỉ số này.
- **Truy cập hôm nay**: số phiên trình duyệt ghi nhận trong ngày theo múi giờ `Asia/Ho_Chi_Minh`, mỗi phiên chỉ tính một lần/ngày; mở tab mới có thể được tính như một phiên khác. Đây không phải số người dùng duy nhất.
- **Bước bắt buộc để bật số lượt truy cập:** Mở [Supabase SQL Editor](https://supabase.com/dashboard/project/vnxffqpszykkjueawtfr/sql/new) bằng tài khoản chủ dự án, mở `supabase/migrations/0004_site_traffic.sql` trong repo, dán toàn bộ SQL vào editor rồi bấm **Run**. GitHub Pages không thể tự áp dụng cấu trúc dữ liệu trong Supabase. Không cần sửa web sau khi chạy SQL; tải lại trang là xong.
- Nếu chưa chạy SQL hoặc mạng lỗi, giao diện hiển thị dấu **—** và ghi rõ tình trạng, **không bịa số 0**. Số liệu cũ không được hồi tố từ trước khi bật tính năng.
- Hai bảng thống kê có RLS, không cấp quyền đọc trực tiếp mã phiên. Chỉ hàm RPC được phép tăng/đọc số tổng. Khi vận hành quy mô lớn cần thêm cơ chế chống bot hoặc giới hạn tốc độ để giảm truy cập giả.

## Cấu trúc

- `index.html`: toàn bộ giao diện (HTML, CSS, JavaScript), chạy trên GitHub Pages.
- `firebase-ai.js`: bản đóng gói Firebase JS SDK 12.11.0 (app, App Check, AI) cho kết nối Gemini · Google, chỉ tải khi thầy cô dùng AI.
- `supabase/migrations/` (có `0003_ai_keys.sql` cho kết nối AI riêng): cơ sở dữ liệu, phân quyền (Row Level Security) và kho ảnh trên Supabase. Ảnh đại diện sử dụng thư mục `<user-id>/profile/avatar.jpg` của bucket riêng tư `work`; không cần migration mới.
- `supabase/functions/tuongai/`: hàm máy chủ cho đăng ký, học sinh nộp bài, AI chấm bài và quản trị thành viên. Khóa AI và email quản trị chỉ lưu trên máy chủ, không nằm trong mã nguồn.
- `node --test tests/student-classroom.test.mjs`: kiểm thử quyền xem, ẩn điểm nháp, lưu phiên sau khi đóng tab và giới hạn sao chép bài của bạn (Node 24).
- `.github/workflows/pages.yml`: tự xuất bản lên GitHub Pages mỗi khi nhánh `main` thay đổi.
