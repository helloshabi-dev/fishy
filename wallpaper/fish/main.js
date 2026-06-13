// main.js — Canvas setup, global state, input handling, init, and animation loop
import { randomRange } from './utils.js';
import { Ripple } from './ripple.js';
import { Fish } from './fish.js';
import { resolveCollisions, checkFeeding, resolveFoodCollisions } from './physics.js';


// ============================================================
// CANVAS SETUP
// ============================================================

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const resolutionScale = 1; // resolution throttle to save GPU and memory overhead

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
const storedSpeed = parseFloat(localStorage.getItem("fishy_speedMultiplier") || "1.00");

const settings = {
  fishSize: parseInt(localStorage.getItem("fishy_fishSize") || "12"), // default is 12px
  fishCount: fishCount, // total count
  maxCapacity: maxCapacity, // breeding capacity
  speedMultiplier: storedSpeed,
  fishColor: localStorage.getItem("fishy_fishColor") || "#f0654e",
  bgOpacity: parseInt(localStorage.getItem("fishy_bgOpacity") || "50"), // default background opacity is 50%
  bgColor: localStorage.getItem("fishy_bgColor") || "#07111e",
  autoStart: localStorage.getItem("fishy_autoStart") !== "false", // default is true (autostart enabled)
  feedingMode: localStorage.getItem("fishy_feedingMode") === "true", // default is false (don't intercept clicks by default)
  fishProfiles: initialProfiles,
  visibleUnnamedCount: visibleUnnamedCount,
  schoolingEnabled: localStorage.getItem("fishy_schoolingEnabled") !== "false", // default is true
  schoolingSeparation: parseFloat(localStorage.getItem("fishy_schoolingSeparation") || "1.2"),
  schoolingAlignment: parseFloat(localStorage.getItem("fishy_schoolingAlignment") || "1.0"),
  schoolingCohesion: parseFloat(localStorage.getItem("fishy_schoolingCohesion") || "0.8")
};

let detectedCity = localStorage.getItem('fishy_birthCity') || '';
let detectedCountryCode = localStorage.getItem('fishy_birthCountryCode') || '';

async function detectCity() {
  if (detectedCity && detectedCountryCode) return;
  try {
    const res = await fetch('https://freeipapi.com/api/json');
    const data = await res.json();
    if (data && data.cityName) {
      detectedCity = data.cityName;
      detectedCountryCode = data.countryCode || '';
      localStorage.setItem('fishy_birthCity', detectedCity);
      localStorage.setItem('fishy_birthCountryCode', detectedCountryCode);
      return;
    }
  } catch (e) {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data && data.city) {
        detectedCity = data.city;
        detectedCountryCode = data.country_code || '';
        localStorage.setItem('fishy_birthCity', detectedCity);
        localStorage.setItem('fishy_birthCountryCode', detectedCountryCode);
        return;
      }
    } catch (err) {
      console.warn('Failed to detect city:', err);
    }
  }
}
detectCity();

function getFlagEmoji(countryCode) {
  if (!countryCode) return '';
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '';
  }
}

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
    birthCity: fish.birthCity || null,
    birthCountryCode: fish.birthCountryCode || null,
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
        birthCity: activeFish.birthCity || null,
        birthCountryCode: activeFish.birthCountryCode || null,
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

  settings.fishCount = fishes.length;
  localStorage.setItem('fishy_fishCount', fishes.length);

  const countSlider = document.getElementById("fish-count-slider");
  const countVal = document.getElementById("fish-count-value");
  if (countSlider) {
    const currentMax = parseInt(countSlider.max) || 15;
    if (fishes.length > currentMax) {
      countSlider.max = fishes.length;
    } else if (fishes.length < currentMax && currentMax > 15) {
      countSlider.max = Math.max(15, fishes.length);
    }
    countSlider.value = fishes.length;
  }
  if (countVal) {
    countVal.textContent = fishes.length;
  }

  const visibleUnnamedCount = fishes.filter(fish => (!fish.name || fish.name.trim() === '') && fish.visible !== false).length;
  settings.visibleUnnamedCount = visibleUnnamedCount;
  localStorage.setItem('fishy_visibleUnnamedCount', visibleUnnamedCount);

  // Save named profiles to files in the profiles folder
  if (window.electronAPI && window.electronAPI.saveProfileFile) {
    mergedProfiles.forEach(p => {
      if (p.name && p.name.trim() !== '') {
        window.electronAPI.saveProfileFile(p);
      }
    });
  }
}

