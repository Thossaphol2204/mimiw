/**
 * CMM Alert Sound Engine
 * Supports selectable normal ringtones & Thai voice "งาน out spec"
 */

class CMMSoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.loopTimer = null;
    this.volume = 0.85;
    this.isMuted = false;
    this.isPrimed = false;
    this.thaiVoice = null;
    this.selectedRingtone = 'chime'; // Default to normal ringtone

    // Preload voice
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    this.thaiVoice = voices.find(v => v.lang.includes('th') || v.lang.includes('TH')) || null;
  }

  /**
   * Prime AudioContext on user interaction
   */
  async prime() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Quick silent chirp to unlock audio
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);

      this.isPrimed = true;
      return true;
    } catch (err) {
      console.warn('Audio prime warning:', err);
      return false;
    }
  }

  setRingtone(ringtoneId) {
    this.selectedRingtone = ringtoneId || 'chime';
  }

  /**
   * 1. 🔔 Normal Chime (Ding-Dong คลาสสิก นุ่มนวล)
   */
  playChimeTone() {
    if (!this.audioCtx || this.isMuted) return;

    try {
      const now = this.audioCtx.currentTime;

      // Ding: G5 (784Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);

      gain1.gain.setValueAtTime(0.01, now);
      gain1.gain.linearRampToValueAtTime(0.35 * this.volume, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.7);

      // Dong: E5 (659Hz)
      const tDong = now + 0.28;
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, tDong);

      gain2.gain.setValueAtTime(0.01, tDong);
      gain2.gain.linearRampToValueAtTime(0.4 * this.volume, tDong + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, tDong + 0.9);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(tDong);
      osc2.stop(tDong + 0.95);
    } catch (e) {
      console.warn('Chime error:', e);
    }
  }

  /**
   * 2. 🎵 Marimba / Xylophone Melody (เมโลดี้สดใส นุ่มนวล)
   */
  playMarimbaTone() {
    if (!this.audioCtx || this.isMuted) return;

    try {
      const now = this.audioCtx.currentTime;
      const notes = [
        { f: 523.25, t: 0 },    // C5
        { f: 659.25, t: 0.12 }, // E5
        { f: 783.99, t: 0.24 }, // G5
        { f: 1046.5, t: 0.36 }  // C6
      ];

      notes.forEach(n => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, now + n.t);

        gain.gain.setValueAtTime(0.01, now + n.t);
        gain.gain.linearRampToValueAtTime(0.32 * this.volume, now + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + 0.45);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + 0.5);
      });
    } catch (e) {
      console.warn('Marimba error:', e);
    }
  }

  /**
   * 3. 📱 Digital Beep (บี๊บ 2 จังหวะ โทรศัพท์ทั่วไป)
   */
  playDigitalBeep() {
    if (!this.audioCtx || this.isMuted) return;

    try {
      const now = this.audioCtx.currentTime;
      const beeps = [0, 0.18]; // Two beeps

      beeps.forEach(tOffset => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now + tOffset);

        gain.gain.setValueAtTime(0.01, now + tOffset);
        gain.gain.linearRampToValueAtTime(0.28 * this.volume, now + tOffset + 0.015);
        gain.gain.setValueAtTime(0.28 * this.volume, now + tOffset + 0.09);
        gain.gain.linearRampToValueAtTime(0.001, now + tOffset + 0.11);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + tOffset);
        osc.stop(now + tOffset + 0.12);
      });
    } catch (e) {
      console.warn('Beep error:', e);
    }
  }

  /**
   * 4. 🫧 Soft Pop (ป๊อปมินิมอล เสียงแชทสบายหู)
   */
  playPopTone() {
    if (!this.audioCtx || this.isMuted) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.12);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Pop error:', e);
    }
  }

  /**
   * 5. 🚨 Classic Industrial Siren (ตัวเลือกเสริมสำหรับคนชอบเสียงไซเรน)
   */
  playSirenTone() {
    if (!this.audioCtx || this.isMuted) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1050, now + 0.25);
      osc.frequency.linearRampToValueAtTime(800, now + 0.5);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2 * this.volume, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      console.warn('Siren error:', e);
    }
  }

  /**
   * Play the current selected ringtone
   */
  playCurrentRingtone() {
    switch (this.selectedRingtone) {
      case 'marimba':
        this.playMarimbaTone();
        break;
      case 'digital':
        this.playDigitalBeep();
        break;
      case 'pop':
        this.playPopTone();
        break;
      case 'siren':
        this.playSirenTone();
        break;
      case 'voice_only':
        // No ringtone, voice will speak directly
        break;
      case 'chime':
      default:
        this.playChimeTone();
        break;
    }
  }

  /**
   * Speak Thai phrase "งาน out spec" using Web Speech API
   */
  speakOutSpec(customText = 'งาน out spec') {
    if (this.isMuted || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(customText);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.volume = this.volume;

      if (this.thaiVoice) {
        utterance.voice = this.thaiVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech error:', e);
    }
  }

  /**
   * Start looping alarm: Chosen Ringtone + Thai voice "งาน out spec"
   */
  startAlarm(customSpeechText = 'งาน out spec') {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Run first immediately
    this.triggerAlarmCycle(customSpeechText);

    // Repeat every 3.8 seconds
    this.loopTimer = setInterval(() => {
      if (!this.isPlaying) return;
      this.triggerAlarmCycle(customSpeechText);
    }, 3800);
  }

  triggerAlarmCycle(customSpeechText) {
    if (!this.audioCtx) {
      this.prime();
    }
    
    // Play selected ringtone
    this.playCurrentRingtone();

    // Voice delay based on sound duration
    const voiceDelay = this.selectedRingtone === 'voice_only' ? 50 : 650;

    setTimeout(() => {
      if (this.isPlaying) {
        this.speakOutSpec(customSpeechText);
      }
    }, voiceDelay);
  }

  /**
   * Stop alert loop
   */
  stopAlarm() {
    this.isPlaying = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Preview a specific ringtone
   */
  async previewRingtone(ringtoneId) {
    await this.prime();
    const prev = this.selectedRingtone;
    this.selectedRingtone = ringtoneId;
    this.playCurrentRingtone();
    setTimeout(() => {
      this.speakOutSpec('งาน out spec');
    }, 700);
    this.selectedRingtone = prev;
  }
}

// Global singleton instance
window.soundEngine = new CMMSoundEngine();
