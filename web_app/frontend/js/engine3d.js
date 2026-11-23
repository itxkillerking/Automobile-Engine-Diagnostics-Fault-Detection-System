import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
    createWorkshopTextures,
    buildWorkshop,
    applyWorkshopHDRI,
} from './workshopScene.js';
import {
    VEHICLE_PROFILES,
    attachExternalGLB,
    createVehicleAssembly,
} from './vehicleBuilder.js';

export { VEHICLE_PROFILES };

export class CarShowroom3D {
    constructor(container, callbacks = {}) {
        this.container = container;
        this.onStateChange = callbacks.onStateChange || (() => { });
        this.onModelStatus = callbacks.onModelStatus || (() => { });

        this.rpm = VEHICLE_PROFILES.coupe.rpmIdle;
        this.faultZone = 'healthy';
        this.currentType = 'coupe';
        this.pendingType = null;

        this.hoodOpen = true;
        this.hoodAngle = 0;
        this.xrayEnabled = true;
        this.xrayProgress = 0;
        this.engineExtracted = false;
        this.extractProgress = 0;
        this.explodeTarget = 0;
        this.explodeProgress = 0;

        // Smooth drive-through flow: 'drive_in' -> 'hood_open' -> 'xray_enter' -> 'interactive'
        this.phase = 'drive_in';
        this.phaseTime = 0;
        this.crankAngle = 0;
        this.clock = new THREE.Clock();

        this.cameraTargetPos = null;
        this.controlsTargetPos = null;
        this.raycaster = new THREE.Raycaster();
        this.pointerDownPos = new THREE.Vector2();
        this.isHoveringEngine = false;

        this.textures = createWorkshopTextures();
        this._initLoaders();
        this._initScene();
        this.workshop = buildWorkshop(this.scene, this.textures);
        applyWorkshopHDRI(this.renderer, this.scene);
        this._initPostProcessing();
        this._initEvents();

        this.vehicleCache = {};
        this.activeVehicle = null;
        this._mountVehicle('coupe');
        this.replayIntro();
        this._animate();
    }

    _initLoaders() {
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        this.dracoLoader.setDecoderConfig({ type: 'js' });
        this.gltfLoader = new GLTFLoader();
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
    }

    _initScene() {
        const w = this.container.clientWidth || 860;
        const h = this.container.clientHeight || 540;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x161c26);
        this.scene.fog = null;

        this.camera = new THREE.PerspectiveCamera(36, w / h, 0.15, 90);
        this.camera.position.set(5.1, 2.15, 5.4);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.18;
        this.container.appendChild(this.renderer.domElement);

        // Strictly bounded OrbitControls — prevents clipping under floor or behind walls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.enablePan = true;
        this.controls.panSpeed = 0.65;
        this.controls.minDistance = 2.0;
        this.controls.maxDistance = 10.2;
        this.controls.minPolarAngle = 0.14;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
        this.controls.target.set(0.25, 0.72, 0);