// Renders the per-fish color, name, visibility, size + delete controls in the settings panel
let _fishListDirty = false;
function renderFishList() {
  const container = document.getElementById('fish-list');
  if (!container) return;

  // Skip expensive DOM rebuild if settings panel is not visible — just mark dirty
  const panel = document.getElementById('settings-panel');
  if (panel && !panel.classList.contains('open')) {
    _fishListDirty = true;
    return;
  }
  _fishListDirty = false;

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
      fish.updateColor(newColor); // This sets fish._thumbnailUrl = null
      swatch.style.backgroundColor = newColor;
      fish._thumbnailUrl = renderFishPreview(fish.colorParts, 14);
      thumbnail.src = fish._thumbnailUrl;
      saveFishProfiles();
    });

    // Thumbnail preview (reuse cached snapshot if color hasn't changed)
    const thumbnail = document.createElement('img');
    thumbnail.className = 'settings-fish-thumbnail';
    if (!fish._thumbnailUrl) fish._thumbnailUrl = renderFishPreview(fish.colorParts, 14);
    thumbnail.src = fish._thumbnailUrl;
    thumbnail.title = 'Click to view fish profile details';
    thumbnail.style.cursor = 'pointer';
    thumbnail.addEventListener('click', (e) => {
      e.stopPropagation();
      openFamilyTree(fish);
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

    // Share Button
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'fish-action-btn';
    shareBtn.title = 'Share Fish Profile';
    shareBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    `;
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openShareModal(fish);
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
    row1.appendChild(swatch);
    row1.appendChild(colorInput);
    row1.appendChild(nameInput);
    row1.appendChild(genderBtn);
    row1.appendChild(breedingBtn);
    row1.appendChild(shareBtn);
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

        // Static fish preview thumbnail (reuse cached snapshot)
        const thumbnail = document.createElement('img');
        thumbnail.className = 'settings-fish-thumbnail';
        if (!p._thumbnailUrl) p._thumbnailUrl = renderFishPreview(p.color, 14);
        thumbnail.src = p._thumbnailUrl;
        thumbnail.alt = 'Fish thumbnail';
        thumbnail.style.cursor = 'pointer';
        thumbnail.title = 'Click to view fish profile details';
        thumbnail.addEventListener('click', (e) => {
          e.stopPropagation();
          openFamilyTree(p);
        });

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
          const restoredFish = new Fish(x, y, vx, vy, p.size || settings.fishSize, p.color || settings.fishColor, p.name, p.visible !== false, p.id, p.gender, p.breedingEnabled, p.isBred, p.isMature !== false, p.birthTime, p.targetRadius, p.birthCity || null);
          if (p.parentInfo) restoredFish.parentInfo = p.parentInfo;
          restoredFish.updateSpeedRange(settings.speedMultiplier);
          fishes.push(restoredFish);
          saveFishProfiles();
          renderFishList();
        });

        // Share Button for Inactive Library Fish
        const shareBtn = document.createElement('button');
        shareBtn.type = 'button';
        shareBtn.className = 'fish-action-btn';
        shareBtn.title = 'Share Fish Profile';
        shareBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
        `;
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openShareModal(p);
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
          const profileId = p.id;
          settings.fishProfiles = settings.fishProfiles.filter(profile => profile.id !== p.id);
          localStorage.setItem('fishy_fishProfiles', JSON.stringify(settings.fishProfiles));
          if (window.electronAPI && window.electronAPI.deleteProfileFile) {
            window.electronAPI.deleteProfileFile(profileId);
          }
          renderFishList();
        });

        row.appendChild(thumbnail);
        row.appendChild(nameLabel);
        row.appendChild(genderSpan);
        row.appendChild(shareBtn);
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

// Debounced version of renderFishList — coalesces rapid calls within a single animation frame
// to prevent DOM thrashing from continuous slider/input events
let _renderFishListPending = false;
function scheduleRenderFishList() {
  if (_renderFishListPending) return;
  _renderFishListPending = true;
  requestAnimationFrame(() => {
    _renderFishListPending = false;
    renderFishList();
  });
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
  
  const speedSlider = document.getElementById("fish-speed-slider");
  const speedVal = document.getElementById("fish-speed-value");
  if (speedSlider) {
    speedSlider.value = settings.speedMultiplier;
    if (speedVal) speedVal.textContent = settings.speedMultiplier.toFixed(2) + "x";
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

  const schoolingToggle = document.getElementById("schooling-toggle");
  if (schoolingToggle) {
    schoolingToggle.checked = settings.schoolingEnabled;
  }
  const schoolingSlidersContainer = document.getElementById("schooling-sliders-container");
  if (schoolingSlidersContainer) {
    schoolingSlidersContainer.style.display = settings.schoolingEnabled ? "block" : "none";
  }
  const separationSlider = document.getElementById("schooling-separation-slider");
  const separationVal = document.getElementById("schooling-separation-value");
  if (separationSlider) {
    separationSlider.value = settings.schoolingSeparation;
    if (separationVal) separationVal.textContent = settings.schoolingSeparation.toFixed(2);
  }
  const alignmentSlider = document.getElementById("schooling-alignment-slider");
  const alignmentVal = document.getElementById("schooling-alignment-value");
  if (alignmentSlider) {
    alignmentSlider.value = settings.schoolingAlignment;
    if (alignmentVal) alignmentVal.textContent = settings.schoolingAlignment.toFixed(2);
  }
  const cohesionSlider = document.getElementById("schooling-cohesion-slider");
  const cohesionVal = document.getElementById("schooling-cohesion-value");
  if (cohesionSlider) {
    cohesionSlider.value = settings.schoolingCohesion;
    if (cohesionVal) cohesionVal.textContent = settings.schoolingCohesion.toFixed(2);
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
        const restoredFish = new Fish(x, y, vx, vy, p.size || settings.fishSize, p.color || settings.fishColor, p.name, p.visible !== false, p.id, p.gender, p.breedingEnabled, p.isBred, p.isMature !== false, p.birthTime, p.targetRadius, p.birthCity || null, p.birthCountryCode || null);
        if (p.parentInfo) restoredFish.parentInfo = p.parentInfo;
        fishes.push(restoredFish);
      } else {
        fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor, "", true, null, null, true, false, true, null, null, detectedCity || null, detectedCountryCode || null));
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
  fishes.forEach(fish => fish.updateSpeedRange(settings.speedMultiplier));
  saveFishProfiles();
  scheduleRenderFishList();
}

