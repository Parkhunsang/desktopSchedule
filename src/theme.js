import { updateGridLayout } from './layout.js';

// Default settings
const DEFAULT_SETTINGS = {
  username: "박훈상",
  bgTheme: "preset-1",
  customBgUrl: "",
  themeMode: "dark", // dark or light
  opacity: 18,
  blur: 24,
  widgets: {
    calendar: true,
    agenda: true,
    tasks: true,
    pomodoro: true,
    notes: true,
    weather: true
  },
  supabaseUrl: "",
  supabaseKey: ""
};

let currentSettings = { ...DEFAULT_SETTINGS };

// Load settings from localStorage
export function loadSettings() {
  const saved = localStorage.getItem("desktop_scheduler_settings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge keys to ensure compatibility with updates
      currentSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        widgets: { ...DEFAULT_SETTINGS.widgets, ...(parsed.widgets || {}) }
      };
    } catch (e) {
      console.error("Failed to parse settings", e);
      currentSettings = { ...DEFAULT_SETTINGS };
    }
  } else {
    currentSettings = { ...DEFAULT_SETTINGS };
  }

  applyAllSettings();
  initSettingsUI();
}

// Save settings to localStorage
export function saveSettings() {
  localStorage.setItem("desktop_scheduler_settings", JSON.stringify(currentSettings));
}

