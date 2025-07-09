# Ateex Auto Script - Module System

## 🚀 Tổng quan

Hệ thống module cho phép bạn tách script Tampermonkey thành các phần nhỏ, load từ GitHub để:
- ✅ Giảm kích thước script chính
- ✅ Dễ dàng cập nhật từng module riêng lẻ  
- ✅ Quản lý version tốt hơn
- ✅ Chia sẻ modules giữa các script khác nhau
- ✅ Cache tự động để tăng tốc độ load

## 📁 Cấu trúc thư mục GitHub

```
your-repo/
├── core-script-with-loader.js          # Script chính cho Tampermonkey
├── modules/
│   ├── recaptcha-solver.js             # Module giải reCAPTCHA
│   ├── ui-manager.js                   # Module quản lý UI
│   ├── stats-system.js                 # Module thống kê
│   ├── credentials-manager.js          # Module quản lý đăng nhập
│   └── page-handlers.js                # Module xử lý các trang
├── config/
│   └── module-config.json              # Cấu hình modules
└── README.md
```

## 🛠️ Cách sử dụng

### Bước 1: Setup GitHub Repository

1. Upload các file vào repository GitHub của bạn
2. Đảm bảo repository là **public** để có thể truy cập raw files
3. Cập nhật URL trong `core-script-with-loader.js`:

```javascript
const MODULE_CONFIG = {
  baseUrl: "https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main",
  fallbackUrl: "https://cdn.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@main",
  // ...
};
```

### Bước 2: Cài đặt Script chính

1. Copy nội dung file `core-script-with-loader.js`
2. Tạo script mới trong Tampermonkey
3. Paste và save

### Bước 3: Tạo Modules

Mỗi module là một file JavaScript riêng biệt trong thư mục `/modules/`:

```javascript
// modules/example-module.js
(function() {
  "use strict";
  
  log("Loading Example Module...", "INFO");
  
  // Your module code here
  function exampleFunction() {
    log("Example function called!", "SUCCESS");
  }
  
  // Export to global scope
  window.exampleFunction = exampleFunction;
  
  log("Example Module loaded successfully!", "SUCCESS");
})();
```

## 🔧 Cấu hình Modules

Trong `core-script-with-loader.js`, cập nhật `MODULE_CONFIG.modules`:

```javascript
modules: {
  "module-name": {
    path: "/modules/module-file.js",
    required: true,  // true = bắt buộc, false = tùy chọn
    description: "Module description"
  }
}
```

## 📦 URLs hỗ trợ

### GitHub Raw (Primary)
```
https://raw.githubusercontent.com/USERNAME/REPO/main/modules/module.js
```

### JSDelivr CDN (Fallback)
```
https://cdn.jsdelivr.net/gh/USERNAME/REPO@main/modules/module.js
```

## 🎯 Ví dụ thực tế

### 1. Tách reCAPTCHA Solver

**Trước (trong script chính):**
```javascript
// 500+ dòng code reCAPTCHA solver
function solveRecaptcha() { /* ... */ }
```

**Sau (module riêng):**
```javascript
// modules/recaptcha-solver.js
(function() {
  // 500+ dòng code reCAPTCHA solver
  window.solveRecaptcha = solveRecaptcha;
})();
```

### 2. Tách UI Manager

```javascript
// modules/ui-manager.js
(function() {
  function createCounterUI() { /* ... */ }
  function updateCounter() { /* ... */ }
  
  window.createCounterUI = createCounterUI;
  window.updateCounter = updateCounter;
})();
```

## 🚀 Tính năng nâng cao

### Cache System
- Modules được cache 24h để tăng tốc độ
- Tự động kiểm tra version và update
- Clear cache: `window.ateexModuleLoader.clearCache()`

### Error Handling
- Fallback URLs tự động
- Retry mechanism
- User-friendly error messages

### Hot Reload
```javascript
// Reload specific module
await window.ateexModuleLoader.loadModule('module-name');

// Reload all modules
await window.ateexModuleLoader.loadAllModules();
```

## 🔍 Debug & Monitoring

### Console Commands
```javascript
// Check loaded modules
console.log(window.ateexGlobalState.modulesLoaded);

// Check module loader
console.log(window.ateexModuleLoader);

// Clear cache and reload
window.ateexModuleLoader.clearCache();
location.reload();
```

### Log Levels
- `INFO` - Thông tin chung
- `SUCCESS` - Thành công  
- `WARNING` - Cảnh báo
- `ERROR` - Lỗi
- `DEBUG` - Debug chi tiết

## 📋 Checklist Migration

- [ ] Tạo GitHub repository public
- [ ] Upload core script và modules
- [ ] Cập nhật URLs trong config
- [ ] Test load modules thành công
- [ ] Verify cache hoạt động
- [ ] Test fallback URLs
- [ ] Kiểm tra error handling

## 🆘 Troubleshooting

### Module không load được
1. Kiểm tra URL có đúng không
2. Đảm bảo repository là public
3. Check console để xem lỗi cụ thể
4. Thử clear cache: `window.ateexModuleLoader.clearCache()`

### Cache issues
```javascript
// Clear specific module cache
GM_setValue('ateex_module_MODULE_NAME_3.0', undefined);

// Clear all cache
window.ateexModuleLoader.clearCache();
```

### Network issues
- Script sẽ tự động thử fallback URL (JSDelivr)
- Timeout: 10 giây cho mỗi request
- Retry với server khác nếu thất bại

## 🎉 Lợi ích

1. **Kích thước nhỏ**: Script chính chỉ còn ~300 dòng thay vì 4000+
2. **Cập nhật dễ dàng**: Chỉ cần push lên GitHub
3. **Modular**: Tắt/bật modules theo nhu cầu
4. **Performance**: Cache giúp load nhanh hơn
5. **Maintainable**: Code được tổ chức tốt hơn

## 📞 Support

Nếu có vấn đề, hãy:
1. Check console logs
2. Verify GitHub URLs
3. Test với browser developer tools
4. Clear cache và thử lại
