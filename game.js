import * as THREE from "three";

// yaw 0, pitch 0 looks down -z. Negative pitch looks down. Recoil adds to pitch.
const UP = new THREE.Vector3(0, 1, 0);
const EYE = 1.6;
const CROUCH_EYE = 1.08;
const BODY_RADIUS = 0.432;
const WALK_SPEED = 2.7;
const SPRINT_SPEED = 4.5;
const CROUCH_SPEED = 1.25;
const MOVE_ACCEL = 11;
const BOT_SPEED = 2.3;
const LEAN_OFFSET = 0.42;
const LEAN_YAW = 0.26;
const LEAN_ROLL = 0.08;
const FOOT_GAIN = { sprint: 0.9, walk: 0.42, crouch: 0.11 };
const WIN_SCORE = 5;
const WALL_HP = 100;
const SPAWN_LOCK = 1.5;
const ROUND_WAIT = 3;
const REPAIR_TIME = 1.25;
const REPAIR_REACH = 2.3;
const HIP_FOV = 72;

const X0 = -22;
const X1 = 22;
const Z0 = -16;
const Z1 = 16;
const HEIGHT = 4.5;
const THICK = 0.45;
const PIECE = 0.45;
const THIN = 0.07;
const SPAWN_A = [-18, 12];
const SPAWN_B = [18, -12];

const WEAPONS = [
  {
    id: "smg", name: "SMG", damage: 14, interval: 0.07, mag: 30,
    reload: 1.25, pellets: 1, spread: 0.02, recoil: 0.022,
    falloffStart: 12, falloffEnd: 32, minMult: 0.55,
    hint: "Circle sight with a red dot. No zoom. Fast shots, harder kick, 30-round mag",
  },
  {
    id: "ar", name: "AR", damage: 21, interval: 0.16, mag: 30,
    reload: 1.5, pellets: 1, spread: 0.007, recoil: 0.008,
    falloffStart: 20, falloffEnd: 45, minMult: 0.72,
    hint: "Circle sight with a red dot. 1.5x zoom. Slower, higher damage, 30-round mag",
  },
  {
    id: "shotgun", name: "Shotgun", damage: 7, interval: 0.34, mag: 2,
    reload: 1.7, pellets: 20, spread: 0.12, recoil: 0.02,
    falloffStart: 2.5, falloffEnd: 12, minMult: 0.08,
    hint: "Double barrel. 20 pellets. Big hole up close, scattered holes at range.",
  },
  {
    id: "sniper", name: "Sniper", damage: 100, interval: 1.2, mag: 1,
    reload: 1.35, pellets: 1, spread: 0, recoil: 0.03,
    falloffStart: 1000, falloffEnd: 1001, minMult: 1,
    hint: "Scope keeps the crosshair. One shot anywhere drops them.",
  },
  {
    id: "pistol", name: "Pistol", damage: 22, interval: 0.28, mag: 12,
    reload: 1.15, pellets: 1, spread: 0.012, recoil: 0.018,
    falloffStart: 10, falloffEnd: 28, minMult: 0.6,
    hint: "Iron sights. 1 is your primary, 2 is the pistol.",
  },
];

const PRIMARY_IDS = ["smg", "ar", "shotgun", "sniper"];
const STRIDE = 1.25;
const HOLE_RADIUS = { smg: 0.045, ar: 0.045, pistol: 0.04, sniper: 0.11, shotgun: 0.34 };
const SHOTGUN_FAR_HOLE = 0.042;
const HEAD_RADIUS = 0.28;
const HEAD_MULT = 2;
const MAX_HOLES = 16;
const BLOOM = {
  smg: { perShot: 0.0045, max: 0.055, recover: 0.24 },
  ar: { perShot: 0.007, max: 0.042, recover: 0.18 },
};
const MOVE_SPREAD = { smg: 0.014, ar: 0.011 };
const BODY_PARTS = [
  { y: 0.62, rx: 0.432, ry: 0.568, rz: 0.384, head: false },
  { y: 1.4, rx: 0.315, ry: 0.276, rz: 0.288, head: true },
  { y: 0.1, rx: 0.243, ry: 0.0756, rz: 0.189, head: false },
];
let primaryId = "ar";
let hipBloom = 0;
let ringBuilds = 0;
let holeGen = 0;
let holeCacheGen = -1;
const holeCache = new Map();
const wallPanels = new Map();

const POSES = {
  smg: { hip: [0.18, -0.16, -0.52], ads: [0, -0.08, -0.38], fov: 72 },
  ar: { hip: [0.18, -0.16, -0.58], ads: [0, -0.095, -0.42], fov: 48 },
  shotgun: { hip: [0.18, -0.16, -0.5], ads: [0, -0.06, -0.36], fov: 60 },
  sniper: { hip: [0.16, -0.15, -0.64], ads: [0, -0.07, -0.48], fov: 28 },
  pistol: { hip: [0.2, -0.18, -0.4], ads: [0, -0.1, -0.34], fov: 68 },
};

const DIFFICULTY = {
  easy: { label: "Easy", speed: 1.5, spread: 0.11, reaction: 0.7, range: 16, jitter: 0.35, retarget: [2.2, 4.0] },
  medium: { label: "Medium", speed: BOT_SPEED, spread: 0.04, reaction: 0.22, range: 30, jitter: 0.7, retarget: [1.1, 2.4] },
  hard: { label: "Hard", speed: 3.2, spread: 0.012, reaction: 0.08, range: 42, jitter: 1.05, retarget: [0.55, 1.3] },
  hacker: { label: "Hacker", speed: 4.2, spread: 0, reaction: 0, range: 70, jitter: 1.35, retarget: [0.28, 0.75] },
};

const ROAM = [
  [0, 0], [0, 4], [0, -4], [0, 8], [0, -8],
  [-10, 0], [10, 0], [-16, 0], [16, 0], [-8, 0], [8, 0],
  [-10, 8], [10, -8], [-8, -8], [8, 8], [-4, 3], [4, -3],
  [-18, 4], [18, -4], [-16, 8], [16, -8], [-3, 9], [3, -9],
  [-12, 4], [12, -4], [2, 1], [-2, -1],
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1e24);
const camera = new THREE.PerspectiveCamera(HIP_FOV, 1, 0.08, 120);
camera.rotation.order = "YXZ";
scene.add(camera);

const keys = {};
const DEFAULT_BINDS = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sprint: "ShiftLeft",
  crouch: "ControlLeft",
  leanLeft: "KeyQ",
  leanRight: "KeyF",
  reload: "KeyR",
  repair: "KeyE",
  primary: "Digit1",
  pistol: "Digit2",
};
const BIND_ORDER = [
  ["forward", "Move forward"],
  ["back", "Move back"],
  ["left", "Move left"],
  ["right", "Move right"],
  ["sprint", "Sprint"],
  ["crouch", "Crouch"],
  ["leanLeft", "Lean left"],
  ["leanRight", "Lean right"],
  ["reload", "Reload"],
  ["repair", "Repair"],
  ["primary", "Primary weapon"],
  ["pistol", "Pistol"],
];
const binds = { ...DEFAULT_BINDS };
const SETTINGS_KEY = "arena-settings";
let lookSens = 1;
let listeningBind = null;
let audioMuted = false;
let audioCtx = null;
let stepBuffers = null;
let shotBuffer = null;
let boomBuffer = null;
let lastSound = null;
const boxes = [];
const tracers = [];
const netEvents = [];
const seenEvents = new Set();
let nextId = 1;
let renderer = null;
let freezeBot = false;
let matchOver = false;
let resetIn = 0;
let roundWait = 0;
let banner = "";
let damageFlash = 0;
let hitMarker = 0;
let playing = false;
let mode = "bot";
let roomCode = "";
let playerId = "";
let ads = 0;
let adsHeld = false;
let repair = 0;
let repairTarget = null;
let menuYaw = 0.4;
let difficulty = "medium";
let paused = false;
let pauseOpen = false;
let mouseDown = false;
let botGoal = null;
let botRetarget = 0;
let botSee = 0;
let botPause = 0;
let lockLostAt = 0;

function makeActor(spawnX, spawnZ) {
  return {
    x: spawnX,
    z: spawnZ,
    spawnX,
    spawnZ,
    yaw: 0,
    pitch: 0,
    health: 100,
    kills: 0,
    alive: true,
    spawnLock: SPAWN_LOCK,
    respawnIn: 0,
    weapon: 0,
    ammo: freshAmmo(),
    reload: 0,
    reloadId: null,
    cooldown: 0,
    strafe: 1,
    strafeTime: 0,
    vx: 0,
    vz: 0,
    walkX: spawnX,
    walkZ: spawnZ,
    walkDistance: 0,
    walkBlend: 0,
    crouch: 0,
    lean: 0,
    gait: "walk",
    stepX: spawnX,
    stepZ: spawnZ,
    stepCarry: 0,
    mesh: null,
    visor: null,
    rig: null,
  };
}

const player = makeActor(SPAWN_A[0], SPAWN_A[1]);
const bot = makeActor(SPAWN_B[0], SPAWN_B[1]);
player.yaw = Math.atan2(-(bot.spawnX - player.spawnX), -(bot.spawnZ - player.spawnZ));

function freshAmmo() {
  const ammo = {};
  for (const weapon of WEAPONS) ammo[weapon.id] = weapon.mag;
  return ammo;
}

function falloff(weapon, distance) {
  if (distance <= weapon.falloffStart) return 1;
  if (distance >= weapon.falloffEnd) return weapon.minMult;
  const t = (distance - weapon.falloffStart) / (weapon.falloffEnd - weapon.falloffStart);
  return 1 + (weapon.minMult - 1) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setSeat(index) {
  const mine = index === 0 ? SPAWN_A : SPAWN_B;
  const theirs = index === 0 ? SPAWN_B : SPAWN_A;
  player.spawnX = mine[0];
  player.spawnZ = mine[1];
  bot.spawnX = theirs[0];
  bot.spawnZ = theirs[1];
}

const _uvPoint = new THREE.Vector3();

function stampWallUVs(mesh, axis) {
  const position = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;
  if (!position || !uv) return;
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < position.count; i += 1) {
    _uvPoint.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    const along = axis === "x" ? _uvPoint.z : _uvPoint.x;
    uv.setXY(i, along * 0.42, _uvPoint.y * 0.42);
  }
  uv.needsUpdate = true;
}

function addBox(minX, minY, minZ, maxX, maxY, maxZ, color, breakable, material, axis) {
  const geometry = new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ);
  const mat = material || new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  scene.add(mesh);
  const box = {
    id: nextId,
    minX, minY, minZ, maxX, maxY, maxZ,
    breakable,
    hp: breakable ? WALL_HP : Infinity,
    maxHp: breakable ? WALL_HP : Infinity,
    mesh,
    base: new THREE.Color(color),
    holes: [],
    axis: axis || null,
    holed: false,
  };
  nextId += 1;
  boxes.push(box);
  if (axis) stampWallUVs(mesh, axis);
  return box;
}

function addSectionWall(axis, fixed, from, to, height) {
  const span = to - from;
  const cols = Math.max(1, Math.round(span / PIECE));
  const rows = Math.max(1, Math.round(height / PIECE));
  const cell = span / cols;
  const cellY = height / rows;
  for (let row = 0; row < rows; row += 1) {
    const y = row * cellY;
    const y1 = (row + 1) * cellY;
    for (let col = 0; col < cols; col += 1) {
      const along = from + col * cell;
      const end = from + (col + 1) * cell;
      if (axis === "x") {
        addBox(fixed - THIN / 2, y, along, fixed + THIN / 2, y1, end, 0xe7e1d6, true, drywallMat, "x");
      } else {
        addBox(along, y, fixed - THIN / 2, end, y1, fixed + THIN / 2, 0xe7e1d6, true, drywallMat, "z");
      }
    }
  }
  addHouseTrim(axis, fixed, from, to, height);
}

function paintCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  return canvas;
}

function hashUnit(n) {
  const value = Math.sin(n * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function plasterTexture() {
  const canvas = paintCanvas();
  const draw = canvas.getContext("2d");
  draw.fillStyle = "#e7e1d6";
  draw.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i += 1) {
    const x = hashUnit(i * 3.1) * 256;
    const y = hashUnit(i * 5.7) * 256;
    const radius = 2 + hashUnit(i * 9.2) * 8;
    const light = hashUnit(i * 2.3) > 0.5;
    draw.fillStyle = light ? "rgba(255,252,247,0.045)" : "rgba(110,90,70,0.03)";
    for (const ox of [-256, 0, 256]) {
      for (const oy of [-256, 0, 256]) {
        draw.beginPath();
        draw.ellipse(x + ox, y + oy, radius, radius * 0.65, 0, 0, Math.PI * 2);
        draw.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function woodFloorTexture() {
  const canvas = paintCanvas();
  const draw = canvas.getContext("2d");
  const planks = ["#8d6439", "#7a552f", "#966b40", "#6d4b2b", "#835c36"];
  const plankH = 32;
  for (let y = 0; y < 256; y += plankH) {
    const row = y / plankH;
    draw.fillStyle = planks[row % planks.length];
    draw.fillRect(0, y, 256, plankH);
    draw.fillStyle = "rgba(255,220,170,0.05)";
    draw.fillRect(0, y, 256, 3);
    draw.strokeStyle = "rgba(42,24,12,0.55)";
    draw.lineWidth = 2;
    draw.beginPath();
    draw.moveTo(0, y + plankH - 1);
    draw.lineTo(256, y + plankH - 1);
    draw.stroke();
    const offset = row % 2 === 0 ? 18 : 86;
    for (let x = offset; x < 256; x += 128) {
      draw.beginPath();
      draw.moveTo(x, y + 1);
      draw.lineTo(x, y + plankH - 1);
      draw.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const drywallMat = new THREE.MeshLambertMaterial({
  color: 0xffffff,
  map: plasterTexture(),
  side: THREE.DoubleSide,
});
const floorMat = new THREE.MeshLambertMaterial({
  color: 0xffffff,
  map: woodFloorTexture(),
  side: THREE.DoubleSide,
});
const ceilingMat = new THREE.MeshLambertMaterial({ color: 0xf4f1ea, side: THREE.DoubleSide });
const trimMat = new THREE.MeshLambertMaterial({ color: 0x5a4332, side: THREE.DoubleSide });
const crownMat = new THREE.MeshLambertMaterial({ color: 0xf7f4ee, side: THREE.DoubleSide });
const holeRingMat = new THREE.MeshBasicMaterial({ color: 0x2a2118, side: THREE.DoubleSide });
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe7a3 });
const boomTracerMat = new THREE.LineBasicMaterial({ color: 0xf0c14a });

function addTrimMesh(minX, minY, minZ, maxX, maxY, maxZ, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ),
    material,
  );
  mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  scene.add(mesh);
}

// Baseboards and crown are visual only. They are not added to `boxes`.
function addHouseTrim(axis, fixed, from, to, height) {
  const proud = 0.02;
  const boardH = 0.12;
  const full = height >= HEIGHT - 0.05;
  for (const side of [-1, 1]) {
    const face = fixed + side * (THIN / 2);
    const outer = face + side * proud;
    const minFixed = Math.min(face, outer);
    const maxFixed = Math.max(face, outer);
    if (axis === "x") {
      addTrimMesh(minFixed, 0, from, maxFixed, boardH, to, trimMat);
      if (full) addTrimMesh(minFixed, height - 0.08, from, maxFixed, height, to, crownMat);
    } else {
      addTrimMesh(from, 0, minFixed, to, boardH, maxFixed, trimMat);
      if (full) addTrimMesh(from, height - 0.08, minFixed, to, height, maxFixed, crownMat);
    }
  }
  if (!full) {
    if (axis === "x") addTrimMesh(fixed - THIN / 2 - proud, height - 0.035, from, fixed + THIN / 2 + proud, height, to, trimMat);
    else addTrimMesh(from, height - 0.035, fixed - THIN / 2 - proud, to, height, fixed + THIN / 2 + proud, trimMat);
  }
}

function addShellTrim() {
  const proud = 0.02;
  const boardH = 0.12;
  const innerWest = X0 + THICK;
  const innerEast = X1 - THICK;
  const innerSouth = Z0 + THICK;
  const innerNorth = Z1 - THICK;
  addTrimMesh(innerWest, 0, Z0 + THICK, innerWest + proud, boardH, Z1 - THICK, trimMat);
  addTrimMesh(innerEast - proud, 0, Z0 + THICK, innerEast, boardH, Z1 - THICK, trimMat);
  addTrimMesh(X0 + THICK, 0, innerSouth, X1 - THICK, boardH, innerSouth + proud, trimMat);
  addTrimMesh(X0 + THICK, 0, innerNorth - proud, X1 - THICK, boardH, innerNorth, trimMat);
  addTrimMesh(innerWest, HEIGHT - 0.08, Z0 + THICK, innerWest + proud, HEIGHT, Z1 - THICK, crownMat);
  addTrimMesh(innerEast - proud, HEIGHT - 0.08, Z0 + THICK, innerEast, HEIGHT, Z1 - THICK, crownMat);
  addTrimMesh(X0 + THICK, HEIGHT - 0.08, innerSouth, X1 - THICK, HEIGHT, innerSouth + proud, crownMat);
  addTrimMesh(X0 + THICK, HEIGHT - 0.08, innerNorth - proud, X1 - THICK, HEIGHT, innerNorth, crownMat);
}

function buildOuterCuboid() {
  addBox(X0, -THICK, Z0, X1, 0, Z1, 0xffffff, false, floorMat, null);
  addBox(X0, HEIGHT, Z0, X1, HEIGHT + THICK, Z1, 0xf4f1ea, false, ceilingMat, null);
  addBox(X0, 0, Z0, X0 + THICK, HEIGHT, Z1, 0xe7e1d6, false, drywallMat, "x");
  addBox(X1 - THICK, 0, Z0, X1, HEIGHT, Z1, 0xe7e1d6, false, drywallMat, "x");
  addBox(X0, 0, Z0, X1, HEIGHT, Z0 + THICK, 0xe7e1d6, false, drywallMat, "z");
  addBox(X0, 0, Z1 - THICK, X1, HEIGHT, Z1, 0xe7e1d6, false, drywallMat, "z");
  addShellTrim();
}

function buildInnerWalls() {
  addSectionWall("x", -14, -6, 6, HEIGHT);
  addSectionWall("x", -6, -14, -2, HEIGHT);
  addSectionWall("x", -6, 2, 14, HEIGHT);
  addSectionWall("x", 6, -14, -2, HEIGHT);
  addSectionWall("x", 6, 2, 14, HEIGHT);
  addSectionWall("x", 14, -6, 6, HEIGHT);
  addSectionWall("z", 10, -16, -8, HEIGHT);
  addSectionWall("z", 10, 8, 16, HEIGHT);
  addSectionWall("z", -10, -16, -8, HEIGHT);
  addSectionWall("z", -10, 8, 16, HEIGHT);
  addSectionWall("z", 7, -14, -8, HEIGHT);
  addSectionWall("z", -7, 8, 14, HEIGHT);
  addSectionWall("z", 12, -5.4, 5.4, HEIGHT);
  addSectionWall("z", -12, -5.4, 5.4, HEIGHT);
  addSectionWall("z", 5, -12, -7.4, 2.7);
  addSectionWall("z", -5, 7.4, 12, 2.7);
  indexWalls();
}

function buildBotMesh() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const flesh = new THREE.MeshLambertMaterial({ color: 0xe08b6a });
  const bellyMat = new THREE.MeshLambertMaterial({ color: 0xf3c7ad });
  const eyeWhite = new THREE.MeshLambertMaterial({ color: 0xf6f3ee });
  const pupil = new THREE.MeshLambertMaterial({ color: 0x1c1a18 });

  const addSphere = (parent, radius, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const lower = addSphere(body, 0.4, flesh, 0, 0.62, 0);
  lower.scale.set(1.08, 1.42, 0.96);
  const head = addSphere(body, 0.3, flesh, 0, 1.4, -0.02);
  head.scale.set(1.05, 0.92, 0.96);
  const tummy = addSphere(body, 0.2, bellyMat, 0, 0.72, -0.28);
  tummy.scale.set(1.15, 1.25, 0.42);
  const foot = addSphere(body, 0.18, flesh, 0, 0.1, 0.02);
  foot.scale.set(1.35, 0.42, 1.05);
  for (const side of [-1, 1]) {
    addSphere(body, 0.075, eyeWhite, 0.11 * side, 1.48, -0.2);
    addSphere(body, 0.038, pupil, 0.115 * side, 1.48, -0.26);
  }
  const visor = addSphere(body, 0.045, pupil, 0, 1.34, -0.34);

  const aim = new THREE.Group();
  aim.name = "aim";
  group.add(aim);
  const held = new THREE.Group();
  held.name = "held-gun";
  aim.add(held);
  group.position.set(bot.x, 0, bot.z);
  scene.add(group);
  bot.mesh = group;
  bot.body = body;
  bot.aim = aim;
  bot.gun = held;
  bot.visor = visor;
  bot.rig = null;
  showBotGun();
}

const _blobFwd = new THREE.Vector3();
const _blobRight = new THREE.Vector3();

function poseBlob(distance, blend, vx, vz) {
  const body = bot.body;
  if (!body || !bot.mesh) return;
  const wobble = Math.sin((distance / STRIDE) * Math.PI * 2) * (blend || 0);
  let sx = 1 - wobble * 0.05;
  let sy = 1 - Math.abs(wobble) * 0.04;
  const szBase = 1 + wobble * 0.08;
  const useVx = vx === undefined ? bot.vx : vx;
  const useVz = vz === undefined ? bot.vz : vz;
  bot.mesh.updateMatrixWorld(true);
  _blobFwd.set(0, 0, -1).applyQuaternion(bot.mesh.quaternion);
  _blobFwd.y = 0;
  if (_blobFwd.lengthSq() < 1e-8) _blobFwd.set(0, 0, -1);
  else _blobFwd.normalize();
  _blobRight.crossVectors(_blobFwd, UP);
  const along = clamp((useVx * _blobFwd.x + useVz * _blobFwd.z) / 6, -1, 1);
  const side = clamp((useVx * _blobRight.x + useVz * _blobRight.z) / 6, -1, 1);
  const sz = szBase + along * 0.12;
  sx += Math.abs(side) * 0.08 - Math.abs(along) * 0.02;
  sy -= Math.abs(along) * 0.03;
  sy *= 1 - (bot.crouch || 0) * 0.28;
  body.scale.set(sx, sy, sz);
}

function updateWalk(dt) {
  if (!bot.body) return;
  const prevX = bot.walkX;
  const prevZ = bot.walkZ;
  const moved = Math.hypot(bot.x - prevX, bot.z - prevZ);
  bot.walkX = bot.x;
  bot.walkZ = bot.z;
  const stepped = moved > 0.004 && moved < 1.25;
  if (stepped) bot.walkDistance += moved;
  const want = stepped ? 1 : 0;
  bot.walkBlend += (want - bot.walkBlend) * Math.min(1, (dt || 0) * (stepped ? 14 : 8));
  let vx = bot.vx;
  let vz = bot.vz;
  if (stepped && dt > 0 && Math.hypot(vx, vz) < 0.05) {
    vx = (bot.x - prevX) / dt;
    vz = (bot.z - prevZ) / dt;
  }
  poseBlob(bot.walkDistance, bot.walkBlend, vx, vz);
  updateSteps(bot, dt, false);
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0xfff5e8, 0.58));
  scene.add(new THREE.HemisphereLight(0xfff3e2, 0xc4a27a, 0.5));
  const sun = new THREE.DirectionalLight(0xfff6e8, 0.72);
  sun.position.set(6, 12, 4);
  scene.add(sun);
}

const gun = new THREE.Group();
camera.add(gun);
let gunRoot = gun;

function addGunMesh(mesh) {
  gunRoot.add(mesh);
  return mesh;
}

function makeBox(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  addGunMesh(mesh);
}

function makeBarrel(radius, length, color, x, y, z, sight) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.92, length, 10),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  if (sight) mesh.userData.sight = true;
  addGunMesh(mesh);
}

