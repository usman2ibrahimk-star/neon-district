import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const cityLimit = 204;
const ROAD_LINES = [-150, -50, 50, 150];
const saveKey = "neon-district-progress-v1";
const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

const state = {
  mode: "walk",
  license: false,
  inventory: [],
  player: { x: -111, z: -128, yaw: 0.13 },
  car: null,
  test: { active: false, checkpoint: 0, time: 90, violations: 0, lastSpeedViolation: 90 },
  wanted: 0,
  credits: 0,
  completedMissions: [],
  tuning: { engine: 1, handling: 1, paint: 0 },
  mission: { id: null, checkpoint: 0 },
  started: false,
  activeSlot: null,
  dayTime: 17 * 60,
  raining: false,
  rainAmount: 0,
  messageTimer: null,
  quality: isTouch ? "low" : "high",
  keys: {},
  joystick: { x: 0, y: 0, active: false },
  action: { accelerate: false, brake: false, handbrake: false }
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x091321);
scene.fog = new THREE.Fog(0x091321, isTouch ? 155 : 215, isTouch ? 470 : 650);
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 900);
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("#render-layer").append(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x9ab7d2, 0x17202b, 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8c1, 3.1);
sun.position.set(-90, 160, 80);
sun.castShadow = !isTouch;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -260; sun.shadow.camera.right = 260; sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
scene.add(sun);
const dayPalette = [
  { minute: 0, sky: new THREE.Color(0x07101c), ground: new THREE.Color(0x151b28), sun: new THREE.Color(0x7284ad) },
  { minute: 300, sky: new THREE.Color(0x35354b), ground: new THREE.Color(0x292832), sun: new THREE.Color(0xff976a) },
  { minute: 420, sky: new THREE.Color(0xb57b72), ground: new THREE.Color(0x394037), sun: new THREE.Color(0xffd1a0) },
  { minute: 720, sky: new THREE.Color(0x89b8dd), ground: new THREE.Color(0x33453e), sun: new THREE.Color(0xfff1d4) },
  { minute: 1020, sky: new THREE.Color(0xd28d6d), ground: new THREE.Color(0x3b352f), sun: new THREE.Color(0xffb77d) },
  { minute: 1200, sky: new THREE.Color(0x302a43), ground: new THREE.Color(0x20202d), sun: new THREE.Color(0xa08ac4) },
  { minute: 1440, sky: new THREE.Color(0x07101c), ground: new THREE.Color(0x151b28), sun: new THREE.Color(0x7284ad) }
];
const dayScratch = { sky: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), window: new THREE.Color(0x93a9c4) };
const wetRoadColor = new THREE.Color(0x1a2832);
const dryRoadColor = new THREE.Color(0x222b36);

const mats = {
  grass: new THREE.MeshLambertMaterial({ color: 0x263b38 }),
  road: new THREE.MeshStandardMaterial({ color: 0x222b36, roughness: .82, metalness: .03 }),
  sidewalk: new THREE.MeshLambertMaterial({ color: 0x667077 }),
  lane: new THREE.MeshBasicMaterial({ color: 0xd4b55e }),
  white: new THREE.MeshBasicMaterial({ color: 0xb8c2c9 }),
  windows: new THREE.MeshLambertMaterial({ color: 0x182d3c, emissive: 0x07151e }),
  dmv: new THREE.MeshLambertMaterial({ color: 0xd15d50 }),
  dmvAccent: new THREE.MeshLambertMaterial({ color: 0xffc36c, emissive: 0x311b0a }),
  tree: new THREE.MeshLambertMaterial({ color: 0x2f6a53 }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x554035 }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x63e7e0 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff5d66 }),
  whiteGlow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  carBlue: new THREE.MeshLambertMaterial({ color: 0x3976aa, metalness: .15, roughness: .8 }),
  carYellow: new THREE.MeshLambertMaterial({ color: 0xe6a440 }),
  carBlack: new THREE.MeshLambertMaterial({ color: 0x202833 }),
  carViolet: new THREE.MeshLambertMaterial({ color: 0x7656a6 }),
  headlampOff: new THREE.MeshLambertMaterial({ color: 0x767b7f }),
  headlampOn: new THREE.MeshBasicMaterial({ color: 0xffedbd }),
  headlampBeam: new THREE.MeshBasicMaterial({ color: 0xffe6a6, transparent: true, opacity: .09, depthWrite: false, side: THREE.DoubleSide }),
  streetLamp: new THREE.MeshStandardMaterial({ color: 0x35404a, emissive: 0xffbd70, emissiveIntensity: 0, roughness: .7 }),
  police: new THREE.MeshLambertMaterial({ color: 0xe8edf2 }),
  policeBlue: new THREE.MeshLambertMaterial({ color: 0x234f9a })
};

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = !isTouch;
  return mesh;
}
function cylinder(r, h, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, isTouch ? 6 : 10), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = !isTouch;
  return mesh;
}
function flatBox(w, d, material, x, y, z) { return box(w, .08, d, material, x, y, z); }

const worldObjects = [];
const traffic = [];
const pedestrians = [];
const testMarkers = [];
const streetLights = [];
const wetRoadDetails = [];
const missionMarker = new THREE.Group();
let rainField = null;
const dmv = { x: -150, z: -100 };
const garage = { x: 170, z: -100 };
const carPaints = [mats.carBlue, mats.carYellow, mats.carBlack, mats.carViolet];
const testRoute = [
  { x: -150, z: -50 }, { x: -50, z: -50 }, { x: 50, z: -50 },
  { x: 50, z: 50 }, { x: -50, z: 50 }, { x: -50, z: 150 }
];
const testIntersections = [[-50, -50], [50, -50], [50, 50], [-50, 50]];
const missionDefinitions = [
  { id: "courier", title: "DMV Courier", description: "Drive the sealed paperwork from the DMV to the Eastside Garage.", reward: 300, route: [{ x: -150, z: -120 }, { x: 170, z: -112 }] },
  { id: "city-circuit", title: "City Circuit", description: "Take a clean route through the district's central intersections.", reward: 500, route: [{ x: -50, z: -50 }, { x: 50, z: -50 }, { x: 50, z: 50 }, { x: -50, z: 50 }] },
  { id: "lookout-run", title: "Lookout Run", description: "Cross the city and reach the northern lookout before the clock runs out.", reward: 700, route: [{ x: 170, z: -112 }, { x: 150, z: 150 }] }
];
let selectedSlot = "slot-1";
const streetLampPositions = isTouch
  ? [[-129, -137], [69, -39], [-69, 61], [171, 143]]
  : [[-129, -137], [-31, -137], [69, -39], [171, -39], [-69, 61], [71, 143], [171, 143]];

