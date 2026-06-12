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
const initialProfiles = storedProfiles.filter(p => p.active !== false || (p.name && p.name.trim() !== ''));
const activeProfiles = initialProfiles.filter(p => p.active !== false);
const storedCount = parseInt(localStorage.getItem("fishy_fishCount") || "2");
const fishCount = activeProfiles.length > 0 ? activeProfiles.length : storedCount;
const visibleUnnamedCount = activeProfiles.length > 0 ? activeProfiles.filter(p => !p.name || p.name.trim() === '').length : fishCount;

const storedCapacity = parseInt(localStorage.getItem("fishy_maxCapacity") || "10");
const maxCapacity = Math.max(fishCount, storedCapacity);

const settings = {
  fishSize: parseInt(localStorage.getItem("fishy_fishSize") || "12"), // default is 12px
  fishCount: fishCount, // total count
  maxCapacity: maxCapacity, // breeding capacity
  fishColor: localStorage.getItem("fishy_fishColor") || "#f0654e",
  bgOpacity: parseInt(localStorage.getItem("fishy_bgOpacity") || "50"), // default background opacity is 50%
  bgColor: localStorage.getItem("fishy_bgColor") || "#07111e",
  autoStart: localStorage.getItem("fishy_autoStart") !== "false", // default is true (autostart enabled)
  feedingMode: localStorage.getItem("fishy_feedingMode") === "true", // default is false (don't intercept clicks by default)
  fishProfiles: initialProfiles,
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
  const activeProfiles = fishes.map(fish => ({
    id: fish.id,
    name: (fish.name || '').trim(),
    color: fish.colorParts || fish.color1,
    size: fish.radius,
    visible: fish.visible !== false,
    active: true,
    gender: fish.gender,
    breedingEnabled: fish.breedingEnabled,
    isBred: fish.isBred,
    isMature: fish.isMature,
    birthTime: fish.birthTime,
    targetRadius: fish.targetRadius,
    parentInfo: fish.parentInfo || null
  }));

  // Merge active profiles with existing settings.fishProfiles to keep inactive profiles intact
  let mergedProfiles = settings.fishProfiles.map(p => {
    const activeFish = fishes.find(f => f.id === p.id);
    if (activeFish) {
      return {
        id: activeFish.id,
        name: (activeFish.name || '').trim(),
        color: activeFish.colorParts || activeFish.color1,
        size: activeFish.radius,
        visible: activeFish.visible !== false,
        active: true,
        gender: activeFish.gender,
        breedingEnabled: activeFish.breedingEnabled,
        isBred: activeFish.isBred,
        isMature: activeFish.isMature,
        birthTime: activeFish.birthTime,
        targetRadius: activeFish.targetRadius,
        parentInfo: activeFish.parentInfo || null
      };
    }
    // Discard inactive unnamed profiles
    if (!p.name || p.name.trim() === '') {
      return null;
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

  settings.fishProfiles = mergedProfiles;
  localStorage.setItem('fishy_fishProfiles', JSON.stringify(mergedProfiles));

  const visibleUnnamedCount = fishes.filter(fish => (!fish.name || fish.name.trim() === '') && fish.visible !== false).length;
  settings.visibleUnnamedCount = visibleUnnamedCount;
  localStorage.setItem('fishy_visibleUnnamedCount', visibleUnnamedCount);
}

// Renders the per-fish color, name, visibility, size + delete controls in the settings panel
function renderFishList() {
  const container = document.getElementById('fish-list');
  if (!container) return;
  container.innerHTML = '';

  fishes.forEach((fish, i) => {
    const item = document.createElement('div');
    item.className = 'fish-list-item';

    // Row 1: Swatch, Name Input, Gender Toggle, Breeding Toggle, Show/Hide Button, Delete Button
    const row1 = document.createElement('div');
    row1.className = 'fish-item-row';

    // Color Swatch
    const swatch = document.createElement('div');
    swatch.className = 'fish-color-swatch';
    swatch.style.backgroundColor = fish.colorParts ? fish.colorParts.body : fish.color1;
    swatch.title = 'Click to change color';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'fish-color-input-hidden';
    colorInput.value = fish.colorParts ? fish.colorParts.body : fish.color1;

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      colorInput.click();
    });

    colorInput.addEventListener('input', (e) => {
      e.stopPropagation();
      const newColor = e.target.value;
      fish.updateColor(newColor);
      swatch.style.backgroundColor = newColor;
      thumbnail.src = renderFishPreview(fish.colorParts, 14);
      saveFishProfiles();
    });

    // Thumbnail preview
    const thumbnail = document.createElement('img');
    thumbnail.className = 'settings-fish-thumbnail';
    thumbnail.src = renderFishPreview(fish.colorParts, 14);
    thumbnail.title = 'Click thumbnail or swatch to change color';
    thumbnail.style.cursor = 'pointer';
    thumbnail.addEventListener('click', (e) => {
      e.stopPropagation();
      colorInput.click();
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

    // Gender Toggle Button
    const genderBtn = document.createElement('button');
    genderBtn.type = 'button';
    genderBtn.className = 'fish-action-btn';
    genderBtn.style.fontSize = '0.9rem';
    genderBtn.style.fontWeight = 'bold';
    genderBtn.style.display = 'flex';
    genderBtn.style.alignItems = 'center';
    genderBtn.style.justifyContent = 'center';
    if (fish.gender === 'male') {
      genderBtn.innerHTML = '♂';
      genderBtn.style.color = '#60a5fa';
      genderBtn.title = 'Gender: Male (Click to toggle)';
    } else {
      genderBtn.innerHTML = '♀';
      genderBtn.style.color = '#f472b6';
      genderBtn.title = 'Gender: Female (Click to toggle)';
    }
    genderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fish.gender = fish.gender === 'male' ? 'female' : 'male';
      saveFishProfiles();
      renderFishList();
    });

    // Breeding Toggle Button
    const breedingBtn = document.createElement('button');
    breedingBtn.type = 'button';
    breedingBtn.className = 'fish-action-btn';
    breedingBtn.style.fontSize = '0.9rem';
    breedingBtn.style.display = 'flex';
    breedingBtn.style.alignItems = 'center';
    breedingBtn.style.justifyContent = 'center';
    if (fish.breedingEnabled) {
      breedingBtn.innerHTML = '💖';
      breedingBtn.title = 'Breeding: Enabled (Click to toggle)';
    } else {
      breedingBtn.innerHTML = '🖤';
      breedingBtn.title = 'Breeding: Disabled (Click to toggle)';
    }
    breedingBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fish.breedingEnabled = !fish.breedingEnabled;
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

    row1.appendChild(thumbnail);

    // Family Tree Button — only shown for bred fish
    if (fish.isBred && fish.parentInfo) {
      const treeBtn = document.createElement('button');
      treeBtn.type = 'button';
      treeBtn.className = 'fish-action-btn';
      treeBtn.style.fontSize = '0.88rem';
      treeBtn.style.display = 'flex';
      treeBtn.style.alignItems = 'center';
      treeBtn.style.justifyContent = 'center';
      treeBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="5" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="18" r="3"></circle>
          <path d="M12 8v4M6 18v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      treeBtn.title = 'View Family Tree';
      treeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openFamilyTree(fish);
      });
      row1.appendChild(treeBtn);
    }

    row1.appendChild(swatch);
    row1.appendChild(colorInput);
    row1.appendChild(nameInput);
    row1.appendChild(genderBtn);
    row1.appendChild(breedingBtn);
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
    sizeValEl.textContent = fish.radius.toFixed(2) + 'px';

    sizeSliderEl.addEventListener('input', (e) => {
      e.stopPropagation();
      const newSize = parseInt(e.target.value);
      fish.radius = newSize;
      fish.targetRadius = newSize;
      if (!fish.isMature) {
        fish.isMature = true;
      }
      sizeValEl.textContent = newSize.toFixed(2) + 'px';
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

        // Static fish preview thumbnail
        const thumbnail = document.createElement('img');
        thumbnail.className = 'settings-fish-thumbnail';
        thumbnail.src = renderFishPreview(p.color, 14);
        thumbnail.alt = 'Fish thumbnail';
        thumbnail.style.cursor = 'default';

        // Static name label
        const nameLabel = document.createElement('span');
        nameLabel.style.fontSize = '0.85rem';
        nameLabel.style.fontWeight = '500';
        nameLabel.style.color = 'var(--text-main)';
        nameLabel.style.flex = '1';
        nameLabel.textContent = p.name;

        // Static gender symbol next to the name
        const genderSpan = document.createElement('span');
        genderSpan.style.fontSize = '0.85rem';
        genderSpan.style.fontWeight = 'bold';
        if (p.gender === 'male') {
          genderSpan.textContent = '♂';
          genderSpan.style.color = '#60a5fa';
          genderSpan.title = 'Gender: Male';
        } else {
          genderSpan.textContent = '♀';
          genderSpan.style.color = '#f472b6';
          genderSpan.title = 'Gender: Female';
        }

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
          const restoredFish = new Fish(x, y, vx, vy, p.size || settings.fishSize, p.color || settings.fishColor, p.name, p.visible !== false, p.id, p.gender, p.breedingEnabled, p.isBred, p.isMature !== false, p.birthTime, p.targetRadius);
          if (p.parentInfo) restoredFish.parentInfo = p.parentInfo;
          fishes.push(restoredFish);
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

        row.appendChild(thumbnail);
        row.appendChild(nameLabel);
        row.appendChild(genderSpan);

        // Family Tree Button — shown for bred saved fish
        if (p.isBred && p.parentInfo) {
          const treeBtn = document.createElement('button');
          treeBtn.type = 'button';
          treeBtn.className = 'fish-action-btn';
          treeBtn.style.fontSize = '0.88rem';
          treeBtn.style.display = 'flex';
          treeBtn.style.alignItems = 'center';
          treeBtn.style.justifyContent = 'center';
          treeBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="5" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="18" r="3"></circle>
              <path d="M12 8v4M6 18v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>
            </svg>
          `;
          treeBtn.title = 'View Family Tree';
          treeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openFamilyTree(p);
          });
          row.appendChild(treeBtn);
        }

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
    if (sizeVal) sizeVal.textContent = parseFloat(settings.fishSize).toFixed(2) + "px";
  }

  if (countSlider) {
    countSlider.value = settings.fishCount;
    if (countVal) countVal.textContent = settings.fishCount;
  }
  
  const capacitySlider = document.getElementById("fish-capacity-slider");
  const capacityVal = document.getElementById("fish-capacity-value");
  if (capacitySlider) {
    capacitySlider.value = settings.maxCapacity;
    if (capacityVal) capacityVal.textContent = settings.maxCapacity;
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
        const restoredFish = new Fish(x, y, vx, vy, p.size || settings.fishSize, p.color || settings.fishColor, p.name, p.visible !== false, p.id, p.gender, p.breedingEnabled, p.isBred, p.isMature !== false, p.birthTime, p.targetRadius);
        if (p.parentInfo) restoredFish.parentInfo = p.parentInfo;
        fishes.push(restoredFish);
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
  const capacitySlider = document.getElementById("fish-capacity-slider");
  const capacityVal = document.getElementById("fish-capacity-value");
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
    sizeVal.textContent = size.toFixed(2) + "px";
    localStorage.setItem("fishy_fishSize", size);
    fishes.forEach((fish) => {
      const isNamed = fish.name && fish.name.trim() !== '';
      if (!isNamed && !fish.isBred) {
        fish.radius = size;
        fish.targetRadius = size;
      }
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

  // Max Capacity slider listener
  if (capacitySlider) {
    capacitySlider.addEventListener("input", (e) => {
      const capacity = parseInt(e.target.value);
      settings.maxCapacity = capacity;
      capacityVal.textContent = capacity;
      localStorage.setItem("fishy_maxCapacity", capacity);
    });
  }

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

    // Update all fish EXCEPT named or bred ones
    fishes.forEach((fish) => {
      const isNamed = fish.name && fish.name.trim() !== '';
      if (!isNamed && !fish.isBred) {
        fish.updateColor(color);
      }
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

class HeartParticle {
  constructor(x, y) {
    this.x = x + randomRange(-12, 12);
    this.y = y + randomRange(-12, 12);
    this.vx = randomRange(-0.6, 0.6);
    this.vy = randomRange(-1.6, -0.6); // float upwards
    this.size = randomRange(5, 10);
    this.alpha = 1.0;
    this.decay = randomRange(0.007, 0.013); // slow fade
    this.wiggle = randomRange(0, 100);
  }
  
  update() {
    this.x += this.vx + Math.sin(this.wiggle) * 0.25;
    this.y += this.vy;
    this.wiggle += 0.05;
    this.alpha -= this.decay;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = '#f43f5e'; // premium rose red
    ctx.translate(this.x, this.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const s = this.size;
    ctx.bezierCurveTo(-s / 2, -s / 2, -s, -s / 4, -s, s / 4);
    ctx.bezierCurveTo(-s, s * 0.7, -s * 0.2, s * 0.9, 0, s * 1.2);
    ctx.bezierCurveTo(s * 0.2, s * 0.9, s, s * 0.7, s, s * 0.4);
    ctx.bezierCurveTo(s, -s / 4, s / 2, -s / 2, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ============================================================
// FAMILY TREE OVERLAY
// ============================================================

function makeFishColorGrid(colorParts) {
  const parts = [
    { label: 'Head',       color: colorParts.head },
    { label: 'Body',       color: colorParts.body },
    { label: 'Seg 1',      color: colorParts.s1 },
    { label: 'Seg 2',      color: colorParts.s2 },
    { label: 'Left Fin',   color: colorParts.leftFin },
    { label: 'Right Fin',  color: colorParts.rightFin },
  ];
  ['tailLeft', 'tailCenter', 'tailRight'].forEach((lobe, li) => {
    const lobeLabel = ['Left Lobe', 'Ctr Lobe', 'Right Lobe'][li];
    const arr = Array.isArray(colorParts[lobe]) ? colorParts[lobe] : Array(5).fill(colorParts[lobe]);
    arr.forEach((c, si) => parts.push({ label: `${lobeLabel} ${si + 1}`, color: c }));
  });
  const grid = document.createElement('div');
  grid.className = 'ft-color-grid';
  parts.forEach(({ label, color }) => {
    const cell = document.createElement('div');
    cell.className = 'ft-color-cell';
    const dot = document.createElement('div');
    dot.className = 'ft-color-dot';
    dot.style.backgroundColor = color || '#888';
    const lbl = document.createElement('span');
    lbl.className = 'ft-color-label';
    lbl.textContent = label;
    cell.appendChild(dot);
    cell.appendChild(lbl);
    grid.appendChild(cell);
  });
  return grid;
}

function renderFishPreview(colorParts, displayRadius = 24) {
  const scale = 4.0;
  const renderRadius = displayRadius * scale;
  const W = Math.round(64 * scale);
  const H = Math.round(104 * scale);
  const cvs = document.createElement('canvas');
  cvs.width = W;
  cvs.height = H;
  const pctx = cvs.getContext('2d');

  // No background - keep transparent

  const centerY = Math.round(H / 2 - 0.815 * renderRadius);
  const tempFish = new Fish(
    W / 2, centerY,    // x, y — dynamically centered based on renderRadius
    0, 0,
    renderRadius,
    colorParts,
    '', true, null, 'female', false, false, true, null, renderRadius
  );

  // Force a clean, straight, non-wiggling pose facing up
  tempFish.drawAngle = -Math.PI / 2;   // facing up
  tempFish.prevAngle = -Math.PI / 2;
  tempFish.angle1 = -Math.PI / 2; tempFish.angle2 = -Math.PI / 2; tempFish.angle2b = -Math.PI / 2;
  tempFish.angle3 = -Math.PI / 2 + Math.PI; tempFish.angle4 = -Math.PI / 2 + Math.PI;
  tempFish.angle5 = -Math.PI / 2 + Math.PI; tempFish.angle6 = -Math.PI / 2 + Math.PI;
  tempFish.tailWorldAngle = -Math.PI / 2 + Math.PI;
  tempFish.wiggleCycle = 0;
  tempFish.smoothAmpFactor = 0;
  tempFish.currentSpeed = 0;
  tempFish.currentFlare = 0.72;
  tempFish.finAngle = 0.05;
  tempFish.kickAmp = 0;
  tempFish.snatchTimer = 0;
  tempFish.smoothTurnRate = 0;

  tempFish.draw(pctx, false);
  return cvs.toDataURL();
}

function makeCompactColorRow(colorParts) {
  const row = document.createElement('div');
  row.className = 'ft-compact-colors';
  const scalarParts = ['head', 'body', 's1', 's2', 'leftFin', 'rightFin'];
  scalarParts.forEach(part => {
    const d = document.createElement('div');
    d.className = 'ft-color-dot';
    d.style.backgroundColor = colorParts[part] || '#888';
    d.title = part;
    row.appendChild(d);
  });
  ['tailLeft', 'tailCenter', 'tailRight'].forEach(lobe => {
    const arr = Array.isArray(colorParts[lobe]) ? colorParts[lobe] : Array(5).fill(colorParts[lobe]);
    arr.forEach(c => {
      const d = document.createElement('div');
      d.className = 'ft-color-dot';
      d.style.backgroundColor = c || '#888';
      row.appendChild(d);
    });
  });
  return row;
}

function getAncestorLabel(depth, side) {
  if (depth === 0) return '';
  if (depth === 1) return side === 'mother' ? 'Mother' : 'Father';
  const prefix = depth > 2 ? 'Great-'.repeat(depth - 2) : '';
  return prefix + (side === 'mother' ? 'Grandmother' : 'Grandfather');
}

function buildFamilyTreeNode(data, depth, side) {
  const item = document.createElement('div');
  item.className = 'ft-tree-item';
  if (depth === 0) item.classList.add('ft-tree-root');

  const label = getAncestorLabel(depth, side);
  const genderSym = data.gender === 'female' ? ' ♀' : ' ♂';

  // Card — flex-row: thumbnail on left, content on right
  const card = document.createElement('div');
  card.className = 'ft-tree-card';
  if (depth === 0) card.classList.add('ft-tree-card--root');
  else if (depth === 1) card.classList.add('ft-tree-card--parent');
  else card.classList.add('ft-tree-card--ancestor');

  // LEFT: fish preview thumbnail wrapped in a square container
  const previewSrc = renderFishPreview(data.colorParts, 24);
  const imgContainer = document.createElement('div');
  imgContainer.className = 'ft-fish-preview-container';
  const fishImg = document.createElement('img');
  fishImg.src = previewSrc;
  fishImg.className = 'ft-fish-preview';
  fishImg.alt = (data.name || 'Fish') + ' preview';
  imgContainer.appendChild(fishImg);
  card.appendChild(imgContainer);

  // RIGHT: content body (header + color info)
  const cardBody = document.createElement('div');
  cardBody.className = 'ft-tree-card-body';

  // Header row: body dot + name + role + optional toggle
  const header = document.createElement('div');
  header.className = 'ft-tree-card-header';

  const dot = document.createElement('div');
  dot.className = 'ft-body-dot';
  const dotSz = Math.max(10, 18 - depth * 2) + 'px';
  dot.style.width = dotSz;
  dot.style.height = dotSz;
  dot.style.backgroundColor = data.colorParts?.body || '#888';

  const nameEl = document.createElement('span');
  nameEl.className = 'ft-tree-name';
  nameEl.textContent = (data.name || 'Unnamed') + genderSym;

  header.appendChild(dot);
  header.appendChild(nameEl);

  if (label) {
    const roleEl = document.createElement('span');
    roleEl.className = 'ft-tree-role';
    roleEl.textContent = label;
    header.appendChild(roleEl);
  }

  cardBody.appendChild(header);

  // Color info: full grid for child, compact dot-row for ALL ancestors
  if (depth === 0) {
    cardBody.appendChild(makeFishColorGrid(data.colorParts));
  } else {
    cardBody.appendChild(makeCompactColorRow(data.colorParts));
  }

  card.appendChild(cardBody);
  item.appendChild(card);

  // Recurse into parents with collapse toggle
  if (data.parentInfo) {
    const childrenEl = document.createElement('div');
    childrenEl.className = 'ft-tree-children';
    childrenEl.appendChild(buildFamilyTreeNode(data.parentInfo.mother, depth + 1, 'mother'));
    childrenEl.appendChild(buildFamilyTreeNode(data.parentInfo.father, depth + 1, 'father'));

    // Parents (depth 0 children) start expanded, grandparents+ start collapsed
    const startCollapsed = depth >= 1;
    childrenEl.style.display = startCollapsed ? 'none' : '';
    childrenEl.style.overflow = 'hidden';

    // Collapse toggle button — appended into the already-built header
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ft-tree-toggle';
    toggleBtn.textContent = startCollapsed ? '▸' : '▾';
    toggleBtn.title = startCollapsed ? 'Show ancestors' : 'Hide ancestors';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = childrenEl.style.display === 'none';
      childrenEl.style.display = isCollapsed ? '' : 'none';
      toggleBtn.textContent = isCollapsed ? '▾' : '▸';
      toggleBtn.title = isCollapsed ? 'Hide ancestors' : 'Show ancestors';
      if (isCollapsed) {
        requestAnimationFrame(() => {
          adjustTreeThumbnails(childrenEl);
        });
      }
    });
    header.appendChild(toggleBtn); // safe to append even after header is in DOM

    item.appendChild(childrenEl);
  }

  return item;
}

function adjustTreeThumbnails(rootEl) {
  const cards = rootEl.querySelectorAll('.ft-tree-card');
  cards.forEach(card => {
    const container = card.querySelector('.ft-fish-preview-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      if (containerRect.height > 0) {
        container.style.width = containerRect.height + 'px';
      }
    }
  });
}

// Re-adjust thumbnail widths on resize if family tree overlay is open
window.addEventListener('resize', () => {
  const overlay = document.getElementById('family-tree-overlay');
  if (overlay && overlay.classList.contains('open')) {
    adjustTreeThumbnails(overlay);
  }
});

function openFamilyTree(fishOrProfile) {
  const overlay = document.getElementById('family-tree-overlay');
  if (!overlay) return;

  const content = overlay.querySelector('#ft-tree-content');
  if (!content) return;

  content.innerHTML = '';

  const selfData = {
    name: fishOrProfile.name || 'Unnamed',
    gender: fishOrProfile.gender,
    colorParts: fishOrProfile.colorParts || fishOrProfile.color,
    radius: fishOrProfile.radius || fishOrProfile.size,
    parentInfo: fishOrProfile.parentInfo || null
  };

  content.appendChild(buildFamilyTreeNode(selfData, 0, null));
  overlay.classList.add('open');

  // Enforce square shape on all thumbnail containers based on actual rendered heights
  requestAnimationFrame(() => {
    adjustTreeThumbnails(content);
  });
}

function closeFamilyTree() {
  const overlay = document.getElementById('family-tree-overlay');
  if (overlay) overlay.classList.remove('open');
}

// ============================================================
// ACTIVE SYSTEMS
// ============================================================

let fishes = [];
let foods = [];
let ripples = [];
let heartParticles = [];

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

  const activeProfiles = settings.fishProfiles.filter(p => p.active !== false);

  if (activeProfiles.length > 0) {
    activeProfiles.forEach((profile) => {
      const { x, y, vx, vy } = getRandomSpawnPos(maxAttempts);
      const spawnedFish = new Fish(x, y, vx, vy, profile.size || settings.fishSize, profile.color || settings.fishColor, profile.name, profile.visible !== false, profile.id, profile.gender, profile.breedingEnabled, profile.isBred, profile.isMature !== false, profile.birthTime, profile.targetRadius);
      if (profile.parentInfo) spawnedFish.parentInfo = profile.parentInfo;
      fishes.push(spawnedFish);
    });
  } else {
    // Fallback if no active profiles saved yet
    for (let i = 0; i < settings.fishCount; i++) {
      const { x, y, vx, vy } = getRandomSpawnPos(maxAttempts);
      fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor, "", true, null));
    }
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
  resolveCollisions(visibleFishes, fishes.length < settings.maxCapacity);
  checkFeeding(visibleFishes, foods, ripples);

  // 4b. Update and draw heart particles
  for (let i = heartParticles.length - 1; i >= 0; i--) {
    heartParticles[i].update();
    heartParticles[i].draw(ctx);
    if (heartParticles[i].alpha <= 0) {
      heartParticles.splice(i, 1);
    }
  }

  // 5. Update & draw fishes
  const isSettingsOpen = document.getElementById("settings-panel")?.classList.contains("open") || false;
  for (let i = fishes.length - 1; i >= 0; i--) {
    const fish = fishes[i];
    
    // Spawn heart particles during breeding
    if (fish.visible !== false && fish.isBreeding && Math.random() < 0.15) {
      heartParticles.push(new HeartParticle(fish.x, fish.y));
    }
    
    // Check if breeding finished and spawn baby
    if (fish.isBreeding && fish.breedingTimer <= 0) {
      if (!fish.breedingPartner) {
        fish.isBreeding = false;
        fish.breedingPartner = null;
        fish.breedingCooldown = 1800;
      } else if (fish.gender === 'female') {
        const mother = fish;
        const father = fish.breedingPartner;
        
        const babyX = (mother.x + father.x) * 0.5;
        const babyY = (mother.y + father.y) * 0.5;
        
        const babyVx = randomRange(-0.5, 0.5);
        const babyVy = randomRange(-0.5, 0.5);
        
        const childColorParts = {};
        // Scalar parts: each part inherits from one parent at random
        const scalarParts = ['head', 'body', 's1', 's2', 'leftFin', 'rightFin'];
        scalarParts.forEach(part => {
          childColorParts[part] = Math.random() < 0.5 ? mother.colorParts[part] : father.colorParts[part];
        });
        // Tail lobe parts: each of the 5 segments independently picks from either parent
        const tailParts = ['tailLeft', 'tailCenter', 'tailRight'];
        tailParts.forEach(lobe => {
          const mArr = mother.colorParts[lobe];
          const fArr = father.colorParts[lobe];
          childColorParts[lobe] = Array.from({ length: 5 }, (_, i) =>
            Math.random() < 0.5 ? mArr[i] : fArr[i]
          );
        });
        
        const motherTargetSize = mother.targetRadius || mother.radius;
        const fatherTargetSize = father.targetRadius || father.radius;
        const minSize = Math.min(motherTargetSize, fatherTargetSize);
        const maxSize = Math.max(motherTargetSize, fatherTargetSize);
        const childTargetRadius = randomRange(minSize, maxSize);
        
        const baby = new Fish(
          babyX, babyY, babyVx, babyVy, 
          6, // starting baby radius
          childColorParts, 
          "", 
          true, 
          null, 
          null, 
          true, 
          true, // isBred
          false, // isMature = false
          Date.now(),
          childTargetRadius
        );
        
        baby.targetRadius = childTargetRadius;
        baby.breedingCooldown = 1800; // newborn cooldown before breeding (30s)

        // Snapshot parent info for the family tree overlay — include each parent's own ancestry
        baby.parentInfo = {
          mother: {
            id: mother.id,
            name: mother.name || 'Unnamed',
            gender: mother.gender,
            colorParts: JSON.parse(JSON.stringify(mother.colorParts)),
            radius: motherTargetSize,
            parentInfo: mother.parentInfo ? JSON.parse(JSON.stringify(mother.parentInfo)) : null
          },
          father: {
            id: father.id,
            name: father.name || 'Unnamed',
            gender: father.gender,
            colorParts: JSON.parse(JSON.stringify(father.colorParts)),
            radius: fatherTargetSize,
            parentInfo: father.parentInfo ? JSON.parse(JSON.stringify(father.parentInfo)) : null
          }
        };
        
        fishes.push(baby);
        
        // Heart burst!
        for (let h = 0; h < 15; h++) {
          heartParticles.push(new HeartParticle(babyX, babyY));
        }
        
        // Clean up breeding state for both parents
        mother.isBreeding = false;
        mother.breedingPartner = null;
        mother.breedingCooldown = 1800;
        
        father.isBreeding = false;
        father.breedingPartner = null;
        father.breedingCooldown = 1800;
        
        saveFishProfiles();
        renderFishList();
      }
    }
    
    if (fish.visible !== false) {
      fish.update(canvas, foods, mouse, mouseIdleFrames);
      fish.draw(ctx, isSettingsOpen);
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

// Family tree overlay: close on backdrop click or Escape key
document.getElementById('family-tree-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeFamilyTree();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeFamilyTree();
});
