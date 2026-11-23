import { CarShowroom3D, VEHICLE_PROFILES } from './engine3d.js';

const FRIENDLY_LABELS = {
    MAP: 'Intake Pressure (MAP)',
    TPS: 'Throttle Position',
    Force: 'Engine Load Force',
    Power: 'Engine Power',
    RPM: 'Engine Speed (RPM)',
    'Consumption L/H': 'Fuel Flow Rate',
    'Consumption L/100KM': 'Fuel Economy',
    AFR: 'Air-Fuel Ratio (AFR)',
    CO: 'Carbon Monoxide (CO)',
    HC: 'Unburned Fuel (HC)',
    CO2: 'Carbon Dioxide (CO2)',
    O2: 'Exhaust Oxygen (O2)',
};

function evaluateExtremeDanger(cls, data, values, vehicleId) {
    const prof = VEHICLE_PROFILES[vehicleId] || VEHICLE_PROFILES.coupe;
    const telemetry = Array.isArray(data.sensor_telemetry) ? data.sensor_telemetry : [];
    const criticalCount = telemetry.filter((t) => t.severity === 'critical').length;

    const afr = Number(values.AFR);
    const co = Number(values.CO);
    const hc = Number(values.HC);
    const o2 = Number(values.O2);
    const rpm = Number(values.RPM);

    const extremeHit =
        afr <= 11.2 ||
        afr >= 18.0 ||
        co >= 5.5 ||
        hc >= 600 ||
        o2 >= 8.0 ||
        rpm >= prof.rpmMax * 0.94;

    // Escalate to CRITICAL DANGER when ML predicts a fault at severe/extreme levels
    // or when 3+ channels simultaneously hit critical limits
    if (cls !== 0 && (extremeHit || criticalCount >= 2)) return true;
    if (criticalCount >= 3) return true;
    return false;
}

