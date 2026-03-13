// ============================================
// 1. CONFIGURATION & GLOBALS
// ============================================
let socket;

const CONFIG = {
    temp: { min: 28.0, max: 33.0 },
    hum: { min: 55, max: 65 },
    weight: 14.50
};

const PI_IP = "10.120.24.103";
const RPI_URL = `http://${PI_IP}:5000/data`;
const HIVE_TARE_WEIGHT = 2.0;

let SETTINGS = { refreshRate: 2000, sensitivity: 8, audioEnabled: true };
let hiveChart, detailedChart, updateIntervalId, alarmInterval = null;
let activeOscillators = [], specAnimationId = null;
let tempHistory = [], humHistory = [], weightHistory = [], timeLabels = [];
let allLogs = [], audioLogs = [], videoLogs = [];
const MAX_HISTORY = 20;

let currentTemp = 0, currentHum = 0, currentWeight = 0;

let audioContext = null;
let audioSocket = null;
let isListening = false;

const DEFAULT_PROFILE = {
    name: "Admin",
    role: "Head Keeper",
    credentials: "Authorized Personnel",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
};

const BEE_RESOURCES = {
    pollinators: {
        title: "Forest Pollinators",
        links: [
            { name: "Wikipedia: Stingless Bee", url: "https://en.wikipedia.org/wiki/Stingless_bee", icon: "fas fa-book" }
        ]
    },
    honey: {
        title: "Medicinal Pot Honey",
        links: [
            { name: "NCBI Study", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8067784/", icon: "fas fa-microscope" }
        ]
    },
    defense: {
        title: "Propolis & Defense",
        links: [
            { name: "Wikipedia: Propolis", url: "https://en.wikipedia.org/wiki/Propolis", icon: "fas fa-shield-alt" }
        ]
    }
};

// ============================================
// 2. HELPER FUNCTIONS
// ============================================
function loadSettings() {
    const saved = JSON.parse(localStorage.getItem("hive_settings"));
    if (saved) {
        SETTINGS = { ...SETTINGS, ...saved };
    }

    const refreshEl = document.getElementById("setting-refresh");
    if (refreshEl) refreshEl.value = SETTINGS.refreshRate;

    const audioEl = document.getElementById("setting-audio");
    if (audioEl) audioEl.checked = SETTINGS.audioEnabled;

    const sensitivityEl = document.getElementById("setting-sensitivity");
    if (sensitivityEl) sensitivityEl.value = SETTINGS.sensitivity;
}

function loadProfile() {
    const saved = JSON.parse(localStorage.getItem("hive_profile")) || DEFAULT_PROFILE;
    try {
        document.getElementById("sidebar-name").innerText = saved.name;
        document.getElementById("sidebar-role").innerText = saved.role;
        document.getElementById("sidebar-avatar").src = saved.avatar;
        document.getElementById("greeting-text").innerText = `Hello, ${saved.name.split(' ')[0]}! 👋`;
        document.getElementById("nav-mini-avatar").src = saved.avatar;

        const nameInput = document.getElementById("edit-name");
        if (nameInput) nameInput.value = saved.name;

        const roleInput = document.getElementById("edit-role");
        if (roleInput) roleInput.value = saved.role;

        const credInput = document.getElementById("edit-credentials");
        if (credInput) credInput.value = saved.credentials || "";

        const avatarPrev = document.getElementById("avatar-preview");
        if (avatarPrev) avatarPrev.src = saved.avatar;
    } catch (e) {
        console.warn("Profile elements missing in DOM, skipping update.");
    }
}

function updateCamTime() {
    const el = document.getElementById('cam-time');
    if (el) {
        el.innerText = new Date().toLocaleTimeString('en-US', { hour12: false });
    }
}

function createSwarm(container, className, count) {
    if (!container) return;
    for (let i = 0; i < count; i++) {
        const b = document.createElement('div');
        b.className = className;
        b.style.left = Math.random() * 100 + 'vw';
        b.style.top = Math.random() * 100 + 'vh';
        b.style.animation = `flyAround ${5 + Math.random() * 15}s infinite linear`;
        container.appendChild(b);
    }
}

function hexToRgba(hex, alpha = 0.15) {
    if (!hex || !hex.startsWith("#")) return `rgba(255, 179, 0, ${alpha})`;
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(ch => ch + ch).join("");
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function playVideo(el, label) {
    console.log("Selected video item:", label || "LIVE FEED");
}

// ============================================
// 3. CHART & DATA FUNCTIONS
// ============================================
function initChart() {
    const canvas = document.getElementById('hiveChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    hiveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Temp', data: [], borderColor: '#ff7675', tension: 0.4, pointRadius: 0, yAxisID: 'y' },
                { label: 'Hum', data: [], borderColor: '#74b9ff', tension: 0.4, pointRadius: 0, yAxisID: 'y' },
                { label: 'Weight', data: [], borderColor: '#ffeaa7', tension: 0.4, pointRadius: 0, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10 } } },
            scales: {
                x: { display: false },
                y: { display: false, position: 'left' },
                y1: { display: false, position: 'right', grid: { drawOnChartArea: false } }
            },
            animation: false
        }
    });
}