function addWorld(mesh, collision = false) {
  scene.add(mesh);
  if (collision) worldObjects.push(mesh);
  return mesh;
}
function buildWorld() {
  addWorld(flatBox(430, 430, mats.grass, 0, -0.1, 0));
  // Roads, sidewalks, lane dashes and crosswalks.
  for (const z of ROAD_LINES) {
    addWorld(flatBox(430, 19, mats.road, 0, .01, z));
    addWorld(flatBox(430, .6, mats.lane, 0, .04, z - 0.8));
    addWorld(flatBox(430, .6, mats.lane, 0, .04, z + 0.8));
    for (let x = -205; x < 205; x += 18) addWorld(flatBox(8, .45, mats.white, x, .05, z), false).rotation.y = 0;
  }
  for (const x of ROAD_LINES) {
    addWorld(flatBox(19, 430, mats.road, x, .015, 0));
    addWorld(flatBox(.6, 430, mats.lane, x - .8, .04, 0));
    addWorld(flatBox(.6, 430, mats.lane, x + .8, .04, 0));
    for (let z = -205; z < 205; z += 18) addWorld(flatBox(.45, 8, mats.white, x, .05, z));
  }
  // Blocks with two-tone low-poly buildings.
  const heights = [9, 14, 20, 12, 25, 16, 10];
  for (let ix = 0; ix < ROAD_LINES.length - 1; ix++) {
    for (let iz = 0; iz < ROAD_LINES.length - 1; iz++) {
      const cx = (ROAD_LINES[ix] + ROAD_LINES[ix + 1]) / 2;
      const cz = (ROAD_LINES[iz] + ROAD_LINES[iz + 1]) / 2;
      if (Math.abs(cx - dmv.x) < 45 && Math.abs(cz - dmv.z) < 45) continue;
      const h = heights[(ix * 3 + iz * 2) % heights.length];
      const w = 24 + ((ix + iz) % 2) * 8;
      const d = 22 + ((ix * 2 + iz) % 2) * 7;
      const body = box(w, h, d, new THREE.MeshLambertMaterial({ color: [0x6a707d, 0x4e5b68, 0x866f68, 0x526877][(ix + iz) % 4] }), cx + (ix % 2 ? -4 : 4), h / 2, cz + (iz % 2 ? 3 : -3));
      addWorld(body, true);
      for (let wy = 4; wy < h - 1; wy += 4) {
        const windowLine = box(w * .75, .5, .12, mats.windows, body.position.x, wy, body.position.z - d / 2 - .08);
        addWorld(windowLine);
      }
      addWorld(flatBox(w + 4, d + 4, mats.sidewalk, body.position.x, .06, body.position.z));
    }
  }
  buildDMV();
  buildGarage();
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? -1 : 1;
    const x = ((i * 47) % 390) - 195;
    const z = side * (185 - (i % 3) * 12);
    buildTree(x, z);
  }
  buildTrafficLights();
  buildStreetLights();
  buildWetRoadDetails();
  buildRainField();
  buildTraffic();
  buildPedestrians();
  buildTestMarkers();
  buildMissionMarker();
}

function buildDMV() {
  const base = box(41, 12, 28, mats.dmv, dmv.x, 6, dmv.z);
  addWorld(base, true);
  addWorld(box(44, 1.7, 31, mats.dmvAccent, dmv.x, 12.8, dmv.z));
  addWorld(box(35, 5, mats.windows, dmv.x, 4.2, dmv.z - 14.2));
  const sign = box(27, 4, .5, mats.dmvAccent, dmv.x, 13.5, dmv.z - 16);
  addWorld(sign);
  // DMV letters as glowing blocks: clear landmark from the street.
  for (let i = 0; i < 3; i++) addWorld(box(6, .5, .25, mats.whiteGlow, dmv.x - 9 + i * 9, 14.5, dmv.z - 16.4));
  addWorld(flatBox(48, 36, mats.sidewalk, dmv.x, .08, dmv.z + 1));
  addWorld(flatBox(12, 9, mats.road, dmv.x, .11, dmv.z - 21));
  const marker = new THREE.Mesh(new THREE.RingGeometry(4, 4.35, 32), mats.cyan);
  marker.rotation.x = -Math.PI / 2; marker.position.set(dmv.x, .18, dmv.z - 20); marker.userData.dmv = true;
  scene.add(marker);
}

function buildGarage() {
  const base = box(29, 10, 20, mats.carBlack, garage.x, 5, garage.z);
  addWorld(base, true);
  addWorld(box(31, 1.5, 22, mats.dmvAccent, garage.x, 10.8, garage.z));
  addWorld(box(22, 5.5, .35, mats.windows, garage.x, 4.3, garage.z - 10.2));
  addWorld(box(18, 2.8, .5, mats.cyan, garage.x, 12.1, garage.z - 10.8));
  addWorld(flatBox(36, 28, mats.sidewalk, garage.x, .08, garage.z));
  const marker = new THREE.Mesh(new THREE.RingGeometry(4, 4.35, 32), mats.dmvAccent);
  marker.rotation.x = -Math.PI / 2; marker.position.set(garage.x, .18, garage.z - 15); scene.add(marker);
}

function buildTree(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.add(cylinder(.65, 4, mats.trunk, 0, 2, 0));
  group.add(cylinder(2.8, 5.5, mats.tree, 0, 6.4, 0));
  group.add(cylinder(2.1, 3.5, mats.tree, 0, 9.5, 0));
  scene.add(group);
}

function buildTrafficLights() {
  const points = [
    [-150, -150], [-50, -50], [50, 50], [150, 150], [-50, 150], [150, -50]
  ];
  for (const [x, z] of points) {
    const group = new THREE.Group();
    group.position.set(x + 11, 0, z + 11);
    group.add(cylinder(.18, 6.5, mats.carBlack, 0, 3.25, 0));
    group.add(box(.8, 2.3, .5, mats.carBlack, 0, 6.1, 0));
    const light = cylinder(.19, .08, mats.red, 0, 6.7, -.28);
    light.rotation.x = Math.PI / 2; group.add(light);
    const green = cylinder(.19, .08, mats.cyan, 0, 5.75, -.28);
    green.rotation.x = Math.PI / 2; group.add(green);
    scene.add(group);
  }
}

function buildStreetLights() {
  for (const [x, z] of streetLampPositions) {
    const pole = new THREE.Group();
    pole.position.set(x, 0, z);
    pole.add(cylinder(.12, 7.8, mats.carBlack, 0, 3.9, 0));
    pole.add(box(2.1, .14, .16, mats.carBlack, .85, 7.65, 0));
    pole.add(box(.55, .18, .38, mats.streetLamp, 1.55, 7.53, 0));
    const light = new THREE.PointLight(0xffc879, 0, 42, 2);
    light.position.set(1.55, 7.25, 0);
    light.castShadow = false;
    pole.add(light);
    scene.add(pole);
    streetLights.push({ light, fixture: pole.children[2] });
  }
}

