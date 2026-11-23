import * as THREE from 'three';

export const ROOM_BOUNDS = {
    minX: -12.4,
    maxX: 12.4,
    minY: 0.35,
    maxY: 6.8,
    minZ: -9.6,
    maxZ: 9.6,
    targetMinX: -3.0,
    targetMaxX: 3.0,
    targetMinY: 0.4,
    targetMaxY: 3.1,
    targetMinZ: -2.4,
    targetMaxZ: 3.0,
};

export function createWorkshopTextures() {
    const makeCanvas = (w, h, draw) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        draw(c.getContext('2d'), w, h);
        return new THREE.CanvasTexture(c);
    };

    // 1. Brushed aluminum bump map for engine castings
    const brushedAluminumMap = makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y++) {
            const s = 104 + Math.floor(Math.random() * 48);
            ctx.fillStyle = `rgb(${s},${s},${s})`;
            ctx.fillRect(0, y, w, 1);
        }
    });
    brushedAluminumMap.wrapS = brushedAluminumMap.wrapT = THREE.RepeatWrapping;
    brushedAluminumMap.repeat.set(3, 3);

    // 2. Rubber tire tread bump map
    const tireTreadMap = makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#363636';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#d2d2d2';
        ctx.lineWidth = 10;
        for (let y = -32; y < 288; y += 26) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(128, y + 18);
            ctx.lineTo(256, y);
            ctx.stroke();
        }
        ctx.fillStyle = '#181818';
        ctx.fillRect(78, 0, 12, h);
        ctx.fillRect(166, 0, 12, h);
    });
    tireTreadMap.wrapS = tireTreadMap.wrapT = THREE.RepeatWrapping;
    tireTreadMap.repeat.set(2, 8);

    // 3. Soft radial contact shadow under tires & chassis
    const contactShadowMap = makeCanvas(256, 256, (ctx) => {
        const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
        g.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
        g.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
    });

    // 4. Realistic dark polished concrete workshop floor
    const concreteFloorMap = makeCanvas(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#252b34';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
            const rx = Math.random() * w;
            const ry = Math.random() * h;
            const rr = 28 + Math.random() * 80;
            const g = ctx.createRadialGradient(rx, ry, 2, rx, ry, rr);
            g.addColorStop(0, Math.random() > 0.5 ? 'rgba(16,20,27,0.34)' : 'rgba(54,64,78,0.28)');
            g.addColorStop(1, 'rgba(37,43,52,0)');
            ctx.fillStyle = g;
            ctx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
        }
        for (let i = 0; i < 2800; i++) {
            const v = 30 + Math.floor(Math.random() * 24);
            ctx.fillStyle = `rgba(${v},${v + 4},${v + 9},0.38)`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        ctx.strokeStyle = 'rgba(12, 15, 22, 0.58)';
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.beginPath();
        ctx.moveTo(256, 0);
        ctx.lineTo(256, 512);
        ctx.moveTo(0, 256);
        ctx.lineTo(512, 256);
        ctx.stroke();
    });
    concreteFloorMap.colorSpace = THREE.SRGBColorSpace;
    concreteFloorMap.wrapS = concreteFloorMap.wrapT = THREE.RepeatWrapping;
    concreteFloorMap.repeat.set(12, 7);

    // 5. Ultra-soft wispy exhaust smoke sprite
    const smokeSpriteMap = makeCanvas(128, 128, (ctx) => {
        const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 58);
        g.addColorStop(0, 'rgba(255,255,255,0.78)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.34)');
        g.addColorStop(0.7, 'rgba(255,255,255,0.08)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
    });

    return { brushedAluminumMap, tireTreadMap, contactShadowMap, concreteFloorMap, smokeSpriteMap };
}

