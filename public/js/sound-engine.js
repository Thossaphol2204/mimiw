/**
 * CMM Alert Sound Engine (Pro Version)
 * - Full ringtone playback from start to finish without gaps ("ตั้งแต่ต้นจนจบ")
 * - Seamless continuous looping during Out-of-Spec alarms until cleared
 * - Rich polyphonic synthesized ringtones (Marimba, Chime, Digital, Pop, Siren)
 * - Harmonious voice ducking for clear Thai announcement "งาน out spec"
 * - Unlock chime for passcode entry (0000)
 */

class CMMSoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.loopTimer = null;
    this.voiceTimer = null;
    this.volume = 0.85;
    this.isMuted = false;
    this.isPrimed = false;
    this.thaiVoice = null;
    this.selectedRingtone = 'chime'; // Default ringtone
    this.activeNodes = []; // Track active oscillators/gains to stop cleanly
    this.masterGain = null;
    this.duckingGain = null;

    // Load available voices for Web Speech API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    if (!('speechSynthesis' in window)) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      this.thaiVoice = voices.find(v => v.lang.includes('th') || v.lang.includes('TH')) || null;
    } catch (e) {
      console.warn('Voice loading error:', e);
    }
  }

  /**
   * Prime AudioContext on user interaction
   */
  async prime() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
        
        // Master Gain
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);

        // Ducking Gain (smoothly lowers ringtone when speaking)
        this.duckingGain = this.audioCtx.createGain();
        this.duckingGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

        this.duckingGain.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Quick silent chirp to unlock hardware audio pipeline
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);

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

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime, 0.05);
    }
  }

  // Register an active node so we can stop it immediately on alert clear
  registerNode(node) {
    this.activeNodes.push(node);
  }

  // Clear all running audio nodes immediately
  stopAllNodes() {
    this.activeNodes.forEach(node => {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  /* -------------------------------------------------------------
   * RINGTONE 1: 🔔 Classic Chime & Bell Melody (กระดิ่งต่อเนื่องไพเราะ)
   * 4-Bar Harmonic Bell Progression that plays smoothly start to finish
   * ------------------------------------------------------------- */
  scheduleChimeLoop(startTime) {
    if (!this.audioCtx || this.isMuted) return 3.6;

    // Melody notes with chords: G4 -> C5 -> E5 -> G5 -> D5 -> B5 -> C6
    const sequence = [
      { t: 0.00, f: 783.99, d: 0.8, type: 'sine', gain: 0.35 }, // G5
      { t: 0.18, f: 659.25, d: 0.8, type: 'sine', gain: 0.32 }, // E5
      { t: 0.40, f: 523.25, d: 1.1, type: 'sine', gain: 0.38 }, // C5
      { t: 0.70, f: 587.33, d: 0.7, type: 'sine', gain: 0.30 }, // D5
      { t: 0.95, f: 659.25, d: 0.7, type: 'sine', gain: 0.32 }, // E5
      { t: 1.25, f: 783.99, d: 0.9, type: 'sine', gain: 0.38 }, // G5
      { t: 1.60, f: 1046.5, d: 1.4, type: 'sine', gain: 0.42 }, // C6 (Chime Peak)

      // Measure 2: Descending cascade response
      { t: 2.10, f: 880.00, d: 0.6, type: 'sine', gain: 0.28 }, // A5
      { t: 2.35, f: 783.99, d: 0.6, type: 'sine', gain: 0.30 }, // G5
      { t: 2.60, f: 659.25, d: 0.7, type: 'sine', gain: 0.32 }, // E5
      { t: 2.90, f: 587.33, d: 0.8, type: 'sine', gain: 0.30 }, // D5
      { t: 3.15, f: 523.25, d: 1.2, type: 'sine', gain: 0.35 }, // C5 resolve
    ];

    sequence.forEach(n => {
      this.playBellNote(n.f, startTime + n.t, n.d, n.gain, n.type);
    });

    return 3.6; // Total loop duration in seconds
  }

  playBellNote(freq, time, duration, maxGain, oscType = 'sine') {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(maxGain * this.volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.duckingGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);

    this.registerNode(osc);
  }

  /* -------------------------------------------------------------
   * RINGTONE 2: 🎵 Full Marimba Ringtone (มาริมบาเต็มเพลงสไตล์สมาร์ทโฟน)
   * Full upbeat melody with bass foundation playing from start to end
   * ------------------------------------------------------------- */
  scheduleMarimbaLoop(startTime) {
    if (!this.audioCtx || this.isMuted) return 3.2;

    const notes = [
      // Measure 1
      { t: 0.00, f: 523.25, d: 0.22, g: 0.35 }, // C5
      { t: 0.14, f: 659.25, d: 0.22, g: 0.35 }, // E5
      { t: 0.28, f: 783.99, d: 0.22, g: 0.38 }, // G5
      { t: 0.42, f: 1046.5, d: 0.30, g: 0.40 }, // C6
      { t: 0.60, f: 987.77, d: 0.22, g: 0.35 }, // B5
      { t: 0.74, f: 783.99, d: 0.22, g: 0.35 }, // G5
      { t: 0.88, f: 880.00, d: 0.32, g: 0.38 }, // A5
      { t: 1.10, f: 659.25, d: 0.35, g: 0.35 }, // E5

      // Measure 2
      { t: 1.40, f: 587.33, d: 0.22, g: 0.35 }, // D5
      { t: 1.54, f: 659.25, d: 0.22, g: 0.35 }, // E5
      { t: 1.68, f: 783.99, d: 0.25, g: 0.38 }, // G5
      { t: 1.88, f: 880.00, d: 0.25, g: 0.40 }, // A5
      { t: 2.10, f: 987.77, d: 0.28, g: 0.38 }, // B5
      { t: 2.30, f: 1046.5, d: 0.32, g: 0.42 }, // C6
      { t: 2.55, f: 783.99, d: 0.25, g: 0.35 }, // G5
      { t: 2.75, f: 523.25, d: 0.45, g: 0.40 }, // C5
    ];

    notes.forEach(n => {
      this.playMarimbaNote(n.f, startTime + n.t, n.d, n.g);
    });

    return 3.2; // Total duration
  }

  playMarimbaNote(freq, time, duration, maxGain) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(maxGain * this.volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.duckingGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);

    this.registerNode(osc);
  }

  /* -------------------------------------------------------------
   * RINGTONE 3: 📱 Digital Synth Ringtone (ริงโทนดิจิทัลสมาร์ทโฟนเต็มเพลง)
   * ------------------------------------------------------------- */
  scheduleDigitalLoop(startTime) {
    if (!this.audioCtx || this.isMuted) return 3.0;

    const pattern = [
      { t: 0.00, f: 880.0, d: 0.12 },
      { t: 0.14, f: 880.0, d: 0.12 },
      { t: 0.32, f: 1174.66, d: 0.18 }, // D6
      { t: 0.54, f: 880.0, d: 0.14 },
      { t: 0.72, f: 987.77, d: 0.14 }, // B5
      { t: 0.90, f: 1046.5, d: 0.22 }, // C6

      { t: 1.30, f: 880.0, d: 0.12 },
      { t: 1.44, f: 880.0, d: 0.12 },
      { t: 1.62, f: 1318.5, d: 0.22 }, // E6
      { t: 1.90, f: 1174.66, d: 0.18 }, // D6
      { t: 2.12, f: 1046.5, d: 0.18 }, // C6
      { t: 2.34, f: 987.77, d: 0.30 }, // B5
    ];

    pattern.forEach(p => {
      this.playSynthNote(p.f, startTime + p.t, p.d, 0.28);
    });

    return 3.0;
  }

  playSynthNote(freq, time, duration, maxGain) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(maxGain * this.volume, time + 0.015);
    gain.gain.setValueAtTime(maxGain * this.volume, time + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.duckingGain);

    osc.start(time);
    osc.stop(time + duration + 0.05);

    this.registerNode(osc);
  }

  /* -------------------------------------------------------------
   * RINGTONE 4: 🫧 Soft Pop Ambient Ringtone (ป๊อปมินิมอล ฟังสบาย)
   * ------------------------------------------------------------- */
  schedulePopLoop(startTime) {
    if (!this.audioCtx || this.isMuted) return 3.2;

    const pops = [
      { t: 0.00, f1: 440, f2: 880, d: 0.18 },
      { t: 0.24, f1: 523, f2: 1046, d: 0.18 },
      { t: 0.50, f1: 659, f2: 1318, d: 0.22 },
      { t: 0.80, f1: 440, f2: 880, d: 0.18 },
      { t: 1.10, f1: 587, f2: 1174, d: 0.20 },
      { t: 1.40, f1: 659, f2: 1318, d: 0.25 },
      { t: 1.80, f1: 783, f2: 1567, d: 0.30 },
      { t: 2.20, f1: 523, f2: 1046, d: 0.25 },
      { t: 2.60, f1: 440, f2: 880, d: 0.35 }
    ];

    pops.forEach(p => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.f1, startTime + p.t);
      osc.frequency.exponentialRampToValueAtTime(p.f2, startTime + p.t + p.d * 0.6);

      gain.gain.setValueAtTime(0.001, startTime + p.t);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, startTime + p.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + p.t + p.d);

      osc.connect(gain);
      gain.connect(this.duckingGain);

      osc.start(startTime + p.t);
      osc.stop(startTime + p.t + p.d + 0.05);

      this.registerNode(osc);
    });

    return 3.2;
  }

  /* -------------------------------------------------------------
   * RINGTONE 5: 🚨 Industrial Alert Siren Ringtone (ไซเรนโรงงานต่อเนื่อง)
   * ------------------------------------------------------------- */
  scheduleSirenLoop(startTime) {
    if (!this.audioCtx || this.isMuted) return 2.8;

    const pulses = [
      { t: 0.00, fLow: 850, fHigh: 1150, d: 0.45 },
      { t: 0.50, fLow: 850, fHigh: 1150, d: 0.45 },
      { t: 1.00, fLow: 850, fHigh: 1150, d: 0.45 },
      { t: 1.50, fLow: 850, fHigh: 1150, d: 0.45 },
      { t: 2.00, fLow: 900, fHigh: 1250, d: 0.60 }
    ];

    pulses.forEach(p => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(p.fLow, startTime + p.t);
      osc.frequency.linearRampToValueAtTime(p.fHigh, startTime + p.t + p.d * 0.5);
      osc.frequency.linearRampToValueAtTime(p.fLow, startTime + p.t + p.d);

      gain.gain.setValueAtTime(0.001, startTime + p.t);
      gain.gain.linearRampToValueAtTime(0.22 * this.volume, startTime + p.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + p.t + p.d);

      osc.connect(gain);
      gain.connect(this.duckingGain);

      osc.start(startTime + p.t);
      osc.stop(startTime + p.t + p.d + 0.05);

      this.registerNode(osc);
    });

    return 2.8;
  }

  /**
   * Schedule one iteration of chosen ringtone
   */
  scheduleRingtoneLoop(startTime) {
    switch (this.selectedRingtone) {
      case 'marimba':
        return this.scheduleMarimbaLoop(startTime);
      case 'digital':
        return this.scheduleDigitalLoop(startTime);
      case 'pop':
        return this.schedulePopLoop(startTime);
      case 'siren':
        return this.scheduleSirenLoop(startTime);
      case 'voice_only':
        return 3.0; // No music, only voice
      case 'chime':
      default:
        return this.scheduleChimeLoop(startTime);
    }
  }

  /**
   * Thai speech synthesis with ducking
   */
  speakOutSpec(customText = 'งาน out spec') {
    if (this.isMuted || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();

      // Duck ringtone music smoothly while speaking
      if (this.duckingGain && this.audioCtx) {
        const now = this.audioCtx.currentTime;
        this.duckingGain.gain.setValueAtTime(1.0, now);
        this.duckingGain.gain.linearRampToValueAtTime(0.40, now + 0.15); // Duck to 40%
      }

      const utterance = new SpeechSynthesisUtterance(customText);
      utterance.lang = 'th-TH';
      utterance.rate = 1.02;
      utterance.pitch = 1.05;
      utterance.volume = this.volume;

      if (this.thaiVoice) {
        utterance.voice = this.thaiVoice;
      }

      utterance.onend = () => {
        // Restore music volume smoothly after speech finishes
        if (this.duckingGain && this.audioCtx) {
          const now = this.audioCtx.currentTime;
          this.duckingGain.gain.setValueAtTime(0.40, now);
          this.duckingGain.gain.linearRampToValueAtTime(1.0, now + 0.25);
        }
      };

      utterance.onerror = () => {
        if (this.duckingGain && this.audioCtx) {
          this.duckingGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech error:', e);
    }
  }

  /**
   * Start continuous alarm loop from start to finish ("ตั้งแต่ต้นจนจบ")
   * The ringtone plays continuously and repeats seamlessly until stopAlarm() is called!
   */
  async startAlarm(customSpeechText = 'งาน out spec') {
    if (this.isPlaying) return;
    await this.prime();
    this.isPlaying = true;

    // Continuous Ringtone Scheduler
    const runLoop = () => {
      if (!this.isPlaying || !this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      // Schedule chosen ringtone from start to finish
      const loopDuration = this.scheduleRingtoneLoop(now);

      // Trigger Thai voice layered gracefully over the ringtone
      const voiceDelay = this.selectedRingtone === 'voice_only' ? 50 : 350;
      setTimeout(() => {
        if (this.isPlaying) {
          this.speakOutSpec(customSpeechText);
        }
      }, voiceDelay);

      // Schedule next loop seamlessly right as the current one finishes
      const intervalMs = Math.max(1500, Math.round(loopDuration * 1000));
      this.loopTimer = setTimeout(runLoop, intervalMs);
    };

    runLoop();
  }

  /**
   * Stop alarm immediately
   */
  stopAlarm() {
    this.isPlaying = false;

    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.voiceTimer) {
      clearTimeout(this.voiceTimer);
      this.voiceTimer = null;
    }

    // Stop active audio nodes
    this.stopAllNodes();

    // Cancel speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Reset ducking gain
    if (this.duckingGain && this.audioCtx) {
      this.duckingGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    }
  }

  /**
   * Preview ringtone from start to finish ("ตั้งแต่ต้นจนจบ")
   */
  async previewRingtone(ringtoneId) {
    await this.prime();
    this.stopAlarm();

    const prev = this.selectedRingtone;
    this.selectedRingtone = ringtoneId;

    const now = this.audioCtx.currentTime;
    const duration = this.scheduleRingtoneLoop(now);

    setTimeout(() => {
      this.speakOutSpec('งาน out spec');
    }, 450);

    setTimeout(() => {
      this.selectedRingtone = prev;
    }, Math.round(duration * 1000));

    return duration;
  }

  /**
   * Sweet unlock chime sound for passcode verification (0000)
   */
  playUnlockSound() {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.audioCtx = new AudioCtx();
      }

      const now = this.audioCtx.currentTime;
      const notes = [
        { f: 523.25, t: 0.00 }, // C5
        { f: 659.25, t: 0.08 }, // E5
        { f: 783.99, t: 0.16 }, // G5
        { f: 1046.5, t: 0.24 }  // C6
      ];

      notes.forEach(n => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);

        gain.gain.setValueAtTime(0.001, now + n.t);
        gain.gain.linearRampToValueAtTime(0.35, now + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + n.t);
        osc.stop(now + n.t + 0.4);
      });
    } catch (e) {}
  }
}

// Global singleton instance
window.soundEngine = new CMMSoundEngine();