function addWetSurface(x, z, width, length, yaw, color, opacity, circle = false) {
  const geometry = circle ? new THREE.CircleGeometry(1, 20) : new THREE.PlaneGeometry(width, length);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const surface = new THREE.Mesh(geometry, material);
  surface.rotation.x = -Math.PI / 2;
  if (circle) surface.scale.set(width, length, 1);
  surface.position.y = .072;
  const group = new THREE.Group();
  group.position.set(x, 0, z); group.rotation.y = yaw; group.add(surface); scene.add(group);
  wetRoadDetails.push({ material, maxOpacity: opacity });
}
function buildWetRoadDetails() {
  for (const [x, z] of streetLampPositions) {
    const nearestZ = ROAD_LINES.reduce((best, value) => Math.abs(value - z) < Math.abs(best - z) ? value : best, ROAD_LINES[0]);
    const centerX = x + 1.3;
    // Broken, warm streaks hint at lamp reflections without an expensive live reflection pass.
    addWetSurface(centerX - 1.2, nearestZ - 2, .55, 7, Math.PI / 2, 0xffc879, .34);
    addWetSurface(centerX + .4, nearestZ + 2, .8, 10, Math.PI / 2, 0xffe2a4, .24);
    addWetSurface(centerX + 1.8, nearestZ - 1, .38, 5, Math.PI / 2, 0xb4eaf1, .26);
  }
  for (const [x, z] of [[-50, -50], [50, -50], [50, 50], [-50, 50], [150, 150]]) {
    addWetSurface(x - 3, z + 4, 2.4, 5.8, Math.PI / 5, 0x709ca9, .2, true);
    addWetSurface(x + 4, z - 3, 1.5, 4.2, -Math.PI / 7, 0x9ed6db, .16, true);
  }
}
function buildRainField() {
  const count = isTouch ? 160 : 420;
  const positions = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const offset = i * 6;
    const x = (Math.random() - .5) * 46, y = 4 + Math.random() * 28, z = (Math.random() - .5) * 46;
    positions.set([x, y, z, x + .12, y - 1.1, z + .08], offset);
  }
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setDrawRange(0, count * 2);
  const material = new THREE.LineBasicMaterial({ color: 0xa9dbe8, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
  rainField = { mesh, positions, positionAttribute, count };
}
function setRaining(enabled, announce = true) {
  state.raining = enabled;
  $("#weather-button").setAttribute("aria-pressed", String(enabled));
  $("#weather-label").textContent = enabled ? "RAIN" : "DRY";
  saveProgress();
  if (announce) notify(enabled ? "Rain rolling in — roads are getting slick." : "The rain has cleared.");
}
function updateRain(delta) {
  const target = state.raining ? 1 : 0;
  state.rainAmount = lerp(state.rainAmount, target, 1 - Math.pow(.02, delta));
  const subject = state.mode === "drive" ? state.car.mesh.position : state.player;
  if (rainField) {
    rainField.mesh.visible = state.rainAmount > .01;
    rainField.mesh.position.set(subject.x, 0, subject.z);
    const positions = rainField.positions;
    for (let i = 0; i < rainField.count; i++) {
      const offset = i * 6;
      positions[offset + 1] -= delta * 28;
      positions[offset + 4] -= delta * 28;
      if (positions[offset + 1] < 0) {
        const x = (Math.random() - .5) * 46, z = (Math.random() - .5) * 46;
        positions[offset] = x; positions[offset + 1] = 26 + Math.random() * 7; positions[offset + 2] = z;
        positions[offset + 3] = x + .12; positions[offset + 4] = positions[offset + 1] - 1.1; positions[offset + 5] = z + .08;
      }
    }
    rainField.positionAttribute.needsUpdate = true;
    rainField.mesh.material.opacity = state.rainAmount * .42;
  }
  mats.road.color.copy(dryRoadColor).lerp(wetRoadColor, state.rainAmount);
  mats.road.roughness = lerp(.82, .2, state.rainAmount);
  wetRoadDetails.forEach((detail) => { detail.material.opacity = detail.maxOpacity * state.rainAmount; });
}

function makeCar(material = mats.carBlue, police = false) {
  const group = new THREE.Group();
  const body = box(2.1, .65, 4.1, material, 0, 1, 0);
  group.add(body);
  group.add(box(1.65, .62, 1.85, police ? mats.police : mats.windows, 0, 1.6, -.15));
  const bumper = box(1.8, .18, .2, mats.carBlack, 0, .8, 2.08); group.add(bumper);
  for (const x of [-1, 1]) for (const z of [-1.35, 1.35]) {
    const wheel = cylinder(.42, .22, mats.carBlack, x * 1.04, .58, z);
    wheel.rotation.z = Math.PI / 2; group.add(wheel);
  }
  const bulbs = [];
  const beams = [];
  for (const x of [-.72, .72]) {
    const bulb = box(.2, .14, .08, mats.headlampOff, x, 1.12, 2.08);
    group.add(bulb); bulbs.push(bulb);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.5, 16, isTouch ? 6 : 8, 1, true), mats.headlampBeam);
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(x, .52, 10.1);
    beam.visible = false;
    group.add(beam); beams.push(beam);
  }
  group.userData.headlights = { bulbs, beams };
  if (police) {
    group.add(box(.58, .16, .34, mats.policeBlue, 0, 2.02, -.15));
    group.add(box(.27, .18, .35, mats.red, -.17, 2.12, -.15));
    group.add(box(.27, .18, .35, mats.cyan, .17, 2.12, -.15));
  }
  return group;
}
function createCar(x, z, yaw, material, police = false) {
  const mesh = makeCar(material, police);
  mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
  scene.add(mesh);
  const car = { mesh, x, z, yaw, speed: 0, isPolice: police, isTest: false, paintIndex: police ? 0 : carPaints.indexOf(material), routeAxis: null, routeSign: 1 };
  traffic.push(car);
  return car;
}
function addVehicleSpotlights(car) {
  if (!car || car.spotlights) return;
  car.spotlights = [-.62, .62].map((x) => {
    const target = new THREE.Object3D();
    target.position.set(x, .1, 27);
    car.mesh.add(target);
    const spot = new THREE.SpotLight(0xffe4ad, 0, 42, .34, .65, 2);
    spot.position.set(x, .68, 2.08);
    spot.target = target;
    spot.castShadow = false;
    car.mesh.add(spot);
    return spot;
  });
}
function updateVehicleLights(night) {
  const active = night > .28;
  for (const car of traffic) {
    const parts = car.mesh.userData.headlights;
    if (!parts) continue;
    parts.bulbs.forEach((bulb) => { bulb.material = active ? mats.headlampOn : mats.headlampOff; });
    parts.beams.forEach((beam) => { beam.visible = active; });
    if (car.spotlights) car.spotlights.forEach((spot) => { spot.intensity = active ? night * 160 : 0; });
  }
}
function buildTraffic() {
  const data = [
    [-191, -150, Math.PI / 2, mats.carYellow], [112, -50, -Math.PI / 2, mats.carBlue],
    [-50, 178, 0, mats.carYellow], [50, -174, Math.PI, mats.carBlack],
    [150, 112, 0, mats.carBlue], [-150, -5, Math.PI / 2, mats.carYellow]
  ];
  for (const [x, z, yaw, mat] of data) {
    const car = createCar(x, z, yaw, mat);
    car.routeAxis = Math.abs(Math.cos(yaw)) > .5 ? "z" : "x";
  }
  state.car = createCar(-109, -112, 0, mats.carBlue);
  state.car.isPlayer = true;
}
function buildPedestrians() {
  const colors = [0xff906e, 0x8cb8ff, 0xc9e883, 0xc58fff];
  for (let i = 0; i < (isTouch ? 7 : 11); i++) {
    const group = new THREE.Group();
    group.add(cylinder(.3, 1.4, new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }), 0, 1.15, 0));
    group.add(cylinder(.23, .45, mats.dmvAccent, 0, 2.05, 0));
    const x = -190 + ((i * 79) % 360), z = -190 + ((i * 131) % 360);
    group.position.set(x, 0, z); scene.add(group);
    pedestrians.push({ mesh: group, x, z, phase: i * .8, axis: i % 2 ? "x" : "z" });
  }
}
function buildTestMarkers() {
  for (const point of testRoute) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(4, 4.35, 32), mats.dmvAccent);
    ring.rotation.x = -Math.PI / 2; group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 3, 8), mats.dmvAccent);
    beam.position.y = 1.5; group.add(beam);
    group.position.set(point.x, .2, point.z); group.visible = false; scene.add(group); testMarkers.push(group);
  }
}
function buildMissionMarker() {
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 4.85, 32), mats.cyan);
  ring.rotation.x = -Math.PI / 2; missionMarker.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 4, 8), mats.cyan);
  beam.position.y = 2; missionMarker.add(beam);
  missionMarker.visible = false; scene.add(missionMarker);
}

