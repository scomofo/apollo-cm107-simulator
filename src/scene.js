import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSpacecraft, createParachutes } from './spacecraft.js';
import { createEnvironments } from './environment.js';
import { ApolloRuntime } from './runtime.js';
import { parameter, parameterText, PARAMETERS, SOURCES } from './parameters.js';
import { CHECKLISTS, checklist, checklistStep } from './checklists.js';

const DURATION = parameter('presentation.phaseDuration');
const TAU = Math.PI * 2;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const viewport = $('#viewport');
const runtime = new ApolloRuntime();
const sim = runtime.state;
let presentedPhase = null;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', 'Three-dimensional Apollo Command Module simulator');
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080d12);
const camera = new THREE.PerspectiveCamera(39, viewport.clientWidth / viewport.clientHeight, 0.025, 420);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 3.2;
controls.maxDistance = 130;
controls.maxPolarAngle = Math.PI * 0.94;
controls.autoRotateSpeed = 0.65;

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
scene.environmentIntensity = 0.55;
room.dispose();
pmrem.dispose();

const hemisphere = new THREE.HemisphereLight(0xbfd7e5, 0x34251e, 1.35);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xffe4bf, 3.2);
sun.position.set(-5, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 45;
sun.shadow.normalBias = 0.025;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x91b9d9, 1.75);
fill.position.set(6, 1, -5);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xe7f3f5, 1.25);
rim.position.set(-4, 2, -7);
scene.add(rim);
const plasmaLight = new THREE.PointLight(0xff4b12, 0, 9, 1.6);
scene.add(plasmaLight);

const craft = createSpacecraft();
scene.add(craft.capsule);
const parachutes = createParachutes();
scene.add(parachutes.mains, parachutes.drogues);
const environments = createEnvironments(scene);

const forwardShield = new THREE.Mesh(
  new THREE.CylinderGeometry(0.72, 0.76, 0.09, 48),
  new THREE.MeshStandardMaterial({ color: 0x50463a, roughness: 0.9, metalness: 0.08 }),
);
forwardShield.position.y = 1.43;
forwardShield.castShadow = true;
craft.capsule.add(forwardShield);
forwardShield.visible = false;

