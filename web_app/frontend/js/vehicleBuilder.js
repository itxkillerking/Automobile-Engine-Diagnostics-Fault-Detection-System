import * as THREE from 'three';

export const VEHICLE_PROFILES = {
    coupe: {
        id: 'coupe',
        name: 'Sports Coupe (V8 Twin-Turbo)',
        engineLabel: '4.0L V8 Twin-Turbo',
        fuelType: 'Petrol',
        rpmMin: 800,
        rpmMax: 7500,
        rpmIdle: 2150,
        glbPath: '/assets/models/coupe.glb',
        engineGlbPath: '/assets/models/engine_v8.glb',
        hoodTiltForward: false,
        hoodOpenAngle: 0.84,
        wheelRadius: 0.39,
        wheelWidth: 0.29,
        frontAxleX: 1.46,
        rearAxlesX: [-1.42],
        dualRearTires: false,
        trackZ: 0.93,
        hoodPivot: new THREE.Vector3(0.64, 0.94, 0),
        hoodLength: 1.62,
        hoodWidth: 1.46,
        engineBasePos: new THREE.Vector3(1.36, 0.43, 0),
        engineClearancePos: new THREE.Vector3(1.55, 1.12, 2.2),
        engineLiftHeight: 1.48,
        engineStyle: 'v8',
        camFull: { pos: new THREE.Vector3(5.1, 2.15, 5.4), target: new THREE.Vector3(0.25, 0.72, 0) },
        camInspect: { pos: new THREE.Vector3(3.35, 1.9, 4.35), target: new THREE.Vector3(1.55, 1.15, 2.2) },
        tailPipes: [{ x: -2.38, y: 0.27, z: 0.56 }, { x: -2.38, y: 0.27, z: -0.56 }],
        headlightOrigin: new THREE.Vector3(2.36, 0.66, 0),
        targetLength: 4.7,
    },
    semi_truck: {
        id: 'semi_truck',
        name: 'Heavy Semi-Truck (Diesel I6)',
        engineLabel: '15.0L Turbo Diesel I6',
        fuelType: 'Diesel',
        rpmMin: 600,
        rpmMax: 2200,
        rpmIdle: 1150,
        glbPath: '/assets/models/semi_truck.glb',
        engineGlbPath: '/assets/models/engine_i6.glb',
        hoodTiltForward: true,
        hoodOpenAngle: 0.96,
        wheelRadius: 0.52,
        wheelWidth: 0.32,
        frontAxleX: 2.15,
        rearAxlesX: [-1.18, -2.32],
        dualRearTires: true,
        trackZ: 1.12,
        hoodPivot: new THREE.Vector3(2.86, 1.0, 0),
        hoodLength: 1.88,
        hoodWidth: 1.72,
        engineBasePos: new THREE.Vector3(1.86, 1.08, 0),
        engineClearancePos: new THREE.Vector3(1.82, 1.54, 2.55),
        engineLiftHeight: 2.1,
        engineStyle: 'diesel_i6',
        camFull: { pos: new THREE.Vector3(6.6, 2.95, 7.0), target: new THREE.Vector3(0.25, 1.35, 0) },
        camInspect: { pos: new THREE.Vector3(4.15, 2.42, 4.95), target: new THREE.Vector3(1.82, 1.56, 2.55) },
        tailPipes: [{ x: -0.22, y: 3.24, z: 1.04 }, { x: -0.22, y: 3.24, z: -1.04 }],
        headlightOrigin: new THREE.Vector3(2.96, 0.98, 0),
        targetLength: 6.4,
    },
    suv: {
        id: 'suv',
        name: 'SUV / 4x4 (V6)',
        engineLabel: '3.5L 60° DOHC V6',
        fuelType: 'Petrol',
        rpmMin: 700,
        rpmMax: 6200,
        rpmIdle: 1850,
        glbPath: '/assets/models/suv.glb',
        engineGlbPath: '/assets/models/engine_v6.glb',
        hoodTiltForward: false,
        hoodOpenAngle: 0.8,
        wheelRadius: 0.45,
        wheelWidth: 0.31,
        frontAxleX: 1.54,
        rearAxlesX: [-1.48],
        dualRearTires: false,
        trackZ: 0.98,
        hoodPivot: new THREE.Vector3(0.68, 1.24, 0),
        hoodLength: 1.58,
        hoodWidth: 1.66,
        engineBasePos: new THREE.Vector3(1.44, 0.68, 0),
        engineClearancePos: new THREE.Vector3(1.55, 1.32, 2.28),
        engineLiftHeight: 1.72,
        engineStyle: 'v6',
        camFull: { pos: new THREE.Vector3(5.3, 2.35, 5.6), target: new THREE.Vector3(0.25, 0.92, 0) },
        camInspect: { pos: new THREE.Vector3(3.45, 2.08, 4.48), target: new THREE.Vector3(1.55, 1.34, 2.28) },
        tailPipes: [{ x: -2.48, y: 0.35, z: 0.58 }, { x: -2.48, y: 0.35, z: -0.58 }],
        headlightOrigin: new THREE.Vector3(2.42, 1.06, 0),
        targetLength: 4.95,
    },
};

export async function attachExternalGLB(v, gltfLoader, url, label, onModelStatus) {
    const gltf = await gltfLoader.loadAsync(url);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const sz = box.getSize(new THREE.Vector3());
    model.scale.setScalar(v.cfg.targetLength / (Math.max(sz.x, sz.z) || 1));
    if (sz.z > sz.x * 1.15) model.rotation.y = Math.PI / 2;

    const sBox = new THREE.Box3().setFromObject(model);
    const c = sBox.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -sBox.min.y, -c.z);

    if (v.customGlbGroup) v.chassis.remove(v.customGlbGroup);
    v.fallbackShellGroup.visible = false;
    v.customGlbGroup = model;
    v.glbShellEntries = [];

    model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = child.receiveShadow = true;
        const mat = child.material;
        const tag = `${child.name || ''} ${mat?.name || ''}`.toLowerCase();
        const isHood = /hood|bonnet|kapot|frunk|engine_cover/.test(tag);
        if (isHood && mat) {
            child.material = mat.clone();
            child.material.transparent = true;
        }
        if (mat && 'metalness' in mat && /paint|body|car|chassis|exterior/.test(tag)) {
            mat.metalness = Math.max(mat.metalness ?? 0.5, 0.72);
            mat.roughness = Math.min(mat.roughness ?? 0.3, 0.18);
            if ('clearcoat' in mat) {
                mat.clearcoat = 1.0;
                mat.clearcoatRoughness = 0.05;
            }
        }
        const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 });
        child.add(new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 28), wireMat));
        v.glbShellEntries.push({ mesh: child, solidMat: child.material, wireMat, isHood });
    });

    v.chassis.add(model);
    v.hasExternalGLB = true;
    if (onModelStatus) onModelStatus(label);
}