// Setup Settings UI Listeners
function initSettingsUI() {
  const panel = document.getElementById("settings-panel");
  const toggleBtn = document.getElementById("settings-toggle-btn");
  const sizeSlider = document.getElementById("fish-size-slider");
  const sizeVal = document.getElementById("fish-size-value");
  const countSlider = document.getElementById("fish-count-slider");
  const countVal = document.getElementById("fish-count-value");
  const speedSlider = document.getElementById("fish-speed-slider");
  const speedVal = document.getElementById("fish-speed-value");
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
    // Rebuild fish list if it was updated while the panel was closed
    if (_fishListDirty && panel.classList.contains("open")) {
      renderFishList();
    }
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Avoid triggering ripples/food on background click
    togglePanel();
  });

  // Keep clicks inside the settings panel from spawning food/ripples
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Collapsible settings sections toggle
  document.querySelectorAll(".settings-section > .settings-section-title").forEach(header => {
    header.addEventListener("click", () => {
      const section = header.parentElement;
      if (section) {
        section.classList.toggle("collapsed");
      }
    });
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
    scheduleRenderFishList();
  });

  // Fish Count slider listener
  countSlider.addEventListener("input", (e) => {
    const count = parseInt(e.target.value);
    settings.fishCount = count;
    countVal.textContent = count;
    localStorage.setItem("fishy_fishCount", count);
    adjustFishCount(count);
  });

  // Speed slider listener
  if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
      const speed = parseFloat(e.target.value);
      settings.speedMultiplier = speed;
      if (speedVal) speedVal.textContent = speed.toFixed(2) + "x";
      localStorage.setItem("fishy_speedMultiplier", speed);
      fishes.forEach((fish) => {
        fish.updateSpeedRange(speed);
      });
    });
  }

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
    scheduleRenderFishList();
  }

  // Add Fish Button
  const addFishBtn = document.getElementById("add-fish-btn");
  if (addFishBtn) {
    addFishBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const { x, y, vx, vy } = getRandomSpawnPos(150);
      const newFish = new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor, "", true, null, null, true, false, true, null, null, detectedCity || null);
      newFish.updateSpeedRange(settings.speedMultiplier);
      fishes.push(newFish);
      saveFishProfiles();
      renderFishList();
    });
  }

  // Open Presets Button
  const openPresetsBtn = document.getElementById("open-presets-btn");
  if (openPresetsBtn) {
    openPresetsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPresetsModal();
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

  // Schooling Behavior listeners
  const schoolingToggle = document.getElementById("schooling-toggle");
  if (schoolingToggle) {
    schoolingToggle.addEventListener("change", (e) => {
      settings.schoolingEnabled = e.target.checked;
      localStorage.setItem("fishy_schoolingEnabled", e.target.checked);
      const schoolingSlidersContainer = document.getElementById("schooling-sliders-container");
      if (schoolingSlidersContainer) {
        schoolingSlidersContainer.style.display = e.target.checked ? "block" : "none";
      }
    });
  }

  const separationSlider = document.getElementById("schooling-separation-slider");
  const separationVal = document.getElementById("schooling-separation-value");
  if (separationSlider) {
    separationSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      settings.schoolingSeparation = val;
      localStorage.setItem("fishy_schoolingSeparation", val);
      if (separationVal) separationVal.textContent = val.toFixed(2);
    });
  }

  const alignmentSlider = document.getElementById("schooling-alignment-slider");
  const alignmentVal = document.getElementById("schooling-alignment-value");
  if (alignmentSlider) {
    alignmentSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      settings.schoolingAlignment = val;
      localStorage.setItem("fishy_schoolingAlignment", val);
      if (alignmentVal) alignmentVal.textContent = val.toFixed(2);
    });
  }

  const cohesionSlider = document.getElementById("schooling-cohesion-slider");
  const cohesionVal = document.getElementById("schooling-cohesion-value");
  if (cohesionSlider) {
    cohesionSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      settings.schoolingCohesion = val;
      localStorage.setItem("fishy_schoolingCohesion", val);
      if (cohesionVal) cohesionVal.textContent = val.toFixed(2);
    });
  }

  // Dynamic macOS/Windows click-through logic: allow interacting with the settings UI,
  // but let normal mouse clicks pass through completely to access widgets, icons, and shortcuts on your screen!
  if (window.electronAPI) {
    let lastIgnoreState = true;

    // Helper to dynamically update window ignore mouse state
    updateIgnoreMouseEvents = (rawX = null, rawY = null) => {
      if (rawX === null || rawY === null) {
        if (mouse.x !== undefined && mouse.y !== undefined) {
          rawX = mouse.x / resolutionScale;
          rawY = mouse.y / resolutionScale;
        } else {
          rawX = -99999;
          rawY = -99999;
        }
      }
      const isPanelOpen = panel.classList.contains("open");
      const isOverGear = (
        rawX >= window.innerWidth - 64 &&
        rawX <= window.innerWidth - 20 &&
        rawY >= 20 &&
        rawY <= 64
      );
      const isOverPanel = isPanelOpen && (
        rawX >= window.innerWidth - 330 &&
        rawX <= window.innerWidth - 20 &&
        rawY >= 80 &&
        rawY <= 80 + panel.offsetHeight
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
      // Scale by resolutionScale for canvas space
      mouse.x = data.x * resolutionScale;
      mouse.y = data.y * resolutionScale;

      updateIgnoreMouseEvents(data.x, data.y);
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

  // Import Fish Profile button listener
  const importBtn = document.getElementById("import-fish-btn");
  if (importBtn) {
    importBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openImportModal();
    });
  }

  // Open Profiles Folder button listener
  const openFolderBtn = document.getElementById("open-folder-btn");
  if (openFolderBtn) {
    openFolderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.openProfilesFolder) {
        window.electronAPI.openProfilesFolder();
      }
    });
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

// Set canvas to full screen (throttled by resolutionScale to reduce memory/GPU overhead)
canvas.width = window.innerWidth * resolutionScale;
canvas.height = window.innerHeight * resolutionScale;

