// ============================================
// 1. CONFIGURATION & GLOBALS
// ============================================
const CONFIG = { 
    temp: { min: 28.0, max: 33.0 }, 
    hum: { min: 55, max: 65 }, 
    weight: 14.50 
};

// TAMA NA ITO (Base sa huli nating usapan)
const RPI_URL = "http://10.120.24.103:5000/data";
const HIVE_TARE_WEIGHT = 2.0; 

let SETTINGS = { refreshRate: 2000, sensitivity: 8, audioEnabled: true };
let hiveChart, detailedChart, updateIntervalId, alarmInterval = null;
let activeOscillators = [], specAnimationId = null;
let tempHistory = [], humHistory = [], weightHistory = [], timeLabels = [];
let allLogs = [], audioLogs = [], videoLogs = [];
const MAX_HISTORY = 20; 

// Current Values
let currentTemp = 0, currentHum = 0, currentWeight = 0;

const DEFAULT_PROFILE = { name: "Admin", role: "Head Keeper", credentials: "Authorized Personnel", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" };

const BEE_RESOURCES = {
    pollinators: { title: "Forest Pollinators", links: [{ name: "Wikipedia: Stingless Bee", url: "https://en.wikipedia.org/wiki/Stingless_bee", icon: "fas fa-book" }] },
    honey: { title: "Medicinal Pot Honey", links: [{ name: "NCBI Study", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8067784/", icon: "fas fa-microscope" }] },
    defense: { title: "Propolis & Defense", links: [{ name: "Wikipedia: Propolis", url: "https://en.wikipedia.org/wiki/Propolis", icon: "fas fa-shield-alt" }] }
};

// ============================================
// 2. HELPER FUNCTIONS
// ============================================

function loadSettings() {
    const saved = JSON.parse(localStorage.getItem("hive_settings"));
    if (saved) {
        SETTINGS = saved;
        const refreshEl = document.getElementById("setting-refresh");
        if(refreshEl) refreshEl.value = SETTINGS.refreshRate;
        const audioEl = document.getElementById("setting-audio");
        if(audioEl) audioEl.checked = SETTINGS.audioEnabled;
    }
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
        if(nameInput) nameInput.value = saved.name;
        const roleInput = document.getElementById("edit-role");
        if(roleInput) roleInput.value = saved.role;
        const credInput = document.getElementById("edit-credentials");
        if(credInput) credInput.value = saved.credentials || "";
        const avatarPrev = document.getElementById("avatar-preview");
        if(avatarPrev) avatarPrev.src = saved.avatar;
    } catch(e) { console.warn("Profile elements missing in DOM, skipping update."); }
}

function updateCamTime() { 
    const el = document.getElementById('cam-time');
    if(el) el.innerText = new Date().toLocaleTimeString('en-US', { hour12: false }); 
}

function createSwarm(container, className, count) {
    if(!container) return;
    for (let i = 0; i < count; i++) {
        const b = document.createElement('div');
        b.className = className; 
        b.style.left = Math.random() * 100 + 'vw';
        b.style.top = Math.random() * 100 + 'vh';
        b.style.animation = `flyAround ${5 + Math.random() * 15}s infinite linear`;
        container.appendChild(b);
    }
}

// ============================================
// 3. CHART & DATA FUNCTIONS
// ============================================

function initChart() { 
    const ctx = document.getElementById('hiveChart').getContext('2d'); 
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
        // DISABLED GHOST DATA: Para hindi ka malito kung offline talaga
        t = "--";
        h = "--";
        rawW = 0;
    }

    // Process Weight
    let netW = 0; 
    let displayW = "--";
    if (!isNaN(rawW) && !isOffline) {
        netW = (rawW - HIVE_TARE_WEIGHT);
        if(netW < 0) netW = 0;
        displayW = netW.toFixed(2);
    }

    // Update Global State
    currentTemp = t; currentHum = h; currentWeight = displayW;

    // Update UI
    document.getElementById('temp-display').innerText = t + "°C"; 
    document.getElementById('hum-display').innerText = h + "%"; 
    document.getElementById('weight-display').innerText = displayW + " kg";

    const audioDisplay = document.getElementById('audio-display');
    audioDisplay.innerText = soundStatus;
    
    // Alerts
    if (soundStatus === "Aggressive") {
        audioDisplay.style.color = "#ff4757"; 
        if (!alarmInterval) showAcousticAlert("⚠️ AGGRESSIVE SOUND DETECTED!");
    } else {
        audioDisplay.style.color = "#2ecc71";
    }
    
    const tempDisplay = document.getElementById('temp-display');
    if(!isOffline && parseFloat(t) > CONFIG.temp.max) {
         tempDisplay.style.color = "#ff4757";
         if (!alarmInterval) showAcousticAlert(`🔥 HIGH HEAT: ${t}°C`);
    } else {
         tempDisplay.style.color = "";
    }

    // Update Graphs
    if (!isOffline) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        timeLabels.push(time);
        tempHistory.push(t);
        humHistory.push(h);
        weightHistory.push(netW);

        if (timeLabels.length > MAX_HISTORY) {
            timeLabels.shift(); tempHistory.shift(); humHistory.shift(); weightHistory.shift();
        }

        if (hiveChart) {
            hiveChart.data.labels = timeLabels;
            hiveChart.data.datasets[0].data = tempHistory;
            hiveChart.data.datasets[1].data = humHistory;
            hiveChart.data.datasets[2].data = weightHistory;
            hiveChart.update('none');
        }

        if (detailedChart && !document.getElementById('detailed-graph-modal').classList.contains('hidden')) {
            const title = document.getElementById('detailed-graph-title').innerText;
            if(title.includes('Temperature')) updateDetailedChart(tempHistory, timeLabels);
            else if(title.includes('Humidity')) updateDetailedChart(humHistory, timeLabels);
            else if(title.includes('Weight')) updateDetailedChart(weightHistory, timeLabels);
        }
    }

    // Logs
    if(!isOffline && Math.random() > 0.8) {
        let logStatus = (soundStatus === "Aggressive") ? "Warning" : "Normal";
        let logEvent = (soundStatus === "Aggressive") ? "Audio: Aggressive" : "Traffic: Foraging";
        if(parseFloat(t) > CONFIG.temp.max) { logStatus = "Warning"; logEvent = "Env: High Temp"; }

        const statusClass = logStatus === "Normal" ? "badge-normal" : "badge-warning"; 
        const tbody = document.querySelector("#logs-table tbody"); 
        if(tbody) {
            const row = `<tr><td>${new Date().toLocaleTimeString()}</td><td>${logEvent}</td><td class="conf-text">98%</td><td><span class="log-badge ${statusClass}">${logStatus}</span></td></tr>`; 
            tbody.insertAdjacentHTML('afterbegin', row); 
            if (tbody.rows.length > 8) tbody.deleteRow(8);
        }
        allLogs.unshift({ timestamp: new Date().toLocaleString(), eventType: logEvent, value: `${t}°C | ${displayW}kg`, status: logStatus }); 
    }
}

function startDataUpdates() {
    if (updateIntervalId) clearInterval(updateIntervalId);
    let rate = SETTINGS.refreshRate || 2000;
    updateIntervalId = setInterval(updateData, rate);
}

// ============================================
// 4. ACTION FUNCTIONS (Clicks, Modals)
// ============================================

function manualRefresh() {
    const icon = document.querySelector('.refresh-btn-global i');
    if(icon) icon.classList.add('fa-spin-fast');
    updateData().then(() => {
        setTimeout(() => { if(icon) icon.classList.remove('fa-spin-fast'); }, 800);
    });
}

function toggleDashboardMenu() {
    document.getElementById('dashboard-mobile-dropdown').classList.toggle('hidden');
}

function saveSettings() {
    SETTINGS.refreshRate = parseInt(document.getElementById("setting-refresh").value);
    SETTINGS.audioEnabled = document.getElementById("setting-audio").checked;
    localStorage.setItem("hive_settings", JSON.stringify(SETTINGS));
    startDataUpdates();
    alert("✅ Settings Saved!");
}

function resetSettings() { localStorage.removeItem("hive_settings"); location.reload(); }

function exportData() {
    if (allLogs.length === 0) { alert("⚠️ No logs to export!"); return; }
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
    modal.classList.remove('hidden');
    let title, color, dataArray;
    if (type === 'temp') { title = 'Temperature Trend'; color = '#ff7675'; dataArray = tempHistory; }
    else if (type === 'humidity') { title = 'Humidity Trend'; color = '#74b9ff'; dataArray = humHistory; }
    else if (type === 'weight') { title = 'Weight Trend'; color = '#ffeaa7'; dataArray = weightHistory; }
    document.getElementById('detailed-graph-title').innerText = title;

    if (detailedChart) detailedChart.destroy();
    const ctx = document.getElementById('detailedChart').getContext('2d');
    detailedChart = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels: timeLabels, 
            datasets: [{ 
                label: title, data: dataArray, borderColor: color, 
                backgroundColor: color.replace('1)', '0.1)'), fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: color 
            }] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } } 
    });
    updateDetailedStats(dataArray);
}

