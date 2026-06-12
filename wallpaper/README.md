# 🐠 Fishy Live Wallpaper

This is a standalone, cross-platform live desktop wallpaper application built with Electron. It runs your gorgeous interactive canvas fish animation directly behind all open windows, sitting elegantly on your desktop background layer.

---

## 🎮 How to Use the App

### Controls & Navigation
*   **Open Settings (S / Cmd+Alt+S)**: Press the **S** key on your keyboard or use the shortcut **Cmd+Alt+S** to toggle the Wallpaper Settings panel. You can also click the gear icon floating on the screen.
*   **Interactive Feeding**: Click anywhere on the desktop to drop food. Watch the nearest fish detect the food, chase it down, and snack on it!
*   **Settings Panel Sections**:
    *   **Global Controls**: Adjust the global fish size, speed, and breeding limits.
    *   **Active Fish List**: View and customize each fish currently swimming. Customize their name, size, gender, color, and toggles.
    *   **Fish Friends (Saved Library)**: A library of saved named fish. Re-add them to the aquarium, inspect their lineage, or view their custom features.

### Managing Your Aquarium
*   **Naming a Fish**: Type a name in the text field next to an active fish.
*   **Fish Count (Base Population)**: Use the **Fish Count** slider to set the target base population of fish that spawn automatically. If you decrease this slider, unnamed fish are removed. If you increase this slider, new fish are spawned.
*   **Max Capacity (Breeding Limit)**: Use the **Max Capacity** slider to set the absolute limit of fish allowed in the aquarium (default 10, up to 30). Breeding will automatically stop once this capacity is reached.
*   **Saving to Library**: If you delete a named fish from the active list, it is retired to the "Fish Friends" library, preserving its genetics and lineage. Deleting an unnamed fish discards it completely.

---

## 💖 Fish Breeding & Genetics Guide

The aquarium features a fully-simulated genetics, breeding, and lineage system.

### Breeding Requirements
To breed two fish, they must meet the following criteria:
1.  **Opposite Genders**: One fish must be **Male** (`♂`, blue indicator) and the other **Female** (`♀`, pink indicator).
2.  **Breeding Enabled**: Both parent fish must have breeding enabled. In the Settings panel, verify that their breeding status is toggled to **💖** (enabled) rather than **🖤** (disabled).
3.  **Maturity**: Both fish must be fully mature. Babies cannot breed until they grow to their mature target size.
4.  **Ready Cooldown**: Neither fish can be in breeding cooldown. Toggling breeding or giving birth sets a temporary cooldown.
5.  **Proximity**: When two eligible, mature, opposite-gender fish bump into each other while swimming, they will halt, float together, and spawn floating heart particles. After **2 seconds**, a newborn baby fish is born!
6.  **Available Capacity**: The newborn baby fish requires an open slot in the pond to be born. The global **Max Capacity** slider in the Settings panel defines this limit (ranging up to 30). If the number of active fish currently swimming is equal to or greater than the Max Capacity, breeding will be disabled. To allow breeding, simply drag the **Max Capacity** slider to a value higher than the current active fish count (for example, setting capacity to 5 while you have 2 active fish).

### Genetic Inheritance (Genetics)
Newborn baby fish inherit a mixture of traits from both parents:
*   **Body Part Colors**: The baby's head, body, segment 1, segment 2, left fin, and right fin colors are determined by selecting either the mother's or father's corresponding part color at random (50% chance each).
*   **Tail Lobe Patterns**: The tail features three distinct lobes (left, center, and right), each consisting of 5 vertical segments. Each segment independently inherits its color from the corresponding segment of the mother's or father's tail (50% chance each), resulting in a beautiful, genetically mixed striped or pattern tail!
*   **Mature Size**: The baby starts small (radius 6) and gradually grows. Its mature target size (`targetRadius`) is chosen randomly between the mother's mature size and the father's mature size.

### Lineage & Family Tree
Every bred fish carries a digital lineage record. Click the **Lineage Icon** (next to a saved or active bred fish) to open the **Family Tree Overlay**.
*   View the fish's mother and father, their grandparents, and ancestral records infinitely back in time.
*   Use the collapsible toggle buttons (`▸` / `▾`) to expand or hide grandparent branches.

---

## 🚀 How to Run (Development)

