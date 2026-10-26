/**
 * CMM Alert - Universal Passcode Lock System
 * Requires passcode '0000' to access every page.
 */

(function () {
  const REQUIRED_PIN = '0000';
  const STORAGE_KEY = 'cmm_auth_session_0000';

  // Determine current page type
  const path = window.location.pathname.toLowerCase();
  let pageTitle = 'ระบบ CMM Alert';
  let pageBadge = '🔒 ระบบความปลอดภัย';
  let pageId = 'hub';

  if (path.includes('controller')) {
    pageTitle = 'แดชบอร์ดผู้ควบคุม (Controller)';
    pageBadge = '🎛️ ผู้ควบคุมระบบ (Admin)';
    pageId = 'controller';
  } else if (path.includes('viewer')) {
    pageTitle = 'หน้าจอแสดงผลพนักงาน (Viewer)';
    pageBadge = '📺 จอแสดงผลไลน์ผลิต (Viewer)';
    pageId = 'viewer';
  } else {
    pageTitle = 'หน้าหลัก CMM Alert Hub';
    pageBadge = '🏠 หน้าหลัก (Hub)';
    pageId = 'hub';
  }

  // Create Lock Overlay HTML
  function createLockOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'cmmPasscodeOverlay';
    overlay.className = 'passcode-overlay';
    overlay.innerHTML = `
      <div class="passcode-card" role="dialog" aria-modal="true" aria-labelledby="passcodeTitle">
        <!-- Cute Mascot & Badge -->
        <div class="passcode-header">
          <div class="passcode-mascot-wrap">
            <img src="/images/mascot-happy.jpg" alt="CMM Mascot" class="passcode-mascot-img">
            <span class="passcode-lock-icon">🔐</span>
          </div>
          <span class="badge badge-sky" style="margin-bottom: 6px;">${pageBadge}</span>
          <h2 id="passcodeTitle" class="passcode-title">กรุณากรอกรหัสผ่าน</h2>
          <p class="passcode-desc">
            ระบบจำกัดสิทธิ์เข้าใช้งาน <b>${pageTitle}</b><br>
            กรุณาป้อนรหัสผ่าน 4 หลัก เพื่อปลดล็อคเข้าสู่หน้าจอ
          </p>
        </div>

        <!-- 4 PIN Dots Indicator -->
        <div class="pin-display" id="pinDisplay">
          <div class="pin-dot" data-index="0"></div>
          <div class="pin-dot" data-index="1"></div>
          <div class="pin-dot" data-index="2"></div>
          <div class="pin-dot" data-index="3"></div>
        </div>

        <!-- Feedback Message -->
        <div id="pinFeedback" class="pin-feedback"></div>

        <!-- Touch/Click Numeric Keypad -->
        <div class="pin-keypad">
          <button type="button" class="pin-key" data-key="1">1</button>
          <button type="button" class="pin-key" data-key="2">2</button>
          <button type="button" class="pin-key" data-key="3">3</button>
          <button type="button" class="pin-key" data-key="4">4</button>
          <button type="button" class="pin-key" data-key="5">5</button>
          <button type="button" class="pin-key" data-key="6">6</button>
          <button type="button" class="pin-key" data-key="7">7</button>
          <button type="button" class="pin-key" data-key="8">8</button>
          <button type="button" class="pin-key" data-key="9">9</button>
          <button type="button" class="pin-key pin-action" data-action="clear" title="ล้างทั้งหมด">C</button>
          <button type="button" class="pin-key" data-key="0">0</button>
          <button type="button" class="pin-key pin-action" data-action="backspace" title="ลบทีละตัว">⌫</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  // Passcode Controller Class
  class PasscodeController {
    constructor() {
      this.currentPin = '';
      this.isLocked = true;
      this.overlay = null;
      this.init();
    }

    init() {
      // Check if already authenticated in this session
      const isAuth = sessionStorage.getItem(STORAGE_KEY) === 'unlocked';

      // Create overlay
      this.overlay = createLockOverlay();
      this.pinDots = this.overlay.querySelectorAll('.pin-dot');
      this.feedbackEl = document.getElementById('pinFeedback');

      // Bind Keypad clicks
      this.overlay.querySelectorAll('.pin-key').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const key = btn.dataset.key;
          const action = btn.dataset.action;

          if (key !== undefined) {
            this.appendDigit(key);
          } else if (action === 'backspace') {
            this.backspace();
          } else if (action === 'clear') {
            this.clearPin();
          }
        });
      });

      // Physical keyboard listener
      window.addEventListener('keydown', (e) => {
        if (!this.isLocked) return;

        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          this.appendDigit(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          this.backspace();
        } else if (e.key === 'Escape' || e.key === 'Delete') {
          e.preventDefault();
          this.clearPin();
        } else if (e.key === 'Enter') {
          if (this.currentPin.length === 4) {
            this.verifyPin();
          }
        }
      });

      // Connect Lock/Unlock Buttons in UI
      this.bindHeaderLockButtons();

      if (isAuth) {
        this.unlock(false); // Already authenticated, unlock without animation
      } else {
        this.lock();
      }
    }

    appendDigit(digit) {
      if (!this.isLocked) return;
      if (this.currentPin.length < 4) {
        this.currentPin += digit;
        this.updateDisplay();

        // Audio click tick
        this.playKeyBeep();

        if (this.currentPin.length === 4) {
          // Small delay for user to see 4th dot filled
          setTimeout(() => this.verifyPin(), 120);
        }
      }
    }

    backspace() {
      if (this.currentPin.length > 0) {
        this.currentPin = this.currentPin.slice(0, -1);
        this.updateDisplay();
        this.resetFeedback();
      }
    }

    clearPin() {
      this.currentPin = '';
      this.updateDisplay();
      this.resetFeedback();
    }

    updateDisplay() {
      this.pinDots.forEach((dot, index) => {
        if (index < this.currentPin.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled', 'error', 'success');
        }
      });
    }

    resetFeedback() {
      if (this.feedbackEl) {
        this.feedbackEl.innerHTML = '';
      }
      const card = this.overlay.querySelector('.passcode-card');
      if (card) card.classList.remove('shake');
    }

    verifyPin() {
      if (this.currentPin === REQUIRED_PIN) {
        // Success!
        this.pinDots.forEach(dot => {
          dot.classList.remove('error');
          dot.classList.add('success');
        });

        if (this.feedbackEl) {
          this.feedbackEl.innerHTML = `<span class="pin-success">✨ รหัสผ่านถูกต้อง! กำลังเข้าสู่หน้าจอ...</span>`;
        }

        // Play unlock sound chime
        if (window.soundEngine && typeof window.soundEngine.playUnlockSound === 'function') {
          window.soundEngine.playUnlockSound();
        }

        setTimeout(() => {
          sessionStorage.setItem(STORAGE_KEY, 'unlocked');
          this.unlock(true);
        }, 350);
      } else {
        // Error!
        this.pinDots.forEach(dot => dot.classList.add('error'));

        const card = this.overlay.querySelector('.passcode-card');
        if (card) {
          card.classList.remove('shake');
          void card.offsetWidth; // trigger reflow
          card.classList.add('shake');
        }

        if (this.feedbackEl) {
          this.feedbackEl.innerHTML = `<span class="pin-error">❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง</span>`;
        }

        // Play subtle error beep
        this.playErrorBeep();

        setTimeout(() => {
          this.clearPin();
        }, 800);
      }
    }

    unlock(animate = true) {
      this.isLocked = false;
      document.body.classList.remove('body-locked');

      if (animate) {
        this.overlay.classList.add('fade-out');
        setTimeout(() => {
          this.overlay.style.display = 'none';
          this.overlay.classList.remove('fade-out');
        }, 300);
      } else {
        this.overlay.style.display = 'none';
      }

      // Notify window that page is unlocked
      window.dispatchEvent(new CustomEvent('cmm:pageUnlocked', { detail: { pageId } }));
    }

    lock() {
      this.isLocked = true;
      sessionStorage.removeItem(STORAGE_KEY);
      this.currentPin = '';
      this.updateDisplay();
      this.resetFeedback();
      this.overlay.style.display = 'flex';
      document.body.classList.add('body-locked');
    }

    bindHeaderLockButtons() {
      document.querySelectorAll('.btn-lock-page').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.lock();
        });
      });
    }

    playKeyBeep() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } catch (e) {}
    }

    playErrorBeep() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } catch (e) {}
    }
  }

  // Auto initialize on DOMContentLoaded or immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.cmmPasscode = new PasscodeController();
    });
  } else {
    window.cmmPasscode = new PasscodeController();
  }

  // Global helper to lock page
  window.lockCMMPage = function () {
    if (window.cmmPasscode) {
      window.cmmPasscode.lock();
    }
  };
})();
