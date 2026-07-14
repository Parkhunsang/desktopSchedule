let tasks = [];
let currentFilter = "all"; // all, active, completed
let searchKeyword = "";

export function initTasks() {
  loadTasks();

  // Task Form Submission
  const taskForm = document.getElementById("task-form");
  if (taskForm) {
    taskForm.addEventListener("submit", addNewTask);
  }

  // Task Search
  const searchInput = document.getElementById("task-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchKeyword = e.target.value.toLowerCase().trim();
      renderTasks();
    });
  }

  // Filter Buttons
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // Initial Render
  renderTasks();
}

function loadTasks() {
  const saved = localStorage.getItem("desktop_scheduler_tasks");
  if (saved) {
    try {
      tasks = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load tasks", e);
      tasks = [];
    }
  } else {
    // Sample tasks
    tasks = [
      {
        id: "task-1",
        title: "이 주의 스케줄 등록하기",
        priority: "high",
        category: "work",
        completed: false,
        createdAt: Date.now() - 3600000
      },
      {
        id: "task-2",
        title: "인테리어 참고 이미지 서치",
        priority: "medium",
        category: "personal",
        completed: true,
        createdAt: Date.now() - 7200000
      },
      {
        id: "task-3",
        title: "독서 30분 진행하기",
        priority: "low",
        category: "study",
        completed: false,
        createdAt: Date.now() - 10800000
      }
    ];
    saveTasksToStorage();
  }
}

function saveTasksToStorage() {
  localStorage.setItem("desktop_scheduler_tasks", JSON.stringify(tasks));
}

function addNewTask(e) {
  e.preventDefault();

  const input = document.getElementById("task-input");
  const prioritySelect = document.getElementById("task-priority");
  const categorySelect = document.getElementById("task-category");

  if (!input || !input.value.trim()) return;

  const newTask = {
    id: "task-" + Date.now(),
    title: input.value.trim(),
    priority: prioritySelect.value,
    category: categorySelect.value,
    completed: false,
    createdAt: Date.now()
  };

  tasks.unshift(newTask); // Add to beginning of array
  saveTasksToStorage();
  
  // Clear input
  input.value = "";
  
  // Reset selects if wanted, or keep last selected
  renderTasks();
}

function toggleTaskComplete(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });
  saveTasksToStorage();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasksToStorage();
  renderTasks();
}

function renderTasks() {
  const container = document.getElementById("task-list");
  if (!container) return;

  // Filter Tasks
  let filtered = tasks;

  // 1. Completion filter
  if (currentFilter === "active") {
    filtered = filtered.filter(t => !t.completed);
  } else if (currentFilter === "completed") {
    filtered = filtered.filter(t => t.completed);
  }

  // 2. Search keyword filter
  if (searchKeyword) {
    filtered = filtered.filter(t => t.title.toLowerCase().includes(searchKeyword));
  }

  // Clear previous items
  container.innerHTML = "";

  // Render list
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="task-empty">
        <i data-lucide="check-square"></i>
        <span>할 일 목록이 비어 있습니다.</span>
      </div>
    `;
    updateProgress();
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
    return;
  }

  filtered.forEach(task => {
    const item = document.createElement("div");
    item.className = `task-item ${task.completed ? "completed" : ""}`;
    item.dataset.id = task.id;

    // Check category label text in Korean
    const categoryLabels = {
      work: "업무",
      personal: "개인",
      urgent: "긴급",
      study: "공부"
    };
    const categoryName = categoryLabels[task.category] || task.category;

    // Check priority text in Korean
    const priorityLabels = {
      high: "높음",
      medium: "보통",
      low: "낮음"
    };
    const priorityName = priorityLabels[task.priority] || task.priority;

    item.innerHTML = `
      <label class="task-checkbox-container">
        <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""} />
        <span class="checkmark"></span>
      </label>
      <div class="task-details">
        <span class="task-title">${escapeHTML(task.title)}</span>
        <div class="task-meta">
          <span class="task-priority-tag priority-${task.priority}">${priorityName}</span>
          <span class="task-category-tag">${categoryName}</span>
        </div>
      </div>
      <button class="delete-task-btn" title="할 일 삭제">
        <i data-lucide="trash-2"></i>
      </button>
    `;

    // Connect checkbox toggle
    const checkbox = item.querySelector(".task-checkbox");
    checkbox.addEventListener("change", () => toggleTaskComplete(task.id));

    // Connect delete button
    const deleteBtn = item.querySelector(".delete-task-btn");
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    container.appendChild(item);
  });

  updateProgress();

  // Reload Lucide icons for trash bin icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Recalculate progress numbers & progress bar width
function updateProgress() {
  const completedCountEl = document.getElementById("task-completed-count");
  const totalCountEl = document.getElementById("task-total-count");
  const progressBar = document.getElementById("task-progress-bar");

  if (!completedCountEl || !totalCountEl || !progressBar) return;

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;

  completedCountEl.textContent = completed;
  totalCountEl.textContent = total;

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressBar.style.width = `${percentage}%`;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