export function createVehicleAssembly(type, textures) {
    const cfg = VEHICLE_PROFILES[type] || VEHICLE_PROFILES.coupe;
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const fallbackShellGroup = new THREE.Group();
    chassis.add(fallbackShellGroup);

    const shellEntries = [];
    const internalGlowMats = [];
    const wheels = [];

    const matXrayShell = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.4,
        metalness: 0.1,
        roughness: 0.18,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    const paintHex = { coupe: 0x1e293b, semi_truck: 0x1d406b, suv: 0x334155 }[type] || 0x1e293b;
    const m = {
        paint: new THREE.MeshPhysicalMaterial({
            color: paintHex, metalness: 0.74, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.05,
        }),
        carbon: new THREE.MeshStandardMaterial({ color: 0x1b212b, metalness: 0.32, roughness: 0.48 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.12 }),
        glass: new THREE.MeshPhysicalMaterial({
            color: 0x0f172a, metalness: 0.12, roughness: 0.05, transparent: true, opacity: 0.82, clearcoat: 1.0,
        }),
        headlight: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 1.45 }),
        amber: new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xf59e0b, emissiveIntensity: 1.35 }),
        taillight: new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0xef4444, emissiveIntensity: 1.3 }),
    };

    const addShell = (parent, geo, solidMat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
        const mesh = new THREE.Mesh(geo, solidMat);
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.castShadow = mesh.receiveShadow = true;
        parent.add(mesh);
        const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 });
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), wireMat));
        shellEntries.push({ mesh, solidMat, wireMat });
        return mesh;
    };

    const hoodPivot = new THREE.Group();
    hoodPivot.position.copy(cfg.hoodPivot);
    fallbackShellGroup.add(hoodPivot);

    if (type === 'semi_truck') buildSemiTruckBody(fallbackShellGroup, hoodPivot, addShell, m);
    else if (type === 'suv') buildSuvBody(fallbackShellGroup, hoodPivot, addShell, m);
    else buildSportsCoupeBody(fallbackShellGroup, hoodPivot, addShell, m);

    const hoodStruts = [];
    if (!cfg.hoodTiltForward) {
        const sz = cfg.hoodWidth * 0.44;
        [-sz, sz].forEach((z) => {
            const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 10), m.chrome);
            fallbackShellGroup.add(strut);
            hoodStruts.push({ mesh: strut, z });
        });
    }

    // Forward Headlight SpotLight
    const headlightSpot = new THREE.SpotLight(0xeef6ff, 10, 15, Math.PI / 4.2, 0.65, 1.5);
    headlightSpot.position.copy(cfg.headlightOrigin);
    const headlightTarget = new THREE.Object3D();
    headlightTarget.position.set(cfg.headlightOrigin.x + 6.5, 0.25, 0);
    root.add(headlightSpot, headlightTarget);
    headlightSpot.target = headlightTarget;

    // Treaded PBR Wheels, Alloy Spokes, Brake Calipers & Soft Contact Shadows
    const matTire = new THREE.MeshStandardMaterial({
        color: 0x161a22, roughness: 0.86, metalness: 0.06, bumpMap: textures.tireTreadMap, bumpScale: 0.025,
    });
    const matAlloy = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.16 });
    const matRotor = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.88, roughness: 0.28 });
    const matCaliper = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.45, roughness: 0.35 });
    internalGlowMats.push(matRotor);

    const addWheel = (x, z, isDual = false) => {
        const wg = new THREE.Group();
        wg.position.set(x, cfg.wheelRadius, z);
        const offsets = isDual ? [0, z > 0 ? -cfg.wheelWidth * 0.92 : cfg.wheelWidth * 0.92] : [0];
        offsets.forEach((zOff, idx) => {
            const tire = new THREE.Mesh(
                new THREE.CylinderGeometry(cfg.wheelRadius, cfg.wheelRadius, cfg.wheelWidth, 36),
                matTire
            );
            tire.rotation.x = Math.PI / 2;
            tire.position.z = zOff;
            tire.castShadow = true;
            wg.add(tire);

            if (idx === 0) {
                const rotor = new THREE.Mesh(
                    new THREE.CylinderGeometry(cfg.wheelRadius * 0.56, cfg.wheelRadius * 0.56, 0.07, 22),
                    matRotor
                );
                rotor.rotation.x = Math.PI / 2;
                wg.add(rotor);

                const sgn = z > 0 ? 1 : -1;
                const rim = new THREE.Mesh(
                    new THREE.TorusGeometry(cfg.wheelRadius * 0.68, 0.024, 10, 36),
                    type === 'semi_truck' ? m.chrome : matAlloy
                );
                rim.position.z = sgn * (cfg.wheelWidth * 0.47);
                wg.add(rim);

                for (let s = 0; s < 5; s++) {
                    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, cfg.wheelRadius * 1.24, 0.03), matAlloy);
                    sp.rotation.z = (s * Math.PI) / 5;
                    sp.position.z = sgn * (cfg.wheelWidth * 0.36);
                    wg.add(sp);
                }
                const hub = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.08, 0.08, cfg.wheelWidth * 0.94, 14),
                    type === 'semi_truck' ? m.chrome : m.carbon
                );
                hub.rotation.x = Math.PI / 2;
                wg.add(hub);
            }
        });
        fallbackShellGroup.add(wg);
        wheels.push(wg);

        const cal = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.1), matCaliper);
        cal.position.set(x - cfg.wheelRadius * 0.32, cfg.wheelRadius + 0.03, z > 0 ? z - 0.04 : z + 0.04);
        fallbackShellGroup.add(cal);

        const sh = new THREE.Mesh(
            new THREE.PlaneGeometry(cfg.wheelRadius * 2.5, cfg.wheelWidth * (isDual ? 3.2 : 2.1)),
            new THREE.MeshBasicMaterial({ map: textures.contactShadowMap, transparent: true, opacity: 0.78, depthWrite: false })
        );
        sh.rotation.x = -Math.PI / 2;
        sh.position.set(x, 0.009, isDual ? z * 0.88 : z);
        root.add(sh);
    };

    addWheel(cfg.frontAxleX, cfg.trackZ);
    addWheel(cfg.frontAxleX, -cfg.trackZ);
    cfg.rearAxlesX.forEach((rx) => {
        addWheel(rx, cfg.trackZ, cfg.dualRearTires);
        addWheel(rx, -cfg.trackZ, cfg.dualRearTires);
    });

    const underShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(cfg.targetLength * 1.14, cfg.trackZ * 2.6),
        new THREE.MeshBasicMaterial({ map: textures.contactShadowMap, transparent: true, opacity: 0.62, depthWrite: false })
    );
    underShadow.rotation.x = -Math.PI / 2;
    underShadow.position.set(0, 0.008, 0);
    root.add(underShadow);

    // Drivetrain & Axles
    const matDrive = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.86, roughness: 0.26 });
    internalGlowMats.push(matDrive);
    const lastRearX = cfg.rearAxlesX[cfg.rearAxlesX.length - 1];
    const shaftLen = cfg.frontAxleX - lastRearX;

    [cfg.frontAxleX, ...cfg.rearAxlesX].forEach((ax) => {
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, cfg.trackZ * 1.9, 12), matDrive);
        axle.rotation.x = Math.PI / 2;
        axle.position.set(ax, cfg.wheelRadius, 0);
        chassis.add(axle);
        const diff = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 14), matDrive);
        diff.position.set(ax, cfg.wheelRadius, 0);
        chassis.add(diff);
    });

    const driveshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, shaftLen, 12), matDrive);
    driveshaft.rotation.z = Math.PI / 2;
    driveshaft.position.set((cfg.frontAxleX + lastRearX) * 0.5, cfg.wheelRadius + 0.06, 0);
    chassis.add(driveshaft);

    const gearbox = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.72, 14), matDrive);
    gearbox.rotation.z = Math.PI / 2;
    gearbox.position.set(cfg.engineBasePos.x - 0.85, cfg.engineBasePos.y - 0.08, 0);
    chassis.add(gearbox);

    // Realistic Exhaust Piping, Catalytic Converter & Rear Silencers (Mufflers)
    buildExhaustAndSilencers(chassis, cfg, textures, m);

    // Rigged High-Detail Engine Assembly
    const engineGroup = new THREE.Group();
    engineGroup.position.copy(cfg.engineBasePos);
    chassis.add(engineGroup);

    const engineRig = buildRiggedEngine(engineGroup, cfg, textures, internalGlowMats);

    const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.9, 1.05),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(0, 0.16, 0);
    engineGroup.add(hitBox);

    const smokeParticles = Array.from({ length: 20 }, (_, i) => {
        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: textures.smokeSpriteMap, color: 0x94a3b8, transparent: true, opacity: 0, depthWrite: false,
            })
        );
        root.add(sprite);
        return { sprite, life: i / 20, fromBay: i % 2 === 0 };
    });

    return {
        cfg,
        root,
        chassis,
        fallbackShellGroup,
        customGlbGroup: null,
        hasExternalGLB: false,
        glbShellEntries: [],
        hoodPivot,
        hoodStruts,
        matXrayShell,
        matTaillight: m.taillight,
        headlightSpot,
        headlightTarget,
        shellEntries,
        internalGlowMats,
        wheels,
        driveshaft,
        engineGroup,
        engineHitTargets: [hitBox, engineGroup],
        engineRig,
        smokeParticles,
    };
}