// Apply settings to the DOM
export function applyAllSettings() {
  // 1. Username
  updateGreeting(currentSettings.username);

  // 2. Background
  applyBackground();

  // 3. Glassmorphism
  const root = document.documentElement;
  root.style.setProperty("--glass-opacity", (currentSettings.opacity / 100).toFixed(2));
  root.style.setProperty("--glass-blur", `${currentSettings.blur}px`);

  // 4. Widget visibility
  for (const [widgetId, isVisible] of Object.entries(currentSettings.widgets)) {
    const el = document.getElementById(`widget-${widgetId}`);
    if (el) {
      if (isVisible) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  }

  // 5. Theme Mode (Dark/Light class toggling)
  const isLight = currentSettings.themeMode === "light";
  document.body.classList.toggle("light-mode", isLight);

  updateGridLayout(); // Re-calculate grid columns on app load
}

// Update Greeting Name
function updateGreeting(name) {
  const greetingText = document.getElementById("greeting-text");
  if (greetingText) {
    const hour = new Date().getHours();
    let greet = "안녕하세요";
    if (hour >= 5 && hour < 12) greet = "좋은 아침입니다";
    else if (hour >= 12 && hour < 18) greet = "즐거운 오후입니다";
    else if (hour >= 18 && hour < 22) greet = "편안한 저녁입니다";
    else greet = "오늘 하루도 고생 많으셨습니다";

    greetingText.textContent = `${name || "박훈상"}님, ${greet}!`;
  }
}

// Set theme background class or image
export function applyBackground() {
  const bgWrapper = document.getElementById("desktop-bg");
  if (!bgWrapper) return;

  // Clear previous styles and classes
  bgWrapper.className = "desktop-bg-wrapper";
  bgWrapper.style.backgroundImage = "";

  const mesh = bgWrapper.querySelector(".desktop-bg-mesh");
  if (mesh) mesh.style.display = "block";

  if (currentSettings.customBgUrl) {
    bgWrapper.style.backgroundImage = `url('${currentSettings.customBgUrl}')`;
    bgWrapper.style.backgroundSize = "cover";
    bgWrapper.style.backgroundPosition = "center";
    if (mesh) mesh.style.display = "none"; // Hide mesh overlay for clean photos
  } else {
    // Apply presets
    switch (currentSettings.bgTheme) {
      case "preset-1":
        bgWrapper.classList.add("preset-aurora");
        break;
      case "preset-2":
        bgWrapper.classList.add("preset-sunset");
        break;
      case "preset-3":
        bgWrapper.classList.add("preset-neon");
        break;
      case "preset-4":
        bgWrapper.classList.add("preset-dark");
        break;
      case "preset-5":
        bgWrapper.classList.add("preset-clean");
        break;
      default:
        bgWrapper.classList.add("preset-aurora");
    }
  }
}

// Hook settings values to UI controls
function initSettingsUI() {
  // Username Input
  const nameInput = document.getElementById("username-input");
  if (nameInput) {
    nameInput.value = currentSettings.username;
    nameInput.addEventListener("input", (e) => {
      currentSettings.username = e.target.value;
      updateGreeting(currentSettings.username);
      saveSettings();
    });
  }

  // Preset Wallpaper buttons
  const wallpaperBtns = document.querySelectorAll(".wallpaper-btn");
  wallpaperBtns.forEach(btn => {
    const themeName = btn.dataset.bg;
    // Mark active preset
    if (currentSettings.bgTheme === themeName && !currentSettings.customBgUrl) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }

    btn.addEventListener("click", () => {
      wallpaperBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSettings.bgTheme = themeName;
      currentSettings.customBgUrl = ""; // Reset custom URL

      const customUrlInput = document.getElementById("custom-bg-url");
      if (customUrlInput) customUrlInput.value = "";

      applyBackground();
      saveSettings();
    });
  });

  // Custom Wallpaper URL
  const customUrlInput = document.getElementById("custom-bg-url");
  const applyCustomBtn = document.getElementById("apply-custom-bg");
  if (customUrlInput && applyCustomBtn) {
    customUrlInput.value = currentSettings.customBgUrl;
    applyCustomBtn.addEventListener("click", () => {
      const url = customUrlInput.value.trim();
      currentSettings.customBgUrl = url;
      if (url) {
        wallpaperBtns.forEach(b => b.classList.remove("active"));
      } else {
        // Fallback to active preset button
        const activeBtn = document.querySelector(`.wallpaper-btn[data-bg="${currentSettings.bgTheme}"]`);
        if (activeBtn) activeBtn.classList.add("active");
      }
      applyBackground();
      saveSettings();
    });
  }

  // Opacity Range Slider
  const opacitySlider = document.getElementById("glass-opacity");
  const opacityVal = document.getElementById("opacity-val");
  if (opacitySlider && opacityVal) {
    opacitySlider.value = currentSettings.opacity;
    opacityVal.textContent = `${currentSettings.opacity}%`;
    opacitySlider.addEventListener("input", (e) => {
      const val = e.target.value;
      currentSettings.opacity = val;
      opacityVal.textContent = `${val}%`;
      document.documentElement.style.setProperty("--glass-opacity", (val / 100).toFixed(2));
      saveSettings();
    });
  }

  // Blur Range Slider
  const blurSlider = document.getElementById("glass-blur");
  const blurVal = document.getElementById("blur-val");
  if (blurSlider && blurVal) {
    blurSlider.value = currentSettings.blur;
    blurVal.textContent = `${currentSettings.blur}px`;
    blurSlider.addEventListener("input", (e) => {
      const val = e.target.value;
      currentSettings.blur = val;
      blurVal.textContent = `${val}px`;
      document.documentElement.style.setProperty("--glass-blur", `${val}px`);
      saveSettings();
    });
  }

  // Widget Toggles
  for (const widgetId of Object.keys(currentSettings.widgets)) {
    const toggle = document.getElementById(`toggle-${widgetId}`);
    if (toggle) {
      toggle.checked = currentSettings.widgets[widgetId];
      toggle.addEventListener("change", (e) => {
        const checked = e.target.checked;
        currentSettings.widgets[widgetId] = checked;

        const el = document.getElementById(`widget-${widgetId}`);
        if (el) {
          if (checked) el.classList.remove("hidden");
          else el.classList.add("hidden");
        }
        saveSettings();
        updateGridLayout(); // Re-calculate grid columns on widget toggle
      });
    }
  }
  // Theme Mode Toggles
  const themeBtns = document.querySelectorAll(".theme-mode-toggle-btn");
  themeBtns.forEach(btn => {
    const mode = btn.dataset.mode;
    
    // Set initial active state
    if (currentSettings.themeMode === mode) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    
    btn.addEventListener("click", () => {
      themeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSettings.themeMode = mode;
      
      // Update DOM
      const isLight = mode === "light";
      document.body.classList.toggle("light-mode", isLight);
      
      saveSettings();
    });
  });

  // Supabase Integration Section
  const supabaseUrlInput = document.getElementById("supabase-url-input");
  const supabaseKeyInput = document.getElementById("supabase-key-input");
  const supabaseSaveBtn = document.getElementById("supabase-save-btn");

  if (supabaseUrlInput && supabaseKeyInput && supabaseSaveBtn) {
    supabaseUrlInput.value = currentSettings.supabaseUrl || "";
    supabaseKeyInput.value = currentSettings.supabaseKey || "";

    supabaseSaveBtn.addEventListener("click", () => {
      const url = supabaseUrlInput.value.trim();
      const key = supabaseKeyInput.value.trim();

      currentSettings.supabaseUrl = url;
      currentSettings.supabaseKey = key;
      saveSettings();

      alert("Supabase 연동 설정이 저장되었습니다. 동기화를 반영하기 위해 화면을 새로고침합니다.");
      window.location.reload();
    });
  }

  // Electron App Exit Button
  const exitSection = document.getElementById("electron-only-section");
  const exitBtn = document.getElementById("exit-app-btn");
  if (exitSection) {
    if (window.electronAPI) {
      exitSection.classList.remove("hidden");
      if (exitBtn) {
        exitBtn.addEventListener("click", () => {
          window.electronAPI.exitApp();
        });
      }
    } else {
      exitSection.classList.add("hidden");
    }
  }
}

// Side drawer toggling
export function initSettingsDrawer() {
  const panel = document.getElementById("settings-panel");
  const toggleBtn = document.getElementById("settings-toggle-btn");
  const closeBtn = document.getElementById("close-settings-btn");

  if (panel && toggleBtn && closeBtn) {
    toggleBtn.addEventListener("click", () => {
      panel.classList.remove("hidden");
    });

    closeBtn.addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    // Close on overlay click
    panel.addEventListener("click", (e) => {
      if (e.target === panel) {
        panel.classList.add("hidden");
      }
    });
  }
}
