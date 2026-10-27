const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

// Data persistence setup
const DATA_DIR = path.join(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'alert_records.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAlertRecords() {
  try {
    if (fs.existsSync(RECORDS_FILE)) {
      const data = fs.readFileSync(RECORDS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading alert records file:', err);
  }
  saveAlertRecords([]);
  return [];
}

function saveAlertRecords(records) {
  try {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving alert records file:', err);
  }
}

// In-memory application state
let alertRecords = loadAlertRecords();
let activeAlerts = []; // Supports multiple simultaneous active Out of Spec alerts!
let currentRingtone = 'chime'; // Default ringtone

// Machine statuses
const machines = [
  { id: 'CMM-01', name: 'Zeiss Prismo Ultra', line: 'Machining Line A', status: 'online', inspectedCount: 0, outSpecCount: 0 },
  { id: 'CMM-02', name: 'Mitutoyo Crysta-Apex V', line: 'Machining Line B', status: 'online', inspectedCount: 0, outSpecCount: 0 },
  { id: 'CMM-03', name: 'Hexagon Global S', line: 'Casting & Forging', status: 'online', inspectedCount: 0, outSpecCount: 0 }
];

// Serve static assets & parse JSON
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Realistic catalog for mock generation
const mockCatalog = [
  {
    partName: 'Engine Block B-Series',
    partNumber: 'EB-2004',
    features: [
      { name: 'Cylinder Bore 1 Ø81.000', nominal: 81.000, usl: 81.020, lsl: 80.980, unit: 'mm' },
      { name: 'Deck Flatness ⏥', nominal: 0.000, usl: 0.012, lsl: 0.000, unit: 'mm' },
      { name: 'Camshaft Bore Linearity', nominal: 0.000, usl: 0.015, lsl: 0.000, unit: 'mm' }
    ]
  },
  {
    partName: 'Transmission Output Shaft',
    partNumber: 'TOS-4019',
    features: [
      { name: 'Spline Outer Ø32.500', nominal: 32.500, usl: 32.512, lsl: 32.488, unit: 'mm' },
      { name: 'Bearing Seat Runout ↗', nominal: 0.000, usl: 0.008, lsl: 0.000, unit: 'mm' },
      { name: 'Step Length 145.000', nominal: 145.000, usl: 145.050, lsl: 144.950, unit: 'mm' }
    ]
  },
  {
    partName: 'Brake Caliper Bracket',
    partNumber: 'BCB-991',
    features: [
      { name: 'Mounting Hole Pitch 112.000', nominal: 112.000, usl: 112.030, lsl: 111.970, unit: 'mm' },
      { name: 'Pin Hole Position ⌖', nominal: 0.000, usl: 0.025, lsl: 0.000, unit: 'mm' },
      { name: 'Pad Guide Width 28.000', nominal: 28.000, usl: 28.020, lsl: 27.980, unit: 'mm' }
    ]
  }
];

let mockInterval = null;
let mockActive = false;

/**
 * Trigger an Out of Spec alert
 * Supports multiple concurrent alerts
 */
function triggerAlert(alertData) {
  const newAlert = {
    id: `ALERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    machineId: alertData.machineId || 'CMM-01 (Zeiss Prismo)',
    partName: alertData.partName || 'Engine Component',
    partNumber: alertData.partNumber || 'PART-001',
    dimensionName: alertData.dimensionName || 'Diameter Ø50.000',
    nominal: parseFloat(alertData.nominal) || 50.0,
    usl: parseFloat(alertData.usl) || 50.015,
    lsl: parseFloat(alertData.lsl) || 49.985,
    actual: parseFloat(alertData.actual) || 50.042,
    deviation: parseFloat(alertData.deviation) || +0.027,
    unit: alertData.unit || 'mm',
    severity: alertData.severity || 'critical',
    message: alertData.message || 'งาน out spec - ขนาดชิ้นงานเกินเกณฑ์มาตรฐาน',
    operator: alertData.operator || 'Inspector CMM',
    status: 'active'
  };

  // Add to active alerts list
  activeAlerts.unshift(newAlert);

  // Add to recorded alert history and persist to disk
  alertRecords.unshift({ ...newAlert });
  saveAlertRecords(alertRecords);

  // Update machine stats
  const m = machines.find(item => item.id === alertData.machineId || alertData.machineId?.includes(item.id));
  if (m) {
    m.outSpecCount += 1;
    m.status = 'alert';
  }

  // Broadcast to all connected clients
  io.emit('alert:triggered', { newAlert, activeAlerts });
  io.emit('system:status', getSystemState());
  return newAlert;
}

/**
 * Clear/Resolve a specific alert by ID, or the first active alert if ID is omitted
 */
function clearAlert(alertId, clearedBy = 'ผู้ควบคุมระบบ (Controller)') {
  if (activeAlerts.length === 0) return null;

  let targetId = alertId;
  if (!targetId && activeAlerts.length > 0) {
    targetId = activeAlerts[0].id;
  }

  const alertIdx = activeAlerts.findIndex(a => a.id === targetId);
  if (alertIdx === -1) return null;

  const targetAlert = activeAlerts[alertIdx];
  const resolvedAlert = {
    ...targetAlert,
    status: 'resolved',
    resolvedBy: clearedBy,
    resolvedAt: new Date().toISOString()
  };

  // Remove from active alerts
  activeAlerts.splice(alertIdx, 1);

  // Update in persisted records
  const recIdx = alertRecords.findIndex(a => a.id === targetId);
  if (recIdx !== -1) {
    alertRecords[recIdx] = resolvedAlert;
    saveAlertRecords(alertRecords);
  }

  // Update machine status if no other active alerts for this machine
  machines.forEach(m => {
    const hasRemainingAlert = activeAlerts.some(a => a.machineId.includes(m.id));
    if (!hasRemainingAlert && m.status === 'alert') {
      m.status = 'online';
    }
  });

  io.emit('alert:cleared', { alertId: targetId, resolvedAlert, activeAlerts, clearedBy });
  io.emit('system:status', getSystemState());
  return resolvedAlert;
}

/**
 * Clear all currently active alerts at once
 */
function clearAllAlerts(clearedBy = 'ผู้ควบคุมระบบ (Controller)') {
  if (activeAlerts.length === 0) return [];

  const nowIso = new Date().toISOString();
  const clearedAlerts = [];

  activeAlerts.forEach(a => {
    const resolved = {
      ...a,
      status: 'resolved',
      resolvedBy: clearedBy,
      resolvedAt: nowIso
    };
    clearedAlerts.push(resolved);

    const recIdx = alertRecords.findIndex(r => r.id === a.id);
    if (recIdx !== -1) {
      alertRecords[recIdx] = resolved;
    }
  });

  activeAlerts = [];
  saveAlertRecords(alertRecords);

  // Reset all machine statuses to online
  machines.forEach(m => {
    if (m.status === 'alert') m.status = 'online';
  });

  io.emit('alert:clearedAll', { clearedAlerts, clearedBy });
  io.emit('system:status', getSystemState());
  return clearedAlerts;
}

/**
 * Acknowledge a specific alert by ID
 */
function acknowledgeAlert(alertId, ackBy = 'ผู้ควบคุมระบบ (Controller)') {
  if (activeAlerts.length === 0) return null;

  let targetId = alertId;
  if (!targetId && activeAlerts.length > 0) {
    targetId = activeAlerts[0].id;
  }

  const alertIdx = activeAlerts.findIndex(a => a.id === targetId);
  if (alertIdx === -1) return null;

  activeAlerts[alertIdx].status = 'acknowledged';
  activeAlerts[alertIdx].acknowledgedBy = ackBy;
  activeAlerts[alertIdx].acknowledgedAt = new Date().toISOString();

  const ackAlert = activeAlerts[alertIdx];

  // Update in persisted records
  const recIdx = alertRecords.findIndex(a => a.id === targetId);
  if (recIdx !== -1) {
    alertRecords[recIdx] = { ...ackAlert };
    saveAlertRecords(alertRecords);
  }

  io.emit('alert:acknowledged', { alertId: targetId, ackAlert, activeAlerts });
  io.emit('system:status', getSystemState());
  return ackAlert;
}

/**
 * Returns current snapshot of system state
 */
function getSystemState() {
  return {
    activeAlerts,
    activeAlert: activeAlerts[0] || null, // For backward compatibility
    activeAlertsCount: activeAlerts.length,
    alertHistory: alertRecords.slice(0, 100),
    totalRecordsCount: alertRecords.length,
    machines,
    mockActive,
    currentRingtone,
    serverTime: new Date().toISOString(),
    connectedClients: io.engine.clientsCount
  };
}

// REST API Endpoints
app.get('/api/state', (req, res) => {
  res.json(getSystemState());
});

app.post('/api/alert/trigger', (req, res) => {
  const alert = triggerAlert(req.body);
  res.json({ success: true, alert });
});

app.post('/api/alert/clear', (req, res) => {
  const result = clearAlert(req.body?.alertId, req.body?.clearedBy);
  res.json({ success: true, result });
});

app.post('/api/alert/clear-all', (req, res) => {
  const result = clearAllAlerts(req.body?.clearedBy);
  res.json({ success: true, result });
});

app.post('/api/alert/acknowledge', (req, res) => {
  const result = acknowledgeAlert(req.body?.alertId, req.body?.ackBy);
  res.json({ success: true, result });
});

// Records query & export API
app.get('/api/records', (req, res) => {
  res.json({
    total: alertRecords.length,
    records: alertRecords
  });
});

app.get('/api/records/export', (req, res) => {
  // Generate CSV formatted string with UTF-8 BOM for Thai language support in Excel
  const headers = [
    'Alert ID',
    'Timestamp (วันที่-เวลา)',
    'Machine (เครื่อง CMM)',
    'Part Name (ชื่อชิ้นงาน)',
    'Part Number (รหัสชิ้นงาน)',
    'Dimension / Feature (จุดที่วัด)',
    'Nominal (ค่ามาตรฐาน)',
    'LSL (พิกัดล่าง)',
    'USL (พิกัดบน)',
    'Actual (ค่าจริง)',
    'Deviation (ค่าเบี่ยงเบน)',
    'Unit (หน่วย)',
    'Severity (ระดับความรุนแรง)',
    'Status (สถานะ)',
    'Resolved By (ผู้ปิดการแจ้งเตือน)',
    'Resolved At (เวลาที่ปิด)',
    'Message (รายละเอียด)'
  ];

  const rows = alertRecords.map(r => [
    `"${r.id || ''}"`,
    `"${new Date(r.timestamp).toLocaleString('th-TH')}"`,
    `"${(r.machineId || '').replace(/"/g, '""')}"`,
    `"${(r.partName || '').replace(/"/g, '""')}"`,
    `"${(r.partNumber || '').replace(/"/g, '""')}"`,
    `"${(r.dimensionName || '').replace(/"/g, '""')}"`,
    r.nominal !== undefined ? r.nominal : '',
    r.lsl !== undefined ? r.lsl : '',
    r.usl !== undefined ? r.usl : '',
    r.actual !== undefined ? r.actual : '',
    r.deviation !== undefined ? (r.deviation > 0 ? `+${r.deviation}` : `${r.deviation}`) : '',
    `"${r.unit || 'mm'}"`,
    `"${r.severity || ''}"`,
    `"${r.status === 'active' ? 'กำลังเตือน' : r.status === 'acknowledged' ? 'รับทราบ' : 'ปิดแล้ว'}"`,
    `"${(r.resolvedBy || r.operator || '').replace(/"/g, '""')}"`,
    r.resolvedAt ? `"${new Date(r.resolvedAt).toLocaleString('th-TH')}"` : '""',
    `"${(r.message || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="CMM_Alert_Records_${Date.now()}.csv"`);
  res.send(csvContent);
});

