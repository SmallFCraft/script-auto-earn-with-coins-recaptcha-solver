# 🚀 Ateex Cloud Auto Script with reCAPTCHA Solver

An automated Tampermonkey script for Ateex Cloud that automatically earns coins by completing Clickcoin tasks with integrated reCAPTCHA solving capabilities.

## ✨ Features

### 🎯 Core Automation
- **Auto Login**: Automatically fills credentials and solves reCAPTCHA
- **Auto Earn**: Clicks Clickcoin Start button and handles popup ads
- **Auto Logout**: Clears browser data and cycles back to login
- **Smart Flow**: Seamless navigation between /login → /home → /earn → /logout

### 🧠 reCAPTCHA Solver
- **Integrated Audio Solver**: Automatically solves reCAPTCHA using audio challenges
- **Multiple Servers**: Uses backup servers for reliability
- **Cross-Frame Communication**: Syncs between iframe and main page
- **Smart Detection**: Prevents duplicate solver instances

### 📊 Real-time Stats Counter
- **Live Tracking**: Displays cycles, coins, runtime, and rates
- **ETA Calculator**: Shows estimated time to reach 1000 coins
- **Persistent Data**: Stats saved across browser sessions
- **Beautiful UI**: Gradient design with blur effects

### 🛡️ Safety Features
- **Popup Management**: Handles ads popups automatically
- **Error Handling**: Robust error recovery and logging
- **Data Preservation**: Protects stats during browser data clearing
- **Single Instance**: Prevents multiple script instances

## 📈 Performance Stats

### ⏱️ Timing per Cycle
- **Earn Page**: 5s wait + 7s ads = 12s
- **Login Page**: 5-10s wait + 45s captcha = 55s  
- **Home Page**: 2-4s redirect = 3s
- **Total**: ~70s per cycle (1.2 minutes)

### 💰 Coin Earning Rates
- **Per Cycle**: 15 coins
- **Per Hour**: ~770 coins
- **1000 coins**: ~1.3 hours (77 cycles)
- **5000 coins**: ~6.5 hours (334 cycles)
- **10000 coins**: ~13 hours (667 cycles)

## 🚀 Installation

### Prerequisites
- [Tampermonkey](https://www.tampermonkey.net/) browser extension
- Chrome, Firefox, or Edge browser
- Ateex Cloud account

### Setup Steps
1. **Install Tampermonkey** from your browser's extension store
2. **Copy the script** from `auto-ateexcloud.js`
3. **Create new script** in Tampermonkey dashboard
4. **Paste the code** and save
5. **Update credentials** in CONFIG section:
   ```javascript
   const CONFIG = {
     email: "your-email@example.com",
     password: "your-password",
   };
   ```
6. **Navigate** to https://dash.ateex.cloud and watch it work!

## 🎮 Usage

### Automatic Operation
The script runs automatically when you visit Ateex Cloud:
1. **Login**: Auto-fills credentials and solves captcha
2. **Navigate**: Goes to earn page automatically  
3. **Earn**: Clicks Clickcoin and handles popup ads
4. **Cycle**: Logs out, clears data, and repeats

### Manual Control
- **Start/Stop**: Enable/disable script in Tampermonkey
- **Monitor**: Watch the stats counter in top-right corner
- **Debug**: Check browser console for detailed logs

## 📱 User Interface

### Stats Counter Display
```
🚀 Ateex Auto Stats
Cycles: 67
Coins: 1005 💰
Runtime: 87m 23s
Avg/cycle: 78s
Rate: 690 coins/h
ETA 1000: 🎉 Goal reached!
```

### Console Logging
- `[Ateex Auto] Email filled`
- `[Ateex Auto] reCAPTCHA SOLVED successfully!`
- `[Ateex Auto] Clickcoin Start link clicked`
- `[Ateex Auto] Cycle 67 completed! Total coins: 1005`

## ⚙️ Configuration

### Login Credentials
```javascript
const CONFIG = {
  email: "your-email@example.com",    // Your Ateex email
  password: "your-password",          // Your Ateex password
};
```

### Timing Settings
- **Earn wait**: 5 seconds before clicking Start
- **Ads wait**: 7 seconds for popup ads to load
- **Login wait**: 5-10 seconds before auto-fill
- **Captcha timeout**: 60 seconds maximum

### reCAPTCHA Servers
- Primary: `https://engageub.pythonanywhere.com`
- Backup: `https://engageub1.pythonanywhere.com`

## 🔧 Technical Details

### Architecture
- **Main Script**: Handles page navigation and automation
- **reCAPTCHA Solver**: Audio-based captcha solving
- **Stats Counter**: Real-time performance tracking
- **State Management**: Cross-frame synchronization

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+ (with Tampermonkey)

### Security Features
- **Data Isolation**: Stats preserved during data clearing
- **Error Recovery**: Automatic retry on failures
- **Safe Cleanup**: Proper resource management
- **No Data Leaks**: Local storage only

## 🐛 Troubleshooting

### Common Issues

**Script not starting**
- Check Tampermonkey is enabled
- Verify script is active for the domain
- Refresh the page

**reCAPTCHA not solving**
- Wait up to 60 seconds for solver
- Check internet connection
- Verify server accessibility

**Stats not updating**
- Ensure you're on main window (not iframe)
- Check browser console for errors
- Clear localStorage and restart

**Popup ads not handled**
- Allow popups for the domain
- Check popup blocker settings
- Verify 7-second wait time

### Debug Mode
Enable detailed logging by checking browser console (F12):
```javascript
// Look for these log patterns:
[Ateex Auto] Current path: /earn
[Ateex Auto] Popup handling completed
[Ateex Auto] Cycle X completed! Total coins: Y
```

## 📝 Changelog

### Version 2.1 (Current)
- ✅ Removed complex popup detection
- ✅ Simplified timing to fixed 7-second wait
- ✅ Improved code structure and removed duplicates
- ✅ Enhanced error handling and logging
- ✅ Optimized performance and memory usage

### Version 2.0
- ✅ Added real-time stats counter with beautiful UI
- ✅ Implemented persistent data storage
- ✅ Enhanced cross-frame communication
- ✅ Improved popup management system

### Version 1.0
- ✅ Basic automation for earn/login/logout cycle
- ✅ Integrated reCAPTCHA audio solver
- ✅ Error handling and recovery

## ⚠️ Disclaimer

This script is for educational purposes only. Use responsibly and in accordance with Ateex Cloud's terms of service. The authors are not responsible for any account restrictions or violations that may result from using this script.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- reCAPTCHA solver based on [akinzen2's script](https://github.com/akinzen2/js/blob/main/Recaptcha%20Solver%20(Automatically%20solves%20Recaptcha%20in%20browser).user.js)
- Audio solving servers provided by engageub
- Tampermonkey community for userscript standards

---

**⭐ If this script helped you earn coins, please give it a star!**
