import * as THREE from 'three';
import { parameter } from './parameters.js';

const TAU = Math.PI * 2;
const IVORY = 0xd8d2bd;
const ORANGE = 0xe66b36;

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.18, ...options });
}

function mesh(geometry, mat, parent, position = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...position);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function cylinderBetween(a, b, radius, mat, parent, segments = 8) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const item = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), segments), mat, parent);
  item.position.copy(start).add(end).multiplyScalar(0.5);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return item;
}

function createDockingProbe() {
  const group = new THREE.Group();
  group.name = 'Forward docking tunnel and probe';
  const metal = material(0x9c998b, { metalness: 0.72, roughness: 0.34 });
  const dark = material(0x343737, { metalness: 0.55 });
  mesh(new THREE.CylinderGeometry(0.39, 0.42, 0.22, 48), metal, group, [0, 1.43, 0]);
  const ring = mesh(new THREE.TorusGeometry(0.39, 0.035, 10, 48), dark, group, [0, 1.56, 0]);
  ring.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.46, 16), metal, group, [0, 1.79, 0]);
  mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.13, 16), metal, group, [0, 2.04, 0]);
  const head = mesh(new THREE.SphereGeometry(0.115, 20, 12), dark, group, [0, 2.12, 0]);
  head.scale.y = 0.55;
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    cylinderBetween([Math.cos(a) * 0.1, 1.91, Math.sin(a) * 0.1], [Math.cos(a) * 0.2, 1.84, Math.sin(a) * 0.2], 0.012, metal, group, 6);
  }
  return group;
}

function createLaunchAssembly() {
  const group = new THREE.Group();
  group.name = 'Boost protective cover and launch escape system';
  const cover = material(0xd9d8ce, { roughness: 0.48, metalness: 0.32 });
  const tower = material(0x9c9b91, { metalness: 0.75, roughness: 0.35 });
  const dark = material(0x2c3031, { metalness: 0.65 });
  const red = material(0x9e3f2d, { roughness: 0.6 });

  mesh(new THREE.CylinderGeometry(0.42, 1.965, 3.05, 96, 1, false), cover, group, [0, 0.05, 0]);
  const aft = mesh(new THREE.SphereGeometry(1.96, 64, 20, 0, TAU, Math.PI / 2, Math.PI / 2), cover, group, [0, -1.43, 0]);
  aft.scale.y = 0.16;
  mesh(new THREE.CylinderGeometry(0.39, 0.43, 0.25, 48), cover, group, [0, 1.68, 0]);

  const lowerY = 1.72;
  const upperY = 5.15;
  const legs = 4;
  for (let i = 0; i < legs; i++) {
    const a = i * TAU / legs + Math.PI / 4;
    const b = (i + 1) * TAU / legs + Math.PI / 4;
    const low = [Math.cos(a) * 0.52, lowerY, Math.sin(a) * 0.52];
    const high = [Math.cos(a) * 0.3, upperY, Math.sin(a) * 0.3];
    cylinderBetween(low, high, 0.035, tower, group);
    for (let rung = 0; rung < 4; rung++) {
      const t0 = rung / 4;
      const t1 = (rung + 1) / 4;
      const p0 = low.map((v, axis) => v + (high[axis] - v) * t0);
      const p1 = low.map((v, axis) => v + (high[axis] - v) * t1);
      const nextLow = [Math.cos(b) * 0.52, lowerY, Math.sin(b) * 0.52];
      const nextHigh = [Math.cos(b) * 0.3, upperY, Math.sin(b) * 0.3];
      const q1 = nextLow.map((v, axis) => v + (nextHigh[axis] - v) * t1);
      const q0 = nextLow.map((v, axis) => v + (nextHigh[axis] - v) * t0);
      cylinderBetween(p0, q1, 0.017, tower, group, 6);
      cylinderBetween(q0, p1, 0.017, tower, group, 6);
    }
  }
  mesh(new THREE.CylinderGeometry(0.29, 0.38, 0.48, 32), tower, group, [0, 5.28, 0]);
  mesh(new THREE.CylinderGeometry(0.26, 0.29, 3.25, 32), cover, group, [0, 7.05, 0]);
  mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.65, 32), red, group, [0, 8.99, 0]);
  mesh(new THREE.ConeGeometry(0.19, 1.35, 32), cover, group, [0, 9.99, 0]);
  mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.65, 16), dark, group, [0, 10.93, 0]);
  mesh(new THREE.ConeGeometry(0.055, 0.35, 16), dark, group, [0, 11.42, 0]);
  for (const side of [-1, 1]) {
    const canard = mesh(new THREE.BoxGeometry(0.78, 0.58, 0.045), cover, group, [side * 0.46, 9.03, 0]);
    canard.rotation.z = side * -0.42;
  }
  group.visible = false;
  return group;
}