// Handle window resizing smoothly
window.addEventListener("resize", function () {
  canvas.width = window.innerWidth * resolutionScale;
  canvas.height = window.innerHeight * resolutionScale;
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

// Thumbnail preview cache — avoids re-creating canvases and Fish objects for unchanged color combos
const _previewCache = new Map();

function _previewCacheKey(colorParts, displayRadius) {
  const p = [
    colorParts.head, colorParts.body, colorParts.s1, colorParts.s2,
    colorParts.leftFin, colorParts.rightFin
  ];
  for (const lobe of ['tailLeft', 'tailCenter', 'tailRight']) {
    const arr = Array.isArray(colorParts[lobe]) ? colorParts[lobe] : [colorParts[lobe]];
    for (let i = 0; i < arr.length; i++) p.push(arr[i]);
  }
  p.push(displayRadius);
  return p.join('|');
}

function renderFishPreview(colorParts, displayRadius = 24) {
  const cacheKey = _previewCacheKey(colorParts, displayRadius);
  const cached = _previewCache.get(cacheKey);
  if (cached) return cached;
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
  const dataUrl = cvs.toDataURL();

  // Store in cache; evict oldest entry if cache grows too large
  _previewCache.set(cacheKey, dataUrl);
  if (_previewCache.size > 50) {
    _previewCache.delete(_previewCache.keys().next().value);
  }
  return dataUrl;
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
  nameEl.textContent = (data.name || 'Fish') + genderSym;

  header.appendChild(dot);
  header.appendChild(nameEl);

  if (label) {
    const roleEl = document.createElement('span');
    roleEl.className = 'ft-tree-role';
    const sizeVal = data.radius || data.size;
    const sizeText = sizeVal ? ` • ${sizeVal.toFixed(1)}px` : '';
    roleEl.textContent = label + sizeText;
    header.appendChild(roleEl);
  }

  cardBody.appendChild(header);

  // Color info: full grid for child, compact dot-row for ALL ancestors
  if (depth === 0) {
    // Metadata row: Size & DOB
    const metaRow = document.createElement('div');
    metaRow.className = 'ft-meta-info';

    // Format Size
    const sizeVal = data.radius || data.size;
    const sizeText = sizeVal ? `${sizeVal.toFixed(1)}px` : 'Unknown';
    const sizeEl = document.createElement('span');
    sizeEl.className = 'ft-meta-item';
    sizeEl.innerHTML = `📏 <strong>Size:</strong> ${sizeText}`;
    metaRow.appendChild(sizeEl);

    // Format Birthday
    let birthdayText = 'Unknown';
    if (data.birthTime) {
      const dobDate = new Date(data.birthTime);
      birthdayText = dobDate.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      }).replace(' at ', ' ');
    } else if (data.isBred) {
      birthdayText = 'Bred (Unknown Date)';
    }
    const dobEl = document.createElement('span');
    dobEl.className = 'ft-meta-item';
    dobEl.innerHTML = `🎂 <strong>Birthday:</strong> ${birthdayText}`;
    metaRow.appendChild(dobEl);

    // Format Birthplace
    const birthplaceText = data.birthCity || 'Unknown';
    const flag = getFlagEmoji(data.birthCountryCode);
    const birthplaceDisplay = flag ? `${flag} ${birthplaceText}` : birthplaceText;
    const cityEl = document.createElement('span');
    cityEl.className = 'ft-meta-item';
    cityEl.innerHTML = `📍 <strong>Birthplace:</strong> ${birthplaceDisplay}`;
    metaRow.appendChild(cityEl);

    cardBody.appendChild(metaRow);

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

  const titleEl = overlay.querySelector('.ft-modal-title');
  if (titleEl) {
    if (fishOrProfile.isBred && fishOrProfile.parentInfo) {
      titleEl.innerHTML = '🐟 Fish Profile & Family Tree';
    } else {
      titleEl.innerHTML = '🐟 Fish Profile';
    }
  }

  const content = overlay.querySelector('#ft-tree-content');
  if (!content) return;

  content.innerHTML = '';

  const selfData = {
    name: fishOrProfile.name || 'Fish',
    gender: fishOrProfile.gender,
    colorParts: fishOrProfile.colorParts || fishOrProfile.color,
    radius: fishOrProfile.radius || fishOrProfile.size,
    parentInfo: fishOrProfile.parentInfo || null,
    birthTime: fishOrProfile.birthTime || null,
    birthCity: fishOrProfile.birthCity || null,
    birthCountryCode: fishOrProfile.birthCountryCode || null,
    isBred: fishOrProfile.isBred || false
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
// SHARE & IMPORT INTERACTIONS
// ============================================================

function encodeFishProfile(fishOrProfile) {
  const profile = {
    id: fishOrProfile.id,
    name: (fishOrProfile.name || '').trim(),
    colorParts: fishOrProfile.colorParts || fishOrProfile.color,
    radius: fishOrProfile.radius || fishOrProfile.size,
    gender: fishOrProfile.gender,
    breedingEnabled: fishOrProfile.breedingEnabled !== false,
    isBred: !!fishOrProfile.isBred,
    isMature: fishOrProfile.isMature !== false,
    birthTime: fishOrProfile.birthTime || null,
    birthCity: fishOrProfile.birthCity || null,
    birthCountryCode: fishOrProfile.birthCountryCode || null,
    targetRadius: fishOrProfile.targetRadius || fishOrProfile.radius || fishOrProfile.size,
    parentInfo: fishOrProfile.parentInfo || null
  };
  
  try {
    const jsonStr = JSON.stringify(profile);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    return base64;
  } catch (e) {
    console.error('Failed to encode fish profile:', e);
    return null;
  }
}

function decodeFishProfile(base64) {
  try {
    const jsonStr = decodeURIComponent(escape(atob(base64)));
    const profile = JSON.parse(jsonStr);
    if (profile && typeof profile === 'object' && (profile.colorParts || profile.color)) {
      if (!profile.colorParts && profile.color) {
        profile.colorParts = profile.color;
      }
      return profile;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function openShareModal(fishOrProfile) {
  const overlay = document.getElementById('share-modal-overlay');
  const titleEl = document.getElementById('share-modal-title');
  const contentEl = document.getElementById('share-modal-content');
  if (!overlay || !contentEl) return;

  titleEl.innerHTML = '📤 Share Fish Profile';
  
  const code = encodeFishProfile(fishOrProfile);
  const colorParts = fishOrProfile.colorParts || fishOrProfile.color;
  const name = fishOrProfile.name || 'Fish';
  const gender = fishOrProfile.gender || 'female';
  const genderSym = gender === 'male' ? '♂' : '♀';
  const genderColor = gender === 'male' ? '#60a5fa' : '#f472b6';
  const previewSrc = renderFishPreview(colorParts, 22);

  contentEl.innerHTML = `
    <div class="modal-description">
      Share this unique fish with a friend! Copy the share code below and send it to them.
    </div>
    <div class="share-preview-card">
      <div class="share-preview-img-container">
        <img class="share-preview-img" src="${previewSrc}" alt="Fish Preview" />
      </div>
      <div class="share-preview-info">
        <span class="share-preview-name">
          ${name} <span style="color: ${genderColor}">${genderSym}</span>
        </span>
        <span class="share-preview-meta">
          Size: ${(fishOrProfile.radius || fishOrProfile.size || 12).toFixed(1)}px | 
          ${fishOrProfile.isBred ? 'Bred Generation' : 'Original Genotype'}
        </span>
      </div>
    </div>
    <textarea class="share-code-area" readonly id="share-code-textarea">${code}</textarea>
    <button class="modal-primary-btn" id="share-copy-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Copy Share Code
    </button>
  `;

  overlay.classList.add('open');

  const copyBtn = document.getElementById('share-copy-btn');
  const txtArea = document.getElementById('share-code-textarea');
  if (copyBtn && txtArea) {
    copyBtn.addEventListener('click', () => {
      txtArea.select();
      navigator.clipboard.writeText(txtArea.value).then(() => {
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Copied to Clipboard!
        `;
        copyBtn.classList.add('copied');
        
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy Share Code
          `;
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    });
  }
}

function openImportModal() {
  const overlay = document.getElementById('share-modal-overlay');
  const titleEl = document.getElementById('share-modal-title');
  const contentEl = document.getElementById('share-modal-content');
  if (!overlay || !contentEl) return;

  titleEl.innerHTML = '📥 Import Fish Profile';

  contentEl.innerHTML = `
    <div class="modal-description">
      Paste a fish share code below to inspect its attributes, colors, and genetic lineage before adding it to your pond.
    </div>
    <textarea class="share-code-area" id="import-code-textarea" placeholder="Paste Base64 fish share code here..."></textarea>
    <div id="import-status-msg" class="import-status empty">Waiting for share code...</div>
    
    <div id="import-preview-box" style="display: none; width: 100%;">
      <div class="share-preview-card">
        <div class="share-preview-img-container">
          <img class="share-preview-img" id="import-preview-img" src="" alt="Fish Preview" />
        </div>
        <div class="share-preview-info">
          <span class="share-preview-name" id="import-preview-name"></span>
          <span class="share-preview-meta" id="import-preview-meta"></span>
        </div>
      </div>
    </div>
    
    <button class="modal-primary-btn" id="import-submit-btn" disabled>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Import to Pond
    </button>
  `;

  overlay.classList.add('open');

  const textInput = document.getElementById('import-code-textarea');
  const statusMsg = document.getElementById('import-status-msg');
  const previewBox = document.getElementById('import-preview-box');
  const previewImg = document.getElementById('import-preview-img');
  const previewName = document.getElementById('import-preview-name');
  const previewMeta = document.getElementById('import-preview-meta');
  const submitBtn = document.getElementById('import-submit-btn');

  let decodedProfile = null;

  textInput.addEventListener('input', () => {
    const rawVal = textInput.value.trim();
    if (!rawVal) {
      statusMsg.className = 'import-status empty';
      statusMsg.textContent = 'Waiting for share code...';
      previewBox.style.display = 'none';
      submitBtn.disabled = true;
      decodedProfile = null;
      return;
    }

    decodedProfile = decodeFishProfile(rawVal);
    if (decodedProfile) {
      statusMsg.className = 'import-status success';
      statusMsg.textContent = '✓ Valid fish profile detected!';
      
      const colorParts = decodedProfile.colorParts;
      previewImg.src = renderFishPreview(colorParts, 22);
      
      const genderSym = decodedProfile.gender === 'male' ? '♂' : '♀';
      const genderColor = decodedProfile.gender === 'male' ? '#60a5fa' : '#f472b6';
      previewName.innerHTML = `${decodedProfile.name || 'Fish'} <span style="color: ${genderColor}">${genderSym}</span>`;
      
      let lineageText = decodedProfile.isBred ? 'Bred Generation' : 'Original Genotype';
      if (decodedProfile.parentInfo) {
        lineageText += ' (lineage tree included)';
      }
      previewMeta.textContent = `Size: ${decodedProfile.radius.toFixed(1)}px | ${lineageText}`;
      
      previewBox.style.display = 'block';
      submitBtn.disabled = false;
    } else {
      statusMsg.className = 'import-status error';
      statusMsg.textContent = '✗ Invalid share code. Check for typing errors.';
      previewBox.style.display = 'none';
      submitBtn.disabled = true;
      decodedProfile = null;
    }
  });

  submitBtn.addEventListener('click', () => {
    if (!decodedProfile) return;

    decodedProfile.id = 'fish_' + Math.random().toString(36).substr(2, 9);
    
    const { x, y, vx, vy } = getRandomSpawnPos(150);
    const importedFish = new Fish(
      x, y, vx, vy,
      decodedProfile.radius || settings.fishSize,
      decodedProfile.colorParts,
      decodedProfile.name,
      decodedProfile.visible !== false,
      decodedProfile.id,
      decodedProfile.gender,
      decodedProfile.breedingEnabled,
      decodedProfile.isBred,
      decodedProfile.isMature !== false,
      decodedProfile.birthTime || Date.now(),
      decodedProfile.targetRadius,
      decodedProfile.birthCity || null,
      decodedProfile.birthCountryCode || null
    );
    if (decodedProfile.parentInfo) {
      importedFish.parentInfo = decodedProfile.parentInfo;
    }
    importedFish.updateSpeedRange(settings.speedMultiplier);
    
    fishes.push(importedFish);
    saveFishProfiles();
    renderFishList();

    ripples.push(new Ripple(x, y));
    overlay.classList.remove('open');
  });
}

// ============================================================
// POND PRESETS SYSTEM
// ============================================================

function captureCurrentPond(name) {
  const activeFishes = fishes.map(fish => ({
    id: fish.id,
    name: fish.name,
    color: fish.colorParts || fish.color1,
    size: fish.radius,
    gender: fish.gender,
    breedingEnabled: fish.breedingEnabled,
    isBred: fish.isBred,
    isMature: fish.isMature,
    birthTime: fish.birthTime,
    birthCity: fish.birthCity,
    birthCountryCode: fish.birthCountryCode,
    targetRadius: fish.targetRadius,
    parentInfo: fish.parentInfo
  }));

  return {
    id: 'preset_' + Math.random().toString(36).substr(2, 9),
    name: name.trim(),
    bgColor: settings.bgColor,
    bgOpacity: settings.bgOpacity,
    schoolingEnabled: settings.schoolingEnabled,
    schoolingSeparation: settings.schoolingSeparation,
    schoolingAlignment: settings.schoolingAlignment,
    schoolingCohesion: settings.schoolingCohesion,
    speedMultiplier: settings.speedMultiplier,
    maxCapacity: settings.maxCapacity,
    fishSize: settings.fishSize,
    fishes: activeFishes
  };
}

function loadPondPreset(preset) {
  settings.bgColor = preset.bgColor;
  settings.bgOpacity = preset.bgOpacity;
  settings.speedMultiplier = preset.speedMultiplier || 1.0;
  settings.maxCapacity = preset.maxCapacity || 10;
  settings.schoolingEnabled = preset.schoolingEnabled !== false;
  settings.schoolingSeparation = preset.schoolingSeparation ?? 1.2;
  settings.schoolingAlignment = preset.schoolingAlignment ?? 1.0;
  settings.schoolingCohesion = preset.schoolingCohesion ?? 0.8;
  settings.fishSize = preset.fishSize || 12;
  settings.fishCount = preset.fishes.length;

  localStorage.setItem("fishy_bgColor", settings.bgColor);
  localStorage.setItem("fishy_bgOpacity", settings.bgOpacity);
  localStorage.setItem("fishy_speedMultiplier", settings.speedMultiplier);
  localStorage.setItem("fishy_maxCapacity", settings.maxCapacity);
  localStorage.setItem("fishy_schoolingEnabled", settings.schoolingEnabled);
  localStorage.setItem("fishy_schoolingSeparation", settings.schoolingSeparation);
  localStorage.setItem("fishy_schoolingAlignment", settings.schoolingAlignment);
  localStorage.setItem("fishy_schoolingCohesion", settings.schoolingCohesion);
  localStorage.setItem("fishy_fishSize", settings.fishSize);
  localStorage.setItem("fishy_fishCount", settings.fishCount);

  fishes = [];
  preset.fishes.forEach(p => {
    const { x, y, vx, vy } = getRandomSpawnPos(150);
    const f = new Fish(
      x, y, vx, vy,
      p.size || p.radius || settings.fishSize,
      p.color || settings.fishColor,
      p.name || "",
      p.visible !== false,
      p.id || 'fish_' + Math.random().toString(36).substr(2, 9),
      p.gender,
      p.breedingEnabled !== false,
      !!p.isBred,
      p.isMature !== false,
      p.birthTime || Date.now(),
      p.targetRadius || p.size || p.radius || settings.fishSize,
      p.birthCity || null,
      p.birthCountryCode || null
    );
    if (p.parentInfo) f.parentInfo = p.parentInfo;
    f.updateSpeedRange(settings.speedMultiplier);
    fishes.push(f);
  });

  applyBackgroundSettings();
  syncSettingsUI();
  saveFishProfiles();
  renderFishList();

  fishes.forEach(f => {
    ripples.push(new Ripple(f.x, f.y));
  });
}

function openPresetsModal() {
  const overlay = document.getElementById('presets-modal-overlay');
  const contentEl = document.getElementById('presets-modal-content');
  if (!overlay || !contentEl) return;

  renderPresetsList(contentEl);
  overlay.classList.add('open');
}

function renderPresetsList(contentEl) {
  const presets = JSON.parse(localStorage.getItem('fishy_pondPresets') || '[]');
  
  let libraryHtml = '';
  if (presets.length === 0) {
    libraryHtml = `
      <div class="modal-description" style="text-align: center; margin-top: 20px; margin-bottom: 10px; opacity: 0.6; font-size: 0.82rem;">
        No saved presets yet. Customize your pond and save it above!
      </div>
    `;
  } else {
    libraryHtml = `
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px; max-height: 40vh; overflow-y: auto; padding-right: 4px;">
        ${presets.map(p => {
          // Generate small color dots representing the fish
          const fishDots = (p.fishes || []).map(f => {
            const bodyColor = (f.color && typeof f.color === 'object') ? (f.color.body || '#f0654e') : (f.color || '#f0654e');
            return `<div class="preset-fish-dot" style="background-color: ${bodyColor};" title="${f.name || 'Unnamed Fish'}"></div>`;
          }).slice(0, 8).join(''); // limit dots in UI preview to prevent overflow

          const bgAlpha = Math.max(0.2, (p.bgOpacity || 50) / 100);
          const previewBgStyle = hexToRgba(p.bgColor || '#07111e', bgAlpha);

          return `
            <div class="preset-card" id="card-${p.id}">
              <div class="preset-info">
                <div class="preset-bg-preview" style="background-color: ${previewBgStyle};">
                  <div class="preset-fish-dots">
                    ${fishDots}
                  </div>
                </div>
                <div class="preset-details">
                  <span class="preset-name">${p.name}</span>
                  <span class="preset-meta">${(p.fishes || []).length} Fishes | Bg: ${p.bgColor} (${p.bgOpacity}%)</span>
                </div>
              </div>
              <div class="preset-actions">
                <!-- Apply / Load -->
                <button class="preset-action-btn load-preset-btn" data-id="${p.id}" title="Apply Pond Preset">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
                <!-- Update / Overwrite -->
                <button class="preset-action-btn update-preset-btn" data-id="${p.id}" title="Overwrite with current pond state">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                </button>
                <!-- Delete -->
                <button class="preset-delete-btn delete-preset-btn" data-id="${p.id}" title="Delete Preset">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  contentEl.innerHTML = `
    <div class="modal-description" style="margin-bottom: 12px;">
      Save the current pond configuration as a custom preset to load later.
    </div>
    
    <!-- Save Preset Area -->
    <div class="preset-save-row">
      <div class="preset-save-input-wrapper">
        <input type="text" id="preset-name-input" class="fish-name-input" placeholder="Preset name (e.g. Zen Brown Pond)" style="padding: 7px 10px; font-size: 0.85rem;" />
      </div>
      <button class="modal-primary-btn preset-save-btn" id="save-preset-btn" style="width: auto;">
        Save Current Pond
      </button>
    </div>
    
    <div class="settings-section-title" style="margin-top: 15px; margin-bottom: 5px; font-size: 0.72rem;">Your Presets</div>
    ${libraryHtml}
  `;

  // Save preset handler
  const saveBtn = document.getElementById('save-preset-btn');
  const nameInput = document.getElementById('preset-name-input');
  if (saveBtn && nameInput) {
    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = '#ef4444';
        setTimeout(() => nameInput.style.borderColor = '', 1500);
        return;
      }
      const newPreset = captureCurrentPond(name);
      presets.push(newPreset);
      localStorage.setItem('fishy_pondPresets', JSON.stringify(presets));
      renderPresetsList(contentEl);
    });
    
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });
  }

  // Action listeners
  contentEl.querySelectorAll('.load-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const preset = presets.find(p => p.id === id);
      if (preset) {
        loadPondPreset(preset);
        
        // Success feedback
        btn.classList.add('success-flash');
        setTimeout(() => {
          document.getElementById('presets-modal-overlay')?.classList.remove('open');
        }, 300);
      }
    });
  });

  contentEl.querySelectorAll('.update-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const idx = presets.findIndex(p => p.id === id);
      if (idx !== -1) {
        const name = presets[idx].name;
        // Overwrite preset
        const updated = captureCurrentPond(name);
        updated.id = id; // Keep same ID
        presets[idx] = updated;
        localStorage.setItem('fishy_pondPresets', JSON.stringify(presets));
        
        // Visual success feedback
        btn.classList.add('success-flash');
        setTimeout(() => {
          renderPresetsList(contentEl);
        }, 500);
      }
    });
  });

  contentEl.querySelectorAll('.delete-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const updatedPresets = presets.filter(p => p.id !== id);
      localStorage.setItem('fishy_pondPresets', JSON.stringify(updatedPresets));
      renderPresetsList(contentEl);
    });
  });
}

