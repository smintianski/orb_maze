var renderer, scene, camera, platform, maze, ball, finish; // three vars
var clock = new THREE.Clock();
var cameraView = 0; // 0: angled view, 1: overhead view
var cameraTarget = new THREE.Vector3();
var grassTexture;
var environmentMap;
var platformTrees = [
  { x: -6.6, z: -3.3, size: 0.9 },
  { x: 6.6, z: -3.3, size: 0.7 },
  { x: -3.2, z: -6.9, size: 0.7 },
  { x: -6.9, z: 2.2, size: 0.75 },
  { x: 6.8, z: 2.9, size: 0.65 }
];
var walls = [];
var levelIndex = 0;
var start = { x: 0, z: 0 };
var goal = { x: 0, z: 0 };
var ballRadius = 0.28;
var platformRadius = 8.1;
var maxTilt = 12 * Math.PI / 180;
var world, platformBody, ballBody; // cannon vars
var groundMaterial = new CANNON.Material('groundMaterial');
var wallPhysicsMaterial = new CANNON.Material('wallMaterial');
var sphereMaterial = new CANNON.Material('sphereMaterial');
var ballLocal = new THREE.Vector3(); // ball position
var keys = {};
var state = 'playing'; // menu, playing, falling, complete
var accumulator = 0;
var fixedStep = 1 / 120;
var fallTime = 0;
var noticeTime = 0;
var wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
var startMaterial = new THREE.MeshPhongMaterial({
  color: 0xccd5b2, specular: 0xffffff, shininess: 120,
  combine: THREE.MixOperation, reflectivity: 0.45
}); // start point
var finishMaterial = new THREE.MeshPhongMaterial({
  color: 0xd4ff84, specular: 0xffffff, shininess: 120,
  combine: THREE.MixOperation, reflectivity: 0.45
}); // finish point
var finishCenterMaterial = new THREE.MeshPhongMaterial({
  color: 0x64c862, specular: 0xffffff, shininess: 100,
  combine: THREE.MixOperation, reflectivity: 0.3
});

try {
  init();
  loadTextures();
  createWorld();
  loadScene();
  createMenu();
  showMenu();
  render();
} catch (error) {
  document.getElementById('notice').textContent = 'No se pudo iniciar el juego. Comprueba que tu navegador admite WebGL.';
  console.error(error);
}

function init()
{
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('webgl', { antialias: true, alpha: true });
  if (!context) throw new Error('WebGL 1.0 is unavailable');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, context: context, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x87bddd, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true; // shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb8dced, 45, 85);
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120); // camera
  updateAspectRatio();
  window.addEventListener('resize', updateAspectRatio);

  scene.add(new THREE.HemisphereLight(0xe8f5ff, 0x61734e, 0.8));
  var light = new THREE.DirectionalLight(0xfff5dc, 1.1); // light
  light.position.set(-8, 16, 8);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = light.shadow.camera.bottom = -12;
  light.shadow.camera.right = light.shadow.camera.top = 12;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 40;
  light.shadow.bias = -0.001;
  light.shadow.normalBias = 0.025;
  scene.add(light);

  window.addEventListener('keydown', function(event) {
    if (state === 'playing' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
      keys[event.code] = true;
    }
    if (state !== 'menu' && event.code === 'KeyR' && !event.repeat) restartLevel();
    if (event.code === 'KeyC' && !event.repeat) {
      event.preventDefault();
      toggleCamera();
    }
  });
  window.addEventListener('keyup', function(event) { keys[event.code] = false; });
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', function() {
    clearKeys();
    accumulator = 0;
    clock.getDelta();
  });
  document.getElementById('restart').addEventListener('click', restartLevel);
  document.getElementById('camera-toggle').addEventListener('click', toggleCamera);
  document.getElementById('next-level').addEventListener('click', function() {
    levelIndex = (levelIndex + 1) % levels.length;
    loadLevel();
  });

  // On narrow screens, these four buttons replace the keyboard.
  document.querySelectorAll('[data-key]').forEach(function(button) {
    button.addEventListener('pointerdown', function(event) {
      if (state !== 'playing') return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      keys[button.dataset.key] = true;
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function(name) {
      button.addEventListener(name, function() { keys[button.dataset.key] = false; });
    });
  });
}

function clearKeys() { keys = {}; }