buildWorld();

function slotStorageKey(slot) { return `neon-district-${slot}-v1`; }
function readSlot(slot) {
  try { return JSON.parse(localStorage.getItem(slotStorageKey(slot)) || "null"); } catch { return null; }
}
function migrateLegacySave() {
  try {
    if (!localStorage.getItem(slotStorageKey("slot-1"))) {
      const legacy = JSON.parse(localStorage.getItem(saveKey) || "null");
      if (legacy) localStorage.setItem(slotStorageKey("slot-1"), JSON.stringify(legacy));
    }
  } catch { /* storage might be disabled or contain malformed JSON */ }
}
function loadProgress(slot) {
  const saved = readSlot(slot);
  if (!saved) return false;
  state.activeSlot = slot;
  state.license = !!saved.license;
  state.inventory = state.license ? ["driving_license"] : [];
  state.credits = Number(saved.credits) || 0;
  state.completedMissions = Array.isArray(saved.completedMissions) ? saved.completedMissions : [];
  state.tuning = { ...state.tuning, ...(saved.tuning || {}) };
  state.dayTime = Number.isFinite(saved.dayTime) ? ((saved.dayTime % 1440) + 1440) % 1440 : 17 * 60;
  state.raining = saved.raining === true;
  state.rainAmount = 0;
  if (saved.player) {
    const px = Number(saved.player.x), pz = Number(saved.player.z), pyaw = Number(saved.player.yaw);
    state.player.x = clamp(Number.isFinite(px) ? px : -111, -198, 198);
    state.player.z = clamp(Number.isFinite(pz) ? pz : -128, -198, 198);
    state.player.yaw = Number.isFinite(pyaw) ? pyaw : .13;
  }
  if (saved.car && state.car) {
    const cx = Number(saved.car.x), cz = Number(saved.car.z), cyaw = Number(saved.car.yaw);
    state.car.mesh.position.set(clamp(Number.isFinite(cx) ? cx : -109, -199, 199), 0, clamp(Number.isFinite(cz) ? cz : -112, -199, 199));
    state.car.yaw = Number.isFinite(cyaw) ? cyaw : 0;
    state.car.mesh.rotation.y = state.car.yaw;
  }
  if (state.car) { state.car.speed = 0; state.car.isPlayer = true; state.car.isTest = false; applyPaint(state.car, state.tuning.paint); }
  notify(`Save slot ${slot.slice(-1)} loaded.`, "success");
  return true;
}
function saveProgress() {
  if (!state.activeSlot) return;
  const payload = {
    license: state.license,
    inventory: state.inventory,
    credits: state.credits,
    completedMissions: state.completedMissions,
    tuning: state.tuning,
    dayTime: state.dayTime,
    raining: state.raining,
    player: { x: state.player.x, z: state.player.z, yaw: state.player.yaw },
    car: state.car ? { x: state.car.mesh.position.x, z: state.car.mesh.position.z, yaw: state.car.yaw } : null,
    savedAt: Date.now()
  };
  try { localStorage.setItem(slotStorageKey(state.activeSlot), JSON.stringify(payload)); } catch {}
}
function renderSaveSlots() {
  const container = $("#save-slots");
  container.innerHTML = ["slot-1", "slot-2", "slot-3"].map((slot, index) => {
    const saved = readSlot(slot);
    const title = saved?.license ? "District regular" : saved ? "New driver" : "Empty slot";
    const details = saved
      ? `${saved.license ? "Licence earned" : "Licence needed"} · ${Number(saved.credits) || 0} credits`
      : "No progress saved yet";
    const time = saved?.savedAt ? new Date(saved.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    return `<button class="save-slot ${slot === selectedSlot ? "selected" : ""}" data-slot="${slot}" type="button">
      <span class="slot-number">0${index + 1}</span>
      <span class="slot-copy"><strong>${title}</strong><small>${details}</small></span>
      <span class="slot-status ${saved ? "saved" : ""}">${saved ? `SAVED${time ? `<br>${time}` : ""}` : "EMPTY"}</span>
    </button>`;
  }).join("");
  container.querySelectorAll("[data-slot]").forEach((button) => button.addEventListener("click", () => {
    selectedSlot = button.dataset.slot;
    renderSaveSlots();
    $("#continue-button").disabled = !readSlot(selectedSlot);
  }));
  $("#continue-button").disabled = !readSlot(selectedSlot);
}
function startGame() {
  state.started = true;
  $("#main-menu").classList.add("closed");
  ensureAudio();
  if (state.activeSlot) saveProgress();
}
function continueGame() {
  if (!loadProgress(selectedSlot)) return;
  state.mission = { id: null, checkpoint: 0 };
  state.test.active = false;
  startGame();
  updateHUD();
}
function newGame() {
  const existing = readSlot(selectedSlot);
  if (existing && !confirm(`Start a new game in Slot ${selectedSlot.slice(-1)}? This will replace that slot's saved progress.`)) return;
  state.activeSlot = selectedSlot;
  state.license = false; state.inventory = []; state.credits = 0; state.completedMissions = [];
  state.tuning = { engine: 1, handling: 1, paint: 0 };
  state.raining = false; state.rainAmount = 0;
  state.mission = { id: null, checkpoint: 0 };
  state.test = { active: false, checkpoint: 0, time: 90, violations: 0, lastSpeedViolation: 90 };
  state.wanted = 0; state.mode = "walk";
  state.player = { x: -111, z: -128, yaw: .13 };
  state.dayTime = 17 * 60;
  if (state.car) {
    state.car.mesh.position.set(-109, 0, -112); state.car.mesh.rotation.y = 0;
    state.car.x = -109; state.car.z = -112; state.car.yaw = 0;
    state.car.speed = 0; state.car.isPlayer = true; state.car.isTest = false; applyPaint(state.car, 0);
  }
  state.mission = { id: null, checkpoint: 0 };
  missionMarker.visible = false; testMarkers.forEach((marker) => { marker.visible = false; });
  saveProgress(); renderSaveSlots(); startGame(); updateHUD();
  notify(`New game started in Slot ${selectedSlot.slice(-1)}. Head to the DMV for your licence.`, "success");
}
migrateLegacySave();
renderSaveSlots();
$("#continue-button").addEventListener("click", continueGame);
$("#new-game-button").addEventListener("click", newGame);

function updateHUD() {
  const licenseEl = $("#license-status");
  licenseEl.textContent = state.license ? "YES" : "NO";
  licenseEl.className = `status-value ${state.license ? "yes" : "no"}`;
  $("#speed-value").textContent = state.mode === "drive" ? Math.round(Math.abs(state.car.speed) * 3.6) : "0";
  $("#wanted-stars").textContent = "★".repeat(state.wanted) + "☆".repeat(5 - state.wanted);
  if (state.test.active) {
    $("#test-panel").classList.remove("hidden");
    $("#test-time").textContent = Math.ceil(state.test.time);
    $("#test-checkpoint").textContent = `${Math.min(state.test.checkpoint + 1, testRoute.length)} / ${testRoute.length}`;
    $("#test-violations").textContent = `${state.test.violations} / 3`;
    $("#test-progress-bar").style.width = `${(state.test.checkpoint / testRoute.length) * 100}%`;
    $("#objective-text").textContent = "Follow the glowing route • stop at lights • 45 KM/H";
  } else if (state.mission.id) {
    const mission = missionDefinitions.find((item) => item.id === state.mission.id);
    const target = mission?.route[state.mission.checkpoint];
    $("#objective-text").textContent = `${mission.title} • checkpoint ${state.mission.checkpoint + 1}/${mission.route.length}`;
    if (target) missionMarker.position.set(target.x, .2, target.z);
  } else {
    $("#test-panel").classList.add("hidden");
    $("#objective-text").textContent = state.license ? "Explore the district — drive safe" : "Walk to the DMV to get your licence";
  }
}
let toastTimeout;
function notify(text, type = "info") {
  const toast = $("#toast"); toast.textContent = text; toast.className = `show ${type}`;
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { toast.className = ""; }, 3400);
}

