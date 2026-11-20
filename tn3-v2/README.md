# TN3-V2 — BẢN THỬ MỚI, KHÔNG GHI ĐÈ TN3-V1

Ngày thiết kế: 07/11/2026. Tình trạng: prototype, chưa triển khai và chưa kiểm định trên học sinh. Không phải kết quả nghiệm thu TN3.

## Mục tiêu theo Phụ lục IV

H2: đúng nguyên nhân / ca có đề xuất >=75%, trung bình <=2 câu/lỗi, không kém cố định/ngẫu nhiên. H3: tỷ lệ chưa đủ căn cứ <=40%, điểm Brier giảm. Mục tiêu cải tiến tham vọng: độ phủ >=80%, độ đúng khi đề xuất >=80%. Không chỉnh dữ liệu để ép đạt.

## Thiết kế

- TN3-v1 ghi đúng/sai nhị phân. V2 dùng câu hỏi mở yêu cầu giải thích và phân loại phản hồi: r1=kiểu lập luận 1, r2=kiểu 2, r3=kiểu 3, U=không phân biệt được.
- Các mã r1/r2/r3 chỉ là tín hiệu quan sát, KHÔNG được tự coi là nguyên nhân chuẩn c1/c2/c3. c chuẩn do GV xác nhận độc lập.
- M5 chọn câu hỏi có kỳ vọng giảm entropy cao nhất từ bảng P(r1,r2,r3,U|c). M6 cập nhật Bayes, dừng tại posterior >=0,80 hoặc sau 2 câu, không lặp câu, giữ trạng thái chưa đủ căn cứ.
- Mọi P(r|c) trong model.js là giả định mục tiêu để kiểm thử; chưa có tần suất học sinh hay chữ ký giáo viên. Posterior thử nghiệm không phải độ tin cậy đã hiệu chuẩn.

## Quy trình hiệu chuẩn/kiểm định

1. Ghi và phê duyệt đề cương v2, bản rubric và ngày thực; không hồi tố TN3 04/11/2026; kiểm tra đồng ý nghiên cứu hợp lệ.
2. Thu phản hồi NGUYÊN VĂN của học sinh cho câu hỏi v2, mã ca, phiên bản, câu được hỏi, thời điểm và nguồn. U là trạng thái hợp lệ.
3. Hai GV Toán gán nguyên nhân độc lập, mù với kết quả hệ thống và nhãn của người kia; ghi κ, nguồn căn cứ, biên bản hòa giải nếu khác nhau. Mã r3 không đủ để kết luận sơ suất khi thiếu chứng cứ.
4. Dùng tập pilot riêng để ước lượng P(r|c) theo tần suất quan sát, có thể làm trơn Dirichlet nếu ghi trước; kiểm tra giả định độc lập có điều kiện.
5. Khóa bảng xác suất, phương án mã hóa, ngưỡng và phiên bản trước khi kiểm định; không dùng cùng tập để điều chỉnh rồi công bố kết quả.
6. Trên tập kiểm định độc lập, báo cáo đúng/đề xuất, độ phủ, chưa đủ căn cứ, Brier trước/sau, số câu trung bình và so sánh IG/cố định/ngẫu nhiên trên cùng các phản hồi thực có sẵn. Không tự dựng phản hồi cho câu chưa hỏi.
7. Kết luận đạt/không đạt H2/H3 chỉ sau khi có đủ dữ liệu hợp lệ và ký xác nhận thực tế.

## Mô phỏng khả thi, chỉ dùng giả lập

Script tn3_v2_simulation.py trong bộ hồ sơ chạy 1.000 ca tổng hợp (250 mỗi DH; seed 20261107) theo bộ xác suất tình huống:
- YẾU: độ phủ IG 64,5%, độ đúng khi đề xuất 85,3%.
- MỤC TIÊU GIẢ ĐỊNH: độ phủ IG 84,5%, đúng khi đề xuất 87,0%, chưa đủ căn cứ 15,5%; 1,37 câu/ca.
- MẠNH: độ phủ IG 91,9%, đúng khi đề xuất 88,4%.

Các kịch bản chỉ có ý nghĩa kỹ thuật. Không dùng những con số này thay cho 45 ca TN3 thực.

## Demo và kiểm thử

Mở tn3-v2/demo.html trên máy chủ tĩnh, tự tải engine.js và model.js cùng thư mục. Không lưu dữ liệu, không đưa kết quả vào cơ sở dữ liệu.
Chạy kiểm thử mã: node --test tn3-v2/engine.test.mjs

## Giới hạn

Độ đúng giả lập cao vì giả định câu hỏi có khả năng phân biệt tốt. Chưa có phản hồi và nhãn độc lập hợp lệ để xác minh giả định này, nên không được công bố TN3 thực tế đạt 80%.