// ===========================================================================
// REALISTIC EXHAUST PIPING, SILENCER / MUFFLER DRUMS & CHROME TAILPIPES
// ===========================================================================
function buildExhaustAndSilencers(chassis, cfg, textures, m) {
    const exhaustGrp = new THREE.Group();
    chassis.add(exhaustGrp);

    const matPipe = new THREE.MeshStandardMaterial({
        color: 0x8b95a5,
        metalness: 0.88,
        roughness: 0.3,
        bumpMap: textures.brushedAluminumMap,
        bumpScale: 0.008,
    });
    const matSilencer = new THREE.MeshStandardMaterial({
        color: 0xb6c0ce,
        metalness: 0.92,
        roughness: 0.22,
        bumpMap: textures.brushedAluminumMap,
        bumpScale: 0.012,
    });
    const matSootBore = new THREE.MeshBasicMaterial({ color: 0x090b0f });

    if (cfg.id === 'semi_truck') {
        // Heavy Commercial DPF / Silencer Canister under cab + crossover pipes to vertical chrome stacks
        const dpf = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.96, 18), matSilencer);
        dpf.rotation.z = Math.PI / 2;
        dpf.position.set(0.45, 0.62, -0.45);
        dpf.castShadow = true;
        exhaustGrp.add(dpf);

        // Downpipe from turbo into DPF silencer
        const downPipe = new THREE.CatmullRomCurve3([
            new THREE.Vector3(1.72, 1.18, -0.44),
            new THREE.Vector3(1.22, 0.72, -0.46),
            new THREE.Vector3(0.88, 0.62, -0.45),
        ]);
        exhaustGrp.add(new THREE.Mesh(new THREE.TubeGeometry(downPipe, 14, 0.052, 10, false), matPipe));

        // Twin crossover elbows feeding the vertical stacks + hollow dark top outlets
        [-1.04, 1.04].forEach((z) => {
            const feed = new THREE.CatmullRomCurve3([
                new THREE.Vector3(0.05, 0.62, -0.45),
                new THREE.Vector3(-0.22, 0.64, z * 0.6),
                new THREE.Vector3(-0.22, 0.92, z),
            ]);
            exhaustGrp.add(new THREE.Mesh(new THREE.TubeGeometry(feed, 12, 0.048, 10, false), matPipe));

            // Top miter-cut dark exhaust bore
            const bore = new THREE.Mesh(new THREE.CircleGeometry(0.072, 14), matSootBore);
            bore.rotation.x = -Math.PI / 2;
            bore.position.set(-0.22, 3.22, z);
            exhaustGrp.add(bore);
        });
        return;
    }

    // Sports Coupe (V8) & SUV / 4x4 (V6): Full Dual-Outlet Silencer System
    const isSuv = cfg.id === 'suv';
    const yBase = isSuv ? 0.35 : 0.27;
    const zTip = isSuv ? 0.58 : 0.56;
    const xTipEnd = isSuv ? -2.47 : -2.37;
    const xMuff = isSuv ? -2.02 : -1.94;
    const muffLen = isSuv ? 0.54 : 0.48;

    // Underbody main exhaust pipe from engine bay to mid-chassis resonator / catalytic converter
    const mainPipe = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cfg.engineBasePos.x - 0.1, yBase + 0.08, 0.22),
        new THREE.Vector3(0.45, yBase + 0.02, 0.26),
        new THREE.Vector3(-0.65, yBase + 0.02, 0.24),
        new THREE.Vector3(-1.12, yBase + 0.03, 0),
    ]);
    exhaustGrp.add(new THREE.Mesh(new THREE.TubeGeometry(mainPipe, 18, 0.036, 10, false), matPipe));

    // Mid-chassis Catalytic Converter & Resonator
    const cat = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.42, 16), matSilencer);
    cat.rotation.z = Math.PI / 2;
    cat.scale.set(1, 0.72, 1.2);
    cat.position.set(0.15, yBase + 0.02, 0.26);
    exhaustGrp.add(cat);

    // Y-Pipe Split Over Rear Axle into Left & Right Rear Silencer Drums + Chrome Tips
    [-zTip, zTip].forEach((z) => {
        const branch = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-1.1, yBase + 0.03, 0),
            new THREE.Vector3(-1.42, yBase + 0.14, z * 0.62), // Arches cleanly over rear axle
            new THREE.Vector3(xMuff + muffLen * 0.45, yBase, z),
        ]);
        exhaustGrp.add(new THREE.Mesh(new THREE.TubeGeometry(branch, 14, 0.03, 10, false), matPipe));

        // Oval Brushed Stainless Silencer (Muffler) Drum + Clamping Straps
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, muffLen, 20), matSilencer);
        drum.rotation.z = Math.PI / 2;
        drum.scale.set(1, 0.76, 1.18);
        drum.position.set(xMuff, yBase, z);
        drum.castShadow = true;
        exhaustGrp.add(drum);

        [-0.14, 0.14].forEach((ox) => {
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.009, 8, 22), m.carbon);
            band.rotation.y = Math.PI / 2;
            band.scale.set(1.18, 0.76, 1);
            band.position.set(xMuff + ox, yBase, z);
            exhaustGrp.add(band);
        });

        // Polished Chrome Exhaust Tailpipe Tip Protruding Rearward
        const tipLen = Math.abs(xTipEnd - (xMuff - muffLen * 0.46));
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.052, tipLen, 20), m.chrome);
        tip.rotation.z = Math.PI / 2;
        tip.position.set(xTipEnd + tipLen * 0.5, yBase, z);
        tip.castShadow = true;
        exhaustGrp.add(tip);

        // Rolled outer bezel ring + dark hollow inner exhaust bore
        const lip = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 20), m.chrome);
        lip.rotation.y = Math.PI / 2;
        lip.position.set(xTipEnd, yBase, z);
        exhaustGrp.add(lip);

        const bore = new THREE.Mesh(new THREE.CircleGeometry(0.046, 16), matSootBore);
        bore.rotation.y = -Math.PI / 2;
        bore.position.set(xTipEnd - 0.003, yBase, z);
        exhaustGrp.add(bore);
    });
}