function showInventory() {
  const panel = $("#inventory-panel");
  $("#inventory-items").innerHTML = state.inventory.length
    ? state.inventory.map((item) => `<div class="inventory-item"><div class="item-icon">ID</div><div><strong>Driving licence</strong><small>driving_license · issued by DMV</small></div></div>`).join("")
    : `<div class="inventory-item"><div class="item-icon">—</div><div><strong>Nothing here yet</strong><small>Pass your practical test at the DMV.</small></div></div>`;
  panel.classList.toggle("hidden");
}
function renderMissions() {
  $("#mission-list").innerHTML = missionDefinitions.map((mission) => {
    const complete = state.completedMissions.includes(mission.id);
    const active = state.mission.id === mission.id;
    const locked = !state.license;
    const label = complete ? "COMPLETED" : active ? "ACTIVE" : locked ? "LOCKED" : "START";
    return `<article class="mission-card ${complete ? "complete" : ""} ${active ? "active" : ""}">
      <h3>${mission.title}</h3><p>${mission.description}</p>
      <div class="mission-meta"><span>◆ ${mission.reward} CREDITS</span><button class="mission-action" data-mission="${mission.id}" ${complete || locked || active ? "disabled" : ""}>${label}</button></div>
    </article>`;
  }).join("");
  $("#mission-list").querySelectorAll("[data-mission]").forEach((button) => button.addEventListener("click", () => startMission(button.dataset.mission)));
}
function showMissions() {
  renderMissions();
  $("#missions-panel").classList.toggle("hidden");
}
function renderGarage() {
  document.querySelectorAll("[data-paint]").forEach((button) => button.classList.toggle("selected", Number(button.dataset.paint) === state.tuning.paint));
  $("#engine-level").textContent = `LV ${state.tuning.engine}`;
  $("#handling-level").textContent = `LV ${state.tuning.handling}`;
  $("#credit-balance").textContent = state.credits;
}
function showGarage() {
  const subject = state.mode === "drive" ? state.car.mesh.position : state.player;
  if (Math.hypot(subject.x - garage.x, subject.z - (garage.z - 15)) > 25) {
    notify("Drive to the Eastside Garage to customize your vehicle.", "warning");
    return;
  }
  renderGarage();
  $("#garage-panel").classList.toggle("hidden");
}
function startMission(id) {
  const mission = missionDefinitions.find((item) => item.id === id);
  if (!mission || !state.license) { notify("Pass your driving test before taking contracts.", "warning"); return; }
  state.mission = { id, checkpoint: 0 };
  missionMarker.visible = true;
  $("#missions-panel").classList.add("hidden");
  notify(`${mission.title} started — follow the marked route.`, "success");
  updateHUD();
}
function updateMission() {
  if (!state.mission.id || state.test.active) return;
  const mission = missionDefinitions.find((item) => item.id === state.mission.id);
  if (!mission) return;
  const target = mission.route[state.mission.checkpoint];
  const subject = state.mode === "drive" ? state.car.mesh.position : state.player;
  missionMarker.visible = true; missionMarker.position.set(target.x, .2, target.z);
  if (Math.hypot(subject.x - target.x, subject.z - target.z) < 9) {
    state.mission.checkpoint++;
    if (state.mission.checkpoint >= mission.route.length) {
      state.credits += mission.reward;
      if (!state.completedMissions.includes(mission.id)) state.completedMissions.push(mission.id);
      state.mission = { id: null, checkpoint: 0 }; missionMarker.visible = false; saveProgress();
      notify(`${mission.title} complete — ${mission.reward} credits earned.`, "success");
      renderMissions();
    } else notify(`Checkpoint ${state.mission.checkpoint} cleared.`, "success");
  }
}
function applyPaint(car, index) {
  if (!car || car.isPolice) return;
  const safeIndex = clamp(Number(index) || 0, 0, carPaints.length - 1);
  car.paintIndex = safeIndex; car.mesh.children[0].material = carPaints[safeIndex];
}
function upgradeVehicle(type) {
  if (!["engine", "handling"].includes(type)) return;
  const level = state.tuning[type], cost = level * 250;
  if (level >= 3) { notify(`${type} is already at maximum level.`); return; }
  if (state.credits < cost) { notify(`You need ${cost} credits for this upgrade.`, "warning"); return; }
  state.credits -= cost; state.tuning[type]++; saveProgress(); renderGarage();
  notify(`${type[0].toUpperCase() + type.slice(1)} upgraded to level ${state.tuning[type]}.`, "success");
}
$("#inventory-button").addEventListener("click", showInventory);
$("#missions-button").addEventListener("click", showMissions);
$("#garage-button").addEventListener("click", showGarage);
$("#weather-button").addEventListener("click", () => setRaining(!state.raining));
document.querySelectorAll("[data-paint]").forEach((button) => button.addEventListener("click", () => {
  state.tuning.paint = Number(button.dataset.paint); applyPaint(state.car, state.tuning.paint); saveProgress(); renderGarage();
}));
document.querySelectorAll("[data-upgrade]").forEach((button) => button.addEventListener("click", () => upgradeVehicle(button.dataset.upgrade)));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $("#" + button.dataset.close).classList.add("hidden")));
$("#fullscreen-button").addEventListener("click", async () => {
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { notify("Fullscreen is not available in this browser."); }
});