function initSocket() {
    if (typeof io === "undefined") {
        console.warn("Socket.IO client not loaded. Skipping socket init.");
        return;
    }

    socket = io(`ws://${PI_IP}:5000`);

    socket.on('connect', () => console.log('Socket connected:', socket.id));

    socket.on('sensor-update', (data) => {
        currentTemp = parseFloat(data.temp).toFixed(1);
        currentHum = parseFloat(data.hum).toFixed(0);

        let netW = parseFloat(data.weight) - HIVE_TARE_WEIGHT;
        if (netW < 0) netW = 0;
        currentWeight = netW.toFixed(2);

        const tempEl = document.getElementById('temp-display');
        const humEl = document.getElementById('hum-display');
        const weightEl = document.getElementById('weight-display');

        if (tempEl) tempEl.innerText = currentTemp + "°C";
        if (humEl) humEl.innerText = currentHum + "%";
        if (weightEl) weightEl.innerText = currentWeight + " kg";

        updateChart(currentTemp, currentHum, currentWeight);
    });
}

function updateChart(temp, hum, weight) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    timeLabels.push(time);
    tempHistory.push(parseFloat(temp));
    humHistory.push(parseFloat(hum));
    weightHistory.push(parseFloat(weight));

    if (timeLabels.length > MAX_HISTORY) {
        timeLabels.shift();
        tempHistory.shift();
        humHistory.shift();
        weightHistory.shift();
    }

    if (hiveChart) {
        hiveChart.data.labels = timeLabels;
        hiveChart.data.datasets[0].data = tempHistory;
        hiveChart.data.datasets[1].data = humHistory;
        hiveChart.data.datasets[2].data = weightHistory;
        hiveChart.update('none');
    }
}