function addMuzzle(x, y, z) {
  const marker = new THREE.Object3D();
  marker.name = "muzzle";
  marker.position.set(x, y, z);
  addGunMesh(marker);
}

function addIronSights(sightY, frontZ, rearZ) {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.046, 0.005),
    new THREE.MeshLambertMaterial({ color: 0xe7eef4 }),
  );
  post.position.set(0, sightY + 0.01, frontZ);
  post.userData.sight = true;
  addGunMesh(post);
  makeBox(0.007, 0.03, 0.012, 0x1a1c20, -0.013, sightY, frontZ);
  makeBox(0.007, 0.03, 0.012, 0x1a1c20, 0.013, sightY, frontZ);
  makeBox(0.006, 0.034, 0.01, 0xd5dde6, -0.016, sightY + 0.008, rearZ);
  makeBox(0.006, 0.034, 0.01, 0xd5dde6, 0.016, sightY + 0.008, rearZ);
  makeBox(0.04, 0.006, 0.01, 0xd5dde6, 0, sightY - 0.012, rearZ);
}

function addBeadSight(sightY, frontZ, rearZ) {
  const bead = new THREE.Mesh(
    new THREE.SphereGeometry(0.011, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xf2f0ea }),
  );
  bead.position.set(0, sightY, frontZ);
  bead.userData.sight = true;
  addGunMesh(bead);
  makeBox(0.008, 0.03, 0.01, 0x141414, -0.016, sightY + 0.006, rearZ);
  makeBox(0.008, 0.03, 0.01, 0x141414, 0.016, sightY + 0.006, rearZ);
  makeBox(0.04, 0.008, 0.01, 0x141414, 0, sightY - 0.012, rearZ);
  makeBox(0.012, 0.006, Math.abs(frontZ - rearZ) * 0.7, 0x3a3e44, 0, sightY - 0.016, (frontZ + rearZ) / 2);
}

function addRedDot(sightY, z) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.021, 0.0036, 8, 28),
    new THREE.MeshLambertMaterial({ color: 0xdfe6ee }),
  );
  ring.position.set(0, sightY, z);
  ring.userData.sight = true;
  addGunMesh(ring);
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.0042, 16),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a, side: THREE.DoubleSide }),
  );
  dot.position.set(0, sightY, z + 0.006);
  dot.userData.sight = true;
  addGunMesh(dot);
}

function buildSmg() {
  const sightY = -POSES.smg.ads[1];
  makeBox(0.07, 0.1, 0.26, 0x2c3036, 0, 0, -0.14);
  makeBarrel(0.016, 0.2, 0x1a1c1f, 0, 0.02, -0.36);
  makeBox(0.045, 0.14, 0.055, 0x111111, 0, -0.11, -0.08);
  makeBox(0.055, 0.08, 0.1, 0x3a2a22, 0, -0.01, 0.05);
  makeBox(0.048, 0.09, 0.05, 0x22262b, 0, -0.07, 0.01);
  makeBox(0.02, 0.012, 0.08, 0x22262b, 0, sightY - 0.02, -0.16);
  addRedDot(sightY, -0.2);
  addMuzzle(0, 0.02, -0.46);
}

function buildAr() {
  const sightY = -POSES.ar.ads[1];
  makeBox(0.072, 0.09, 0.34, 0x34383e, 0, 0, -0.18);
  makeBarrel(0.014, 0.32, 0x1c1e22, 0, 0.015, -0.5);
  makeBox(0.048, 0.16, 0.065, 0x141414, 0, -0.12, -0.08);
  makeBox(0.055, 0.075, 0.16, 0x5a3a24, 0, 0, 0.08);
  makeBox(0.02, 0.016, 0.16, 0x22262b, 0, sightY - 0.028, -0.2);
  makeBox(0.044, 0.1, 0.055, 0x2a2e32, 0, -0.08, 0.02);
  makeBox(0.02, 0.02, 0.08, 0xc9843a, 0.04, 0, -0.1);
  addRedDot(sightY, -0.22);
  addMuzzle(0, 0.015, -0.66);
}

function buildShotgun() {
  const sightY = -POSES.shotgun.ads[1];
  makeBox(0.08, 0.075, 0.2, 0x3a332c, 0, 0, -0.1);
  makeBarrel(0.018, 0.34, 0x2a2d31, -0.02, 0.02, -0.36);
  makeBarrel(0.018, 0.34, 0x3d4248, 0.02, 0.02, -0.36);
  makeBox(0.07, 0.07, 0.18, 0x6b4428, 0, -0.005, 0.1);
  makeBox(0.04, 0.1, 0.05, 0x6b4428, 0, -0.08, 0.02);
  addBeadSight(sightY, -0.5, -0.04);
  addMuzzle(0, 0.02, -0.53);
}

function addScope(sightY) {
  const ring = (radius, tube, z) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 20),
      new THREE.MeshLambertMaterial({ color: 0xcfd6d2 }),
    );
    mesh.position.set(0, sightY, z);
    mesh.userData.sight = true;
    addGunMesh(mesh);
  };
  ring(0.026, 0.006, -0.08);
  ring(0.02, 0.005, -0.2);
  ring(0.034, 0.008, -0.33);
  makeBox(0.008, 0.008, 0.24, 0x1a1e1a, 0.032, sightY, -0.2);
  makeBox(0.008, 0.008, 0.24, 0x1a1e1a, -0.032, sightY, -0.2);
  makeBox(0.008, 0.008, 0.24, 0x1a1e1a, 0, sightY + 0.03, -0.2);
  makeBox(0.008, 0.008, 0.24, 0x1a1e1a, 0, sightY - 0.03, -0.2);
}

function buildSniper() {
  const sightY = -POSES.sniper.ads[1];
  makeBox(0.068, 0.078, 0.38, 0x2a2e28, 0, 0, -0.2);
  makeBarrel(0.012, 0.52, 0x1a1c1a, 0, 0.01, -0.64);
  addScope(sightY);
  makeBox(0.016, 0.028, 0.016, 0x22262b, 0, sightY + 0.034, -0.2);
  makeBox(0.058, 0.068, 0.2, 0x5c4030, 0, -0.01, 0.12);
  makeBox(0.038, 0.1, 0.048, 0x5c4030, 0, -0.08, 0.02);
  makeBox(0.018, 0.018, 0.08, 0xc9843a, 0.042, 0, -0.04);
  addMuzzle(0, 0.01, -0.9);
}

function buildPistol() {
  const sightY = -POSES.pistol.ads[1];
  makeBox(0.04, 0.05, 0.16, 0x2a2e32, 0, 0.015, -0.06);
  makeBarrel(0.01, 0.09, 0x1a1c1f, 0, 0.02, -0.16);
  makeBox(0.036, 0.11, 0.048, 0x3a2a22, 0, -0.06, -0.01);
  makeBox(0.028, 0.04, 0.04, 0x22262b, 0, -0.02, 0.03);
  addIronSights(sightY, -0.14, 0.01);
  addMuzzle(0, 0.02, -0.205);
}

function placeGun() {
  const pose = POSES[WEAPONS[player.weapon].id];
  gun.position.set(
    pose.hip[0] + (pose.ads[0] - pose.hip[0]) * ads,
    pose.hip[1] + (pose.ads[1] - pose.hip[1]) * ads,
    pose.hip[2] + (pose.ads[2] - pose.hip[2]) * ads,
  );
}

function clearGun(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  }
}

function fillGun(parent, id) {
  const previous = gunRoot;
  gunRoot = parent;
  try {
    if (id === "smg") buildSmg();
    else if (id === "ar") buildAr();
    else if (id === "shotgun") buildShotgun();
    else if (id === "pistol") buildPistol();
    else buildSniper();
  } finally {
    gunRoot = previous;
  }
}

function showGun() {
  clearGun(gun);
  fillGun(gun, WEAPONS[player.weapon].id);
  placeGun();
}

const HOLD = {
  smg: [0.34, 0.96, -0.36],
  ar: [0.32, 1.0, -0.3],
  shotgun: [0.32, 0.94, -0.32],
  sniper: [0.3, 1.04, -0.24],
  pistol: [0.38, 0.92, -0.46],
};

function showBotGun() {
  if (!bot.gun) return;
  const weapon = WEAPONS[bot.weapon] || WEAPONS[0];
  if (bot.gun.userData.id === weapon.id && bot.gun.children.length) return;
  clearGun(bot.gun);
  fillGun(bot.gun, weapon.id);
  bot.gun.userData.id = weapon.id;
}

function poseOpponent() {
  if (!bot.mesh) return;
  bot.mesh.position.set(bot.x, 0, bot.z);
  bot.mesh.rotation.y = bot.yaw;
  showBotGun();
  if (!bot.aim) return;
  const weapon = WEAPONS[bot.weapon] || WEAPONS[0];
  const hold = HOLD[weapon.id] || HOLD.ar;
  const crouchDrop = 1 - (bot.crouch || 0) * 0.28;
  bot.aim.position.set(hold[0], hold[1] * crouchDrop, hold[2]);
  bot.aim.rotation.y = 0;
  bot.aim.rotation.z = 0;
  bot.aim.rotation.x = bot.pitch || 0;
  if (bot.body) bot.body.rotation.x = (bot.pitch || 0) * 0.35;
}

function updateAds(dt) {
  const want = adsHeld && playing && player.alive && roundWait <= 0 && !matchOver ? 1 : 0;
  ads += (want - ads) * Math.min(1, dt * 12);
  placeGun();
  const pose = POSES[WEAPONS[player.weapon].id];
  camera.fov = HIP_FOV + (pose.fov - HIP_FOV) * ads;
  camera.updateProjectionMatrix();
  const scoped = WEAPONS[player.weapon].id === "sniper" && ads > 0.8;
  const scope = document.getElementById("scope");
  const cross = document.getElementById("cross");
  if (scope) scope.classList.toggle("on", scoped);
  const keepCross = WEAPONS[player.weapon].id === "sniper" || ads <= 0.08;
  if (cross) cross.style.display = keepCross ? "block" : "none";
  gun.visible = !scoped;
  updateCrosshair();
}

function eyeHeight(actor) {
  return EYE + (CROUCH_EYE - EYE) * (actor.crouch || 0);
}

function aimHeight(actor) {
  return 1.45 - (actor.crouch || 0) * 0.55;
}

function headCenterY(actor) {
  return 1.4 * crouchScale(actor);
}

function chestHeight(actor) {
  return 0.98 - (actor.crouch || 0) * 0.42;
}

function shotgunHoleRadius(distance) {
  if (distance <= 2.4) return HOLE_RADIUS.shotgun;
  if (distance >= 8.5) return SHOTGUN_FAR_HOLE;
  const blend = (distance - 2.4) / (8.5 - 2.4);
  return HOLE_RADIUS.shotgun + (SHOTGUN_FAR_HOLE - HOLE_RADIUS.shotgun) * blend;
}

function syncCamera() {
  const lean = player.lean || 0;
  camera.rotation.z = 0;
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  camera.position.set(player.x, eyeHeight(player), player.z);
  camera.updateMatrixWorld(true);
  if (lean !== 0) {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    right.y = 0;
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    else right.normalize();
    camera.position.addScaledVector(right, lean * LEAN_OFFSET);
    camera.rotation.y = player.yaw + lean * LEAN_YAW;
    camera.rotation.z = -lean * LEAN_ROLL;
    camera.updateMatrixWorld(true);
  }
}

function playerPlanarBasis() {
  syncCamera();
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, UP);
  return { forward, right };
}

function aimBasis(direction) {
  const right = new THREE.Vector3().crossVectors(direction, UP);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  return { right, up };
}

function rayBox(ox, oy, oz, dx, dy, dz, box, maxT) {
  let tmin = 0;
  let tmax = maxT;
  const mins = [box.minX, box.minY, box.minZ];
  const maxs = [box.maxX, box.maxY, box.maxZ];
  const origin = [ox, oy, oz];
  const delta = [dx, dy, dz];
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(delta[axis]) < 1e-8) {
      if (origin[axis] < mins[axis] || origin[axis] > maxs[axis]) return null;
      continue;
    }
    let near = (mins[axis] - origin[axis]) / delta[axis];
    let far = (maxs[axis] - origin[axis]) / delta[axis];
    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }
    tmin = Math.max(tmin, near);
    tmax = Math.min(tmax, far);
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : tmax;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius) {
  const lx = ox - cx;
  const ly = oy - cy;
  const lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const near = -b - root;
  if (near > 0.02) return near;
  const far = -b + root;
  if (far > 0.02) return far;
  return null;
}

function crouchScale(actor) {
  return 1 - (actor.crouch || 0) * 0.28;
}

function bodyTop(actor) {
  const sy = crouchScale(actor);
  let top = 0;
  for (const part of BODY_PARTS) top = Math.max(top, (part.y + part.ry) * sy);
  return top;
}

function supportAlong(part, yaw, dirX, dirZ) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const lx = dirX * c - dirZ * s;
  const lz = dirX * s + dirZ * c;
  return Math.hypot(part.rx * lx, part.rz * lz);
}

function radiusAt(actor, y, dirX, dirZ) {
  const sy = crouchScale(actor);
  const yaw = actor.yaw || 0;
  let best = 0;
  for (const part of BODY_PARTS) {
    const cy = part.y * sy;
    const ry = part.ry * sy;
    if (ry < 1e-4) continue;
    const t = (y - cy) / ry;
    if (t * t >= 1) continue;
    best = Math.max(best, supportAlong(part, yaw, dirX, dirZ) * Math.sqrt(1 - t * t));
  }
  return best;
}

function actorBox(actor) {
  const top = bodyTop(actor);
  return {
    minX: actor.x - BODY_RADIUS,
    maxX: actor.x + BODY_RADIUS,
    minY: 0,
    maxY: top,
    minZ: actor.z - BODY_RADIUS,
    maxZ: actor.z + BODY_RADIUS,
  };
}

function rayEllipsoid(ox, oy, oz, dx, dy, dz, cx, cy, cz, yaw, rx, ry, rz) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const lx = ox - cx;
  const lz = oz - cz;
  const oxl = (lx * c - lz * s) / rx;
  const ozl = (lx * s + lz * c) / rz;
  const dxl = (dx * c - dz * s) / rx;
  const dzl = (dx * s + dz * c) / rz;
  const oyl = (oy - cy) / ry;
  const dyl = dy / ry;
  const a = dxl * dxl + dyl * dyl + dzl * dzl;
  if (a < 1e-12) return null;
  const b = oxl * dxl + oyl * dyl + ozl * dzl;
  const cc = oxl * oxl + oyl * oyl + ozl * ozl - 1;
  const disc = b * b - a * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const near = (-b - root) / a;
  if (near > 0.02) return near;
  const far = (-b + root) / a;
  if (far > 0.02) return far;
  return null;
}

function holeFrame(box, x, y, z) {
  if (box.axis === "x") return { along: z - box.minZ, y: y - box.minY };
  return { along: x - box.minX, y: y - box.minY };
}

function holeCovers(box, x, y, z) {
  if (!box.holes || !box.holes.length || !box.axis) return false;
  const spot = holeFrame(box, x, y, z);
  for (const hole of box.holes) {
    if (Math.hypot(spot.along - hole.along, spot.y - hole.y) <= hole.r - 0.004) return true;
  }
  return false;
}

function trace(ox, oy, oz, dx, dy, dz, ignore) {
  let best = null;
  let bestT = 200;
  for (const box of boxes) {
    if (box.hp <= 0) continue;
    const distance = rayBox(ox, oy, oz, dx, dy, dz, box, bestT);
    if (distance === null || distance <= 0.02 || distance >= bestT) continue;
    const hx = ox + dx * distance;
    const hy = oy + dy * distance;
    const hz = oz + dz * distance;
    if (holeCovers(box, hx, hy, hz)) continue;
    bestT = distance;
    best = { t: distance, box, actor: null };
  }
  for (const actor of [player, bot]) {
    if (!actor.alive || actor === ignore) continue;
    const sy = crouchScale(actor);
    const yaw = actor.yaw || 0;
    let distance = null;
    let head = false;
    for (const part of BODY_PARTS) {
      const hitT = rayEllipsoid(
        ox, oy, oz, dx, dy, dz,
        actor.x, part.y * sy, actor.z,
        yaw, part.rx, part.ry * sy, part.rz,
      );
      if (hitT === null || hitT >= bestT) continue;
      if (distance === null || hitT < distance) {
        distance = hitT;
        head = part.head;
      }
    }
    if (distance !== null && distance < bestT) {
      bestT = distance;
      best = { t: distance, box: null, actor, head };
    }
  }
  return best;
}

function paintWall() {
  // Drywall material is shared. Holes show the damage, so hp must not recolor it.
}

function destroyWall(box) {
  box.hp = 0;
  box.mesh.visible = false;
}

function restoreWalls() {
  for (const box of boxes) {
    if (!box.breakable) continue;
    const opened = box.holed || (box.holes && box.holes.length > 0);
    box.hp = box.maxHp;
    box.mesh.visible = true;
    if (box.holes) box.holes.length = 0;
    if (opened) {
      if (box.mesh.material !== drywallMat) box.mesh.material = drywallMat;
      box.holed = false;
      clearHoleRings(box);
    }
    paintWall(box);
  }
  touchHoles();
}

function facePlayer() {
  const dx = player.x - bot.x;
  const dz = player.z - bot.z;
  bot.yaw = Math.atan2(-dx, -dz || 0);
  const dist = Math.hypot(dx, dz);
  bot.pitch = Math.atan2(chestHeight(player) - aimHeight(bot), Math.max(dist, 0.05));
  if (bot.mesh) bot.mesh.rotation.y = bot.yaw;
}

function botForward() {
  bot.mesh.rotation.y = bot.yaw;
  return new THREE.Vector3(0, 0, -1).applyQuaternion(bot.mesh.quaternion);
}

function addTracer(from, to, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geometry, color === 0xf0c14a ? boomTracerMat : tracerMat);
  scene.add(line);
  tracers.push({ line, life: 0.045 });
}

function startReload(actor) {
  const weapon = WEAPONS[actor.weapon];
  if (actor.reload > 0) return;
  if (actor.ammo[weapon.id] >= weapon.mag) return;
  actor.reload = weapon.reload;
  actor.reloadId = weapon.id;
}

function startCountdown() {
  if (matchOver) return;
  roundWait = ROUND_WAIT;
  banner = "Next round in 3";
}

function kill(victim, killer) {
  victim.alive = false;
  victim.health = 0;
  if (matchOver || roundWait > 0) return;
  killer.kills += 1;
  if (killer.kills >= WIN_SCORE) {
    matchOver = true;
    resetIn = 4;
    roundWait = 0;
    banner = killer === player ? "You win" : "Opponent wins";
    return;
  }
  startCountdown();
}

function spotClear(x, z) {
  if (x < X0 + 1.2 || x > X1 - 1.2 || z < Z0 + 1.2 || z > Z1 - 1.2) return false;
  for (const box of boxes) {
    if (box.hp <= 0 || box.maxY <= 0.05 || box.minY >= 1.7) continue;
    const closestX = clamp(x, box.minX, box.maxX);
    const closestZ = clamp(z, box.minZ, box.maxZ);
    if (Math.hypot(x - closestX, z - closestZ) < 0.85) return false;
  }
  return true;
}

function newBotRoute() {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const open = ROAM.filter((spot) => spotClear(spot[0], spot[1]));
  const pool = open.length ? open : [[0, 0]];
  const choice = pool[Math.floor(Math.random() * pool.length)];
  let next = { x: choice[0], z: choice[1] };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const jx = choice[0] + (Math.random() - 0.5) * 1.6;
    const jz = choice[1] + (Math.random() - 0.5) * 1.6;
    if (spotClear(jx, jz)) {
      next = { x: jx, z: jz };
      break;
    }
  }
  botGoal = next;
  botRetarget = diff.retarget[0] + Math.random() * (diff.retarget[1] - diff.retarget[0]);
  bot.strafe = Math.random() < 0.5 ? -1 : 1;
  botSee = 0;
  botPause = difficulty === "easy" && Math.random() < 0.45 ? 0.35 + Math.random() * 0.7 : 0;
}