function getResponseProfile(cls, vehicleId, isExtremeDanger) {
    const isDiesel = VEHICLE_PROFILES[vehicleId]?.fuelType === 'Diesel';

    if (isExtremeDanger) {
        return {
            hudText: 'DANGER — Engine in Danger · Deep Checkup Required',
            state: 'danger',
            badge: 'CRITICAL DANGER',
            smoothness: 'Severe Mechanical Stress',
            smoothnessSub: 'Extreme fault readings detected — high risk of engine damage',
            combustion: isDiesel ? 'Critical Diesel Overload' : 'Critical Combustion Hazard',
            combustionSub: 'Severe air-fuel & exhaust limits exceeded',
            action: 'STOP ENGINE · Deep Checkup Required',
            actionSub: 'Perform immediate full mechanical, fuel & ECU inspection',
            note: 'DANGER: Engine is in danger. Deep checkup required immediately.',
        };
    }

    const profiles = {
        0: {
            hudText: isDiesel ? 'Healthy — Diesel I6 Normal' : 'Healthy — Normal Idle',
            state: 'healthy',
            badge: 'HEALTHY',
            smoothness: 'Steady & Balanced',
            smoothnessSub: 'No abnormal vibration or cylinder misfire detected',
            combustion: isDiesel ? 'Clean Compression Burn' : 'Clean Burn',
            combustionSub: 'Air-fuel balance within target specification',
            action: 'Routine Service Only',
            actionSub: 'All monitored systems within normal limits',
            note: 'All sensors inside normal operating range.',
        },
        1: {
            hudText: isDiesel ? 'Over-Fueling — Heavy Soot' : 'Rich Mixture — Excess Fuel',
            state: 'fault',
            badge: 'FAULT DETECTED',
            smoothness: 'Heavy / Sluggish Shake',
            smoothnessSub: 'Excess fuel causing rough low-end engine lugging',
            combustion: isDiesel ? 'Diesel Over-Fueling' : 'Fuel-Rich Exhaust',
            combustionSub: 'Elevated CO & unburned HC detected in exhaust',
            action: isDiesel
                ? 'Inspect Diesel Injectors & Boost'
                : 'Inspect Fuel Injectors & O2 Sensor',
            actionSub: isDiesel
                ? 'Check common-rail pressure, intercooler & air filter'
                : 'Check fuel pressure regulator & intake air filter',
            note: isDiesel
                ? 'Inspect Diesel Injectors & Boost'
                : 'Inspect Fuel Injectors & O2 Sensor',
        },
        2: {
            hudText: isDiesel ? 'Lean / Boost Imbalance' : 'Lean Burn — High Heat',
            state: 'caution',
            badge: 'WARNING',
            smoothness: 'High-Temp Rough Tremor',
            smoothnessSub: 'Engine running hot with reduced pulling force',
            combustion: 'Excess Air / Lean Mix',
            combustionSub: 'High exhaust oxygen and elevated air-fuel ratio',
            action: isDiesel
                ? 'Check Fuel Lift Pump & Charge Pipes'
                : 'Check Vacuum Leaks & Fuel Pump',
            actionSub: isDiesel
                ? 'Inspect fuel filters, rail pressure & intake boots'
                : 'Inspect intake manifold seals & fuel delivery',
            note: isDiesel
                ? 'Check Fuel Lift Pump & Charge Pipes'
                : 'Check Vacuum Leaks & Fuel Pump',
        },
        3: {
            hudText: isDiesel ? 'Cylinder Misfire Active' : 'Low Ignition — Misfire Active',
            state: 'caution',
            badge: 'WARNING',
            smoothness: 'Irregular Misfire Stutter',
            smoothnessSub: 'Incomplete combustion causing intermittent power drops',
            combustion: isDiesel ? 'Compression / Glow Fault' : 'Incomplete Spark Burn',
            combustionSub: 'Unburned fuel & oxygen escaping combustion chamber',
            action: isDiesel
                ? 'Check Glow Plugs & Injector Timing'
                : 'Test Ignition Coils & Spark Plugs',
            actionSub: isDiesel
                ? 'Run cylinder balance test & inspect wiring harness'
                : 'Check battery voltage, coil packs & spark plug gaps',
            note: isDiesel
                ? 'Check Glow Plugs & Injector Timing'
                : 'Test Ignition Coils & Spark Plugs',
        },
    };

    return profiles[cls] || profiles[0];
}

const state = {
    sensors: [],
    baseline: {},
    values: {},
    activeGroup: 'air_load',
    activeVehicle: 'coupe',
    pendingVehicle: null,
    severities: {},
    lastResult: null,
    lastDanger: false,
    batchResult: null,
    history: [],
    debounceTimer: null,
    showroom: null,
};

const dom = {
    statusPill: document.getElementById('system-status-pill'),
    statusText: document.getElementById('system-status-text'),
    vehicleSelect: document.getElementById('vehicle-select'),

    hudBadge: document.getElementById('hud-status-badge'),
    hudLabel: document.getElementById('hud-status-label'),
    hudEngineLabel: document.getElementById('hud-engine-label'),
    hudRpm: document.getElementById('hud-rpm-val'),

    btnToggleXray: document.getElementById('btn-toggle-xray'),
    btnExtractEngine: document.getElementById('btn-extract-engine'),
    btnToggleHood: document.getElementById('btn-toggle-hood'),
    btnLoadGlb: document.getElementById('btn-load-glb'),
    glbFileInput: document.getElementById('glb-file-input'),
    btnReplayIntro: document.getElementById('btn-replay-intro'),

    btnToggleExplode: document.getElementById('btn-toggle-explode'),
    sliderExplode: document.getElementById('slider-explode'),
    valExplodePct: document.getElementById('val-explode-pct'),

    plausibilityBanner: document.getElementById('plausibility-banner'),
    plausibilityMessage: document.getElementById('plausibility-message'),

    perfSmoothness: document.getElementById('perf-smoothness'),
    perfSmoothnessSub: document.getElementById('perf-smoothness-sub'),
    perfCombustion: document.getElementById('perf-combustion'),
    perfCombustionSub: document.getElementById('perf-combustion-sub'),
    perfAction: document.getElementById('perf-action'),
    perfActionSub: document.getElementById('perf-action-sub'),

    verdictCard: document.getElementById('verdict-card'),
    verdictBadge: document.getElementById('verdict-badge'),
    verdictConfPill: document.getElementById('verdict-conf-pill'),
    verdictTitle: document.getElementById('verdict-title'),
    verdictDesc: document.getElementById('verdict-desc'),
    verdictAlerts: document.getElementById('verdict-alerts'),
    verdictNote: document.getElementById('verdict-note'),

    sensorList: document.getElementById('sensor-list'),
    btnReset: document.getElementById('btn-reset-baseline'),
    toggleAutorun: document.getElementById('toggle-autorun'),
    btnRun: document.getElementById('btn-run-diagnosis'),
    btnExportTxt: document.getElementById('btn-export-txt'),

    dropzone: document.getElementById('csv-dropzone'),
    csvInput: document.getElementById('csv-file-input'),
    batchStatus: document.getElementById('batch-file-status'),
    batchKpiGrid: document.getElementById('batch-kpi-grid'),
    batchTableWrap: document.getElementById('batch-table-wrap'),
    batchTableBody: document.getElementById('batch-table-body'),
    btnExportBatch: document.getElementById('btn-export-batch-csv'),

    historyCount: document.getElementById('history-count'),
    historyTableBody: document.getElementById('history-table-body'),
    btnClearHistory: document.getElementById('btn-clear-history'),
};