async function updateData() {
    let t = 0, h = 0, rawW = 0, soundStatus = "Normal";
    let isOffline = false;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const response = await fetch(RPI_URL, {
            signal: controller.signal,
            headers: { "ngrok-skip-browser-warning": "true" }
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("RPi Error");

        const data = await response.json();
        t = parseFloat(data.temp).toFixed(1);
        h = parseFloat(data.hum).toFixed(0);
        rawW = parseFloat(data.weight);
        soundStatus = data.sound_status || "Normal";
    } catch (error) {
        console.error("Connection Failed:", error);
        isOffline = true;
        t = "--";
        h = "--";
        rawW = 0;
    }

    let netW = 0, displayW = "--";
    if (!isNaN(rawW) && !isOffline) {
        netW = rawW - HIVE_TARE_WEIGHT;
        if (netW < 0) netW = 0;
        displayW = netW.toFixed(2);
    }

    currentTemp = t;
    currentHum = h;
    currentWeight = displayW;

    const tempDisplayEl = document.getElementById('temp-display');
    const humDisplayEl = document.getElementById('hum-display');
    const weightDisplayEl = document.getElementById('weight-display');
    const audioDisplay = document.getElementById('audio-display');

    if (tempDisplayEl) tempDisplayEl.innerText = t + "°C";
    if (humDisplayEl) humDisplayEl.innerText = h + "%";
    if (weightDisplayEl) weightDisplayEl.innerText = displayW + " kg";
    if (audioDisplay) audioDisplay.innerText = soundStatus;

    if (audioDisplay) {
        if (soundStatus === "Aggressive") {
            audioDisplay.style.color = "#ff4757";
            if (!alarmInterval) showAcousticAlert("⚠️ AGGRESSIVE SOUND DETECTED!");
        } else {
            audioDisplay.style.color = "#2ecc71";
        }
    }

    if (tempDisplayEl) {
        if (!isOffline && parseFloat(t) > CONFIG.temp.max) {
            tempDisplayEl.style.color = "#ff4757";
            if (!alarmInterval) showAcousticAlert(`🔥 HIGH HEAT: ${t}°C`);
        } else {
            tempDisplayEl.style.color = "";
        }
    }

    if (!isOffline) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        timeLabels.push(time);
        tempHistory.push(parseFloat(t));
        humHistory.push(parseFloat(h));
        weightHistory.push(netW);

        if (timeLabels.length > MAX_HISTORY) {
            timeLabels.shift();
            tempHistory.shift();
            humHistory.shift();
            weightHistory.shift();
        }

        if (hiveChart) {
            hiveChart.data.labels = timeLabels;
            hiveChart.data.datasets[0].data = tempHistory;
            hiveChart.data.datasets[1].data = humHistory;
            hiveChart.data.datasets[2].data = weightHistory;
            hiveChart.update('none');
        }

        const detailedModal = document.getElementById('detailed-graph-modal');
        if (detailedChart && detailedModal && !detailedModal.classList.contains('hidden')) {
            const title = document.getElementById('detailed-graph-title').innerText;
            if (title.includes('Temperature')) updateDetailedChart(tempHistory, timeLabels);
            else if (title.includes('Humidity')) updateDetailedChart(humHistory, timeLabels);
            else if (title.includes('Weight')) updateDetailedChart(weightHistory, timeLabels);
        }
    }

    if (!isOffline && Math.random() > 0.8) {
        let logStatus = (soundStatus === "Aggressive") ? "Warning" : "Normal";
        let logEvent = (soundStatus === "Aggressive") ? "Audio: Aggressive" : "Traffic: Foraging";

        if (parseFloat(t) > CONFIG.temp.max) {
            logStatus = "Warning";
            logEvent = "Env: High Temp";
        }

        const statusClass = logStatus === "Normal" ? "badge-normal" : "badge-warning";
        const tbody = document.querySelector("#logs-table tbody");

        if (tbody) {
            const row = `
                <tr>
                    <td>${new Date().toLocaleTimeString()}</td>
                    <td>${logEvent}</td>
                    <td class="conf-text">98%</td>
                    <td><span class="log-badge ${statusClass}">${logStatus}</span></td>
                </tr>
            `;
            tbody.insertAdjacentHTML('afterbegin', row);
            if (tbody.rows.length > 8) tbody.deleteRow(8);
        }

        allLogs.unshift({
            timestamp: new Date().toLocaleString(),
            eventType: logEvent,
            value: `${t}°C | ${displayW}kg`,
            status: logStatus
        });
    }
}

function startDataUpdates() {
    if (updateIntervalId) clearInterval(updateIntervalId);
    let rate = SETTINGS.refreshRate || 2000;
    updateIntervalId = setInterval(updateData, rate);
}

