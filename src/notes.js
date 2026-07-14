let notes = [];

export function initNotes() {
  loadNotes();

  const addNoteBtn = document.getElementById("add-note-btn");
  if (addNoteBtn) {
    addNoteBtn.addEventListener("click", addNewNote);
  }

  // Listen to cross-window storage events for real-time synchronization
  window.addEventListener("storage", (e) => {
    if (e.key === "desktop_scheduler_notes") {
      try {
        notes = JSON.parse(e.newValue) || [];
      } catch (err) {
        console.error("Failed to parse synchronized notes", err);
      }
      
      // Preserve active textarea focus and selection to avoid text cursor jumping
      const activeTextarea = document.activeElement;
      const activeNoteCard = activeTextarea ? activeTextarea.closest(".sticky-note-card") : null;
      const activeNoteId = activeNoteCard ? activeNoteCard.dataset.id : null;
      const cursorStart = activeTextarea ? activeTextarea.selectionStart : null;
      const cursorEnd = activeTextarea ? activeTextarea.selectionEnd : null;
      
      renderNotes();
      
      if (activeNoteId) {
        const restoredCard = document.querySelector(`.sticky-note-card[data-id="${activeNoteId}"]`);
        if (restoredCard) {
          const restoredTextarea = restoredCard.querySelector(".note-textarea");
          if (restoredTextarea) {
            restoredTextarea.focus();
            if (cursorStart !== null && cursorEnd !== null) {
              restoredTextarea.setSelectionRange(cursorStart, cursorEnd);
            }
          }
        }
      }
    }
  });

  renderNotes();
}

function loadNotes() {
  const saved = localStorage.getItem("desktop_scheduler_notes");
  if (saved) {
    try {
      notes = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load notes", e);
      notes = [];
    }
  } else {
    // Default mock notes
    notes = [
      {
        id: "note-1",
        text: "💡 아이디어:\n하루 한 번 하늘 바라보기\n(스트레칭 겸 휴식)",
        color: "yellow",
        createdAt: Date.now() - 50000
      },
      {
        id: "note-2",
        text: "🛒 장보기 목록:\n- 우유, 바나나\n- 닭가슴살 1팩\n- 통밀빵",
        color: "blue",
        createdAt: Date.now() - 10000
      }
    ];
    saveNotesToStorage();
  }
}

function saveNotesToStorage() {
  localStorage.setItem("desktop_scheduler_notes", JSON.stringify(notes));
}

function addNewNote() {
  const newNote = {
    id: "note-" + Date.now(),
    text: "",
    color: getRandomColor(),
    createdAt: Date.now()
  };

  notes.push(newNote);
  saveNotesToStorage();
  renderNotes();
}

function updateNoteText(id, text) {
  notes = notes.map(n => {
    if (n.id === id) {
      return { ...n, text };
    }
    return n;
  });
  saveNotesToStorage();
}

function changeNoteColor(id, color) {
  notes = notes.map(n => {
    if (n.id === id) {
      return { ...n, color };
    }
    return n;
  });
  saveNotesToStorage();
  renderNotes();
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  saveNotesToStorage();
  renderNotes();
}

function renderNotes() {
  const container = document.getElementById("notes-grid");
  if (!container) return;

  container.innerHTML = "";

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="notes-empty">
        <i data-lucide="sticky-note"></i>
        <span>메모를 추가해보세요.</span>
      </div>
    `;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
    return;
  }

  notes.forEach(note => {
    const card = document.createElement("div");
    card.className = `sticky-note-card note-${note.color}`;
    card.dataset.id = note.id;

    card.innerHTML = `
      <textarea class="note-textarea" placeholder="메모를 입력하세요...">${escapeHTML(note.text)}</textarea>
      <div class="note-footer">
        <div class="note-color-dots">
          <span class="note-dot y" data-color="yellow" title="노랑"></span>
          <span class="note-dot p" data-color="pink" title="분홍"></span>
          <span class="note-dot g" data-color="green" title="초록"></span>
          <span class="note-dot b" data-color="blue" title="파랑"></span>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          ${window.electronAPI ? `
            <button class="detach-note-btn" title="바탕화면 메모로 분리">
              <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
            </button>
          ` : ''}
          <button class="delete-note-btn" title="메모 삭제">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;

    // Hook Text Change
    const textarea = card.querySelector(".note-textarea");
    textarea.addEventListener("input", (e) => {
      updateNoteText(note.id, e.target.value);
    });

    // Hook Color Change Dots
    const dots = card.querySelectorAll(".note-dot");
    dots.forEach(dot => {
      dot.addEventListener("click", () => {
        changeNoteColor(note.id, dot.dataset.color);
      });
    });

    // Hook Detach Button (Electron only)
    const detachBtn = card.querySelector(".detach-note-btn");
    if (detachBtn) {
      detachBtn.addEventListener("click", () => {
        if (window.electronAPI) {
          window.electronAPI.detachNote(note.id);
        }
      });
    }

    // Hook Delete button
    const deleteBtn = card.querySelector(".delete-note-btn");
    deleteBtn.addEventListener("click", () => {
      deleteNote(note.id);
    });

    container.appendChild(card);
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function getRandomColor() {
  const colors = ["yellow", "pink", "green", "blue"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