async function init() {
    state.showroom = new CarShowroom3D(document.getElementById('engine-canvas'), {
        onStateChange: syncShowroomButtons,
        onModelStatus: (label) => {
            if (dom.hudEngineLabel) dom.hudEngineLabel.textContent = label;
        },
    });

    bindNavigation();
    bindVehicleSelector();
    bindShowroomControls();
    bindSensorTabs();
    bindBatchUpload();

    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cfg = await res.json();

        state.sensors = cfg.sensors;
        state.baseline = cfg.healthy_baseline;
        state.values = adaptValuesForVehicle(cfg.healthy_baseline, state.activeVehicle);

        applyVehicleRpmBounds(state.activeVehicle);

        dom.statusText.textContent = 'ML Model Ready';
        renderActiveSensorGroup();
        bindActions();

        await runInference(false);
    } catch (err) {
        dom.statusText.textContent = 'Offline';
        dom.statusPill.style.background = '#FEF2F2';
        dom.statusPill.style.color = '#B91C1C';
        dom.statusPill.style.borderColor = '#FECACA';
        dom.verdictDesc.textContent = `Could not connect to backend ML API: ${err.message}.`;
    }
}

// Keep RPM realistic per vehicle while preserving Torque_Proxy (Power / RPM)
function adaptValuesForVehicle(rawVals, vehicleId) {
    const prof = VEHICLE_PROFILES[vehicleId] || VEHICLE_PROFILES.coupe;
    const adapted = { ...rawVals };
    const oldRpm = Number(adapted.RPM) || prof.rpmIdle;
    const clampedRpm = Math.max(prof.rpmMin, Math.min(prof.rpmMax, oldRpm));

    if (Math.abs(clampedRpm - oldRpm) > 1) {
        const ratio = clampedRpm / oldRpm;
        adapted.RPM = Math.round(clampedRpm);
        if (adapted.Power !== undefined) {
            adapted.Power = Math.max(0.5, Number((adapted.Power * ratio).toFixed(3)));
        }
    }
    return adapted;
}

function applyVehicleRpmBounds(vehicleId) {
    const prof = VEHICLE_PROFILES[vehicleId] || VEHICLE_PROFILES.coupe;
    const rpmSpec = state.sensors.find((s) => s.key === 'RPM');
    if (rpmSpec) {
        rpmSpec.min = prof.rpmMin;
        rpmSpec.max = prof.rpmMax;
        rpmSpec.step = prof.id === 'semi_truck' ? 10 : 25;
    }
}

