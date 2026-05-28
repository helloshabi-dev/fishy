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

// ============================================================
// SETTINGS STATE & LOCALSTORAGE PERSISTENCE
// ============================================================

const settings = {
  fishSize: parseInt(localStorage.getItem("fishy_fishSize") || "12"), // default is 12px
  fishCount: parseInt(localStorage.getItem("fishy_fishCount") || "2"), // default is 2 fishes
  fishColor: localStorage.getItem("fishy_fishColor") || "#f0654e",
  bgOpacity: parseInt(localStorage.getItem("fishy_bgOpacity") || "50"), // default background opacity is 50%
  bgColor: localStorage.getItem("fishy_bgColor") || "#07111e",
  autoStart: localStorage.getItem("fishy_autoStart") !== "false" // default is true (autostart enabled)
};

// Utility to convert hex colors to RGBA with dynamic opacity
function hexToRgba(hex, alpha) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(0, 0, 0, ${alpha})`;
}

// Initialize settings panel controls to match the persisted settings
function syncSettingsUI() {
  const sizeSlider = document.getElementById("fish-size-slider");
  const sizeVal = document.getElementById("fish-size-value");
  const countSlider = document.getElementById("fish-count-slider");
  const countVal = document.getElementById("fish-count-value");
  const opacitySlider = document.getElementById("bg-opacity-slider");
  const opacityVal = document.getElementById("bg-opacity-value");
  const fishColorPicker = document.getElementById("fish-color-picker");
  const bgColorPicker = document.getElementById("bg-color-picker");

  if (sizeSlider) {
    sizeSlider.value = settings.fishSize;
    if (sizeVal) sizeVal.textContent = settings.fishSize + "px";
  }

  if (countSlider) {
    countSlider.value = settings.fishCount;
    if (countVal) countVal.textContent = settings.fishCount;
  }
  
  if (opacitySlider) {
    opacitySlider.value = settings.bgOpacity;
    if (opacityVal) opacityVal.textContent = settings.bgOpacity + "%";
  }

  if (fishColorPicker) {
    fishColorPicker.value = settings.fishColor;
  }

  if (bgColorPicker) {
    bgColorPicker.value = settings.bgColor;
  }

  const autostartToggle = document.getElementById("system-autostart-toggle");
  if (autostartToggle) {
    autostartToggle.checked = settings.autoStart;
  }

  // Sync active states on preset buttons
  document.querySelectorAll("#fish-color-presets .color-preset").forEach(btn => {
    if (btn.getAttribute("data-color").toLowerCase() === settings.fishColor.toLowerCase()) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  document.querySelectorAll("#bg-color-presets .color-preset").forEach(btn => {
    if (btn.getAttribute("data-color").toLowerCase() === settings.bgColor.toLowerCase()) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function applyBackgroundSettings() {
  const alpha = Math.max(0.01, settings.bgOpacity / 100); // Minimum 1% opacity prevents macOS compositor hiding transparent content
  document.body.style.backgroundColor = hexToRgba(settings.bgColor, alpha);
}

// Dynamically scale or reduce the active fish count
function adjustFishCount(targetCount) {
  if (fishes.length < targetCount) {
    const countToSpawn = targetCount - fishes.length;
    const maxAttempts = 150;
    
    for (let i = 0; i < countToSpawn; i++) {
      let x, y;
      let overlapping = true;
      let attempts = 0;

      let vx = randomRange(-0.8, 0.8);
      let vy = randomRange(-0.8, 0.8);
      if (Math.abs(vx) < 0.15) vx = vx < 0 ? -0.4 : 0.4;
      if (Math.abs(vy) < 0.15) vy = vy < 0 ? -0.4 : 0.4;

      while (overlapping && attempts < maxAttempts) {
        overlapping = false;
        x = randomRange(settings.fishSize, canvas.width - settings.fishSize);
        y = randomRange(settings.fishSize, canvas.height - settings.fishSize);

        for (let j = 0; j < fishes.length; j++) {
          const other = fishes[j];
          const dist = Math.hypot(x - other.x, y - other.y);
          if (dist < settings.fishSize + other.radius + 15) {
            overlapping = true;
            break;
          }
        }
        attempts++;
      }

      fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor));
    }
  } else if (fishes.length > targetCount) {
    fishes.splice(targetCount);
  }
}

// Setup Settings UI Listeners
function initSettingsUI() {
  const panel = document.getElementById("settings-panel");
  const toggleBtn = document.getElementById("settings-toggle-btn");
  const sizeSlider = document.getElementById("fish-size-slider");
  const sizeVal = document.getElementById("fish-size-value");
  const countSlider = document.getElementById("fish-count-slider");
  const countVal = document.getElementById("fish-count-value");
  const opacitySlider = document.getElementById("bg-opacity-slider");
  const opacityVal = document.getElementById("bg-opacity-value");
  const fishColorPicker = document.getElementById("fish-color-picker");
  const bgColorPicker = document.getElementById("bg-color-picker");

  // Toggle panel visibility
  let togglePanel = function() {
    panel.classList.toggle("open");
    toggleBtn.classList.toggle("active");
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Avoid triggering ripples/food on background click
    togglePanel();
  });

  // Keep clicks inside the settings panel from spawning food/ripples
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Size Slider listener
  sizeSlider.addEventListener("input", (e) => {
    const size = parseInt(e.target.value);
    settings.fishSize = size;
    sizeVal.textContent = size + "px";
    localStorage.setItem("fishy_fishSize", size);
    
    // Dynamically scale radius of all active fishes immediately!
    fishes.forEach(fish => {
      fish.radius = size;
    });
  });

  // Fish Count slider listener
  countSlider.addEventListener("input", (e) => {
    const count = parseInt(e.target.value);
    settings.fishCount = count;
    countVal.textContent = count;
    localStorage.setItem("fishy_fishCount", count);
    adjustFishCount(count);
  });

  // Preset fish colors
  document.querySelectorAll("#fish-color-presets .color-preset").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const color = btn.getAttribute("data-color");
      updateFishColorSetting(color);
    });
  });

  // Fish Color Picker
  fishColorPicker.addEventListener("input", (e) => {
    updateFishColorSetting(e.target.value);
  });

  function updateFishColorSetting(color) {
    settings.fishColor = color;
    localStorage.setItem("fishy_fishColor", color);
    fishColorPicker.value = color;

    // Sync presets active state
    document.querySelectorAll("#fish-color-presets .color-preset").forEach(btn => {
      if (btn.getAttribute("data-color").toLowerCase() === color.toLowerCase()) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update active fishes immediately!
    fishes.forEach(fish => {
      fish.updateColor(color);
    });
  }

  // Opacity Slider listener
  opacitySlider.addEventListener("input", (e) => {
    const opacity = parseInt(e.target.value);
    settings.bgOpacity = opacity;
    opacityVal.textContent = opacity + "%";
    localStorage.setItem("fishy_bgOpacity", opacity);
    applyBackgroundSettings();
  });

  // Preset background colors
  document.querySelectorAll("#bg-color-presets .color-preset").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const color = btn.getAttribute("data-color");
      updateBgColorSetting(color);
    });
  });

  // Background Color Picker
  bgColorPicker.addEventListener("input", (e) => {
    updateBgColorSetting(e.target.value);
  });

  function updateBgColorSetting(color) {
    settings.bgColor = color;
    localStorage.setItem("fishy_bgColor", color);
    bgColorPicker.value = color;

    // Sync presets active state
    document.querySelectorAll("#bg-color-presets .color-preset").forEach(btn => {
      if (btn.getAttribute("data-color").toLowerCase() === color.toLowerCase()) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    applyBackgroundSettings();
  }

  // Dynamic macOS/Windows click-through logic: allow interacting with the settings UI,
  // but let normal mouse clicks pass through completely to access widgets, icons, and shortcuts on your screen!
  if (window.electronAPI) {
    // Initial state: ignore mouse clicks so desktop widgets and shortcuts are perfectly clickable!
    let lastIgnoreState = true;
    window.electronAPI.setIgnoreMouseEvents(true);

    // Track global cursor positions and dynamically toggle click-through when hovering the Gear or Settings Panel
    window.electronAPI.onGlobalMouseMove((data) => {
      // Update global mouse coordinates so the fishes smoothly watch/follow the cursor
      mouse.x = data.x;
      mouse.y = data.y;

      // Detect if mouse is over the Gear Toggle Button boundaries (top-right corner: 20px margins, 44px size)
      const isOverGear = (
        data.x >= window.innerWidth - 64 &&
        data.x <= window.innerWidth - 20 &&
        data.y >= 20 &&
        data.y <= 64
      );

      // Detect if mouse is over the Settings Panel boundaries (if open)
      const isPanelOpen = panel.classList.contains("open");
      const isOverPanel = isPanelOpen && (
        data.x >= window.innerWidth - 330 && // width is 310px + 20px right margin
        data.x <= window.innerWidth - 20 &&
        data.y >= 80 && // top margin is 80px
        data.y <= 80 + panel.offsetHeight
      );

      // Determine the desired click-through state
      let desiredIgnore = true;
      if (isOverGear || isOverPanel) {
        desiredIgnore = false;
      } else {
        if (isPanelOpen) {
          desiredIgnore = false; // Keep fully interactive if settings panel is open
        }
      }

      // ONLY call the Electron IPC if the ignore state has actually changed to prevent IPC flooding!
      if (desiredIgnore !== lastIgnoreState) {
        lastIgnoreState = desiredIgnore;
        window.electronAPI.setIgnoreMouseEvents(desiredIgnore);
      }
    });

    // Listen for the OS-level global hotkey Cmd+Alt+S / Ctrl+Alt+S to toggle settings panel
    window.electronAPI.onToggleSettingsGlobal(() => {
      togglePanel();
    });

    // Override togglePanel to sync interaction state when panel opens/closes
    const originalTogglePanel = togglePanel;
    togglePanel = function() {
      originalTogglePanel();
      if (panel.classList.contains("open")) {
        lastIgnoreState = false;
        window.electronAPI.setIgnoreMouseEvents(false);
      } else {
        lastIgnoreState = true;
        window.electronAPI.setIgnoreMouseEvents(true);
      }
    };
  }

  // System Autostart Toggle Listener
  const autostartToggle = document.getElementById("system-autostart-toggle");
  if (autostartToggle) {
    autostartToggle.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      settings.autoStart = enabled;
      localStorage.setItem("fishy_autoStart", enabled);
      if (window.electronAPI && window.electronAPI.setAutoStart) {
        window.electronAPI.setAutoStart(enabled);
      }
    });
  }

  // Bootstrap initial autostart configuration to main process
  if (window.electronAPI && window.electronAPI.setAutoStart) {
    window.electronAPI.setAutoStart(settings.autoStart);
  }

  // Keyboard shortcut listener to toggle panel
  window.addEventListener("keydown", (e) => {
    if (e.key === "s" || e.key === "S" || e.key === "c" || e.key === "C") {
      togglePanel();
    }
  });
}

// Apply styles programmatically to guarantee full-screen layout without scrollbars
canvas.style.display = "block";
canvas.style.position = "absolute";
canvas.style.top = "0";
canvas.style.left = "0";
document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.overflow = "hidden";
applyBackgroundSettings(); // Apply persisted background settings

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

  for (let i = 0; i < settings.fishCount; i++) {
    let x, y;
    let overlapping = true;
    let attempts = 0;

    let vx = randomRange(-0.8, 0.8);
    let vy = randomRange(-0.8, 0.8);
    if (Math.abs(vx) < 0.15) vx = vx < 0 ? -0.4 : 0.4;
    if (Math.abs(vy) < 0.15) vy = vy < 0 ? -0.4 : 0.4;

    while (overlapping && attempts < maxAttempts) {
      overlapping = false;
      x = randomRange(settings.fishSize, canvas.width - settings.fishSize);
      y = randomRange(settings.fishSize, canvas.height - settings.fishSize);

      for (let j = 0; j < fishes.length; j++) {
        const other = fishes[j];
        const dist = Math.hypot(x - other.x, y - other.y);
        if (dist < settings.fishSize + other.radius + 15) {
          overlapping = true;
          break;
        }
      }
      attempts++;
    }

    fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor));
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

  // 1. Clear transparent canvas background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

syncSettingsUI();
initSettingsUI();
init();
animate();