function createCouch(x) {
  const couch = new THREE.Group();
  couch.position.set(x, -0.25, 0.1);
  const fabric = material(0xb9b39e, { roughness: 0.95, metalness: 0 });
  const frame = material(0x777b75, { metalness: 0.6 });
  const back = mesh(new THREE.BoxGeometry(0.53, 0.82, 0.12), fabric, couch, [0, 0.12, 0]);
  back.rotation.x = -0.27;
  mesh(new THREE.BoxGeometry(0.48, 0.17, 0.18), fabric, couch, [0, 0.63, -0.09]);
  const seat = mesh(new THREE.BoxGeometry(0.53, 0.12, 0.5), fabric, couch, [0, -0.38, 0.21]);
  seat.rotation.x = 0.12;
  for (const side of [-1, 1]) {
    cylinderBetween([side * 0.3, -0.45, -0.08], [side * 0.3, 0.58, -0.25], 0.018, frame, couch, 6);
  }
  const harness = material(0x69533c, { roughness: 0.9, metalness: 0 });
  const strap = mesh(new THREE.BoxGeometry(0.055, 0.72, 0.015), harness, couch, [0, 0.1, 0.075]);
  strap.rotation.x = -0.27;
  return couch;
}

function createInterior() {
  const group = new THREE.Group();
  group.name = 'Schematic crew compartment';
  for (const x of [-0.66, 0, 0.66]) group.add(createCouch(x));
  const panel = new THREE.Group();
  panel.position.set(0, 0.58, -0.52);
  panel.rotation.x = -0.16;
  group.add(panel);
  const panelMat = material(0x626761, { metalness: 0.38, roughness: 0.6 });
  const dark = material(0x151b1b, { roughness: 0.48 });
  const lit = material(0xa7c7b0, { emissive: 0x365c47, emissiveIntensity: 0.65, roughness: 0.45 });
  mesh(new THREE.BoxGeometry(2.12, 0.72, 0.13), panelMat, panel);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 16; col++) {
      const x = -0.96 + col * 0.128;
      const y = -0.26 + row * 0.16;
      if ((col + row * 3) % 5 === 0) {
        const screen = mesh(new THREE.BoxGeometry(0.075, 0.065, 0.012), (col % 2 ? lit : dark), panel, [x, y, 0.073]);
        screen.castShadow = false;
      } else {
        const toggle = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.035, 6), (col + row) % 3 ? dark : lit, panel, [x, y, 0.083]);
        toggle.rotation.x = Math.PI / 2;
        toggle.castShadow = false;
      }
    }
  }
  const bayMat = material(0x85897d, { metalness: 0.42 });
  for (let i = 0; i < 5; i++) {
    mesh(new THREE.BoxGeometry(0.3, 0.38, 0.42), bayMat, group, [-0.68 + i * 0.34, -0.93, -0.18]);
  }
  group.visible = false;
  return group;
}