// ============================================
// 4. ACTION FUNCTIONS
// ============================================
function manualRefresh() {
    const icon = document.querySelector('.refresh-btn-global i');
    if (icon) icon.classList.add('fa-spin');

    updateData().then(() => {
        setTimeout(() => {
            if (icon) icon.classList.remove('fa-spin');
        }, 800);
    });
}

function toggleDashboardMenu() {
    const menu = document.getElementById('dashboard-mobile-dropdown');
    if (menu) menu.classList.toggle('hidden');
}

function saveSettings() {
    const refreshEl = document.getElementById("setting-refresh");
    const audioEl = document.getElementById("setting-audio");
    const sensitivityEl = document.getElementById("setting-sensitivity");

    if (refreshEl) SETTINGS.refreshRate = parseInt(refreshEl.value);
    if (audioEl) SETTINGS.audioEnabled = audioEl.checked;
    if (sensitivityEl) SETTINGS.sensitivity = parseInt(sensitivityEl.value);

    localStorage.setItem("hive_settings", JSON.stringify(SETTINGS));
    startDataUpdates();
    alert("✅ Settings Saved!");
}

function resetSettings() {
    localStorage.removeItem("hive_settings");
    location.reload();
}

function exportData() {
    if (allLogs.length === 0) {
        alert("⚠️ No logs to export!");
        return;
    }

    let csvContent = "Timestamp,Event,Value,Status\n";
    allLogs.forEach(log => {
        csvContent += `"${log.timestamp}","${log.eventType}","${log.value}","${log.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `hive_data_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function openDetailedGraphOnCardClick(type) {
    const modal = document.getElementById('detailed-graph-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

    let title, color, dataArray;
    if (type === 'temp') {
        title = 'Temperature Trend';
        color = '#ff7675';
        dataArray = tempHistory;
    } else if (type === 'humidity') {
        title = 'Humidity Trend';
        color = '#74b9ff';
        dataArray = humHistory;
    } else if (type === 'weight') {
        title = 'Weight Trend';
        color = '#ffeaa7';
        dataArray = weightHistory;
    } else {
        return;
    }

    document.getElementById('detailed-graph-title').innerText = title;

    if (detailedChart) detailedChart.destroy();

    const canvas = document.getElementById('detailedChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    detailedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: title,
                data: dataArray,
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.15),
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: color
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false } }
        }
    });

    updateDetailedStats(dataArray);
}

function updateDetailedChart(dataArray, labels) {
    if (detailedChart) {
        detailedChart.data.labels = labels;
        detailedChart.data.datasets[0].data = dataArray;
        detailedChart.update('none');
        updateDetailedStats(dataArray);
    }
}

function updateDetailedStats(dataArray) {
    if (!dataArray || dataArray.length === 0) return;

    const nums = dataArray
        .map(n => parseFloat(n))
        .filter(n => !isNaN(n));

    if (nums.length === 0) return;

    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = (sum / nums.length).toFixed(2);

    document.getElementById('graph-current').innerText = nums[nums.length - 1].toFixed(2);
    document.getElementById('graph-max').innerText = Math.max(...nums).toFixed(2);
    document.getElementById('graph-min').innerText = Math.min(...nums).toFixed(2);
    document.getElementById('graph-avg').innerText = avg;
}

function closeDetailedGraphModal() {
    document.getElementById('detailed-graph-modal').classList.add('hidden');
}