function respawn(actor) {
  actor.x = actor.spawnX;
  actor.z = actor.spawnZ;
  actor.health = 100;
  actor.alive = true;
  actor.spawnLock = SPAWN_LOCK;
  actor.respawnIn = 0;
  actor.reload = 0;
  actor.cooldown = 0;
  actor.ammo = freshAmmo();
  actor.vx = 0;
  actor.vz = 0;
  actor.walkX = actor.x;
  actor.walkZ = actor.z;
  actor.walkDistance = 0;
  actor.walkBlend = 0;
  actor.crouch = 0;
  actor.lean = 0;
  actor.gait = "walk";
  actor.stepX = actor.x;
  actor.stepZ = actor.z;
  actor.stepCarry = 0;
  if (actor === player) {
    actor.weapon = weaponById(primaryId);
    showGun();
  }
  if (actor === bot && mode !== "net") {
    actor.weapon = weaponById(PRIMARY_IDS[Math.floor(Math.random() * PRIMARY_IDS.length)]);
    newBotRoute();
  }
  if (actor === bot) {
    showBotGun();
    poseBlob(0, 0);
  }
  roundWait = 0;
}

function weaponById(id) {
  return WEAPONS.findIndex((weapon) => weapon.id === id);
}

function roundIsLive() {
  return playing && roundWait <= 0 && !matchOver;
}

function equipPlayer(index) {
  if (index < 0) return;
  player.weapon = index;
  player.reload = 0;
  player.reloadId = null;
  hipBloom = 0;
  showGun();
}

function choosePrimary(id) {
  if (!PRIMARY_IDS.includes(id)) return;
  primaryId = id;
  document.querySelectorAll("#guns button").forEach((button) => {
    button.classList.toggle("on", button.dataset.gun === id);
  });
  if (!roundIsLive()) equipPlayer(weaponById(id));
}

function selectWeapon(slot) {
  if (roundIsLive()) {
    if (slot === 1) equipPlayer(weaponById(primaryId));
    if (slot === 2) equipPlayer(weaponById("pistol"));
    return;
  }
  const id = PRIMARY_IDS[slot - 1];
  if (id) choosePrimary(id);
}

function beginRound() {
  banner = "";
  restoreWalls();
  if (mode === "net") queueEvent({ type: "round" });
  respawn(player);
  if (mode !== "net") respawn(bot);
  else bot.alive = true;
  roundWait = 0;
  repair = 0;
  repairTarget = null;
}

function queueEvent(event) {
  event.eid = event.eid || Math.random().toString(36).slice(2, 10);
  netEvents.push(event);
}

function panelSpan(box) {
  const width = box.axis === "x" ? box.maxZ - box.minZ : box.maxX - box.minX;
  return { width, height: box.maxY - box.minY };
}

function clampHole(box, hole) {
  const { width, height } = panelSpan(box);
  const maxR = Math.min(width, height) * 0.48;
  hole.r = Math.min(hole.r, maxR);
  const margin = hole.r + 0.004;
  if (margin * 2 >= Math.min(width, height)) {
    hole.along = width / 2;
    hole.y = height / 2;
    return;
  }
  hole.along = clamp(hole.along, margin, width - margin);
  hole.y = clamp(hole.y, margin, height - margin);
}

function circlesOverlap(a, b) {
  return Math.hypot(a.along - b.along, a.y - b.y) < a.r + b.r + 0.04;
}

function mergeCircles(a, b) {
  const dx = b.along - a.along;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const grown = Math.max(a.r, b.r) + 0.012;
  if (distance < 1e-6) return { along: a.along, y: a.y, r: grown };
  const radius = Math.max((distance + a.r + b.r) / 2, grown);
  const shift = (radius - a.r) / distance;
  return { along: a.along + dx * shift, y: a.y + dy * shift, r: radius };
}

function wallPlane(box) {
  return box.axis === "x" ? (box.minX + box.maxX) / 2 : (box.minZ + box.maxZ) / 2;
}

function planeKey(axis, plane) {
  return axis + ":" + Math.round(plane * 20);
}

function indexWalls() {
  wallPanels.clear();
  for (const box of boxes) {
    if (!box.breakable || !box.axis) continue;
    const key = planeKey(box.axis, wallPlane(box));
    let list = wallPanels.get(key);
    if (!list) {
      list = [];
      wallPanels.set(key, list);
    }
    list.push(box);
  }
}

function touchHoles() {
  holeGen += 1;
}

function holesOnPlane(axis, plane) {
  if (holeCacheGen !== holeGen) {
    holeCache.clear();
    holeCacheGen = holeGen;
    for (const other of boxes) {
      if (!other.breakable || !other.axis || !other.holes || !other.holes.length) continue;
      const key = planeKey(other.axis, wallPlane(other));
      let list = holeCache.get(key);
      if (!list) {
        list = [];
        holeCache.set(key, list);
      }
      for (const hole of other.holes) {
        const spot = planePoint(other, hole.along, hole.y);
        list.push({ u: spot.u, v: spot.v, r: hole.r });
      }
    }
  }
  return holeCache.get(planeKey(axis, plane)) || [];
}

function planePoint(box, along, y) {
  if (box.axis === "x") return { u: box.minZ + along, v: box.minY + y };
  return { u: box.minX + along, v: box.minY + y };
}

function circleOnPanel(box, circle) {
  const { width, height } = panelSpan(box);
  const along = box.axis === "x" ? circle.u - box.minZ : circle.u - box.minX;
  const localY = circle.v - box.minY;
  const clampedAlong = clamp(along, 0, width);
  const clampedY = clamp(localY, 0, height);
  const dist = Math.hypot(along - clampedAlong, localY - clampedY);
  if (dist >= circle.r - 0.0001) return null;
  return {
    along: clampedAlong,
    y: clampedY,
    r: Math.sqrt(Math.max(0, circle.r * circle.r - dist * dist)),
  };
}

function solidGeometry(box) {
  return new THREE.BoxGeometry(box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ);
}

function circleOutside(x, y, cx, cy, radius) {
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) > radius * radius + 1e-8;
}

function circleHits(x0, y0, x1, y1, cx, cy, radius) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a < 1e-12) return [];
  const root = Math.sqrt(disc);
  const hits = [];
  for (const t of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
    if (t > 0.0001 && t < 0.9999) {
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      hits.push({ t, x, y, ang: Math.atan2(y - cy, x - cx) });
    }
  }
  hits.sort((p, q) => p.t - q.t);
  return hits;
}

function pointInLoop(x, y, loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i, i += 1) {
    const xi = loop[i][0];
    const yi = loop[i][1];
    const xj = loop[j][0];
    const yj = loop[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonMinusCircle(poly, cx, cy, radius) {
  const nodes = [];
  for (let i = 0; i < poly.length; i += 1) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    if (circleOutside(x0, y0, cx, cy, radius)) nodes.push({ x: x0, y: y0, kind: "v" });
    for (const hit of circleHits(x0, y0, x1, y1, cx, cy, radius)) {
      if (nodes.some((node) => node.kind === "x" && Math.hypot(node.x - hit.x, node.y - hit.y) < 0.004)) continue;
      const back = Math.max(0, hit.t - 0.002);
      const bx = x0 + (x1 - x0) * back;
      const by = y0 + (y1 - y0) * back;
      nodes.push({
        x: hit.x,
        y: hit.y,
        kind: "x",
        ang: hit.ang,
        entering: circleOutside(bx, by, cx, cy, radius),
        used: false,
      });
    }
  }
  const isects = nodes.filter((node) => node.kind === "x");
  if (!isects.length) {
    if (poly.every(([x, y]) => !circleOutside(x, y, cx, cy, radius))) return [];
    return [poly.map((point) => [point[0], point[1]])];
  }
  for (let i = 0; i < nodes.length; i += 1) nodes[i].next = nodes[(i + 1) % nodes.length];
  const byAng = isects.slice().sort((a, b) => a.ang - b.ang);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of poly) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  const nextIsect = (start, direction) => {
    const index = byAng.indexOf(start);
    return direction > 0 ? byAng[(index + 1) % byAng.length] : byAng[(index - 1 + byAng.length) % byAng.length];
  };
  const arcSweep = (a0, a1, direction) => {
    if (direction > 0) {
      let sweep = a1 - a0;
      while (sweep <= 1e-8) sweep += Math.PI * 2;
      return sweep;
    }
    let sweep = a0 - a1;
    while (sweep <= 1e-8) sweep += Math.PI * 2;
    return -sweep;
  };
  const arcDir = (enter) => {
    let best = 1;
    let bestInside = -1;
    for (const sign of [1, -1]) {
      const dest = nextIsect(enter, sign);
      const sweep = arcSweep(enter.ang, dest.ang, sign);
      let inside = 0;
      for (const t of [0.25, 0.5, 0.75]) {
        const ang = enter.ang + sweep * t;
        const x = cx + Math.cos(ang) * radius;
        const y = cy + Math.sin(ang) * radius;
        if (pointInLoop(x, y, poly)) inside += 1;
      }
      if (inside > bestInside) {
        bestInside = inside;
        best = sign;
      }
    }
    return best;
  };
  const emitArc = (a0, a1, direction, out) => {
    const sweep = arcSweep(a0, a1, direction);
    const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 14)));
    for (let step = 1; step < steps; step += 1) {
      const ang = a0 + sweep * (step / steps);
      const x = cx + Math.cos(ang) * radius;
      const y = cy + Math.sin(ang) * radius;
      if (x < minX - 0.012 || x > maxX + 0.012 || y < minY - 0.012 || y > maxY + 0.012) continue;
      out.push([x, y]);
    }
  };
  const loops = [];
  for (const start of isects) {
    if (start.used || start.entering) continue;
    start.used = true;
    const loop = [];
    let cur = start;
    for (let guard = 0; guard < 64; guard += 1) {
      loop.push([cur.x, cur.y]);
      let nxt = cur.next;
      let walk = 0;
      while (nxt.kind !== "x" && walk < nodes.length + 2) {
        loop.push([nxt.x, nxt.y]);
        nxt = nxt.next;
        walk += 1;
      }
      loop.push([nxt.x, nxt.y]);
      const direction = arcDir(nxt);
      const dest = nextIsect(nxt, direction);
      emitArc(nxt.ang, dest.ang, direction, loop);
      if (dest === start) break;
      dest.used = true;
      cur = dest;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function shapeFromLoop(loop) {
  let area = 0;
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const ordered = area < 0 ? loop.slice().reverse() : loop;
  if (Math.abs(area) < 1e-6) return null;
  const shape = new THREE.Shape();
  shape.moveTo(ordered[0][0], ordered[0][1]);
  for (let i = 1; i < ordered.length; i += 1) {
    const point = ordered[i];
    const prev = ordered[i - 1];
    if (Math.hypot(point[0] - prev[0], point[1] - prev[1]) < 1e-5) continue;
    shape.lineTo(point[0], point[1]);
  }
  shape.closePath();
  return shape;
}

function extrudeShape(shape) {
  try {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: THIN,
      bevelEnabled: false,
      curveSegments: 10,
    });
    geometry.translate(0, 0, -THIN / 2);
    return geometry;
  } catch (error) {
    return null;
  }
}

function mergeGeometries(geometries) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let offset = 0;
  for (const geometry of geometries) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }
    if (index) {
      for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + offset);
    } else {
      for (let i = 0; i < position.count; i += 1) indices.push(offset + i);
    }
    offset += position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  for (const geometry of geometries) geometry.dispose();
  return merged;
}

function holedGeometry(box) {
  const { width, height } = panelSpan(box);
  const inner = [];
  const boundary = [];
  for (const hole of box.holes) {
    const inside = hole.along - hole.r >= 0.001 && hole.along + hole.r <= width - 0.001
      && hole.y - hole.r >= 0.001 && hole.y + hole.r <= height - 0.001;
    if (inside) inner.push(hole);
    else boundary.push(hole);
  }
  if (!boundary.length) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, height);
    shape.lineTo(0, height);
    shape.closePath();
    for (const hole of inner) {
      const path = new THREE.Path();
      path.absarc(hole.along, hole.y, hole.r, 0, Math.PI * 2, true);
      shape.holes.push(path);
    }
    return extrudeShape(shape);
  }
  let pieces = [[[0, 0], [width, 0], [width, height], [0, height]]];
  for (const hole of boundary) {
    const next = [];
    for (const piece of pieces) {
      for (const loop of polygonMinusCircle(piece, hole.along, hole.y, hole.r)) {
        if (loop.length >= 3) next.push(loop);
      }
    }
    pieces = next;
    if (!pieces.length) break;
  }
  if (!pieces.length) return null;
  const geometries = [];
  for (const loop of pieces) {
    const shape = shapeFromLoop(loop);
    if (!shape) continue;
    for (const hole of inner) {
      if (hole.along - hole.r < 0 || hole.y - hole.r < 0) continue;
      if (!pointInLoop(hole.along, hole.y, loop)) continue;
      const path = new THREE.Path();
      path.absarc(hole.along, hole.y, hole.r, 0, Math.PI * 2, true);
      shape.holes.push(path);
    }
    const geometry = extrudeShape(shape);
    if (geometry) geometries.push(geometry);
  }
  if (!geometries.length) return null;
  if (geometries.length === 1) return geometries[0];
  return mergeGeometries(geometries);
}

function placePanel(box) {
  const mesh = box.mesh;
  mesh.scale.set(1, 1, 1);
  if (box.holes.length && box.axis) {
    if (box.axis === "z") {
      mesh.rotation.set(0, 0, 0);
      mesh.position.set(box.minX, box.minY, (box.minZ + box.maxZ) / 2);
    } else {
      // local +X runs along world +Z; local +Z (the thin axis) runs toward world -X
      mesh.rotation.set(0, -Math.PI / 2, 0);
      mesh.position.set((box.minX + box.maxX) / 2, box.minY, box.minZ);
    }
    box.holed = true;
  } else {
    mesh.rotation.set(0, 0, 0);
    mesh.position.set((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2);
    box.holed = false;
  }
  if (box.axis) stampWallUVs(mesh, box.axis);
  addHoleRings(box);
}

function disposeRing(object) {
  if (!object) return;
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
  });
}

function clearHoleRings(box) {
  const mesh = box.mesh;
  if (mesh) {
    for (let i = mesh.children.length - 1; i >= 0; i -= 1) {
      const child = mesh.children[i];
      if (!child.userData.holeRing) continue;
      mesh.remove(child);
      disposeRing(child);
    }
  }
  if (box.ringMeshes) {
    for (const ring of box.ringMeshes) {
      scene.remove(ring);
      disposeRing(ring);
    }
  }
  box.ringMeshes = [];
}

function holeWorld(box, hole) {
  if (box.axis === "x") {
    return { x: (box.minX + box.maxX) / 2, y: box.minY + hole.y, z: box.minZ + hole.along };
  }
  return { x: box.minX + hole.along, y: box.minY + hole.y, z: (box.minZ + box.maxZ) / 2 };
}

function circleStaysOnWall(box, hole) {
  const { width, height } = panelSpan(box);
  if (hole.along < 0 || hole.along > width || hole.y < 0 || hole.y > height) return false;
  const plane = wallPlane(box);
  const tube = Math.min(0.012, Math.max(0.006, hole.r * 0.08));
  const reach = hole.r + tube;
  for (let i = 0; i < 28; i += 1) {
    const ang = (i / 28) * Math.PI * 2;
    const along = hole.along + Math.cos(ang) * reach;
    const localY = hole.y + Math.sin(ang) * reach;
    const x = box.axis === "x" ? plane : box.minX + along;
    const y = box.minY + localY;
    const z = box.axis === "x" ? box.minZ + along : plane;
    const onWall = boxes.some((other) => other.breakable && other.axis === box.axis
      && Math.abs(wallPlane(other) - plane) <= 0.25
      && x >= other.minX - 0.02 && x <= other.maxX + 0.02
      && y >= other.minY - 0.02 && y <= other.maxY + 0.02
      && z >= other.minZ - 0.02 && z <= other.maxZ + 0.02);
    if (!onWall) return false;
  }
  return true;
}

function sameOutline(a, b) {
  return Math.hypot(a.u - b.u, a.v - b.v) < 0.008 && Math.abs(a.r - b.r) < 0.008;
}

function pointOnWall(panel, u, v) {
  const plane = wallPlane(panel);
  const panels = wallPanels.get(planeKey(panel.axis, plane)) || boxes;
  const x = panel.axis === "x" ? plane : u;
  const y = v;
  const z = panel.axis === "x" ? u : plane;
  return panels.some((other) => other.breakable && other.axis === panel.axis
    && Math.abs(wallPlane(other) - plane) <= 0.25
    && x >= other.minX - 0.02 && x <= other.maxX + 0.02
    && y >= other.minY - 0.02 && y <= other.maxY + 0.02
    && z >= other.minZ - 0.02 && z <= other.maxZ + 0.02);
}

function subtractAngle(arcs, rawStart, rawEnd) {
  const span = rawEnd - rawStart;
  if (span >= Math.PI * 2 - 1e-3) return [];
  const cuts = [];
  let start = rawStart % (Math.PI * 2);
  if (start < 0) start += Math.PI * 2;
  const end = start + span;
  if (end > Math.PI * 2) cuts.push([start, Math.PI * 2], [0, end - Math.PI * 2]);
  else cuts.push([start, end]);
  const next = [];
  for (const arc of arcs) {
    let pieces = [arc];
    for (const cut of cuts) {
      const grown = [];
      for (const piece of pieces) {
        const [p0, p1] = piece;
        const [c0, c1] = cut;
        if (c1 <= p0 || c0 >= p1) {
          grown.push(piece);
          continue;
        }
        if (c0 > p0) grown.push([p0, Math.min(c0, p1)]);
        if (c1 < p1) grown.push([Math.max(c1, p0), p1]);
      }
      pieces = grown;
    }
    for (const piece of pieces) {
      if (piece[1] - piece[0] > 1e-3) next.push(piece);
    }
  }
  return next;
}

function exposedRingArcs(hole, others, keepPoint) {
  const tube = Math.min(0.012, Math.max(0.006, hole.r * 0.08));
  const rim = Math.max(tube * 2, hole.r - tube * 0.35);
  let arcs = [[0, Math.PI * 2]];
  for (const other of others) {
    if (other === hole || sameOutline(hole, other)) continue;
    const otherTube = Math.min(0.012, Math.max(0.006, other.r * 0.08));
    const otherRim = Math.max(otherTube * 2, other.r - otherTube * 0.35);
    const dx = other.u - hole.u;
    const dy = other.v - hole.v;
    const dist = Math.hypot(dx, dy);
    if (dist >= rim + otherRim - 1e-4) continue;
    if (dist + rim <= otherRim + 1e-4) {
      arcs = [];
      break;
    }
    const alpha = Math.acos(clamp((dist * dist + rim * rim - otherRim * otherRim) / (2 * dist * rim), -1, 1));
    const mid = Math.atan2(dy, dx);
    arcs = subtractAngle(arcs, mid - alpha, mid + alpha);
  }
  if (arcs.length && arcs.some((arc) => arc[1] - arc[0] < Math.PI * 2 - 0.2)) {
    const pad = 0.7 * tube / rim;
    const padded = [];
    for (const [start, end] of arcs) {
      let a = start - pad;
      let b = end + pad;
      if (b - a >= Math.PI * 2 - 0.05) {
        padded.push([0, Math.PI * 2]);
        continue;
      }
      while (a < 0) {
        a += Math.PI * 2;
        b += Math.PI * 2;
      }
      while (a >= Math.PI * 2) {
        a -= Math.PI * 2;
        b -= Math.PI * 2;
      }
      if (b <= Math.PI * 2) padded.push([a, b]);
      else {
        padded.push([a, Math.PI * 2]);
        if (b - Math.PI * 2 > 1e-3) padded.push([0, b - Math.PI * 2]);
      }
    }
    arcs = padded;
  }
  if (keepPoint && arcs.length) {
    const outer = rim + tube;
    const steps = 96;
    for (let i = 0; i < steps; i += 1) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      const angle = (a0 + a1) * 0.5;
      if (!keepPoint(hole.u + Math.cos(angle) * outer, hole.v + Math.sin(angle) * outer)) {
        arcs = subtractAngle(arcs, a0, a1);
      }
    }
  }
  return arcs.filter((arc) => arc[1] - arc[0] >= 0.05).map((arc) => ({ start: arc[0], end: arc[1] }));
}

function addArcMesh(panel, u, v, radius, tube, start, span) {
  const full = span >= Math.PI * 2 - 0.08;
  const segments = full ? 28 : Math.max(6, Math.round(32 * span / (Math.PI * 2)));
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(tube * 2, radius), tube, 6, segments, full ? Math.PI * 2 : span),
    holeRingMat,
  );
  if (!full) ring.rotation.z = start;
  const holder = new THREE.Group();
  holder.add(ring);
  if (panel.axis === "x") {
    holder.position.set(wallPlane(panel), v, u);
    holder.rotation.y = -Math.PI / 2;
  } else holder.position.set(u, v, wallPlane(panel));
  holder.userData.holeRing = true;
  scene.add(holder);
  if (!panel.ringMeshes) panel.ringMeshes = [];
  panel.ringMeshes.push(holder);
}

function planeOutlines(box) {
  const plane = wallPlane(box);
  const panels = wallPanels.get(planeKey(box.axis, plane)) || [];
  const holes = [];
  for (const other of panels) {
    if (!other.holes) continue;
    for (const hole of other.holes) {
      const spot = planePoint(other, hole.along, hole.y);
      holes.push({ u: spot.u, v: spot.v, r: hole.r, panel: other });
    }
  }
  const unique = [];
  for (const hole of holes) {
    if (unique.some((other) => sameOutline(hole, other))) continue;
    unique.push(hole);
  }
  return { panels, unique };
}

function refreshPlaneRings(box) {
  ringBuilds += 1;
  const { panels, unique } = planeOutlines(box);
  for (const panel of panels) clearHoleRings(panel);
  for (const hole of unique) {
    const tube = Math.min(0.012, Math.max(0.006, hole.r * 0.08));
    const rim = Math.max(tube * 2, hole.r - tube * 0.35);
    const arcs = exposedRingArcs(hole, unique, (u, v) => pointOnWall(hole.panel, u, v));
    for (const arc of arcs) {
      const span = arc.end - arc.start;
      if (span < 0.05) continue;
      addArcMesh(hole.panel, hole.u, hole.v, rim, tube, arc.start, span);
    }
  }
}

function addHoleRings(box) {
  if (!box || !box.axis) return;
  refreshPlaneRings(box);
}