function nearCar() {
  let nearest = null, distance = Infinity;
  for (const car of traffic) {
    if (car.isPlayer && state.mode === "drive") continue;
    const d = Math.hypot(state.player.x - car.mesh.position.x, state.player.z - car.mesh.position.z);
    if (d < distance) { distance = d; nearest = car; }
  }
  return distance < 5.6 ? nearest : null;
}
function nearDMV() {
  return Math.hypot(state.player.x - dmv.x, state.player.z - (dmv.z - 20)) < 9;
}
function interact() {
  if (!state.started) return;
  if (state.mode === "drive") { exitCar(); return; }
  const car = nearCar();
  if (car) {
    if (!state.license && !state.test.active) {
      notify("You need a driving licence to drive this vehicle.", "warning");
      addWanted(1);
      return;
    }
    enterCar(car); return;
  }
  if (nearDMV()) {
    if (state.license) notify("Your licence is already valid. Stay safe out there.", "success");
    else startDrivingTest();
    return;
  }
  notify("Nothing to interact with here.");
}
function enterCar(car) {
  state.mode = "drive"; state.car = car; car.isPlayer = true; applyPaint(car, state.tuning.paint); addVehicleSpotlights(car); ensureAudio();
  state.player.x = car.mesh.position.x; state.player.z = car.mesh.position.z;
  car.speed = 0;
  notify(state.test.active ? "Test started. Follow the glowing checkpoints." : "Vehicle entered. Drive safe.");
  updateHUD();
}
function exitCar() {
  const car = state.car;
  car.isPlayer = false;
  state.mode = "walk";
  state.player.x = car.mesh.position.x + Math.sin(car.yaw) * 3.4;
  state.player.z = car.mesh.position.z + Math.cos(car.yaw) * 3.4;
  if (state.test.active) {
    state.test.active = false; testMarkers.forEach((m) => (m.visible = false));
    notify("Driving test abandoned. Return to the DMV to try again.", "warning");
  } else notify("You left the vehicle.");
  updateHUD();
}
function startDrivingTest() {
  state.test = { active: true, checkpoint: 0, time: 90, violations: 0, lastSpeedViolation: 90, lightChecks: {} };
  testMarkers.forEach((marker, i) => { marker.visible = i === 0; });
  const testCar = state.car;
  testCar.mesh.position.set(dmv.x, 0, dmv.z - 26);
  testCar.mesh.rotation.y = 0; testCar.x = dmv.x; testCar.z = dmv.z - 26; testCar.yaw = 0; testCar.isTest = true;
  enterCar(testCar);
  notify("Practical test started — reach every checkpoint before time runs out.", "success");
}
function finishTest(success) {
  if (success) {
    state.license = true; state.inventory = ["driving_license"]; state.test.active = false;
    testMarkers.forEach((m) => (m.visible = false)); saveProgress(); updateHUD();
    notify("TEST PASSED — driving_license added to your inventory.", "success");
  } else {
    state.test.active = false; testMarkers.forEach((m) => (m.visible = false)); updateHUD();
    notify("Test failed. Review the speed limit and try again at the DMV.", "warning");
  }
}
function addWanted(amount = 1) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + amount, 0, 5);
  if (state.wanted > before) {
    notify(state.wanted >= 3 ? "Police are on your tail. Lose the heat." : "Traffic violation reported.", "warning");
    if (state.wanted >= 2 && !traffic.some((car) => car.isPolice)) spawnPolice();
  }
}
function spawnPolice() {
  const police = createCar(state.car.mesh.position.x + 18, state.car.mesh.position.z + 18, 0, mats.police, true);
  addVehicleSpotlights(police);
  police.speed = 8;
}

