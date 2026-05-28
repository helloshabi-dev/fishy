// main.js — Canvas setup, global state, input handling, init, and animation loop
import { randomRange } from './utils.js';
import { Ripple } from './ripple.js';
import { Fish } from './fish.js';
import { resolveCollisions, checkFeeding } from './physics.js';

// ============================================================
// CANVAS SETUP
// ============================================================

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

// Apply styles programmatically to guarantee full-screen layout without scrollbars
canvas.style.display = "block";
canvas.style.position = "absolute";
canvas.style.top = "0";
canvas.style.left = "0";
document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.overflow = "hidden";
document.body.style.backgroundColor = "#ffffff"; // Minimalist white background

// Set canvas to full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Handle window resizing smoothly
window.addEventListener("resize", function () {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  init();
});

// ============================================================
// ACTIVE SYSTEMS
// ============================================================

let fishes = [];
let foods = [];
let ripples = [];

const fishCount = 6;
const fishRadius = 24; // Base size for fishes

// ============================================================
// MOUSE TRACKING
// ============================================================

const mouse = {
  x: undefined,
  y: undefined
};

let mouseLastX = undefined;
let mouseLastY = undefined;
let mouseIdleFrames = 0;

window.addEventListener("mousemove", function (event) {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

// Clear mouse when cursor leaves the window
window.addEventListener("mouseout", function () {
  mouse.x = undefined;
  mouse.y = undefined;
});

// ============================================================
// CLICK — drops food and triggers a water ripple
// ============================================================

window.addEventListener("click", function (event) {
  // Spawn ripple
  ripples.push(new Ripple(event.clientX, event.clientY));

  // Spawn food pellet that floats gently in place
  foods.push({
    x: event.clientX,
    y: event.clientY,
    radius: 4.5,
    color: "#8b4513", // Solid flat SaddleBrown color pellet (Abowman style)
    floatTimer: randomRange(0, 100)
  });
});

// ============================================================
// INIT — spawns fishes with no initial overlapping
// ============================================================

function init() {
  fishes = [];
  foods = [];
  ripples = [];

  const maxAttempts = 150;

  for (let i = 0; i < fishCount; i++) {
    let x, y;
    let overlapping = true;
    let attempts = 0;

    let vx = randomRange(-0.8, 0.8);
    let vy = randomRange(-0.8, 0.8);
    if (Math.abs(vx) < 0.15) vx = vx < 0 ? -0.4 : 0.4;
    if (Math.abs(vy) < 0.15) vy = vy < 0 ? -0.4 : 0.4;

    while (overlapping && attempts < maxAttempts) {
      overlapping = false;
      x = randomRange(fishRadius, canvas.width - fishRadius);
      y = randomRange(fishRadius, canvas.height - fishRadius);

      for (let j = 0; j < fishes.length; j++) {
        const other = fishes[j];
        const dist = Math.hypot(x - other.x, y - other.y);
        if (dist < fishRadius + other.radius + 15) {
          overlapping = true;
          break;
        }
      }
      attempts++;
    }

    fishes.push(new Fish(x, y, vx, vy, fishRadius));
  }
}

// ============================================================
// ANIMATE — main loop
// ============================================================

function animate() {
  requestAnimationFrame(animate);

  // Update mouse stationary idle frames
  if (mouse.x === mouseLastX && mouse.y === mouseLastY) {
    if (mouse.x !== undefined) mouseIdleFrames++;
  } else {
    mouseIdleFrames = 0;
    mouseLastX = mouse.x;
    mouseLastY = mouse.y;
  }

  // 1. Draw solid minimalist white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Update and draw water ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].update();
    ripples[i].draw(ctx);
    if (ripples[i].alpha <= 0) ripples.splice(i, 1);
  }

  // 3. Update and draw floating food pellets
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];

    // Slow circular float drift
    food.floatTimer += 0.035;
    const drawX = food.x + Math.sin(food.floatTimer) * 2.5;
    const drawY = food.y + Math.cos(food.floatTimer) * 2.5;

    // Draw solid flat pellet (no glow, no fading, no shrinking)
    ctx.save();
    ctx.beginPath();
    ctx.arc(drawX, drawY, food.radius, 0, Math.PI * 2);
    ctx.fillStyle = food.color;
    ctx.fill();
    ctx.restore();
  }

  // 4. Resolve physics & feeding
  resolveCollisions(fishes);
  checkFeeding(fishes, foods);

  // 5. Update & draw fishes
  for (let i = 0; i < fishes.length; i++) {
    fishes[i].update(canvas, foods, mouse, mouseIdleFrames);
    fishes[i].draw(ctx);
  }
}

// ============================================================
// BOOTSTRAP
// ============================================================

init();
animate();