// ============================================
// 5. STANDARD MODALS & NAVIGATION
// ============================================
function switchPublicTab(tabId) {
    document.querySelectorAll('.public-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    if (tabId === 'hero') window.scrollTo(0, 0);
}

function toggleMobileMenu() {
    document.getElementById('mobile-public-menu').classList.toggle('hidden');
}

function mobileNavClick(tabId) {
    switchPublicTab(tabId);
    toggleMobileMenu();
}

function goToLogin() {
    document.getElementById("landing-view").classList.add("hidden");
    document.getElementById("login-view").classList.remove("hidden");
    document.getElementById("mobile-nav-bar").classList.add("hidden");
}

function backToHome() {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("landing-view").classList.remove("hidden");
}

function attemptLogin() {
    const email = document.getElementById("email-input").value.trim().toLowerCase();
    const password = document.getElementById("password-input").value.trim();

    if (email.endsWith("@gmail.com") && password === "hive123") {
        localStorage.setItem("hive_isLoggedIn", "true");
        location.reload();
    } else {
        document.getElementById("login-error").classList.remove("hidden");
    }
}

function logout() {
    localStorage.removeItem("hive_isLoggedIn");
    location.reload();
}

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById('view-' + tabId).classList.remove('hidden');

    document.querySelectorAll('.nav-menu li, .nav-bottom li, .mobile-nav div').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item-' + tabId).forEach(item => item.classList.add('active'));
}

// ============================================
// 6. VIDEO & AUDIO STREAMING
// ============================================
function openVideoModal() {
    document.getElementById('video-modal').classList.remove('hidden');

    const imgElement = document.getElementById('cctv-feed');
    if (imgElement) {
        const streamUrl = `http://${PI_IP}:5000/video_feed?t=${new Date().getTime()}`;
        imgElement.src = streamUrl;
        imgElement.style.display = 'block';

        const errorMsg = document.getElementById('video-error-msg');
        if (errorMsg) errorMsg.remove();
    }
}

function closeVideoModal() {
    document.getElementById('video-modal').classList.add('hidden');
    const imgElement = document.getElementById('cctv-feed');
    if (imgElement) imgElement.src = "";
    stopAudio();
}

function toggleAudio() {
    let audioTag = document.getElementById('live-audio-player');
    const btnText = document.getElementById('audio-btn-text');
    const audioIcon = document.getElementById('audio-icon');
    const statusLabel = document.getElementById('audio-level-label');

    if (!audioTag) {
        audioTag = document.createElement('audio');
        audioTag.id = 'live-audio-player';
        audioTag.style.display = 'none';
        document.body.appendChild(audioTag);
    }

    if (!isListening) {
        audioTag.src = `http://${PI_IP}:5000/audio_feed?t=${Date.now()}`;

        audioTag.play().then(() => {
            isListening = true;
            if (btnText) btnText.innerText = "STOP LISTENING";
            if (audioIcon) audioIcon.className = "fas fa-volume-up";
            if (statusLabel) statusLabel.innerText = "Status: Live";
            console.log("🔊 Audio Stream Started via HTTP");
        }).catch(err => {
            console.error("Audio Playback Failed:", err);
            alert("Please interact with the page first to enable audio.");
        });
    } else {
        audioTag.pause();
        audioTag.src = "";
        audioTag.load();
        isListening = false;
        if (btnText) btnText.innerText = "LISTEN LIVE";
        if (audioIcon) audioIcon.className = "fas fa-volume-mute";
        if (statusLabel) statusLabel.innerText = "Status: Muted";
        console.log("🔇 Audio Stream Stopped");
    }
}

function playRawAudioBuffer(data) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const audioData = new Int16Array(data);
    const floatData = new Float32Array(audioData.length);

    for (let i = 0; i < audioData.length; i++) {
        floatData[i] = audioData[i] / 32768.0;
    }

    const buffer = audioContext.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
}

function stopAudio() {
    if (audioSocket) {
        audioSocket.close();
        audioSocket = null;
    }

    const audioTag = document.getElementById('live-audio-player');
    if (audioTag) {
        audioTag.pause();
        audioTag.src = "";
        audioTag.load();
    }

    isListening = false;

    const btnText = document.getElementById('audio-btn-text');
    const audioIcon = document.getElementById('audio-icon');
    const statusLabel = document.getElementById('audio-level-label');

    if (btnText) btnText.innerText = "LISTEN LIVE";
    if (audioIcon) audioIcon.className = "fas fa-volume-mute";
    if (statusLabel) statusLabel.innerText = "Status: Muted";
}