const foamGroup = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.75 + i * 0.65, 1.79 + i * 0.65, 72),
    new THREE.MeshBasicMaterial({ color: 0xc3d7d2, transparent: true, opacity: 0.22 - i * 0.045, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.405 + i * 0.003;
  foamGroup.add(ring);
}
scene.add(foamGroup);
foamGroup.visible = false;

const phases = {
  launch: {
    title: 'LAUNCH ESCAPE CONFIGURATION', subtitle: 'Boost protective cover · tower jettison', timeline: 'LAUNCH / TOWER JETTISON',
    camera: [12.5, 7.8, 21], target: [0, 5.1, 0],
  },
  coast: {
    title: 'TRANS-EARTH COAST', subtitle: 'Command module in free flight', timeline: 'TRANS-EARTH COAST',
    camera: [4.6, 2.25, 5.7], target: [0, 0.18, 0],
  },
  entry: {
    title: 'ENTRY INTERFACE · 400,000 FT', subtitle: 'Ablative heat shield · lifting entry attitude', timeline: 'ATMOSPHERIC ENTRY',
    camera: [4.9, 1.55, 5.9], target: [0, -0.05, 0],
  },
  drogue: {
    title: 'FORWARD HEAT SHIELD JETTISON', subtitle: 'Two 5.0 m conical ribbon drogues', timeline: 'DROGUE DEPLOYMENT',
    camera: [12, 5.5, 17], target: [0, 3.65, 0],
  },
  mains: {
    title: 'THREE RINGSAIL MAIN PARACHUTES', subtitle: '83.5 ft / 25.5 m diameter per canopy', timeline: 'MAIN PARACHUTE DESCENT',
    camera: [0, 27, 66], target: [0, 8.4, 0],
  },
  splash: {
    title: 'PACIFIC SPLASHDOWN', subtitle: '24 July 1969 · recovery configuration', timeline: 'SPLASHDOWN / RECOVERY',
    camera: [5.1, 2.35, 6.4], target: [0, 0.05, 0],
  },
};
const phaseOrder = Object.keys(phases);
let labelsVisible = true;
let scanLoaded = false;

const components = {
  command: {
    name: 'COMMAND MODULE',
    description: 'The only Apollo spacecraft section to return to Earth. CM-107 <em>Columbia</em> carried Armstrong, Aldrin and Collins home in July 1969.',
    specs: [['BASE Ø', '3.91 m'], ['HEIGHT', '3.48 m'], ['CREW', '3'], ['LAUNCH MASS', '5,560 kg']],
  },
  heatshield: {
    name: 'AFT HEAT SHIELD',
    description: 'Ablative Avcoat honeycomb protected the crew from lunar-return heating. The charred surface in the scan records Columbia’s actual re-entry.',
    specs: [['MATERIAL', 'AVCOAT'], ['THICKNESS', '1.8–6.9 cm'], ['ENTRY SPEED', '≈11 km/s'], ['PEAK HEATING', '≈2,760 °C']],
  },
  hatch: {
    name: 'UNIFIED CREW HATCH',
    description: 'The Block II quick-opening hatch integrated the pressure and heat-shield barriers. The Smithsonian scan preserves the open museum configuration.',
    specs: [['WIDTH', '0.86 m'], ['HEIGHT', '0.74 m'], ['LATCHES', '15'], ['MASS', '102 kg']],
  },
  windows: {
    name: 'FIVE-WINDOW ARRAY',
    description: 'Two side windows, two triangular rendezvous windows and one circular hatch window. Each assembly used three panes for pressure and thermal protection.',
    specs: [['SIDE WINDOWS', '2'], ['RENDEZVOUS', '2'], ['HATCH WINDOW', '1'], ['PANES EACH', '3']],
  },
  forward: {
    name: 'FORWARD COMPARTMENT',
    description: 'Four bays around the docking tunnel held the Earth Landing System: two drogues, three pilot parachutes and three main ringsails.',
    specs: [['DROGUES', '2 × 5.0 m'], ['PILOT CHUTES', '3'], ['MAIN CHUTES', '3 × 25.5 m'], ['JETTISON', '≈7.3 km']],
  },
  rcs: {
    name: 'REACTION CONTROL SYSTEM',
    description: 'Twelve hypergolic thrusters controlled capsule attitude after service-module separation. Ten were aft; two were in the forward compartment.',
    specs: [['ENGINES', '12'], ['THRUST EACH', '410 N'], ['FUEL', 'MMH'], ['OXIDIZER', 'N₂O₄']],
  },
  docking: {
    name: 'DOCKING PROBE',
    description: 'The probe engaged the Lunar Module drogue during rendezvous. Its reconstruction restores equipment absent from the displayed museum artifact.',
    specs: [['TUNNEL HATCH Ø', '0.76 m'], ['FUNCTION', 'LM DOCKING'], ['CAPTURE', 'PROBE / DROGUE'], ['CREW TRANSFER', '3']],
  },
  couches: {
    name: 'CREW COUCHES',
    description: 'Three contoured couches supported the crew during boost and entry. This X-ray arrangement is schematic; the exterior scan remains to scale.',
    specs: [['POSITIONS', 'CDR · CMP · LMP'], ['COUNT', '3'], ['CABIN VOLUME', '6.2 m³'], ['DISPLAY WIDTH', '2.1 m']],
  },
  console: {
    name: 'MAIN DISPLAY CONSOLE',
    description: 'A crescent-shaped panel placed guidance, navigation, propulsion and environmental controls in front of the three crew stations.',
    specs: [['WIDTH', '≈2.1 m'], ['HEIGHT', '≈0.91 m'], ['SWITCHES', '566'], ['INSTRUMENTS', '24']],
  },
};

const hotspotDefinitions = [
  { id: 'heatshield', label: 'AFT HEAT SHIELD', point: [0.2, -1.34, 0.45], normal: [0, -1, 0.2], views: ['exterior'] },
  { id: 'hatch', label: 'UNIFIED CREW HATCH', point: [0.68, 0.02, 1.43], normal: [0.2, 0, 1], views: ['exterior'] },
  { id: 'windows', label: 'FIVE-WINDOW ARRAY', point: [-0.64, 0.34, 1.32], normal: [-0.2, 0.1, 1], views: ['exterior'] },
  { id: 'forward', label: 'EARTH LANDING SYSTEM', point: [0.52, 1.05, 0.45], normal: [0.4, 0.7, 0.5], views: ['exterior', 'systems'] },
  { id: 'rcs', label: 'RCS THRUSTERS', point: [1.68, -0.7, 0.28], normal: [1, 0, 0.2], views: ['exterior', 'systems'] },
  { id: 'docking', label: 'DOCKING PROBE', point: [0, 2.02, 0], normal: [0, 1, 0.2], views: ['exterior'] },
  { id: 'couches', label: 'CREW COUCHES', point: [0, -0.05, 0.45], normal: [0, 0.2, 1], views: ['xray'] },
  { id: 'console', label: 'MAIN DISPLAY CONSOLE', point: [0, 0.63, -0.42], normal: [0, 0.1, 1], views: ['xray', 'systems'] },
];
const hotspotContainer = $('#hotspots');
for (const definition of hotspotDefinitions) {
  const button = document.createElement('button');
  button.className = 'hotspot';
  button.dataset.component = definition.id;
  button.setAttribute('aria-label', `Inspect ${definition.label.toLowerCase()}`);
  button.innerHTML = `<span class="hotspot-label">${definition.label}</span>`;
  button.addEventListener('click', () => selectComponent(definition.id));
  hotspotContainer.appendChild(button);
  definition.element = button;
  definition.vector = new THREE.Vector3(...definition.point);
  definition.normalVector = new THREE.Vector3(...definition.normal).normalize();
}

function selectComponent(id) {
  const component = components[id] || components.command;
  $('#component-name').textContent = component.name;
  $('#component-description').innerHTML = component.description;
  $('#spec-grid').innerHTML = component.specs.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');
  hotspotDefinitions.forEach((item) => item.element.classList.toggle('active', item.id === id));
  if (window.innerWidth <= 800) $('#telemetry-panel').classList.add('open');
}

const CHECKPOINT_KEY = 'apollo-cm107-checkpoint-v1';
let checklistSignature = '';

function notify(message) {
  const toast = document.createElement('div');
  toast.className = 'rcs-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  viewport.appendChild(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function toggleChecklist(force) {
  const open = typeof force === 'boolean' ? force : !$('#checklist-panel').classList.contains('open');
  $('#checklist-panel').classList.toggle('open', open);
  $('#checklist-toggle').setAttribute('aria-pressed', String(open));
  if (open) renderChecklist();
}

function renderChecklist() {
  const guide = checklist(sim.checklist.guide);
  const step = checklistStep(sim);
  const signature = `${sim.checklist.guide}:${sim.checklist.index}:${sim.checklist.completed.length}`;
  $('#checklist-select').value = sim.checklist.guide;
  $('#checklist-description').textContent = guide.description;
  $('#checklist-progress-label').textContent = `${Math.min(sim.checklist.index, guide.steps.length)} / ${guide.steps.length}`;
  $('#checklist-progress-bar').style.width = `${sim.checklist.index / guide.steps.length * 100}%`;
  if (signature === checklistSignature) return;
  checklistSignature = signature;
  $('#checklist-steps').innerHTML = guide.steps.map((item, index) => {
    const status = index < sim.checklist.index ? 'complete' : index === sim.checklist.index ? 'current' : '';
    const marker = index < sim.checklist.index ? '✓' : String(index + 1).padStart(2, '0');
    return `<li class="${status}"><span>${marker}</span><div>${item.title}</div></li>`;
  }).join('');
  $('#checklist-detail').textContent = step ? step.detail : 'Checklist complete. You can save a checkpoint or replay the recorded session.';
  $('#checklist-continue').hidden = !step || step.kind !== 'note';
  $('#checklist-locate').hidden = !step?.target;
}

function evaluateChecklist() {
  const step = checklistStep(sim);
  if (step && step.kind !== 'note' && step.when(sim)) {
    runtime.command('checklistAdvance', { step: step.id });
    renderChecklist();
  }
}

function saveCheckpoint() {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(runtime.snapshot()));
    $('#checkpoint-status').textContent = `Saved tick ${runtime.tick} · ${sim.phase} · ${sim.phaseTime.toFixed(2)} s`;
    notify('CHECKPOINT SAVED IN THIS BROWSER');
  } catch (error) {
    notify(`CHECKPOINT SAVE FAILED · ${error.message}`);
  }
}