function loadTextures()
{
  var loader = new THREE.TextureLoader();
  grassTexture = loader.load('images/textures/grass_soft.webp');
  grassTexture.encoding = THREE.sRGBEncoding;
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(1, 1);
  // Rotate the pattern around the texture center.
  grassTexture.center.set(0.5, 0.5);
  grassTexture.rotation = Math.PI / 2;

  var wallTexture = loader.load('images/textures/wall_plaster_light.webp');
  wallTexture.encoding = THREE.sRGBEncoding;
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallMaterial.map = wallTexture;
  wallMaterial.needsUpdate = true;
}

function createMenu()
{
  document.getElementById('play').addEventListener('click', function() { startLevel(0); });
  document.getElementById('choose-level').addEventListener('click', function() {
    document.getElementById('menu-main').hidden = true;
    document.getElementById('level-picker').hidden = false;
    document.getElementById('level-buttons').children[0].focus();
  });
  document.getElementById('back-menu').addEventListener('click', showMenu);
  document.getElementById('open-menu').addEventListener('click', showMenu);
  document.getElementById('finish-menu').addEventListener('click', showMenu);
  levels.forEach(function(level, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Nivel ' + (index + 1);
    button.addEventListener('click', function() { startLevel(index); });
    document.getElementById('level-buttons').appendChild(button);
    document.getElementById('level-steps').appendChild(document.createElement('i'));
  });
  document.querySelectorAll('.steps i').forEach(function(dot, i) { dot.classList.toggle('active', i <= levelIndex); });
}

function showMenu()
{
  state = 'menu';
  clearKeys();
  accumulator = 0;
  platformBody.angularVelocity.set(0, 0, 0);
  document.getElementById('message').hidden = true;
  document.getElementById('notice').textContent = '';
  noticeTime = 0;
  document.getElementById('menu-main').hidden = false;
  document.getElementById('level-picker').hidden = true;
  document.getElementById('menu').hidden = false;
  setGameVisible(false);
  document.getElementById('play').focus();
}

function startLevel(index)
{
  levelIndex = index;
  loadLevel();
  document.getElementById('menu').hidden = true;
  setGameVisible(true);
}

function setGameVisible(visible)
{
  document.getElementById('game-header').hidden = !visible;
  document.getElementById('game-footer').hidden = !visible;
  document.getElementById('touch-controls').hidden = !visible;
}

function createWorld()
{
  world = new CANNON.World();
  world.gravity.set(0, -9.8, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 15;
  world.solver.tolerance = 0.000001;
  world.allowSleep = false;
  
  world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, sphereMaterial, {
    friction: 0.08,
    restitution: 0.02,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 4
  }));

  world.addContactMaterial(new CANNON.ContactMaterial(wallPhysicsMaterial, sphereMaterial, {
    friction: 0,
    restitution: 0.65,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 4
  }));
}

function createPlatformBody()
{
  if (platformBody) world.removeBody(platformBody);
  platformBody = new CANNON.Body({ mass: 0, material: groundMaterial, type: CANNON.Body.KINEMATIC });
  // Cannon 0.6.2 cylinders use the Z axis; Three.js cylinders use Y, so rotate the shape.
  var orientation = new CANNON.Quaternion();
  orientation.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  var groundShape = new CANNON.Cylinder(platformRadius, platformRadius, 0.12, 48);
  groundShape.material = groundMaterial;
  platformBody.addShape(groundShape, new CANNON.Vec3(0, -0.06, 0), orientation);
  for (var i = 0; i < walls.length; i++) {
    var wall = walls[i];
    var shape = new CANNON.Box(new CANNON.Vec3(wall.width / 2, 0.325, wall.depth / 2));
    shape.material = wallPhysicsMaterial;
    platformBody.addShape(shape, new CANNON.Vec3(wall.x, 0.325, wall.z));
  }
  world.addBody(platformBody);
  platform.body = platformBody;
}

function loadScene()
{
  // Share one reflection map between all reflective materials.
  environmentMap = createBallEnvironment();
  [startMaterial, finishMaterial, finishCenterMaterial].forEach(function(material) {
    material.envMap = environmentMap;
  });
  platform = new THREE.Object3D();
  scene.add(platform);
  createPlatform();
  maze = new THREE.Object3D();
  platform.add(maze);
  createBall();
  createBackground();
  loadLevel();
}

