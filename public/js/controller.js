/**
 * CMM Alert - Controller Logic (Multiple Active Alerts & Persistent Records)
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let activeAlerts = [];
  let allRecords = [];
  let activeTimers = {};

  // Identify as controller
  socket.emit('client:role', 'controller');

  // DOM Elements - Status & Stats
  const connectionDot = document.getElementById('connectionDot');
  const connectionText = document.getElementById('connectionText');
  const connectedViewersEl = document.getElementById('connectedViewers');
  const activeAlertsCountEl = document.getElementById('activeAlertsCount');
  const outSpecTotalEl = document.getElementById('outSpecTotal');
  const machinesOnlineEl = document.getElementById('machinesOnline');
  const topMascotImg = document.getElementById('topMascotImg');

  // Active Alerts Elements
  const activeAlertsHeader = document.getElementById('activeAlertsHeader');
  const activeAlertsContainer = document.getElementById('activeAlertsContainer');
  const noActiveAlertMsg = document.getElementById('noActiveAlertMsg');
  const activeCountBadge = document.getElementById('activeCountBadge');
  const clearAllCountText = document.getElementById('clearAllCountText');
  const btnClearAllAlerts = document.getElementById('btnClearAllAlerts');

  // Records Table Elements
  const historyTableBody = document.getElementById('historyTableBody');
  const recordTotalBadge = document.getElementById('recordTotalBadge');
  const recordSearchInput = document.getElementById('recordSearchInput');
  const recordStatusFilter = document.getElementById('recordStatusFilter');
  const filteredRecordsCount = document.getElementById('filteredRecordsCount');
  const btnClearRecordsLog = document.getElementById('btnClearRecordsLog');

  // Form & Controls
  const manualForm = document.getElementById('manualAlertForm');
  const mockToggle = document.getElementById('mockToggle');
  const mockSlider = document.getElementById('mockSlider');
  const testSoundBtn = document.getElementById('testSoundBtn');
  const muteToggleBtn = document.getElementById('muteToggleBtn');
  const btnTriggerMulti3 = document.getElementById('btnTriggerMulti3');

  // ==========================================
  // Trigger Functions
  // ==========================================
  function triggerSingleAlert(data) {
    socket.emit('alert:trigger', data);
    if (window.soundEngine && !window.soundEngine.isMuted) {
      window.soundEngine.startAlarm('งาน out spec');
    }
  }

  function clearSingleAlert(alertId) {
    socket.emit('alert:clear', { alertId, clearedBy: 'ผู้ควบคุมระบบ (Controller)' });
  }

  function clearAllActiveAlerts() {
    if (activeAlerts.length === 0) return;
    if (confirm(`ต้องการปิดการแจ้งเตือนงาน Out of Spec ทั้งหมด ${activeAlerts.length} จุดใช่หรือไม่?`)) {
      socket.emit('alert:clearAll', { clearedBy: 'ผู้ควบคุมระบบ (Controller)' });
      if (window.soundEngine) {
        window.soundEngine.stopAlarm();
      }
    }
  }

  function acknowledgeSingleAlert(alertId) {
    socket.emit('alert:ack', { alertId, ackBy: 'ผู้ควบคุมระบบ (Controller)' });
  }

  // Clear All button click
  if (btnClearAllAlerts) {
    btnClearAllAlerts.addEventListener('click', clearAllActiveAlerts);
  }

  // Preset Cards click
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

      triggerSingleAlert({
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
        operator: 'Controller QC Preset',
        message: `งาน out spec - ค่าจริง ${actual} mm (${deviation > 0 ? '+' : ''}${deviation} mm เกินพิกัด)`
      });
    });
  });

  // 3-Point Simultaneous Trigger (Special Feature)
  if (btnTriggerMulti3) {
    btnTriggerMulti3.addEventListener('click', () => {
      const presets = [
        {
          machineId: 'CMM-01 (Zeiss Prismo)',
          partName: 'กระบอกสูบ Engine Block',
          partNumber: 'EB-2004',
          dimensionName: 'Cylinder Bore 1 Ø81.000',
          nominal: 81.000,
          usl: 81.020,
          lsl: 80.980,
          actual: 81.054,
          deviation: +0.054,
          unit: 'mm',
          severity: 'critical',
          operator: 'Multi Trigger Test',
          message: 'งาน out spec - ขนาดกระบอกสูบโตเกินพิกัด (+0.054 mm)'
        },
        {
          machineId: 'CMM-02 (Mitutoyo Crysta)',
          partName: 'ฝาสูบ Cylinder Head',
          partNumber: 'CB-1049',
          dimensionName: 'Gasket Flatness ⏥',
          nominal: 0.000,
          usl: 0.015,
          lsl: 0.000,
          actual: 0.038,
          deviation: +0.038,
          unit: 'mm',
          severity: 'major',
          operator: 'Multi Trigger Test',
          message: 'งาน out spec - ระนาบฝาสูบโก่งเกินพิกัด (+0.038 mm)'
        },
        {
          machineId: 'CMM-03 (Hexagon Global)',
          partName: 'ฐานยึดก้ามปูเบรก Caliper',
          partNumber: 'BCB-991',
          dimensionName: 'Mounting Hole Pitch 112.000',
          nominal: 112.000,
          usl: 112.030,
          lsl: 111.970,
          actual: 112.062,
          deviation: +0.062,
          unit: 'mm',
          severity: 'critical',
          operator: 'Multi Trigger Test',
          message: 'งาน out spec - ระยะศูนย์กลางรูเจาะเบี้ยว (+0.062 mm)'
        }
      ];

      presets.forEach((p, idx) => {
        setTimeout(() => {
          triggerSingleAlert(p);
        }, idx * 250);
      });
    });
  }

  // Manual Custom Form Submission
  if (manualForm) {
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

      triggerSingleAlert({
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
  }

  // Mock Toggle
  if (mockToggle) {
    mockToggle.addEventListener('change', (e) => {
      socket.emit('mock:toggle', e.target.checked);
      updateSliderStyle(e.target.checked);
    });
  }

  function updateSliderStyle(checked) {
    if (mockSlider) {
      mockSlider.style.backgroundColor = checked ? '#22c55e' : '#cbd5e1';
    }
  }

  // ==========================================
  // Ringtone Selection
  // ==========================================
  const ringtoneCards = document.querySelectorAll('.ringtone-card');
  const currentRingtoneBadge = document.getElementById('currentRingtoneBadge');
  const previewButtons = document.querySelectorAll('.btn-preview');

  const ringtoneNames = {
    chime: '🔔 กระดิ่งเมโลดี้ต่อเนื่อง (Chime & Bell)',
    marimba: '🎵 มาริมบาโฟนเต็มเพลง (Full Marimba)',
    digital: '📱 ดิจิทัลซินธ์ริงโทน (Digital Synth)',
    pop: '🫧 ป๊อปมินิมอล (Soft Pop)',
    voice_only: '🗣️ เฉพาะเสียงพูดล้วน (Voice Only)',
    siren: '🚨 ไซเรนโรงงานต่อเนื่อง (Industrial Siren)'
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
      btn.textContent = '🔊 กำลังเล่นเต็มเพลง...';
      const duration = await window.soundEngine.previewRingtone(soundId);
      const waitMs = Math.round((duration || 3.2) * 1000);
      setTimeout(() => {
        btn.textContent = '▶️ ลองฟังเต็มเพลง';
      }, waitMs);
    });
  });

  // Sound Test (using current selected ringtone from start to finish)
  if (testSoundBtn) {
    testSoundBtn.addEventListener('click', async () => {
      testSoundBtn.textContent = '🔊 กำลังทดสอบริงโทนเต็มเพลง...';
      const duration = await window.soundEngine.previewRingtone(window.soundEngine.selectedRingtone);
      const waitMs = Math.round((duration || 3.2) * 1000);
      setTimeout(() => {
        testSoundBtn.textContent = '🔊 ทดสอบเสียง ("งาน out spec")';
      }, waitMs);
    });
  }

  // Local Mute Toggle
  let isMutedLocally = false;
  if (muteToggleBtn) {
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
  }

  // Clear Records Log
  if (btnClearRecordsLog) {
    btnClearRecordsLog.addEventListener('click', () => {
      if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติการแจ้งเตือนที่บันทึกไว้? (รายการที่กำลังเตือนอยู่จะไม่ถูกลบ)')) {
        socket.emit('records:clear');
      }
    });
  }

  // Filter & Search Event Listeners
  if (recordSearchInput) {
    recordSearchInput.addEventListener('input', () => filterAndRenderRecords());
  }
  if (recordStatusFilter) {
    recordStatusFilter.addEventListener('change', () => filterAndRenderRecords());
  }

  // ==========================================
  // Socket Connection Handlers
  // ==========================================
  socket.on('connect', () => {
    if (connectionDot) connectionDot.classList.remove('offline');
    if (connectionText) connectionText.textContent = 'เชื่อมต่อแล้ว';
  });

  socket.on('disconnect', () => {
    if (connectionDot) connectionDot.classList.add('offline');
    if (connectionText) connectionText.textContent = 'กำลังเชื่อมต่อใหม่...';
  });

  socket.on('system:status', (state) => {
    renderSystemStatus(state);
  });

  socket.on('alert:triggered', (data) => {
    activeAlerts = data.activeAlerts || [data.newAlert];
    renderActiveAlertsList(activeAlerts);
    if (window.soundEngine && !isMutedLocally) {
      window.soundEngine.startAlarm('งาน out spec');
    }
  });

  socket.on('alert:cleared', (data) => {
    activeAlerts = data.activeAlerts || [];
    renderActiveAlertsList(activeAlerts);
    if (activeAlerts.length === 0 && window.soundEngine) {
      window.soundEngine.stopAlarm();
    }
  });

  socket.on('alert:clearedAll', () => {
    activeAlerts = [];
    renderActiveAlertsList([]);
    if (window.soundEngine) {
      window.soundEngine.stopAlarm();
    }
  });

  socket.on('alert:acknowledged', (data) => {
    activeAlerts = data.activeAlerts || [];
    renderActiveAlertsList(activeAlerts);
  });

  socket.on('ringtone:updated', (ringtoneId) => {
    applyRingtoneUI(ringtoneId);
  });

  // ==========================================
  // Render Functions
  // ==========================================
  function renderSystemStatus(state) {
    activeAlerts = state.activeAlerts || (state.activeAlert ? [state.activeAlert] : []);
    allRecords = state.alertHistory || [];

    if (mockToggle) {
      mockToggle.checked = !!state.mockActive;
      updateSliderStyle(!!state.mockActive);
    }
    if (state.currentRingtone) {
      applyRingtoneUI(state.currentRingtone);
    }

    // Top Stats
    const activeCount = activeAlerts.length;
    if (activeAlertsCountEl) {
      activeAlertsCountEl.textContent = activeCount;
      activeAlertsCountEl.style.color = activeCount > 0 ? 'var(--cute-coral)' : 'var(--cute-mint)';
    }

    const totalOutSpec = state.machines.reduce((sum, m) => sum + m.outSpecCount, 0);
    if (outSpecTotalEl) outSpecTotalEl.textContent = totalOutSpec;

    const onlineCount = state.machines.filter(m => m.status !== 'offline').length;
    if (machinesOnlineEl) machinesOnlineEl.textContent = `${onlineCount} / ${state.machines.length}`;

    if (state.connectedClients && connectedViewersEl) {
      connectedViewersEl.textContent = state.connectedClients;
    }

    if (topMascotImg) {
      topMascotImg.src = activeCount > 0 ? '/images/mascot-alert.jpg' : '/images/mascot-happy.jpg';
    }

    // Sound control
    if (activeCount > 0) {
      if (window.soundEngine && !isMutedLocally && !window.soundEngine.isPlaying) {
        window.soundEngine.startAlarm('งาน out spec');
      }
    } else {
      if (window.soundEngine && window.soundEngine.isPlaying) {
        window.soundEngine.stopAlarm();
      }
    }

    renderActiveAlertsList(activeAlerts);
    filterAndRenderRecords();
  }

  /**
   * Render all currently active Out of Spec alerts
   * Displays multiple cards with individual "Close This Point" buttons
   */
  function renderActiveAlertsList(alerts) {
    // Clear existing timer intervals
    Object.values(activeTimers).forEach(timer => clearInterval(timer));
    activeTimers = {};

    if (!alerts || alerts.length === 0) {
      if (activeAlertsHeader) activeAlertsHeader.style.display = 'none';
      if (activeAlertsContainer) activeAlertsContainer.innerHTML = '';
      if (noActiveAlertMsg) noActiveAlertMsg.style.display = 'flex';
      return;
    }

    if (noActiveAlertMsg) noActiveAlertMsg.style.display = 'none';
    if (activeAlertsHeader) {
      activeAlertsHeader.style.display = 'flex';
      if (activeCountBadge) activeCountBadge.textContent = `${alerts.length} จุด`;
      if (clearAllCountText) clearAllCountText.textContent = alerts.length;
    }

    // Render individual alert cards
    activeAlertsContainer.innerHTML = alerts.map((alert, index) => {
      const isAck = alert.status === 'acknowledged';
      const timerId = `elapsed_${alert.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

      return `
        <div class="active-alert-box" data-alert-id="${alert.id}">
          
          <div class="alert-top-banner">
            <div class="alert-title-cute">
              <span>🚨</span>
              <span>จุดที่ ${index + 1}: ${alert.machineId} — ${alert.partName}</span>
              ${isAck ? '<span class="badge badge-amber">⚠️ รับทราบแล้ว</span>' : '<span class="badge badge-coral">กำลังแจ้งเตือน</span>'}
            </div>
            <div style="font-family:var(--font-mono);font-size:0.875rem;color:#9f1239;font-weight:700;">
              เวลาแจ้งเตือน: <span id="${timerId}" style="background:#fff;padding:2px 8px;border-radius:6px;border:1px solid #fecdd3;">00:00</span>
            </div>
          </div>

          <div class="alert-simple-summary">
            <div class="alert-simple-item">
              <div class="lbl">เครื่องจักร & ชิ้นงาน</div>
              <div class="val">${alert.machineId} (${alert.partNumber || '-'})</div>
            </div>
            <div class="alert-simple-item">
              <div class="lbl">จุดที่ตรวจวัด (Feature)</div>
              <div class="val">${alert.dimensionName}</div>
            </div>
            <div class="alert-simple-item">
              <div class="lbl">ค่ามาตรฐาน (Nominal) [พิกัด LSL - USL]</div>
              <div class="val">${alert.nominal.toFixed(3)} mm [${alert.lsl.toFixed(3)} ถึง ${alert.usl.toFixed(3)}]</div>
            </div>
            <div class="alert-simple-item">
              <div class="lbl">ค่าที่วัดได้จริง (Actual & Deviation)</div>
              <div class="val coral">${alert.actual.toFixed(3)} mm (${alert.deviation > 0 ? '+' : ''}${alert.deviation.toFixed(3)} mm)</div>
            </div>
          </div>

          <!-- Individual Close & Acknowledge Actions -->
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-top:1.5px dashed var(--cute-coral-border);padding-top:14px;">
            <button class="btn btn-mint btn-lg btn-close-single" data-alert-id="${alert.id}" style="flex:1;min-width:220px;font-weight:700;">
              ✅ ปิดการแจ้งเตือนจุดนี้ (Close This Point)
            </button>
            ${!isAck ? `
            <button class="btn btn-soft btn-lg btn-ack-single" data-alert-id="${alert.id}">
              ⚠️ รับทราบจุดนี้ (Acknowledge)
            </button>
            ` : ''}
          </div>

        </div>
      `;
    }).join('');

    // Setup live timers for each card
    alerts.forEach(alert => {
      const timerElementId = `elapsed_${alert.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const startTime = new Date(alert.timestamp).getTime();

      const updateTimer = () => {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
        const secs = (elapsedSec % 60).toString().padStart(2, '0');
        const el = document.getElementById(timerElementId);
        if (el) el.textContent = `${mins}:${secs}`;
      };

      updateTimer();
      activeTimers[alert.id] = setInterval(updateTimer, 1000);
    });

    // Attach individual button event listeners
    document.querySelectorAll('.btn-close-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.alertId;
        clearSingleAlert(id);
      });
    });

    document.querySelectorAll('.btn-ack-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.alertId;
        acknowledgeSingleAlert(id);
      });
    });
  }

  /**
   * Filter and render Alert Records table
   */
  function filterAndRenderRecords() {
    if (!historyTableBody) return;

    const searchTerm = (recordSearchInput ? recordSearchInput.value : '').toLowerCase().trim();
    const statusFilter = recordStatusFilter ? recordStatusFilter.value : 'all';

    let filtered = allRecords.filter(item => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm) {
        const combined = `${item.machineId} ${item.partName} ${item.partNumber} ${item.dimensionName} ${item.operator} ${item.resolvedBy}`.toLowerCase();
        if (!combined.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });

    if (recordTotalBadge) {
      recordTotalBadge.textContent = `${allRecords.length} รายการ`;
    }

    if (filteredRecordsCount) {
      filteredRecordsCount.textContent = `แสดง ${filtered.length} จากทั้งหมด ${allRecords.length} รายการ`;
    }

    if (filtered.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;color:var(--text-sub);padding:32px;">
            ${allRecords.length === 0 ? 'ยังไม่มีประวัติการแจ้งเตือนที่บันทึกไว้' : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = filtered.map(item => {
      const isOut = item.deviation !== 0;
      const statusBadge = item.status === 'active'
        ? '<span class="badge badge-coral">🚨 กำลังเตือน</span>'
        : item.status === 'acknowledged'
        ? '<span class="badge badge-amber">⚠️ รับทราบ</span>'
        : '<span class="badge badge-mint">✅ ปิดแล้ว</span>';

      const resolvedInfo = item.status === 'resolved'
        ? `<div style="font-weight:600;font-size:0.8rem;">${item.resolvedBy || 'Controller'}</div><div style="font-size:0.75rem;color:var(--text-sub);font-family:var(--font-mono);">${item.resolvedAt ? new Date(item.resolvedAt).toLocaleTimeString('th-TH') : '-'}</div>`
        : `<span style="color:var(--text-sub);font-size:0.8rem;">${item.status === 'acknowledged' ? `รับทราบโดย ${item.acknowledgedBy || 'Controller'}` : 'รอดำเนินการ'}</span>`;

      return `
        <tr>
          <td style="font-family:var(--font-mono);font-size:0.8rem;white-space:nowrap;">
            ${new Date(item.timestamp).toLocaleDateString('th-TH')}<br>
            <b>${new Date(item.timestamp).toLocaleTimeString('th-TH')}</b>
          </td>
          <td><b>${item.machineId.split(' ')[0]}</b></td>
          <td>
            <div style="font-weight:700;">${item.partName}</div>
            <div style="font-size:0.75rem;color:var(--text-sub);font-family:var(--font-mono);">${item.partNumber || '-'}</div>
          </td>
          <td>${item.dimensionName}</td>
          <td style="font-family:var(--font-mono);font-size:0.8rem;">
            ${item.nominal.toFixed(3)}<br>
            <span style="color:var(--text-sub);font-size:0.75rem;">[${item.lsl.toFixed(3)} - ${item.usl.toFixed(3)}]</span>
          </td>
          <td style="font-family:var(--font-mono);">
            <div style="color:${isOut ? 'var(--cute-coral)' : 'var(--text-main)'};font-weight:700;">
              ${item.actual.toFixed(3)} ${item.unit || 'mm'}
            </div>
            <div style="font-size:0.75rem;color:${item.deviation > 0 ? '#ef4444' : '#3b82f6'};">
              ${item.deviation > 0 ? '+' : ''}${item.deviation.toFixed(3)}
            </div>
          </td>
          <td>${statusBadge}</td>
          <td>${resolvedInfo}</td>
        </tr>
      `;
    }).join('');
  }
});
