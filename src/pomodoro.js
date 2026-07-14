// Default timer presets in seconds
const DEFAULT_PRESETS = [
  { id: "pomodoro", label: "집중 시간", duration: 25 * 60 },
  { id: "short", label: "짧은 휴식", duration: 5 * 60 },
  { id: "long", label: "긴 휴식", duration: 15 * 60 }
];

let presets = [];
let activePresetId = "pomodoro";
let totalDuration = 25 * 60;
let timeLeft = totalDuration;
let timerInterval = null;
let isRunning = false;

// SVG Circular progress details
const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Web Audio API context for alarm chime
let audioCtx = null;

export function initPomodoro() {
  const startBtn = document.getElementById("timer-start-btn");
  const resetBtn = document.getElementById("timer-reset-btn");
  const progressCircle = document.getElementById("pomodoro-progress");

  // Load presets from localStorage
  loadPresets();

  // Setup circle dasharray
  if (progressCircle) {
    progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    progressCircle.style.strokeDashoffset = 0; // Filled initially
  }

  // Hook Preset Select Dropdown
  const selectEl = document.getElementById("timer-preset-select");
  if (selectEl) {
    renderPresetDropdown();
    selectEl.addEventListener("change", handlePresetChange);
  }

  // Hook Start/Pause button
  if (startBtn) {
    startBtn.addEventListener("click", toggleTimer);
  }

  // Hook Reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", resetTimer);
  }

  // Hook Timer Alert Modal close buttons
  const timerAlertModal = document.getElementById("timer-alert-modal");
  const timerAlertCloseBtn = document.getElementById("timer-alert-close-btn");
  if (timerAlertCloseBtn && timerAlertModal) {
    timerAlertCloseBtn.addEventListener("click", () => {
      timerAlertModal.classList.add("hidden");
    });
    timerAlertModal.addEventListener("click", (e) => {
      if (e.target === timerAlertModal) {
        timerAlertModal.classList.add("hidden");
      }
    });
  }

  // Hook Preset Manager Modal
  const managePresetsBtn = document.getElementById("timer-presets-manage-btn");
  const presetsModal = document.getElementById("timer-presets-modal");
  const closePresetsModalBtn = document.getElementById("close-presets-modal-btn");
  const addPresetForm = document.getElementById("add-preset-form");

  if (managePresetsBtn && presetsModal) {
    managePresetsBtn.addEventListener("click", () => {
      hidePresetModalError();
      renderPresetsList();
      presetsModal.classList.remove("hidden");
    });
  }

  if (closePresetsModalBtn && presetsModal) {
    closePresetsModalBtn.addEventListener("click", () => {
      hidePresetModalError();
      presetsModal.classList.add("hidden");
    });
    presetsModal.addEventListener("click", (e) => {
      if (e.target === presetsModal) {
        hidePresetModalError();
        presetsModal.classList.add("hidden");
      }
    });
  }

  if (addPresetForm) {
    addPresetForm.addEventListener("submit", handleAddPreset);
  }

  // Request system notification permission on load
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  updateTimerDisplay();
}

function loadPresets() {
  const savedPresets = localStorage.getItem("desktop_scheduler_timer_presets");
  if (savedPresets) {
    try {
      presets = JSON.parse(savedPresets);
    } catch (e) {
      console.error("Failed to parse timer presets", e);
      presets = [...DEFAULT_PRESETS];
    }
  } else {
    presets = [...DEFAULT_PRESETS];
  }

  const savedActiveId = localStorage.getItem("desktop_scheduler_active_preset");
  if (savedActiveId && presets.some(p => p.id === savedActiveId)) {
    activePresetId = savedActiveId;
  } else {
    activePresetId = presets[0]?.id || "pomodoro";
  }

  const activePreset = presets.find(p => p.id === activePresetId);
  totalDuration = activePreset ? activePreset.duration : (25 * 60);
  timeLeft = totalDuration;
}

function savePresets() {
  localStorage.setItem("desktop_scheduler_timer_presets", JSON.stringify(presets));
}

function saveActivePresetId() {
  localStorage.setItem("desktop_scheduler_active_preset", activePresetId);
}

