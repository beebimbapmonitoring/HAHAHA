# HiveMind - T. biroi Colony Monitoring System

**A specialized IoT & ML monitoring system for the Philippines' native stingless bee (*Tetragonula biroi*)**

---

## 🐝 Overview

HiveMind is a real-time monitoring dashboard that uses audio and video analysis with machine learning to detect colony stress and intrusions without breaking the propolis seal that stingless bees depend on for temperature regulation.

### Key Features

- ✅ **Real-time Sensor Monitoring**: Temperature, humidity, weight, and acoustic analysis
- ✅ **Live Audio Spectrogram**: Frequency analysis with stress detection
- ✅ **Video Analysis**: Entrance monitoring with intrusion detection
- ✅ **Alert System**: Visual + audio alarms for critical events
- ✅ **Detailed Analytics**: Historical trends for all sensor data
- ✅ **Data Export**: CSV export with timestamps for analysis
- ✅ **Smart Log Management**: Auto-clear logs after export

---

## 🏗️ Project Structure

```
WEBSITE/
├── index.html          # Main dashboard HTML
├── style.css           # Global styling (Dark/Light/Forest themes)
├── script.js           # Dashboard functionality & logic
├── README.md           # This file
└── .gitignore          # Git ignore rules
```

---

## 🚀 Quick Start

### View Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/HiveMind.git
   cd HiveMind
   ```

2. **Open in browser** (No build process required!)
   - Windows: Double-click `index.html`
   - Or open with any browser: `File > Open File > index.html`
   - Or use a local server:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Python 2
     python -m SimpleHTTPServer 8000
     
     # Node.js (http-server)
     npx http-server
     ```

3. **Login**
   - Email: `keeper@example.com` (or any `@gmail.com` email)
   - Password: `hive123`

### View on GitHub Pages (Optional)

To host directly from GitHub:

1. Go to **Settings > Pages** in your repository
2. Set **Source** to `main` branch / `root` folder
3. Your site will be live at: `https://yourusername.github.io/HiveMind/`

---

## 📋 Features & Usage

### Dashboard Sections

| Feature | Description |
|---------|-------------|
| **Microclimate Trends** | Real-time graph of temperature & humidity |
| **Temperature Card** | Click for detailed 50-point temperature history |
| **Humidity Card** | Click for detailed 50-point humidity history |
| **Honey Weight** | Click for weight accumulation trend |
| **Audio ML** | Real-time spectrogram + stress detection logs |
| **Video Feed** | Entrance monitoring with event detection |
| **Logs** | All system events with ML confidence scores |
| **Profile** | Keeper identity & avatar customization |
| **Settings** | Theme switching (Dark/Light/Forest) |

### Alert System

- 🔊 **Audio Alarm**: Dual-frequency pulsing alarm (800Hz + 600Hz)
- 🚨 **Modal Alert**: Large red alert box with timestamp
- 📊 **Quick Access**: Direct link to audio event logs
- ⏱️ **Auto-dismiss**: Alert closes after acknowledgment

### Data Management

- 📥 **CSV Export**: Download all logs with full timestamps
- 🗑️ **Smart Cleanup**: Optional log deletion after export
- 📍 **Persistent Storage**: Uses browser `localStorage` for profile & themes

---

## 🔧 Technology Stack

### Frontend
- **HTML5** - Semantic structure
- **CSS3** - Glass-morphism design with animations
- **JavaScript (Vanilla)** - No frameworks, pure ES6+

### External Libraries
- **Chart.js** - Real-time data visualization
- **Google Fonts** - Outfit, Poppins, Roboto Mono
- **Font Awesome 6.4** - Icons (CDN)

### Browser APIs Used
- Web Audio API (for alarm sound)
- Canvas API (spectrogram visualization)
- LocalStorage API (persistent settings)
- Geolocation API (optional future use)

---

## 🎨 Themes

Switch between three beautiful themes:

| Theme | Colors | Best For |
|-------|--------|----------|
| **Dark** 🌑 | Gold & Brown | Night monitoring, eye comfort |
| **Light** ☁️ | Gray & Blue | Daytime use, bright environments |
| **Forest** 🍃 | Green & Cream | Natural, outdoor feel |

---

## 📱 Responsive Design

- ✅ Desktop (1920px+)
- ✅ Tablet (768px - 1024px)
- ✅ Mobile (360px - 768px)