// ===========================================================================
// VEHICLE BODY SHELLS
// ===========================================================================
function buildSportsCoupeBody(parent, hoodPivot, addShell, m) {
    const s = new THREE.Shape();
    s.moveTo(-2.26, 0.25); s.lineTo(0.68, 0.25); s.lineTo(0.68, 0.94);
    s.quadraticCurveTo(0.38, 1.04, 0.16, 1.24); s.quadraticCurveTo(-0.24, 1.38, -0.86, 1.36);
    s.quadraticCurveTo(-1.52, 1.28, -2.02, 0.98); s.lineTo(-2.28, 0.91);
    s.quadraticCurveTo(-2.36, 0.56, -2.26, 0.25);
    const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: 1.66, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.08, bevelSegments: 5 });
    bodyGeo.translate(0, 0, -0.83);
    addShell(parent, bodyGeo, m.paint);

    const g = new THREE.Shape();
    g.moveTo(0.52, 0.96); g.quadraticCurveTo(-0.18, 1.37, -0.82, 1.35); g.quadraticCurveTo(-1.42, 1.26, -1.86, 0.99); g.closePath();
    const gGeo = new THREE.ExtrudeGeometry(g, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.03, bevelSegments: 3 });
    gGeo.translate(0, 0, -0.75);
    addShell(parent, gGeo, m.glass);

    const f = new THREE.Shape();
    f.moveTo(0.64, 0.26); f.lineTo(2.3, 0.26); f.quadraticCurveTo(2.42, 0.5, 2.28, 0.78);
    f.quadraticCurveTo(1.56, 0.97, 0.64, 0.96); f.closePath();
    const fGeo = new THREE.ExtrudeGeometry(f, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 4 });
    addShell(parent, fGeo, m.paint, [0, 0, 0.69]);
    addShell(parent, fGeo, m.paint, [0, 0, -0.93]);

    addShell(parent, new THREE.BoxGeometry(0.46, 0.07, 1.94), m.carbon, [2.26, 0.22, 0]);
    addShell(parent, new THREE.BoxGeometry(0.28, 0.44, 1.88), m.paint, [2.24, 0.48, 0]);
    addShell(parent, new THREE.BoxGeometry(0.12, 0.24, 1.36), m.carbon, [2.36, 0.44, 0]);
    addShell(parent, new THREE.BoxGeometry(0.28, 0.05, 1.76), m.paint, [-2.16, 1.15, 0], [0, 0, 0.08]);

    [-0.68, 0.68].forEach((z) => {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.42), m.headlight);
        lamp.position.set(2.34, 0.66, z);
        lamp.rotation.y = z > 0 ? -0.2 : 0.2;
        parent.add(lamp);
    });
    [-0.6, 0.6].forEach((z) => addShell(parent, new THREE.BoxGeometry(0.14, 0.24, 0.05), m.carbon, [-2.12, 1.02, z]));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 1.72), m.taillight);
    tail.position.set(-2.32, 0.8, 0);
    parent.add(tail);

    [-0.96, 0.96].forEach((z) => {
        addShell(parent, new THREE.BoxGeometry(2.34, 0.09, 0.14), m.carbon, [0, 0.24, z]);
        addShell(parent, new THREE.BoxGeometry(0.18, 0.09, 0.22), m.paint, [0.34, 1.0, z * 1.02]);
    });

    const h = new THREE.Shape();
    h.moveTo(0, 0.04); h.quadraticCurveTo(0.84, 0.06, 1.62, -0.17);
    h.lineTo(1.6, -0.22); h.quadraticCurveTo(0.82, 0, 0, -0.02); h.closePath();
    const hGeo = new THREE.ExtrudeGeometry(h, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 4 });
    hGeo.translate(0, 0, -0.7);
    addShell(hoodPivot, hGeo, m.paint);
}