function updateDetailedChart(dataArray, labels) {
    if(detailedChart) {
        detailedChart.data.labels = labels;
        detailedChart.data.datasets[0].data = dataArray;
        detailedChart.update('none');
        updateDetailedStats(dataArray);
    }
}

function updateDetailedStats(dataArray) {
    if(dataArray.length === 0) return;
    const nums = dataArray.map(n => parseFloat(n));
    const sum = nums.reduce((a, b) => a + parseFloat(b), 0);
    const avg = (sum / nums.length).toFixed(2);
    document.getElementById('graph-current').innerText = nums[nums.length - 1].toFixed(2);
    document.getElementById('graph-max').innerText = Math.max(...nums).toFixed(2);
    document.getElementById('graph-min').innerText = Math.min(...nums).toFixed(2);
    document.getElementById('graph-avg').innerText = avg;
}

function closeDetailedGraphModal() { document.getElementById('detailed-graph-modal').classList.add('hidden'); }

// ============================================
// 5. STANDARD MODALS & NAVIGATION
// ============================================
function switchPublicTab(tabId) { document.querySelectorAll('.public-section').forEach(sec => sec.classList.add('hidden')); document.getElementById(tabId).classList.remove('hidden'); if(tabId === 'hero') window.scrollTo(0, 0); }
function toggleMobileMenu() { document.getElementById('mobile-public-menu').classList.toggle('hidden'); }
function mobileNavClick(tabId) { switchPublicTab(tabId); toggleMobileMenu(); }
function goToLogin() { document.getElementById("landing-view").classList.add("hidden"); document.getElementById("login-view").classList.remove("hidden"); document.getElementById("mobile-nav-bar").classList.add("hidden"); }
function backToHome() { document.getElementById("login-view").classList.add("hidden"); document.getElementById("landing-view").classList.remove("hidden"); }
function attemptLogin() { if (document.getElementById("email-input").value.trim().toLowerCase().endsWith("@gmail.com") && document.getElementById("password-input").value.trim() === "hive123") { localStorage.setItem("hive_isLoggedIn", "true"); location.reload(); } else { document.getElementById("login-error").classList.remove("hidden"); } }
function logout() { localStorage.removeItem("hive_isLoggedIn"); location.reload(); }
function switchTab(tabId) { document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden')); document.getElementById('view-' + tabId).classList.remove('hidden'); document.querySelectorAll('.nav-menu li, .nav-bottom li, .mobile-nav div').forEach(item => item.classList.remove('active')); document.querySelectorAll('.nav-item-' + tabId).forEach(item => item.classList.add('active')); }

// ----------------------------------------
// 6. VIDEO & AUDIO STREAMING (UPDATED)
// ----------------------------------------

function openVideoModal() { 
    document.getElementById('video-modal').classList.remove('hidden'); 
    
    // Auto-Connect Stream with timestamp to force refresh
    const imgElement = document.getElementById('cctv-feed');
    if (imgElement) {
        // Changes /data to /video_feed
        const streamUrl = RPI_URL.replace('/data', '/video_feed') + "?t=" + new Date().getTime();
        imgElement.src = streamUrl;
        imgElement.style.display = 'block';
        
        // Remove error msg if exists
        const errorMsg = imgElement.parentElement.querySelector('#video-error-msg');
        if(errorMsg) errorMsg.remove();
    }
}

function closeVideoModal() { 
    document.getElementById('video-modal').classList.add('hidden'); 
    
    // Stop Video Stream
    const imgElement = document.getElementById('cctv-feed');
    if (imgElement) {
        imgElement.src = ""; 
    }

    // Stop Audio Stream too (NEW FEATURE)
    stopAudio();
}

// --- NEW AUDIO LOGIC (ADDED) ---
function toggleAudio() {
    const audioPlayer = document.getElementById('live-audio-player');
    const btnIcon = document.getElementById('audio-icon');

    if (!audioPlayer) return;

    if (audioPlayer.paused) {
        // PLAY
        audioPlayer.src = RPI_URL.replace('/data', '/audio_feed'); 
        audioPlayer.play().catch(e => console.log("Audio Play Error:", e));
        if(btnIcon) btnIcon.className = "fas fa-volume-up"; // Unmute Icon
    } else {
        stopAudio();
    }
}

function stopAudio() {
    const audioPlayer = document.getElementById('live-audio-player');
    const btnIcon = document.getElementById('audio-icon');
    
    if(audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = ""; // Cut connection
    }
    if(btnIcon) btnIcon.className = "fas fa-volume-mute"; // Mute Icon
}

// ----------------------------------------
// 7. VIDEO ERROR HANDLING
// ----------------------------------------
function setupVideoErrorHandling() {
    const img = document.getElementById('cctv-feed');
    if(img) {
        img.onerror = function() {
            this.style.display = 'none'; 
            let err = document.getElementById('video-error-msg');
            if(!err) {
                err = document.createElement('p');
                err.id = 'video-error-msg';
                err.style.color = '#ff4757';
                err.style.textAlign = 'center';
                err.style.marginTop = '20px';
                err.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Stream Offline. Retrying...`;
                this.parentElement.appendChild(err);
            }
            setTimeout(() => {
                if(!document.getElementById('video-modal').classList.contains('hidden')){
                    const freshUrl = RPI_URL.replace('/data', '/video_feed') + "?t=" + new Date().getTime();
                    this.src = freshUrl;
                }
            }, 3000);
        };
        img.onload = function() {
             this.style.display = 'block';
             const err = document.getElementById('video-error-msg');
             if(err) err.remove();
        };
    }
}

// ============================================
// 8. OTHERS (Alerts, Links, Etc.)
// ============================================

function openAudioModal() { document.getElementById('audio-modal').classList.remove('hidden'); populateAudioLogs(); if(specAnimationId) cancelAnimationFrame(specAnimationId); setTimeout(() => { const canvas = document.getElementById('spectrogramCanvas'); if (canvas) animateSpectrogram(canvas); }, 100); }
function closeAudioModal() { document.getElementById('audio-modal').classList.add('hidden'); if(specAnimationId) cancelAnimationFrame(specAnimationId); }
function populateAudioLogs() { const container = document.getElementById('audio-events-list'); if (!container) return; container.innerHTML = ''; if (audioLogs.length === 0) { container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No audio events recorded</div>'; return; } audioLogs.forEach(log => { const div = document.createElement('div'); div.className = 'audio-event-item'; div.innerHTML = `<div class="timestamp">${log.timestamp}</div><div class="event-type"><span>${log.eventType}</span><span class="stress-indicator ${log.stressLevel === 'Normal' ? 'stress-normal' : 'stress-high'}">${log.stressLevel}</span></div>`; container.appendChild(div); }); }
function closeAlertModal() { document.getElementById('alert-modal').classList.add('hidden'); document.getElementById('alert-notification').classList.add('hidden'); stopAlarmSound(); }
function viewAudioLogs() { closeAlertModal(); openAudioModal(); }
function showAcousticAlert(message) { document.getElementById('alert-notification').classList.remove('hidden'); document.getElementById('alert-modal').classList.remove('hidden'); document.getElementById('alert-modal-message').innerText = message; document.getElementById('alert-timestamp').innerText = `⏰ ${new Date().toLocaleTimeString()}`; if (SETTINGS.audioEnabled) playAlarmSound(); }
function playAlarmSound() { if (alarmInterval) return; const playPulse = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const osc = ac.createOscillator(); const g = ac.createGain(); osc.connect(g); g.connect(ac.destination); osc.frequency.value = 800; g.gain.setValueAtTime(0.3, ac.currentTime); osc.start(); osc.stop(ac.currentTime + 0.2); activeOscillators.push(osc); setTimeout(() => { activeOscillators = []; }, 300); } catch (e) {} }; playPulse(); alarmInterval = setInterval(playPulse, 1000); }
function stopAlarmSound() { if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; } activeOscillators.forEach(osc => { try { osc.stop(); } catch(e){} }); activeOscillators = []; }
function openLinksModal(key) { const data = BEE_RESOURCES[key]; if(!data) return; document.getElementById('links-modal-title').innerText = data.title; const list = document.getElementById('links-list-container'); list.innerHTML = ''; data.links.forEach(l => { const i = document.createElement('a'); i.href = l.url; i.target = "_blank"; i.className = "resource-item"; i.innerHTML = `<div class="res-info"><h4>${l.name}</h4><p>Click to view</p></div><i class="${l.icon} res-icon"></i>`; list.appendChild(i); }); document.getElementById('links-modal').classList.remove('hidden'); }
function closeLinksModal() { document.getElementById('links-modal').classList.add('hidden'); }
function previewImage(input) { if (input.files && input.files[0]) { const reader = new FileReader(); reader.onload = function (e) { document.getElementById('avatar-preview').src = e.target.result; }; reader.readAsDataURL(input.files[0]); } }
function openSensorModal() { /* Deprecated in favor of graph modal */ }
function closeSensorModal() { document.getElementById('sensor-modal').classList.add('hidden'); }
function animateSpectrogram(canvas) { if (!canvas || !canvas.parentElement) return; const rect = canvas.parentElement.getBoundingClientRect(); if (canvas.width !== rect.width || canvas.height !== rect.height) { canvas.width = rect.width; canvas.height = rect.height; } const ctx = canvas.getContext('2d'); const width = canvas.width; const height = canvas.height; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height); const barCount = 64; const barWidth = width / barCount; const time = Date.now() / 100; const gradient = ctx.createLinearGradient(0, height, 0, 0); gradient.addColorStop(0, '#00ffcc'); gradient.addColorStop(0.5, '#0088ff'); gradient.addColorStop(1, '#a000ff'); ctx.fillStyle = gradient; for (let i = 0; i < barCount; i++) { const baseFreq = Math.sin(i * 0.2 + time) * 0.5 + 0.5; const randomNoise = Math.random() * 0.3; let barHeight = (baseFreq + randomNoise) * (height * 0.8); barHeight = barHeight * (1 - (i / barCount) * 0.5); const x = i * barWidth; const y = height - barHeight; ctx.fillRect(x, y, barWidth - 2, barHeight); } specAnimationId = requestAnimationFrame(() => animateSpectrogram(canvas)); }

// ============================================
// 9. MAIN EXECUTION START
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    const landingSwarm = document.getElementById('landing-swarm');
    if (landingSwarm) createSwarm(landingSwarm, 'landing-bee', 30);
    const dashboardSwarm = document.getElementById('dashboard-swarm');
    if (dashboardSwarm) createSwarm(dashboardSwarm, 'dashboard-bee', 20);
    const bee = document.getElementById('bee-tracker');
    if (bee) { document.addEventListener('mousemove', (e) => { const x = (window.innerWidth - e.pageX) / 25; const y = (window.innerHeight - e.pageY) / 25; bee.style.transform = `translateX(${x}px) translateY(${y}px)`; }); }

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
        setupVideoErrorHandling(); // Start Video Error Checker
    }

    document.addEventListener('click', function(event) {
        const menu = document.getElementById('dashboard-mobile-dropdown');
        const btn = document.querySelector('.dashboard-menu-btn');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(event.target) && !btn.contains(event.target)) {
            menu.classList.add('hidden');
        }
    });
});

// --- ADMIN CUSTOMIZATION LOGIC ---

// Function para i-save ang lahat ng binago sa Profile section
function saveProfile() {
    const updatedProfile = {
        name: document.getElementById("edit-name").value || "Glenda",
        role: document.getElementById("edit-role").value || "4th Year ECE Student",
        credentials: document.getElementById("edit-credentials").value || "Authorized Personnel",
        avatar: document.getElementById("avatar-preview").src
    };
    
    // Sine-save sa LocalStorage para kahit i-refresh, andun pa rin
    localStorage.setItem("hive_profile", JSON.stringify(updatedProfile));
    
    // I-update agad ang UI (sidebar at greeting)
    loadProfile(); 
    alert("✅ Changes Saved! Profile updated across the dashboard.");
}

// Function para mag-preview ng photo bago i-save
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('avatar-preview').src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// --- LOG MANAGEMENT LOGIC ---

// Function para linisin ang Video Logs display
function deleteVideoLogs() {
    videoLogs = [];
    const container = document.querySelector('.log-list');
    if(container) {
        container.innerHTML = '<div class="log-item active"><span>Live Feed Active</span></div>';
    }
}

// Function para linisin ang Audio Logs display
function deleteAudioLogs() {
    audioLogs = [];
    const container = document.getElementById('audio-events-list');
    if(container) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Logs Cleared</div>';
    }
}