function loadCheckpoint() {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) {
      notify('NO BROWSER CHECKPOINT AVAILABLE');
      return;
    }
    runtime.restore(JSON.parse(raw));
    presentedPhase = null;
    applyView(sim.view, false);
    syncPhase();
    syncPlayback();
    sample(sim.phaseTime);
    renderChecklist();
    $('#checkpoint-status').textContent = `Loaded tick ${runtime.tick} · ${sim.phase} · ${sim.phaseTime.toFixed(2)} s`;
    notify('CHECKPOINT RESTORED');
  } catch (error) {
    notify(`CHECKPOINT LOAD FAILED · ${error.message}`);
  }
}

function replaySession() {
  if (!runtime.startReplay()) {
    notify('NO RECORDED SESSION TO REPLAY');
    return;
  }
  presentedPhase = null;
  applyView(sim.view, false);
  syncPhase();
  syncPlayback();
  sample(sim.phaseTime);
  renderChecklist();
  notify('DETERMINISTIC REPLAY STARTED');
}

function locateChecklistControl() {
  const step = checklistStep(sim);
  if (!step?.target) return;
  const element = $(step.target);
  if (!element) return;
  if (window.innerWidth <= 800) {
    if (step.target === '#rcs-button' || step.target.includes('data-view')) $('#telemetry-panel').classList.add('open');
    toggleChecklist(false);
  }
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.classList.remove('control-locate');
  requestAnimationFrame(() => element.classList.add('control-locate'));
  window.setTimeout(() => element.classList.remove('control-locate'), 1400);
}

