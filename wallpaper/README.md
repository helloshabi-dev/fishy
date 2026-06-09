# 🐠 Fishy Live Wallpaper

This is a standalone, cross-platform live desktop wallpaper application built with Electron. It runs your gorgeous interactive canvas fish animation directly behind all open windows, sitting elegantly on your desktop background layer.

---

## 🚀 How to Run (Development)

First, make sure you have [Node.js](https://nodejs.org/) installed.

1. Navigate to this directory in your terminal:
   ```bash
   cd wallpaper
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the live wallpaper:
   ```bash
   npm start
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

*Note: Due to platform packaging rules, it is highly recommended to run the build command on the target operating system (build on Windows for the `.exe`, and on macOS for the `.dmg`). Alternatively, you can push this to a free GitHub repository and use GitHub Actions to build both automatically!*

---

## 🎨 Personalizing the Wallpaper Background

By default, the wallpaper uses the minimalist white background from your web project. If you'd like a immersive, relaxing dark-mode aquarium vibe:

1. Open `fish/main.js` (inside this `wallpaper/` directory).
2. Find this line:
   ```javascript
   document.body.style.backgroundColor = "#ffffff";
   ```
3. Change it to a deep ocean blue or midnight dark color:
   ```javascript
   document.body.style.backgroundColor = "#07111e";
   ```
4. Also find and change the redraw fill inside `animate()`:
   ```javascript
   ctx.fillStyle = "#ffffff";
   ```
   to:
   ```javascript
   ctx.fillStyle = "#07111e";
   ```

---

## 🎨 Application Icon

The application icon is dynamically generated using the exact same vector fish graphics drawing code from the application!

To generate or rebuild the app icon:
```bash
npm run generate-icon
```
This runs a headless Electron process to render the fish canvas to `build/icon.png`, which is automatically detected and packaged by `electron-builder` during builds.
