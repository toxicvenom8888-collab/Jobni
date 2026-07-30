// Dynamically determine the base path from the script location (robust, no modules required)
const basePath = (function(){
  try {
    var s = document.currentScript;
    if (s && s.src) {
      var u = new URL(s.src, window.location.href);
      return u.pathname.replace(/\/[^\/?#]+(\?.*)?$/, '/'); // directory of this script
    }
    // Fallback: find our tag by filename
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('behavioral_tracker.js') !== -1) {
        var u2 = new URL(src, window.location.href);
        return u2.pathname.replace(/\/[^\/?#]+(\?.*)?$/, '/');
      }
    }
  } catch (e) {}
  try {
    // As a last resort, if current page path contains /protection/, keep that base
    var p = window.location.pathname;
    var k = p.lastIndexOf('/protection/');
    if (k !== -1) return p.substring(0, k + '/protection/'.length);
  } catch (e) {}
  return 'protection/'; // relative fallback — no leading slash to avoid root 404s
})();

class BehavioralTracker {
    constructor() {
        this.data = {
            mouseMovements: [],
            keystrokes: [],
            clicks: [],
            scrolls: [],
            startTime: Date.now(),
            fingerprint: {},
            sessionId: this.generateSessionId()
        };
        
        this.isTracking = false;
        this.honeypots = [];
        // IMPORTANT: only init when DOM is ready so document.body exists
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init(), { once: true });
        } else {
            this.init();
        }
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    init() {
        if (this.isTracking) return;
        this.isTracking = true;
        
        this.setupEventListeners();
        this.generateFingerprint();
        this.createHoneypots();
        this.startPeriodicReporting();
    }

    setupEventListeners() {
        document.addEventListener('mousemove', (e) => {
            this.data.mouseMovements.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now() - this.data.startTime
            });
            
            if (this.data.mouseMovements.length > 200) {
                this.data.mouseMovements.shift();
            }
        });

        document.addEventListener('click', (e) => {
            this.data.clicks.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now() - this.data.startTime,
                element: e.target.tagName.toLowerCase()
            });
        });

        document.addEventListener('keydown', (e) => {
            this.data.keystrokes.push({
                timestamp: Date.now() - this.data.startTime,
                keyCode: e.keyCode,
                interval: this.data.keystrokes.length > 0 ? 
                    (Date.now() - this.data.startTime) - this.data.keystrokes[this.data.keystrokes.length - 1].timestamp : 0
            });
        });

        document.addEventListener('scroll', (e) => {
            this.data.scrolls.push({
                scrollY: window.scrollY,
                timestamp: Date.now() - this.data.startTime
            });
            
            if (this.data.scrolls.length > 50) {
                this.data.scrolls.shift();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.sendReport(true);
            }
        });

        window.addEventListener('beforeunload', () => {
            this.sendReport(true);
        });
    }

    generateFingerprint() {
        this.data.fingerprint = {
            canvas: this.getCanvasFingerprint(),
            webgl: this.getWebGLFingerprint(),
            audio: this.getAudioFingerprint(),
            fonts: this.detectFonts(),
            plugins: this.getPlugins(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth
            },
            navigator: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                languages: navigator.languages ? navigator.languages.join(',') : '',
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack,
                hardwareConcurrency: navigator.hardwareConcurrency || 0
            }
        };
    }

    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = "16px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Cwm fjordbank glyphs vext quiz, 😃", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Cwm fjordbank glyphs vext quiz, 😃", 4, 17);
            const data = canvas.toDataURL();
            return data;
        } catch (e) {
            return null;
        }
    }

    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return null;
            
            return {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                version: gl.getParameter(gl.VERSION),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
                maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
            };
        } catch (e) {
            return null;
        }
    }

    getAudioFingerprint() {
        try {
            const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!AudioCtx) return null;

            const audioContext = new AudioCtx(1, 44100, 44100);
            const oscillator = audioContext.createOscillator();
            const analyser = audioContext.createAnalyser();
            const gainNode = audioContext.createGain();

            oscillator.type = 'triangle';
            oscillator.frequency.value = 10000;
            gainNode.gain.value = 0;
            oscillator.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(0);
            
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(freqData);
            
            oscillator.stop();
            audioContext.close();
            
            return Array.from(freqData).slice(0, 30).join(',');
        } catch (e) {
            return null;
        }
    }

    detectFonts() {
        // Safely handle early calls before <body> exists
        const root = document.body || document.documentElement;
        if (!root) return [];

        const testFonts = [
            'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
            'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
            'Trebuchet MS', 'Arial Black', 'Impact', 'Lucida Sans Unicode',
            'Tahoma', 'Lucida Console', 'Monaco', 'Bradley Hand ITC'
        ];
        
        const detected = [];
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';
        
        const span = document.createElement('span');
        span.style.fontSize = testSize;
        span.innerHTML = testString;
        const defaultFont = 'monospace';
        span.style.fontFamily = defaultFont;
        span.style.position = 'absolute';
        span.style.left = '-99999px';
        root.appendChild(span);
        const baselineWidth = span.offsetWidth;
        const baselineHeight = span.offsetHeight;
        root.removeChild(span);
        
        testFonts.forEach(font => {
            const s = document.createElement('span');
            s.style.fontSize = testSize;
            s.innerHTML = testString;
            s.style.fontFamily = font + ',' + defaultFont;
            s.style.position = 'absolute';
            s.style.left = '-99999px';
            root.appendChild(s);
            const width = s.offsetWidth;
            const height = s.offsetHeight;
            root.removeChild(s);
            if (width !== baselineWidth || height !== baselineHeight) {
                detected.push(font);
            }
        });
        
        return detected;
    }

    getPlugins() {
        const plugins = [];
        try {
            for (let i = 0; i < (navigator.plugins ? navigator.plugins.length : 0); i++) {
                plugins.push(navigator.plugins[i].name);
            }
        } catch(e){}
        return plugins;
    }

    createHoneypots() {
        const honeypotFields = [
            { name: 'email_confirm', type: 'email' },
            { name: 'website_url', type: 'url' },
            { name: 'phone_number', type: 'tel' },
            { name: 'company_name', type: 'text' }
        ];

        const root = document.body || document.documentElement;
        if (!root) return;

        honeypotFields.forEach(field => {
            const input = document.createElement('input');
            input.type = field.type;
            input.name = field.name;
            input.style.position = 'absolute';
            input.style.left = '-9999px';
            input.style.opacity = '0';
            input.style.pointerEvents = 'none';
            input.tabIndex = -1;
            input.setAttribute('aria-hidden', 'true');
            root.appendChild(input);
            this.honeypots.push(input);
        });
    }

    reportHoneypotInteraction(fieldName, interactionType, value = '') {
        fetch(basePath + 'behavioral_report.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: this.data.sessionId,
                honeypotInteraction: { field: fieldName, type: interactionType, value }
            })
        }).catch(() => {});
    }

    startPeriodicReporting() {
        setInterval(() => {
            this.sendReport(false);
        }, 15000);
    }

    calculateBehavioralScore() {
        const score = {
            mouseMovement: 0,
            clickPattern: 0,
            keystrokePattern: 0,
            scrollPattern: 0,
            timing: 0,
            overall: 0
        };

        if (this.data.mouseMovements.length > 10) {
            const movements = this.data.mouseMovements;
            let totalDistance = 0;
            let velocities = [];
            
            for (let i = 1; i < movements.length; i++) {
                const dx = movements[i].x - movements[i-1].x;
                const dy = movements[i].y - movements[i-1].y;
                const dt = movements[i].timestamp - movements[i-1].timestamp;
                
                totalDistance += Math.sqrt(dx*dx + dy*dy);
                if (dt > 0) {
                    velocities.push(Math.sqrt(dx*dx + dy*dy) / dt);
                }
            }
            
            const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
            const velocityVariance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVelocity, 2), 0) / velocities.length;
            
            score.mouseMovement = Math.min(100, (velocityVariance / avgVelocity) * 50 + 25);
        }

        if (this.data.clicks.length > 2) {
            const intervals = [];
            for (let i = 1; i < this.data.clicks.length; i++) {
                intervals.push(this.data.clicks[i].timestamp - this.data.clicks[i-1].timestamp);
            }
            if (intervals.length) {
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
                score.clickPattern = Math.min(100, (variance / avgInterval) * 40 + 20);
            }
        }

        if (this.data.keystrokes.length > 2) {
            const intervals = [];
            for (let i = 1; i < this.data.keystrokes.length; i++) {
                intervals.push(this.data.keystrokes[i].timestamp - this.data.keystrokes[i-1].timestamp);
            }
            if (intervals.length) {
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
                score.keystrokePattern = Math.min(100, (variance / avgInterval) * 25 + 50);
            }
        }

        if (this.data.scrolls.length > 3) {
            const scrollSpeeds = [];
            for (let i = 1; i < this.data.scrolls.length; i++) {
                const dy = Math.abs(this.data.scrolls[i].scrollY - this.data.scrolls[i-1].scrollY);
                const dt = this.data.scrolls[i].timestamp - this.data.scrolls[i-1].timestamp;
                if (dt > 0) scrollSpeeds.push(dy / dt);
            }
            const avg = scrollSpeeds.reduce((a, b) => a + b, 0) / scrollSpeeds.length || 0;
            const variance = scrollSpeeds.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (scrollSpeeds.length || 1);
            score.scrollPattern = Math.min(100, (variance / (avg || 1)) * 20 + 30);
        }

        // Timing score based on typing/click randomness
        const times = this.data.keystrokes.concat(this.data.clicks).map(e => e.timestamp).sort((a,b)=>a-b);
        if (times.length > 2) {
            const gaps = [];
            for (let i=1;i<times.length;i++) gaps.push(times[i]-times[i-1]);
            const mean = gaps.reduce((a,b)=>a+b,0)/gaps.length;
            const varc = gaps.reduce((s,v)=>s+Math.pow(v-mean,2),0)/(gaps.length||1);
            score.timing = Math.min(100, Math.log10(varc+10)*25);
        } else {
            score.timing = 50;
        }

        // Weighted overall score
        score.overall = Math.round(
            0.35*score.mouseMovement +
            0.25*score.clickPattern +
            0.2*score.keystrokePattern +
            0.1*score.scrollPattern +
            0.1*score.timing
        );
        return score;
    }

    buildReport() {
        const score = this.calculateBehavioralScore();
        return {
            sessionId: this.data.sessionId,
            stats: {
                mouseMovements: this.data.mouseMovements.length,
                clicks: this.data.clicks.length,
                keystrokes: this.data.keystrokes.length,
                scrolls: this.data.scrolls.length,
                sessionDuration: Math.round((Date.now() - this.data.startTime) / 1000)
            },
            behavioral_score: {
                mouseMovement: score.mouseMovement,
                clickPattern: score.clickPattern,
                keystrokePattern: score.keystrokePattern,
                scrollPattern: score.scrollPattern,
                timing: score.timing,
                overall: score.overall
            },
            fingerprint: this.data.fingerprint
        };
    }

    sendReport(isUnloading = false) {
        const reportData = this.buildReport();

        if (isUnloading) {
            if (navigator.sendBeacon) {
                navigator.sendBeacon(basePath + 'behavioral_report.php', JSON.stringify(reportData));
            }
        } else {
            fetch(basePath + 'behavioral_report.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reportData)
            }).then(() => {}).catch(() => {});
        }
    }

    // --- CAPTCHA/Challenge helpers ---
    showChallenge(question, answers) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '999999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        const box = document.createElement('div');
        box.style.background = '#fff';
        box.style.padding = '16px';
        box.style.borderRadius = '8px';
        box.style.maxWidth = '420px';
        box.style.width = '90%';
        box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
        box.innerHTML = '<h3 style="margin:0 0 8px 0">Verify you are human</h3><p style="margin:0 0 12px 0"></p>';

        box.querySelector('p').textContent = question;

        const list = document.createElement('div');
        list.style.display = 'grid';
        list.style.gap = '8px';

        answers.forEach((ans, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = ans;
            btn.style.padding = '8px 12px';
            btn.style.border = '1px solid #ddd';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => {
                this.submitChallengeAnswer(question, ans);
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            });
            list.appendChild(btn);
        });

        box.appendChild(list);
        overlay.appendChild(box);
        (document.body || document.documentElement).appendChild(overlay);
    }

    submitChallengeAnswer(question, answer) {
        fetch(basePath + 'challenge_response.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: this.data.sessionId,
                question: question,
                answer: answer
            })
        }).catch(() => {});
    }
}

// Expose global for pages that need manual control (optional)
window.BehavioralTracker = BehavioralTracker;

// auto-start (constructor now waits for DOM if needed)
(function autoStart(){
    try {
        if (!window.__BEHAVIORAL_TRACKER__) {
            window.__BEHAVIORAL_TRACKER__ = new BehavioralTracker();
            window.bt = window.__BEHAVIORAL_TRACKER__;
        }
    } catch (e) {
        console.error("behavioral_tracker init failed", e);
    }
})();