// Small helper function: geometry, material, and position.
function addMesh(parent, geometry, material, x, y, z)
{
  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createPlatform()
{
  var rock = new THREE.MeshPhongMaterial({ color: 0x455665, flatShading: true, shininess: 0 });
  var grass = new THREE.MeshLambertMaterial({ color: 0xffffff, map: grassTexture });
  var rim = new THREE.MeshPhongMaterial({
    color: 0xe3e7e9,
    specular: 0xffffff,
    shininess: 120,
    envMap: environmentMap,
    combine: THREE.MixOperation,
    reflectivity: 0.5
  });
  var metal = new THREE.MeshPhongMaterial({
    color: 0xb9c4cc,
    specular: 0xffffff,
    shininess: 120,
    envMap: environmentMap,
    combine: THREE.MixOperation,
    reflectivity: 0.65
  });
  addMesh(platform, new THREE.CylinderGeometry(8.4, 8.0, 0.9, 48), rock, 0, -0.57, 0); // -0.57 + 0.9 / 2 = -0.12
  addMesh(platform, new THREE.CylinderGeometry(7.5, 2.2, 2.9, 9), rock, 0, -2.15, 0); 
  addMesh(platform, new THREE.CylinderGeometry(platformRadius, platformRadius, 0.12, 48), grass, 0, -0.06, 0); 
  var edge = addMesh(platform, new THREE.RingGeometry(8.1, 8.43, 48), rim, 0, 0.008, 0);
  edge.rotation.x = -Math.PI / 2;
  edge.castShadow = false;

  // Side wheels made from a torus and two crossbars, without loading models.
  [-1, 1].forEach(function(side) {
    var wheel = new THREE.Object3D();
    wheel.position.set(side * 8.6, -0.6, 0);
    platform.add(wheel);
    var ring = addMesh(wheel, new THREE.TorusGeometry(1.65, 0.24, 8, 32), metal, 0, 0, 0);
    ring.rotation.y = Math.PI / 2;
    addMesh(wheel, new THREE.BoxGeometry(0.3, 3.15, 0.22), metal, 0, 0, 0);
    addMesh(wheel, new THREE.BoxGeometry(0.3, 0.22, 3.15), metal, 0, 0, 0);
  });
  platformTrees.forEach(function(tree) {
    createTree(platform, tree.x, tree.z, tree.size);
  });
}

function createTree(parent, x, z, size)
{
  var tree = new THREE.Object3D();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(size);
  parent.add(tree);
  var trunk = new THREE.MeshLambertMaterial({ color: 0x80674a });
  var leaves = new THREE.MeshPhongMaterial({ color: 0x52783f, flatShading: true, shininess: 0 });
  addMesh(tree, new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6), trunk, 0, 0.4, 0);
  addMesh(tree, new THREE.ConeGeometry(0.55, 1.15, 5), leaves, 0, 1.0, 0);
  addMesh(tree, new THREE.ConeGeometry(0.4, 1.0, 5), leaves, 0, 1.55, 0);
}

function createBallEnvironment()
{
  var faces = [];
  // Cube faces: right, left, top, bottom, front, back.
  for (var i = 0; i < 6; i++) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    var context = canvas.getContext('2d');
    if (i === 2 || i === 3) {
      context.fillStyle = i === 2 ? '#79b6dc' : '#8da959';
    } else {
      var gradient = context.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, '#79b6dc');
      gradient.addColorStop(0.4, '#b8e1ed');
      gradient.addColorStop(0.55, '#f4f8ed');
      gradient.addColorStop(0.65, '#c7d9a2');
      gradient.addColorStop(1, '#8da959');
      context.fillStyle = gradient;
    }
    context.fillRect(0, 0, 128, 128);
    faces.push(canvas);
  }
  var environment = new THREE.CubeTexture(faces);
  environment.encoding = THREE.sRGBEncoding;
  environment.needsUpdate = true;
  return environment;
}

