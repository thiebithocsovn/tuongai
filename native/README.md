# Bộ cài Tường học tập AI

Web chính thức: https://thiebithocsovn.github.io/tuongai/

- **Android:** dự án `native/android` đóng gói HTTPS WebView, quản lý máy ảnh / file, không lưu mật khẩu hay dữ liệu học sinh trong bản build. GitHub Actions tạo APK **debug ký bằng khóa thử nghiệm** (chưa phải bản phát hành đã ký chính thức).
- **Windows:** `native/windows` dùng Electron với `nodeIntegration:false`, `sandbox:true`, giới hạn quyền máy ảnh cho tên miền chính thức. GitHub Actions tạo EXE **chưa ký mã**. Windows SmartScreen có thể hiển thị cảnh báo.
- **iOS/iPadOS:** cài bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Để phát hành IPA/App Store cần dự án Xcode, chứng chỉ Apple Developer, ký ứng dụng và TestFlight/App Store, không thể tự cài file IPA tùy ý từ website.
- **macOS:** Safari → Tệp → Thêm vào Dock hoặc Chrome/Edge → Cài ứng dụng.

Bản web và các trình bao native sử dụng chung dữ liệu máy chủ, cần Internet cho đăng nhập, nộp bài và chấm AI.

## Xây dựng

Android: JDK 17, Android SDK 35 và Gradle 8.9; trong `native/android` chạy `gradle assembleDebug`.

Windows: Node 22, trong `native/windows` chạy `npm install` và `npm run dist:win` trên Windows.

Workflow `.github/workflows/build-installers.yml` đóng gói và phát hành bản thử nghiệm. Chỉ sử dụng liên kết tải GitHub Release sau khi cả hai tác vụ build hoàn tất thành công.

### Vận hành

Trước khi phân phối công khai, cấu hình ký APK release bằng khóa riêng có bảo mật; ký Authenticode cho Windows để hạn chế cảnh báo bảo mật. Kiểm thử thực tế ít nhất một điện thoại Android, một iPhone Safari, một máy Windows, một iPad và một thiết bị màn hình nhỏ.