function syncShowroomButtons({ vehicle, xray, hoodOpen, engineExtracted, explodeAmount }) {
    if (state.pendingVehicle) {
        if (vehicle === state.pendingVehicle) {
            state.activeVehicle = vehicle;
            state.pendingVehicle = null;
            if (dom.vehicleSelect) dom.vehicleSelect.value = vehicle;
        }
    } else {
        state.activeVehicle = vehicle;
        if (dom.vehicleSelect) dom.vehicleSelect.value = vehicle;
    }

    dom.btnToggleXray.classList.toggle('active', xray);
    dom.btnToggleXray.textContent = xray ? 'X-Ray On' : 'X-Ray';

    dom.btnExtractEngine.classList.toggle('active', engineExtracted);
    dom.btnExtractEngine.textContent = engineExtracted ? 'Seat Engine' : 'Lift Engine';

    dom.btnToggleHood.textContent = hoodOpen ? 'Close Hood' : 'Open Hood';

    const pct = Math.max(0, Math.min(100, Number(explodeAmount) || 0));
    dom.sliderExplode.value = pct;
    dom.valExplodePct.textContent = `${pct}%`;
    dom.btnToggleExplode.classList.toggle('active', pct > 0);
    dom.btnToggleExplode.textContent = pct > 0 ? 'Assemble' : 'Explode Engine';
}

function bindNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = {
        live: document.getElementById('view-live'),
        batch: document.getElementById('view-batch'),
        history: document.getElementById('view-history'),
    };

    navBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.view;
            navBtns.forEach((b) => b.classList.toggle('active', b === btn));
            Object.entries(views).forEach(([key, el]) => {
                el.classList.toggle('active', key === target);
            });
        });
    });
}

function bindVehicleSelector() {
    if (!dom.vehicleSelect) return;

    dom.vehicleSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        if (!VEHICLE_PROFILES[selected]) return;

        document.querySelector('.nav-btn[data-view="live"]').click();

        state.pendingVehicle = selected;
        state.activeVehicle = selected;
        applyVehicleRpmBounds(selected);

        const prof = VEHICLE_PROFILES[selected];
        const oldRpm = Number(state.values.RPM) || prof.rpmIdle;
        const targetRpm =
            oldRpm < prof.rpmMin || oldRpm > prof.rpmMax ? prof.rpmIdle : oldRpm;

        if (Math.abs(targetRpm - oldRpm) > 1) {
            const ratio = targetRpm / oldRpm;
            state.values.RPM = targetRpm;
            if (state.values.Power !== undefined) {
                state.values.Power = Math.max(0.5, Number((state.values.Power * ratio).toFixed(3)));
            }
        }

        renderActiveSensorGroup();
        state.showroom.switchVehicle(selected);
        runInference(false);
    });
}

function bindShowroomControls() {
    dom.btnToggleXray.addEventListener('click', () => {
        state.showroom.toggleXRay();
    });

    dom.btnExtractEngine.addEventListener('click', () => {
        state.showroom.toggleEngineInspect();
    });

    dom.btnToggleHood.addEventListener('click', () => {
        state.showroom.toggleHood();
    });

    dom.btnReplayIntro.addEventListener('click', () => {
        state.showroom.replayIntro();
    });

    dom.btnToggleExplode.addEventListener('click', () => {
        state.showroom.toggleExplode();
    });

    dom.sliderExplode.addEventListener('input', (e) => {
        const pct = Number(e.target.value) || 0;
        dom.valExplodePct.textContent = `${pct}%`;
        dom.btnToggleExplode.classList.toggle('active', pct > 0);
        dom.btnToggleExplode.textContent = pct > 0 ? 'Assemble' : 'Explode Engine';
        state.showroom.setExplodeAmount(pct / 100);
    });

    dom.btnLoadGlb.addEventListener('click', () => dom.glbFileInput.click());
    dom.glbFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            state.showroom.loadCustomGLB(file);
            e.target.value = '';
        }
    });
}

function bindSensorTabs() {
    document.querySelectorAll('.sensor-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sensor-tab').forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeGroup = tab.dataset.group;
            renderActiveSensorGroup();
        });
    });
}