function createBallTexture()
{
  var canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  var context = canvas.getContext('2d');
  context.fillStyle = '#e1e6eb';
  context.fillRect(0, 0, 256, 128);
  // A thin painted band makes the sphere rotation visible.
  context.fillStyle = '#64717e';
  context.fillRect(0, 61, 256, 6);
  var texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

function createBall()
{
  var texture = createBallTexture();
  var material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    map: texture,
    emissive: 0xdce5ef,
    emissiveMap: texture,
    emissiveIntensity: 0.12,
    envMap: environmentMap,
    combine: THREE.MixOperation,
    reflectivity: 0.25,
    specular: 0xffffff,
    shininess: 120
  });
  ball = addMesh(scene, new THREE.SphereGeometry(ballRadius, 32, 20),
    material, 0, ballRadius, 0);
  ballBody = new CANNON.Body({ mass: 1, material: sphereMaterial });
  var sphereShape = new CANNON.Sphere(ballRadius);
  sphereShape.material = sphereMaterial;
  ballBody.addShape(sphereShape);
  ballBody.linearDamping = 0.35;
  ballBody.angularDamping = 0.4;
  world.addBody(ballBody);
  ball.body = ballBody;
}

function createMaze()
{
  // Dispose of the previous level geometry and keep the shared materials.
  while (maze.children.length) {
    var mesh = maze.children[0];
    maze.remove(mesh);
    mesh.geometry.dispose();
  }
  walls = [];
  var map = levels[levelIndex].map;
  var middle = (map.length - 1) / 2;
  for (var row = 0; row < map.length; row++) {
    for (var col = 0; col < map[row].length; col++) {
      var x = (col - middle) * cellSize;
      var z = (row - middle) * cellSize;
      if (map[row][col] === 'S') start = { x: x, z: z };
      if (map[row][col] === 'F') goal = { x: x, z: z };
      if (map[row][col] !== '#') continue;
      // Merge adjacent blocks into one rectangular wall.
      var firstCol = col;
      while (col + 1 < map[row].length && map[row][col + 1] === '#') col++;
      var width = (col - firstCol + 1) * cellSize;
      x = ((firstCol + col) / 2 - middle) * cellSize;
      var wallMesh = addMesh(maze, new THREE.BoxGeometry(width, 0.65, cellSize), wallMaterial, x, 0.325, z);
      setWallTextureCoordinates(wallMesh.geometry, x, z);
      walls.push({ x: x, z: z, width: width, depth: cellSize });
    }
  }
  // Collision shapes for decorative tree trunks outside the maze.
  platformTrees.forEach(function(tree) {
    var width = 0.26 * tree.size;
    walls.push({ x: tree.x, z: tree.z, width: width, depth: width });
  });
  var marker = addMesh(maze, new THREE.CircleGeometry(0.42, 24),
    startMaterial, start.x, 0.012, start.z);
  marker.rotation.x = -Math.PI / 2;
  marker.castShadow = false;
  finish = addMesh(maze, new THREE.RingGeometry(0.29, 0.49, 32),
    finishMaterial, goal.x, 0.018, goal.z);
  finish.rotation.x = -Math.PI / 2;
  finish.castShadow = false;
  var center = addMesh(maze, new THREE.CircleGeometry(0.28, 24),
    finishCenterMaterial, goal.x, 0.016, goal.z);
  center.rotation.x = -Math.PI / 2;
  center.castShadow = false;
}

// Use two-unit UV tiles so long walls do not stretch the texture.
function setWallTextureCoordinates(geometry, x, z)
{
  var positions = geometry.attributes.position;
  var normals = geometry.attributes.normal;
  var uv = geometry.attributes.uv;
  for (var i = 0; i < positions.count; i++) {
    var px = positions.getX(i) + x;
    var py = positions.getY(i) + 0.325;
    var pz = positions.getZ(i) + z;
    if (Math.abs(normals.getY(i)) > 0.5) uv.setXY(i, px / 2, pz / 2);
    else if (Math.abs(normals.getX(i)) > 0.5) uv.setXY(i, pz / 2, py / 2);
    else uv.setXY(i, px / 2, py / 2);
  }
  uv.needsUpdate = true;
}

function loadLevel()
{
  createMaze();
  createPlatformBody();
  document.getElementById('level-label').textContent = 'Nivel ' + (levelIndex + 1) + ' / ' + levels.length;
  document.querySelectorAll('.steps i').forEach(function(dot, i) { dot.classList.toggle('active', i <= levelIndex); });
  restartLevel();
}

