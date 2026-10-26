/**
 * CMM Alert - Viewer Logic (Cute Minimalist Version)
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let currentAlert = null;
  let liveFeedList = [
    { timestamp: '18:10:24', machineId: 'CMM-01', partName: 'กระบอกสูบ Engine Block', dimensionName: 'Bore Ø81.000', actual: 81.004, deviation: 0.004 },
    { timestamp: '18:09:50', machineId: 'CMM-02', partName: 'ฝาสูบ Cylinder Head', dimensionName: 'Flatness ⏥', actual: 0.006, deviation: 0.006 },
    { timestamp: '18:09:12', machineId: 'CMM-03', partName: 'ฐานยึดเบรก Bracket', dimensionName: 'Pos ⌖', actual: 0.012, deviation: 0.012 }
  ];

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

  // Alert fields
  const alertMachine = document.getElementById('alertMachine');
  const alertPart = document.getElementById('alertPart');
  const alertDimension = document.getElementById('alertDimension');
  const alertActual = document.getElementById('alertActual');
  const alertDeviation = document.getElementById('alertDeviation');
  const alertNominal = document.getElementById('alertNominal');
  const alertUsl = document.getElementById('alertUsl');
  const alertLsl = document.getElementById('alertLsl');
  const gaugePointer = document.getElementById('gaugePointer');

  // Locked dismissal attempt elements
  const lockedAttemptBtn = document.getElementById('lockedAttemptBtn');
  const lockNoticeCard = document.getElementById('lockNoticeCard');
  const lockedToast = document.getElementById('lockedToast');

  // Normal feed
  const normalFeedBody = document.getElementById('normalFeedBody');

  // Enable Audio
  if (enableAudioBtn) {
    enableAudioBtn.addEventListener('click', async () => {
      await window.soundEngine.prime();
      audioPrimeModal.classList.add('hidden');
      if (currentAlert) {
        window.soundEngine.startAlarm('งาน out spec');
      }
    });
  }

  // Also prime audio on any click
  document.body.addEventListener('click', () => {
    if (!window.soundEngine.isPrimed) {
      window.soundEngine.prime();
      audioPrimeModal.classList.add('hidden');
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

  // Sockets
  socket.on('connect', () => {
    connectionDot.classList.remove('offline');
    connectionText.textContent = 'ออนไลน์';
  });

  socket.on('disconnect', () => {
    connectionDot.classList.add('offline');
    connectionText.textContent = 'กำลังเชื่อมต่อใหม่...';
  });

  socket.on('system:status', (state) => {
    currentAlert = state.activeAlert;
    if (state.currentRingtone) {
      updateRingtone(state.currentRingtone);
    }
    if (state.activeAlert) {
      showAlertState(state.activeAlert);
    } else {
      showNormalState();
    }
  });

  socket.on('ringtone:updated', (ringtoneId) => {
    updateRingtone(ringtoneId);
  });

  socket.on('alert:triggered', (alert) => {
    currentAlert = alert;
    showAlertState(alert);
  });

  socket.on('alert:cleared', () => {
    currentAlert = null;
    showNormalState();
  });

  socket.on('alert:acknowledged', (alert) => {
    currentAlert = alert;
    showAlertState(alert);
  });

  socket.on('cmm:reading', (reading) => {
    addLiveFeedEntry(reading);
  });

  function showAlertState(alert) {
    document.body.classList.add('in-out-spec-alert');
    alertViewSection.style.display = 'flex';
    normalViewSection.style.display = 'none';

    if (navMascotImg) navMascotImg.src = '/images/mascot-alert.jpg';

    if (window.soundEngine.isPrimed) {
      window.soundEngine.startAlarm('งาน out spec');
    }

    alertMachine.textContent = alert.machineId;
    alertPart.textContent = alert.partName;
    alertDimension.textContent = alert.dimensionName;
    alertActual.textContent = `${alert.actual.toFixed(3)} mm`;
    alertDeviation.textContent = `${alert.deviation > 0 ? '+' : ''}${alert.deviation.toFixed(3)} mm เกินพิกัด`;
    alertNominal.textContent = `${alert.nominal.toFixed(3)} mm`;
    alertUsl.textContent = `${alert.usl.toFixed(3)} mm`;
    alertLsl.textContent = `${alert.lsl.toFixed(3)} mm`;

    const tolHalf = (alert.usl - alert.nominal) || 0.02;
    const devRatio = alert.deviation / tolHalf;
    let pointerPercent = 50 + (devRatio * 25);
    pointerPercent = Math.max(6, Math.min(94, pointerPercent));
    gaugePointer.style.left = `${pointerPercent}%`;
  }

  function showNormalState() {
    document.body.classList.remove('in-out-spec-alert');
    alertViewSection.style.display = 'none';
    normalViewSection.style.display = 'flex';

    if (navMascotImg) navMascotImg.src = '/images/mascot-happy.jpg';

    if (window.soundEngine) {
      window.soundEngine.stopAlarm();
    }

    renderLiveFeed();
  }

  function addLiveFeedEntry(reading) {
    liveFeedList.unshift(reading);
    if (liveFeedList.length > 5) liveFeedList.pop();
    renderLiveFeed();
  }

  function renderLiveFeed() {
    if (!normalFeedBody) return;
    normalFeedBody.innerHTML = liveFeedList.map(r => `
      <div class="stream-item-cute">
        <div class="stream-item-left">
          <span style="font-size:1.1rem;">✅</span>
          <div>
            <div style="font-weight:700;font-size:0.9rem;font-family:var(--font-cute);">${r.partName}</div>
            <div style="font-size:0.75rem;color:var(--text-sub);">${r.machineId} &bull; ${r.dimensionName}</div>
          </div>
        </div>
        <div class="stream-item-right">
          <span>${r.actual.toFixed(3)} mm</span>
          <span class="badge badge-mint" style="font-size:0.7rem;padding:2px 8px;">ผ่าน</span>
        </div>
      </div>
    `).join('');
  }

  renderLiveFeed();
});
