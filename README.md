# 🎯 Ateex Cloud Auto-Earn Script v2.4 with Advanced reCAPTCHA Solver

![Version](https://img.shields.io/badge/version-2.4-brightgreen.svg) ![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Required-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg)

> 📌 **Phiên bản 2.4** - Script tự động hóa hoàn toàn quá trình kiếm coin trên [Ateex Cloud](https://dash.ateex.cloud/) với hệ thống reCAPTCHA solver AI tiên tiến và giao diện quản lý thông minh!

---

## 🚀 Tính năng nổi bật v2.4

### 🆕 **Two-Stage Startup System**
- **Setup Phase**: Nhập credentials một lần duy nhất
- **Runtime Phase**: Tự động hoạt động sau khi setup
- **Smart Detection**: Tự động phát hiện user cũ và tiếp tục hoạt động

### 🎛️ **Advanced UI Management**
- **Unified Settings Menu**: Gộp tất cả tính năng vào menu dropdown gọn gàng
- **Real-time Stats Panel**: Hiển thị thống kê chi tiết với cập nhật theo thời gian thực
- **Smart Runtime Calculation**: Chỉ tính thời gian từ khi thực sự bắt đầu auto-earn

### 🔐 **Enhanced Security & Credentials**
- **Username/Email Support**: Hỗ trợ cả username và email đăng nhập
- **Encrypted Storage**: Mã hóa credentials với thuật toán bảo mật cao
- **Auto-validation**: Kiểm tra và làm sạch credentials không hợp lệ
- **Session Management**: Quản lý phiên đăng nhập thông minh

### 🤖 **AI-Powered reCAPTCHA Solver**

- **Audio Recognition**: Giải reCAPTCHA audio với độ chính xác cao
- **Multi-Server Support**: Hệ thống server dự phòng tự động chuyển đổi
- **Smart Retry**: Tự động thử lại khi gặp lỗi với cooldown thông minh
- **Anti-Detection**: Bypass các hệ thống phát hiện bot

### 🛡️ **Error Handling & Recovery**

- **Auto Error Detection**: Phát hiện trang lỗi (502, 500, 419) và tự động xử lý
- **Smart Logout**: Tự động logout khi cần thiết và redirect về login
- **Data Synchronization**: Đồng bộ dữ liệu giữa các components
- **Graceful Recovery**: Khôi phục tự động không cần can thiệp thủ công

### 📊 **Advanced Analytics & Management**

- **Comprehensive Stats**: Cycles, coins, runtime, rate, ETA với độ chính xác cao
- **History Tracking**: Lưu trữ và phân tích lịch sử hoạt động
- **Export/Import**: Xuất dữ liệu ra file JSON để backup
- **Target Management**: Đặt mục tiêu và theo dõi tiến độ

---

## 🔗 Liên kết quan trọng

- 📁 **GitHub Project**: [Auto Earn with reCAPTCHA Solver](https://github.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver)
- 🧠 **reCAPTCHA Solver Backend**: [Origami's Audio Solver](https://gist.github.com/origamiofficial/2557dd47fb0aaf08e3c298a236bfa14d)
- ⚙️ **Tampermonkey Extension**: [tampermonkey.net](https://www.tampermonkey.net/)
- 📖 **Documentation**: Xem file này để biết chi tiết cách sử dụng

---

## 📥 Cài đặt & Thiết lập

### Bước 1: Cài đặt Tampermonkey

1. **Chrome**: [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
3. **Edge**: [Microsoft Store](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Bước 2: Cài đặt Script

1. **Tự động**: Truy cập link và click Install
   ```
   https://github.com/SmallFCraft/script-auto-earn-with-coins-recaptcha-solver/raw/main/auto-ateexcloud.js
   ```

2. **Thủ công**: Copy code từ file `auto-ateexcloud.js` và paste vào Tampermonkey

### Bước 3: Thiết lập lần đầu

#### 🆕 **Two-Stage Setup Process v2.4**

**Phase 1: Setup (Chỉ làm 1 lần)**

1. Truy cập [Ateex Cloud](https://dash.ateex.cloud/)
2. Script hiển thị form **"🔐 Ateex Auto Login"**
3. Nhập **Username/Email** (hỗ trợ cả 2 định dạng)
4. Nhập **Password**
5. ✅ Check **"Remember me"** để lưu credentials
6. Click **"Save & Continue"**

**Phase 2: Runtime (Tự động hoạt động)**

7. ✅ Credentials saved! Auto Stats starting...
8. 🚀 Counter UI xuất hiện với real-time stats
9. Script bắt đầu auto-earn cycles
10. 📊 Theo dõi progress qua Settings menu

#### 🔄 **Existing Users (Đã setup trước)**

- Script tự động detect credentials cũ
- Bỏ qua Phase 1, chuyển thẳng Phase 2
- Tiếp tục auto-earn ngay lập tức

---

## ⚡ Hiệu suất & Thống kê v2.4

### ⏱️ Thời gian xử lý được tối ưu

| Trang | Thời gian | Cải thiện |
|-------|-----------|-----------|
| Earn Page | ~3–5s | ⚡ Faster |
| Login Page | ~1s đợi + ~2.5s captcha | ⚡ Faster |
| Home Page | ~1.5s chuyển trang | ⚡ Faster |
| **Tổng** | ~8–10s mỗi vòng lặp (**~6–7 vòng/phút**) | 🚀 **+20% faster** |

### 💰 Coin Earning Performance

- Mỗi vòng: **+15 coins**
- Mỗi giờ: **~540–630 coins** (tăng 20%)
- Đạt **1000 coins**: ~1.5–2 giờ (~67 vòng)
- **Peak Performance**: 700+ coins/hour
- Đạt **5000 coins**: ~8–10 giờ (~334 vòng)
- Đạt **10000 coins**: ~16–20 giờ (~667 vòng)

---

## 🎛️ Tính năng chính v2.4

### 🆕 **New Features**

| Tính năng | Mô tả | Trạng thái |
|----------|-------|------------|
| 🔄 **Two-Stage Startup** | Setup một lần, runtime tự động | ✅ **NEW** |
| 🎛️ **Unified Settings Menu** | Gộp tất cả tính năng vào dropdown | ✅ **NEW** |
| 📊 **Smart Runtime Calculation** | Chỉ tính thời gian từ khi bắt đầu auto | ✅ **NEW** |
| 🔐 **Username/Email Support** | Hỗ trợ cả username và email login | ✅ **NEW** |
| 🛡️ **Enhanced Error Handling** | Graceful recovery, no blocking alerts | ✅ **NEW** |
| 📤 **Data Export/Import** | Backup và restore dữ liệu | ✅ **NEW** |

### 🔧 **Core Features**

| Tính năng | Mô tả | Cải thiện |
|----------|-------|-----------|
| � **Auto Earning** | Tự động vào `/earn`, thu thập coin liên tục | ⚡ **Faster** |
| 🔐 **Auto Login** | Encrypted credentials, auto-validation | 🛡️ **Secure** |
| 🤖 **reCAPTCHA Solver** | AI audio solver với multi-server support | 🚀 **Smarter** |
| 📈 **Advanced Analytics** | Real-time stats, history, performance tracking | 📊 **Enhanced** |
| ⚙️ **Target Management** | Set goals, track progress với ETA | 🎯 **Improved** |
| 🛑 **Error Detection** | Auto detect error pages, smart recovery | 🛡️ **Robust** |
| 🎨 **Modern UI** | Clean interface, smooth animations | ✨ **Beautiful** |

---

## 🎮 Cách sử dụng Settings Menu

### ⚙️ **Unified Settings Menu v2.4**

Click nút **"⚙️ Settings"** để truy cập:

| Tính năng | Mô tả | Shortcut |
|----------|-------|----------|
| 📊 **View History** | Xem lịch sử stats và analytics | Ctrl+H |
| 🔄 **Reset Stats** | Reset cycles/coins về 0 (giữ target) | Ctrl+R |
| 🔐 **Clear Credentials** | Xóa thông tin đăng nhập | Ctrl+C |
| 📤 **Export Data** | Xuất tất cả data ra JSON file | Ctrl+E |
| 🗑️ **Clear All Data** | Reset hoàn toàn + auto reload | Ctrl+D |

### 🎯 **Smart Actions**

- **Clear All Data từ /earn, /home**: Auto logout → reload
- **Clear All Data từ /login**: Chỉ reload
- **Export Data**: Tự động tạo file `ateex-data-YYYY-MM-DD.json`
- **Reset Stats**: Restart runtime calculation từ 0

---

## ⚠️ Lưu ý quan trọng v2.4

### 🔒 **Bảo mật**
- 🔑 Credentials được mã hóa AES-256 trong localStorage
- 🛡️ Hỗ trợ cả username và email login
- 🔄 Auto-validation và cleanup credentials không hợp lệ
- 🚫 Không có blocking alerts - graceful error handling

### 🚀 **Performance**
- ⚡ Tối ưu hóa 20% faster so với v2.0
- 🧠 AI reCAPTCHA solver với multi-server failover
- 📊 Real-time stats không ảnh hưởng performance
- 🔄 Smart retry mechanisms với exponential backoff

### 💡 **Best Practices**
- ⛔ Không mở nhiều tab script cùng lúc
- � Để script chạy ổn định, tránh can thiệp thủ công
- 💾 Thường xuyên export data để backup
- 🎯 Set target hợp lý để theo dõi progress

---

## 👨‍💻 Tác giả & Credits

- 👤 **phmyhu_1710** (PTH Huy) - Main Developer
- 📧 GitHub: [SmallFCraft](https://github.com/SmallFCraft)
- 🧠 reCAPTCHA Solver: [Origami](https://gist.github.com/origamiofficial/2557dd47fb0aaf08e3c298a236bfa14d)
- 🎨 UI/UX Design: Modern responsive interface
- 🔧 Version 2.4: Major refactor với advanced features

---

## 📜 License

MIT License © 2025 - SmallFCraft

---

## ⭐ Support & Feedback

> 🌟 **Nếu script hữu ích, hãy star repo để ủng hộ development!**
>
> 🐛 **Bug reports**: Tạo issue trên GitHub với log details
>
> 💡 **Feature requests**: Welcome! Đóng góp ý tưởng qua GitHub Issues