function renderActiveSensorGroup() {
    dom.sensorList.innerHTML = '';
    const items = state.sensors.filter((s) => s.group === state.activeGroup);

    items.forEach((spec) => {
        const val = state.values[spec.key];
        const severity = state.severities[spec.key] || 'normal';
        const row = document.createElement('div');
        row.className = 'sensor-row';
        row.innerHTML = `
      <div class="sensor-row-top">
        <span class="sensor-name">
          <span class="sev-dot" data-dot-key="${spec.key}" data-severity="${severity}"></span>
          ${FRIENDLY_LABELS[spec.key] || spec.label}
        </span>
        <div class="num-box">
          <input type="number" class="sensor-num" value="${val}" step="${spec.step}" />
          <span class="sensor-unit">${spec.unit}</span>
        </div>
      </div>
      <input type="range" class="sensor-slider" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${Math.max(spec.min, Math.min(spec.max, val))}" />
    `;

        const numInput = row.querySelector('.sensor-num');
        const sliderInput = row.querySelector('.sensor-slider');

        const handleChange = (rawVal, fromSlider) => {
            const parsed = parseFloat(rawVal);
            if (Number.isNaN(parsed)) return;
            state.values[spec.key] = parsed;

            if (fromSlider) {
                numInput.value = parsed;
            } else {
                sliderInput.value = Math.max(spec.min, Math.min(spec.max, parsed));
            }

            if (spec.key === 'RPM') {
                dom.hudRpm.textContent = Math.round(parsed).toLocaleString();
                state.showroom.setTelemetry(parsed, state.lastResult?.fault_zone || 'healthy');
            }

            if (dom.toggleAutorun.checked) {
                clearTimeout(state.debounceTimer);
                state.debounceTimer = setTimeout(() => runInference(false), 120);
            }
        };

        sliderInput.addEventListener('input', (e) => handleChange(e.target.value, true));
        numInput.addEventListener('input', (e) => handleChange(e.target.value, false));
        dom.sensorList.appendChild(row);
    });
}

function bindActions() {
    dom.btnReset.addEventListener('click', () => {
        state.values = adaptValuesForVehicle(state.baseline, state.activeVehicle);
        renderActiveSensorGroup();
        runInference(true);
    });

    dom.btnRun.addEventListener('click', () => runInference(true));
    dom.btnExportTxt.addEventListener('click', exportDiagnosticReport);

    dom.btnClearHistory.addEventListener('click', () => {
        state.history = [];
        renderHistory();
    });
}

async function runInference(recordInHistory = false) {
    try {
        const res = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.values),
        });
        const data = await res.json();

        if (data.status === 'ERROR') {
            dom.plausibilityMessage.textContent = data.message;
            dom.plausibilityBanner.classList.remove('hidden');
            dom.verdictCard.dataset.state = 'fault';
            dom.verdictBadge.textContent = 'INVALID INPUT';
            dom.verdictTitle.textContent = 'Reading Out of Real-World Range';
            dom.verdictDesc.textContent = data.message;
            dom.verdictAlerts.innerHTML = '';
            return;
        }

        dom.plausibilityBanner.classList.add('hidden');
        state.lastResult = data;
        updateUI(data);

        if (recordInHistory) {
            const statusLabel = state.lastDanger ? 'DANGER' : data.engine_health;
            state.history.unshift({
                timestamp: new Date().toLocaleTimeString(),
                vehicle: state.activeVehicle,
                rpm: Math.round(state.values.RPM),
                afr: Number(state.values.AFR).toFixed(2),
                health: statusLabel,
                fault: state.lastDanger ? `${data.fault_name} (Deep Checkup)` : data.fault_name,
                confidence: data.confidence_pct,
                snapshot: { ...state.values },
            });
            renderHistory();
        }
    } catch (err) {
        dom.plausibilityMessage.textContent = `Connection issue: ${err.message}`;
        dom.plausibilityBanner.classList.remove('hidden');
    }
}