// ============================================================
// ACTIVE SYSTEMS
// ============================================================

let fishes = [];
let foods = [];
let ripples = [];
let heartParticles = [];
let _visibleFishes = []; // Reusable array to avoid per-frame allocation in animate()

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
  mouse.x = event.clientX * resolutionScale;
  mouse.y = event.clientY * resolutionScale;
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
  const scaledX = event.clientX * resolutionScale;
  const scaledY = event.clientY * resolutionScale;

  // Spawn ripple
  ripples.push(new Ripple(scaledX, scaledY));

  // Spawn food pellet that floats gently in place
  foods.push({
    x: scaledX,
    y: scaledY,
    vx: 0,
    vy: 0,
    radius: 2,
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
      const spawnedFish = new Fish(x, y, vx, vy, profile.size || settings.fishSize, profile.color || settings.fishColor, profile.name, profile.visible !== false, profile.id, profile.gender, profile.breedingEnabled, profile.isBred, profile.isMature !== false, profile.birthTime, profile.targetRadius, profile.birthCity || null, profile.birthCountryCode || null);
      if (profile.parentInfo) spawnedFish.parentInfo = profile.parentInfo;
      fishes.push(spawnedFish);
    });
  } else {
    // Fallback if no active profiles saved yet
    for (let i = 0; i < settings.fishCount; i++) {
      const { x, y, vx, vy } = getRandomSpawnPos(maxAttempts);
      fishes.push(new Fish(x, y, vx, vy, settings.fishSize, settings.fishColor, "", true, null, null, true, false, true, null, null, detectedCity || null, detectedCountryCode || null));
    }
  }

  fishes.forEach(fish => fish.updateSpeedRange(settings.speedMultiplier));
  saveFishProfiles();
  renderFishList();
}