function renderPresetDropdown() {
  const selectEl = document.getElementById("timer-preset-select");
  if (!selectEl) return;

  selectEl.innerHTML = "";
  presets.forEach(preset => {
    const opt = document.createElement("option");
    opt.value = preset.id;
    opt.textContent = `${preset.label} (${Math.floor(preset.duration / 60)}분)`;
    if (preset.id === activePresetId) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

function handlePresetChange(e) {
  const selectedId = e.target.value;
  switchPreset(selectedId);
}

function switchPreset(presetId) {
  stopTimer();
  activePresetId = presetId;
  saveActivePresetId();
  
  const activePreset = presets.find(p => p.id === activePresetId);
  if (activePreset) {
    totalDuration = activePreset.duration;
    timeLeft = totalDuration;
  }
  updateTimerDisplay();
}

function renderPresetsList() {
  const container = document.getElementById("presets-list-container");
  if (!container) return;

  container.innerHTML = "";
  
  if (presets.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px;">등록된 타이머가 없습니다.</div>`;
    return;
  }

  presets.forEach(preset => {
    const item = document.createElement("div");
    item.className = "preset-item";
    
    // Info
    const info = document.createElement("div");
    info.className = "preset-item-info";
    
    const label = document.createElement("span");
    label.className = "preset-item-label";
    label.textContent = preset.label;
    
    const duration = document.createElement("span");
    duration.className = "preset-item-duration";
    duration.textContent = `${Math.floor(preset.duration / 60)}분 (${preset.duration}초)`;
    
    info.appendChild(label);
    info.appendChild(duration);
    item.appendChild(info);
    
    // Delete Button
    const delBtn = document.createElement("button");
    delBtn.className = "delete-preset-btn";
    delBtn.title = "삭제";
    delBtn.innerHTML = `<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>`;
    
    delBtn.addEventListener("click", () => {
      deletePreset(preset.id);
    });
    
    item.appendChild(delBtn);
    container.appendChild(item);
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function deletePreset(id) {
  if (presets.length <= 1) {
    showPresetModalError("최소 한 개의 타이머 설정은 존재해야 합니다.");
    return;
  }
  
  presets = presets.filter(p => p.id !== id);
  savePresets();
  
  if (activePresetId === id) {
    activePresetId = presets[0].id;
    saveActivePresetId();
    switchPreset(activePresetId);
  }
  
  renderPresetDropdown();
  renderPresetsList();
}

function handleAddPreset(e) {
  e.preventDefault();
  hidePresetModalError();
  
  const labelInput = document.getElementById("new-preset-label");
  const durationInput = document.getElementById("new-preset-duration");
  if (!labelInput || !durationInput) return;
  
  const label = labelInput.value.trim();
  const minutes = parseInt(durationInput.value);
  
  if (!label || isNaN(minutes) || minutes <= 0) return;
  
  const newPreset = {
    id: `preset-${Date.now()}`,
    label: label,
    duration: minutes * 60
  };
  
  presets.push(newPreset);
  savePresets();
  
  // Clear inputs
  labelInput.value = "";
  durationInput.value = "";
  
  // Update UI
  renderPresetDropdown();
  renderPresetsList();
}

function toggleTimer() {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (isRunning) return;
  
  // Initialize audio context on user gesture
  initAudioContext();
  
  isRunning = true;
  updateControlsUI();
  
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      timeLeft = 0;
      stopTimer();
      playAlarmChime();
      showTimerCompletionAlert();
      resetTimer();
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateControlsUI();
}

function stopTimer() {
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateControlsUI();
}

function resetTimer() {
  stopTimer();
  timeLeft = totalDuration;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const digitsEl = document.getElementById("timer-digits");
  const progressCircle = document.getElementById("pomodoro-progress");

  if (!digitsEl) return;

  // Format MM:SS
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  digitsEl.textContent = `${mins}:${secs}`;

  // Update SVG Ring offset
  if (progressCircle) {
    const percent = timeLeft / totalDuration;
    // Offset starts at 0 (full) and goes to CIRCUMFERENCE (empty)
    const offset = CIRCUMFERENCE * (1 - percent);
    progressCircle.style.strokeDashoffset = offset;
  }
}

function updateControlsUI() {
  const startBtn = document.getElementById("timer-start-btn");
  if (!startBtn) return;

  if (isRunning) {
    startBtn.innerHTML = `<i data-lucide="pause"></i> 일시정지`;
    startBtn.style.background = "rgba(255, 255, 255, 0.2)";
  } else {
    startBtn.innerHTML = `<i data-lucide="play"></i> 시작`;
    startBtn.style.background = "rgba(255, 255, 255, 0.1)";
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function getActivePresetLabel() {
  const activePreset = presets.find(p => p.id === activePresetId);
  return activePreset ? activePreset.label : "타이머";
}

function showTimerCompletionAlert() {
  const label = getActivePresetLabel();
  const title = `${label} 완료!`;
  const message = activePresetId === "pomodoro"
    ? "집중 시간이 끝났습니다! 잠시 휴식을 취해보세요."
    : `[${label}] 시간이 종료되었습니다!`;

  // 1. Show custom in-app modal
  const modal = document.getElementById("timer-alert-modal");
  const titleEl = document.getElementById("timer-alert-title");
  const messageEl = document.getElementById("timer-alert-message");

  if (modal && titleEl && messageEl) {
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove("hidden");
    
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // 2. Show native HTML5 notification
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body: message,
      silent: true
    });
  }
}

// Lazy-load audio context
function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Synthesize a premium custom notification chime using Web Audio API
function playAlarmChime() {
  try {
    initAudioContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    // Chime tone 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now); // C5 note
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5 note
    
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    // Chime tone 2 (delayed offset)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15); // E5 note
    osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3); // C6 note
    
    gain2.gain.setValueAtTime(0, now + 0.15);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.61);

    osc2.start(now + 0.15);
    osc2.stop(now + 0.81);
  } catch (e) {
    console.error("Audio synthesiser failure", e);
  }
}

function showPresetModalError(message) {
  const errorEl = document.getElementById("preset-modal-error");
  const errorTextEl = document.getElementById("preset-modal-error-text");
  if (errorEl && errorTextEl) {
    errorTextEl.textContent = message;
    errorEl.classList.remove("hidden");
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

function hidePresetModalError() {
  const errorEl = document.getElementById("preset-modal-error");
  if (errorEl) {
    errorEl.classList.add("hidden");
  }
}