        this.controls.addEventListener('start', () => {
            this.cameraTargetPos = null;
            this.controlsTargetPos = null;
        });
    }

    _initPostProcessing() {
        const w = this.container.clientWidth || 860;
        const h = this.container.clientHeight || 540;
        try {
            const rt = new THREE.WebGLRenderTarget(w, h, {
                samples: 4,
                type: THREE.HalfFloatType,
            });
            this.composer = new EffectComposer(this.renderer, rt);
            this.composer.addPass(new RenderPass(this.scene, this.camera));

            this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.32, 1.35);
            this.composer.addPass(this.bloomPass);
            this.composer.addPass(new OutputPass());
            this.useComposer = true;
        } catch {
            this.useComposer = false;
        }
    }

    _initEvents() {
        this.resizeObserver = new ResizeObserver(() => {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            if (w > 0 && h > 0) {
                this.camera.aspect = w / h;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(w, h);
                if (this.composer) this.composer.setSize(w, h);
                if (this.bloomPass) this.bloomPass.setSize(w, h);
            }
        });
        this.resizeObserver.observe(this.container);

        const dom = this.renderer.domElement;
        dom.addEventListener('pointerdown', (e) => this.pointerDownPos.set(e.clientX, e.clientY));
        dom.addEventListener('pointermove', (e) => {
            if (!this.activeVehicle || this.phase !== 'interactive') return;
            const hit = this._raycastEngine(e);
            if (hit !== this.isHoveringEngine) {
                this.isHoveringEngine = hit;
                dom.style.cursor = hit ? 'pointer' : 'grab';
            }
        });
        dom.addEventListener('pointerup', (e) => {
            if (this.phase !== 'interactive') return;
            const d = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
            if (d < 6 && this._raycastEngine(e)) this.toggleEngineInspect();
        });
    }

    _raycastEngine(e) {
        if (!this.activeVehicle?.engineHitTargets.length) return false;
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        return this.raycaster.intersectObjects(this.activeVehicle.engineHitTargets, true).length > 0;
    }

    async _tryLoadExternalGLB(v) {
        try {
            const res = await fetch(v.cfg.glbPath, { method: 'HEAD' });
            if (res.ok) await attachExternalGLB(v, this.gltfLoader, v.cfg.glbPath, v.cfg.engineLabel, this.onModelStatus);
        } catch { /* Built-in PBR shell active */ }

        if (v.cfg.engineGlbPath) {
            try {
                const er = await fetch(v.cfg.engineGlbPath, { method: 'HEAD' });
                if (er.ok) {
                    const gltf = await this.gltfLoader.loadAsync(v.cfg.engineGlbPath);
                    const m = gltf.scene;
                    const sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
                    m.scale.setScalar((v.cfg.engineStyle === 'diesel_i6' ? 1.15 : 0.9) / (Math.max(sz.x, sz.z) || 1));
                    const sb = new THREE.Box3().setFromObject(m);
                    const c = sb.getCenter(new THREE.Vector3());
                    m.position.set(-c.x, -sb.min.y - 0.14, -c.z);
                    v.engineGroup.add(m);
                }
            } catch { /* Built-in rigged engine active */ }
        }
        this.onModelStatus(v.cfg.engineLabel);
    }

    async loadCustomGLB(file) {
        if (!this.activeVehicle || !file) return;
        const url = URL.createObjectURL(file);
        this.onModelStatus(`Loading ${file.name}...`);
        try {
            await attachExternalGLB(this.activeVehicle, this.gltfLoader, url, file.name, this.onModelStatus);
        } catch {
            this.onModelStatus(this.activeVehicle.cfg.engineLabel);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    _mountVehicle(type) {
        if (this.activeVehicle) this.scene.remove(this.activeVehicle.root);
        if (!this.vehicleCache[type]) {
            this.vehicleCache[type] = createVehicleAssembly(type, this.textures);
            this._tryLoadExternalGLB(this.vehicleCache[type]);
        }
        this.activeVehicle = this.vehicleCache[type];
        this.currentType = type;
        this.scene.add(this.activeVehicle.root);
        this.onModelStatus(this.activeVehicle.cfg.engineLabel);
    }

    _emitState() {
        this.onStateChange({
            vehicle: this.currentType,
            xray: this.xrayEnabled,
            hoodOpen: this.hoodOpen,
            engineExtracted: this.engineExtracted,
            explodeAmount: Math.round(this.explodeTarget * 100),
        });
    }

    // =========================================================================
    // PUBLIC CONTROLS
    // =========================================================================
    replayIntro() {
        this.phase = 'drive_in';
        this.phaseTime = 0;
        this.hoodOpen = true;
        this.hoodAngle = 0;
        this.xrayEnabled = true;
        this.xrayProgress = 0;
        this.engineExtracted = false;
        this.extractProgress = 0;
        this.explodeTarget = 0;
        this.explodeProgress = 0;

        const v = this.activeVehicle;
        // Start outside the open left bay doorway (wall is at x = -14)
        v.root.position.set(-19.5, 0, 0);
        v.chassis.position.set(0, 0, 0);
        v.chassis.rotation.set(0, 0, 0);
        v.headlightSpot.intensity = 12;
        v.headlightTarget.position.z = 0;
        this._applyXrayVisuals(v, 0);

        this.camera.position.copy(v.cfg.camFull.pos);
        this.controls.target.copy(v.cfg.camFull.target);
        this.cameraTargetPos = null;
        this.controlsTargetPos = null;
        this._emitState();
    }

    switchVehicle(newType) {
        if (!VEHICLE_PROFILES[newType] || (newType === this.currentType && !this.pendingType)) return;
        this.pendingType = newType;
        this.engineExtracted = false;
        this.explodeTarget = 0;
        this.xrayEnabled = false;
        this.hoodOpen = false;
        this.phase = 'switch_close';
        this.phaseTime = 0;

        const v = this.activeVehicle;
        this.cameraTargetPos = v.cfg.camFull.pos.clone();
        this.controlsTargetPos = v.cfg.camFull.target.clone();
        this._emitState();
    }

    setTelemetry(rpm, faultZone) {
        const prof = VEHICLE_PROFILES[this.currentType];
        this.rpm = Math.max(prof.rpmMin, Math.min(prof.rpmMax, Number(rpm) || prof.rpmIdle));
        this.faultZone = faultZone || 'healthy';
        const ringCol = this.faultZone === 'healthy' ? 0x94a3b8 : this.faultZone === 'fuel_rail' ? 0xef4444 : 0xf59e0b;
        this.workshop.bayStandRing.material.color.setHex(ringCol);
    }

    setExplodeAmount(val) {
        if (this.phase === 'switch_close' || this.phase === 'drive_out') return;
        this.phase = 'interactive';
        this.explodeTarget = THREE.MathUtils.clamp(Number(val) || 0, 0, 1);
        if (this.explodeTarget > 0.02) {
            this.hoodOpen = true;
            this.engineExtracted = true;
            const v = this.activeVehicle;
            this.cameraTargetPos = v.cfg.camInspect.pos.clone();
            this.controlsTargetPos = v.cfg.camInspect.target.clone();
        }
        this._emitState();
    }

    toggleExplode() {
        this.setExplodeAmount(this.explodeTarget > 0.05 ? 0 : 0.8);
        return this.explodeTarget;
    }

    toggleXRay() {
        if (this.phase === 'switch_close' || this.phase === 'drive_out') return this.xrayEnabled;
        this.phase = 'interactive';
        this.xrayEnabled = !this.xrayEnabled;
        this._emitState();
        return this.xrayEnabled;
    }

    toggleHood() {
        if (this.phase === 'switch_close' || this.phase === 'drive_out') return this.hoodOpen;
        this.phase = 'interactive';
        this.hoodOpen = !this.hoodOpen;
        if (!this.hoodOpen) {
            this.engineExtracted = false;
            this.explodeTarget = 0;
            const v = this.activeVehicle;
            this.cameraTargetPos = v.cfg.camFull.pos.clone();
            this.controlsTargetPos = v.cfg.camFull.target.clone();
        }
        this._emitState();
        return this.hoodOpen;
    }

    toggleEngineInspect() {
        if (this.phase === 'switch_close' || this.phase === 'drive_out') return this.engineExtracted;
        this.phase = 'interactive';
        this.engineExtracted = !this.engineExtracted;
        const v = this.activeVehicle;
        if (this.engineExtracted) {
            this.hoodOpen = true;
            this.cameraTargetPos = v.cfg.camInspect.pos.clone();
            this.controlsTargetPos = v.cfg.camInspect.target.clone();
        } else {
            this.explodeTarget = 0;
            this.cameraTargetPos = v.cfg.camFull.pos.clone();
            this.controlsTargetPos = v.cfg.camFull.target.clone();
        }
        this._emitState();
        return this.engineExtracted;
    }

    // =========================================================================
    // VISUAL & KINEMATIC HELPERS
    // =========================================================================
    _clampCameraToRoom() {
        const b = this.workshop.roomBounds;
        this.controls.target.set(
            THREE.MathUtils.clamp(this.controls.target.x, b.targetMinX, b.targetMaxX),
            THREE.MathUtils.clamp(this.controls.target.y, b.targetMinY, b.targetMaxY),
            THREE.MathUtils.clamp(this.controls.target.z, b.targetMinZ, b.targetMaxZ)
        );
        this.camera.position.set(
            THREE.MathUtils.clamp(this.camera.position.x, b.minX, b.maxX),
            THREE.MathUtils.clamp(this.camera.position.y, b.minY, b.maxY),
            THREE.MathUtils.clamp(this.camera.position.z, b.minZ, b.maxZ)
        );
    }

    _applyXrayVisuals(v, p) {
        const useXray = p > 0.08;
        v.matXrayShell.opacity = 0.05 + p * 0.12;
        v.matXrayShell.emissiveIntensity = 0.16 + p * 0.32;

        const entries = v.hasExternalGLB ? v.glbShellEntries : v.shellEntries;
        for (const e of entries) {
            if (v.hasExternalGLB && e.isHood) {
                const fade = Math.max(this.hoodAngle / v.cfg.hoodOpenAngle, p * 0.8);
                e.mesh.material = useXray ? v.matXrayShell : e.solidMat;
                if (!useXray) e.solidMat.opacity = Math.max(0.08, 1 - fade * 0.92);
                e.mesh.visible = fade < 0.96 || useXray;
            } else {
                e.mesh.material = useXray ? v.matXrayShell : e.solidMat;
            }
            e.mesh.castShadow = !useXray;
            e.wireMat.opacity = p * 0.42;
        }

        const rig = v.engineRig;
        rig.matBlockXray.opacity = 0.08 + p * 0.11;
        for (const b of rig.xrayBlockEntries) {
            b.mesh.material = useXray ? rig.matBlockXray : b.solidMat;
            b.mesh.castShadow = !useXray;
            b.wireMat.opacity = p * 0.45;
        }

        const glowHex = this.faultZone === 'fuel_rail' ? 0xef4444 : this.faultZone === 'healthy' ? 0xf59e0b : 0xf97316;
        for (const mat of v.internalGlowMats) {
            mat.emissive.setHex(glowHex);
            mat.emissiveIntensity = p * (this.faultZone === 'healthy' ? 0.24 : 0.44);
        }
    }

    _updateHoodStruts(v) {
        if (!v.hoodStruts.length) return;
        const base = new THREE.Vector3(v.cfg.hoodPivot.x + 0.72, v.cfg.hoodPivot.y - 0.1, 0);
        const attach = new THREE.Vector3(v.cfg.hoodLength * 0.46, -0.06, 0);
        v.hoodPivot.updateMatrixWorld(true);
        for (const s of v.hoodStruts) {
            const a = new THREE.Vector3(base.x, base.y, s.z);
            const b = new THREE.Vector3(attach.x, attach.y, s.z).applyMatrix4(v.hoodPivot.matrix);
            s.mesh.visible = this.hoodAngle > 0.06;
            s.mesh.position.copy(a).lerp(b, 0.5);
            s.mesh.scale.set(1, a.distanceTo(b), 1);
            s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        }
    }

    _computeEnginePosition(cfg, u) {
        const lat = THREE.MathUtils.smoothstep(u, 0.22, 1.0);
        const x = THREE.MathUtils.lerp(cfg.engineBasePos.x, cfg.engineClearancePos.x, lat);
        const z = THREE.MathUtils.lerp(cfg.engineBasePos.z, cfg.engineClearancePos.z, lat);
        const yLin = THREE.MathUtils.lerp(cfg.engineBasePos.y, cfg.engineClearancePos.y, u);
        const arc = Math.sin(u * Math.PI) * Math.max(0, cfg.engineLiftHeight - Math.max(cfg.engineBasePos.y, cfg.engineClearancePos.y));
        return new THREE.Vector3(x, yLin + arc, z);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        const dt = Math.min(this.clock.getDelta(), 0.05);
        const elapsed = this.clock.elapsedTime;
        const v = this.activeVehicle;
        if (!v) return;

        // -----------------------------------------------------------------------
        // 1. DRIVE-THROUGH ENTRANCE (LEFT DOOR -> BAY) & EXIT (BAY -> RIGHT DOOR)
        // -----------------------------------------------------------------------
        if (this.phase === 'drive_in') {
            this.phaseTime += dt;
            const t = Math.min(1, this.phaseTime / 2.0);
            const ease = 1 - Math.pow(1 - t, 3);

            const prevX = v.root.position.x;
            v.root.position.x = THREE.MathUtils.lerp(-19.5, 0, ease);
            const dx = v.root.position.x - prevX;
            v.wheels.forEach((w) => (w.rotation.z -= dx / v.cfg.wheelRadius));

            const brakeCurve = t > 0.68 && t < 0.99 ? Math.sin(((t - 0.68) / 0.31) * Math.PI) : 0;
            v.chassis.rotation.z = -brakeCurve * 0.016;
            v.matTaillight.emissiveIntensity = 1.3 + brakeCurve * 2.2;
            v.headlightSpot.intensity = THREE.MathUtils.lerp(12, 4, ease);

            if (t >= 1) {
                v.chassis.rotation.z = 0;
                v.matTaillight.emissiveIntensity = 1.3;
                this.phase = 'hood_open';
                this.phaseTime = 0;
            }
        } else if (this.phase === 'hood_open') {
            this.phaseTime += dt;
            const t = Math.min(1, this.phaseTime / 1.05);
            this.hoodAngle = (1 - Math.pow(1 - t, 3)) * v.cfg.hoodOpenAngle;
            if (t >= 1) {
                this.phase = 'xray_enter';
                this.phaseTime = 0;
            }
        } else if (this.phase === 'xray_enter') {
            this.phaseTime += dt;
            const t = Math.min(1, this.phaseTime / 0.9);
            this.xrayProgress = 1 - Math.pow(1 - t, 2);
            if (t >= 1) {
                this.phase = 'interactive';
                this._emitState();
            }
        } else if (this.phase === 'switch_close') {
            this.explodeProgress += (0 - this.explodeProgress) * Math.min(1, dt * 10);
            if (this.explodeProgress < 0.1) this.extractProgress += (0 - this.extractProgress) * Math.min(1, dt * 8);
            this.xrayProgress += (0 - this.xrayProgress) * Math.min(1, dt * 7);
            if (this.extractProgress < 0.08 && this.explodeProgress < 0.08) {
                this.hoodAngle += (0 - this.hoodAngle) * Math.min(1, dt * 7.5);
            }

            if (this.hoodAngle < 0.025 && this.xrayProgress < 0.04 && this.extractProgress < 0.025 && this.explodeProgress < 0.025) {
                this.hoodAngle = this.xrayProgress = this.extractProgress = this.explodeProgress = 0;
                this.phase = 'drive_out';
                this.phaseTime = 0;
            }
        } else if (this.phase === 'drive_out') {
            // Smooth forward exit completely through the open right bay doorway (wall is at x = +14)
            this.phaseTime += dt;
            const t = Math.min(1, this.phaseTime / 1.45);
            const easeIn = t * t * t;
            const prevX = v.root.position.x;
            v.root.position.x = THREE.MathUtils.lerp(0, 19.5, easeIn);
            const dx = v.root.position.x - prevX;
            v.wheels.forEach((w) => (w.rotation.z -= dx / v.cfg.wheelRadius));
            v.chassis.rotation.z = Math.sin(t * Math.PI) * 0.015;

            if (t >= 1) {
                const nextType = this.pendingType || 'coupe';
                this.pendingType = null;
                this._mountVehicle(nextType);
                this.replayIntro();
                return;
            }
        } else {
            // Interactive mode with strict anti-overlap sequencing
            const hoodClear = this.hoodAngle >= v.cfg.hoodOpenAngle * 0.72;
            const targetExplode = this.hoodOpen && this.engineExtracted ? this.explodeTarget : 0;
            const effExplode = targetExplode > 0 && this.extractProgress < 0.78 ? 0 : targetExplode;
            this.explodeProgress += (effExplode - this.explodeProgress) * Math.min(1, dt * 7);

            let targetExtract = this.hoodOpen && this.engineExtracted ? 1 : 0;
            if (targetExtract === 1 && !hoodClear) targetExtract = 0;
            if (targetExtract === 0 && this.explodeProgress > 0.12) targetExtract = this.extractProgress;
            this.extractProgress += (targetExtract - this.extractProgress) * Math.min(1, dt * 5.8);

            const safeClose = this.extractProgress < 0.06 && this.explodeProgress < 0.06;
            const targetHood = this.hoodOpen ? v.cfg.hoodOpenAngle : safeClose ? 0 : this.hoodAngle;
            this.hoodAngle += (targetHood - this.hoodAngle) * Math.min(1, dt * 6.5);
            this.xrayProgress += ((this.xrayEnabled ? 1 : 0) - this.xrayProgress) * Math.min(1, dt * 5.5);
        }

        v.hoodPivot.rotation.z = v.cfg.hoodTiltForward ? -this.hoodAngle : this.hoodAngle;
        this._updateHoodStruts(v);
        this._applyXrayVisuals(v, this.xrayProgress);

        // -----------------------------------------------------------------------
        // 2. RIGGED ENGINE KINEMATICS, FLAMES, TURBO HEAT & EXHAUST VAPOR
        // -----------------------------------------------------------------------
        const rig = v.engineRig;
        const normRpm = (this.rpm - v.cfg.rpmMin) / Math.max(1, v.cfg.rpmMax - v.cfg.rpmMin);
        const omega = 3.0 + normRpm * 19.0;

        this.crankAngle += omega * dt;
        rig.crankShaft.rotation.x = this.crankAngle;
        rig.camshafts.forEach((c) => (c.rotation.x = this.crankAngle * 0.5));
        rig.pulleys.forEach((p, i) => (p.rotation.x = this.crankAngle * (i === 2 ? 1.45 : 1.0)));
        rig.fanGroup.rotation.x += omega * 1.35 * dt;
        v.driveshaft.rotation.x += omega * 0.85 * dt;

        for (const c of rig.cylinderRigs) {
            const th = this.crankAngle + c.phase;
            const pinY = Math.cos(th) * c.strokeR;
            const pinZ = Math.sin(th) * c.strokeR;
            const pY = pinY + Math.sqrt(Math.max(0.0001, c.rodLen * c.rodLen - pinZ * pinZ));
            c.piston.position.set(0, pY, 0);
            c.rod.position.set(0, (pinY + pY) * 0.5, pinZ * 0.5);
            c.rod.rotation.x = Math.atan2(-pinZ, pY - pinY);

            const cyc = (th * 0.5) % (Math.PI * 2);
            c.vIn.position.y = c.vBaseY - Math.max(0, Math.sin(cyc)) * 0.024;
            c.vEx.position.y = c.vBaseY - Math.max(0, Math.sin(cyc + Math.PI)) * 0.024;
        }

        const showFlames = this.xrayProgress > 0.15 || this.explodeProgress > 0.15;
        for (const fl of rig.combustionFlames) {
            if (!showFlames) { fl.mesh.material.opacity = 0; continue; }
            const burst = Math.pow(Math.max(0, Math.cos(this.crankAngle + fl.phase)), 5);
            if (this.faultZone === 'healthy') {
                fl.mesh.material.color.setRGB(0.45, 1.5, 2.4);
                fl.mesh.material.opacity = burst * 0.85;
            } else if (this.faultZone === 'fuel_rail') {
                fl.mesh.material.color.setRGB(2.5, 0.78, 0.15);
                fl.mesh.material.opacity = burst * 0.92;
            } else if (this.faultZone === 'intake_combustion') {
                fl.mesh.material.color.setRGB(2.8, 1.9, 0.55);
                fl.mesh.material.opacity = burst * 0.95;
            } else {
                fl.mesh.material.color.setRGB(2.2, 1.3, 0.35);
                fl.mesh.material.opacity = burst * (Math.sin(elapsed * 26 + fl.phase) > 0.25 ? 0.82 : 0.1);
            }
        }

        const turboHeat = 0.28 + normRpm * 1.15 + (this.faultZone === 'intake_combustion' ? 0.85 : this.faultZone === 'fuel_rail' ? 0.5 : 0);
        rig.turboHotMats.forEach((tm) => (tm.emissiveIntensity = turboHeat));

        const safeExplode = this.explodeProgress * THREE.MathUtils.smoothstep(this.extractProgress, 0.72, 0.96);
        for (const layer of rig.explodeLayers) {
            layer.group.position.copy(layer.base).addScaledVector(layer.offset, safeExplode);
        }

        let vx = 0, vy = 0, vr = 0;
        if (this.faultZone === 'healthy') {
            vy = Math.sin(elapsed * 32) * 0.0014;
        } else if (this.faultZone === 'fuel_rail') {
            vx = Math.sin(elapsed * 22) * 0.009; vy = Math.cos(elapsed * 19) * 0.01; vr = Math.sin(elapsed * 16) * 0.025;
        } else if (this.faultZone === 'intake_combustion') {
            vx = Math.sin(elapsed * 54) * 0.007; vy = Math.cos(elapsed * 48) * 0.006; vr = Math.sin(elapsed * 40) * 0.016;
        } else if (this.faultZone === 'ignition_coils') {
            const k = Math.sin(elapsed * 13) > 0.72 ? 1 : 0.12;
            vx = (Math.random() - 0.5) * 0.022 * k; vy = (Math.random() - 0.5) * 0.02 * k; vr = (Math.random() - 0.5) * 0.048 * k;
        }

        const liftedPos = this._computeEnginePosition(v.cfg, this.extractProgress);
        v.engineGroup.position.set(liftedPos.x + vx, liftedPos.y + vy, liftedPos.z);
        v.engineGroup.rotation.x = vr;
        v.engineGroup.scale.setScalar(1 + this.extractProgress * 0.2);

        this.workshop.bayStandRing.position.set(v.cfg.engineClearancePos.x, 0.006, v.cfg.engineClearancePos.z);
        this.workshop.bayStandRing.material.opacity = 0.14 + this.extractProgress * 0.45;

        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.8);
        const zCols = { fuel_rail: 0xef4444, intake_combustion: 0xf59e0b, ignition_coils: 0xf59e0b };
        for (const [k, mats] of Object.entries(rig.faultMats)) {
            const hit = this.faultZone === k;
            for (const mat of mats) {
                mat.emissive.setHex(hit ? zCols[k] : 0xf59e0b);
                mat.emissiveIntensity = hit ? 0.55 + pulse * 1.05 : this.xrayProgress * 0.16;
            }
        }

        rig.sparkFlashes.forEach((orb, idx) => {
            const fl = this.faultZone === 'ignition_coils' && Math.sin(elapsed * 34 + idx * 2.1) > 0.72 ? 1 : 0;
            orb.material.opacity = fl;
            orb.scale.setScalar(0.85 + fl * 0.9);
        });

        const showSmoke = this.phase === 'interactive';
        v.smokeParticles.forEach((p, idx) => {
            if (!showSmoke || (this.faultZone === 'healthy' && p.fromBay)) {
                p.sprite.material.opacity = 0;
                return;
            }
            p.life = (p.life + dt * (this.faultZone === 'fuel_rail' ? 0.9 : this.faultZone === 'healthy' ? 0.55 : 0.72)) % 1;
            const t = p.life;
            p.sprite.material.color.setHex(
                this.faultZone === 'healthy' ? 0xcbd5e1 : this.faultZone === 'fuel_rail' ? 0x334155 : this.faultZone === 'intake_combustion' ? 0xf59e0b : 0x94a3b8
            );
            if (p.fromBay && (this.hoodAngle > 0.3 || this.xrayProgress > 0.4)) {
                p.sprite.position.set(liftedPos.x + Math.sin(idx * 2.1 + elapsed * 2.5) * 0.28, liftedPos.y + 0.45 + t * 1.0, liftedPos.z + Math.cos(idx * 1.7) * 0.24);
            } else {
                const pipe = v.cfg.tailPipes[Math.floor(idx / 2) % v.cfg.tailPipes.length];
                p.sprite.position.set(
                    pipe.x - t * (v.cfg.id === 'semi_truck' ? 0.5 : 1.4),
                    pipe.y + t * (v.cfg.id === 'semi_truck' ? 1.45 : 0.48),
                    pipe.z + Math.sin(elapsed * 3.5 + idx) * 0.1
                );
            }
            p.sprite.scale.setScalar((this.faultZone === 'healthy' ? 0.22 : 0.34) + t * 0.72);
            p.sprite.material.opacity = Math.sin(t * Math.PI) * (this.faultZone === 'healthy' ? 0.15 : this.faultZone === 'fuel_rail' ? 0.54 : 0.34);
        });

        if (this.cameraTargetPos && this.controlsTargetPos) {
            this.camera.position.lerp(this.cameraTargetPos, Math.min(1, dt * 5.2));
            this.controls.target.lerp(this.controlsTargetPos, Math.min(1, dt * 5.2));
            if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.05) {
                this.cameraTargetPos = null;
                this.controlsTargetPos = null;
            }
        }

        this.controls.update();
        if (this.phase === 'interactive') this._clampCameraToRoom();

        if (this.useComposer && this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
}