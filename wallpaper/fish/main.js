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

let updateIgnoreMouseEvents = null;
const storedProfiles = JSON.parse(localStorage.getItem('fishy_fishProfiles') || '[]');
const namedProfiles = storedProfiles.filter(p => p.name && p.name.trim() !== '');
const activeNamedCount = namedProfiles.filter(p => p.active !== false).length;
const storedCount = parseInt(localStorage.getItem("fishy_fishCount") || "2");
const storedVisibleUnnamed = localStorage.getItem('fishy_visibleUnnamedCount');
const visibleUnnamedCount = storedVisibleUnnamed !== null ? parseInt(storedVisibleUnnamed) : Math.max(0, storedCount - activeNamedCount);

const settings = {
  fishSize: parseInt(localStorage.getItem("fishy_fishSize") || "12"), // default is 12px
  fishCount: activeNamedCount + visibleUnnamedCount, // total count
  fishColor: localStorage.getItem("fishy_fishColor") || "#f0654e",
  bgOpacity: parseInt(localStorage.getItem("fishy_bgOpacity") || "50"), // default background opacity is 50%
  bgColor: localStorage.getItem("fishy_bgColor") || "#07111e",
  autoStart: localStorage.getItem("fishy_autoStart") !== "false", // default is true (autostart enabled)
  feedingMode: localStorage.getItem("fishy_feedingMode") === "true", // default is false (don't intercept clicks by default)
  fishProfiles: namedProfiles,
  visibleUnnamedCount: visibleUnnamedCount
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

// Spawns a non-overlapping fish
function getRandomSpawnPos(maxAttempts = 150) {
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
  return { x, y, vx, vy };
}

function saveFishProfiles() {
  const activeNamedFishes = fishes.filter(fish => fish.name && fish.name.trim() !== '');

  const activeProfiles = activeNamedFishes.map(fish => ({
    id: fish.id,
    name: fish.name.trim(),
    color: fish.color1,
    size: fish.radius,
    visible: fish.visible !== false,
    active: true
  }));

  // Merge active profiles with existing settings.fishProfiles to keep inactive profiles intact
  let mergedProfiles = settings.fishProfiles.map(p => {
    const activeFish = fishes.find(f => f.id === p.id);
    if (activeFish) {
      if (activeFish.name && activeFish.name.trim() !== '') {
        return {
          id: activeFish.id,
          name: activeFish.name.trim(),
          color: activeFish.color1,
          size: activeFish.radius,
          visible: activeFish.visible !== false,
          active: true
        };
      } else {
        // Name cleared, discard profile
        return null;
      }
    }
    return { ...p, active: false };
  });

  // Filter out nulls
  mergedProfiles = mergedProfiles.filter(p => p !== null);

  // Add newly created/named active profiles that aren't tracked yet
  activeProfiles.forEach(ap => {
    if (!mergedProfiles.some(p => p.id === ap.id)) {
      mergedProfiles.push(ap);
    }
  });

  // Filter out any invalid profiles without names
  mergedProfiles = mergedProfiles.filter(p => p.name && p.name.trim() !== '');

  settings.fishProfiles = mergedProfiles;
  localStorage.setItem('fishy_fishProfiles', JSON.stringify(mergedProfiles));

  const visibleUnnamedCount = fishes.filter(fish => (!fish.name || fish.name.trim() === '') && fish.visible !== false).length;
  settings.visibleUnnamedCount = visibleUnnamedCount;
  localStorage.setItem('fishy_visibleUnnamedCount', visibleUnnamedCount);

  settings.fishCount = fishes.length;
  localStorage.setItem('fishy_fishCount', settings.fishCount);

  // Sync count UI
  const countSlider = document.getElementById("fish-count-slider");
  const countVal = document.getElementById("fish-count-value");
  if (countSlider) {
    countSlider.value = settings.fishCount;
  }
  if (countVal) {
    countVal.textContent = settings.fishCount;
  }
}

// Renders the per-fish color, name, visibility, size + delete controls in the settings panel
function renderFishList() {
  const container = document.getElementById('fish-list');
  if (!container) return;
  container.innerHTML = '';

  fishes.forEach((fish, i) => {
    const item = document.createElement('div');
    item.className = 'fish-list-item';

    // Row 1: Swatch, Name Input, Show/Hide Button, Delete Button
    const row1 = document.createElement('div');
    row1.className = 'fish-item-row';

    // Color Swatch
    const swatch = document.createElement('div');
    swatch.className = 'fish-color-swatch';
    swatch.style.backgroundColor = fish.color1;
    swatch.title = 'Click to change color';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'fish-color-input-hidden';
    colorInput.value = fish.color1;

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      colorInput.click();
    });

    colorInput.addEventListener('input', (e) => {
      e.stopPropagation();
      const newColor = e.target.value;
      fish.updateColor(newColor);
      swatch.style.backgroundColor = newColor;
      saveFishProfiles();
    });

    // Name Input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'fish-name-input';
    nameInput.placeholder = 'Fish';
    nameInput.value = fish.name || '';

    nameInput.addEventListener('input', (e) => {
      fish.name = e.target.value;
      saveFishProfiles();
    });

    // Show/Hide Toggle Button
    const showHideBtn = document.createElement('button');
    showHideBtn.type = 'button';
    showHideBtn.className = 'fish-action-btn show-hide-btn';
    if (fish.visible === false) {
      showHideBtn.classList.add('muted');
      showHideBtn.title = 'Show Fish';
      showHideBtn.innerHTML = `
        <svg class="fish-action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    } else {
      showHideBtn.title = 'Hide Fish';
      showHideBtn.innerHTML = `
        <svg class="fish-action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }

    showHideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fish.visible = fish.visible !== false ? false : true;
      saveFishProfiles();
      renderFishList();
    });

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'fish-delete-btn';
    deleteBtn.title = 'Delete Fish';
    deleteBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fishes.splice(i, 1);
      saveFishProfiles();
      renderFishList();
    });

    row1.appendChild(swatch);
    row1.appendChild(colorInput);
    row1.appendChild(nameInput);
    row1.appendChild(showHideBtn);
    row1.appendChild(deleteBtn);

    // Row 2: Size Slider
    const row2 = document.createElement('div');
    row2.className = 'fish-item-row';
    row2.style.marginTop = '2px';

    const sizeLabel = document.createElement('span');
    sizeLabel.style.fontSize = '0.75rem';
    sizeLabel.style.color = 'var(--text-muted)';
    sizeLabel.style.minWidth = '30px';
    sizeLabel.textContent = 'Size';

    const sizeSliderEl = document.createElement('input');
    sizeSliderEl.type = 'range';
    sizeSliderEl.className = 'fish-size-slider';
    sizeSliderEl.min = 12;
    sizeSliderEl.max = 52;
    sizeSliderEl.value = fish.radius;

    const sizeValEl = document.createElement('span');
    sizeValEl.className = 'fish-size-val';
    sizeValEl.style.minWidth = '32px';
    sizeValEl.style.textAlign = 'right';
    sizeValEl.textContent = fish.radius + 'px';

    sizeSliderEl.addEventListener('input', (e) => {
      e.stopPropagation();
      const newSize = parseInt(e.target.value);
      fish.radius = newSize;
      sizeValEl.textContent = newSize + 'px';
      saveFishProfiles();
    });

    row2.appendChild(sizeLabel);
    row2.appendChild(sizeSliderEl);
    row2.appendChild(sizeValEl);

    item.appendChild(row1);
    item.appendChild(row2);
    container.appendChild(item);
  });

  // Render Saved Fish Library (Inactive Named Fish Profiles)
  const inactiveSection = document.getElementById('inactive-fish-section');
  const inactiveList = document.getElementById('inactive-fish-list');
  if (inactiveSection && inactiveList) {
    const inactiveProfiles = settings.fishProfiles.filter(p => !fishes.some(f => f.id === p.id));
    if (inactiveProfiles.length > 0) {
      inactiveSection.style.display = 'block';
      inactiveList.innerHTML = '';
      inactiveProfiles.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'fish-list-item';

        const row = document.createElement('div');
        row.className = 'fish-item-row';

        // Static color swatch
        const swatch = document.createElement('div');
        swatch.className = 'fish-color-swatch';
        swatch.style.backgroundColor = p.color;
        swatch.style.cursor = 'default';

        // Static name label
        const nameLabel = document.createElement('span');
        nameLabel.style.fontSize = '0.85rem';
        nameLabel.style.fontWeight = '500';
        nameLabel.style.color = 'var(--text-main)';
        nameLabel.style.flex = '1';
        nameLabel.textContent = p.name;

        // Add to Pond Button
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'fish-action-btn';
        addBtn.title = 'Add to Pond';
        addBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        `;
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const { x, y, vx, vy } = getRandomSpawnPos(150);
          fishes.push(new Fish(x, y, vx, vy, p.size || settings.fishSize, p.color || settings.fishColor, p.name, p.visible !== false, p.id));
          saveFishProfiles();
          renderFishList();
        });

        // Delete Permanently Button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'fish-delete-btn';
        deleteBtn.title = 'Delete Permanently';
        deleteBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        `;
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          settings.fishProfiles = settings.fishProfiles.filter(profile => profile.id !== p.id);
          localStorage.setItem('fishy_fishProfiles', JSON.stringify(settings.fishProfiles));
          renderFishList();
        });

        row.appendChild(swatch);
        row.appendChild(nameLabel);
        row.appendChild(addBtn);
        row.appendChild(deleteBtn);
        item.appendChild(row);
        inactiveList.appendChild(item);
      });
    } else {
      inactiveSection.style.display = 'none';
      inactiveList.innerHTML = '';
    }
  }
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

  const feedingModeToggle = document.getElementById("feeding-mode-toggle");
  if (feedingModeToggle) {
    feedingModeToggle.checked = settings.feedingMode;
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
    for (let i = 0; i < countToSpawn; i++) {
      const inactiveProfiles = settings.fishProfiles.filter(p => !fishes.some(f => f.id === p.id));
      const { x, y, vx, vy } = getRandomSpawnPos(150);
      if (inactiveProfiles.length > 0) {
        const p = inactiveProfiles[0];
        fishes.push(new Fish(x, y, vx, vy, p.size || settings.fishSize, p.color || settings.fishColor, p.name, p.visible !== false, p.id));
      } else {
        fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor, "", true, null));
      }
    }
  } else if (fishes.length > targetCount) {
    const removeCount = fishes.length - targetCount;
    let removed = 0;
    
    // Remove unnamed fish first
    for (let i = fishes.length - 1; i >= 0; i--) {
      if (removed >= removeCount) break;
      if (!fishes[i].name || fishes[i].name.trim() === '') {
        fishes.splice(i, 1);
        removed++;
      }
    }
    
    // If still need to remove more (all remaining are named), remove from the end
    while (removed < removeCount && fishes.length > 0) {
      fishes.pop();
      removed++;
    }
  }
  saveFishProfiles();
  renderFishList();
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

  // Size Slider listener — sets global default AND updates all individual fish
  sizeSlider.addEventListener("input", (e) => {
    const size = parseInt(e.target.value);
    settings.fishSize = size;
    sizeVal.textContent = size + "px";
    localStorage.setItem("fishy_fishSize", size);
    fishes.forEach((fish) => {
      fish.radius = size;
    });
    saveFishProfiles();
    renderFishList();
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

    // Update all fish
    fishes.forEach((fish) => {
      fish.updateColor(color);
    });
    saveFishProfiles();
    renderFishList();
  }

  // Add Fish Button
  const addFishBtn = document.getElementById("add-fish-btn");
  if (addFishBtn) {
    addFishBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const { x, y, vx, vy } = getRandomSpawnPos(150);
      fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor, "", true, null));
      saveFishProfiles();
      renderFishList();
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

  // Feeding Mode Toggle Listener
  const feedingModeToggle = document.getElementById("feeding-mode-toggle");
  if (feedingModeToggle) {
    feedingModeToggle.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      settings.feedingMode = enabled;
      localStorage.setItem("fishy_feedingMode", enabled);
      if (window.electronAPI && typeof updateIgnoreMouseEvents === "function") {
        updateIgnoreMouseEvents();
      }
    });
  }

  // Dynamic macOS/Windows click-through logic: allow interacting with the settings UI,
  // but let normal mouse clicks pass through completely to access widgets, icons, and shortcuts on your screen!
  if (window.electronAPI) {
    let lastIgnoreState = true;

    // Helper to dynamically update window ignore mouse state
    updateIgnoreMouseEvents = () => {
      const isPanelOpen = panel.classList.contains("open");
      const isOverGear = (
        mouse.x >= window.innerWidth - 64 &&
        mouse.x <= window.innerWidth - 20 &&
        mouse.y >= 20 &&
        mouse.y <= 64
      );
      const isOverPanel = isPanelOpen && (
        mouse.x >= window.innerWidth - 330 &&
        mouse.x <= window.innerWidth - 20 &&
        mouse.y >= 80 &&
        mouse.y <= 80 + panel.offsetHeight
      );

      let desiredIgnore = true;
      if (settings.feedingMode) {
        desiredIgnore = false;
      } else if (isOverGear || isOverPanel) {
        desiredIgnore = false;
      } else {
        if (isPanelOpen) {
          desiredIgnore = false; // Keep fully interactive if settings panel is open
        }
      }

      if (desiredIgnore !== lastIgnoreState) {
        lastIgnoreState = desiredIgnore;
        window.electronAPI.setIgnoreMouseEvents(desiredIgnore);
      }
    };

    // Initialize state
    updateIgnoreMouseEvents();

    // Track global cursor positions and dynamically toggle click-through when hovering the Gear or Settings Panel
    window.electronAPI.onGlobalMouseMove((data) => {
      // Update global mouse coordinates so the fishes smoothly watch/follow the cursor
      mouse.x = data.x;
      mouse.y = data.y;

      updateIgnoreMouseEvents();
    });

    // Listen for the OS-level global hotkey Cmd+Alt+S / Ctrl+Alt+S to toggle settings panel
    window.electronAPI.onToggleSettingsGlobal(() => {
      togglePanel();
    });

    // Override togglePanel to sync interaction state when panel opens/closes
    const originalTogglePanel = togglePanel;
    togglePanel = function() {
      originalTogglePanel();
      updateIgnoreMouseEvents();
      const isOpen = panel.classList.contains("open");
      if (window.electronAPI && window.electronAPI.setSettingsPanelOpen) {
        window.electronAPI.setSettingsPanelOpen(isOpen);
      }
    };
  }

  const quitBtn = document.getElementById("quit-app-btn");
  if (quitBtn) {
    quitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.quitApp) {
        window.electronAPI.quitApp();
      }
    });
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
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }
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
    vx: 0,
    vy: 0,
    radius: 4.5,
    color: "#8b4513", // Solid flat SaddleBrown color pellet (Abowman style)
    floatTimer: randomRange(0, 100),
    touchCooldown: 0
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

  // 1. Spawn named fishes (only active ones)
  const activeNamedProfiles = settings.fishProfiles.filter(p => p.active !== false);
  activeNamedProfiles.forEach((profile) => {
    const { x, y, vx, vy } = getRandomSpawnPos(maxAttempts);
    fishes.push(new Fish(x, y, vx, vy, profile.size || settings.fishSize, profile.color || settings.fishColor, profile.name, profile.visible !== false, profile.id));
  });

  // 2. Spawn visible unnamed fishes
  for (let i = 0; i < settings.visibleUnnamedCount; i++) {
    const { x, y, vx, vy } = getRandomSpawnPos(maxAttempts);
    fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor, "", true, null));
  }

  saveFishProfiles();
  renderFishList();
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

    // Apply food movement dynamics and screen boundaries
    if (food.vx !== undefined && food.vy !== undefined) {
      food.x += food.vx;
      food.y += food.vy;
      food.vx *= 0.92; // Friction/drag
      food.vy *= 0.92;

      // Bounce and clamp within canvas boundaries
      if (food.x - food.radius < 0) {
        food.x = food.radius;
        food.vx = -food.vx * 0.5;
      } else if (food.x + food.radius > canvas.width) {
        food.x = canvas.width - food.radius;
        food.vx = -food.vx * 0.5;
      }
      if (food.y - food.radius < 0) {
        food.y = food.radius;
        food.vy = -food.vy * 0.5;
      } else if (food.y + food.radius > canvas.height) {
        food.y = canvas.height - food.radius;
        food.vy = -food.vy * 0.5;
      }
    }

    // Decrement touch cooldown
    if (food.touchCooldown > 0) {
      food.touchCooldown--;
    }

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
  const visibleFishes = fishes.filter(f => f.visible !== false);
  resolveCollisions(visibleFishes);
  checkFeeding(visibleFishes, foods, ripples);

  // 5. Update & draw fishes
  for (let i = 0; i < fishes.length; i++) {
    const fish = fishes[i];
    if (fish.visible !== false) {
      fish.update(canvas, foods, mouse, mouseIdleFrames);
      fish.draw(ctx);
    } else {
      fish.update(canvas, [], { x: undefined, y: undefined }, 9999);
    }
  }
}

// ============================================================
// BOOTSTRAP
// ============================================================

syncSettingsUI();
initSettingsUI();
init();
animate();
