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
  document.body.addEventListener("click", () => { if (!isTransitioning) navigateToConnectedCamera(); });

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
  const k = 3; // connect to 3 nearest neighbors

  cameras.forEach((camA, i) => {
    // Compute distances to all others
    const distances = cameras.map((camB, j) => ({
      index: j,
      dist: camA.translation.distanceTo(camB.translation),
    }));

    // Sort and take k nearest (excluding self)
    const neighbors = distances
      .filter((d) => d.index !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, k)
      .map((d) => d.index);

    graph[i] = neighbors;
  });

  return graph;
}

// === NAVIGATE TO CONNECTED CAMERA ===
let visited = new Set();

function navigateToConnectedCamera() {
  const neighbors = viewGraph[currentCamIndex];
  if (!neighbors || neighbors.length === 0) return;

  visited.add(currentCamIndex);

  // Prefer neighbors that haven’t been visited
  const unvisitedNeighbors = neighbors.filter((n) => !visited.has(n));

  let targetIdx;
  if (unvisitedNeighbors.length > 0) {
    // Pick a random unvisited neighbor
    targetIdx = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
  } else {
    // If all visited, pick a random neighbor (reset exploration)
    visited.clear();
    targetIdx = neighbors[Math.floor(Math.random() * neighbors.length)];
  }

  nextCamIndex = targetIdx;
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