function buildSemiTruckBody(parent, hoodPivot, addShell, m) {
    [-0.46, 0.46].forEach((z) => addShell(parent, new THREE.BoxGeometry(5.65, 0.2, 0.12), m.carbon, [-0.08, 0.64, z]));
    addShell(parent, new THREE.CylinderGeometry(0.54, 0.56, 0.09, 22), m.carbon, [-1.72, 0.84, 0]);
    [-1.12, 1.12].forEach((z) => addShell(parent, new THREE.BoxGeometry(0.16, 0.68, 0.52), m.carbon, [-2.92, 0.68, z]));

    const radCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.84, 1.08), m.carbon);
    radCore.position.set(2.62, 1.24, 0);
    parent.add(radCore);
    const radFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 1.14), m.chrome);
    radFrame.position.set(2.62, 1.24, 0);
    radFrame.scale.set(0.75, 1, 1);
    parent.add(radFrame);

    const cab = new THREE.Shape();
    cab.moveTo(-0.98, 0.82); cab.lineTo(0.96, 0.82); cab.lineTo(0.96, 1.84);
    cab.lineTo(0.68, 2.58); cab.quadraticCurveTo(0.3, 3.05, -0.98, 3.12); cab.closePath();
    const cabGeo = new THREE.ExtrudeGeometry(cab, { depth: 1.98, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.07, bevelSegments: 4 });
    cabGeo.translate(0, 0, -0.99);
    addShell(parent, cabGeo, m.paint);

    addShell(parent, new THREE.BoxGeometry(0.28, 0.68, 1.84), m.glass, [0.85, 2.22, 0], [0, 0, 0.34]);
    addShell(parent, new THREE.BoxGeometry(0.26, 0.12, 2.06), m.chrome, [0.88, 2.56, 0], [0, 0, 0.25]);
    [-1.02, 1.02].forEach((z) => {
        addShell(parent, new THREE.BoxGeometry(1.12, 0.56, 0.12), m.glass, [0.22, 2.18, z]);
        addShell(parent, new THREE.BoxGeometry(0.12, 0.44, 0.08), m.chrome, [0.86, 2.08, z * 1.24]);
        addShell(parent, new THREE.BoxGeometry(0.04, 0.04, 0.3), m.chrome, [0.86, 2.24, z * 1.1]);
        addShell(parent, new THREE.BoxGeometry(0.04, 0.04, 0.3), m.chrome, [0.86, 1.92, z * 1.1]);
    });

    [-0.96, 0.96].forEach((z) => {
        addShell(parent, new THREE.CylinderGeometry(0.32, 0.32, 1.65, 22), m.chrome, [-0.04, 0.68, z], [0, 0, Math.PI / 2]);
        addShell(parent, new THREE.BoxGeometry(1.2, 0.07, 0.26), m.carbon, [0.16, 0.44, z * 1.12]);
    });
    [-1.04, 1.04].forEach((z) => {
        addShell(parent, new THREE.CylinderGeometry(0.085, 0.085, 2.35, 16), m.chrome, [-0.22, 2.04, z]);
        addShell(parent, new THREE.CylinderGeometry(0.11, 0.11, 1.1, 16), m.carbon, [-0.22, 1.65, z]);
    });

    [-0.7, -0.35, 0, 0.35, 0.7].forEach((z) => {
        const mk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), m.amber);
        mk.position.set(0.76, 2.66, z);
        parent.add(mk);
    });
    addShell(parent, new THREE.BoxGeometry(0.26, 0.42, 2.28), m.chrome, [2.98, 0.62, 0]);
    [-0.64, 0.64].forEach((z) => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.36), m.taillight);
        tl.position.set(-2.95, 0.65, z);
        parent.add(tl);
    });

    const h = new THREE.Shape();
    h.moveTo(0.04, -0.18); h.lineTo(0.04, 0.72);
    h.quadraticCurveTo(-0.2, 0.84, -1.88, 0.88);
    h.lineTo(-1.88, 0.72); h.lineTo(-0.14, 0.62); h.lineTo(-0.14, -0.18); h.closePath();
    const hGeo = new THREE.ExtrudeGeometry(h, { depth: 1.56, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 4 });
    hGeo.translate(0, 0, -0.78);
    addShell(hoodPivot, hGeo, m.paint);

    [-0.92, 0.92].forEach((z) => {
        addShell(hoodPivot, new THREE.BoxGeometry(1.75, 0.44, 0.24), m.paint, [-0.88, 0.12, z]);
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.28), m.headlight);
        hl.position.set(0.08, -0.02, z * 0.96);
        hoodPivot.add(hl);
    });
    addShell(hoodPivot, new THREE.BoxGeometry(0.12, 0.82, 1.24), m.chrome, [0.1, 0.28, 0]);
    for (let i = -3; i <= 3; i++) {
        addShell(hoodPivot, new THREE.BoxGeometry(0.15, 0.035, 1.1), m.carbon, [0.11, 0.28 + i * 0.098, 0]);
    }
}

function buildSuvBody(parent, hoodPivot, addShell, m) {
    const s = new THREE.Shape();
    s.moveTo(-2.34, 0.42); s.lineTo(0.72, 0.42); s.lineTo(0.72, 1.24);
    s.lineTo(0.32, 1.84); s.lineTo(-1.98, 1.84); s.quadraticCurveTo(-2.3, 1.8, -2.38, 1.24); s.closePath();
    const bGeo = new THREE.ExtrudeGeometry(s, { depth: 1.76, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.07, bevelSegments: 4 });
    bGeo.translate(0, 0, -0.88);
    addShell(parent, bGeo, m.paint);

    const g = new THREE.Shape();
    g.moveTo(0.62, 1.28); g.lineTo(0.28, 1.78); g.lineTo(-1.94, 1.78); g.lineTo(-2.22, 1.28); g.closePath();
    const gGeo = new THREE.ExtrudeGeometry(g, { depth: 1.68, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.02, bevelSegments: 3 });
    gGeo.translate(0, 0, -0.84);
    addShell(parent, gGeo, m.glass);

    [-0.72, 0.72].forEach((z) => {
        addShell(parent, new THREE.BoxGeometry(2.05, 0.06, 0.06), m.chrome, [-0.82, 1.94, z]);
        addShell(parent, new THREE.BoxGeometry(2.1, 0.08, 0.2), m.carbon, [0, 0.36, z * 1.44]);
        addShell(parent, new THREE.BoxGeometry(0.18, 0.12, 0.24), m.paint, [0.46, 1.32, z * 1.48]);
    });

    const fGeo = new THREE.BoxGeometry(1.62, 0.78, 0.24);
    addShell(parent, fGeo, m.paint, [1.5, 0.84, 0.82]);
    addShell(parent, fGeo, m.paint, [1.5, 0.84, -0.82]);
    addShell(parent, new THREE.BoxGeometry(0.28, 0.64, 1.92), m.paint, [2.26, 0.8, 0]);
    addShell(parent, new THREE.BoxGeometry(0.14, 0.34, 1.36), m.carbon, [2.38, 0.82, 0]);
    addShell(parent, new THREE.BoxGeometry(0.24, 0.16, 1.62), m.chrome, [2.34, 0.44, 0]);

    const fBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.72), m.headlight);
    fBar.position.set(2.4, 1.06, 0);
    parent.add(fBar);
    const rBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.76), m.taillight);
    rBar.position.set(-2.44, 1.15, 0);
    parent.add(rBar);

    const hGeo = new THREE.BoxGeometry(1.58, 0.09, 1.56);
    hGeo.translate(0.79, 0.02, 0);
    addShell(hoodPivot, hGeo, m.paint, [0, 0, 0], [0, 0, -0.05]);
}