function createSystems() {
  const group = new THREE.Group();
  group.name = 'Schematic subsystem layout';
  const chuteMat = material(0xd78943, { emissive: 0x4b230b, emissiveIntensity: 0.4 });
  const tankMat = material(0x69a9a8, { metalness: 0.58, roughness: 0.35 });
  const batteryMat = material(0xb7a74f, { metalness: 0.35 });
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.34, 16), chuteMat, group, [Math.cos(a) * 0.42, 1.02, Math.sin(a) * 0.42]);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    const tank = mesh(new THREE.SphereGeometry(0.16, 16, 10), tankMat, group, [Math.cos(a) * 1.48, -0.77, Math.sin(a) * 1.48]);
    tank.scale.y = 1.45;
  }
  for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.28, 0.18, 0.34), batteryMat, group, [-0.34 + i * 0.34, -0.98, 0.66]);
  group.visible = false;
  return group;
}

function createRCS() {
  const group = new THREE.Group();
  const jets = [];
  const nozzleMat = material(0x383c3b, { metalness: 0.8, roughness: 0.28 });
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0xb8e7ef, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  const locations = [];
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5;
    locations.push({ a, y: -0.72 }, { a: a + 0.12, y: -0.72 });
  }
  locations.push({ a: 0.8, y: 1.04 }, { a: 3.95, y: 1.04 });
  locations.forEach(({ a, y }) => {
    const dir = new THREE.Vector3(Math.cos(a), 0.12, Math.sin(a)).normalize();
    const r = y < 0 ? 1.72 : 0.55;
    const origin = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const nozzle = mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.12, 12), nozzleMat, group);
    nozzle.position.copy(origin);
    nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const plume = mesh(new THREE.ConeGeometry(0.09, 0.72, 12, 1, true), plumeMat, group);
    plume.position.copy(origin).addScaledVector(dir, 0.42);
    plume.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    plume.visible = false;
    plume.castShadow = false;
    jets.push(plume);
  });
  return { group, jets };
}