// ============================================================
// ANIMATE — main loop
// ============================================================

let isOnBattery = false;
let isLocked = false;
let lastFrameTime = performance.now();

if (window.electronAPI && window.electronAPI.onPowerStateChange) {
  window.electronAPI.onPowerStateChange((data) => {
    isOnBattery = !!data.isOnBattery;
    isLocked = !!data.isLocked;
  });
}

function animate() {
  requestAnimationFrame(animate);

  if (isLocked) {
    return; // Stop rendering completely when screen is locked
  }

  const now = performance.now();
  const elapsed = now - lastFrameTime;

  // Max 60 FPS on AC power to limit resource waste on high refresh rate (120Hz+) screens.
  // Max 24 FPS on battery power to conserve battery life.
  const targetFps = isOnBattery ? 24 : 60;
  const frameMinTime = 1000 / targetFps;

  if (elapsed < frameMinTime - 1) {
    return; // Skip drawing to throttle frame rate
  }

  // Adjust frame window, preserving timing precision
  lastFrameTime = now - (elapsed % frameMinTime);

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
    if (ripples[i].alpha <= 0) {
      ripples[i] = ripples[ripples.length - 1];
      ripples.pop();
    }
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

  // 4. Resolve physics & feeding (reuse array to avoid per-frame allocation)
  _visibleFishes.length = 0;
  for (let i = 0; i < fishes.length; i++) {
    if (fishes[i].visible !== false) _visibleFishes.push(fishes[i]);
  }
  resolveCollisions(_visibleFishes, fishes.length < settings.maxCapacity);
  resolveFoodCollisions(foods);
  checkFeeding(_visibleFishes, foods, ripples);

  // 4b. Update and draw heart particles (swap-and-pop avoids shifting the array)
  for (let i = heartParticles.length - 1; i >= 0; i--) {
    heartParticles[i].update();
    heartParticles[i].draw(ctx);
    if (heartParticles[i].alpha <= 0) {
      heartParticles[i] = heartParticles[heartParticles.length - 1];
      heartParticles.pop();
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
          childTargetRadius,
          detectedCity || null,
          detectedCountryCode || null
        );
        
        baby.targetRadius = childTargetRadius;
        baby.breedingCooldown = 1800; // newborn cooldown before breeding (30s)

        // Snapshot parent info for the family tree overlay — include each parent's own ancestry
        baby.parentInfo = {
          mother: {
            id: mother.id,
            name: mother.name || 'Fish',
            gender: mother.gender,
            colorParts: JSON.parse(JSON.stringify(mother.colorParts)),
            radius: motherTargetSize,
            birthTime: mother.birthTime || null,
            isBred: !!mother.isBred,
            birthCity: mother.birthCity || null,
            birthCountryCode: mother.birthCountryCode || null,
            parentInfo: mother.parentInfo ? JSON.parse(JSON.stringify(mother.parentInfo)) : null
          },
          father: {
            id: father.id,
            name: father.name || 'Fish',
            gender: father.gender,
            colorParts: JSON.parse(JSON.stringify(father.colorParts)),
            radius: fatherTargetSize,
            birthTime: father.birthTime || null,
            isBred: !!father.isBred,
            birthCity: father.birthCity || null,
            birthCountryCode: father.birthCountryCode || null,
            parentInfo: father.parentInfo ? JSON.parse(JSON.stringify(father.parentInfo)) : null
          }
        };
        
        baby.updateSpeedRange(settings.speedMultiplier);
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
      fish.update(canvas, foods, mouse, mouseIdleFrames, fishes, settings);
      fish.draw(ctx, isSettingsOpen);
    } else {
      fish.update(canvas, [], { x: undefined, y: undefined }, 9999, fishes, settings);
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

// Sync profiles from the disk folder in real-time
async function loadAndSyncProfilesFromFolder() {
  if (window.electronAPI && window.electronAPI.loadProfileFiles) {
    const folderProfiles = await window.electronAPI.loadProfileFiles();
    
    // Identify profiles in settings.fishProfiles that are NOT in folderProfiles
    // and are NOT currently active in the pond, and remove them (since their files were deleted)
    const activeIds = fishes.map(f => f.id);
    let updatedProfiles = settings.fishProfiles.filter(p => {
      if (activeIds.includes(p.id)) return true;
      if (!p.name || p.name.trim() === '') return true;
      return folderProfiles.some(fp => fp.id === p.id);
    });

    let modified = updatedProfiles.length !== settings.fishProfiles.length;

    // Add or update profiles from the folder files
    folderProfiles.forEach(fp => {
      const existingIdx = updatedProfiles.findIndex(p => p.id === fp.id);
      if (existingIdx === -1) {
        const isActive = fishes.some(f => f.id === fp.id);
        updatedProfiles.push({
          ...fp,
          active: isActive
        });
        modified = true;
      } else {
        const existing = updatedProfiles[existingIdx];
        const updated = {
          ...fp,
          active: existing.active
        };
        if (JSON.stringify(existing) !== JSON.stringify(updated)) {
          updatedProfiles[existingIdx] = updated;
          modified = true;
        }
      }
    });

    if (modified) {
      settings.fishProfiles = updatedProfiles;
      localStorage.setItem('fishy_fishProfiles', JSON.stringify(updatedProfiles));

      // Update active fish instances dynamically if properties in files changed
      fishes.forEach(fish => {
        const fp = folderProfiles.find(p => p.id === fish.id);
        if (fp) {
          fish.name = fp.name || '';
          fish.gender = fp.gender || fish.gender;
          if (fp.color) {
            fish.updateColor(fp.color);
          } else if (fp.colorParts) {
            fish.updateColor(fp.colorParts);
          }
          if (fp.size) {
            fish.radius = fp.size;
            fish.targetRadius = fp.targetRadius || fp.size;
          }
        }
      });

      scheduleRenderFishList();
    }
  }
}

// Start folder sync polling
setInterval(loadAndSyncProfilesFromFolder, 1500);
loadAndSyncProfilesFromFolder();

// Family tree overlay: close on backdrop click or Escape key
document.getElementById('family-tree-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeFamilyTree();
});

// Share overlay: close on backdrop click
document.getElementById('share-modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('share-modal-overlay').classList.remove('open');
  }
});

// Presets overlay: close on backdrop click
document.getElementById('presets-modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('presets-modal-overlay').classList.remove('open');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeFamilyTree();
    document.getElementById('share-modal-overlay')?.classList.remove('open');
    document.getElementById('presets-modal-overlay')?.classList.remove('open');
  }
});