function updateUI(data) {
    const cls = Number(data.predicted_class);
    const isDanger = evaluateExtremeDanger(cls, data, state.values, state.activeVehicle);
    state.lastDanger = isDanger;

    const profile = getResponseProfile(cls, state.activeVehicle, isDanger);
    const effectiveZone =
        isDanger && (!data.fault_zone || data.fault_zone === 'healthy')
            ? 'fuel_rail'
            : data.fault_zone || 'healthy';

    // 1. Sync 3D Workshop Bay & HUD
    dom.hudRpm.textContent = Math.round(state.values.RPM).toLocaleString();
    state.showroom.setTelemetry(state.values.RPM, effectiveZone);

    dom.hudBadge.dataset.state = profile.state;
    dom.hudLabel.textContent = profile.hudText;

    // 2. Sync Service Assessment Strip
    dom.perfSmoothness.textContent = profile.smoothness;
    dom.perfSmoothnessSub.textContent = profile.smoothnessSub;
    dom.perfCombustion.textContent = profile.combustion;
    dom.perfCombustionSub.textContent = profile.combustionSub;
    dom.perfAction.textContent = profile.action;
    dom.perfActionSub.textContent = profile.actionSub;

    // 3. Sync Verdict Card (with Extreme Danger Escalation)
    dom.verdictCard.dataset.state = profile.state;
    dom.verdictBadge.textContent = profile.badge;
    dom.verdictConfPill.textContent = `${data.confidence_pct.toFixed(1)}% Confidence`;
    dom.verdictTitle.textContent = isDanger
        ? `DANGER: ${data.fault_name} — Deep Checkup Required`
        : data.fault_name;

    const cleanWhy = data.why_unhealthy.split('Key sensor indicators:')[0].trim();
    dom.verdictDesc.textContent = isDanger
        ? `Engine is in danger at extreme operating thresholds. Stop vehicle and perform a deep diagnostic checkup immediately. (${cleanWhy})`
        : cleanWhy;
    dom.verdictNote.textContent = profile.note;

    // 4. Sensor Severity Dots & Top Flag Chips
    state.severities = {};
    data.sensor_telemetry.forEach((item) => {
        state.severities[item.key] = item.severity;
        const dot = document.querySelector(`[data-dot-key="${item.key}"]`);
        if (dot) dot.dataset.severity = item.severity;
    });

    if (cls === 0 && !isDanger) {
        dom.verdictAlerts.innerHTML = '<span class="alert-tag">All 12 channels nominal</span>';
    } else {
        const topFlags = data.sensor_telemetry.slice(0, 3);
        dom.verdictAlerts.innerHTML = topFlags
            .map((f) => {
                const dir = f.value >= f.baseline ? 'HIGH' : 'LOW';
                const tagClass = f.severity === 'critical' || isDanger ? 'bad' : 'warn';
                return `<span class="alert-tag ${tagClass}">${f.key} ${dir}: ${f.value} ${f.unit}</span>`;
            })
            .join('');
    }
}