function readInput() {
  const k = state.keys;
  let x = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0);
  let y = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.w ? 1 : 0);
  if (Math.abs(state.joystick.x) > .05 || Math.abs(state.joystick.y) > .05) { x = state.joystick.x; y = state.joystick.y; }
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), accelerate: !!(k.ArrowUp || k.w || state.action.accelerate || state.joystick.y < -.18), brake: !!(k.ArrowDown || k.s || state.action.brake || state.joystick.y > .35), handbrake: !!(k.Shift || state.action.handbrake) };
}
function updateWalk(delta) {
  const input = readInput();
  const hasMovement = Math.abs(input.x) + Math.abs(input.y) > .08;
  if (hasMovement) {
    const speed = 13 * delta;
    state.player.yaw = Math.atan2(input.x, -input.y);
    state.player.x += Math.sin(state.player.yaw) * speed * Math.min(1, Math.abs(input.y) + Math.abs(input.x));
    state.player.z += Math.cos(state.player.yaw) * speed * Math.min(1, Math.abs(input.y) + Math.abs(input.x));
    state.player.x = clamp(state.player.x, -198, 198); state.player.z = clamp(state.player.z, -198, 198);
  }
  if (nearDMV() && !state.license) $("#objective-text").textContent = "Press E at the DMV entrance to start your test";
  else if (nearCar() && !state.license) $("#objective-text").textContent = "Press E to enter • licence required";
}
function updateCar(delta) {
  const car = state.car, input = readInput();
  const throttle = input.accelerate ? 1 : 0;
  const braking = input.brake ? 1 : 0;
  const maxSpeed = state.test.active ? 15 : 35 + (state.tuning.engine - 1) * 3;
  if (throttle) car.speed += 24 * delta;
  if (braking) car.speed -= 32 * delta;
  car.speed -= car.speed * (input.handbrake ? 2.5 : .9) * delta;
  car.speed = clamp(car.speed, -8, maxSpeed);
  const steerStrength = clamp(Math.abs(car.speed) / 9, 0, 1.4);
  car.yaw += input.x * 2.2 * (1 + (state.tuning.handling - 1) * .18) * delta * steerStrength * (car.speed >= 0 ? 1 : -1);
  car.mesh.rotation.y = car.yaw;
  car.mesh.position.x += Math.sin(car.yaw) * car.speed * delta;
  car.mesh.position.z += Math.cos(car.yaw) * car.speed * delta;
  car.mesh.position.x = clamp(car.mesh.position.x, -199, 199); car.mesh.position.z = clamp(car.mesh.position.z, -199, 199);
  car.x = car.mesh.position.x; car.z = car.mesh.position.z;
  // A soft collision response keeps the prototype playable around the generated blocks.
  for (const object of worldObjects) {
    if (Math.abs(car.mesh.position.x - object.position.x) < 13 && Math.abs(car.mesh.position.z - object.position.z) < 13 && object.position.y > 1) {
      car.mesh.position.x -= Math.sin(car.yaw) * car.speed * delta * 3; car.mesh.position.z -= Math.cos(car.yaw) * car.speed * delta * 3; car.speed *= -.15;
    }
  }
  if (state.test.active) updateTest(delta);
  updatePolice(delta);
}
function updateTest(delta) {
  state.test.time -= delta;
  if (state.test.time <= 0 || state.test.violations >= 3) { finishTest(false); return; }
  const kmh = Math.abs(state.car.speed) * 3.6;
  if (kmh > 48 && state.test.time < state.test.lastSpeedViolation - 1.4) {
    state.test.violations++;
    state.test.lastSpeedViolation = state.test.time;
    addWanted(1);
    notify("Speed violation — keep it under 45 KM/H.", "warning");
  }
  if (kmh <= 48) state.test.lastSpeedViolation = state.test.time;
  for (const [x, z] of testIntersections) {
    const key = `${x}:${z}`;
    if (!state.test.lightChecks[key] && Math.hypot(state.car.x - x, state.car.z - z) < 7) {
      state.test.lightChecks[key] = true;
      if (Math.abs(state.car.speed) > 2.2) {
        state.test.violations++;
        addWanted(1);
        notify("Traffic light violation — stop at red lights.", "warning");
      }
    }
  }
  const target = testRoute[state.test.checkpoint];
  if (target && Math.hypot(state.car.x - target.x, state.car.z - target.z) < 8) {
    testMarkers[state.test.checkpoint].visible = false; state.test.checkpoint++;
    if (state.test.checkpoint >= testRoute.length) { finishTest(true); return; }
    testMarkers[state.test.checkpoint].visible = true; notify(`Checkpoint ${state.test.checkpoint} cleared. Keep going.`, "success");
  }
}
function updateTraffic(delta) {
  for (const car of traffic) {
    if (car.isPlayer) continue;
    if (car.isPolice) {
      const target = state.car.mesh.position;
      const dx = target.x - car.mesh.position.x, dz = target.z - car.mesh.position.z;
      car.yaw = Math.atan2(dx, dz); car.speed = lerp(car.speed, 10 + state.wanted * 2, delta * .8);
    } else {
      car.speed = 7;
      if (car.routeAxis === "x") car.mesh.position.x += Math.sin(car.yaw) * car.speed * delta;
      else car.mesh.position.z += Math.cos(car.yaw) * car.speed * delta;
      if (Math.abs(car.mesh.position.x) > 210 || Math.abs(car.mesh.position.z) > 210) {
        car.mesh.position.x = clamp(car.mesh.position.x, -205, 205); car.mesh.position.z = clamp(car.mesh.position.z, -205, 205); car.yaw += Math.PI;
      }
    }
    car.mesh.rotation.y = car.yaw; car.x = car.mesh.position.x; car.z = car.mesh.position.z;
  }
  if (state.wanted > 0 && state.mode === "walk") {
    state.wanted = Math.max(0, state.wanted - delta / 12);
  }
  if (state.wanted > 0 && state.mode === "drive" && state.wanted < 5 && Math.random() < delta * .02) state.wanted = Math.max(0, state.wanted - 1);
}
function updatePolice(delta) {
  if (state.wanted >= 2 && state.mode === "drive" && state.car.isTest === false && Math.random() < delta * .015) addWanted(1);
}
function updatePedestrians(time, delta) {
  for (const ped of pedestrians) {
    const distance = 7 * delta;
    if (ped.axis === "x") ped.mesh.position.x += Math.sin(time * .0005 + ped.phase) * distance;
    else ped.mesh.position.z += Math.cos(time * .0005 + ped.phase) * distance;
  }
}

const camTarget = new THREE.Vector3();
function updateCamera(delta) {
  let targetX, targetZ, yaw, height, distance;
  if (state.mode === "drive") {
    const car = state.car; targetX = car.mesh.position.x; targetZ = car.mesh.position.z; yaw = car.yaw; height = 8.2; distance = 13;
  } else {
    targetX = state.player.x; targetZ = state.player.z; yaw = state.player.yaw; height = 6.6; distance = 9;
  }
  const wanted = new THREE.Vector3(targetX - Math.sin(yaw) * distance, height, targetZ - Math.cos(yaw) * distance);
  camera.position.lerp(wanted, 1 - Math.pow(.001, delta));
  camTarget.set(targetX, state.mode === "drive" ? 1.2 : 1.3, targetZ);
  camera.lookAt(camTarget);
}

const mapCanvas = $("#minimap"), mapCtx = mapCanvas.getContext("2d");
function drawMinimap() {
  const w = mapCanvas.width, scale = w / 430;
  mapCtx.clearRect(0, 0, w, w); mapCtx.fillStyle = "#17252b"; mapCtx.fillRect(0, 0, w, w);
  mapCtx.fillStyle = "#2d3942";
  for (const p of ROAD_LINES) { mapCtx.fillRect((p + 215) * scale, 0, 19 * scale, w); mapCtx.fillRect(0, (p + 215) * scale, w, 19 * scale); }
  mapCtx.fillStyle = "rgba(116,130,137,.65)";
  for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) mapCtx.fillRect((ROAD_LINES[x] + 23 + 215) * scale, (ROAD_LINES[z] + 22 + 215) * scale, 27 * scale, 27 * scale);
  mapCtx.fillStyle = "#ff9e5c"; mapCtx.fillRect((dmv.x + 215) * scale - 3, (dmv.z + 215) * scale - 3, 7, 7);
  const px = state.mode === "drive" ? state.car.x : state.player.x, pz = state.mode === "drive" ? state.car.z : state.player.z;
  mapCtx.fillStyle = state.test.active ? "#ffb35c" : "#63e7e0"; mapCtx.beginPath(); mapCtx.arc((px + 215) * scale, (pz + 215) * scale, 4, 0, Math.PI * 2); mapCtx.fill();
  if (state.test.active) {
    const target = testRoute[state.test.checkpoint];
    if (target) { mapCtx.strokeStyle = "#ffb35c"; mapCtx.lineWidth = 2; mapCtx.beginPath(); mapCtx.arc((target.x + 215) * scale, (target.z + 215) * scale, 5, 0, Math.PI * 2); mapCtx.stroke(); }
  } else if (state.mission.id) {
    const mission = missionDefinitions.find((item) => item.id === state.mission.id), target = mission?.route[state.mission.checkpoint];
    if (target) { mapCtx.strokeStyle = "#63e7e0"; mapCtx.lineWidth = 2; mapCtx.beginPath(); mapCtx.arc((target.x + 215) * scale, (target.z + 215) * scale, 5, 0, Math.PI * 2); mapCtx.stroke(); }
  }
}