export function buildWorkshop(scene, textures) {
    const shop = new THREE.Group();
    scene.add(shop);

    // High-contrast realistic workshop lighting
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1a202c, 0.58));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.85);
    keyLight.position.set(6.5, 10.5, 7.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 34;
    Object.assign(keyLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.78);
    rimLight.position.set(-7.5, 5.5, -5.5);
    scene.add(rimLight);

    const W = 28;
    const D = 22;
    const H = 7.4;

    // 1. Sealed dark concrete floor extending outside both drive-through bay aprons
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(W + 30, D + 6),
        new THREE.MeshStandardMaterial({ map: textures.concreteFloorMap, roughness: 0.34, metalness: 0.28 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    shop.add(floor);

    const bayPad = new THREE.Mesh(
        new THREE.PlaneGeometry(8.0, 4.0),
        new THREE.MeshStandardMaterial({ color: 0x1d232d, roughness: 0.36, metalness: 0.2 })
    );
    bayPad.rotation.x = -Math.PI / 2;
    bayPad.position.set(0, 0.003, 0);
    bayPad.receiveShadow = true;
    shop.add(bayPad);

    const matSafety = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.52 });
    const matBollard = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.2 });

    [-2.02, 2.02].forEach((z) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(8.14, 0.075), matSafety);
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, 0.005, z);
        shop.add(m);
    });
    [-4.03, 4.03].forEach((x) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 4.12), matSafety);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.005, 0);
        shop.add(m);
    });

    const bayStandRing = new THREE.Mesh(
        new THREE.RingGeometry(0.68, 0.74, 36),
        new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    bayStandRing.rotation.x = -Math.PI / 2;
    bayStandRing.position.set(1.62, 0.006, 2.25);
    shop.add(bayStandRing);

    // 2. Architectural Garage Walls + Open Drive-Through Entrance (-X) & Exit (+X) Bay Doors
    const matWallTop = new THREE.MeshStandardMaterial({ color: 0x2a323f, roughness: 0.86, side: THREE.FrontSide });
    const matWallBot = new THREE.MeshStandardMaterial({ color: 0x191f29, roughness: 0.76, side: THREE.FrontSide });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x141820, metalness: 0.55, roughness: 0.44 });
    const matLiftBlue = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.5, roughness: 0.36 });
    const matToolRed = new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.45, roughness: 0.34 });
    const matChrome = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.22 });
    const matSlat = new THREE.MeshStandardMaterial({ color: 0x222934, metalness: 0.4, roughness: 0.5 });

    const addInwardWall = (w, h, x, y, z, ry, mat) => {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(x, y, z);
        mesh.rotation.y = ry;
        mesh.receiveShadow = true;
        shop.add(mesh);
    };

    // Back (-Z) and Front (+Z) full walls
    [
        { w: W, x: 0, z: -D / 2, ry: 0 },
        { w: W, x: 0, z: D / 2, ry: Math.PI },
    ].forEach(({ w, x, z, ry }) => {
        addInwardWall(w, H - 1.55, x, 1.55 + (H - 1.55) / 2, z, ry, matWallTop);
        addInwardWall(w, 1.55, x, 0.775, z, ry, matWallBot);
        addInwardWall(w, 0.065, x, 1.56, z + Math.cos(ry) * 0.03, ry, matSafety);
    });

    // Left Entrance (-W/2) & Right Exit (+W/2) Drive-Through Service Bay Openings
    const doorW = 5.4;
    const doorH = 4.4;
    const sideSpan = (D - doorW) / 2;

    [
        { x: -W / 2, ry: Math.PI / 2, inward: 1 },
        { x: W / 2, ry: -Math.PI / 2, inward: -1 },
    ].forEach(({ x, ry, inward }) => {
        // Wall piers flanking the open bay doorway
        [-D / 2 + sideSpan / 2, D / 2 - sideSpan / 2].forEach((zPos) => {
            addInwardWall(sideSpan, H - 1.55, x, 1.55 + (H - 1.55) / 2, zPos, ry, matWallTop);
            addInwardWall(sideSpan, 1.55, x, 0.775, zPos, ry, matWallBot);
            addInwardWall(sideSpan, 0.065, x + inward * 0.03, 1.56, zPos, ry, matSafety);
        });

        // Wall header above the open doorway
        addInwardWall(doorW, H - doorH, x, doorH + (H - doorH) / 2, 0, ry, matWallTop);

        // Steel door frame jambs, top lintel & raised roll-up door drum
        [-doorW / 2, doorW / 2].forEach((z) => {
            const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.28, doorH, 0.22), matSteel);
            jamb.position.set(x + inward * 0.08, doorH / 2, z);
            shop.add(jamb);

            // Industrial safety bollard guarding the doorway corner
            const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.95, 14), matBollard);
            bollard.position.set(x + inward * 0.45, 0.475, z + (z > 0 ? 0.28 : -0.28));
            shop.add(bollard);
        });

        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, doorW + 0.44), matSteel);
        lintel.position.set(x + inward * 0.08, doorH + 0.06, 0);
        shop.add(lintel);

        const rollDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, doorW + 0.2, 16), matSlat);
        rollDrum.rotation.x = Math.PI / 2;
        rollDrum.position.set(x + inward * 0.34, doorH + 0.26, 0);
        shop.add(rollDrum);

        // Bottom edge of raised roll-up door peeking cleanly under the header
        const raisedBottomSlat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, doorW - 0.08), matSlat);
        raisedBottomSlat.position.set(x + inward * 0.08, doorH - 0.14, 0);
        shop.add(raisedBottomSlat);

        // Dark exterior apron tunnel backdrop outside each doorway so vehicles arrive/depart smoothly
        const extBack = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 8),
            new THREE.MeshStandardMaterial({ color: 0x0d121a, roughness: 0.95 })
        );
        extBack.position.set(x - inward * 12.5, 4.0, 0);
        extBack.rotation.y = ry;
        shop.add(extBack);
    });

    // Closed bay door on Back Wall (-Z) for workshop depth
    const backDoor = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.85, 0.14), matSlat);
    backDoor.position.set(0.8, 1.92, -D / 2 + 0.08);
    shop.add(backDoor);
    for (let i = 0; i < 6; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(5.65, 0.05, 0.18), matSteel);
        rib.position.set(0.8, 0.55 + i * 0.62, -D / 2 + 0.1);
        shop.add(rib);
    }
    const matPane = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x475569, emissiveIntensity: 0.45 });
    [-1.0, 0.2, 1.4, 2.6].forEach((wx) => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.17), matPane);
        p.position.set(wx, 2.86, -D / 2 + 0.1);
        shop.add(p);
    });

    // Ceiling + 6 linear industrial LED shop fixtures + balanced bay lights
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(W, D),
        new THREE.MeshStandardMaterial({ color: 0x161b23, roughness: 0.9, side: THREE.FrontSide })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, H, 0);
    shop.add(ceiling);

    const matLed = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe2e8f0, emissiveIntensity: 1.35 });
    [-5.6, 0, 5.6].forEach((lx) => {
        const truss = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, D - 0.6), matSteel);
        truss.position.set(lx, H - 0.16, 0);
        shop.add(truss);

        [-3.2, 3.2].forEach((lz) => {
            const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 2.8), matSteel);
            housing.position.set(lx, H - 0.34, lz);
            shop.add(housing);

            const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 2.66), matLed);
            panel.rotation.x = Math.PI / 2;
            panel.position.set(lx, H - 0.39, lz);
            shop.add(panel);

            const pt = new THREE.PointLight(0xf1f5f9, 8.5, 19, 1.7);
            pt.position.set(lx, H - 0.65, lz);
            shop.add(pt);
        });
    });

    // 3. Two-Post Hydraulic Lift
    const liftX = -0.45;
    [-3.85, 3.85].forEach((zPos, idx) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.5, 0.32), matLiftBlue);
        post.position.set(liftX, 2.25, zPos);
        post.castShadow = true;
        shop.add(post);

        const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.7, 0.42), matSteel);
        carriage.position.set(liftX, 0.85, zPos + (idx === 0 ? 0.08 : -0.08));
        shop.add(carriage);

        const dir = idx === 0 ? 1 : -1;
        [-0.52, 0.52].forEach((ox) => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.12), matLiftBlue);
            arm.position.set(liftX + ox, 0.16, zPos + dir * 0.26);
            arm.rotation.y = (ox < 0 ? 1 : -1) * dir * 0.22;
            shop.add(arm);
        });
    });
    const liftBeam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 7.9), matLiftBlue);
    liftBeam.position.set(liftX, 4.48, 0);
    shop.add(liftBeam);

    // 4. Red Tool Cabinet, Oil Drums & Diagnostic Workbench against Back Wall
    const chest = new THREE.Group();
    chest.position.set(-5.8, 0, -D / 2 + 0.85);
    const cBody = new THREE.Mesh(new THREE.BoxGeometry(1.68, 1.08, 0.68), matToolRed);
    cBody.position.y = 0.6;
    cBody.castShadow = true;
    chest.add(cBody);
    const cTop = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 0.72), matSteel);
    cTop.position.y = 1.17;
    chest.add(cTop);
    for (let d = 0; d < 5; d++) {
        const hdl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.028, 0.04), matChrome);
        hdl.position.set(0, 0.26 + d * 0.175, 0.35);
        chest.add(hdl);
    }
    shop.add(chest);

    [-7.5, -8.3].forEach((ox, idx) => {
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 20), idx === 0 ? matLiftBlue : matSteel);
        drum.position.set(ox, 0.44, -D / 2 + 0.85);
        drum.castShadow = true;
        shop.add(drum);
    });

    const bench = new THREE.Group();
    bench.position.set(6.8, 0, -D / 2 + 0.85);
    const bTop = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.08, 0.8), matChrome);
    bTop.position.y = 0.96;
    bench.add(bTop);
    [[-0.88, -0.33], [0.88, -0.33], [-0.88, 0.33], [0.88, 0.33]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, 0.08), matSteel);
        leg.position.set(lx, 0.48, lz);
        bench.add(leg);
    });
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.46, 0.05), matSteel);
    mon.position.set(0, 1.38, -0.1);
    bench.add(mon);
    const scr = new THREE.Mesh(
        new THREE.PlaneGeometry(0.68, 0.38),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.45 })
    );
    scr.position.set(0, 1.38, -0.07);
    bench.add(scr);
    shop.add(bench);

    return { bayStandRing, roomBounds: ROOM_BOUNDS };
}