function renderParameters() {
  const filter = $('#parameter-filter').value;
  $('#parameter-table').innerHTML = Object.entries(PARAMETERS)
    .filter(([, entry]) => filter === 'all' || entry.confidence === filter)
    .map(([id, entry]) => {
      const source = SOURCES[entry.source];
      return `<div class="parameter-row"><div><strong>${entry.label}</strong><small>${entry.note}<br>${source.title} · ${source.locator}</small></div><span class="parameter-value">${entry.value.toLocaleString('en-US')} ${entry.unit}</span><span class="confidence ${entry.confidence}">${entry.confidence.toUpperCase()}</span></div>`;
    }).join('') || '<p>No parameters match this filter.</p>';
}

function applyMaterialMode(mode) {
  craft.scanSlot.traverse((object) => {
    if (!object.isMesh) return;
    if (!object.userData.originalMaterial) {
      object.userData.originalMaterial = object.material;
      const xray = object.material.clone();
      xray.transparent = true;
      xray.depthWrite = false;
      xray.side = THREE.DoubleSide;
      object.userData.xrayMaterial = xray;
    }
    if (mode === 'exterior') {
      object.material = object.userData.originalMaterial;
    } else {
      object.material = object.userData.xrayMaterial;
      object.material.opacity = mode === 'systems' ? 0.09 : 0.16;
    }
  });
}

function applyView(view, record = true) {
  if (!runtime.command('view', { view }, record)) return;
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === sim.view));
  craft.interior.visible = view !== 'exterior';
  craft.systems.visible = view === 'systems';
  applyMaterialMode(view);
  $('#view-badge-text').textContent = view === 'xray' ? 'CABIN X-RAY · SCHEMATIC' : view === 'systems' ? 'SUBSYSTEM LAYOUT' : 'EXTERIOR';
  updatePhaseGeometry(0);
}

function resetCamera() {
  const config = phases[sim.phase];
  const target = new THREE.Vector3(...config.target);
  const offset = new THREE.Vector3(...config.camera).sub(target);
  const narrowScreenFactor = Math.max(1, 0.92 / camera.aspect);
  camera.position.copy(target).addScaledVector(offset, narrowScreenFactor);
  controls.target.copy(target);
  controls.update();
}

function syncPhase() {
  if (presentedPhase === sim.phase) return;
  presentedPhase = sim.phase;
  const phase = sim.phase;
  $$('.phase-button').forEach((button) => button.classList.toggle('active', button.dataset.phase === phase));
  const config = phases[phase];
  $('#event-title').textContent = config.title;
  $('#event-subtitle').textContent = config.subtitle;
  $('#timeline-phase').textContent = config.timeline;
  environments.setPhase(phase);
  scene.background.set(phase === 'coast' || phase === 'entry' ? 0x080d12 : phase === 'drogue' ? 0x282b33 : 0x718c98);
  hemisphere.intensity = phase === 'coast' || phase === 'entry' ? 1.35 : 2.1;
  sun.intensity = phase === 'entry' ? 2.0 : 3.2;
  resetCamera();
  updatePhaseGeometry(0);
}