First, make sure you have [Node.js](https://nodejs.org/) installed.

1.  Navigate to this directory in your terminal:
    ```bash
    cd wallpaper
    ```
2.  Install the dependencies:
    ```bash
    pnpm install  # or npm install
    ```
3.  Start the live wallpaper:
    ```bash
    pnpm start    # or npm start
    ```

---

## 🛠️ How to Package & Share with Friends

You can package this live wallpaper into a single executable (`.exe` for Windows, `.dmg` / `.app` for macOS) that you can send to your friends. They won't need to install Node.js or run any terminal commands!

### Build for macOS (`.dmg`)
Run the following command on a Mac:
```bash
npm run dist
```
This will compile a `.dmg` installer inside the `dist/` directory.

### Build for Windows (`.exe`)
Run the following command on a Windows machine:
```bash
npm run dist
```
This will compile a standalone installer `.exe` inside the `dist/` directory.

---

## 🎨 Application Icon

The application icon is dynamically generated using the exact same vector fish graphics drawing code from the application!
To generate or rebuild the app icon:
```bash
npm run generate-icon
```
This runs a headless Electron process to render the fish canvas to `build/icon.png`, which is automatically detected and packaged by `electron-builder` during builds.

---

## 📜 Version History (Changelog)

### **v4.1.0** (Current Version)
*   **Swim Speed Control**: Added a swim speed slider in settings to adjust fish swimming speed in real time.
*   **Dynamic Schooling Sliders**: Schooling weight sliders are now dynamically hidden when schooling behavior is disabled, keeping the settings interface clean.
*   **Parent Size in Family Tree**: Lineage view now displays parent size details next to roles.
*   **Improved Resolution**: Set canvas rendering back to full resolution (1.0 scale) for sharper, crisper visuals.

### **v4.0.1**
*   **Performance & Memory Optimizations**: Added battery-conscious framerate throttling (60fps on AC / 24fps on battery), auto-pause rendering on screen lock, disabled unnecessary speech APIs and software rasterizer, and optimized rendering arrays to reduce garbage-collection overhead.
*   **Wall Avoidance & Feeding Fixes**: Resolved bugs preventing fish from reaching food close to walls and stopped fish from getting stuck in endless circling loops near the boundaries.

### **v4.0.0**
*   **Size-Based Speed Scaling**: Adjusted the fish speed range dynamically according to their size. Larger fish swim faster with more power, while smaller fish (and growing babies) swim at slower, gentler speeds.
*   **Detailed Fish Profiles on Thumbnail Click**: Click any fish thumbnail in the settings panel to open a clean card displaying its name, gender, size, date of birth (DOB), origin details, and full parentage lineage.
*   **Fish Configuration Sharing**: Added the ability to export and import fish profiles (DNA/configurations) to easily share your custom-bred fish with friends.

### **v3.2.0**
*   **Schooling Behavior**: Introduced realistic top-view schooling (flocking) behavior to the fish using Craig Reynolds' Boids algorithm (Cohesion, Alignment, and Separation).
*   **Customizable Schooling Weights**: Added a "Schooling Behavior" section to the settings panel to toggle schooling and adjust the influence weights of Cohesion, Separation, and Alignment in real-time.
*   **Pellet-to-Pellet Physics**: Implemented physical collisions for food pellets, pushing overlapping pellets apart with drift-offset compensation and exact spawn jitter protection to prevent visual clustering.

### **v3.1.0**
*   **Saved Fish Persistence**: The app now remembers all your active fish (including their names, sizes, custom colors, and family lineage) when you close and reopen the app, so your favorite fish are never lost.
*   **Separate Breeding Limit Control**: Added a **Max Capacity** slider to set the maximum allowed fish in your pond, making it easy to save slots for baby fish to breed naturally without needing to manually delete active fish.
*   **High-Definition Previews**: Preview thumbnails are now rounded, borderless, and rendered in high definition so they look extremely crisp and clear on all screens.
*   **Clean Saved Library**: Deleting unnamed fish now completely removes them, keeping your "Fish Friends" list clean and organized only with the fish you explicitly named.
*   **Improved Family Tree Layout**: The parent and grandparent preview containers inside the family tree are now perfectly aligned squares that scale cleanly when you expand branches.

### **v3.0.0**
*   **Fish Breeding System**: Fish now have genders (Male `♂` / Female `♀`). If you enable breeding (💖) and two mature, opposite-gender fish meet, they will halt, spawn heart particles, and breed a baby fish!
*   **Genetic Color Inheritance**: Babies inherit traits from their parents! The color of their body parts (head, body, fins, and segment-by-segment tail colors) is passed down randomly from the mother or father, resulting in beautiful new color mixes.
*   **Saved Library ("Fish Friends")**: Retired named fish are kept in your personal "Fish Friends" library, letting you store your custom breeds and keep them as companions.
*   **Interactive Family Tree**: View the ancestral history of any bred fish. Clicking the lineage button shows an interactive overlay mapping out mothers, fathers, grandparents, and ancestors with collapsible branches.

### **v2.1.0**
*   **Interactive Feeding & Water Ripples**: Click anywhere on your desktop to drop food! Nearest fish will chase and eat the pellets. Moving the mouse now creates relaxing, subtle water ripples.
*   **Enhanced Swimming Physics**: Tail and fin animations are smoother and behave like real Koi fish.
*   **Individual Customization**: You can now rename, scale, and color-pick individual fish in real time from the Settings list.

### **v2.0.0**
*   **Desktop App Packaging**: Wrapped the wallpaper simulation into an independent desktop application for Windows (`.exe`) and macOS (`.dmg`) so it can be installed and run easily.
*   **Wallpaper Background Customization**: Added options to personalize the background theme and transparency of your virtual pond.

### **v1.0.0**
*   **Initial Release**: Introduced the interactive canvas fish pond simulation featuring smooth, procedurally animated fish swimming naturally on your desktop background layer.
