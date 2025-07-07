# 🎯 Ateex Cloud Auto-Earn Script with reCAPTCHA Solver

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Required-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg)

> 📌 Tự động hóa quá trình kiếm coin trên [Ateex Cloud](https://dash.ateex.cloud/) với giải pháp reCAPTCHA audio hoàn toàn tự động!

---

## 🚀 Giới thiệu

Script Tampermonkey này giúp bạn:
- **Tự động đăng nhập** vào Ateex Cloud.
- **Tự động kiếm coin** mà không cần thao tác tay.
- **Giải reCAPTCHA audio** hoàn toàn tự động (tích hợp AI solver).
- **Quản lý lịch sử** hoạt động và thống kê quá trình kiếm coin.
- **Giao diện hiện đại** với pop-up và bảng điều khiển thời gian thực.

---

## 🔗 Liên kết quan trọng

- 📁 GitHub Project: [Auto Earn with reCAPTCHA Solver](https://github.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver)
- 🧠 reCAPTCHA Solver Backend (by Origami): [gist.github.com](https://gist.github.com/origamiofficial/2557dd47fb0aaf08e3c298a236bfa14d)
- ⚙️ Cài đặt Tampermonkey: [tampermonkey.net](https://www.tampermonkey.net/)

---

## 📥 Cài đặt & Thiết lập

### Bước 1: Cài đặt Tampermonkey

- Cài đặt trên trình duyệt Chrome/Firefox: [Tampermonkey Download](https://www.tampermonkey.net/)

### Bước 2: Thêm Script

- Truy cập: `https://github.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/raw/main/auto-ateexcloud.js`
- Tampermonkey sẽ hiển thị cửa sổ cài đặt, bạn chọn **Install** ✅

### Bước 3: Đăng nhập

- Truy cập [Ateex Cloud Dashboard](https://dash.ateex.cloud)
- Script sẽ tự hiện popup đăng nhập
- Nhập tài khoản + mật khẩu → **Save & Continue**

---

## ⚙️ Performance Stats (ước tính)

### ⏱️ Timing per Cycle

| Trang | Thời gian trung bình |
|------|----------------------|
| Earn Page | ~4–6s |
| Login Page | ~1.5s đợi + ~3.5s captcha |
| Home Page | ~2s chuyển trang |
| **Tổng** | ~10–12s mỗi vòng lặp (**~5–6 vòng/phút**)

### 💰 Coin Earning Rates

- Mỗi vòng: **+15 coins**
- Mỗi giờ: **~450–540 coins**
- Đạt **1000 coins**: ~2 giờ (~67 vòng)
- Đạt **5000 coins**: ~9–11 giờ (~334 vòng)
- Đạt **10000 coins**: ~18–22 giờ (~667 vòng)

---

## 🔐 Tính năng chính

| Tính năng | Mô tả |
|----------|-------|
| 🔄 Tự động hóa | Tự động vào trang `/earn`, thu thập coin liên tục |
| 🔐 Tự động đăng nhập | Giao diện nhập tài khoản, mã hóa localStorage, tự động lưu đăng nhập |
| 🔊 Giải Captcha | Tích hợp AI giải Captcha audio từ backend |
| 📈 Thống kê chi tiết | Lưu lịch sử, thời gian hoạt động, tốc độ kiếm coin |
| ⚙️ Tuỳ chỉnh mục tiêu | Cài đặt số coin muốn đạt được và theo dõi tiến trình |
| 🛑 Phát hiện lỗi | Phát hiện trang lỗi và tự động dừng hoặc reload lại trang |
| 🧪 Giao diện người dùng | Popup quản lý, bảng điều khiển coin, tùy chọn xóa dữ liệu |

---

## ⚠️ Lưu ý

- 🔑 Tài khoản chỉ lưu trong trình duyệt, mã hoá bằng key nội bộ.
- 🧠 Captcha giải bằng hệ thống trung gian (PythonAnywhere).
- ⛔ Không mở nhiều tab script cùng lúc.
- 💡 Chỉ sử dụng với tài khoản bạn sở hữu. Không khuyến khích lạm dụng.

---

## 👨‍💻 Tác giả

- 👤 **phmyhu_1710** (PTH Huy)
- 📧 GitHub: [SmallFCraft](https://github.com/SmallFCraft)

---

## 📜 License

MIT License © 2025 - SmallFCraft

---

## ⭐ Nếu bạn thấy hữu ích...

> Hãy ủng hộ bằng cách ⭐ star trên GitHub để mình có động lực phát triển tiếp!