function createPlasma() {
  const count = 520;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = [];
  const hot = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const s1 = ((i * 16807) % 2147483647) / 2147483647;
    const s2 = ((i * 48271 + 17) % 2147483647) / 2147483647;
    seeds.push([s1, s2]);
    hot.setHSL(0.025 + s2 * 0.09, 1, 0.52 + s1 * 0.28);
    colors.set([hot.r, hot.g, hot.b], i * 3);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.095, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff5b18, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const glow = mesh(new THREE.SphereGeometry(2.06, 48, 20, 0, TAU, Math.PI / 2, Math.PI / 2), glowMat, group, [0, -1.24, 0]);
  glow.scale.y = 0.24;
  glow.castShadow = false;
  group.visible = false;
  function update(t, intensity) {
    group.visible = intensity > 0.005;
    if (!group.visible) return;
    for (let i = 0; i < count; i++) {
      const [aSeed, pSeed] = seeds[i];
      const p = (pSeed + t * (0.42 + aSeed * 0.4)) % 1;
      const angle = aSeed * TAU + p * 2.4;
      const radius = (1.9 - p * 0.85) * (0.9 + pSeed * 0.16);
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = -1.32 + p * 5.2;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    geometry.attributes.position.needsUpdate = true;
    points.material.opacity = 0.45 + intensity * 0.55;
    glow.material.opacity = intensity * (0.38 + Math.sin(t * 9) * 0.04);
  }
  return { group, update };
}

export function createSpacecraft() {
  const capsule = new THREE.Group();
  capsule.name = 'Apollo Command Module CM-107';
  const scanSlot = new THREE.Group();
  capsule.add(scanSlot);
  const dockingProbe = createDockingProbe();
  capsule.add(dockingProbe);
  const launchGroup = createLaunchAssembly();
  capsule.add(launchGroup);
  const interior = createInterior();
  capsule.add(interior);
  const systems = createSystems();
  capsule.add(systems);
  const rcs = createRCS();
  capsule.add(rcs.group);
  const plasma = createPlasma();
  capsule.add(plasma.group);
  return { capsule, scanSlot, dockingProbe, launchGroup, interior, systems, rcs, plasma };
}

function canopyGeometry(radius, panels, conical = false) {
  const positions = [];
  const indices = [];
  const groups = [];
  const rings = 5;
  for (let panel = 0; panel < panels; panel++) {
    const startIndex = indices.length;
    const phi0 = panel * TAU / panels;
    const phi1 = (panel + 0.96) * TAU / panels;
    for (let ring = 0; ring < rings; ring++) {
      const theta0 = 0.08 + ring * 0.265;
      const theta1 = theta0 + 0.235;
      const base = positions.length / 3;
      for (let y = 0; y <= 2; y++) {
        const theta = theta0 + (theta1 - theta0) * y / 2;
        for (let x = 0; x <= 2; x++) {
          const phi = phi0 + (phi1 - phi0) * x / 2;
          const billow = 1 + 0.018 * Math.sin((panel % 2) * Math.PI + theta * 3);
          positions.push(radius * Math.sin(theta) * Math.cos(phi) * billow, radius * Math.cos(theta) * (conical ? 0.86 : 0.58), radius * Math.sin(theta) * Math.sin(phi) * billow);
        }
      }
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        const a = base + y * 3 + x;
        const b = a + 3;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    groups.push({ start: startIndex, count: indices.length - startIndex, materialIndex: panel % 2 });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  groups.forEach((g) => geometry.addGroup(g.start, g.count, g.materialIndex));
  geometry.computeVertexNormals();
  return geometry;
}

function createCanopy(radius, panels = 48, conical = false) {
  const group = new THREE.Group();
  const white = material(0xe1dbc8, { side: THREE.DoubleSide, roughness: 0.96, metalness: 0 });
  const orange = material(ORANGE, { side: THREE.DoubleSide, roughness: 0.96, metalness: 0 });
  const canopy = mesh(canopyGeometry(radius, panels, conical), [white, orange], group);
  canopy.castShadow = false;
  const rimRadius = radius * Math.sin(1.375);
  const rimY = radius * Math.cos(1.375) * (conical ? 0.86 : 0.58);
  const rim = mesh(new THREE.TorusGeometry(rimRadius, radius * 0.0025, 5, 64), material(0xb9b4a4, { roughness: 0.9 }), group, [0, rimY, 0]);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = false;
  return { group, rimRadius, rimY };
}

function createParachuteSet(type) {
  const isMain = type === 'main';
  const group = new THREE.Group();
  const canopies = [];
  const linePoints = [];
  const count = isMain ? 3 : 2;
  const radius = parameter(isMain ? 'els.mainRadius' : 'els.drogueRadius');
  const spread = isMain ? 11.2 : 3.0;
  const height = isMain ? 10.5 : 7.0;
  for (let i = 0; i < count; i++) {
    const a = i * TAU / count + (isMain ? Math.PI / 2 : 0);
    const center = new THREE.Vector3(Math.cos(a) * spread, height + (i === 2 ? 0.8 : 0), Math.sin(a) * spread * 0.62);
    const canopy = createCanopy(radius, isMain ? 48 : 32, !isMain);
    canopy.group.position.copy(center);
    group.add(canopy.group);
    canopies.push(canopy);
    for (let line = 0; line < 24; line++) {
      const angle = line * TAU / 24;
      linePoints.push(center.x + Math.cos(angle) * canopy.rimRadius, center.y + canopy.rimY, center.z + Math.sin(angle) * canopy.rimRadius, 0, 2.05, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: IVORY, transparent: true, opacity: 0.72 }));
  group.add(lines);
  group.visible = false;
  return group;
}

export function createParachutes() {
  return { mains: createParachuteSet('main'), drogues: createParachuteSet('drogue') };
}