function setPhase(phase, record = true) {
  if (!phases[phase]) return;
  if (!runtime.command('setPhase', { phase }, record)) return;
  syncPhase();
  sample(sim.phaseTime);
}

function updatePhaseGeometry(progress) {
  const isLaunch = sim.phase === 'launch';
  const revealCapsule = isLaunch && progress > 0.68;
  craft.launchGroup.visible = isLaunch && sim.view === 'exterior' && !revealCapsule;
  craft.scanSlot.visible = !isLaunch || revealCapsule || sim.view !== 'exterior';
  craft.dockingProbe.visible = isLaunch && revealCapsule;
  if (isLaunch && progress > 0.68) {
    const p = (progress - 0.68) / 0.32;
    craft.launchGroup.visible = true;
    craft.launchGroup.position.set(p * 2.8, p * 8.5, 0);
    craft.launchGroup.rotation.z = -p * 0.35;
  } else {
    craft.launchGroup.position.set(0, 0, 0);
    craft.launchGroup.rotation.set(0, 0, 0);
  }
}

function smooth01(value) {
  const p = THREE.MathUtils.clamp(value, 0, 1);
  return p * p * (3 - 2 * p);
}

function sample(t) {
  const p = (((t % DURATION) + DURATION) % DURATION) / DURATION;
  const wave = Math.sin(p * TAU);
  craft.capsule.position.set(0, 0, 0);
  craft.capsule.rotation.set(0, 0, 0);
  parachutes.mains.visible = false;
  parachutes.drogues.visible = false;
  forwardShield.visible = false;
  foamGroup.visible = false;
  updatePhaseGeometry(p);

  if (sim.phase === 'launch') {
    craft.capsule.rotation.z = wave * 0.008;
  } else if (sim.phase === 'coast') {
    craft.capsule.rotation.z = -0.14 + wave * 0.035;
    craft.capsule.rotation.y = wave * 0.1;
  } else if (sim.phase === 'entry') {
    craft.capsule.rotation.z = -0.38 + wave * 0.035;
    craft.capsule.rotation.x = 0.1;
  } else if (sim.phase === 'drogue') {
    craft.capsule.rotation.z = wave * 0.085;
    parachutes.drogues.visible = true;
    const deploy = 0.05 + smooth01(p / 0.28) * 0.95;
    parachutes.drogues.scale.setScalar(deploy);
    forwardShield.visible = p < 0.62;
    forwardShield.position.set(p * 4.2, 1.43 + p * 5.8, -p * 1.5);
    forwardShield.rotation.z = p * 2.2;
  } else if (sim.phase === 'mains') {
    const deploy = 0.04 + smooth01(p / 0.38) * 0.96;
    parachutes.mains.visible = true;
    parachutes.mains.scale.setScalar(deploy);
    parachutes.drogues.visible = p < 0.28;
    parachutes.drogues.scale.setScalar(Math.max(0.03, 1 - p * 3.2));
    craft.capsule.rotation.z = THREE.MathUtils.degToRad(parameter('els.mainHangAngle')) * smooth01(p / 0.38) + wave * 0.025;
  } else if (sim.phase === 'splash') {
    craft.capsule.position.y = -0.58 + wave * 0.045;
    craft.capsule.rotation.z = 0.11 + wave * 0.025;
    craft.capsule.rotation.x = Math.sin(p * TAU * 2) * 0.016;
    foamGroup.visible = true;
    foamGroup.children.forEach((ring, index) => {
      const scale = 0.95 + ((p + index * 0.2) % 1) * 0.22;
      ring.scale.setScalar(scale);
    });
  }

  const entryIntensity = sim.phase === 'entry' ? Math.pow(Math.sin(Math.PI * p), 0.7) : 0;
  craft.plasma.update(t, entryIntensity);
  plasmaLight.intensity = entryIntensity * 42;
  plasmaLight.position.set(craft.capsule.position.x, craft.capsule.position.y - 1.65, craft.capsule.position.z + 0.4);
  craft.rcs.jets.forEach((jet, index) => {
    jet.visible = sim.rcsRemaining > 0 && (sim.phase === 'coast' || sim.phase === 'entry');
    if (jet.visible) jet.scale.y = 0.7 + 0.3 * Math.sin(t * 38 + index);
  });
  environments.update(t);
  updateTelemetry(p);
}

