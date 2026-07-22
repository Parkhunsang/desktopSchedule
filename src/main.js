import './style.css';
import { loadSettings, initSettingsDrawer } from './theme.js';
import { startClockAndWeather } from './weather.js';
import { initCalendar, updateCalendarState } from './calendar.js';
import { initTasks } from './tasks.js';
import { initPomodoro } from './pomodoro.js';
import { initNotes } from './notes.js';
import { getRandomQuote } from './quotes.js';
import { initLayout } from './layout.js';
import { initAuth } from './auth.js';

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const detachedNoteId = urlParams.get("detachedNoteId");

  // 분기: 단독 메모 창인 경우 메인 로딩 생략 및 미니 메모 UI 전용 로드
  if (detachedNoteId) {
    initDetachedNoteWindow(detachedNoteId);
    return;
  }

  console.log("Initializing Glassmorphic Desktop Scheduler Workspace...");

  // 1. Initialise Lucide icons globally first
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // 2. Handle Quote Loader Overlay (Fade-in/out Intro)
  const quoteOverlay = document.getElementById("quote-overlay");
  const quoteText = document.getElementById("quote-text");
  const quoteAuthor = document.getElementById("quote-author");

  if (quoteOverlay && quoteText && quoteAuthor) {
    try {
      const quote = await getRandomQuote();
      quoteText.textContent = quote.text;
      quoteAuthor.textContent = quote.author;
    } catch (e) {
      console.error("Failed to load intro quote", e);
    }

    // Keep the quote visible for 2.2 seconds, then trigger fade-out
    setTimeout(() => {
      quoteOverlay.classList.add("fade-out");
      
      // Completely remove the overlay from DOM after the 600ms transition finishes
      setTimeout(() => {
        quoteOverlay.remove();
      }, 600);
    }, 2200);
  }

  // 3. Load preferences, profiles, wallpaper, transparency settings
  loadSettings();
  initSettingsDrawer();

  // 4. Initialize Auth & System clock/weather
  initCalendar();
  initAuth((user) => {
    updateCalendarState(user);
  });
  startClockAndWeather();

  // 5. Initialise widgets
  initTasks();
  initPomodoro();
  initNotes();
  initLayout(); // Initialize drag & drop and grid layout

  console.log("Desktop Scheduler initialized successfully.");
});

/**
 * Initializes the detached sticky note popup window with full state sync and controls.
 */
function initDetachedNoteWindow(noteId) {
  // Hide main workspace components
  const appContainer = document.getElementById("app");
  const quoteOverlay = document.getElementById("quote-overlay");
  const detachedApp = document.getElementById("detached-note-app");

  if (appContainer) appContainer.style.display = "none";
  if (quoteOverlay) quoteOverlay.style.display = "none";
  if (detachedApp) detachedApp.classList.remove("hidden");

  // Load Lucide icons for close button
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  const textarea = document.getElementById("detached-textarea");
  const windowCard = detachedApp.querySelector(".detached-note-window");
  
  // Set initial color and text
  const refreshNoteData = () => {
    try {
      const notes = JSON.parse(localStorage.getItem("desktop_scheduler_notes")) || [];
      const note = notes.find(n => n.id === noteId);
      if (note) {
        if (textarea && textarea.value !== note.text) {
          textarea.value = note.text;
        }
        if (windowCard) {
          windowCard.className = `detached-note-window glass-card note-${note.color}`;
        }
      } else {
        // If note was deleted from main window, close this window
        closeWindow();
      }
    } catch (e) {
      console.error("Failed to load detached note data", e);
    }
  };

  refreshNoteData();

  // Textarea input sync to localStorage
  if (textarea) {
    textarea.focus();
    textarea.addEventListener("input", (e) => {
      try {
        const notes = JSON.parse(localStorage.getItem("desktop_scheduler_notes")) || [];
        const updated = notes.map(n => {
          if (n.id === noteId) {
            return { ...n, text: e.target.value };
          }
          return n;
        });
        localStorage.setItem("desktop_scheduler_notes", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save note input", err);
      }
    });
  }

  // Color selection sync to localStorage
  const colorDots = document.querySelectorAll("#detached-color-dots .note-dot");
  colorDots.forEach(dot => {
    dot.addEventListener("click", () => {
      const color = dot.dataset.color;
      if (windowCard) {
        windowCard.className = `detached-note-window glass-card note-${color}`;
      }
      try {
        const notes = JSON.parse(localStorage.getItem("desktop_scheduler_notes")) || [];
        const updated = notes.map(n => {
          if (n.id === noteId) {
            return { ...n, color };
          }
          return n;
        });
        localStorage.setItem("desktop_scheduler_notes", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save note color change", err);
      }
    });
  });

  // Cross-window storage listener for real-time bilateral synchronization
  window.addEventListener("storage", (e) => {
    if (e.key === "desktop_scheduler_notes") {
      try {
        const notes = JSON.parse(e.newValue) || [];
        const note = notes.find(n => n.id === noteId);
        if (note && textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          
          textarea.value = note.text;
          if (windowCard) {
            windowCard.className = `detached-note-window glass-card note-${note.color}`;
          }
          
          textarea.setSelectionRange(start, end);
        } else if (!note) {
          // If note is deleted from dashboard
          closeWindow();
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

  // Close Window button
  const closeBtn = document.getElementById("close-detached-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeWindow);
  }

  function closeWindow() {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  }
}