export async function applyWorkshopHDRI(renderer, scene) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x161c26);

    const floorBounce = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 26),
        new THREE.MeshBasicMaterial({ color: 0x202733, side: THREE.DoubleSide })
    );
    floorBounce.position.set(0, -4, 0);
    floorBounce.rotation.x = -Math.PI / 2;
    envScene.add(floorBounce);

    [-4.8, 0, 4.8].forEach((x) => {
        const strip = new THREE.Mesh(
            new THREE.PlaneGeometry(0.85, 10),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 3.7), side: THREE.DoubleSide })
        );
        strip.position.set(x, 7.2, 0);
        strip.rotation.x = Math.PI / 2;
        envScene.add(strip);
    });

    const sideFill = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 2.4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.25, 1.45), side: THREE.DoubleSide })
    );
    sideFill.position.set(0, 2.8, 9.5);
    sideFill.rotation.y = Math.PI;
    envScene.add(sideFill);

    scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.85;

    try {
        const head = await fetch('/assets/models/studio.hdr', { method: 'HEAD' });
        if (head.ok) {
            const mod = await import('three/addons/loaders/HDRLoader.js').catch(() =>
                import('three/addons/loaders/RGBELoader.js')
            );
            const Ctor = mod.HDRLoader || mod.RGBELoader;
            if (Ctor) {
                const hdr = await new Ctor().loadAsync('/assets/models/studio.hdr');
                hdr.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = pmrem.fromEquirectangular(hdr).texture;
                hdr.dispose();
            }
        }
    } catch {
        // Built-in studio-workshop HDRI remains active
    } finally {
        pmrem.dispose();
    }
}