function lerp(a, b, p) { return a + (b - a) * p; }
function formatNumber(value, decimals = 0) {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function updateTelemetry(p) {
  let velocity;
  let velocityUnit;
  let altitude;
  let altitudeUnit = 'km';
  let altitudeLabel = 'ALTITUDE';
  let temp;
  let g;
  if (sim.phase === 'launch') {
    velocity = lerp(0, 3.2, p); velocityUnit = 'km/s';
    altitude = lerp(0, 90, p); temp = lerp(20, 180, p); g = 1 + Math.sin(p * Math.PI) * 2.8;
  } else if (sim.phase === 'coast') {
    velocity = 10.8; velocityUnit = 'km/s';
    altitude = 184000 - p * 1200; altitudeLabel = 'EARTH RANGE'; temp = 20; g = 0;
  } else if (sim.phase === 'entry') {
    velocity = lerp(11, 0.2, smooth01(p)); velocityUnit = 'km/s';
    altitude = lerp(120, 24, p); temp = 20 + Math.sin(p * Math.PI) * 2740; g = Math.sin(p * Math.PI) * 6.5;
  } else if (sim.phase === 'drogue') {
    velocity = lerp(200, 56, p); velocityUnit = 'm/s';
    altitude = lerp(7.3, 3.3, p); temp = lerp(180, 80, p); g = 1 + Math.sin(p * Math.PI) * 0.6;
  } else if (sim.phase === 'mains') {
    velocity = lerp(56, 8.5, smooth01(p)); velocityUnit = 'm/s';
    altitude = lerp(3300, 0, p); altitudeUnit = 'm'; temp = lerp(80, 35, p); g = 1 + Math.sin(p * Math.PI * 2) * 0.15;
  } else {
    velocity = 0; velocityUnit = 'm/s'; altitude = 0; altitudeUnit = 'm'; temp = 35; g = 1;
  }
  const velocityDecimals = velocityUnit === 'km/s' ? 1 : velocity < 10 ? 1 : 0;
  $('#telemetry-value').textContent = formatNumber(velocity, velocityDecimals);
  $('#telemetry-unit').textContent = velocityUnit;
  $('#telemetry-label').textContent = 'INERTIAL VELOCITY';
  $('#altitude-label').textContent = altitudeLabel;
  $('#altitude-value').textContent = formatNumber(altitude, altitudeUnit === 'km' && altitude < 10 ? 1 : 0);
  $('#altitude-unit').textContent = altitudeUnit;
  $('#temp-value').textContent = formatNumber(temp, 0);
  $('#g-value').textContent = formatNumber(g, 1);
  const seconds = Math.floor((sim.phaseTime % DURATION) * 100 / 100);
  $('#time-current').textContent = `00:${String(seconds).padStart(2, '0')}`;
  $('#timeline').value = String(Math.round(p * 1200));
  $('#timeline').style.setProperty('--progress', `${p * 100}%`);
}

const projected = new THREE.Vector3();
const world = new THREE.Vector3();
const normal = new THREE.Vector3();
const toCamera = new THREE.Vector3();
const worldQuaternion = new THREE.Quaternion();
function updateHotspots() {
  const allowedPhase = sim.phase === 'coast' || sim.phase === 'launch' || (sim.view !== 'exterior' && sim.phase !== 'mains' && sim.phase !== 'drogue');
  craft.capsule.getWorldQuaternion(worldQuaternion);
  for (const definition of hotspotDefinitions) {
    const shouldShow = labelsVisible && allowedPhase && definition.views.includes(sim.view) && (sim.phase !== 'launch' || sim.phaseTime / DURATION > 0.68) && (definition.id !== 'docking' || craft.dockingProbe.visible);
    if (!shouldShow) {
      definition.element.style.display = 'none';
      continue;
    }
    world.copy(definition.vector).applyMatrix4(craft.capsule.matrixWorld);
    normal.copy(definition.normalVector).applyQuaternion(worldQuaternion);
    toCamera.copy(camera.position).sub(world).normalize();
    projected.copy(world).project(camera);
    const visible = normal.dot(toCamera) > -0.05 && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 0.96 && Math.abs(projected.y) < 0.96;
    definition.element.style.display = visible ? 'grid' : 'none';
    if (visible) {
      definition.element.style.left = `${(projected.x * 0.5 + 0.5) * viewport.clientWidth}px`;
      definition.element.style.top = `${(-projected.y * 0.5 + 0.5) * viewport.clientHeight}px`;
    }
  }
}

function syncPlayback() {
  $('#play-button use').setAttribute('href', sim.paused ? '#i-play' : '#i-pause');
  $('#play-button').setAttribute('aria-label', sim.paused ? 'Play simulation' : 'Pause simulation');
  $('#render-stats').style.visibility = sim.paused ? 'hidden' : 'visible';
  $('#speed-select').value = String(sim.playbackRate);
  $('#replay-state').textContent = runtime.replaying ? `REPLAY · TICK ${runtime.tick}` : '';
}

function setPaused(value, record = true) {
  runtime.command('setPaused', { value }, record);
  syncPlayback();
}

function fireRCS() {
  if (!runtime.command('rcs')) return;
  syncPhase();
  sample(sim.phaseTime);
  notify(`RCS PULSE · ${parameterText('rcs.thrustPerEngine', 0)} PER ENGINE`);
}

function draw() {
  controls.update();
  craft.capsule.updateMatrixWorld(true);
  updateHotspots();
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
let statsTime = 0;
let statsFrames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  runtime.advance(dt);
  syncPhase();
  syncPlayback();
  evaluateChecklist();
  if (!sim.paused || runtime.replaying) sample(sim.phaseTime);
  draw();
  statsTime += dt;
  statsFrames++;
  if (statsTime >= 1) {
    const fps = Math.round(statsFrames / statsTime);
    $('#render-stats').textContent = `${fps} FPS · ${Math.round(renderer.info.render.triangles / 1000)}K TRI`;
    statsTime = 0;
    statsFrames = 0;
  }
});