// ============================================
// 7. VIDEO ERROR HANDLING
// ============================================
function setupVideoErrorHandling() {
    const img = document.getElementById('cctv-feed');
    if (!img) return;

    img.onerror = function () {
        this.style.display = 'none';

        let err = document.getElementById('video-error-msg');
        if (!err) {
            err = document.createElement('p');
            err.id = 'video-error-msg';
            err.style.color = '#ff4757';
            err.style.textAlign = 'center';
            err.style.marginTop = '20px';
            err.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Stream Offline. Retrying...`;
            this.parentElement.appendChild(err);
        }

        setTimeout(() => {
            const modal = document.getElementById('video-modal');
            if (modal && !modal.classList.contains('hidden')) {
                const freshUrl = RPI_URL.replace('/data', '/video_feed') + "?t=" + new Date().getTime();
                this.src = freshUrl;
            }
        }, 3000);
    };

    img.onload = function () {
        this.style.display = 'block';
        const err = document.getElementById('video-error-msg');
        if (err) err.remove();
    };
}

// ============================================
// 8. OTHERS
// ============================================
function openAudioModal() {
    document.getElementById('audio-modal').classList.remove('hidden');
    populateAudioLogs();
    if (specAnimationId) cancelAnimationFrame(specAnimationId);

    setTimeout(() => {
        const canvas = document.getElementById('spectrogramCanvas');
        if (canvas) animateSpectrogram(canvas);
    }, 100);
}

function closeAudioModal() {
    document.getElementById('audio-modal').classList.add('hidden');
    if (specAnimationId) cancelAnimationFrame(specAnimationId);
}

function populateAudioLogs() {
    const container = document.getElementById('audio-events-list');
    if (!container) return;

    container.innerHTML = '';

    if (audioLogs.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No audio events recorded</div>';
        return;
    }

    audioLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'audio-event-item';
        div.innerHTML = `
            <div class="timestamp">${log.timestamp}</div>
            <div class="event-type">
                <span>${log.eventType}</span>
                <span class="stress-indicator ${log.stressLevel === 'Normal' ? 'stress-normal' : 'stress-high'}">${log.stressLevel}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function closeAlertModal() {
    document.getElementById('alert-modal').classList.add('hidden');
    document.getElementById('alert-notification').classList.add('hidden');
    stopAlarmSound();
}

function viewAudioLogs() {
    closeAlertModal();
    openAudioModal();
}

function showAcousticAlert(message) {
    const notif = document.getElementById('alert-notification');
    const modal = document.getElementById('alert-modal');
    const msg = document.getElementById('alert-modal-message');
    const ts = document.getElementById('alert-timestamp');

    if (notif) notif.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
    if (msg) msg.innerText = message;
    if (ts) ts.innerText = `⏰ ${new Date().toLocaleTimeString()}`;

    if (SETTINGS.audioEnabled) playAlarmSound();
}

function playAlarmSound() {
    if (alarmInterval) return;

    const playPulse = () => {
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ac.createOscillator();
            const g = ac.createGain();

            osc.connect(g);
            g.connect(ac.destination);

            osc.frequency.value = 800;
            g.gain.setValueAtTime(0.3, ac.currentTime);

            osc.start();
            osc.stop(ac.currentTime + 0.2);

            activeOscillators.push(osc);
            setTimeout(() => { activeOscillators = []; }, 300);
        } catch (e) {}
    };

    playPulse();
    alarmInterval = setInterval(playPulse, 1000);
}

function stopAlarmSound() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }

    activeOscillators.forEach(osc => {
        try { osc.stop(); } catch (e) {}
    });

    activeOscillators = [];
}

function openLinksModal(key) {
    const data = BEE_RESOURCES[key];
    if (!data) return;

    document.getElementById('links-modal-title').innerText = data.title;
    const list = document.getElementById('links-list-container');
    list.innerHTML = '';

    data.links.forEach(l => {
        const i = document.createElement('a');
        i.href = l.url;
        i.target = "_blank";
        i.className = "resource-item";
        i.innerHTML = `<div class="res-info"><h4>${l.name}</h4><p>Click to view</p></div><i class="${l.icon} res-icon"></i>`;
        list.appendChild(i);
    });

    document.getElementById('links-modal').classList.remove('hidden');
}

