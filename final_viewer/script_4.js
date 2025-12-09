import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

// === GLOBALS ===
let scene, camera, renderer, pointCloud;
let cameras = [];
let viewGraph = {};
let currentCamIndex = 0;
let nextCamIndex = null;
let isTransitioning = false;

// HTML elements for cross-fade
const imgA = document.getElementById("imageA");
const imgB = document.getElementById("imageB");

// === INITIALIZE ===
init();
animate();

async function init() {
  // Scene setup
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("three-container").appendChild(renderer.domElement);

  // Perspective camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 0, 0);

  // Load point cloud
  const plyLoader = new PLYLoader();
  plyLoader.load("merged_room_3.ply", (geometry) => {
    geometry.computeVertexNormals();
    const material = new THREE.PointsMaterial({ size: 0.02, vertexColors: true });
    pointCloud = new THREE.Points(geometry, material);
    scene.add(pointCloud);
  });

  // Load camera poses
  const response = await fetch("all_cameras_3.json");
  const data = await response.json();
  cameras = data.cameras.map((c) => ({
    id: c.id,
    image: "images/" + c.image,
    rotation: new THREE.Matrix3().fromArray(c.rotation.flat()),
    translation: new THREE.Vector3(...c.translation),
  }));

  // Build the View Graph
  viewGraph = buildViewGraph();
  console.log("View Graph:", viewGraph);

  // Display first image and pose
  imgA.src = cameras[0].image;
  updateCameraPose(0);

  // Click listener to move along graph
  document.body.addEventListener("click", (event) => {
  if (!isTransitioning) navigateToConnectedCamera(event.clientX, event.clientY);
   });

  window.addEventListener("resize", onWindowResize);
}

// === HANDLE WINDOW RESIZE ===
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// === BUILD VIEW GRAPH ===
function buildViewGraph() {
  const graph = {};
  const k = 3; // number of neighbours
  const distanceWeight = 0.7; // how much spatial distance matters
  const angleWeight = 0.3;    // how much orientation similarity matters

  // Helper: compute angle between two rotation matrices
  function rotationAngle(matA, matB) {
    // Compute forward vectors for each camera (local -Z axis)
    const forwardA = new THREE.Vector3(0, 0, -1).applyMatrix3(matA).normalize();
    const forwardB = new THREE.Vector3(0, 0, -1).applyMatrix3(matB).normalize();

    // Angle between the two forward vectors (in radians)
    const angle = forwardA.angleTo(forwardB);
    return THREE.MathUtils.radToDeg(angle); // convert to degrees
  }

  cameras.forEach((camA, i) => {
    // Compute combined "proximity + orientation" score to all others
    const distances = cameras.map((camB, j) => {
      if (i === j) return { index: j, score: Infinity };

      // 1️⃣ Spatial distance
      const dist = camA.translation.distanceTo(camB.translation);

      // 2️⃣ Angular difference (in degrees)
      const angleDeg = rotationAngle(camA.rotation, camB.rotation);

      // 3️⃣ Combined score (lower = better)
      const score = distanceWeight * dist + angleWeight * (angleDeg / 45);

      return { index: j, score };
    });

    // Sort and take k best neighbours
    const neighbors = distances
      .filter((d) => d.index !== i)
      .sort((a, b) => a.score - b.score)
      .slice(0, k)
      .map((d) => d.index);

    graph[i] = neighbors;
  });

  // Make graph bidirectional
  Object.keys(graph).forEach((i) => {
    graph[i].forEach((j) => {
      if (!graph[j].includes(parseInt(i))) {
        graph[j].push(parseInt(i));
      }
    });
  });

  return graph;
}


// === NAVIGATE TO CONNECTED CAMERA ===
let visited = new Set();

function navigateToConnectedCamera(clickX, clickY) {
  const neighbors = viewGraph[currentCamIndex];
  if (!neighbors || neighbors.length === 0) return;

  visited.add(currentCamIndex);

  // Convert screen click to a 3D direction
  const mouse = new THREE.Vector2(
    (clickX / window.innerWidth) * 2 - 1,
    -(clickY / window.innerHeight) * 2 + 1
  );
  const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);
  const clickDir = vector.sub(camera.position).normalize();

  // Evaluate each neighbour
  const currentPos = cameras[currentCamIndex].translation;
  const candidates = neighbors.map((idx) => {
    const pos = cameras[idx].translation;
    const offset = pos.clone().sub(currentPos);
    const dir = offset.clone().normalize();

    const angle = clickDir.angleTo(dir); // radians
    const dist = offset.length();

    // Small angle & short distance → lower score
    const score = angle * 0.8 + dist * 0.2;

    return { idx, angle, dist, score };
  });

  // Sort by best alignment
  candidates.sort((a, b) => a.score - b.score);
  const targetIdx = candidates[0].idx;

  // Transition to best neighbor
  nextCamIndex = targetIdx;
  console.log(
    `🧭 Click → from ${currentCamIndex} (${cameras[currentCamIndex].image}) to ${targetIdx} (${cameras[targetIdx].image})`
  );

  startTransition();
}


// === UPDATE CAMERA TO A SPECIFIC POSE ===
function updateCameraPose(index) {
  const cam = cameras[index];
  const rotationMatrix = cam.rotation;
  const position = cam.translation;

  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().setFromMatrix3(rotationMatrix)
  );

  camera.position.copy(position);
  camera.quaternion.copy(quaternion);
}

// === START CAMERA TRANSITION ===
function startTransition() {
console.log(
  `%c🖱️ Click → Transition`,
  "color: #00ff99; font-weight: bold;"
);
console.log(`Current Cam: ${currentCamIndex} | Image: ${cameras[currentCamIndex].image}`);
console.log(`Next Cam: ${nextCamIndex} | Image: ${cameras[nextCamIndex].image}`);

const pos = cameras[nextCamIndex].translation;
console.log(
  `Next Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`
);
  isTransitioning = true;

  const start = cameras[currentCamIndex];
  const end = cameras[nextCamIndex];

  const startRot = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().setFromMatrix3(start.rotation)
  );
  const endRot = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().setFromMatrix3(end.rotation)
  );

  const startPos = start.translation.clone();
  const endPos = end.translation.clone();

  // Cross-fade images
  imgB.src = end.image;
  imgB.style.opacity = 1;
  imgA.style.opacity = 0;

  const duration = 2000; // 2 seconds transition
  const startTime = performance.now();

  function animateTransition(now) {
    const t = Math.min((now - startTime) / duration, 1);
    camera.position.lerpVectors(startPos, endPos, t);
    camera.quaternion.copy(startRot.clone().slerp(endRot, t));

    if (t < 1) {
      requestAnimationFrame(animateTransition);
    } else {
      // Swap active images
      imgA.src = end.image;
      imgA.style.opacity = 1;
      imgB.style.opacity = 0;
      currentCamIndex = nextCamIndex;
      isTransitioning = false;
    }
  }

  requestAnimationFrame(animateTransition);
}

// === MAIN LOOP ===
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