$$('.phase-button').forEach((button) => button.addEventListener('click', () => setPhase(button.dataset.phase)));
$$('[data-view]').forEach((button) => button.addEventListener('click', () => applyView(button.dataset.view)));
$('#play-button').addEventListener('click', () => setPaused(!sim.paused));
$('#restart-button').addEventListener('click', () => { runtime.command('restart'); sample(0); });
$('#camera-reset').addEventListener('click', resetCamera);
$('#rotate-button').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  $('#rotate-button').classList.toggle('active', controls.autoRotate);
  $('#rotate-button').setAttribute('aria-pressed', String(controls.autoRotate));
});
$('#labels-button').addEventListener('click', () => {
  labelsVisible = !labelsVisible;
  $('#labels-button').classList.toggle('active', labelsVisible);
  $('#labels-button').setAttribute('aria-pressed', String(labelsVisible));
});
$('#rcs-button').addEventListener('click', fireRCS);
$('#speed-select').addEventListener('change', (event) => { runtime.command('rate', { value: Number(event.target.value) }); syncPlayback(); });
$('#timeline').addEventListener('input', (event) => {
  runtime.command('seek', { time: Number(event.target.value) / 100 });
  syncPlayback();
  sample(sim.phaseTime);
});
$('#fullscreen-button').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
});
$('#panel-toggle').addEventListener('click', () => $('#telemetry-panel').classList.toggle('open'));
$('#checklist-toggle').addEventListener('click', () => toggleChecklist());
$('#checklist-close').addEventListener('click', () => toggleChecklist(false));
$('#checklist-select').addEventListener('change', (event) => { runtime.command('checklistGuide', { guide: event.target.value }); renderChecklist(); });
$('#checklist-continue').addEventListener('click', () => { runtime.command('checklistNext'); renderChecklist(); });
$('#checklist-locate').addEventListener('click', locateChecklistControl);
$('#save-checkpoint').addEventListener('click', saveCheckpoint);
$('#load-checkpoint').addEventListener('click', loadCheckpoint);
$('#replay-checkpoint').addEventListener('click', replaySession);
$('#parameter-filter').addEventListener('change', renderParameters);
const aboutDialog = $('#about-dialog');
$('#about-button').addEventListener('click', () => aboutDialog.showModal());
$('#about-close').addEventListener('click', () => aboutDialog.close());
aboutDialog.addEventListener('click', (event) => { if (event.target === aboutDialog) aboutDialog.close(); });
window.addEventListener('keydown', (event) => {
  if (event.target.matches('input, select, textarea') || aboutDialog.open) return;
  if (event.code === 'Space') { event.preventDefault(); setPaused(!sim.paused); }
  if (event.key === 'F5') { event.preventDefault(); saveCheckpoint(); }
  if (event.key === 'F9') { event.preventDefault(); loadCheckpoint(); }
  if (event.key.toLowerCase() === 'c') toggleChecklist();
  if (event.key.toLowerCase() === 'n' && $('#checklist-panel').classList.contains('open')) { runtime.command('checklistNext'); renderChecklist(); }
  if (event.key.toLowerCase() === 'r') fireRCS();
  if (event.key.toLowerCase() === 'l') $('#labels-button').click();
  const index = Number(event.key) - 1;
  if (index >= 0 && index < phaseOrder.length) setPhase(phaseOrder[index]);
});