function syncHoleMaterial(box) {
  if (!box.mesh || !box.axis) return;
  if (!box.holes.length) {
    if (box.mesh.material !== drywallMat) box.mesh.material = drywallMat;
    box.holed = false;
    box.mesh.visible = true;
    return;
  }
  if (!box.holeMat) {
    const mat = drywallMat.clone();
    const holeList = new Float32Array(MAX_HOLES * 3);
    const alongSpan = box.axis === "x" ? box.maxZ - box.minZ : box.maxX - box.minX;
    const height = box.maxY - box.minY;
    const panelAxis = { value: box.axis === "x" ? 0 : 1 };
    const panelHalf = { value: new THREE.Vector2(alongSpan * 0.5, height * 0.5) };
    mat.userData.holeList = holeList;
    mat.customProgramCacheKey = () => "arena-hole-panel";
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.holeList = { value: holeList };
      shader.uniforms.panelAxis = panelAxis;
      shader.uniforms.panelHalf = panelHalf;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float panelAxis;\nuniform vec2 panelHalf;\nvarying vec2 vPanelUV;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPanelUV = vec2(panelAxis < 0.5 ? position.z + panelHalf.x : position.x + panelHalf.x, position.y + panelHalf.y);");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float holeList[48];\nvarying vec2 vPanelUV;")
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
for (int i = 0; i < ${MAX_HOLES}; i++) {
  float hr = holeList[i * 3 + 2];
  float dx = vPanelUV.x - holeList[i * 3];
  float dy = vPanelUV.y - holeList[i * 3 + 1];
  if (hr > 0.0 && dx * dx + dy * dy < hr * hr) discard;
}`);
    };
    box.holeMat = mat;
  }
  const list = box.holeMat.userData.holeList;
  list.fill(0);
  const count = Math.min(MAX_HOLES, box.holes.length);
  for (let i = 0; i < count; i += 1) {
    const hole = box.holes[i];
    list[i * 3] = hole.along;
    list[i * 3 + 1] = hole.y;
    list[i * 3 + 2] = hole.r;
  }
  box.mesh.material = box.holeMat;
  box.holed = true;
  box.mesh.visible = true;
}

function rebuildPanel(box) {
  syncHoleMaterial(box);
  touchHoles();
  addHoleRings(box);
}

function presentHoles(panels) {
  const planes = [];
  for (const box of panels) {
    syncHoleMaterial(box);
    const key = planeKey(box.axis, wallPlane(box));
    if (!planes.some((item) => item.key === key)) planes.push({ key, box });
  }
  touchHoles();
  for (const item of planes) refreshPlaneRings(item.box);
}

function stampHole(box, along, y, radius) {
  let hole = { along, y, r: radius };
  clampHole(box, hole);
  for (let guard = 0; guard < 8; guard += 1) {
    const hit = box.holes.find((other) => circlesOverlap(hole, other));
    if (!hit) break;
    box.holes.splice(box.holes.indexOf(hit), 1);
    hole = mergeCircles(hole, hit);
    clampHole(box, hole);
  }
  box.holes.push(hole);
  return hole;
}

function growIntoNeighbors(box, hole) {
  const center = planePoint(box, hole.along, hole.y);
  const plane = wallPlane(box);
  for (const other of boxes) {
    if (other === box || !other.breakable || other.axis !== box.axis || !other.holes.length) continue;
    if (Math.abs(wallPlane(other) - plane) > 0.25) continue;
    let grew = false;
    for (const neighbor of other.holes) {
      const spot = planePoint(other, neighbor.along, neighbor.y);
      const dist = Math.hypot(center.u - spot.u, center.v - spot.v);
      if (dist >= hole.r + neighbor.r + 0.05) continue;
      const merged = Math.max((dist + hole.r + neighbor.r) / 2, Math.max(hole.r, neighbor.r) + 0.012);
      hole.r = merged;
      neighbor.r = merged;
      clampHole(box, hole);
      clampHole(other, neighbor);
      grew = true;
    }
    if (grew) rebuildPanel(other);
  }
}

function punchCircle(box, x, y, z, radius) {
  if (!box || !box.breakable || !box.axis) return;
  const spot = holeFrame(box, x, y, z);
  const hole = stampHole(box, spot.along, spot.y, radius);
  growIntoNeighbors(box, hole);
  rebuildPanel(box);
}

function stampWorldCircle(box, along, y, radius) {
  let hole = { along, y, r: radius };
  for (let guard = 0; guard < 8; guard += 1) {
    const hit = box.holes.find((other) => Math.hypot(other.along - hole.along, other.y - hole.y) < other.r + hole.r + 0.05);
    if (!hit) break;
    box.holes.splice(box.holes.indexOf(hit), 1);
    hole = mergeCircles(hole, hit);
  }
  if (box.holes.length >= MAX_HOLES) {
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < box.holes.length; i += 1) {
      const dist = Math.hypot(box.holes[i].along - hole.along, box.holes[i].y - hole.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    hole = mergeCircles(hole, box.holes[nearest]);
    box.holes.splice(nearest, 1);
  }
  box.holes.push(hole);
}

function punchBlast(box, x, y, z, radius) {
  const touched = [];
  if (!box || !box.breakable || !box.axis) return touched;
  const plane = wallPlane(box);
  const u = box.axis === "x" ? z : x;
  const v = y;
  for (const other of boxes) {
    if (!other.breakable || other.axis !== box.axis) continue;
    if (Math.abs(wallPlane(other) - plane) > 0.25) continue;
    const { width, height } = panelSpan(other);
    const along = other.axis === "x" ? u - other.minZ : u - other.minX;
    const localY = v - other.minY;
    const closestAlong = clamp(along, 0, width);
    const closestY = clamp(localY, 0, height);
    if (Math.hypot(along - closestAlong, localY - closestY) >= radius) continue;
    stampWorldCircle(other, along, localY, radius);
    touched.push(other);
  }
  return touched;
}

function queueWall(box) {
  queueEvent({
    type: "wall",
    id: box.id,
    hp: box.hp,
    holes: box.holes.map((hole) => ({ along: hole.along, y: hole.y, r: hole.r })),
  });
}

function punchImpacts(weapon, impacts) {
  if (!impacts.length) return;
  const touched = [];
  const remember = (box) => {
    if (!touched.includes(box)) touched.push(box);
  };
  if (weapon.id === "shotgun") {
    for (const hit of impacts) {
      const blasted = punchBlast(hit.box, hit.x, hit.y, hit.z, shotgunHoleRadius(hit.t));
      for (const item of blasted) remember(item);
    }
  } else {
    const radius = HOLE_RADIUS[weapon.id] || HOLE_RADIUS.ar;
    for (const hit of impacts) {
      const blasted = punchBlast(hit.box, hit.x, hit.y, hit.z, radius);
      for (const item of blasted) remember(item);
    }
  }
  presentHoles(touched);
  if (mode === "net") {
    for (const box of touched) queueWall(box);
  }
}

function applyEvent(event) {
  if (!event || (event.eid && seenEvents.has(event.eid))) return;
  if (event.eid) seenEvents.add(event.eid);
  if (event.type === "round") {
    restoreWalls();
    return;
  }
  if (event.type === "wall") {
    const box = boxes.find((item) => item.id === event.id);
    if (!box || !box.breakable) return;
    if (typeof event.hp === "number") box.hp = event.hp;
    if (Array.isArray(event.holes)) {
      box.holes = event.holes.map((hole) => ({
        along: Number(hole.along) || 0,
        y: Number(hole.y) || 0,
        r: Number(hole.r) || 0,
      }));
    } else if (!(box.hp < box.maxHp)) box.holes = [];
    if (box.hp <= 0) {
      destroyWall(box);
      return;
    }
    rebuildPanel(box);
    paintWall(box);
    return;
  }
  if (event.type === "shot") {
    playSpatial(
      event.kind === "boom" ? "boom" : "shot",
      Number(event.x) || bot.x,
      Number(event.y) || aimHeight(bot),
      Number(event.z) || bot.z,
      Number(event.gain) || 0.55,
      false,
    );
    return;
  }
  if (event.type === "hurt") {
    if (!player.alive || player.spawnLock > 0 || matchOver || roundWait > 0) return;
    const before = player.health;
    player.health -= event.amount;
    if (player.health < before) damageFlash = 0.18;
    if (player.health <= 0) {
      player.alive = false;
      player.health = 0;
      queueEvent({ type: "died" });
      startCountdown();
    }
    return;
  }
  if (event.type === "died") {
    bot.alive = false;
    bot.health = 0;
    if (matchOver || roundWait > 0) return;
    player.kills += 1;
    if (mode === "net") showHitMarker(true);
    if (player.kills >= WIN_SCORE) {
      matchOver = true;
      resetIn = 4;
      banner = "You win";
      return;
    }
    startCountdown();
  }
}

function applyRemote(state) {
  if (!state) return;
  bot.x = state.x;
  bot.z = state.z;
  bot.yaw = state.yaw || 0;
  if (typeof state.pitch === "number") bot.pitch = state.pitch;
  bot.health = state.health;
  bot.weapon = state.weapon || 0;
  bot.alive = Boolean(state.alive);
  bot.kills = state.kills || 0;
  bot.spawnLock = state.spawnLock || 0;
  if (typeof state.crouch === "number") bot.crouch = clamp(state.crouch, 0, 1);
  if (typeof state.lean === "number") bot.lean = clamp(state.lean, -1, 1);
  if (state.gait === "sprint" || state.gait === "crouch" || state.gait === "walk") bot.gait = state.gait;
  if (state.kills >= WIN_SCORE && player.kills < WIN_SCORE && !matchOver) {
    matchOver = true;
    resetIn = 4;
    banner = "Opponent wins";
  }
}

function fireShot(attacker) {
  const weapon = WEAPONS[attacker.weapon];
  if (!playing || paused || !attacker.alive || matchOver || roundWait > 0) return false;
  if (attacker.reload > 0 || attacker.cooldown > 0) return false;
  if (attacker.ammo[weapon.id] <= 0) {
    startReload(attacker);
    return false;
  }

  attacker.ammo[weapon.id] -= 1;
  attacker.cooldown = weapon.interval;
  attacker.spawnLock = 0;
  if (attacker === player) {
    repair = 0;
    repairTarget = null;
  }
  playSpatial(
    weapon.id === "shotgun" ? "boom" : "shot",
    attacker.x,
    attacker === player ? eyeHeight(player) : aimHeight(attacker),
    attacker.z,
    weapon.id === "shotgun" ? 0.95 : 0.55,
    attacker === player,
  );
  if (mode === "net" && attacker === player) {
    queueEvent({
      type: "shot",
      kind: weapon.id === "shotgun" ? "boom" : "shot",
      x: attacker.x,
      y: eyeHeight(player),
      z: attacker.z,
      gain: weapon.id === "shotgun" ? 0.95 : 0.55,
    });
  }

  let origin;
  let direction;
  let right;
  let up;
  if (attacker === player) {
    syncCamera();
    origin = camera.position.clone();
    direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const kick = weapon.recoil * (1 - 0.55 * ads);
    player.pitch = clamp(player.pitch + kick, -1.15, 1.15);
    if (weapon.id === "smg") player.yaw += (Math.random() * 2 - 1) * 0.016 * (1 - 0.55 * ads);
  } else {
    origin = new THREE.Vector3(bot.x, aimHeight(bot), bot.z);
    direction = new THREE.Vector3(player.x, chestHeight(player), player.z).sub(origin);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
    direction.normalize();
    const basis = aimBasis(direction);
    right = basis.right;
    up = basis.up;
  }

  const botSpread = attacker === bot ? (DIFFICULTY[difficulty] || DIFFICULTY.medium).spread : 0;
  const spread = attacker === player ? playerShotSpread(weapon) : weapon.spread + botSpread;
  let hitActor = null;
  let actorDamage = 0;
  let hitHead = false;
  const impacts = [];

  for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
    const shot = direction.clone();
    if (spread > 0) {
      shot.addScaledVector(right, (Math.random() * 2 - 1) * spread);
      shot.addScaledVector(up, (Math.random() * 2 - 1) * spread);
      shot.normalize();
    }
    const hit = trace(origin.x, origin.y, origin.z, shot.x, shot.y, shot.z, attacker);
    const end = origin.clone().addScaledVector(shot, hit ? hit.t : 40);
    addTracer(origin, end, weapon.id === "shotgun" ? 0xf0c14a : 0xffe7a3);
    if (!hit) continue;
    const amount = weapon.damage * falloff(weapon, hit.t) * (hit.head ? HEAD_MULT : 1);
    if (hit.actor) {
      hitActor = hit.actor;
      actorDamage += amount;
      if (hit.head) hitHead = true;
    } else if (hit.box.breakable) {
      impacts.push({
        box: hit.box,
        x: origin.x + shot.x * hit.t,
        y: origin.y + shot.y * hit.t,
        z: origin.z + shot.z * hit.t,
        t: hit.t,
      });
    }
  }

  if (hitActor && actorDamage > 0) {
    if (mode === "net") {
      if (hitActor !== player) {
        queueEvent({ type: "hurt", amount: actorDamage });
        if (attacker === player) showHitMarker(false, hitHead);
      }
    } else if (hitActor.spawnLock <= 0) {
      const before = hitActor.health;
      hitActor.health -= actorDamage;
      if (hitActor === player && hitActor.health < before) damageFlash = 0.18;
      if (attacker === player && hitActor !== player && hitActor.health < before) {
        showHitMarker(hitActor.health <= 0, hitHead);
      }
      if (hitActor.health <= 0) kill(hitActor, attacker);
    }
  }

  punchImpacts(weapon, impacts);
  if (attacker === player) addHipBloom(weapon);
  if (attacker.ammo[weapon.id] <= 0) startReload(attacker);
  return true;
}

function playerShotSpread(weapon) {
  const adsScale = 1 - 0.8 * ads;
  let spread = weapon.spread * adsScale;
  if (weapon.id === "smg" || weapon.id === "ar") {
    const speed = Math.hypot(player.vx, player.vz);
    const move = (MOVE_SPREAD[weapon.id] || 0) * Math.min(1, speed / SPRINT_SPEED);
    spread += (hipBloom + move) * (1 - ads);
  }
  return spread;
}

function addHipBloom(weapon) {
  const spec = BLOOM[weapon.id];
  if (!spec) return;
  hipBloom = Math.min(spec.max, hipBloom + spec.perShot * (1 - ads));
}

function spreadPixels(radians) {
  const fov = (camera.fov || HIP_FOV) * Math.PI / 180;
  const half = Math.max(180, window.innerHeight * 0.5);
  return Math.tan(Math.max(0, radians)) * (half / Math.tan(fov * 0.5));
}

function updateCrosshair() {
  const cross = document.getElementById("cross");
  if (!cross) return;
  const weapon = WEAPONS[player.weapon];
  const shotgun = weapon.id === "shotgun";
  cross.classList.toggle("shotgun", shotgun);
  const px = spreadPixels(shotgun ? weapon.spread : playerShotSpread(weapon));
  const ring = cross.querySelector(".ring");
  if (ring) {
    const size = Math.max(28, px * 2);
    ring.style.width = size + "px";
    ring.style.height = size + "px";
  }
  const gap = Math.max(4, px);
  const up = cross.querySelector(".up");
  const down = cross.querySelector(".down");
  const left = cross.querySelector(".left");
  const right = cross.querySelector(".right");
  if (up) up.style.transform = `translate(-1px, ${-gap - 8}px)`;
  if (down) down.style.transform = `translate(-1px, ${gap}px)`;
  if (left) left.style.transform = `translate(${-gap - 8}px, -1px)`;
  if (right) right.style.transform = `translate(${gap}px, -1px)`;
}

function weaponCard(weapon) {
  const rpm = Math.round(60 / weapon.interval);
  const dps = Math.round((weapon.damage * weapon.pellets) / weapon.interval);
  const degrees = weapon.spread * (180 / Math.PI);
  const accuracy = weapon.spread <= 0 ? "Perfect" : `±${degrees.toFixed(1)}°`;
  const damage = weapon.pellets > 1 ? `${weapon.damage} × ${weapon.pellets}` : String(weapon.damage);
  return { damage, rpm, accuracy, dps };
}

function showGunTip(target) {
  const tip = document.getElementById("gun-tip");
  if (!tip || !target) return;
  const weapon = WEAPONS.find((item) => item.id === target.dataset.gun);
  if (!weapon) return;
  const card = weaponCard(weapon);
  tip.innerHTML = `<b>${weapon.name}</b><span>Damage ${card.damage}</span><span>Fire rate ${card.rpm} rpm</span><span>Accuracy ${card.accuracy}</span><span>DPS ${card.dps}</span>`;
  const rect = target.getBoundingClientRect();
  tip.hidden = false;
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.style.top = `${rect.bottom + 8}px`;
}

function hideGunTip() {
  const tip = document.getElementById("gun-tip");
  if (tip) tip.hidden = true;
}

function nearestRepairable() {
  if (!player.alive || roundWait > 0 || matchOver) return null;
  syncCamera();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  let best = null;
  let bestDist = REPAIR_REACH;
  for (const box of boxes) {
    if (!box.breakable || (box.hp > 0 && (!box.holes || box.holes.length === 0))) continue;
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    const dx = cx - player.x;
    const dy = cy - camera.position.y;
    const dz = cz - player.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > REPAIR_REACH || dist < 1e-4) continue;
    const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / dist;
    if (dot < 0.75) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = box;
    }
  }
  return best;
}

function updateRepair(dt) {
  const target = held("repair") ? nearestRepairable() : null;
  if (!target || target !== repairTarget) {
    repair = 0;
    repairTarget = target;
  }
  if (!target) return;
  repair += dt;
  if (repair < REPAIR_TIME) return;
  target.hp = target.maxHp;
  target.holes = [];
  rebuildPanel(target);
  paintWall(target);
  if (mode === "net") queueWall(target);
  repair = 0;
  repairTarget = null;
}

function coveredByHole(along, y, half, holes) {
  for (const hole of holes) {
    const dy = y - hole.v;
    if (Math.abs(dy) >= hole.r) continue;
    const reach = Math.sqrt(hole.r * hole.r - dy * dy);
    if (Math.abs(along - hole.u) + half <= reach - 0.01) return true;
  }
  return false;
}

function bodyClearsPanel(actor, box) {
  if (!box.breakable || !box.axis) return false;
  const holes = holesOnPlane(box.axis, wallPlane(box));
  if (!holes.length) return false;
  const y0 = Math.max(box.minY, 0);
  const y1 = Math.min(box.maxY, bodyTop(actor));
  if (y1 <= y0) return false;
  const along = box.axis === "x" ? actor.z : actor.x;
  const dirX = box.axis === "x" ? 0 : 1;
  const dirZ = box.axis === "x" ? 1 : 0;
  const samples = [y0, y1];
  for (let y = y0; y <= y1; y += 0.05) samples.push(y);
  const sy = crouchScale(actor);
  for (const part of BODY_PARTS) {
    const cy = part.y * sy;
    if (cy >= y0 && cy <= y1) samples.push(cy);
  }
  for (const y of samples) {
    const half = radiusAt(actor, y, dirX, dirZ);
    if (half <= 0.001) continue;
    if (!coveredByHole(along, y, half, holes)) return false;
  }
  return true;
}

function resolveCircle(actor, box) {
  if (box.hp <= 0 || box.maxY <= 0.05) return;
  const closestX = clamp(actor.x, box.minX, box.maxX);
  const closestZ = clamp(actor.z, box.minZ, box.maxZ);
  let dx = actor.x - closestX;
  let dz = actor.z - closestZ;
  if (dx * dx + dz * dz >= 0.55 * 0.55) return;
  if (bodyTop(actor) <= box.minY) return;
  if (bodyClearsPanel(actor, box)) return;
  const radX = radiusAtBand(actor, box.minY, box.maxY, 1, 0);
  const radZ = radiusAtBand(actor, box.minY, box.maxY, 0, 1);
  if (radX <= 0 && radZ <= 0) return;
  if (dx === 0 && dz === 0) {
    const left = actor.x - box.minX;
    const right = box.maxX - actor.x;
    const near = actor.z - box.minZ;
    const far = box.maxZ - actor.z;
    const min = Math.min(left, right, near, far);
    if (min === left) actor.x = box.minX - radX;
    else if (min === right) actor.x = box.maxX + radX;
    else if (min === near) actor.z = box.minZ - radZ;
    else actor.z = box.maxZ + radZ;
    return;
  }
  const distance = Math.hypot(dx, dz);
  const radius = radiusAtBand(actor, box.minY, box.maxY, dx / distance, dz / distance);
  if (radius > 0 && distance < radius) {
    actor.x += (dx / distance) * (radius - distance);
    actor.z += (dz / distance) * (radius - distance);
  }
}

function radiusAtBand(actor, minY, maxY, dirX, dirZ) {
  const y0 = Math.max(minY, 0);
  const y1 = Math.min(maxY, bodyTop(actor));
  if (y1 <= y0) return 0;
  let best = 0;
  for (let y = y0; y <= y1 + 1e-4; y += 0.08) best = Math.max(best, radiusAt(actor, Math.min(y, y1), dirX, dirZ));
  const sy = crouchScale(actor);
  for (const part of BODY_PARTS) {
    const cy = part.y * sy;
    if (cy >= y0 && cy <= y1) best = Math.max(best, radiusAt(actor, cy, dirX, dirZ));
  }
  return best;
}

function pushActor(actor) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const box of boxes) resolveCircle(actor, box);
  }
  actor.x = clamp(actor.x, X0 + THICK + BODY_RADIUS, X1 - THICK - BODY_RADIUS);
  actor.z = clamp(actor.z, Z0 + THICK + BODY_RADIUS, Z1 - THICK - BODY_RADIUS);
  const other = actor === player ? bot : player;
  if (other.alive && actor.alive) {
    const dx = actor.x - other.x;
    const dz = actor.z - other.z;
    const distance = Math.hypot(dx, dz);
    const min = BODY_RADIUS * 2;
    if (distance > 0 && distance < min) {
      actor.x += (dx / distance) * (min - distance);
      actor.z += (dz / distance) * (min - distance);
    }
  }
}

function accelerate(actor, wishX, wishZ, dt) {
  const dx = wishX - actor.vx;
  const dz = wishZ - actor.vz;
  const distance = Math.hypot(dx, dz);
  const step = MOVE_ACCEL * dt;
  if (distance <= step) {
    actor.vx = wishX;
    actor.vz = wishZ;
    return;
  }
  actor.vx += (dx / distance) * step;
  actor.vz += (dz / distance) * step;
}

function held(action) {
  const code = binds[action];
  return Boolean(code && keys[code]);
}

function updatePlayer(dt) {
  if (!player.alive) return;
  const wantSprint = held("sprint");
  const wantCrouch = held("crouch") && !wantSprint;
  let leanWish = 0;
  if (held("leanLeft")) leanWish -= 1;
  if (held("leanRight")) leanWish += 1;
  player.lean += (leanWish - player.lean) * Math.min(1, dt * 12);
  player.crouch += ((wantCrouch ? 1 : 0) - player.crouch) * Math.min(1, dt * 10);
  const { forward, right } = playerPlanarBasis();
  let forwardInput = 0;
  let strafeInput = 0;
  if (held("forward")) forwardInput += 1;
  if (held("back")) forwardInput -= 1;
  if (held("right")) strafeInput += 1;
  if (held("left")) strafeInput -= 1;
  const wish = new THREE.Vector3();
  wish.addScaledVector(forward, forwardInput).addScaledVector(right, strafeInput);
  let speed = 0;
  if (wish.lengthSq() > 0) {
    wish.normalize();
    if (wantSprint) {
      speed = SPRINT_SPEED;
      player.gait = "sprint";
    } else if (wantCrouch) {
      speed = CROUCH_SPEED;
      player.gait = "crouch";
    } else {
      speed = WALK_SPEED;
      player.gait = "walk";
    }
    speed *= 1 - 0.28 * ads;
  } else player.gait = wantCrouch ? "crouch" : "walk";
  accelerate(player, wish.x * speed, wish.z * speed, dt);
  if (Math.hypot(player.vx, player.vz) > 0.001) {
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    pushActor(player);
  }
  updateSteps(player, dt, true);
}

function updateBot(dt) {
  if (mode === "net" || freezeBot || !bot.alive || !bot.mesh) return;
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  facePlayer();
  if (!botGoal) newBotRoute();
  botRetarget -= dt;
  botPause -= dt;
  if (botRetarget <= 0) newBotRoute();
  const forward = botForward();
  const right = new THREE.Vector3().crossVectors(forward, UP);
  const wish = new THREE.Vector3();
  const gx = botGoal.x - bot.x;
  const gz = botGoal.z - bot.z;
  const goalDistance = Math.hypot(gx, gz);
  if (goalDistance < 0.8) newBotRoute();
  if (botPause <= 0 && goalDistance > 0.05) {
    wish.set(gx / goalDistance, 0, gz / goalDistance);
    wish.addScaledVector(right, bot.strafe * diff.jitter * 0.55);
  }
  const playerDistance = Math.hypot(player.x - bot.x, player.z - bot.z);
  let gait = "walk";
  if (player.alive && playerDistance < diff.range) {
    if (playerDistance < 3.2) gait = "crouch";
    else if (playerDistance > 8) gait = "sprint";
  }
  bot.gait = gait;
  bot.crouch += ((gait === "crouch" ? 1 : 0) - (bot.crouch || 0)) * Math.min(1, dt * 8);
  if (botPause <= 0 && playerDistance < 2.2 && playerDistance > 0.05) {
    wish.addScaledVector(
      new THREE.Vector3((bot.x - player.x) / playerDistance, 0, (bot.z - player.z) / playerDistance),
      0.9,
    );
  }
  let targetX = 0;
  let targetZ = 0;
  if (wish.lengthSq() > 0) {
    wish.normalize();
    const ahead = trace(bot.x, 1, bot.z, wish.x, 0, wish.z, bot);
    if (ahead && ahead.box && ahead.t < 1.3) {
      wish.copy(right).multiplyScalar(bot.strafe || 1);
      if (ahead.t < 0.55) newBotRoute();
    }
    if (wish.lengthSq() > 0) {
      wish.normalize();
      const gaitMul = gait === "sprint" ? 1.35 : gait === "crouch" ? 0.55 : 1;
      targetX = wish.x * diff.speed * gaitMul;
      targetZ = wish.z * diff.speed * gaitMul;
    }
  }
  accelerate(bot, targetX, targetZ, dt);
  if (Math.hypot(bot.vx, bot.vz) > 0.001) {
    bot.x += bot.vx * dt;
    bot.z += bot.vz * dt;
    pushActor(bot);
  }
  let sawPlayer = false;
  if (player.alive && player.spawnLock <= 0 && bot.spawnLock <= 0 && playerDistance < diff.range) {
    const origin = new THREE.Vector3(bot.x, aimHeight(bot), bot.z);
    const aim = new THREE.Vector3(player.x, chestHeight(player), player.z).sub(origin);
    const reach = aim.length();
    if (reach > 1e-4) {
      aim.multiplyScalar(1 / reach);
      const sight = trace(origin.x, origin.y, origin.z, aim.x, aim.y, aim.z, bot);
      if (sight && sight.actor === player) {
        sawPlayer = true;
        botSee += dt;
        if (botSee >= diff.reaction) fireShot(bot);
      }
    }
  }
  if (!sawPlayer) botSee = 0;
}

function tickActor(actor, dt) {
  actor.spawnLock = Math.max(0, actor.spawnLock - dt);
  actor.cooldown = Math.max(0, actor.cooldown - dt);
  if (actor.reload > 0) {
    actor.reload -= dt;
    if (actor.reload <= 0) {
      actor.reload = 0;
      const reloaded = WEAPONS.find((weapon) => weapon.id === actor.reloadId);
      if (reloaded) actor.ammo[reloaded.id] = reloaded.mag;
    }
  }
}

function update(dt) {
  if (!playing) {
    menuYaw += dt * 0.18;
    player.x = -18;
    player.z = 8;
    player.yaw = menuYaw;
    player.pitch = -0.15;
    syncCamera();
    placeGun();
    poseOpponent();
    damageFlash = Math.max(0, damageFlash - dt);
    hitMarker = Math.max(0, hitMarker - dt);
    paintHud();
    return;
  }

  if (paused) {
    syncCamera();
    paintHud();
    return;
  }

  tickActor(player, dt);
  tickActor(bot, dt);
  if (matchOver) {
    resetIn -= dt;
    if (resetIn <= 0) resetMatch();
  } else if (roundWait > 0) {
    roundWait -= dt;
    if (roundWait <= 0) beginRound();
  } else {
    updatePlayer(dt);
    updateBot(dt);
    updateRepair(dt);
  }
  updateAds(dt);
  syncCamera();
  if (bot.mesh) {
    poseOpponent();
    if (bot.lean) {
      bot.mesh.updateMatrixWorld(true);
      const leanRight = new THREE.Vector3().setFromMatrixColumn(bot.mesh.matrixWorld, 0);
      leanRight.y = 0;
      if (leanRight.lengthSq() > 1e-8) {
        leanRight.normalize();
        bot.mesh.position.addScaledVector(leanRight, bot.lean * LEAN_OFFSET);
      }
    }
    updateWalk(dt);
    bot.mesh.visible = bot.alive;
  }
  updateListener();
  for (let i = tracers.length - 1; i >= 0; i -= 1) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
  damageFlash = Math.max(0, damageFlash - dt);
  hitMarker = Math.max(0, hitMarker - dt);
  const bloomSpec = BLOOM[WEAPONS[player.weapon].id];
  hipBloom = Math.max(0, hipBloom - (bloomSpec ? bloomSpec.recover : 0.2) * dt);
  paintHud();
}

function resetMatch() {
  matchOver = false;
  resetIn = 0;
  roundWait = 0;
  banner = "";
  player.kills = 0;
  bot.kills = 0;
  repair = 0;
  repairTarget = null;
  restoreWalls();
  respawn(player);
  if (mode !== "net") respawn(bot);
  equipPlayer(weaponById(primaryId));
  player.yaw = Math.atan2(-(bot.spawnX - player.spawnX), -(bot.spawnZ - player.spawnZ));
}

function showHitMarker(kill, head) {
  hitMarker = 0.22;
  const mark = document.getElementById("hit");
  if (!mark) return;
  mark.classList.add("show");
  mark.classList.toggle("kill", Boolean(kill));
  mark.classList.toggle("head", Boolean(head) && !kill);
}

function paintHud() {
  const weapon = WEAPONS[player.weapon];
  const top = document.getElementById("top");
  const health = document.getElementById("health-label");
  const fill = document.getElementById("fill");
  const ammo = document.getElementById("ammo");
  const name = document.getElementById("weapon");
  const hint = document.getElementById("hint");
  const bannerEl = document.getElementById("banner");
  const flash = document.getElementById("dmg");
  if (!top) return;
  const botGun = WEAPONS[bot.weapon] ? WEAPONS[bot.weapon].name : "";
  const foe = mode === "net" ? "Friend" : `${DIFFICULTY[difficulty].label} bot`;
  top.textContent = `You ${player.kills}  —  ${foe} ${bot.kills} (${botGun})  —  first to ${WIN_SCORE}`;
  const hp = Math.max(0, Math.ceil(player.health));
  health.textContent = player.alive ? `Health ${hp}` : "Health 0";
  fill.style.width = `${hp}%`;
  name.textContent = weapon.name;
  if (player.reload > 0) ammo.textContent = "Reloading";
  else ammo.textContent = `${player.ammo[weapon.id]} / ${weapon.mag}`;
  if (repairTarget && held("repair")) {
    hint.textContent = `Repairing ${Math.min(100, Math.round((repair / REPAIR_TIME) * 100))}%`;
  } else if (!matchOver && roundWait > 0) {
    hint.textContent = "Pick primary: 1 SMG, 2 AR, 3 Shotgun, 4 Sniper";
  } else hint.textContent = weapon.hint;
  let message = banner;
  if (!matchOver && roundWait > 0) message = `Next round in ${Math.max(1, Math.ceil(roundWait))}`;
  else if (!matchOver && roundWait <= 0 && player.alive && player.spawnLock > 0) message = "Spawn protection";
  bannerEl.textContent = message;
  flash.style.opacity = String(damageFlash > 0 ? 1 : 0);
  updateCrosshair();
  const mark = document.getElementById("hit");
  if (mark) {
    mark.classList.toggle("show", hitMarker > 0);
    if (hitMarker <= 0) mark.classList.remove("kill", "head");
  }
}

function validateArena() {
  const problems = [];
  const inner = boxes.filter((box) => box.breakable);
  const outer = boxes.filter((box) => !box.breakable);
  if (outer.length !== 6) problems.push(`outer shell is ${outer.length} pieces`);
  if (inner.length < 80) problems.push(`only ${inner.length} wall sections`);
  for (let i = 0; i < inner.length; i += 1) {
    const thin = Math.min(inner[i].maxX - inner[i].minX, inner[i].maxZ - inner[i].minZ);
    if (thin > 0.1) {
      problems.push("a wall is not paper thin");
      break;
    }
    const dx = inner[i].maxX - inner[i].minX;
    const dy = inner[i].maxY - inner[i].minY;
    const dz = inner[i].maxZ - inner[i].minZ;
    const face = [dx, dy, dz].sort((a, b) => b - a);
    if (face[0] > 0.55 || face[1] > 0.55) {
      problems.push("panels are not split into small pieces");
      break;
    }
  }
  const seamRow = inner.filter((box) => box.minX > 5.5 && box.maxX < 6.5
    && Math.abs(box.minY - 1.35) < 0.02 && box.minZ >= 2);
  seamRow.sort((a, b) => a.minZ - b.minZ);
  if (seamRow.length < 8) problems.push("right wall is not split into small panels");
  for (let i = 1; i < seamRow.length; i += 1) {
    if (Math.abs(seamRow[i].minZ - seamRow[i - 1].maxZ) > 0.001) {
      problems.push("gap between wall panels");
      break;
    }
  }
  for (let i = 0; i < inner.length; i += 1) {
    for (let j = i + 1; j < inner.length; j += 1) {
      const a = inner[i];
      const b = inner[j];
      const overlap = a.minX < b.maxX - 0.01 && a.maxX > b.minX + 0.01
        && a.minY < b.maxY - 0.01 && a.maxY > b.minY + 0.01
        && a.minZ < b.maxZ - 0.01 && a.maxZ > b.minZ + 0.01;
      if (overlap) {
        problems.push("two inner walls overlap");
        i = inner.length;
        break;
      }
    }
  }
  for (const actor of [player, bot]) {
    for (const box of boxes) {
      if (box.maxY <= 0.05 || box.minY >= 1.7) continue;
      const closestX = clamp(actor.spawnX, box.minX, box.maxX);
      const closestZ = clamp(actor.spawnZ, box.minZ, box.maxZ);
      const clearance = Math.hypot(actor.spawnX - closestX, actor.spawnZ - closestZ);
      if (clearance < 0.9) problems.push(`spawn blocked at ${actor.spawnX},${actor.spawnZ}`);
    }
  }
  return problems;
}

function clearKeys() {
  for (const code of Object.keys(keys)) keys[code] = false;
}

function runSelfTest() {
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  playing = true;
  paused = false;
  pauseOpen = false;
  difficulty = "medium";
  mode = "bot";
  roundWait = 0;
  matchOver = false;
  clearKeys();
  const mapProblems = validateArena();
  check(mapProblems.length === 0, mapProblems.join("; ") || "map");
  check(X1 - X0 >= 40 && Z1 - Z0 >= 28, "arena did not grow");

  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.alive = true;
  const basis = playerPlanarBasis();
  check(basis.forward.distanceTo(new THREE.Vector3(0, 0, -1)) < 0.001, "forward is not -z");
  check(basis.right.distanceTo(new THREE.Vector3(1, 0, 0)) < 0.001, "right is not +x");
  check(binds.forward === "KeyW" && binds.back === "KeyS" && binds.left === "KeyA" && binds.right === "KeyD"
    && binds.repair === "KeyE" && binds.reload === "KeyR" && binds.sprint === "ShiftLeft"
    && binds.crouch === "ControlLeft" && binds.leanLeft === "KeyQ" && binds.leanRight === "KeyF",
  "default keybinds changed");
  playSpatial("sprint", 4, EYE, 0, footGain("sprint"), false);
  const hearRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const toRight = new THREE.Vector3(lastSound.x - camera.position.x, 0, lastSound.z - camera.position.z).normalize();
  check(toRight.dot(hearRight) > 0.9, "a footstep on +x is not to the right");
  playSpatial("walk", 0, EYE, -4, footGain("walk"), false);
  const hearForward = new THREE.Vector3();
  camera.getWorldDirection(hearForward);
  const toFront = new THREE.Vector3(lastSound.x - camera.position.x, 0, lastSound.z - camera.position.z).normalize();
  check(toFront.dot(hearForward) > 0.9, "a footstep on -z is not in front");
  check(footGain("sprint") > footGain("walk") && footGain("walk") > footGain("crouch"), "crouch is not quieter than walking");
  check(lastSound.local === false && lastSound.gain === footGain("walk"), "opponent steps are not played at walk loudness");
  check(lastSound.heard === true && lastSound.walls === 0, `open footsteps were blocked (${lastSound.walls})`);
  player.x = 0;
  player.z = 4;
  player.yaw = 0;
  player.pitch = 0;
  syncCamera();
  playSpatial("walk", 10, EYE, 4, footGain("walk"), false);
  check(lastSound.walls === 1 && lastSound.heard === true, `one wall silenced footsteps (${lastSound.walls}, ${lastSound.heard})`);
  player.x = -16;
  player.z = 0;
  syncCamera();
  playSpatial("walk", 16, EYE, 0, footGain("walk"), false);
  check(lastSound.walls >= 2 && lastSound.heard === false, `two walls still played footsteps (${lastSound.walls}, ${lastSound.heard})`);
  playSpatial("shot", 16, EYE, 0, 0.55, false);
  check(lastSound.kind === "shot" && lastSound.walls >= 2 && lastSound.heard === true, "gunshots were blocked by walls");
  playSpatial("boom", 16, EYE, 0, 0.95, false);
  check(lastSound.kind === "boom" && lastSound.heard === true, "shotgun blasts were blocked by walls");
  playSpatial("walk", 16, EYE, 0, footGain("walk"), true);
  check(lastSound.local === true && lastSound.heard === true, "your own steps were silenced");
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.lean = 0;
  player.crouch = 0;
  syncCamera();
  player.lean = 1;
  player.crouch = 0;
  syncCamera();
  check(camera.position.x > player.x + 0.3 && Math.abs(player.x) < 0.001 && Math.abs(player.z) < 0.001, "lean right moved the body");
  player.lean = -1;
  syncCamera();
  check(camera.position.x < -0.3, "lean left did not peek left");
  player.lean = 0;
  player.crouch = 1;
  syncCamera();
  check(camera.position.y < EYE - 0.4, "crouch did not lower the camera");
  check(actorBox(player).maxY < 1.3, "crouch did not shrink the hitbox");
  player.crouch = 0;
  player.lean = 0;
  syncCamera();
  check(Math.abs(camera.position.y - EYE) < 0.02, "standing camera changed");
  check(Math.abs(actorBox(player).maxY - bodyTop(player)) < 0.001 && bodyTop(player) < 1.72 && bodyTop(player) > 1.6, "standing hitbox does not match the body");

  freezeBot = true;
  bot.alive = false;
  bot.respawnIn = 100;
  const tryMove = (code) => {
    player.x = 0;
    player.z = 0;
    player.vx = 0;
    player.vz = 0;
    player.yaw = 0;
    player.pitch = 0;
    player.alive = true;
    player.lean = 0;
    player.crouch = 0;
    ads = 0;
    roundWait = 0;
    matchOver = false;
    keys[code] = true;
    update(0.15);
    keys[code] = false;
    return new THREE.Vector3(player.x, 0, player.z);
  };
  const movedW = tryMove("KeyW");
  check(movedW.length() > 0.18 && movedW.normalize().dot(new THREE.Vector3(0, 0, -1)) > 0.9, "W did not move forward");
  const movedS = tryMove("KeyS");
  check(movedS.length() > 0.18 && movedS.normalize().dot(new THREE.Vector3(0, 0, 1)) > 0.9, "S did not move back");
  const movedD = tryMove("KeyD");
  check(movedD.length() > 0.18 && movedD.normalize().dot(new THREE.Vector3(1, 0, 0)) > 0.9, "D did not move right");
  const movedA = tryMove("KeyA");
  check(movedA.length() > 0.18 && movedA.normalize().dot(new THREE.Vector3(-1, 0, 0)) > 0.9, "A did not move left");

  player.vx = 0;
  player.vz = 0;
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.alive = true;
  ads = 0;
  roundWait = 0;
  matchOver = false;
  keys.KeyW = true;
  update(0.1);
  const earlySpeed = Math.hypot(player.vx, player.vz);
  update(0.1);
  const lateSpeed = Math.hypot(player.vx, player.vz);
  keys.KeyW = false;
  check(lateSpeed > earlySpeed + 0.8 && lateSpeed <= WALK_SPEED + 0.01, `movement did not ease in (${earlySpeed.toFixed(2)} then ${lateSpeed.toFixed(2)})`);
  const sampleSpeed = (action) => {
    clearKeys();
    player.x = 0;
    player.z = 0;
    player.vx = 0;
    player.vz = 0;
    player.yaw = 0;
    player.pitch = 0;
    player.lean = 0;
    player.crouch = 0;
    player.alive = true;
    ads = 0;
    roundWait = 0;
    matchOver = false;
    playing = true;
    paused = false;
    keys[binds.forward] = true;
    if (action) keys[binds[action]] = true;
    update(0.5);
    const speed = Math.hypot(player.vx, player.vz);
    clearKeys();
    return speed;
  };
  const walked = sampleSpeed(null);
  const sprinted = sampleSpeed("sprint");
  const crouched = sampleSpeed("crouch");
  check(sprinted > walked + 0.8 && walked > crouched + 0.4, `speeds walk ${walked.toFixed(2)} sprint ${sprinted.toFixed(2)} crouch ${crouched.toFixed(2)}`);
  check(Math.abs(walked - WALK_SPEED) < 0.05 && Math.abs(sprinted - SPRINT_SPEED) < 0.05 && Math.abs(crouched - CROUCH_SPEED) < 0.05, "sprint or crouch missed its speed");
  player.crouch = 0;
  player.lean = 0;
  player.vx = 0;
  player.vz = 0;
  player.gait = "walk";
  check(Boolean(bot.body && bot.visor), "opponent is not a blob");
  bot.vx = 0;
  bot.vz = 0;
  bot.mesh.rotation.set(0, 0, 0);
  poseBlob(0, 1);
  const resting = bot.body.scale.clone();
  check(Math.abs(resting.x - 1) < 0.001 && Math.abs(resting.y - 1) < 0.001 && Math.abs(resting.z - 1) < 0.001, "blob is stretched while standing still");
  poseBlob(0.1, 1);
  const smallSquash = Math.abs(bot.body.scale.z - 1);
  poseBlob(0.28, 1);
  const biggerSquash = Math.abs(bot.body.scale.z - 1);
  check(smallSquash > 0.02 && biggerSquash > smallSquash + 0.03, `blob shape did not grow with distance (${smallSquash.toFixed(3)} then ${biggerSquash.toFixed(3)})`);
  bot.mesh.rotation.set(0, 0, 0);
  bot.vx = 0;
  bot.vz = -6;
  poseBlob(0, 0);
  check(bot.body.scale.z > bot.body.scale.x + 0.08, `speed did not stretch the blob (${bot.body.scale.z.toFixed(3)} vs ${bot.body.scale.x.toFixed(3)})`);
  bot.vx = 0;
  bot.vz = 0;
  poseBlob(0, 0);
  const coveredFrom = bot.z;
  bot.walkX = bot.x;
  bot.walkZ = bot.z;
  bot.walkDistance = 0;
  bot.z = coveredFrom - 0.17;
  updateWalk(1);
  check(Math.abs(bot.walkDistance - 0.17) < 0.001, `walk used time instead of distance (${bot.walkDistance.toFixed(3)})`);
  bot.z = coveredFrom;
  bot.walkX = bot.x;
  bot.walkZ = bot.z;
  bot.walkDistance = 0;
  bot.walkBlend = 0;
  bot.vx = 0;
  bot.vz = 0;
  poseBlob(0, 0);

  const smg = WEAPONS[0];
  const ar = WEAPONS[1];
  const shotgun = WEAPONS[2];
  const sniper = WEAPONS[3];
  check(smg.interval < ar.interval && smg.interval === 0.07, "SMG is not faster than the AR");
  check(smg.damage < ar.damage && smg.damage === 14 && ar.damage === 21, "SMG damage is not lower than the AR");
  check(smg.recoil > ar.recoil, "SMG recoil is not harder to control");
  check(DIFFICULTY.easy.speed < DIFFICULTY.medium.speed
    && DIFFICULTY.medium.speed < DIFFICULTY.hard.speed
    && DIFFICULTY.hard.speed < DIFFICULTY.hacker.speed, "bot difficulties are not ordered");
  check(DIFFICULTY.easy.reaction > DIFFICULTY.hard.reaction && DIFFICULTY.hacker.reaction === 0
    && DIFFICULTY.hacker.spread === 0 && DIFFICULTY.easy.spread > DIFFICULTY.medium.spread, "bot aim settings are wrong");
  check(HOLE_RADIUS.smg === HOLE_RADIUS.ar && HOLE_RADIUS.ar < HOLE_RADIUS.sniper
    && HOLE_RADIUS.sniper < HOLE_RADIUS.shotgun, "bullet holes are not sized by gun");
  check(smg.mag === 30 && ar.mag === 30, "SMG or AR mag is not 30");
  check(smg.spread === 0.02 && ar.spread === 0.007, "rifle spread changed");
  player.weapon = 1;
  player.vx = 0;
  player.vz = 0;
  ads = 0;
  hipBloom = 0;
  check(Math.abs(playerShotSpread(ar) - ar.spread) < 1e-6, "standing AR hip spread changed");
  player.vx = SPRINT_SPEED;
  check(playerShotSpread(ar) > ar.spread + 0.008, "moving did not open the AR");
  player.vx = 0;
  hipBloom = 0.02;
  check(playerShotSpread(ar) > ar.spread + 0.015, "firing did not open the AR");
  ads = 1;
  check(playerShotSpread(ar) < 0.004, "ADS kept the hip spread");
  ads = 0;
  hipBloom = 0;
  player.weapon = 0;
  player.vx = SPRINT_SPEED;
  check(playerShotSpread(smg) > smg.spread + 0.01, "SMG did not spread while moving");
  player.vx = 0;
  player.vz = 0;
  updateCrosshair();
  player.weapon = 2;
  updateCrosshair();
  check(document.getElementById("cross").classList.contains("shotgun"), "shotgun crosshair is still a plus");
  const ring = document.querySelector("#cross .ring");
  check(ring && parseFloat(ring.style.width) > 40, "shotgun crosshair has no pellet circle");
  player.weapon = 1;
  updateCrosshair();
  const arButton = document.querySelector("#guns button[data-gun='ar']");
  showGunTip(arButton);
  const gunTip = document.getElementById("gun-tip");
  const arCard = weaponCard(ar);
  check(gunTip && gunTip.hidden === false && gunTip.textContent.includes(String(ar.damage))
    && gunTip.textContent.includes(String(arCard.rpm))
    && gunTip.textContent.includes(String(arCard.dps))
    && gunTip.textContent.includes("Accuracy"), "AR stats did not show");
  showGunTip(document.querySelector("[data-gun='shotgun']"));
  check(gunTip.textContent.includes("7 × 20") && gunTip.textContent.includes("DPS"), "shotgun stats did not show");
  showGunTip(document.querySelector("[data-gun='pistol']"));
  check(gunTip.textContent.includes("Pistol") && gunTip.textContent.includes(String(weaponCard(WEAPONS[4]).dps)), "pistol stats did not show");
  hideGunTip();
  check(gunTip.hidden === true, "weapon stats stayed open");
  check(shotgun.mag === 2 && shotgun.pellets === 20 && shotgun.damage === 7 && shotgun.spread === 0.12, "shotgun is not 20 pellets of 7");
  check(shotgunHoleRadius(1) === HOLE_RADIUS.shotgun && shotgunHoleRadius(12) === SHOTGUN_FAR_HOLE
    && SHOTGUN_FAR_HOLE < HOLE_RADIUS.ar, "shotgun holes do not shrink with distance");
  check(sniper.mag === 1 && sniper.damage === 100 && sniper.spread === 0, "sniper mag is not 1");
  check(shotgun.pellets * shotgun.damage * falloff(shotgun, 1) >= 100, "shotgun does not one-tap up close");
  check(shotgun.pellets * shotgun.damage * falloff(shotgun, 14) < 30, "shotgun dropoff is too weak");
  check(falloff(sniper, 40) === 1, "sniper damage changes with distance");
  check(gun.children.length >= 4, "gun model is still a single box");

  player.weapon = 1;
  ads = 1;
  adsHeld = false;
  showGun();
  updateAds(0);
  syncCamera();
  check(Math.abs(camera.fov - 48) < 0.05, `AR sight is not 1.5x (${camera.fov.toFixed(1)})`);
  let redDot = false;
  gun.traverse((child) => {
    if (child.material && child.material.color && child.material.color.getHex() === 0xff2a2a) redDot = true;
  });
  check(redDot, "AR has no red dot");
  const aim = new THREE.Vector3();
  camera.getWorldDirection(aim);
  let sightCount = 0;
  let worstSight = 0;
  gun.traverse((child) => {
    if (!child.userData || !child.userData.sight) return;
    sightCount += 1;
    const fromCamera = new THREE.Vector3();
    child.getWorldPosition(fromCamera);
    fromCamera.sub(camera.position);
    const along = fromCamera.dot(aim);
    fromCamera.addScaledVector(aim, -along);
    worstSight = Math.max(worstSight, fromCamera.length());
  });
  check(sightCount >= 2 && worstSight < 0.02, `AR sights are off the aim line (${sightCount}, ${worstSight.toFixed(3)})`);
  let arCircle = false;
  let arBoxSight = false;
  gun.traverse((child) => {
    if (!child.userData || !child.userData.sight || !child.geometry) return;
    if (child.geometry.type === "TorusGeometry") arCircle = true;
    if (child.geometry.type === "BoxGeometry") arBoxSight = true;
  });
  check(arCircle && !arBoxSight, "AR sight is not a circle");
  ads = 0;
  updateAds(0);
  check(document.getElementById("cross").style.display !== "none", "hip fire hid the crosshair");
  ads = 1;
  updateAds(0);
  check(document.getElementById("cross").style.display === "none", "ADS left the crosshair on");
  const scopeEl = document.getElementById("scope");
  check(!scopeEl.classList.contains("on"), "AR aim turned on the sniper scope");
  player.weapon = 0;
  ads = 1;
  showGun();
  updateAds(0);
  check(Math.abs(camera.fov - HIP_FOV) < 0.05, `SMG zoomed (${camera.fov.toFixed(1)})`);
  check(document.getElementById("cross").style.display === "none", "SMG aim kept the crosshair");
  let smgDot = false;
  gun.traverse((child) => {
    if (child.material && child.material.color && child.material.color.getHex() === 0xff2a2a) smgDot = true;
  });
  check(smgDot, "SMG has no red dot");
  let smgCircle = false;
  gun.traverse((child) => {
    if (child.userData && child.userData.sight && child.geometry && child.geometry.type === "TorusGeometry") smgCircle = true;
  });
  check(smgCircle, "SMG sight is not a circle");
  player.weapon = 3;
  ads = 1;
  showGun();
  updateAds(0);
  let scopeRings = 0;
  let blockedScope = false;
  gun.traverse((child) => {
    if (!child.userData || !child.userData.sight) return;
    scopeRings += 1;
    if (child.geometry && child.geometry.type === "CylinderGeometry") blockedScope = true;
  });
  check(scopeRings >= 2 && !blockedScope, "sniper scope blocks the center");
  check(scopeEl.classList.contains("on"), "sniper aim did not show the scope");
  check(document.getElementById("cross").style.display !== "none", "sniper aim hid the crosshair");
  player.weapon = 4;
  ads = 1;
  showGun();
  updateAds(0);
  let pistolDot = false;
  let pistolRing = false;
  let pistolPost = false;
  gun.traverse((child) => {
    if (child.material && child.material.color && child.material.color.getHex() === 0xff2a2a) pistolDot = true;
    if (!child.userData || !child.userData.sight || !child.geometry) return;
    if (child.geometry.type === "TorusGeometry") pistolRing = true;
    if (child.geometry.type === "BoxGeometry") pistolPost = true;
  });
  check(!pistolDot && !pistolRing && pistolPost, "pistol is not using iron sights");
  ads = 0;
  adsHeld = false;
  player.weapon = 0;
  showGun();
  updateAds(0);

  primaryId = "shotgun";
  playing = true;
  roundWait = 0;
  matchOver = false;
  equipPlayer(weaponById("shotgun"));
  selectWeapon(4);
  check(primaryId === "shotgun" && WEAPONS[player.weapon].id === "shotgun", "primary changed during the round");
  selectWeapon(2);
  check(WEAPONS[player.weapon].id === "pistol", "2 did not equip the pistol");
  selectWeapon(1);
  check(WEAPONS[player.weapon].id === "shotgun" && player.ammo.pistol === 12, "1 did not return to the primary");
  roundWait = 2;
  selectWeapon(1);
  check(primaryId === "smg" && WEAPONS[player.weapon].id === "smg", "could not pick a primary before the round");
  primaryId = "ar";
  roundWait = 0;
  player.weapon = 0;
  showGun();
  updateAds(0);

  player.weapon = 0;
  player.ammo = freshAmmo();
  player.ammo.smg = 0;
  player.reload = 0;
  player.cooldown = 0;
  player.spawnLock = SPAWN_LOCK;
  player.alive = true;
  player.health = 100;
  roundWait = 0;
  matchOver = false;
  const emptyFired = fireShot(player);
  check(emptyFired === false && player.spawnLock === SPAWN_LOCK, "empty gun ended spawn protection");
  player.reload = 0;
  player.reloadId = null;
  player.ammo = freshAmmo();
  player.spawnLock = SPAWN_LOCK;
  player.pitch = 1.05;
  player.yaw = 0;
  player.x = 0;
  player.z = 0;
  const didFire = fireShot(player);
  check(didFire === true && player.spawnLock === 0, "a fired bullet left spawn protection up");
  restoreWalls();

  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.alive = true;
  player.health = 100;
  player.spawnLock = 0;
  player.weapon = 2;
  player.ammo = freshAmmo();
  player.reload = 0;
  player.cooldown = 0;
  roundWait = 0;
  matchOver = false;
  player.kills = 0;
  bot.x = 0;
  bot.z = -1.2;
  bot.alive = true;
  bot.health = 100;
  bot.spawnLock = 0;
  player.weapon = 1;
  player.ammo = freshAmmo();
  player.cooldown = 0;
  hitMarker = 0;
  const bodyMark = document.getElementById("hit");
  if (bodyMark) bodyMark.classList.remove("show", "kill", "head");
  player.pitch = Math.atan2(chestHeight(bot) - EYE, 1.2);
  fireShot(player);
  check(bot.health < 100 && bot.health > 0 && bodyMark && bodyMark.classList.contains("show")
    && !bodyMark.classList.contains("kill") && !bodyMark.classList.contains("head"), "a body shot did not show a hit marker");
  player.pitch = 0;
  bot.health = 100;
  player.weapon = 2;
  player.ammo = freshAmmo();
  player.cooldown = 0;
  fireShot(player);
  check(bot.health <= 0, `close shotgun left the opponent at ${bot.health}`);
  check(bodyMark && bodyMark.classList.contains("show") && bodyMark.classList.contains("kill"), "a killing shot did not mark the hit");

  respawn(bot);
  respawn(player);
  player.kills = 0;
  bot.kills = 0;
  matchOver = false;
  player.weapon = 3;
  player.ammo = freshAmmo();
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = -Math.atan(1.4 / 2);
  bot.x = 0;
  bot.z = -2;
  bot.health = 100;
  bot.alive = true;
  bot.spawnLock = 0;
  fireShot(player);
  check(!bot.alive, "sniper aimed low did not drop the opponent");

  respawn(bot);
  player.kills = 0;
  matchOver = false;
  roundWait = 0;
  player.weapon = 3;
  player.ammo = freshAmmo();
  player.cooldown = 0;
  player.reload = 0;
  player.pitch = 0;
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  bot.x = 0;
  bot.z = -2;
  bot.health = 100;
  bot.alive = true;
  bot.spawnLock = 0;
  fireShot(player);
  check(!bot.alive, "sniper aimed at the body did not drop the opponent");

  bot.x = 0;
  bot.z = -3;
  bot.crouch = 0;
  bot.alive = true;
  bot.health = 100;
  bot.spawnLock = 0;
  const throughHead = trace(0, 1.5, 0, 0, 0, -1, player);
  check(throughHead && throughHead.actor === bot && throughHead.head === true, "a ray through the head was not a headshot");
  const throughChest = trace(0, chestHeight(bot), 0, 0, 0, -1, player);
  check(throughChest && throughChest.actor === bot && throughChest.head !== true, "a chest ray counted as a headshot");
  const besideHead = trace(0.34, 1.5, 0, 0, 0, -1, player);
  check(!besideHead || besideHead.actor !== bot, "a shot beside the head still hit the body");
  const belly = trace(0.3, 0.62, 0, 0, 0, -1, player);
  check(belly && belly.actor === bot && belly.head !== true, "a shot on the belly missed the body");
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = Math.atan2(chestHeight(bot) - EYE, 3);
  player.weapon = 1;
  player.ammo = freshAmmo();
  player.cooldown = 0;
  player.reload = 0;
  player.reloadId = null;
  player.alive = true;
  player.kills = 0;
  matchOver = false;
  roundWait = 0;
  fireShot(player);
  check(bot.alive && Math.abs(bot.health - (100 - ar.damage)) < 0.6, `chest shot did ${100 - bot.health} instead of ${ar.damage}`);
  const headMark = document.getElementById("hit");
  check(headMark && headMark.classList.contains("show") && !headMark.classList.contains("head"), "chest shot marked as a headshot");
  bot.health = 100;
  player.ammo = freshAmmo();
  player.cooldown = 0;
  player.reload = 0;
  player.pitch = Math.atan2(headCenterY(bot) - EYE, 3);
  fireShot(player);
  check(bot.alive && Math.abs(bot.health - (100 - ar.damage * HEAD_MULT)) < 0.6, `headshot did ${100 - bot.health} instead of ${ar.damage * HEAD_MULT}`);
  check(headMark && headMark.classList.contains("head") && !headMark.classList.contains("kill"), "headshot marker did not turn gold");
  player.pitch = 0;

  respawn(bot);
  respawn(player);
  player.kills = 0;
  bot.kills = 0;
  matchOver = false;
  roundWait = 0;
  bot.alive = false;
  const beforeOuter = boxes.filter((box) => !box.breakable).every((box) => box.hp === Infinity);
  player.x = -18;
  player.z = 0;
  player.yaw = Math.PI / 2;
  player.pitch = 0;
  player.weapon = 3;
  player.ammo = freshAmmo();
  player.cooldown = 0;
  player.reload = 0;
  player.alive = true;
  fireShot(player);
  const outerUntouched = boxes.filter((box) => !box.breakable).every((box) => box.hp === Infinity);
  check(beforeOuter && outerUntouched, "outer cuboid took damage");

  let holeSample = null;
  const panel = boxes.find((box) => box.breakable && box.minX > 5.5 && box.maxX < 6.5
    && box.minY < EYE && box.maxY > EYE && box.minZ >= 2 && box.maxZ <= 14);
  check(Boolean(panel), "no eye-level section on the right wall");
  if (panel) {
    const neighbor = boxes.find((box) => box !== panel && box.breakable
      && Math.abs(box.minY - panel.minY) < 0.001
      && Math.abs(box.minX - panel.minX) < 0.001
      && Math.abs(box.maxZ - panel.maxZ) > 0.2);
    player.x = 0;
    player.z = (panel.minZ + panel.maxZ) / 2;
    player.yaw = -Math.PI / 2;
    player.pitch = 0;
    player.weapon = 3;
    player.ammo = freshAmmo();
    player.cooldown = 0;
    player.reload = 0;
    player.alive = true;
    player.health = 100;
    roundWait = 0;
    matchOver = false;
    bot.alive = false;
    const sight = trace(player.x, EYE, player.z, 1, 0, 0, player);
    check(sight && sight.box === panel, "center shot did not hit the wall section");
    fireShot(player);
    const sniperHole = panel.holes[0];
    check(panel.holes.length === 1 && sniperHole && Math.abs(sniperHole.r - HOLE_RADIUS.sniper) < 0.001
      && panel.mesh.visible && panel.hp === panel.maxHp
      && panel.mesh.geometry.type === "BoxGeometry"
      && panel.ringMeshes && panel.ringMeshes.length >= 1, "sniper did not punch a medium hole");
    check(Boolean(neighbor) && neighbor.hp === neighbor.maxHp && neighbor.holes.length === 0, "the shot removed a whole slab");
    if (sniperHole && panel.ringMeshes && panel.ringMeshes[0]) {
      const holeCenter = new THREE.Vector3();
      panel.ringMeshes[0].getWorldPosition(holeCenter);
      check(Math.abs(holeCenter.x - (panel.minX + panel.maxX) / 2) < 0.03
        && Math.abs(holeCenter.z - (panel.minZ + sniperHole.along)) < 0.03
        && Math.abs(holeCenter.y - (panel.minY + sniperHole.y)) < 0.03, "bullet hole does not sit on the wall");
    } else check(false, "bullet hole does not sit on the wall");
    const through = trace(player.x, EYE, player.z, 1, 0, 0, player);
    check(!through || through.box !== panel, "the hole still stops bullets");
    const edge = trace(player.x, EYE, panel.minZ + 0.02, 1, 0, 0, player);
    check(edge && edge.box === panel, "the panel edge stopped blocking bullets");
    player.x = panel.minX - 0.15;
    player.z = (panel.minZ + panel.maxZ) / 2;
    pushActor(player);
    check(player.x < panel.minX, "a chest-high hole let you walk through");

    const cx = (panel.minX + panel.maxX) / 2;
    const cy = (panel.minY + panel.maxY) / 2;
    const cz = (panel.minZ + panel.maxZ) / 2;
    player.x = cx - 1.4;
    player.z = cz;
    player.vx = 0;
    player.vz = 0;
    player.alive = true;
    const dx = cx - player.x;
    const dy = cy - EYE;
    const dz = cz - player.z;
    player.yaw = Math.atan2(-dx, -dz || 0);
    player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    roundWait = 0;
    matchOver = false;
    clearKeys();
    keys.KeyE = true;
    update(1.3);
    keys.KeyE = false;
    check(panel.holes.length === 0 && panel.hp === panel.maxHp && panel.mesh.visible
      && panel.mesh.geometry.type === "BoxGeometry", `repair did not restore the section (hp ${panel.hp})`);

    const eyeRow = boxes.filter((box) => box.breakable && box.axis === "x" && box.minX > 5.5 && box.maxX < 6.5
      && box.minY < EYE && box.maxY > EYE && box.minZ >= 2 && box.maxZ <= 14)
      .sort((a, b) => a.minZ - b.minZ);
    const shootPanel = (box, weaponIndex) => {
      player.x = box.minX - 0.9;
      player.z = (box.minZ + box.maxZ) / 2;
      player.yaw = -Math.PI / 2;
      player.pitch = 0;
      player.vx = 0;
      player.vz = 0;
      player.weapon = weaponIndex;
      player.ammo = freshAmmo();
      player.cooldown = 0;
      player.reload = 0;
      player.alive = true;
      ads = 0;
      bot.alive = false;
      fireShot(player);
    };
    const arPanel = eyeRow[6];
    const smgPanel = eyeRow[10];
    const shotPanel = eyeRow[14];
    shootPanel(arPanel, 1);
    shootPanel(smgPanel, 0);
    ringBuilds = 0;
    shootPanel(shotPanel, 2);
    check(ringBuilds <= 2, `shotgun rebuilt the wall ${ringBuilds} times`);
    holeSample = shotPanel;
    check(arPanel.holes.length === 1 && Math.abs(arPanel.holes[0].r - HOLE_RADIUS.ar) < 0.001, `AR hole is ${arPanel.holes[0] && arPanel.holes[0].r}`);
    check(smgPanel.holes.length === 1 && Math.abs(smgPanel.holes[0].r - HOLE_RADIUS.smg) < 0.001, `SMG hole is ${smgPanel.holes[0] && smgPanel.holes[0].r}`);
    check(shotPanel.holes.length >= 1 && shotPanel.holes[0].r > 0.2, `shotgun hole is ${shotPanel.holes[0] && shotPanel.holes[0].r}`);
    check(eyeRow.length > 23, `eye row is short (${eyeRow.length})`);
    check(eyeRow[4].holes.length === 0, "shotgun blast crossed the wall");
    const shotHole = shotPanel.holes[0];
    if (shotHole) {
      const shotThrough = trace(shotPanel.minX - 1, shotPanel.minY + shotHole.y, shotPanel.minZ + shotHole.along, 1, 0, 0, player);
      check(!shotThrough || shotThrough.box !== shotPanel, "the shotgun hole still stops bullets");
      const cornerDist = Math.hypot(0.012 - shotHole.along, 0.012 - shotHole.y);
      if (cornerDist > shotHole.r + 0.008) {
        const shotEdge = trace(shotPanel.minX - 1, shotPanel.minY + 0.012, shotPanel.minZ + 0.012, 1, 0, 0, player);
        check(shotEdge && shotEdge.box === shotPanel, "the shotgun hole removed the whole panel");
      } else check(eyeRow[4].holes.length === 0, "the shotgun hole removed the whole wall");
    } else check(false, "the shotgun hole still stops bullets");
    const mergePanel = eyeRow[1];
    const mx = (mergePanel.minX + mergePanel.maxX) / 2;
    const my = (mergePanel.minY + mergePanel.maxY) / 2;
    const mz = (mergePanel.minZ + mergePanel.maxZ) / 2;
    punchCircle(mergePanel, mx, my, mz - 0.03, HOLE_RADIUS.ar);
    punchCircle(mergePanel, mx, my, mz + 0.03, HOLE_RADIUS.ar);
    check(mergePanel.holes.length === 1 && mergePanel.holes[0].r > HOLE_RADIUS.ar + 0.01, `close shots did not combine (${mergePanel.holes.length}, ${mergePanel.holes[0] && mergePanel.holes[0].r})`);
    const blastPanel = eyeRow[22];
    punchBlast(blastPanel, (blastPanel.minX + blastPanel.maxX) / 2, (blastPanel.minY + blastPanel.maxY) / 2, (blastPanel.minZ + blastPanel.maxZ) / 2, HOLE_RADIUS.shotgun);
    check(blastPanel.holes.length >= 1 && blastPanel.holes[0].r > 0.2, "shotgun blast was not bigger than a rifle hole");
    check(eyeRow[23].holes.length >= 1, "shotgun blast did not reach the next panel");
    check(eyeRow[18].holes.length === 0, "shotgun blast reached a far panel");
    const edgePanel = eyeRow[0];
    check(circleStaysOnWall(edgePanel, {
      along: 0.04,
      y: EYE - edgePanel.minY,
      r: HOLE_RADIUS.shotgun,
    }) === false, "a shot on the wall edge still draws a ring past the wall");
    const midPanel = eyeRow[12];
    check(circleStaysOnWall(midPanel, {
      along: (midPanel.maxZ - midPanel.minZ) / 2,
      y: EYE - midPanel.minY,
      r: HOLE_RADIUS.ar,
    }) === true, "a hole in the middle of the wall lost its outline");
    const farPanel = eyeRow[8];
    const farR = shotgunHoleRadius(12);
    const farY = (farPanel.minY + farPanel.maxY) / 2;
    const farX = (farPanel.minX + farPanel.maxX) / 2;
    punchBlast(farPanel, farX, farY, farPanel.minZ + 0.08, farR);
    punchBlast(farPanel, farX, farY, farPanel.minZ + 0.34, farR);
    check(farPanel.holes.length === 2 && farPanel.holes.every((hole) => hole.r < 0.06), `far shotgun pellets did not stay separate (${farPanel.holes.length}, ${farPanel.holes.map((hole) => hole.r.toFixed(3)).join(",")})`);
    const arcHolds = (arcs, angle) => {
      let turn = angle % (Math.PI * 2);
      if (turn < 0) turn += Math.PI * 2;
      return arcs.some((arc) => (turn >= arc.start - 0.02 && turn <= arc.end + 0.02)
        || (arc.end > Math.PI * 2 && turn <= arc.end - Math.PI * 2 + 0.02));
    };
    const lone = exposedRingArcs({ u: 1, v: 1, r: 0.05 }, []);
    check(lone.length === 1 && lone[0].end - lone[0].start > Math.PI * 2 - 0.2, "a single hole lost its outline");
    const overlapA = { u: 0, v: 0, r: 0.1 };
    const overlapB = { u: 0.12, v: 0, r: 0.1 };
    const overlapArcs = exposedRingArcs(overlapA, [overlapA, overlapB]);
    check(!arcHolds(overlapArcs, 0) && arcHolds(overlapArcs, Math.PI), "overlapping hole outlines still cross");
    const edgeOutline = {
      u: edgePanel.minZ + 0.04,
      v: edgePanel.minY + (EYE - edgePanel.minY),
      r: HOLE_RADIUS.shotgun,
    };
    const edgeArcs = exposedRingArcs(edgeOutline, [edgeOutline], (u, v) => pointOnWall(edgePanel, u, v));
    check(!arcHolds(edgeArcs, Math.PI) && arcHolds(edgeArcs, 0), "an edge outline leaves the wall or drops the part on the wall");
    const cleanRow = boxes.filter((box) => box.breakable && box.axis === "x"
      && box.minX < -13.5 && box.maxX > -14.5
      && box.minY < EYE && box.maxY > EYE)
      .sort((a, b) => a.minZ - b.minZ);
    check(cleanRow.length > 8, `clean wall is short (${cleanRow.length})`);
    const outlineA = cleanRow[3];
    const outlineB = cleanRow[4];
    check(Math.abs(outlineB.minZ - outlineA.maxZ) < 1e-6, "seam test panels are not neighbors");
    const outlineY = EYE - outlineA.minY;
    outlineA.holes = [{ along: outlineA.maxZ - outlineA.minZ, y: outlineY, r: 0.1 }];
    outlineB.holes = [{ along: 0, y: outlineY, r: 0.1 }];
    rebuildPanel(outlineA);
    const sharedRings = (outlineA.ringMeshes ? outlineA.ringMeshes.length : 0) + (outlineB.ringMeshes ? outlineB.ringMeshes.length : 0);
    check(sharedRings === 1, `one hole across a seam drew ${sharedRings} outlines`);
    const door = cleanRow[7];
    const doorAlong = (door.maxZ - door.minZ) / 2;
    const doorY = (door.maxY - door.minY) / 2;
    const doorZ = (door.minZ + door.maxZ) / 2;
    const fitY = 0.9 - door.minY;
    player.yaw = 0;
    player.crouch = 0;
    door.holes = [{ along: doorAlong, y: fitY, r: 1.15 }];
    touchHoles();
    player.x = door.minX - 0.2;
    player.z = doorZ;
    for (let step = 0; step < 16; step += 1) {
      player.x += 0.08;
      pushActor(player);
    }
    check(player.x > door.maxX, `could not walk through a body-sized hole (${player.x.toFixed(2)})`);
    player.x = door.maxX + 0.2;
    player.z = doorZ;
    pushActor(player);
    check(player.x > door.maxX, "the far side of a body-sized hole pushed you back");
    door.holes = [{ along: doorAlong, y: doorY, r: 0.34 }];
    touchHoles();
    player.x = door.minX - 0.12;
    player.z = doorZ;
    pushActor(player);
    check(player.x < door.minX, "a chest-high shotgun hole let the whole body through");
    door.holes = [{ along: doorAlong, y: fitY, r: 1.15 }];
    touchHoles();
    player.x = door.minX - 0.1;
    player.z = doorZ + 1.2;
    pushActor(player);
    check(player.x < door.minX - 0.2, "the wall beside a hole let you through");
    door.holes = [{ along: doorAlong, y: doorY, r: HOLE_RADIUS.sniper }];
    touchHoles();
    player.x = door.minX - 0.1;
    player.z = doorZ;
    pushActor(player);
    check(player.x < door.minX - 0.2, "a small hole let you walk through");
    door.holes = [];
    touchHoles();
    outlineA.holes = [{ along: (outlineA.maxZ - outlineA.minZ) - 0.02, y: outlineY, r: 0.12 }];
    outlineB.holes = [{ along: 0.08, y: outlineY, r: 0.12 }];
    const seamA = planePoint(outlineA, outlineA.holes[0].along, outlineA.holes[0].y);
    const seamB = planePoint(outlineB, outlineB.holes[0].along, outlineB.holes[0].y);
    const seamArcs = exposedRingArcs(
      { u: seamA.u, v: seamA.v, r: 0.12 },
      [{ u: seamA.u, v: seamA.v, r: 0.12 }, { u: seamB.u, v: seamB.v, r: 0.12 }],
    );
    check(!arcHolds(seamArcs, 0) && arcHolds(seamArcs, Math.PI), "seam outlines still cross each other");
    rebuildPanel(outlineA);
  }

  player.x = player.spawnX;
  player.z = player.spawnZ;
  player.yaw = Math.atan2(-(0 - player.x), -(0 - player.z));
  player.pitch = 0;
  bot.x = 0;
  bot.z = 0;
  bot.alive = true;
  bot.mesh.position.set(bot.x, 0, bot.z);
  facePlayer();
  bot.mesh.updateMatrixWorld(true);
  const visorAt = new THREE.Vector3();
  bot.visor.getWorldPosition(visorAt);
  const towardPlayer = new THREE.Vector3(player.x - bot.x, 0, player.z - bot.z).normalize();
  const visorOffset = visorAt.clone().sub(new THREE.Vector3(bot.x, visorAt.y, bot.z));
  visorOffset.y = 0;
  const facingDot = visorOffset.normalize().dot(towardPlayer);
  check(facingDot > 0.9, `opponent faces away from you (${facingDot.toFixed(2)})`);
  const heldWeapon = bot.weapon;
  const heldYaw = bot.yaw;
  const heldPitch = bot.pitch;
  const heldX = bot.x;
  const heldZ = bot.z;
  bot.x = 0;
  bot.z = 0;
  bot.crouch = 0;
  bot.weapon = 2;
  bot.yaw = 0;
  bot.pitch = 0;
  showBotGun();
  poseOpponent();
  bot.mesh.updateMatrixWorld(true);
  const muzzle = bot.gun.getObjectByName("muzzle");
  const muzzleAt = new THREE.Vector3();
  muzzle.getWorldPosition(muzzleAt);
  check(bot.gun.userData.id === "shotgun", "opponent is not holding the shotgun");
  check(muzzleAt.z < -0.5, `shotgun does not point forward (${muzzleAt.z.toFixed(2)})`);
  bot.yaw = Math.PI / 2;
  poseOpponent();
  bot.mesh.updateMatrixWorld(true);
  muzzle.getWorldPosition(muzzleAt);
  check(muzzleAt.x < -0.5, `gun does not follow a left facing (${muzzleAt.x.toFixed(2)})`);
  bot.yaw = 0;
  bot.pitch = -0.5;
  poseOpponent();
  bot.mesh.updateMatrixWorld(true);
  muzzle.getWorldPosition(muzzleAt);
  check(muzzleAt.y < bot.aim.position.y - 0.05, `gun does not point down (${muzzleAt.y.toFixed(2)})`);
  bot.pitch = 0.4;
  poseOpponent();
  bot.mesh.updateMatrixWorld(true);
  muzzle.getWorldPosition(muzzleAt);
  check(muzzleAt.y > bot.aim.position.y + 0.05, `gun does not point up (${muzzleAt.y.toFixed(2)})`);
  bot.x = heldX;
  bot.z = heldZ;
  bot.weapon = heldWeapon;
  bot.yaw = heldYaw;
  bot.pitch = heldPitch;
  showBotGun();
  poseOpponent();
  bot.mesh.updateMatrixWorld(true);
  const aimFrom = new THREE.Vector3();
  const aimTo = new THREE.Vector3();
  bot.aim.getWorldPosition(aimFrom);
  bot.gun.getObjectByName("muzzle").getWorldPosition(aimTo);
  const aimDir = aimTo.sub(aimFrom).normalize();
  const wantAim = new THREE.Vector3(player.x - bot.x, chestHeight(player) - aimHeight(bot), player.z - bot.z).normalize();
  check(aimDir.dot(wantAim) > 0.85, `gun is not pointed where the opponent faces (${aimDir.dot(wantAim).toFixed(2)})`);
  applyRemote({
    x: bot.x,
    z: bot.z,
    yaw: bot.yaw,
    pitch: -0.35,
    health: bot.health,
    weapon: 4,
    alive: true,
    kills: bot.kills,
    spawnLock: 0,
  });
  showBotGun();
  check(bot.weapon === 4 && bot.gun.userData.id === "pistol" && Math.abs(bot.pitch + 0.35) < 1e-6, "opponent ignored the chosen gun and aim");
  bot.weapon = heldWeapon;
  bot.pitch = heldPitch;
  bot.yaw = heldYaw;
  showBotGun();
  poseOpponent();

  clearKeys();
  freezeBot = true;
  matchOver = false;
  roundWait = 0;
  player.kills = 0;
  bot.kills = 0;
  player.alive = true;
  player.health = 100;
  bot.alive = true;
  bot.health = 100;
  bot.spawnLock = 0;
  bot.x = 4;
  bot.z = 4;
  playing = true;
  const roundPanel = boxes.find((box) => box.breakable);
  roundPanel.hp = 0;
  roundPanel.mesh.visible = false;
  kill(bot, player);
  check(roundWait >= 2.9 && roundWait <= 3, `countdown is ${roundWait}`);
  check(!bot.alive, "opponent still alive after the kill");
  update(1);
  check(!bot.alive && roundWait > 0, "respawned before the countdown ended");
  update(2.1);
  check(bot.alive, "did not respawn after the countdown");
  check(roundPanel.hp === roundPanel.maxHp && roundPanel.mesh.visible, "the map did not reset after the round");
  check(holeSample && holeSample.holes.length === 0 && holeSample.holed === false, "round reset left a bullet hole");
  check(bot.spawnLock > 1.2, `spawn protection after respawn is ${bot.spawnLock}`);
  bot.cooldown = 0;
  bot.reload = 0;
  bot.ammo = freshAmmo();
  roundWait = 0;
  const ended = fireShot(bot);
  check(ended === true && bot.spawnLock === 0, "firing did not end spawn protection");

  const routes = new Set();
  for (let i = 0; i < 24; i += 1) {
    newBotRoute();
    routes.add(`${Math.round(botGoal.x)},${Math.round(botGoal.z)}`);
  }
  check(routes.size >= 3, "bot keeps the same route");

  mode = "bot";
  paused = false;
  setPause(true);
  check(paused === true && document.getElementById("pause").hidden === false, "bot pause menu did not open");
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.alive = true;
  roundWait = 0;
  matchOver = false;
  keys.KeyD = true;
  update(0.2);
  keys.KeyD = false;
  check(Math.abs(player.x) < 0.05, "bot fight kept moving while paused");
  mode = "net";
  setPause(true);
  check(paused === false && document.getElementById("pause").hidden === false, "multiplayer menu paused the match");
  player.x = 0;
  player.z = 0;
  player.vx = 0;
  player.vz = 0;
  player.yaw = 0;
  player.pitch = 0;
  player.alive = true;
  ads = 0;
  roundWait = 0;
  matchOver = false;
  keys.KeyD = true;
  update(0.15);
  keys.KeyD = false;
  check(player.x > 0.18, "multiplayer menu froze movement");
  setPause(false);
  mode = "bot";
  paused = false;
  check(document.getElementById("pause").hidden === true, "pause menu stayed open");

  mode = "net";
  netEvents.length = 0;
  roundWait = 0;
  matchOver = false;
  player.kills = 0;
  bot.kills = 0;
  player.alive = true;
  player.health = 100;
  player.spawnLock = 0;
  player.weapon = 3;
  player.ammo = freshAmmo();
  player.cooldown = 0;
  player.reload = 0;
  player.x = 0;
  player.z = 0;
  player.yaw = 0;
  player.pitch = 0;
  bot.x = 0;
  bot.z = -2;
  bot.alive = true;
  bot.health = 100;
  bot.spawnLock = 0;
  fireShot(player);
  check(bot.health === 100, "online shot applied damage locally");
  check(netEvents.some((event) => event.type === "hurt" && event.amount >= 100), "online shot did not send hurt");
  check(netEvents.some((event) => event.type === "shot" && event.kind === "shot"), "online shot did not send the gunshot");
  player.x = -16;
  player.z = 0;
  player.yaw = 0;
  player.pitch = 0;
  syncCamera();
  applyEvent({ type: "shot", kind: "shot", x: 16, y: EYE, z: 0, gain: 0.55, eid: "shot-walls" });
  check(lastSound && lastSound.kind === "shot" && lastSound.heard === true && lastSound.walls >= 2, "a remote gunshot was silenced");
  player.x = 0;
  player.z = 0;
  syncCamera();
  netEvents.length = 0;
  restoreWalls();
  const netPanel = boxes.find((box) => box.breakable && box.minX > 5.5 && box.maxX < 6.5
    && box.minY < EYE && box.maxY > EYE && box.minZ >= 2 && box.maxZ <= 14);
  player.x = 0;
  player.z = (netPanel.minZ + netPanel.maxZ) / 2;
  player.yaw = -Math.PI / 2;
  player.pitch = 0;
  player.cooldown = 0;
  player.reload = 0;
  player.ammo = freshAmmo();
  bot.alive = false;
  fireShot(player);
  check(netPanel.holes.length > 0 && netPanel.hp === netPanel.maxHp, "online shot did not damage the wall section");
  check(netEvents.some((event) => event.type === "wall" && event.id === netPanel.id && event.holes && event.holes.length > 0), "online shot did not send wall damage");
  netEvents.length = 0;
  player.health = 100;
  player.alive = true;
  player.spawnLock = 0;
  roundWait = 0;
  applyEvent({ type: "hurt", amount: 30, eid: "hurt-once" });
  check(player.health === 70, `hurt event left health at ${player.health}`);
  applyEvent({ type: "hurt", amount: 30, eid: "hurt-once" });
  check(player.health === 70, "hurt event applied twice");
  player.spawnLock = SPAWN_LOCK;
  applyEvent({ type: "hurt", amount: 40, eid: "hurt-locked" });
  check(player.health === 70, "spawn protection ignored a hurt event");
  player.spawnLock = 0;
  const sample = boxes.find((box) => box.breakable);
  sample.hp = 0;
  sample.mesh.visible = false;
  applyEvent({ type: "wall", id: sample.id, hp: sample.maxHp, eid: "wall-fix" });
  check(sample.hp === sample.maxHp && sample.mesh.visible, "wall event did not repair");
  const remote = boxes.find((box) => box.breakable && box.axis === "x" && box.minX > 13.5 && box.maxX < 14.5
    && box.minY < EYE && box.maxY > EYE);
  const remoteAlong = (remote.maxZ - remote.minZ) / 2;
  applyEvent({
    type: "wall",
    id: remote.id,
    hp: remote.maxHp,
    holes: [{ along: remoteAlong, y: EYE - remote.minY, r: HOLE_RADIUS.sniper }],
    eid: "remote-hole",
  });
  const remoteOpen = trace(remote.minX - 2, EYE, (remote.minZ + remote.maxZ) / 2, 1, 0, 0, player);
  const remoteEdge = trace(remote.minX - 2, EYE, remote.minZ + 0.02, 1, 0, 0, player);
  check(remote.holes.length === 1 && (!remoteOpen || remoteOpen.box !== remote), "remote hole did not open");
  check(remoteEdge && remoteEdge.box === remote, "remote hole removed the whole panel");
  player.kills = 0;
  bot.alive = true;
  roundWait = 0;
  matchOver = false;
  applyEvent({ type: "died", eid: "died-once" });
  check(player.kills === 1 && !bot.alive, "died event did not award the kill");
  applyEvent({ type: "died", eid: "died-once" });
  check(player.kills === 1, "died event applied twice");
  mode = "bot";
  roundWait = 0;
  matchOver = false;

  freezeBot = false;
  if (failures.length) return `FAIL\n${failures.join("\n")}`;
  return "PASS";
}

function snapshot() {
  return {
    x: player.x,
    z: player.z,
    yaw: player.yaw,
    pitch: player.pitch,
    health: player.health,
    weapon: player.weapon,
    alive: player.alive,
    kills: player.kills,
    ads,
    spawnLock: player.spawnLock,
    crouch: player.crouch,
    lean: player.lean,
    gait: player.gait,
  };
}

async function api(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
  } catch (error) {
    const failed = new Error("Friend matches run from the computer that is hosting the game. This page can still play the bot.");
    failed.cause = error;
    throw failed;
  }
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }
  if (!response.ok) {
    const failed = new Error(data.error || "Friend matches run from the computer that is hosting the game. This page can still play the bot.");
    failed.status = response.status;
    throw failed;
  }
  return data;
}

let syncing = false;
let lastSync = 0;

async function syncNet() {
  if (mode !== "net" || !playerId || !roomCode) return;
  const events = netEvents.splice(0, netEvents.length);
  try {
    const data = await api("/api/sync", {
      code: roomCode,
      id: playerId,
      state: snapshot(),
      events,
    });
    const wait = document.getElementById("wait");
    if (data.waiting) {
      if (wait && !playing) wait.textContent = "Waiting for your friend on the same Wi-Fi. Windows may ask to allow Python.";
      return;
    }
    if (!playing) startMatch();
    for (const event of data.events || []) applyEvent(event);
    if (data.opponent) applyRemote(data.opponent);
  } catch (error) {
    netEvents.unshift(...events);
    const wait = document.getElementById("wait");
    const joinError = document.getElementById("join-error");
    const message = "Start the game with start.bat so friends can join.";
    if (wait && !playing) wait.textContent = message;
    if (joinError && !playing && !roomCode) joinError.textContent = message;
  }
}

function showPanel(which) {
  document.getElementById("menu-home").hidden = which !== "home";
  document.getElementById("lobby").hidden = which !== "lobby";
  document.getElementById("join-box").hidden = which !== "join";
  const controls = document.getElementById("controls");
  if (controls) controls.hidden = which !== "controls";
  document.getElementById("menu").style.display = "block";
}

function footGain(gait) {
  if (gait === "sprint") return FOOT_GAIN.sprint;
  if (gait === "crouch") return FOOT_GAIN.crouch;
  return FOOT_GAIN.walk;
}

function keyLabel(code) {
  if (!code) return "";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code === "ControlLeft" || code === "ControlRight") return "Ctrl";
  if (code === "AltLeft" || code === "AltRight") return "Alt";
  if (code === "Space") return "Space";
  return code.replace(/Left$|Right$/, "");
}

function refreshLockHint() {
  const lock = document.getElementById("lock");
  if (!lock) return;
  const name = keyLabel;
  lock.textContent = `Click to play. ${name(binds.forward)}${name(binds.left)}${name(binds.back)}${name(binds.right)} move, ${name(binds.sprint)} sprint, ${name(binds.crouch)} crouch, ${name(binds.leanLeft)} and ${name(binds.leanRight)} lean. Mouse aim, right mouse aims. ${name(binds.primary)} primary, ${name(binds.pistol)} pistol. ${name(binds.reload)} reload. Hold ${name(binds.repair)} to repair. Escape opens the menu.`;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ binds: { ...binds }, lookSens }));
  } catch (error) {
    /* storage can be blocked */
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (saved && saved.binds) {
      for (const action of Object.keys(DEFAULT_BINDS)) {
        const code = saved.binds[action];
        if (typeof code === "string" && code && code !== "Escape") binds[action] = code;
      }
    }
    if (typeof saved.lookSens === "number" && saved.lookSens >= 0.4 && saved.lookSens <= 2.2) {
      lookSens = saved.lookSens;
    }
  } catch (error) {
    /* keep the defaults */
  }
}

function renderBinds() {
  const list = document.getElementById("bind-list");
  if (list) {
    list.replaceChildren();
    for (const [action, label] of BIND_ORDER) {
      const row = document.createElement("div");
      row.className = "bind-row";
      const name = document.createElement("span");
      name.textContent = label;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = listeningBind === action ? "Press a key" : keyLabel(binds[action]);
      button.addEventListener("click", () => {
        listeningBind = action;
        renderBinds();
      });
      row.append(name, button);
      list.append(row);
    }
  }
  const read = document.getElementById("sens-read");
  const sens = document.getElementById("sens");
  if (read) read.textContent = `Mouse sensitivity ${lookSens.toFixed(2)}`;
  if (sens && document.activeElement !== sens) sens.value = String(lookSens);
  refreshLockHint();
}

function assignBind(action, code) {
  if (!action || !code || code === "Escape") {
    listeningBind = null;
    renderBinds();
    return;
  }
  for (const other of Object.keys(binds)) {
    if (other !== action && binds[other] === code) binds[other] = binds[action];
  }
  binds[action] = code;
  listeningBind = null;
  saveSettings();
  renderBinds();
}

function makeNoiseBuffer(seconds, freq, click) {
  const rate = audioCtx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = audioCtx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let phase = 0;
  const snap = click || 90;
  for (let i = 0; i < length; i += 1) {
    const t = i / rate;
    const n = Math.random() * 2 - 1;
    const clickEnv = Math.exp(-t * snap);
    const bodyEnv = Math.exp(-t * 14) * (1 - Math.min(1, t / seconds));
    phase += (freq / rate) * Math.PI * 2;
    const sample = n * clickEnv * 0.9 + (Math.sin(phase) * 0.62 + n * 0.28) * bodyEnv;
    data[i] = Math.max(-1, Math.min(1, sample));
  }
  return buffer;
}

function ensureAudio() {
  if (audioMuted) return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
    stepBuffers = {
      sprint: makeNoiseBuffer(0.055, 240, 170),
      walk: makeNoiseBuffer(0.05, 160, 130),
      crouch: makeNoiseBuffer(0.045, 95, 75),
    };
    shotBuffer = makeNoiseBuffer(0.09, 210, 100);
    boomBuffer = makeNoiseBuffer(0.18, 48, 40);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function updateListener() {
  if (!audioCtx) return;
  const listener = audioCtx.listener;
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  if (listener.positionX) {
    listener.positionX.value = camera.position.x;
    listener.positionY.value = camera.position.y;
    listener.positionZ.value = camera.position.z;
    listener.forwardX.value = forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = up.x;
    listener.upY.value = up.y;
    listener.upZ.value = up.z;
  } else {
    listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
    listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }
}

function wallsBetween(x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dy, dz);
  if (length < 0.05) return 0;
  const inv = 1 / length;
  const dirX = dx * inv;
  const dirY = dy * inv;
  const dirZ = dz * inv;
  const seen = new Set();
  let ox = x0;
  let oy = y0;
  let oz = z0;
  let traveled = 0;
  for (let guard = 0; guard < 8 && traveled < length - 0.05; guard += 1) {
    let best = null;
    let bestT = length - traveled;
    for (const box of boxes) {
      if (!box.axis || box.hp <= 0 || box.maxY <= 0.05 || box.minY >= HEIGHT - 0.05) continue;
      const key = `${box.axis}:${wallPlane(box).toFixed(2)}`;
      if (seen.has(key)) continue;
      const distance = rayBox(ox, oy, oz, dirX, dirY, dirZ, box, bestT);
      if (distance === null || distance <= 0.02 || distance >= bestT) continue;
      const hx = ox + dirX * distance;
      const hy = oy + dirY * distance;
      const hz = oz + dirZ * distance;
      if (holeCovers(box, hx, hy, hz)) continue;
      bestT = distance;
      best = box;
    }
    if (!best) break;
    seen.add(`${best.axis}:${wallPlane(best).toFixed(2)}`);
    const step = bestT + 0.2;
    ox += dirX * step;
    oy += dirY * step;
    oz += dirZ * step;
    traveled += step;
  }
  return seen.size;
}

function playSpatial(kind, x, y, z, gainValue, local) {
  const shot = kind === "shot" || kind === "boom";
  const isLocal = Boolean(local);
  const walls = isLocal ? 0 : wallsBetween(camera.position.x, camera.position.y, camera.position.z, x, y, z);
  const heard = isLocal || shot || walls < 2;
  lastSound = { kind, x, y, z, gain: gainValue, local: isLocal, walls, heard };
  if (!heard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  updateListener();
  const buffer = kind === "boom" ? boomBuffer : kind === "shot" ? shotBuffer : (stepBuffers && stepBuffers[kind]) || (stepBuffers && stepBuffers.walk);
  if (!buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  if (!shot) source.playbackRate.value = 0.92 + Math.random() * 0.16;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(gain);
  if (isLocal) gain.connect(ctx.destination);
  else {
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = shot ? 3.2 : 1.1;
    panner.maxDistance = shot ? 80 : 28;
    panner.rolloffFactor = shot ? 0.55 : 1.55;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else panner.setPosition(x, y, z);
    let tail = gain;
    if (walls > 0) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.7;
      if (shot) {
        filter.frequency.value = Math.max(900, 2200 - walls * 350);
        gain.gain.value = gainValue * 0.82;
      } else {
        filter.frequency.value = 650;
        gain.gain.value = gainValue * 0.42;
      }
      gain.connect(filter);
      tail = filter;
    } else if (!shot) {
      const shelf = ctx.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 2400;
      shelf.gain.value = 7;
      gain.connect(shelf);
      tail = shelf;
    }
    tail.connect(panner);
    panner.connect(ctx.destination);
  }
  source.start();
}

function updateSteps(actor, dt, local) {
  const moved = Math.hypot(actor.x - actor.stepX, actor.z - actor.stepZ);
  actor.stepX = actor.x;
  actor.stepZ = actor.z;
  if (!(moved > 0.004 && moved < 1.25)) return;
  actor.stepCarry += moved;
  const stride = actor.gait === "sprint" ? 1.45 : actor.gait === "crouch" ? 0.7 : 1.05;
  if (actor.stepCarry < stride) return;
  actor.stepCarry -= stride;
  const gait = actor.gait === "sprint" || actor.gait === "crouch" ? actor.gait : "walk";
  playSpatial(gait, actor.x, local ? eyeHeight(actor) * 0.45 : 1.05, actor.z, footGain(gait) * (local ? 0.32 : 1), local);
}

function setPause(open) {
  pauseOpen = open;
  paused = open && mode !== "net";
  const overlay = document.getElementById("pause");
  if (overlay) overlay.hidden = !open;
  const title = document.getElementById("pause-title");
  if (title) title.textContent = mode === "net" ? "Menu" : "Paused";
  const note = document.getElementById("pause-note");
  if (note) note.textContent = mode === "net" ? "The match keeps going." : "The bot is waiting.";
  if (open) {
    adsHeld = false;
    mouseDown = false;
    if (document.exitPointerLock) document.exitPointerLock();
  }
  const lock = document.getElementById("lock");
  if (lock && (open || !playing)) lock.style.display = "none";
}

function resumeMatch() {
  setPause(false);
  if (playing && document.body.requestPointerLock) document.body.requestPointerLock();
}

function leaveToMenu() {
  setPause(false);
  playing = false;
  paused = false;
  pauseOpen = false;
  mode = "bot";
  playerId = "";
  roomCode = "";
  netEvents.length = 0;
  adsHeld = false;
  mouseDown = false;
  setSeat(0);
  resetMatch();
  showPanel("home");
}

function startMatch() {
  playing = true;
  paused = false;
  pauseOpen = false;
  document.getElementById("menu").style.display = "none";
  const pause = document.getElementById("pause");
  if (pause) pause.hidden = true;
  const lock = document.getElementById("lock");
  if (lock) lock.style.display = "block";
  resetMatch();
  newBotRoute();
}

function leaveLobby() {
  mode = "bot";
  playerId = "";
  roomCode = "";
  netEvents.length = 0;
  showPanel("home");
}

function bindMenu() {
  const params = new URLSearchParams(location.search);
  const preset = (params.get("room") || "").toUpperCase();
  if (preset) {
    showPanel("join");
    document.getElementById("code-input").value = preset;
  }
  document.querySelectorAll("#diffs button").forEach((button) => {
    button.addEventListener("click", () => {
      difficulty = button.dataset.diff;
      document.querySelectorAll("#diffs button").forEach((item) => {
        item.classList.toggle("on", item === button);
      });
    });
  });
  document.querySelectorAll("[data-gun]").forEach((target) => {
    target.addEventListener("mouseenter", () => showGunTip(target));
    target.addEventListener("mouseleave", hideGunTip);
    target.addEventListener("focus", () => showGunTip(target));
    target.addEventListener("blur", hideGunTip);
  });
  document.querySelectorAll("#guns button").forEach((button) => {
    button.addEventListener("click", () => choosePrimary(button.dataset.gun));
  });
  document.getElementById("play-bot").addEventListener("click", () => {
    ensureAudio();
    mode = "bot";
    playerId = "";
    roomCode = "";
    setSeat(0);
    startMatch();
    document.body.requestPointerLock();
  });
  document.getElementById("resume").addEventListener("click", resumeMatch);
  document.getElementById("leave-menu").addEventListener("click", leaveToMenu);
  document.getElementById("host-room").addEventListener("click", async () => {
    showPanel("lobby");
    document.getElementById("code").textContent = "...";
    document.getElementById("link").textContent = "";
    document.getElementById("wait").textContent = "Waiting for your friend on the same Wi-Fi. Windows may ask to allow Python.";
    try {
      const data = await api("/api/host", {});
      roomCode = data.code;
      playerId = data.id;
      mode = "net";
      setSeat(0);
      document.getElementById("code").textContent = data.code;
      document.getElementById("link").textContent = data.link;
    } catch (error) {
      document.getElementById("wait").textContent = "Start the game with start.bat so friends can join.";
    }
  });
  document.getElementById("show-join").addEventListener("click", () => {
    document.getElementById("join-error").textContent = "";
    showPanel("join");
  });
  document.getElementById("lobby-back").addEventListener("click", leaveLobby);
  document.getElementById("join-back").addEventListener("click", leaveLobby);
  const sens = document.getElementById("sens");
  if (sens) {
    sens.addEventListener("input", () => {
      lookSens = clamp(Number(sens.value), 0.4, 2.2);
      saveSettings();
      renderBinds();
    });
  }
  document.getElementById("show-controls").addEventListener("click", () => {
    listeningBind = null;
    renderBinds();
    showPanel("controls");
  });
  document.getElementById("controls-back").addEventListener("click", () => {
    listeningBind = null;
    renderBinds();
    showPanel("home");
  });
  renderBinds();
  document.getElementById("copy").addEventListener("click", async () => {
    const text = document.getElementById("link").textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      document.getElementById("copy").textContent = "Copied";
    } catch (error) {
      document.getElementById("copy").textContent = "Copy failed";
    }
  });
  document.getElementById("join-btn").addEventListener("click", async () => {
    const code = document.getElementById("code-input").value.trim().toUpperCase();
    const errorEl = document.getElementById("join-error");
    errorEl.textContent = "";
    if (!code) {
      errorEl.textContent = "Enter the room code.";
      return;
    }
    try {
      const data = await api("/api/join", { code });
      roomCode = data.code;
      playerId = data.id;
      mode = "net";
      setSeat(1);
      showPanel("lobby");
      document.getElementById("code").textContent = data.code;
      document.getElementById("link").textContent = "";
      document.getElementById("wait").textContent = "Joined. Starting the 1v1...";
    } catch (error) {
      errorEl.textContent = error.message || "Could not join.";
      showPanel("join");
    }
  });
}

function onKeyDown(event) {
  if (listeningBind) {
    event.preventDefault();
    if (event.code === "Escape") {
      listeningBind = null;
      renderBinds();
      return;
    }
    assignBind(listeningBind, event.code);
    return;
  }
  if (event.code === "Escape") {
    event.preventDefault();
    if (!playing) return;
    if (performance.now() - lockLostAt < 80) return;
    if (pauseOpen) resumeMatch();
    else setPause(true);
    return;
  }
  if (!playing || paused) return;
  keys[event.code] = true;
  if (event.code === binds.reload) startReload(player);
  if (event.code === binds.primary) selectWeapon(1);
  if (event.code === binds.pistol) selectWeapon(2);
  if (event.code === "Digit3") selectWeapon(3);
  if (event.code === "Digit4") selectWeapon(4);
  const used = Object.values(binds);
  if (used.includes(event.code) || event.code === "Digit3" || event.code === "Digit4" || event.code === "Space") {
    event.preventDefault();
  }
}

function onKeyUp(event) {
  keys[event.code] = false;
}

function resize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function boot() {
  audioMuted = new URLSearchParams(location.search).has("test");
  loadSettings();
  refreshLockHint();
  buildLights();
  buildOuterCuboid();
  buildInnerWalls();
  buildBotMesh();
  player.weapon = weaponById(primaryId);
  showGun();
  facePlayer();
  syncCamera();

  const params = new URLSearchParams(location.search);
  const testing = params.has("test");
  const preview = params.has("preview");
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    renderer.render(scene, camera);
  } catch (error) {
    renderer = null;
    if (!testing) {
      document.getElementById("banner").textContent = "Could not start graphics.";
      return;
    }
  }

  if (testing) {
    document.getElementById("menu").style.display = "none";
    const report = runSelfTest();
    document.getElementById("result").textContent = report;
    document.title = report.startsWith("PASS") ? "PASS" : "FAIL";
    if (renderer) renderer.render(scene, camera);
    return;
  }

  if (preview) {
    playing = true;
    document.getElementById("menu").style.display = "none";
    document.getElementById("lock").style.display = "none";
    const kind = params.get("preview");
    player.alive = true;
    player.spawnLock = 0;
    adsHeld = false;
    roundWait = 0;
    matchOver = false;
    if (kind === "walk") {
      player.weapon = 0;
      player.x = 2.4;
      player.z = 0.2;
      player.pitch = -0.15;
      ads = 0;
      bot.x = 0;
      bot.z = 0;
      bot.alive = true;
      bot.yaw = 0;
      player.yaw = Math.atan2(-(bot.x - player.x), -(bot.z - player.z) || 0);
      showGun();
      updateAds(0);
      syncCamera();
      gun.visible = false;
      document.getElementById("cross").style.display = "none";
      bot.mesh.position.set(bot.x, 0, bot.z);
      bot.mesh.rotation.y = bot.yaw;
      bot.vx = 0;
      bot.vz = -5;
      poseBlob(STRIDE * 0.22, 1);
      bot.mesh.visible = true;
      bot.mesh.updateMatrixWorld(true);
    } else if (kind === "holes") {
      player.weapon = 1;
      player.x = 2.3;
      player.z = 3.15;
      player.yaw = -Math.PI / 2;
      player.pitch = 0;
      ads = 0;
      showGun();
      updateAds(0);
      syncCamera();
      camera.position.y = 2.45;
      camera.lookAt(6, 1.4, 3.05);
      gun.visible = false;
      document.getElementById("cross").style.display = "none";
      const row = boxes.filter((box) => box.breakable && box.axis === "x" && box.minX > 5.5 && box.maxX < 6.5
        && box.minY < EYE && box.maxY > EYE && box.minZ >= 2 && box.maxZ <= 14);
      for (const spot of [
        { z: 2.08, r: HOLE_RADIUS.shotgun },
        { z: 3.55, r: HOLE_RADIUS.ar },
        { z: 4.45, r: HOLE_RADIUS.sniper },
        { z: 5.7, r: HOLE_RADIUS.shotgun },
      ]) {
        const wall = row.find((box) => spot.z >= box.minZ && spot.z <= box.maxZ);
        if (!wall) continue;
        if (spot.r >= HOLE_RADIUS.shotgun) punchBlast(wall, (wall.minX + wall.maxX) / 2, EYE, spot.z, spot.r);
        else punchCircle(wall, (wall.minX + wall.maxX) / 2, EYE, spot.z, spot.r);
      }
      presentHoles(boxes.filter((box) => box.holes && box.holes.length));
    } else if (kind === "pellets") {
      player.weapon = 2;
      player.x = 2.2;
      player.z = 4.3;
      player.yaw = -Math.PI / 2;
      player.pitch = 0;
      ads = 0;
      showGun();
      updateAds(0);
      syncCamera();
      camera.position.set(2.4, 2.2, 4.5);
      camera.lookAt(6, 1.45, 4.6);
      gun.visible = false;
      document.getElementById("cross").style.display = "none";
      const row = boxes.filter((box) => box.breakable && box.axis === "x" && box.minX > 5.5 && box.maxX < 6.5
        && box.minY < EYE && box.maxY > EYE && box.minZ >= 2 && box.maxZ <= 14);
      const closeWall = row.find((box) => 3.3 >= box.minZ && 3.3 <= box.maxZ);
      if (closeWall) {
        const cx = (closeWall.minX + closeWall.maxX) / 2;
        const cz = (closeWall.minZ + closeWall.maxZ) / 2;
        for (const offset of [-0.08, -0.03, 0.02, 0.07, 0]) {
          punchBlast(closeWall, cx, EYE + offset * 0.35, cz + offset, shotgunHoleRadius(0.9));
        }
      }
      const farWall = row.find((box) => 5.6 >= box.minZ && 5.6 <= box.maxZ);
      if (farWall) {
        const fx = (farWall.minX + farWall.maxX) / 2;
        const offsets = [[-0.55, 0.12], [-0.28, -0.16], [-0.05, 0.2], [0.16, -0.08], [0.34, 0.14], [0.52, -0.18], [0.08, -0.22], [-0.4, 0.22]];
        for (const [dz, dy] of offsets) {
          const host = row.find((box) => 5.6 + dz >= box.minZ && 5.6 + dz <= box.maxZ) || farWall;
          punchBlast(host, fx, EYE + dy, 5.6 + dz, shotgunHoleRadius(12));
        }
      }
      presentHoles(boxes.filter((box) => box.holes && box.holes.length));
    } else if (kind === "rings") {
      player.weapon = 1;
      player.x = 2.4;
      player.z = 4.4;
      player.yaw = -Math.PI / 2;
      player.pitch = 0;
      ads = 0;
      showGun();
      updateAds(0);
      syncCamera();
      camera.position.set(3.1, 1.85, 4.55);
      camera.lookAt(6.05, 1.6, 4.7);
      gun.visible = false;
      document.getElementById("cross").style.display = "none";
      const row = boxes.filter((box) => box.breakable && box.axis === "x" && box.minX > 5.5 && box.maxX < 6.5
        && box.minY < EYE && box.maxY > EYE && box.minZ >= 2 && box.maxZ <= 14)
        .sort((a, b) => a.minZ - b.minZ);
      const host = row.find((box) => 4.15 >= box.minZ && 4.15 <= box.maxZ);
      const next = row[row.indexOf(host) + 1];
      if (host && next) {
        const y = EYE - host.minY;
        host.holes = [{ along: host.maxZ - host.minZ - 0.04, y, r: 0.16 }];
        next.holes = [{ along: 0.1, y, r: 0.14 }];
        rebuildPanel(host);
        rebuildPanel(next);
      }
    } else if (kind === "hit") {
      player.weapon = 1;
      player.x = 0;
      player.z = 3.2;
      player.yaw = 0;
      player.pitch = -0.08;
      ads = 0;
      showGun();
      updateAds(0);
      syncCamera();
      showHitMarker(false);
    } else if (kind === "bot") {
      player.weapon = 0;
      player.x = 0;
      player.z = 2.4;
      player.yaw = 0;
      player.pitch = -0.12;
      ads = 0;
      bot.x = 0;
      bot.z = -1.5;
      bot.alive = true;
      bot.weapon = 1;
      facePlayer();
      showGun();
      updateAds(0);
      syncCamera();
      bot.mesh.visible = true;
    } else if (kind === "ads" || kind === "smg" || kind === "shotgun" || kind === "sniper" || kind === "pistol") {
      const gunName = kind === "ads" ? "ar" : kind;
      player.weapon = Math.max(0, WEAPONS.findIndex((weapon) => weapon.id === gunName));
      player.x = 0;
      player.z = 4;
      player.yaw = 0;
      player.pitch = 0;
      ads = 1;
      showGun();
      updateAds(0);
      syncCamera();
    } else {
      player.weapon = 1;
      player.x = 0;
      player.z = 0;
      player.yaw = -0.7;
      player.pitch = -0.06;
      ads = 0;
      showGun();
      updateAds(1);
      syncCamera();
    }
    paintHud();
    poseOpponent();
    if (renderer) renderer.render(scene, camera);
    document.title = "PREVIEW";
    return;
  }

  bindMenu();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => {
    clearKeys();
    adsHeld = false;
    mouseDown = false;
  });
  window.addEventListener("resize", resize);
  window.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("mousedown", (event) => {
    ensureAudio();
    if (!playing || pauseOpen) return;
    if (event.button === 2) {
      adsHeld = true;
      return;
    }
    if (event.button !== 0) return;
    mouseDown = true;
    if (document.pointerLockElement !== document.body) {
      document.body.requestPointerLock();
      return;
    }
    fireShot(player);
  });
  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) mouseDown = false;
    if (event.button === 2) adsHeld = false;
  });
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === document.body;
    if (locked) ensureAudio();
    if (!locked) {
      adsHeld = false;
      lockLostAt = performance.now();
      if (playing && !pauseOpen) setPause(true);
    }
    const lock = document.getElementById("lock");
    if (lock) lock.style.display = locked || pauseOpen || !playing ? "none" : "block";
  });
  document.addEventListener("mousemove", (event) => {
    if (!playing || document.pointerLockElement !== document.body) return;
    const sens = 0.0022 * lookSens * (1 - 0.35 * ads);
    player.yaw -= event.movementX * sens;
    player.pitch = clamp(player.pitch - event.movementY * sens, -1.15, 1.15);
  });

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === "net" && !syncing && now - lastSync > 50) {
      lastSync = now;
      syncing = true;
      syncNet().finally(() => { syncing = false; });
    }
    if (mouseDown && playing && !paused && !pauseOpen && document.pointerLockElement === document.body) fireShot(player);
    update(dt);
    if (renderer) renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  paintHud();
  requestAnimationFrame(frame);
}

boot();