function restartLevel()
{
  platform.rotation.set(0, 0, 0);
  platformBody.quaternion.set(0, 0, 0, 1);
  platformBody.angularVelocity.set(0, 0, 0);
  platformBody.velocity.set(0, 0, 0);
  platformBody.aabbNeedsUpdate = true;
  ballBody.position.set(start.x, ballRadius + 0.015, start.z);
  ballBody.quaternion.set(0, 0, 0, 1);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.force.set(0, 0, 0);
  ballBody.torque.set(0, 0, 0);
  ballBody.previousPosition.copy(ballBody.position);
  ballBody.interpolatedPosition.copy(ballBody.position);
  ballBody.interpolatedQuaternion.copy(ballBody.quaternion);
  ballBody.aabbNeedsUpdate = true;
  ballBody.wakeUp();
  syncBall();
  state = 'playing';
  fallTime = 0;
  accumulator = 0;
  clearKeys();
  document.getElementById('message').hidden = true;
  document.getElementById('notice').textContent = '';
  noticeTime = 0;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function updateAspectRatio()
{
  var aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = aspect;
  setCameraTarget();
  camera.position.copy(cameraTarget);
  camera.lookAt(0, -0.6, 0);
  camera.updateProjectionMatrix();
}

function setCameraTarget()
{
  // Keep the whole island visible in both views, including narrow screens.
  var distance = Math.max(28, 27 / camera.aspect);
  // Keep the island clear of distance fog on portrait screens.
  scene.fog.near = distance + 17;
  scene.fog.far = distance + 57;
  camera.far = Math.max(120, distance + 60);
  var height = cameraView === 0 ? 0.72 : 0.96;
  var depth = cameraView === 0 ? 0.7 : 0.28;
  cameraTarget.set(0, distance * height - 0.6, distance * depth);
}

function toggleCamera()
{
  cameraView = 1 - cameraView;
  setCameraTarget();
  document.getElementById('camera-view-label').textContent = cameraView === 0 ? 'Vista inclinada' : 'Vista superior';
  document.getElementById('camera-toggle').setAttribute('aria-pressed', cameraView === 1 ? 'true' : 'false');
}

function updateCamera(dt)
{
  // Animate independently of physics so the view also changes while paused.
  camera.position.lerp(cameraTarget, 1 - Math.exp(-5 * dt));
  camera.lookAt(0, -0.6, 0);
}

function update(dt)
{
  if (state === 'menu' || state === 'complete') return;
  updatePlatform(dt);
  // Cannon calculates gravity, contacts, friction, velocity, and ball rotation.
  world.step(dt);
  // Correct the small integration error in the controlled body rotation.
  platformBody.quaternion.copy(platform.quaternion);
  platformBody.aabbNeedsUpdate = true;
  syncBall();
  updateBall(dt);
}

function updatePlatform(dt)
{
  var forward = keys.KeyW || keys.ArrowUp;
  var backward = keys.KeyS || keys.ArrowDown;
  var left = keys.KeyA || keys.ArrowLeft;
  var right = keys.KeyD || keys.ArrowRight;
  var targetX = ((backward ? 1 : 0) - (forward ? 1 : 0)) * maxTilt;
  var targetZ = ((left ? 1 : 0) - (right ? 1 : 0)) * maxTilt;
  var oldX = platform.rotation.x;
  var oldZ = platform.rotation.z;
  // Slower than in the first version: the rotating surface physically
  // pushes the ball, so tilting too abruptly could launch it upwards.
  var smooth = 1 - Math.exp(-2.5 * dt);
  platform.rotation.x += (targetX - oldX) * smooth;
  platform.rotation.z += (targetZ - oldZ) * smooth;
  var rateX = (platform.rotation.x - oldX) / dt;
  var rateZ = (platform.rotation.z - oldZ) / dt;
  var middleX = (platform.rotation.x + oldX) / 2;
  // For R = Rx * Rz, the second rotation axis is already rotated around X.
  // Angular velocity tells Cannon how fast the surface moves at contact points.
  platformBody.angularVelocity.set(rateX, -Math.sin(middleX) * rateZ, Math.cos(middleX) * rateZ);
}

function syncBall()
{
  // The ball belongs to scene rather than platform, so the tilt is not applied twice.
  ball.position.copy(ballBody.position);
  ball.quaternion.copy(ballBody.quaternion);
  ballLocal.copy(ball.position).applyQuaternion(platform.quaternion.clone().invert());
}

function updateBall(dt)
{
  // This function only checks game rules. Cannon has already calculated the motion.
  if (state === 'falling') {
    fallTime += dt;
    if (fallTime > 1.1) {
      restartLevel();
      document.getElementById('notice').textContent = 'La esfera ha caído. ¡Inténtalo de nuevo!';
      noticeTime = 2.5;
    }
    return;
  }
  // The finite cylinder lets the ball roll off the edge naturally, without
  // disabling collisions or moving the ball down manually.
  if (ballLocal.y < -1 || Math.hypot(ballLocal.x, ballLocal.z) > platformRadius + 1) {
    state = 'falling';
    fallTime = 0;
    clearKeys();
    return;
  }
  var distance = Math.hypot(ballLocal.x - goal.x, ballLocal.z - goal.z);
  if (distance < 0.38 && Math.abs(ballLocal.y - ballRadius) < 0.15) completeLevel();
}

function completeLevel()
{
  state = 'complete';
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  platformBody.angularVelocity.set(0, 0, 0);
  clearKeys();
  var last = levelIndex === levels.length - 1;
  document.getElementById('message-title').textContent = last ? '¡Has completado todos los niveles!' : '¡Nivel completado!';
  document.getElementById('message-text').textContent = last ? 'Has llegado al final de la aventura. Puedes volver a jugar o elegir otro nivel.' : 'La esfera ha llegado a la meta. Te espera un nuevo laberinto.';
  document.getElementById('next-level').textContent = last ? 'Volver a jugar ↻' : 'Siguiente nivel →';
  document.getElementById('message').hidden = false;
  document.getElementById('next-level').focus();
}

function createBackground()
{
  var cloudMaterial = new THREE.MeshPhongMaterial({ color: 0xf2f8fa, flatShading: true, shininess: 0 });
  [[-18, -5, -12], [17, -6, -20], [-12, -6, 10], [16, -8, 7]].forEach(function(position) {
    var cloud = new THREE.Object3D();
    cloud.position.set(position[0], position[1], position[2]);
    scene.add(cloud);
    for (var i = 0; i < 4; i++) {
      var puff = addMesh(cloud, new THREE.SphereGeometry(1.8, 7, 5), cloudMaterial,
        (i - 1.5) * 1.9, i % 2 * 0.45, 0);
      puff.scale.set(1.2, 0.65, 0.8);
      puff.castShadow = false;
    }
  });
  var stone = new THREE.MeshPhongMaterial({ color: 0x6f8691, flatShading: true, shininess: 0 });
  var green = new THREE.MeshLambertMaterial({ color: 0x86a96c });
  [[-16, -1, -20, 1.5], [15, -3, -14, 2.1], [-17, -7, 1, 1.1]].forEach(function(position) {
    var island = new THREE.Object3D();
    island.position.set(position[0], position[1], position[2]);
    scene.add(island);
    var radius = position[3];
    addMesh(island, new THREE.CylinderGeometry(radius, 0.3, radius * 1.5, 6), stone, 0, -radius * 0.75, 0);
    addMesh(island, new THREE.CylinderGeometry(radius, radius, 0.1, 6), green, 0, 0, 0);
    createTree(island, 0, 0, radius * 0.6);
  });
}

function render()
{
  requestAnimationFrame(render);
  // Cannon solves contacts in small fixed steps of 1/120 second.
  // The accumulator keeps the step count consistent across different frame rates.
  var dt = Math.min(clock.getDelta(), 0.1);
  updateCamera(dt);
  accumulator += dt;
  while (accumulator >= fixedStep) {
    accumulator -= fixedStep;
    update(fixedStep);
  }
  if (noticeTime > 0) {
    noticeTime -= dt;
    if (noticeTime <= 0) document.getElementById('notice').textContent = '';
  }
  var rx = platform.rotation.x;
  var rz = platform.rotation.z;
  document.getElementById('tilt-value').textContent = Math.round(rx * 180 / Math.PI) + '° / ' + Math.round(rz * 180 / Math.PI) + '°';
  document.getElementById('tilt-dot').style.transform = 'translate(' + (-rz / maxTilt * 15) + 'px,' + (rx / maxTilt * 15) + 'px)';
  renderer.render(scene, camera);
}