function exportDiagnosticReport() {
    if (!state.lastResult) return;
    const r = state.lastResult;
    const vProf = VEHICLE_PROFILES[state.activeVehicle] || VEHICLE_PROFILES.coupe;

    const lines = [
        'AUTOMOBILE ENGINE DIAGNOSTICS — FAULT DETECTION SYSTEM',
        `Generated: ${new Date().toLocaleString()}`,
        `Vehicle:   ${vProf.name} — ${vProf.engineLabel}`,
        '======================================================',
        `Engine Status:   ${state.lastDanger ? 'CRITICAL DANGER — DEEP CHECKUP REQUIRED' : r.engine_health}`,
        `Diagnosis:       ${r.fault_name}`,
        `Confidence:      ${r.confidence_pct}%`,
        '',
        'DIAGNOSTIC SUMMARY:',
        r.why_unhealthy,
        '',
        'SENSOR SNAPSHOT:',
        ...state.sensors.map((s) => `  - ${s.key.padEnd(20)}: ${state.values[s.key]} ${s.unit}`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Automobile_Engine_Diagnostic_Report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// BATCH CSV UPLOAD
// ============================================================================
function bindBatchUpload() {
    dom.dropzone.addEventListener('click', () => dom.csvInput.click());
    dom.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropzone.classList.add('dragover');
    });
    dom.dropzone.addEventListener('dragleave', () => dom.dropzone.classList.remove('dragover'));
    dom.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) uploadBatchFile(e.dataTransfer.files[0]);
    });
    dom.csvInput.addEventListener('change', (e) => {
        if (e.target.files.length) uploadBatchFile(e.target.files[0]);
    });

    dom.btnExportBatch.addEventListener('click', () => {
        if (!state.batchResult) return;
        const headers = ['Row', 'RPM', 'AFR', 'CO', 'HC', 'Engine_Health', 'Fault_Name', 'Confidence_%'];
        const csvRows = [
            headers.join(','),
            ...state.batchResult.rows.map((r) =>
                [r.row_index, r.rpm, r.afr, r.co, r.hc, r.engine_health, `"${r.fault_name}"`, r.confidence_pct].join(',')
            ),
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Automobile_Engine_Batch_Report_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

async function uploadBatchFile(file) {
    dom.batchStatus.textContent = `Checking ${file.name}...`;
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/predict-batch', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.status === 'ERROR') {
            dom.batchStatus.textContent = data.message;
            dom.batchKpiGrid.classList.add('hidden');
            dom.batchTableWrap.classList.add('hidden');
            dom.btnExportBatch.classList.add('hidden');
            return;
        }

        state.batchResult = data;
        dom.batchStatus.textContent = `Completed ${data.filename} — ${data.summary.total} readings checked.`;
        document.getElementById('kpi-total').textContent = data.summary.total;
        document.getElementById('kpi-healthy').textContent = data.summary.healthy;
        document.getElementById('kpi-rich').textContent = data.summary.rich;
        document.getElementById('kpi-lean').textContent = data.summary.lean;
        document.getElementById('kpi-ignition').textContent = data.summary.ignition;

        dom.batchKpiGrid.classList.remove('hidden');
        dom.batchTableWrap.classList.remove('hidden');
        dom.btnExportBatch.classList.remove('hidden');

        dom.batchTableBody.innerHTML = data.rows
            .map(
                (r) => `
      <tr>
        <td>${r.row_index}</td>
        <td>${r.rpm}</td>
        <td>${r.afr}</td>
        <td>${r.co}</td>
        <td>${r.hc}</td>
        <td><span class="pill-sm ${r.engine_health === 'HEALTHY' ? 'healthy' : 'unhealthy'}">${r.engine_health}</span></td>
        <td>${r.fault_name}</td>
        <td>${r.confidence_pct}%</td>
      </tr>
    `
            )
            .join('');
    } catch (err) {
        dom.batchStatus.textContent = `Upload failed: ${err.message}`;
    }
}

// ============================================================================
// HISTORY LOG
// ============================================================================
function renderHistory() {
    dom.historyCount.textContent = state.history.length;
    if (!state.history.length) {
        dom.historyTableBody.innerHTML =
            '<tr><td colspan="7" class="empty-cell">No diagnostic checks saved yet.</td></tr>';
        return;
    }

    dom.historyTableBody.innerHTML = state.history
        .map(
            (item, idx) => `
    <tr>
      <td>${item.timestamp}</td>
      <td>${item.rpm}</td>
      <td>${item.afr}</td>
      <td><span class="pill-sm ${item.health === 'HEALTHY' ? 'healthy' : 'unhealthy'}">${item.health}</span></td>
      <td>${item.fault}</td>
      <td>${item.confidence}%</td>
      <td><button class="outline-btn" data-replay-idx="${idx}">Load</button></td>
    </tr>
  `
        )
        .join('');

    dom.historyTableBody.querySelectorAll('[data-replay-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const entry = state.history[Number(btn.dataset.replayIdx)];
            state.values = { ...entry.snapshot };
            document.querySelector('.nav-btn[data-view="live"]').click();
            renderActiveSensorGroup();
            runInference(false);
        });
    });
}

init();