---

## 🔐 Security Notes

### Current Status
- ⚠️ **Development Only**: Password is hardcoded for demo
- ⚠️ **No Backend**: Data stored in browser only
- ⚠️ **No Encryption**: Not suitable for production

### For Production Deployment

You'll need to add:
1. **Backend Server** (Node.js, Python, etc.)
   - User authentication with hashed passwords
   - Secure API endpoints
   - Database (PostgreSQL, MongoDB, etc.)

2. **HTTPS/SSL Certificate**
   - Required for Web Audio API in production
   - Use services like Let's Encrypt (free)

3. **Environment Variables**
   - Move API keys to `.env` file
   - Use `.gitignore` to prevent exposing secrets

4. **Authentication**
   - JWT tokens or OAuth2
   - Secure session management

Example backend structure:
```
├── server/
│   ├── app.py (or index.js)
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── config/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── requirements.txt (or package.json)
```

---

## 📊 API Endpoints (For Future Backend)

```
POST   /api/auth/login        - User login
POST   /api/auth/logout       - User logout
GET    /api/sensors           - Get real-time sensor data
GET    /api/logs              - Get system logs
POST   /api/logs/export       - Export logs as CSV
DELETE /api/logs              - Clear logs
GET    /api/analytics/:type   - Get detailed analytics
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Test all card clicks (temperature, humidity, weight, audio, video)
- [ ] Verify CSV export downloads correctly
- [ ] Check alert triggers with console command:
  ```javascript
  showAcousticAlert('Test Alert');
  ```
- [ ] Test all three themes switch properly
- [ ] Verify responsive design on mobile
- [ ] Check localStorage persistence (refresh page)
- [ ] Test audio logs capture

### Console Testing Commands

```javascript
// Trigger alert manually
showAcousticAlert('🚨 TEST: Intrusion Detected!');

// Update audio level to "High"
document.getElementById('audio-display').innerText = 'High';

// Open detailed graph
openDetailedGraphOnCardClick('temp');

// Open audio modal
openAudioModal();

// Export data
exportData();

// Clear all logs
clearAllLogs();
```

---

## 📁 File Sizes

```
index.html  ~16 KB  (with all modals)
style.css   ~50 KB  (with responsive design)
script.js   ~30 KB  (with all features)
```

**Total**: ~96 KB (loads instantly)

---

## 🌐 Deployment Options

### 1. GitHub Pages (Free, Static)
- ✅ Perfect for this project
- ✅ Auto-deploy on push
- ✅ No server costs
- ⚠️ Limited to static files only

**Setup:**
```bash
git remote add origin https://github.com/yourusername/HiveMind.git
git branch -M main
git push -u origin main
```

Then enable Pages in repo settings.

### 2. Netlify (Free)
- ✅ Better build tools
- ✅ Form handling available
- ✅ Environmental variables supported

### 3. Vercel (Free)
- ✅ Optimized for static sites
- ✅ Global CDN
- ✅ Analytics included

### 4. Traditional Server (Paid)
- ✅ Full backend support
- ✅ Database integration
- ✅ Custom domain
- Uses: AWS, DigitalOcean, Heroku, etc.

---

## 📝 License

MIT License - Feel free to use for educational and personal projects.

---

## 👥 Team

**BS Electronics Engineering • Academic Year 2025-2026**

- Aguinido, Marinelle P.
- Barela, Danica Jane L.
- Espiritu, Glenda Theresa C.
- Gironella, Juan Carlo C.
- Obumani, Mark Dennis B.
- Rabonza, Stephen Dave P.

---

## 📞 Support

For issues or questions:
1. Check the [GitHub Issues](../../issues) page
2. Review the code comments in `script.js`
3. Test with browser DevTools (F12)

---

## 🐝 About *Tetragonula biroi*

The stingless bee (*Tetragonula biroi*) is:
- **Native** to the Philippines
- **Pollinators** of dipterocarp forests and fruit trees
- **Unique**: Store honey in cerumen pots (not combs)
- **Defenseless**: Bite and seal intruders in propolis
- **Critical**: Regulated by their propolis structures for temperature control

This project aims to protect these vital pollinators! 🌿

---

**Last Updated**: December 24, 2025  
**Status**: ✅ Full Featured
