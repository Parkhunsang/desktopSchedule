const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let windowState = { x: undefined, y: undefined, width: 1280, height: 850, isAlwaysOnBottom: false };

const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');

// Load window position/size state
function loadWindowState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, 'utf8');
      windowState = { ...windowState, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error("Failed to load window state", e);
  }
}

// Save window position/size state
function saveWindowState() {
  try {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      windowState.x = bounds.x;
      windowState.y = bounds.y;
      windowState.width = bounds.width;
      windowState.height = bounds.height;
      fs.writeFileSync(stateFilePath, JSON.stringify(windowState), 'utf8');
    }
  } catch (e) {
    console.error("Failed to save window state", e);
  }
}

function createWindow() {
  loadWindowState();

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Set default dimensions
  let winWidth = windowState.width || 1200;
  let winHeight = windowState.height || 800;

  // Safety clamps: Prevent window size from overflowing screen boundaries (especially portrait displays)
  if (winWidth > screenWidth) {
    winWidth = Math.round(screenWidth * 0.95);
  }
  if (winHeight > screenHeight) {
    winHeight = Math.round(screenHeight * 0.95);
  }

  let winX = windowState.x;
  let winY = windowState.y;

  // Center window on screen if coordinates are undefined or out of display bounds
  if (winX === undefined || winX + winWidth > screenWidth || winX < 0) {
    winX = Math.round((screenWidth - winWidth) / 2);
  }
  if (winY === undefined || winY + winHeight > screenHeight || winY < 0) {
    winY = Math.round((screenHeight - winHeight) / 2);
  }

  // Update internal state
  windowState.x = winX;
  windowState.y = winY;
  windowState.width = winWidth;
  windowState.height = winHeight;

  mainWindow = new BrowserWindow({
    x: winX,
    y: winY,
    width: winWidth,
    height: winHeight,
    minWidth: 900,
    minHeight: 600,
    frame: false, // frameless window
    transparent: true, // transparent window for glassmorphism
    skipTaskbar: true, // hide from taskbar
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js') // secure preload
    }
  });

  // Apply always-on-bottom if saved
  if (windowState.isAlwaysOnBottom) {
    mainWindow.setAlwaysOnBottom(true);
  }

  // Load URL
  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/');
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      // Fallback if built folder doesn't exist
      mainWindow.loadURL('http://localhost:5173/');
    }
  }

  // Save state on move / resize
  mainWindow.on('move', saveWindowState);
  mainWindow.on('resize', saveWindowState);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create Tray Icon with a Base64-embedded PNG (16x16 calendar-style icon)
function createTray() {
  // 16x16 Calendar-like icon Base64 (blue folder/calendar box with white header)
  const iconBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAApUlEQVR42mNgGAWjYBSMglEwCggB8T8SBpFxwH8Q' +
    'mICMH0wzMDAw/GdEMeA/GMDwHwID+cEAWY2BMRjBQDNgGBkgqzGwBhMezYBhZIDsxgAbTFA0Axn2gzCY8GgGDCcD' +
    'ZBMF2DSDCSuQYdMMJqxAhk0zmLACGTbNYMIKZMvC/xgYGBj+E5k2wOQ+kM/AoI0wA5H+h+AEMuN+EAaD/wyjYBSM' +
    'glEwcAAAsJ05rQf15E8AAAAASUVORK5CYII=';

  const iconBuffer = Buffer.from(iconBase64, 'base64');
  const image = nativeImage.createFromBuffer(iconBuffer);

  tray = new Tray(image);
  tray.setToolTip('Workspace Desktop Scheduler');

  updateTrayMenu();

  // Double click tray icon to toggle visibility
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '보이기 / 숨기기',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: '위젯 항상 위에 고정',
      type: 'checkbox',
      checked: mainWindow ? mainWindow.isAlwaysOnTop() : false,
      click: (menuItem) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(menuItem.checked);
          if (menuItem.checked) {
            mainWindow.setAlwaysOnBottom(false);
            windowState.isAlwaysOnBottom = false;
            saveWindowState();
          }
          updateTrayMenu();
        }
      }
    },
    {
      label: '바탕화면 모드 (항상 아래)',
      type: 'checkbox',
      checked: windowState.isAlwaysOnBottom,
      click: (menuItem) => {
        if (mainWindow) {
          windowState.isAlwaysOnBottom = menuItem.checked;
          mainWindow.setAlwaysOnBottom(menuItem.checked);
          if (menuItem.checked) {
            mainWindow.setAlwaysOnTop(false);
          }
          saveWindowState();
          updateTrayMenu();
        }
      }
    },
    { type: 'separator' },
    {
      label: '프로그램 종료',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// Electron lifecycle hooks
app.whenReady().then(() => {
  // Create preload file dynamically to keep it self-contained
  createPreloadScript();

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Listen for close/exit IPC commands from frontend UI
ipcMain.on('exit-app', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.on('detach-note', (event, noteId) => {
  const isDev = process.argv.includes('--dev');
  
  const subWindow = new BrowserWindow({
    width: 280,
    height: 280,
    minWidth: 200,
    minHeight: 200,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js')
    }
  });

  if (isDev) {
    subWindow.loadURL(`http://localhost:5173/?detachedNoteId=${noteId}`);
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    subWindow.loadURL(`file://${indexPath}?detachedNoteId=${noteId}`);
  }
});

ipcMain.on('close-window', (event) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  if (win) {
    win.close();
  }
});

// Helper: Dynamically creates preload script
function createPreloadScript() {
  const preloadPath = path.join(__dirname, 'electron-preload.js');
  const code = `
    const { contextBridge, ipcRenderer } = require('electron');
    contextBridge.exposeInMainWorld('electronAPI', {
      exitApp: () => ipcRenderer.send('exit-app'),
      detachNote: (noteId) => ipcRenderer.send('detach-note', noteId),
      closeWindow: () => ipcRenderer.send('close-window')
    });
  `;
  fs.writeFileSync(preloadPath, code, 'utf8');
}
