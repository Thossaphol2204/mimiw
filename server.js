const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3000;

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory state for CMM Alert System
let activeAlert = null;
let currentRingtone = 'chime'; // Default to normal chime ringtone
let alertHistory = [
  {
    id: 'ALERT-MOCK-001',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    machineId: 'CMM-01 (Zeiss Prismo)',
    partName: 'Crankshaft Pin 4-Cyl',
    partNumber: 'CK-8821',
    dimensionName: 'Main Journal Diameter Ø65.000',
    nominal: 65.000,
    usl: 65.015,
    lsl: 64.985,
    actual: 65.038,
    deviation: +0.023,
    unit: 'mm',
    severity: 'critical',
    message: 'งาน out spec - ขนาดโตเกินพิกัดบน (+0.023 mm)',
    status: 'resolved',
    resolvedBy: 'Admin (QC Manager)',
    resolvedAt: new Date(Date.now() - 3400000).toISOString()
  },
  {
    id: 'ALERT-MOCK-002',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    machineId: 'CMM-02 (Mitutoyo Crysta)',
    partName: 'Cylinder Block Head',
    partNumber: 'CB-1049',
    dimensionName: 'Gasket Surface Flatness ⏥',
    nominal: 0.000,
    usl: 0.015,
    lsl: 0.000,
    actual: 0.032,
    deviation: +0.017,
    unit: 'mm',
    severity: 'major',
    message: 'งาน out spec - ความเรียบผิวเกินพิกัด (+0.017 mm)',
    status: 'resolved',
    resolvedBy: 'Admin (QC Manager)',
    resolvedAt: new Date(Date.now() - 1500000).toISOString()
  }
];

// Machine statuses
const machines = [
  { id: 'CMM-01', name: 'Zeiss Prismo Ultra', line: 'Machining Line A', status: 'online', inspectedCount: 142, outSpecCount: 1 },
  { id: 'CMM-02', name: 'Mitutoyo Crysta-Apex V', line: 'Machining Line B', status: 'online', inspectedCount: 198, outSpecCount: 1 },
  { id: 'CMM-03', name: 'Hexagon Global S', line: 'Casting & Forging', status: 'online', inspectedCount: 86, outSpecCount: 0 }
];

// Mock data generator state
let mockInterval = null;
let mockActive = false;

// Sample parts and dimensions for realistic CMM mock simulation
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

function triggerAlert(alertData) {
  const newAlert = {
    id: `ALERT-${Date.now().toString(36).toUpperCase()}`,
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

  activeAlert = newAlert;
  alertHistory.unshift({ ...newAlert });

  // Update machine stats
  const m = machines.find(item => item.id === alertData.machineId || alertData.machineId?.includes(item.id));
  if (m) {
    m.outSpecCount += 1;
    m.status = 'alert';
  }

  io.emit('alert:triggered', activeAlert);
  io.emit('system:status', getSystemState());
  return activeAlert;
}

function clearAlert(clearedBy = 'ผู้ควบคุมระบบ (Controller)') {
  if (!activeAlert) return null;

  const resolvedAlert = {
    ...activeAlert,
    status: 'resolved',
    resolvedBy: clearedBy,
    resolvedAt: new Date().toISOString()
  };

  // Update in history
  const idx = alertHistory.findIndex(a => a.id === activeAlert.id);
  if (idx !== -1) {
    alertHistory[idx] = resolvedAlert;
  }

  // Restore machine statuses
  machines.forEach(m => {
    if (m.status === 'alert') m.status = 'online';
  });

  activeAlert = null;
  io.emit('alert:cleared', { resolvedAlert, clearedBy });
  io.emit('system:status', getSystemState());
  return resolvedAlert;
}

function acknowledgeAlert(ackBy = 'Controller') {
  if (!activeAlert) return null;
  activeAlert.status = 'acknowledged';
  activeAlert.acknowledgedBy = ackBy;
  activeAlert.acknowledgedAt = new Date().toISOString();

  // Update history
  const idx = alertHistory.findIndex(a => a.id === activeAlert.id);
  if (idx !== -1) {
    alertHistory[idx] = { ...activeAlert };
  }

  io.emit('alert:acknowledged', activeAlert);
  io.emit('system:status', getSystemState());
  return activeAlert;
}

function getSystemState() {
  return {
    activeAlert,
    alertHistory: alertHistory.slice(0, 20),
    machines,
    mockActive,
    currentRingtone,
    serverTime: new Date().toISOString(),
    connectedClients: io.engine.clientsCount
  };
}

// REST API endpoints for quick testing & external hooks
app.get('/api/state', (req, res) => {
  res.json(getSystemState());
});

app.post('/api/alert/trigger', (req, res) => {
  const alert = triggerAlert(req.body);
  res.json({ success: true, alert });
});

app.post('/api/alert/clear', (req, res) => {
  const result = clearAlert(req.body?.clearedBy);
  res.json({ success: true, result });
});

app.post('/api/alert/acknowledge', (req, res) => {
  const result = acknowledgeAlert(req.body?.ackBy);
  res.json({ success: true, result });
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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/controller', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'controller.html'));
});

app.get('/viewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  // Send current state on connection
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
    clearAlert(data?.clearedBy || 'ผู้ควบคุมระบบ (Controller)');
  });

  socket.on('alert:ack', (data) => {
    acknowledgeAlert(data?.ackBy || 'ผู้ควบคุมระบบ (Controller)');
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

    // Pick random machine and part
    const machine = machines[Math.floor(Math.random() * machines.length)];
    const catalog = mockCatalog[Math.floor(Math.random() * mockCatalog.length)];
    const feature = catalog.features[Math.floor(Math.random() * catalog.features.length)];
    
    machine.inspectedCount += 1;

    // 25% chance of Out of Spec if no active alert currently
    const isOutSpec = Math.random() < 0.28 && !activeAlert;

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
        message: `งาน out spec - ค่าจริง ${actualVal} ${feature.unit} (${deviation > 0 ? '+' : ''}${deviation} ${feature.unit} เกินขีดจำกัดสเปค)`,
        operator: 'Auto CMM Data Stream'
      });
    } else {
      // Normal reading stream
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
  }, 7000); // Check every 7 seconds
}

// Start server
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 CMM Alert System running on http://localhost:${PORT}`);
  console.log(`🎛️  Controller Web: http://localhost:${PORT}/controller`);
  console.log(`📺 Viewer Web (คนปกติ - ปิดไม่ได้): http://localhost:${PORT}/viewer`);
  console.log(`=================================================`);
});