const resizeObserver = new ResizeObserver(() => {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  resetCamera();
});
resizeObserver.observe(viewport);

function finishLoading() {
  $('#loading').classList.add('done');
  $('#boot-poster').classList.add('loaded');
  scanLoaded = true;
  applyView(sim.view, false);
  setPhase(new URLSearchParams(location.search).get('phase') || 'coast', false);
  const timeParam = new URLSearchParams(location.search).get('t');
  if (timeParam !== null) window.__seek(Number(timeParam));
  window.__SCENE_READY__ = true;
}

const draco = new DRACOLoader();
draco.setDecoderPath('./draco/');
draco.setWorkerLimit(2);
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);
loader.load('./models/apollo-columbia.glb', (gltf) => {
  const model = gltf.scene;
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.material.roughness = Math.max(object.material.roughness ?? 0.7, 0.68);
    object.material.metalness = Math.min(object.material.metalness ?? 0.2, 0.36);
    object.material.envMapIntensity = 0.75;
  });
  let bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = parameter('cm.baseDiameter') / Math.max(size.x, size.z);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(center);
  craft.scanSlot.add(model);
  finishLoading();
}, (event) => {
  if (event.total) $('#loading').lastChild.textContent = `LOADING CM-107 SCAN · ${Math.round(event.loaded / event.total * 100)}%`;
}, () => {
  const fallback = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 1.956, 2.72, 72), new THREE.MeshStandardMaterial({ color: 0x8e8572, roughness: 0.85, metalness: 0.18 }));
  fallback.add(shell);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.956, 48, 16, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x302b28, roughness: 1 }));
  shield.position.y = -1.3;
  shield.scale.y = 0.17;
  fallback.add(shield);
  craft.scanSlot.add(fallback);
  $('#view-badge-text').textContent = 'SCHEMATIC FALLBACK';
  finishLoading();
});

window.__seek = (time) => {
  runtime.command('seek', { time: Number(time) }, false);
  syncPlayback();
  sample(sim.phaseTime);
  draw();
};
window.__play = () => { setPaused(false); clock.getDelta(); };
window.__apollo = {
  setPhase,
  setView: applyView,
  fireRCS,
  saveCheckpoint,
  loadCheckpoint,
  replaySession,
  toggleChecklist,
  getState: () => ({
    phase: sim.phase,
    view: sim.view,
    time: sim.phaseTime,
    paused: sim.paused,
    scanLoaded,
    triangles: renderer.info.render.triangles,
    tick: runtime.tick,
    replaying: Boolean(runtime.replaying),
    rcsPulseCount: sim.rcsPulseCount,
    checklist: structuredClone(sim.checklist),
    events: runtime.events.length,
    checkpointAvailable: localStorage.getItem(CHECKPOINT_KEY) !== null,
  }),
  getRuntimeSnapshot: () => runtime.snapshot(),
};

$('#checklist-select').innerHTML = Object.entries(CHECKLISTS).map(([id, guide]) => `<option value="${id}">${guide.title}</option>`).join('');
renderChecklist();
renderParameters();
if (localStorage.getItem(CHECKPOINT_KEY)) $('#checkpoint-status').textContent = 'A saved checkpoint is available in this browser.';
setPhase('coast', false);
syncPlayback();
draw();