app.post('/api/records/clear', (req, res) => {
  // Clear non-active history records
  const remainingActive = [...activeAlerts];
  alertRecords = [...remainingActive];
  saveAlertRecords(alertRecords);
  io.emit('system:status', getSystemState());
  res.json({ success: true, message: 'ล้างประวัติการแจ้งเตือนเรียบร้อยแล้ว' });
});

app.post('/api/ringtone', (req, res) => {
  if (req.body?.ringtone) {
    currentRingtone = req.body.ringtone;
    io.emit('ringtone:updated', currentRingtone);
    io.emit('system:status', getSystemState());
  }
  res.json({ success: true, currentRingtone });
});

// HTML page routing
const publicDir = path.resolve(__dirname, 'public');
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: publicDir });
});

app.get('/controller', (req, res) => {
  res.sendFile('controller.html', { root: publicDir });
});

app.get('/viewer', (req, res) => {
  res.sendFile('viewer.html', { root: publicDir });
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  socket.emit('system:status', getSystemState());

  socket.on('client:role', (role) => {
    socket.clientRole = role; // 'controller' or 'viewer'
  });

  socket.on('ringtone:set', (ringtoneId) => {
    currentRingtone = ringtoneId;
    io.emit('ringtone:updated', currentRingtone);
    io.emit('system:status', getSystemState());
  });

  socket.on('alert:trigger', (data) => {
    triggerAlert(data);
  });

  socket.on('alert:clear', (data) => {
    clearAlert(data?.alertId, data?.clearedBy || 'ผู้ควบคุมระบบ (Controller)');
  });

  socket.on('alert:clearAll', (data) => {
    clearAllAlerts(data?.clearedBy || 'ผู้ควบคุมระบบ (Controller)');
  });

  socket.on('alert:ack', (data) => {
    acknowledgeAlert(data?.alertId, data?.ackBy || 'ผู้ควบคุมระบบ (Controller)');
  });

  socket.on('records:clear', () => {
    const remainingActive = [...activeAlerts];
    alertRecords = [...remainingActive];
    saveAlertRecords(alertRecords);
    io.emit('system:status', getSystemState());
  });

  socket.on('mock:toggle', (enable) => {
    mockActive = !!enable;
    if (mockActive && !mockInterval) {
      startMockGenerator();
    } else if (!mockActive && mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
    }
    io.emit('system:status', getSystemState());
  });

  socket.on('disconnect', () => {
    io.emit('client:count', io.engine.clientsCount);
  });
});

