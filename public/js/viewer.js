/**
 * CMM Alert - Viewer Logic (Supports Multiple Out of Spec Alerts)
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let activeAlerts = [];


  // Identify as viewer
  socket.emit('client:role', 'viewer');

  // DOM Elements
  const audioPrimeModal = document.getElementById('audioPrimeModal');
  const enableAudioBtn = document.getElementById('enableAudioBtn');
  const connectionDot = document.getElementById('connectionDot');
  const connectionText = document.getElementById('connectionText');
  const navMascotImg = document.getElementById('navMascotImg');

  const alertViewSection = document.getElementById('alertViewSection');
  const normalViewSection = document.getElementById('normalViewSection');
  const viewerAlertsListContainer = document.getElementById('viewerAlertsListContainer');
  const viewerAlertCountHeader = document.getElementById('viewerAlertCountHeader');
  const viewerRingtoneLabel = document.getElementById('viewerRingtoneLabel');

  // Locked notice click
  const lockedAttemptBtn = document.getElementById('lockedAttemptBtn');
  const lockNoticeCard = document.getElementById('lockNoticeCard');
  const lockedToast = document.getElementById('lockedToast');



  // Enable Audio
  if (enableAudioBtn) {
    enableAudioBtn.addEventListener('click', async () => {
      await window.soundEngine.prime();
      audioPrimeModal.classList.add('hidden');
      if (activeAlerts.length > 0) {
        window.soundEngine.startAlarm('งาน out spec');
      }
    });
  }

  // Also prime audio on first click anywhere on page
  document.body.addEventListener('click', () => {
    if (!window.soundEngine.isPrimed) {
      window.soundEngine.prime();
      if (audioPrimeModal) audioPrimeModal.classList.add('hidden');
    }
  }, { once: true });

  // Handle cannot dismiss click
  if (lockedAttemptBtn) {
    lockedAttemptBtn.addEventListener('click', triggerLockedDenial);
  }

  function triggerLockedDenial() {
    if (lockNoticeCard) {
      lockNoticeCard.classList.remove('wobble');
      void lockNoticeCard.offsetWidth;
      lockNoticeCard.classList.add('wobble');
    }

    if (lockedToast) {
      lockedToast.style.display = 'block';
      lockedToast.classList.remove('wobble');
      void lockedToast.offsetWidth;
      lockedToast.classList.add('wobble');
      setTimeout(() => {
        lockedToast.style.display = 'none';
      }, 4000);
    }
  }

  const viewerRingtoneText = document.getElementById('viewerRingtoneText');
  const ringtoneNames = {
    chime: '🔔 กระดิ่งเมโลดี้ต่อเนื่อง (Chime & Bell)',
    marimba: '🎵 มาริมบาโฟนเต็มเพลง (Full Marimba)',
    digital: '📱 ดิจิทัลซินธ์ริงโทน (Digital Synth)',
    pop: '🫧 ป๊อปมินิมอล (Soft Pop)',
    voice_only: '🗣️ เฉพาะเสียงพูดล้วน (Voice Only)',
    siren: '🚨 ไซเรนโรงงานต่อเนื่อง (Industrial Siren)'
  };

  function updateRingtone(ringtoneId) {
    if (window.soundEngine) {
      window.soundEngine.setRingtone(ringtoneId);
    }
    if (viewerRingtoneText) {
      viewerRingtoneText.textContent = `🎵 ริงโทนกำลังเล่นตั้งแต่ต้นจนจบ: ${ringtoneNames[ringtoneId] || ringtoneId}`;
    }
  }

  // Socket Connections
  socket.on('connect', () => {
    if (connectionDot) connectionDot.classList.remove('offline');
    if (connectionText) connectionText.textContent = 'ออนไลน์';
  });

  socket.on('disconnect', () => {
    if (connectionDot) connectionDot.classList.add('offline');
    if (connectionText) connectionText.textContent = 'กำลังเชื่อมต่อใหม่...';
  });

  socket.on('system:status', (state) => {
    activeAlerts = state.activeAlerts || (state.activeAlert ? [state.activeAlert] : []);
    if (state.currentRingtone) {
      updateRingtone(state.currentRingtone);
    }
    if (activeAlerts.length > 0) {
      showAlertState(activeAlerts);
    } else {
      showNormalState();
    }
  });

  socket.on('ringtone:updated', (ringtoneId) => {
    updateRingtone(ringtoneId);
  });

  socket.on('alert:triggered', (data) => {
    activeAlerts = data.activeAlerts || [data.newAlert];
    showAlertState(activeAlerts);
  });

  socket.on('alert:cleared', (data) => {
    activeAlerts = data.activeAlerts || [];
    if (activeAlerts.length > 0) {
      showAlertState(activeAlerts);
    } else {
      showNormalState();
    }
  });

  socket.on('alert:clearedAll', () => {
    activeAlerts = [];
    showNormalState();
  });

  socket.on('alert:acknowledged', (data) => {
    activeAlerts = data.activeAlerts || [];
    showAlertState(activeAlerts);
  });

  socket.on('cmm:reading', (reading) => {
    addLiveFeedEntry(reading);
  });

  /**
   * Render multiple active Out of Spec alerts in Viewer
   */
  function showAlertState(alerts) {
    document.body.classList.add('in-out-spec-alert');
    if (alertViewSection) alertViewSection.style.display = 'flex';
    if (normalViewSection) normalViewSection.style.display = 'none';

    if (navMascotImg) navMascotImg.src = '/images/mascot-alert.jpg';

    if (viewerAlertCountHeader) {
      viewerAlertCountHeader.textContent = `🚨 งาน out spec! ตรวจพบขนาดเกินพิกัดแล้วจ้า (${alerts.length} จุด)`;
    }

    if (window.soundEngine && window.soundEngine.isPrimed && !window.soundEngine.isPlaying) {
      window.soundEngine.startAlarm('งาน out spec');
    }

    // Render individual cards for each alert
    if (viewerAlertsListContainer) {
      viewerAlertsListContainer.innerHTML = alerts.map((alert, index) => {
        // Calculate gauge pointer position
        const tolHalf = (alert.usl - alert.nominal) || 0.02;
        const devRatio = alert.deviation / tolHalf;
        let pointerPercent = 50 + (devRatio * 25);
        pointerPercent = Math.max(6, Math.min(94, pointerPercent));

        return `
          <div class="alert-card-cute" style="border-width:2.5px;">
            
            <!-- Point Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-bottom:1.5px solid var(--border-light);padding-bottom:12px;">
              <div style="font-family:var(--font-cute);font-size:1.25rem;font-weight:700;color:#9f1239;display:flex;align-items:center;gap:10px;">
                <span>⚠️ จุดที่ ${index + 1}:</span>
                <span>${alert.machineId}</span>
                <span class="badge badge-coral" style="font-size:0.75rem;">OUT OF SPEC</span>
                ${alert.status === 'acknowledged' ? '<span class="badge badge-amber" style="font-size:0.75rem;">รับทราบแล้ว</span>' : ''}
              </div>
              <div style="font-size:0.85rem;color:var(--text-sub);font-family:var(--font-mono);">
                เวลาที่พบ: ${new Date(alert.timestamp).toLocaleTimeString('th-TH')}
              </div>
            </div>

            <!-- 3 Essential Facts -->
            <div class="easy-facts-grid">
              <div class="fact-card">
                <div class="fact-label">🏭 เครื่องจักร CMM</div>
                <div class="fact-val">${alert.machineId}</div>
              </div>
              <div class="fact-card">
                <div class="fact-label">⚙️ ชิ้นงาน & จุดที่วัด</div>
                <div class="fact-val">
                  <span>${alert.partName}</span>
                  <small style="display:block;font-size:0.85rem;color:var(--text-sub);">${alert.dimensionName}</small>
                </div>
              </div>
              <div class="fact-card">
                <div class="fact-label">📏 ค่าที่วัดได้จริง (Actual)</div>
                <div class="fact-val coral">${alert.actual.toFixed(3)} mm</div>
                <small style="font-family:var(--font-mono);color:var(--cute-coral);font-weight:700;">
                  ${alert.deviation > 0 ? '+' : ''}${alert.deviation.toFixed(3)} mm เกินพิกัด
                </small>
              </div>
            </div>

            <!-- Tolerance Gauge Bar -->
            <div class="cute-gauge-box">
              <div class="cute-gauge-title">
                <span>📊 แผนผังพิกัดความเผื่อ (TOLERANCE GAUGE)</span>
                <span style="color:var(--cute-coral);font-weight:700;">⚠️ หลุดออกจากขอบเขตมาตรฐาน</span>
              </div>

              <div class="cute-gauge-track">
                <div class="gauge-zone-fail"></div>
                <div class="gauge-zone-ok"></div>
                <div class="gauge-zone-fail"></div>
                <div class="gauge-center-line"></div>

                <div class="cute-gauge-pointer" style="left: ${pointerPercent}%;">
                  <div class="cute-pointer-arrow"></div>
                  <div class="cute-pointer-line"></div>
                </div>
              </div>

              <div class="gauge-limits-labels">
                <span>LSL: <b>${alert.lsl.toFixed(3)}</b></span>
                <span style="color:#0284c7;">ค่ามาตรฐาน (Nominal): <b>${alert.nominal.toFixed(3)}</b></span>
                <span>USL: <b>${alert.usl.toFixed(3)}</b></span>
              </div>
            </div>

          </div>
        `;
      }).join('');
    }
  }

  function showNormalState() {
    document.body.classList.remove('in-out-spec-alert');
    if (alertViewSection) alertViewSection.style.display = 'none';
    if (normalViewSection) normalViewSection.style.display = 'flex';

    if (navMascotImg) navMascotImg.src = '/images/mascot-happy.jpg';

    if (window.soundEngine) {
      window.soundEngine.stopAlarm();
    }

  }
});