function closeLinksModal() {
    document.getElementById('links-modal').classList.add('hidden');
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('avatar-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function openSensorModal() {}
function closeSensorModal() {
    document.getElementById('sensor-modal').classList.add('hidden');
}

function animateSpectrogram(canvas) {
    if (!canvas || !canvas.parentElement) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const barCount = 64;
    const barWidth = width / barCount;
    const time = Date.now() / 100;

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#00ffcc');
    gradient.addColorStop(0.5, '#0088ff');
    gradient.addColorStop(1, '#a000ff');
    ctx.fillStyle = gradient;

    for (let i = 0; i < barCount; i++) {
        const baseFreq = Math.sin(i * 0.2 + time) * 0.5 + 0.5;
        const randomNoise = Math.random() * 0.3;
        let barHeight = (baseFreq + randomNoise) * (height * 0.8);
        barHeight = barHeight * (1 - (i / barCount) * 0.5);
        const x = i * barWidth;
        const y = height - barHeight;
        ctx.fillRect(x, y, barWidth - 2, barHeight);
    }

    specAnimationId = requestAnimationFrame(() => animateSpectrogram(canvas));
}

// ============================================
// 9. MAIN EXECUTION START
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    const landingSwarm = document.getElementById('landing-swarm');
    if (landingSwarm) createSwarm(landingSwarm, 'landing-bee', 30);

    const dashboardSwarm = document.getElementById('dashboard-swarm');
    if (dashboardSwarm) createSwarm(dashboardSwarm, 'dashboard-bee', 20);

    const bee = document.getElementById('bee-tracker');
    if (bee) {
        document.addEventListener('mousemove', (e) => {
            const x = (window.innerWidth - e.pageX) / 25;
            const y = (window.innerHeight - e.pageY) / 25;
            bee.style.transform = `translateX(${x}px) translateY(${y}px)`;
        });
    }

    loadSettings();

    if (localStorage.getItem("hive_isLoggedIn") === "true") {
        document.getElementById("landing-view").classList.add("hidden");
        document.getElementById("dashboard-view").classList.remove("hidden");
        document.getElementById("mobile-nav-bar").classList.remove("hidden");

        loadProfile();
        initChart();
        startDataUpdates();
        setInterval(updateCamTime, 1000);
        updateData();
        setupVideoErrorHandling();
    }

    document.addEventListener('click', function(event) {
        const menu = document.getElementById('dashboard-mobile-dropdown');
        const btn = document.querySelector('.dashboard-menu-btn');

        if (
            menu &&
            btn &&
            !menu.classList.contains('hidden') &&
            !menu.contains(event.target) &&
            !btn.contains(event.target)
        ) {
            menu.classList.add('hidden');
        }
    });
});

// --- ADMIN CUSTOMIZATION LOGIC ---
function saveProfile() {
    const updatedProfile = {
        name: document.getElementById("edit-name").value || "Glenda",
        role: document.getElementById("edit-role").value || "4th Year ECE Student",
        credentials: document.getElementById("edit-credentials").value || "Authorized Personnel",
        avatar: document.getElementById("avatar-preview").src
    };

    localStorage.setItem("hive_profile", JSON.stringify(updatedProfile));
    loadProfile();
    alert("✅ Changes Saved! Profile updated across the dashboard.");
}

function deleteVideoLogs() {
    videoLogs = [];
    const container = document.querySelector('.log-list');
    if (container) {
        container.innerHTML = '<div class="log-item active"><span>Live Feed Active</span></div>';
    }
}

function deleteAudioLogs() {
    audioLogs = [];
    const container = document.getElementById('audio-events-list');
    if (container) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Logs Cleared</div>';
    }
}