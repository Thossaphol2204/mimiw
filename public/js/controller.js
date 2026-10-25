/**
 * CMM Alert - Controller Logic (Cute Minimalist Version)
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let currentAlert = null;
  let timerInterval = null;

  // Identify as controller
  socket.emit('client:role', 'controller');

  // DOM Elements
  const connectionDot = document.getElementById('connectionDot');
  const connectionText = document.getElementById('connectionText');
  const connectedViewersEl = document.getElementById('connectedViewers');
  const activeAlertsCountEl = document.getElementById('activeAlertsCount');
  const outSpecTotalEl = document.getElementById('outSpecTotal');
  const machinesOnlineEl = document.getElementById('machinesOnline');
  const topMascotImg = document.getElementById('topMascotImg');

  const activeAlertContainer = document.getElementById('activeAlertContainer');
  const noActiveAlertMsg = document.getElementById('noActiveAlertMsg');
  const historyTableBody = document.getElementById('historyTableBody');

  const manualForm = document.getElementById('manualAlertForm');
  const mockToggle = document.getElementById('mockToggle');
  const mockSlider = document.getElementById('mockSlider');
  const testSoundBtn = document.getElementById('testSoundBtn');
  const muteToggleBtn = document.getElementById('muteToggleBtn');

  // Accordion toggle
  const accordionHeader = document.getElementById('accordionHeader');
  const accordionContent = document.getElementById('accordionContent');
  const accordionArrow = document.getElementById('accordionArrow');

  if (accordionHeader && accordionContent) {
    accordionHeader.addEventListener('click', () => {
      const isOpen = accordionContent.classList.contains('open');
      if (isOpen) {
        accordionContent.classList.remove('open');
        accordionArrow.textContent = '▼';
      } else {
        accordionContent.classList.add('open');
        accordionArrow.textContent = '▲';
      }
    });
  }

  // 1-Click Mock Preset buttons
  const presetButtons = document.querySelectorAll('.preset-card-cute');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const machine = btn.dataset.machine;
      const part = btn.dataset.part;
      const partno = btn.dataset.partno;
      const dimension = btn.dataset.dimension;
      const nominal = parseFloat(btn.dataset.nominal);
      const usl = parseFloat(btn.dataset.usl);
      const lsl = parseFloat(btn.dataset.lsl);
      const actual = parseFloat(btn.dataset.actual);
      const deviation = +(actual - nominal).toFixed(4);

      triggerAlert({
        machineId: machine,
        partName: part,
        partNumber: partno,
        dimensionName: dimension,
        nominal,
        usl,
        lsl,
        actual,
        deviation,
        unit: 'mm',
        severity: 'critical',
        message: `งาน out spec - ขนาดเกินพิกัด (${deviation > 0 ? '+' : ''}${deviation} mm)`
      });
    });
  });

  // Manual Custom Form
  manualForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const machine = document.getElementById('inputMachine').value;
    const part = document.getElementById('inputPart').value;
    const partno = document.getElementById('inputPartNo').value;
    const dimension = document.getElementById('inputDimension').value;
    const nominal = parseFloat(document.getElementById('inputNominal').value) || 0;
    const usl = parseFloat(document.getElementById('inputUsl').value) || 0;
    const lsl = parseFloat(document.getElementById('inputLsl').value) || 0;
    const actual = parseFloat(document.getElementById('inputActual').value) || 0;
    const deviation = +(actual - nominal).toFixed(4);

    triggerAlert({
      machineId: machine,
      partName: part,
      partNumber: partno,
      dimensionName: dimension,
      nominal,
      usl,
      lsl,
      actual,
      deviation,
      unit: 'mm',
      severity: 'critical',
      operator: 'Controller QC',
      message: `งาน out spec - ค่าจริง ${actual} mm (${deviation > 0 ? '+' : ''}${deviation} mm เกินพิกัด)`
    });
  });

  function triggerAlert(data) {
    socket.emit('alert:trigger', data);
    if (window.soundEngine && !window.soundEngine.isMuted) {
      window.soundEngine.startAlarm('งาน out spec');
    }
  }

  function clearCurrentAlert() {
    socket.emit('alert:clear', { clearedBy: 'ผู้ควบคุมระบบ (Controller)' });
    if (window.soundEngine) {
      window.soundEngine.stopAlarm();
    }
  }

  function acknowledgeCurrentAlert() {
    socket.emit('alert:ack', { ackBy: 'ผู้ควบคุมระบบ (Controller)' });
  }

  // Mock Toggle
  mockToggle.addEventListener('change', (e) => {
    socket.emit('mock:toggle', e.target.checked);
    updateSliderStyle(e.target.checked);
  });

  function updateSliderStyle(checked) {
    if (mockSlider) {
      mockSlider.style.backgroundColor = checked ? '#22c55e' : '#cbd5e1';
    }
  }

  // Ringtone Selector Handling
  const ringtoneCards = document.querySelectorAll('.ringtone-card');
  const currentRingtoneBadge = document.getElementById('currentRingtoneBadge');
  const previewButtons = document.querySelectorAll('.btn-preview');

  const ringtoneNames = {
    chime: '🔔 กระดิ่ง Ding-Dong',
    marimba: '🎵 มาริมบา / Xylophone',
    digital: '📱 บี๊บดิจิทัล 2 จังหวะ',
    pop: '🫧 ป๊อปมินิมอล',
    voice_only: '🗣️ เฉพาะเสียงพูดล้วน',
    siren: '🚨 ไซเรนโรงงาน'
  };

  function applyRingtoneUI(ringtoneId) {
    if (window.soundEngine) {
      window.soundEngine.setRingtone(ringtoneId);
    }
    ringtoneCards.forEach(card => {
      if (card.dataset.ringtone === ringtoneId) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
    if (currentRingtoneBadge) {
      currentRingtoneBadge.textContent = `กำลังใช้: ${ringtoneNames[ringtoneId] || ringtoneId}`;
    }
  }

  ringtoneCards.forEach(card => {
    card.addEventListener('click', () => {
      const ringtoneId = card.dataset.ringtone;
      applyRingtoneUI(ringtoneId);
      socket.emit('ringtone:set', ringtoneId);
    });
  });

  previewButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const soundId = btn.dataset.sound;
      btn.textContent = '🔊 กำลังเล่น...';
      await window.soundEngine.previewRingtone(soundId);
      setTimeout(() => {
        btn.textContent = '▶️ ลองฟัง';
      }, 1500);
    });
  });

  // Sound Test (using current selected ringtone)
  testSoundBtn.addEventListener('click', async () => {
    testSoundBtn.textContent = '🔊 กำลังทดสอบ...';
    await window.soundEngine.previewRingtone(window.soundEngine.selectedRingtone);
    setTimeout(() => {
      testSoundBtn.textContent = '🔊 ทดสอบเสียง ("งาน out spec")';
    }, 1600);
  });

  // Mute Toggle
  let isMutedLocally = false;
  muteToggleBtn.addEventListener('click', () => {
    isMutedLocally = !isMutedLocally;
    window.soundEngine.isMuted = isMutedLocally;
    if (isMutedLocally) {
      window.soundEngine.stopAlarm();
      muteToggleBtn.innerHTML = `🔇 ปิดเสียงฝั่ง Controller แล้ว`;
      muteToggleBtn.classList.remove('btn-soft');
      muteToggleBtn.classList.add('btn-coral');
    } else {
      muteToggleBtn.innerHTML = `🔊 เสียงฝั่ง Controller (On)`;
      muteToggleBtn.classList.add('btn-soft');
      muteToggleBtn.classList.remove('btn-coral');
    }
  });

  // Socket Connection Status
  socket.on('connect', () => {
    connectionDot.classList.remove('offline');
    connectionText.textContent = 'เชื่อมต่อแล้ว';
  });

  socket.on('disconnect', () => {
    connectionDot.classList.add('offline');
    connectionText.textContent = 'กำลังเชื่อมต่อใหม่...';
  });

  // State Updates
  socket.on('system:status', (state) => {
    renderSystemStatus(state);
  });

  socket.on('alert:triggered', (alert) => {
    currentAlert = alert;
    renderActiveAlert(alert);
    if (window.soundEngine && !isMutedLocally) {
      window.soundEngine.startAlarm('งาน out spec');
    }
  });

  socket.on('alert:cleared', () => {
    currentAlert = null;
    renderActiveAlert(null);
    if (window.soundEngine) {
      window.soundEngine.stopAlarm();
    }
  });

  socket.on('alert:acknowledged', (alert) => {
    currentAlert = alert;
    renderActiveAlert(alert);
  });

  socket.on('ringtone:updated', (ringtoneId) => {
    applyRingtoneUI(ringtoneId);
  });

  function renderSystemStatus(state) {
    currentAlert = state.activeAlert;
    mockToggle.checked = !!state.mockActive;
    updateSliderStyle(!!state.mockActive);
    if (state.currentRingtone) {
      applyRingtoneUI(state.currentRingtone);
    }

    // Stats
    activeAlertsCountEl.textContent = state.activeAlert ? '1' : '0';
    activeAlertsCountEl.style.color = state.activeAlert ? 'var(--cute-coral)' : 'var(--cute-mint)';

    const totalOutSpec = state.machines.reduce((sum, m) => sum + m.outSpecCount, 0);
    outSpecTotalEl.textContent = totalOutSpec;

    const onlineCount = state.machines.filter(m => m.status !== 'offline').length;
    machinesOnlineEl.textContent = `${onlineCount} / ${state.machines.length}`;

    if (state.connectedClients) {
      connectedViewersEl.textContent = state.connectedClients;
    }

    renderActiveAlert(state.activeAlert);
    renderHistory(state.alertHistory);
  }

  function renderActiveAlert(alert) {
    if (timerInterval) clearInterval(timerInterval);

    if (!alert) {
      activeAlertContainer.style.display = 'none';
      noActiveAlertMsg.style.display = 'flex';
      if (topMascotImg) topMascotImg.src = '/images/mascot-happy.jpg';
      return;
    }

    activeAlertContainer.style.display = 'block';
    noActiveAlertMsg.style.display = 'none';
    if (topMascotImg) topMascotImg.src = '/images/mascot-alert.jpg';

    const startTime = new Date(alert.timestamp).getTime();
    const updateElapsed = () => {
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
      const secs = (elapsedSec % 60).toString().padStart(2, '0');
      const el = document.getElementById('activeElapsedTimer');
      if (el) el.textContent = `${mins}:${secs}`;
    };
    updateElapsed();
    timerInterval = setInterval(updateElapsed, 1000);

    const isAck = alert.status === 'acknowledged';

    activeAlertContainer.innerHTML = `
      <div class="active-alert-box">
        <div class="alert-top-banner">
          <div class="alert-title-cute">
            <span>🚨</span>
            <span>ตรวจพบงาน Out of Spec! กำลังแจ้งเตือนอยู่จ้า</span>
            ${isAck ? '<span class="badge badge-amber">⚠️ รับทราบแล้ว</span>' : ''}
          </div>
          <div style="font-family:var(--font-mono);font-size:0.875rem;color:#9f1239;font-weight:700;">
            เวลาที่แจ้งเตือนมาแล้ว: <span id="activeElapsedTimer" style="background:#fff;padding:2px 8px;border-radius:6px;">00:00</span>
          </div>
        </div>

        <div class="alert-simple-summary">
          <div class="alert-simple-item">
            <div class="lbl">เครื่องจักร & ชิ้นส่วน</div>
            <div class="val">${alert.machineId.split(' ')[0]} - ${alert.partName}</div>
          </div>
          <div class="alert-simple-item">
            <div class="lbl">จุดที่ตรวจวัด (Feature)</div>
            <div class="val">${alert.dimensionName}</div>
          </div>
          <div class="alert-simple-item">
            <div class="lbl">ค่ามาตรฐาน (Nominal)</div>
            <div class="val">${alert.nominal.toFixed(3)} mm (พิกัด: ${alert.lsl.toFixed(3)} - ${alert.usl.toFixed(3)})</div>
          </div>
          <div class="alert-simple-item">
            <div class="lbl">ค่าที่วัดได้จริง (Actual)</div>
            <div class="val coral">${alert.actual.toFixed(3)} mm (${alert.deviation > 0 ? '+' : ''}${alert.deviation.toFixed(3)} mm)</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button id="btnClearAlert" class="btn btn-mint btn-lg" style="flex:1;">
            ✅ เคลียร์การแจ้งเตือน (Clear Alert & Reset)
          </button>
          ${!isAck ? `
          <button id="btnAckAlert" class="btn btn-soft btn-lg">
            ⚠️ รับทราบเหตุการณ์ (Acknowledge)
          </button>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('btnClearAlert').addEventListener('click', clearCurrentAlert);
    const ackBtn = document.getElementById('btnAckAlert');
    if (ackBtn) ackBtn.addEventListener('click', acknowledgeCurrentAlert);
  }

  function renderHistory(history) {
    if (!historyTableBody) return;
    if (!history || history.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-sub);padding:24px;">ยังไม่มีประวัติการแจ้งเตือนจ้า</td></tr>';
      return;
    }

    historyTableBody.innerHTML = history.map(item => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:0.8rem;">${new Date(item.timestamp).toLocaleTimeString('th-TH')}</td>
        <td><b>${item.machineId.split(' ')[0]}</b></td>
        <td>${item.partName}</td>
        <td>${item.dimensionName}</td>
        <td style="font-family:var(--font-mono);">
          <span style="color:${item.deviation !== 0 ? 'var(--cute-coral)' : 'var(--text-main)'};font-weight:700;">
            ${item.actual.toFixed(3)} (${item.deviation > 0 ? '+' : ''}${item.deviation.toFixed(3)})
          </span>
        </td>
        <td>
          <span class="badge ${item.status === 'active' ? 'badge-coral' : item.status === 'acknowledged' ? 'badge-amber' : 'badge-mint'}">
            ${item.status === 'active' ? '🚨 กำลังเตือน' : item.status === 'acknowledged' ? '⚠️ รับทราบ' : '✅ เรียบร้อย'}
          </span>
        </td>
        <td style="font-size:0.8rem;color:var(--text-sub);">${item.resolvedBy || item.operator || '-'}</td>
      </tr>
    `).join('');
  }
});