const audio = { ctx: null, engine: null, engineGain: null, siren: null, sirenGain: null };
function ensureAudio() {
  if (audio.ctx || (!window.AudioContext && !window.webkitAudioContext)) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audio.ctx = new AudioContext();
  audio.engine = audio.ctx.createOscillator(); audio.engine.type = "sawtooth"; audio.engine.frequency.value = 70;
  audio.engineGain = audio.ctx.createGain(); audio.engineGain.gain.value = 0;
  const engineFilter = audio.ctx.createBiquadFilter(); engineFilter.type = "lowpass"; engineFilter.frequency.value = 900;
  audio.engine.connect(engineFilter).connect(audio.engineGain).connect(audio.ctx.destination); audio.engine.start();
  audio.siren = audio.ctx.createOscillator(); audio.siren.type = "square"; audio.siren.frequency.value = 550;
  audio.sirenGain = audio.ctx.createGain(); audio.sirenGain.gain.value = 0;
  audio.siren.connect(audio.sirenGain).connect(audio.ctx.destination); audio.siren.start();
}
function updateAudio(time) {
  if (!audio.ctx) return;
  const driving = state.mode === "drive";
  const speed = driving ? Math.abs(state.car.speed) : 0;
  audio.engine.frequency.setTargetAtTime(58 + speed * 7 + (state.action.accelerate ? 22 : 0), audio.ctx.currentTime, .04);
  audio.engineGain.gain.setTargetAtTime(driving ? .025 + Math.min(speed / 800, .045) : 0, audio.ctx.currentTime, .08);
  const sirenActive = state.wanted >= 2;
  audio.siren.frequency.setTargetAtTime(480 + Math.sin(time * .006) * 170, audio.ctx.currentTime, .04);
  audio.sirenGain.gain.setTargetAtTime(sirenActive ? .018 : 0, audio.ctx.currentTime, .08);
}
function updateDayNight(delta) {
  state.dayTime = (state.dayTime + delta * 2) % 1440;
  const minute = state.dayTime;
  let left = dayPalette[0], right = dayPalette[1];
  for (let i = 0; i < dayPalette.length - 1; i++) {
    if (minute >= dayPalette[i].minute && minute <= dayPalette[i + 1].minute) {
      left = dayPalette[i]; right = dayPalette[i + 1]; break;
    }
  }
  const blend = (minute - left.minute) / (right.minute - left.minute || 1);
  const sky = dayScratch.sky.copy(left.sky).lerp(right.sky, blend);
  const ground = dayScratch.ground.copy(left.ground).lerp(right.ground, blend);
  const sunColor = dayScratch.sun.copy(left.sun).lerp(right.sun, blend);
  scene.background.copy(sky); scene.fog.color.copy(sky);
  hemi.color.copy(sky); hemi.groundColor.copy(ground);
  sun.color.copy(sunColor);
  const hour = minute / 60;
  const daylight = clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);
  const night = 1 - daylight;
  sun.intensity = .08 + daylight * 2.9;
  hemi.intensity = .48 + daylight * 1.48;
  sun.position.set(Math.cos(((hour - 12) / 12) * Math.PI) * 130, Math.max(-20, Math.sin(((hour - 6) / 12) * Math.PI) * 170), 80);
  scene.fog.near = lerp(130, isTouch ? 155 : 215, daylight);
  scene.fog.far = lerp(360, isTouch ? 470 : 650, daylight);
  mats.windows.emissive.set(0x07151e).lerp(dayScratch.window, night * .8);
  mats.windows.emissiveIntensity = .18 + night * .9;
  for (const streetLight of streetLights) {
    streetLight.light.intensity = night * 48;
    streetLight.fixture.material.emissiveIntensity = night * 2.2;
  }
  updateVehicleLights(night);
  const hourText = String(Math.floor(hour) % 24).padStart(2, "0");
  const minuteText = String(Math.floor(minute % 60)).padStart(2, "0");
  $("#world-time").textContent = `${hourText}:${minuteText}`;
  $("#world-period").textContent = hour < 5 || hour >= 21 ? "NIGHT" : hour < 7 ? "DAWN" : hour < 17 ? "DAY" : "DUSK";
  updateRain(delta);
  $("#weather-button").setAttribute("aria-pressed", String(state.raining));
  $("#weather-label").textContent = state.raining ? "RAIN" : "DRY";
}

// Keyboard and pointer controls.
addEventListener("keydown", (event) => {
  if (!state.started) return;
  ensureAudio();
  state.keys[event.key] = true;
  if (event.key.toLowerCase() === "e" && !event.repeat) interact();
  if (event.key.toLowerCase() === "i" && !event.repeat) showInventory();
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
});
addEventListener("keyup", (event) => { state.keys[event.key] = false; });
renderer.domElement.addEventListener("click", () => { if (state.started && !isTouch && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.(); });
addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === renderer.domElement && state.mode === "walk") state.player.yaw -= event.movementX * .0025;
});
function bindHold(selector, action) {
  document.querySelector(selector).addEventListener("pointerdown", (event) => { event.preventDefault(); ensureAudio(); state.action[action] = true; });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => document.querySelector(selector).addEventListener(type, () => { state.action[action] = false; }));
}
bindHold('[data-action="accelerate"]', "accelerate"); bindHold('[data-action="brake"]', "brake"); bindHold('[data-action="handbrake"]', "handbrake");
$('[data-action="interact"]').addEventListener("pointerdown", (event) => { event.preventDefault(); interact(); });
const joystick = $("#joystick"), knob = $("#joystick-knob");
function moveJoystick(event) {
  const rect = joystick.querySelector(".joystick-ring").getBoundingClientRect();
  const radius = rect.width / 2, dx = event.clientX - (rect.left + radius), dy = event.clientY - (rect.top + radius);
  const length = Math.hypot(dx, dy), ratio = Math.min(1, length / radius);
  state.joystick.x = dx / radius * Math.min(1, radius / Math.max(length, 1));
  state.joystick.y = dy / radius * Math.min(1, radius / Math.max(length, 1));
  knob.style.transform = `translate(calc(-50% + ${dx * ratio}px), calc(-50% + ${dy * ratio}px))`;
}
joystick.addEventListener("pointerdown", (event) => { state.joystick.active = true; joystick.setPointerCapture(event.pointerId); moveJoystick(event); });
joystick.addEventListener("pointermove", (event) => { if (state.joystick.active) moveJoystick(event); });
joystick.addEventListener("pointerup", () => { state.joystick.active = false; state.joystick.x = 0; state.joystick.y = 0; knob.style.transform = "translate(-50%, -50%)"; });

function animate(time = 0) {
  requestAnimationFrame(animate);
  const delta = Math.min(.05, clock.getDelta());
  if (state.started) {
    if (state.mode === "walk") updateWalk(delta); else updateCar(delta);
    updateMission(); updateTraffic(delta); updatePedestrians(time, delta); updateHUD(); drawMinimap(); updateAudio(time);
  }
  updateDayNight(delta);
  updateCamera(delta);
  renderer.render(scene, camera);
}
const clock = new THREE.Clock();
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
addEventListener("beforeunload", saveProgress);
setInterval(saveProgress, 5000);
setTimeout(() => $("#loading").classList.add("done"), 850);
updateHUD();
animate();