// ===========================================================================
// DISTINCT RIGGED MECHANICAL ENGINES (V8 TWIN-TURBO / TALL DIESEL I6 / 60° V6)
// ===========================================================================
function buildRiggedEngine(engineGroup, cfg, textures, internalGlowMats) {
    const isI6 = cfg.engineStyle === 'diesel_i6';
    const isV8 = cfg.engineStyle === 'v8';
    const isV6 = cfg.engineStyle === 'v6';
    const isV = isV8 || isV6;

    const blockLen = isI6 ? 1.14 : isV8 ? 0.92 : 0.74;
    const blockH = isI6 ? 0.4 : 0.24;
    const blockW = isI6 ? 0.46 : isV8 ? 0.58 : 0.5;
    const crankY = isI6 ? -0.14 : -0.07;
    const strokeR = isI6 ? 0.072 : 0.042;
    const rodLen = isI6 ? 0.25 : 0.148;
    const headY = isI6 ? 0.34 : 0.22;
    const coverY = isI6 ? 0.48 : 0.32;
    const vTilt = isV8 ? 0.58 : isV6 ? 0.42 : 0;

    const matBlockSolid = new THREE.MeshStandardMaterial({
        color: isI6 ? 0x4b5563 : 0x9ca7b8,
        metalness: isI6 ? 0.76 : 0.88,
        roughness: isI6 ? 0.42 : 0.28,
        bumpMap: textures.brushedAluminumMap,
        bumpScale: 0.016,
    });
    const matBlockXray = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.26,
        metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide,
    });
    const matHeadSolid = new THREE.MeshStandardMaterial({
        color: 0xb0bac8, metalness: 0.9, roughness: 0.24, bumpMap: textures.brushedAluminumMap, bumpScale: 0.012,
    });
    const matCoverSolid = new THREE.MeshStandardMaterial({
        color: isV8 ? 0x991b1b : isI6 ? 0x1e293b : 0x262f3d, metalness: 0.55, roughness: 0.3,
    });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x828ea0, metalness: 0.94, roughness: 0.18 });
    const matChrome = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.96, roughness: 0.12 });
    const matPiston = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.14 });
    const matRing = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.85, roughness: 0.35 });
    const matBolt = new THREE.MeshStandardMaterial({ color: 0xdbe2ec, metalness: 0.95, roughness: 0.2 });
    const matRubber = new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.86, metalness: 0.08 });
    const matBlue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42, metalness: 0.1 });
    const matCopper = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.9, roughness: 0.25 });
    const matTurboHot = new THREE.MeshStandardMaterial({
        color: 0x57534e, metalness: 0.72, roughness: 0.44, emissive: 0xea580c, emissiveIntensity: 0.35,
    });
    const matHeader = new THREE.MeshStandardMaterial({
        color: 0x78716c, metalness: 0.82, roughness: 0.32, emissive: 0xc2410c, emissiveIntensity: 0.08,
    });
    internalGlowMats.push(matSteel, matPiston);

    const makeFaultMat = (hex) => new THREE.MeshStandardMaterial({
        color: hex, metalness: 0.82, roughness: 0.24, bumpMap: textures.brushedAluminumMap, bumpScale: 0.008,
    });
    const matFuel = makeFaultMat(0xcbd5e1);
    const matIntake = makeFaultMat(0x8896a8);
    const matCoil = makeFaultMat(0x27303f);
    const faultMats = { fuel_rail: [matFuel], intake_combustion: [matIntake], ignition_coils: [matCoil] };

    const xrayBlockEntries = [];
    const registerShell = (mesh, solidMat) => {
        const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 });
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), wireMat));
        xrayBlockEntries.push({ mesh, solidMat, wireMat });
    };

    const explodeLayers = [];
    const makeLayer = (ox, oy, oz) => {
        const grp = new THREE.Group();
        engineGroup.add(grp);
        explodeLayers.push({ group: grp, base: new THREE.Vector3(), offset: new THREE.Vector3(ox, oy, oz) });
        return grp;
    };

    const oilPanGrp = makeLayer(0, -0.34, 0);
    const blockGrp = makeLayer(0, 0, 0);
    const crankGrp = makeLayer(0, -0.16, 0);
    const headGrp = makeLayer(0, 0.24, 0);
    const valvetrainGrp = makeLayer(0, 0.42, 0);
    const coverGrp = makeLayer(0, 0.58, 0);
    const fuelGrp = makeLayer(0, 0.46, 0.38);
    const intakeGrp = makeLayer(0, 0.36, -0.4);
    const turboExhaustGrp = makeLayer(0, 0.14, 0.44);
    const ignitionGrp = makeLayer(0, 0.74, 0);
    const beltGrp = makeLayer(0.32, 0, 0);

    const panY = isI6 ? -0.28 : -0.18;
    const panH = isI6 ? 0.18 : 0.12;
    const pan = new THREE.Mesh(new THREE.BoxGeometry(blockLen, panH, blockW * 0.9), matRubber);
    pan.position.y = panY;
    oilPanGrp.add(pan);
    const panFlange = new THREE.Mesh(new THREE.BoxGeometry(blockLen + 0.04, 0.025, blockW * 0.96), matBolt);
    panFlange.position.y = panY + panH * 0.5;
    oilPanGrp.add(panFlange);

    const blockY = isI6 ? 0.07 : 0.03;
    const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(blockLen, blockH, blockW), matBlockSolid);
    blockMesh.position.y = blockY;
    blockMesh.castShadow = true;
    blockGrp.add(blockMesh);
    registerShell(blockMesh, matBlockSolid);

    const ribCount = isI6 ? 7 : isV8 ? 5 : 4;
    for (let r = 0; r < ribCount; r++) {
        const rx = -blockLen * 0.42 + (r / (ribCount - 1)) * (blockLen * 0.84);
        [-blockW * 0.51, blockW * 0.51].forEach((rz) => {
            const rib = new THREE.Mesh(new THREE.BoxGeometry(0.025, blockH * 0.85, 0.024), matBlockSolid);
            rib.position.set(rx, blockY, rz);
            blockGrp.add(rib);
            registerShell(rib, matBlockSolid);
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.022, 6), matBolt);
            bolt.rotation.x = Math.PI / 2;
            bolt.position.set(rx, blockY - blockH * 0.4, rz * 1.03);
            blockGrp.add(bolt);
        });
    }

    const crankShaft = new THREE.Group();
    crankShaft.position.y = crankY;
    crankGrp.add(crankShaft);
    const journal = new THREE.Mesh(new THREE.CylinderGeometry(isI6 ? 0.044 : 0.034, isI6 ? 0.044 : 0.034, blockLen + 0.2, 16), matSteel);
    journal.rotation.z = Math.PI / 2;
    crankShaft.add(journal);
    const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(isI6 ? 0.22 : 0.17, isI6 ? 0.22 : 0.17, 0.05, 28), matRubber);
    flywheel.rotation.z = Math.PI / 2;
    flywheel.position.x = -blockLen * 0.55;
    crankShaft.add(flywheel);

    const cylinderRigs = [];
    const camshafts = [];
    const sparkFlashes = [];
    const combustionFlames = [];
    const turboHotMats = [matTurboHot];

    const banks = isV
        ? [{ z: isV8 ? 0.18 : 0.15, tilt: -vTilt, cyls: isV8 ? 4 : 3 }, { z: isV8 ? -0.18 : -0.15, tilt: vTilt, cyls: isV8 ? 4 : 3 }]
        : [{ z: 0, tilt: 0, cyls: 6 }];

    banks.forEach((bank, bIdx) => {
        const span = blockLen - 0.18;
        const step = span / (bank.cyls - 1);
        const startX = -span * 0.5;

        const head = new THREE.Mesh(new THREE.BoxGeometry(blockLen * 0.98, isI6 ? 0.13 : 0.085, isV ? 0.22 : 0.42), matHeadSolid);
        head.position.set(0, headY, bank.z);
        head.rotation.x = bank.tilt;
        headGrp.add(head);
        registerShell(head, matHeadSolid);

        const cover = new THREE.Mesh(new THREE.BoxGeometry(blockLen * 0.94, isI6 ? 0.12 : 0.068, isV ? 0.18 : 0.34), matCoverSolid);
        cover.position.set(0, coverY, bank.z * 1.18);
        cover.rotation.x = bank.tilt;
        coverGrp.add(cover);
        registerShell(cover, matCoverSolid);

        for (let b = 0; b <= bank.cyls; b++) {
            const bx = -blockLen * 0.43 + (b / bank.cyls) * (blockLen * 0.86);
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.025, 6), matBolt);
            bolt.position.set(bx, coverY + (isI6 ? 0.065 : 0.036), bank.z * 1.18);
            bolt.rotation.x = bank.tilt;
            coverGrp.add(bolt);
        }

        const camGroup = new THREE.Group();
        camGroup.position.set(0, headY + (isI6 ? 0.09 : 0.055), bank.z * 1.1);
        camGroup.rotation.x = bank.tilt;
        const camBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, blockLen * 0.96, 12), matSteel);
        camBar.rotation.z = Math.PI / 2;
        camGroup.add(camBar);
        valvetrainGrp.add(camGroup);
        camshafts.push(camGroup);

        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, blockLen * 0.92, 12), matFuel);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, headY + 0.1, isV ? bank.z * 1.48 : 0.25);
        fuelGrp.add(rail);

        const hCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-blockLen * 0.48, coverY + 0.02, bank.z * 1.3),
            new THREE.Vector3(0, coverY + 0.04, bank.z * 1.38),
            new THREE.Vector3(blockLen * 0.42, coverY, bank.z * 1.28),
        ]);
        ignitionGrp.add(new THREE.Mesh(new THREE.TubeGeometry(hCurve, 12, 0.012, 6, false), matRubber));

        const pRadius = isI6 ? 0.062 : 0.052;
        for (let i = 0; i < bank.cyls; i++) {
            const x = startX + i * step;
            const phase = isI6 ? (i * Math.PI * 2) / 3 : ((i * 2 + bIdx) * Math.PI) / (bank.cyls === 4 ? 2 : 1.5);

            const web = new THREE.Mesh(new THREE.BoxGeometry(0.026, isI6 ? 0.15 : 0.115, 0.072), matSteel);
            web.position.set(x - 0.036, -Math.cos(phase) * 0.028, -Math.sin(phase) * 0.028);
            crankShaft.add(web);
            const web2 = web.clone();
            web2.position.x = x + 0.036;
            crankShaft.add(web2);

            const cylFrame = new THREE.Group();
            cylFrame.position.set(x, crankY, 0);
            cylFrame.rotation.x = bank.tilt;
            blockGrp.add(cylFrame);

            const pistonGrp = new THREE.Group();
            pistonGrp.add(new THREE.Mesh(new THREE.CylinderGeometry(pRadius, pRadius, isI6 ? 0.095 : 0.072, 18), matPiston));
            [0.026, 0.01].forEach((ry) => {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(pRadius + 0.001, 0.004, 6, 20), matRing);
                ring.rotation.x = Math.PI / 2;
                ring.position.y = ry;
                pistonGrp.add(ring);
            });
            cylFrame.add(pistonGrp);

            const rod = new THREE.Mesh(new THREE.BoxGeometry(0.024, rodLen, 0.026), matSteel);
            cylFrame.add(rod);

            const flame = new THREE.Mesh(
                new THREE.CircleGeometry(pRadius * 0.92, 14),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0, side: THREE.DoubleSide })
            );
            flame.rotation.x = -Math.PI / 2;
            flame.position.y = strokeR + rodLen + (isI6 ? 0.055 : 0.042);
            cylFrame.add(flame);
            combustionFlames.push({ mesh: flame, phase });

            const lobe = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.05, 0.028), matPiston);
            lobe.position.set(x, 0.012, 0);
            lobe.rotation.x = phase * 0.5;
            camGroup.add(lobe);

            const vBaseY = headY + 0.03;
            const vIn = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.024, 0.08, 10), matPiston);
            vIn.position.set(x - 0.024, vBaseY, bank.z);
            vIn.rotation.x = bank.tilt;
            valvetrainGrp.add(vIn);

            const vEx = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.024, 0.08, 10), matPiston);
            vEx.position.set(x + 0.024, vBaseY, bank.z);
            vEx.rotation.x = bank.tilt;
            valvetrainGrp.add(vEx);

            const inj = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.011, 0.1, 10), matFuel);
            inj.position.set(x, headY + 0.06, isV ? bank.z * 1.34 : 0.2);
            fuelGrp.add(inj);

            const coil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.09), matCoil);
            coil.position.set(x, coverY + (isI6 ? 0.075 : 0.05), bank.z * 1.22);
            coil.rotation.x = bank.tilt;
            ignitionGrp.add(coil);

            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.045, 8, 8),
                new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.6), transparent: true, opacity: 0 })
            );
            spark.position.set(x, coverY + (isI6 ? 0.12 : 0.095), bank.z * 1.24);
            ignitionGrp.add(spark);
            sparkFlashes.push(spark);

            cylinderRigs.push({ piston: pistonGrp, rod, vIn, vEx, vBaseY, phase, strokeR, rodLen });
        }
    });

    if (isV8) {
        const plenum = new THREE.Mesh(new THREE.BoxGeometry(blockLen * 0.86, 0.09, 0.26), matIntake);
        plenum.position.y = 0.31;
        intakeGrp.add(plenum);

        [-1, 1].forEach((side) => {
            const zOut = side * 0.39;
            [-0.3, -0.1, 0.1, 0.3].forEach((hx) => {
                const c = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(hx, 0.2, side * 0.27),
                    new THREE.Vector3(hx * 0.85, 0.15, zOut),
                    new THREE.Vector3(0.28, 0.14, zOut),
                ]);
                turboExhaustGrp.add(new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.018, 8, false), matHeader));
            });
            const hot = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.032, 10, 20), matTurboHot);
            hot.rotation.y = Math.PI / 2;
            hot.position.set(0.3, 0.16, zOut);
            turboExhaustGrp.add(hot);

            const cold = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.034, 10, 20), matChrome);
            cold.rotation.y = Math.PI / 2;
            cold.position.set(0.38, 0.16, zOut);
            turboExhaustGrp.add(cold);

            const cp = new THREE.CatmullRomCurve3([
                new THREE.Vector3(0.4, 0.22, zOut),
                new THREE.Vector3(0.45, 0.34, side * 0.24),
                new THREE.Vector3(0.34, 0.33, side * 0.08),
            ]);
            intakeGrp.add(new THREE.Mesh(new THREE.TubeGeometry(cp, 12, 0.026, 8, false), matChrome));
        });
    } else if (isI6) {
        const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, blockLen * 0.94, 16), matIntake);
        intake.rotation.z = Math.PI / 2;
        intake.position.set(0, 0.34, 0.32);
        intakeGrp.add(intake);

        const exMan = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, blockLen * 0.9, 14), matHeader);
        exMan.rotation.z = Math.PI / 2;
        exMan.position.set(0, 0.3, -0.32);
        turboExhaustGrp.add(exMan);

        const bigHot = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.06, 12, 22), matTurboHot);
        bigHot.rotation.y = Math.PI / 2;
        bigHot.position.set(0.14, 0.32, -0.44);
        turboExhaustGrp.add(bigHot);

        const bigCold = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.062, 12, 22), matChrome);
        bigCold.rotation.y = Math.PI / 2;
        bigCold.position.set(0.28, 0.32, -0.44);
        turboExhaustGrp.add(bigCold);

        const icHotCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.32, 0.44, -0.44),
            new THREE.Vector3(0.54, 0.5, -0.36),
            new THREE.Vector3(0.68, 0.36, -0.32),
        ]);
        intakeGrp.add(new THREE.Mesh(new THREE.TubeGeometry(icHotCurve, 14, 0.048, 10, false), matChrome));

        const icColdCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.68, 0.36, 0.34),
            new THREE.Vector3(0.5, 0.48, 0.36),
            new THREE.Vector3(0.26, 0.38, 0.33),
        ]);
        intakeGrp.add(new THREE.Mesh(new THREE.TubeGeometry(icColdCurve, 14, 0.048, 10, false), matChrome));

        [
            [0.36, 0.45, -0.42, 0.4],
            [0.32, 0.4, 0.34, 0.4],
        ].forEach(([cx, cy, cz, rx]) => {
            const cpl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 12), matBlue);
            cpl.position.set(cx, cy, cz);
            cpl.rotation.set(rx, 0, Math.PI / 2);
            intakeGrp.add(cpl);
        });
    } else {
        const plenum = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, blockLen * 0.86, 16), matIntake);
        plenum.rotation.z = Math.PI / 2;
        plenum.position.y = 0.34;
        intakeGrp.add(plenum);

        [-0.2, 0, 0.2].forEach((rx) => {
            [-1, 1].forEach((side) => {
                const rc = new THREE.CatmullRomCurve3([
                    new THREE.Vector3(rx, 0.34, side * 0.06),
                    new THREE.Vector3(rx, 0.32, side * 0.16),
                    new THREE.Vector3(rx, 0.25, side * 0.18),
                ]);
                intakeGrp.add(new THREE.Mesh(new THREE.TubeGeometry(rc, 8, 0.02, 8, false), matIntake));
            });
        });

        const uHose = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.32, 0.24, 0.1), new THREE.Vector3(0.48, 0.28, 0.24), new THREE.Vector3(0.56, 0.22, 0.26),
        ]);
        const lHose = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.3, -0.02, -0.18), new THREE.Vector3(0.48, -0.04, -0.26), new THREE.Vector3(0.56, 0.02, -0.26),
        ]);
        intakeGrp.add(
            new THREE.Mesh(new THREE.TubeGeometry(uHose, 10, 0.026, 8, false), matRubber),
            new THREE.Mesh(new THREE.TubeGeometry(lHose, 10, 0.024, 8, false), matRubber)
        );

        const alt = new THREE.Group();
        alt.position.set(0.24, 0.1, -0.32);
        const aCase = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.13, 16), matHeadSolid);
        const aCore = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.05, 16), matCopper);
        aCase.rotation.z = aCore.rotation.z = Math.PI / 2;
        alt.add(aCase, aCore);
        beltGrp.add(alt);
    }

    const frontX = blockLen * 0.54;
    const pulleys = [];
    const pDefs = [
        { y: crankY, z: 0, r: isI6 ? 0.09 : 0.074 },
        { y: isI6 ? 0.26 : 0.22, z: isV ? 0.15 : 0, r: isI6 ? 0.068 : 0.056 },
        { y: 0.1, z: isV6 ? -0.32 : -0.22, r: 0.052 },
        ...(isI6 ? [{ y: 0.12, z: 0.22, r: 0.058 }] : []),
    ];
    pDefs.forEach((pd) => {
        const g = new THREE.Group();
        g.position.set(frontX, pd.y, pd.z);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(pd.r, pd.r, 0.04, 20), matSteel);
        w.rotation.z = Math.PI / 2;
        g.add(w, new THREE.Mesh(new THREE.BoxGeometry(0.045, pd.r * 1.6, 0.015), matRubber));
        beltGrp.add(g);
        pulleys.push(g);
    });

    const beltCurve = new THREE.CatmullRomCurve3(pDefs.map((p) => new THREE.Vector3(frontX, p.y, p.z)), true);
    beltGrp.add(new THREE.Mesh(new THREE.TubeGeometry(beltCurve, 28, 0.015, 6, true), matRubber));

    const fanGroup = new THREE.Group();
    fanGroup.position.set(frontX + 0.1, isI6 ? 0.16 : 0.06, 0);
    const blades = isI6 ? 9 : 6;
    const span = isI6 ? 0.56 : 0.26;
    for (let i = 0; i < blades; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.018, span, isI6 ? 0.065 : 0.044), matRubber);
        b.rotation.x = (i * Math.PI * 2) / blades;
        b.rotation.y = 0.25;
        fanGroup.add(b);
    }
    const fHub = new THREE.Mesh(new THREE.CylinderGeometry(isI6 ? 0.08 : 0.055, isI6 ? 0.08 : 0.055, 0.045, 14), matSteel);
    fHub.rotation.z = Math.PI / 2;
    fanGroup.add(fHub);
    beltGrp.add(fanGroup);

    return {
        crankShaft,
        cylinderRigs,
        camshafts,
        pulleys,
        fanGroup,
        sparkFlashes,
        combustionFlames,
        turboHotMats,
        matBlockXray,
        xrayBlockEntries,
        faultMats,
        explodeLayers,
    };
}