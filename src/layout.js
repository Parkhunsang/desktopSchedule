let draggedElement = null;

const DEFAULT_LAYOUT = {
  "col-left": ["widget-calendar", "widget-agenda"],
  "col-center": ["widget-tasks"],
  "col-right": ["widget-pomodoro", "widget-notes"]
};

/**
 * Initializes Drag & Drop for widget cards and updates responsive layout
 */
export function initLayout() {
  loadAndApplyLayout();
  bindDragEvents();
  updateGridLayout();
}

/**
 * Loads layout configuration and rearranges widget DOM nodes accordingly
 */
function loadAndApplyLayout() {
  let layout = { ...DEFAULT_LAYOUT };
  const saved = localStorage.getItem("desktop_scheduler_layout");
  
  if (saved) {
    try {
      layout = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load layout from storage", e);
      layout = { ...DEFAULT_LAYOUT };
    }
  }

  // Rearrange DOM nodes based on layout config
  for (const [columnId, widgetIds] of Object.entries(layout)) {
    const columnEl = document.querySelector(`.${columnId}`);
    if (!columnEl) continue;

    widgetIds.forEach(id => {
      const widgetEl = document.getElementById(id);
      if (widgetEl) {
        columnEl.appendChild(widgetEl);
      }
    });
  }
}

/**
 * Saves current layout DOM order to localStorage
 */
function saveLayoutToStorage() {
  const layout = {
    "col-left": getWidgetIdsInColumn("col-left"),
    "col-center": getWidgetIdsInColumn("col-center"),
    "col-right": getWidgetIdsInColumn("col-right")
  };
  localStorage.setItem("desktop_scheduler_layout", JSON.stringify(layout));
}

function getWidgetIdsInColumn(columnClass) {
  const columnEl = document.querySelector(`.${columnClass}`);
  if (!columnEl) return [];
  
  return Array.from(columnEl.children)
    .filter(child => child.classList.contains("widget-card"))
    .map(child => child.id);
}

/**
 * Binds HTML5 Drag and Drop events to widget cards and columns
 */
function bindDragEvents() {
  const widgets = document.querySelectorAll(".widget-card");
  const columns = document.querySelectorAll(".grid-column");

  widgets.forEach(widget => {
    // Drag Start
    widget.addEventListener("dragstart", (e) => {
      draggedElement = widget;
      widget.classList.add("dragging");
      e.dataTransfer.setData("text/plain", widget.id);
      e.dataTransfer.effectAllowed = "move";
    });

    // Drag End
    widget.addEventListener("dragend", () => {
      widget.classList.remove("dragging");
      widgets.forEach(w => w.classList.remove("drag-over"));
      columns.forEach(c => c.classList.remove("drag-over"));
      draggedElement = null;
      saveLayoutToStorage();
    });

    // Drag Over widget
    widget.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      
      if (draggedElement && draggedElement !== widget) {
        widget.classList.add("drag-over");
      }
    });

    // Drag Leave widget
    widget.addEventListener("dragleave", () => {
      widget.classList.remove("drag-over");
    });

    // Drop on widget
    widget.addEventListener("drop", (e) => {
      e.preventDefault();
      widget.classList.remove("drag-over");

      if (!draggedElement || draggedElement === widget) return;

      const column = widget.parentElement;
      if (!column) return;

      // Determine drop position (above or below centered Y line)
      const rect = widget.getBoundingClientRect();
      const mouseY = e.clientY;
      const centerY = rect.top + rect.height / 2;

      if (mouseY < centerY) {
        column.insertBefore(draggedElement, widget);
      } else {
        column.insertBefore(draggedElement, widget.nextSibling);
      }

      saveLayoutToStorage();
      updateGridLayout();
    });
  });

  // Bind columns as drop targets for dropping in empty spaces
  columns.forEach(column => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      
      // Highlight column if empty or dragging new element to it
      if (draggedElement && !column.contains(draggedElement)) {
        column.classList.add("drag-over");
      }
    });

    column.addEventListener("dragleave", () => {
      column.classList.remove("drag-over");
    });

    column.addEventListener("drop", (e) => {
      e.preventDefault();
      column.classList.remove("drag-over");

      if (!draggedElement) return;

      // If dropped inside empty column or at the end of list
      if (!column.contains(draggedElement)) {
        column.appendChild(draggedElement);
        saveLayoutToStorage();
        updateGridLayout();
      }
    });
  });
}

/**
 * Dynamically adjusts grid template columns depending on active/visible columns
 */
export function updateGridLayout() {
  const grid = document.querySelector(".dashboard-grid");
  const colLeft = document.querySelector(".col-left");
  const colCenter = document.querySelector(".col-center");
  const colRight = document.querySelector(".col-right");

  if (!grid || !colLeft || !colCenter || !colRight) return;

  // Function to check if column has any non-hidden widgets
  const isColumnActive = (colEl) => {
    const widgets = colEl.querySelectorAll(".widget-card");
    return Array.from(widgets).some(w => !w.classList.contains("hidden"));
  };

  const leftActive = isColumnActive(colLeft);
  const centerActive = isColumnActive(colCenter);
  const rightActive = isColumnActive(colRight);

  // Toggle grid-column display
  colLeft.style.display = leftActive ? "flex" : "none";
  colCenter.style.display = centerActive ? "flex" : "none";
  colRight.style.display = rightActive ? "flex" : "none";

  // Re-calculate Grid template columns based on active columns combinations
  if (leftActive && centerActive && rightActive) {
    grid.style.gridTemplateColumns = "minmax(0, 1fr) 1.2fr minmax(0, 1fr)";
  } else if (leftActive && centerActive && !rightActive) {
    grid.style.gridTemplateColumns = "1fr 1.2fr";
  } else if (!leftActive && centerActive && rightActive) {
    grid.style.gridTemplateColumns = "1.2fr 1fr";
  } else if (leftActive && !centerActive && rightActive) {
    grid.style.gridTemplateColumns = "1fr 1fr";
  } else if (leftActive && !centerActive && !rightActive) {
    grid.style.gridTemplateColumns = "1fr";
  } else if (!leftActive && centerActive && !rightActive) {
    grid.style.gridTemplateColumns = "1fr";
  } else if (!leftActive && !centerActive && rightActive) {
    grid.style.gridTemplateColumns = "1fr";
  } else {
    // If all hidden
    grid.style.gridTemplateColumns = "1fr";
  }
}