// Auto Mock Data Generator
function startMockGenerator() {
  if (mockInterval) clearInterval(mockInterval);

  mockInterval = setInterval(() => {
    if (!mockActive) return;

    const machine = machines[Math.floor(Math.random() * machines.length)];
    const catalog = mockCatalog[Math.floor(Math.random() * mockCatalog.length)];
    const feature = catalog.features[Math.floor(Math.random() * catalog.features.length)];

    machine.inspectedCount += 1;

    // Trigger Out of Spec if active alerts count is less than 4
    const isOutSpec = Math.random() < 0.28 && activeAlerts.length < 4;

    if (isOutSpec) {
      const isOver = Math.random() > 0.5;
      const tolSpan = feature.usl - feature.nominal;
      const excess = +(tolSpan * (1.2 + Math.random() * 1.5)).toFixed(4);
      const actualVal = isOver ? +(feature.nominal + excess).toFixed(4) : +(feature.nominal - excess).toFixed(4);
      const deviation = +(actualVal - feature.nominal).toFixed(4);

      triggerAlert({
        machineId: `${machine.id} (${machine.name})`,
        partName: catalog.partName,
        partNumber: catalog.partNumber,
        dimensionName: feature.name,
        nominal: feature.nominal,
        usl: feature.usl,
        lsl: feature.lsl,
        actual: actualVal,
        deviation: deviation,
        unit: feature.unit,
        severity: Math.abs(deviation) > (tolSpan * 2) ? 'critical' : 'major',
        message: `งาน out spec - ค่าจริง ${actualVal} ${feature.unit} (${deviation > 0 ? '+' : ''}${deviation} ${feature.unit} เกินพิกัด)`,
        operator: 'Auto CMM Data Stream'
      });
    } else {
      // Normal reading
      const variation = (Math.random() - 0.5) * (feature.usl - feature.nominal) * 0.8;
      const normalActual = +(feature.nominal + variation).toFixed(4);
      io.emit('cmm:reading', {
        timestamp: new Date().toLocaleTimeString('th-TH'),
        machineId: machine.id,
        partName: catalog.partName,
        partNumber: catalog.partNumber,
        dimensionName: feature.name,
        nominal: feature.nominal,
        actual: normalActual,
        deviation: +(normalActual - feature.nominal).toFixed(4),
        unit: feature.unit,
        status: 'OK'
      });
    }
  }, 7000);
}

// Start server
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 CMM Alert System running on http://localhost:${PORT}`);
  console.log(`🎛️  Controller Web: http://localhost:${PORT}/controller`);
  console.log(`📺 Viewer Web (คนปกติ - ปิดไม่ได้): http://localhost:${PORT}/viewer`);
  console.log(`📁 Alert Records saved to: ${RECORDS_FILE}`);
  console.log(`=================================================`);
});
