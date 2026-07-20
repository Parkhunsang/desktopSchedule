import { getSupabaseClient } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';

let events = []; // Array of { id, title, date (YYYY-MM-DD), time (HH:MM), color, desc }
let currentDate = new Date(); // Today's date
let selectedDate = new Date(); // Currently clicked date
let currentViewMonth = currentDate.getMonth(); // Month currently viewed (0-11)
let currentViewYear = currentDate.getFullYear(); // Year currently viewed

export function initCalendar() {
  loadEvents();

  // Navigation Buttons
  const prevBtn = document.getElementById("prev-month-btn");
  const nextBtn = document.getElementById("next-month-btn");
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener("click", () => changeMonth(-1));
    nextBtn.addEventListener("click", () => changeMonth(1));
  }

  // Modal Buttons
  const addBtn = document.getElementById("add-event-btn");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalOverlay = document.getElementById("event-modal");

  if (addBtn) addBtn.addEventListener("click", () => openEventModal());
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeEventModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeEventModal();
    });
  }

  // Event Form Submit
  const eventForm = document.getElementById("event-form");
  if (eventForm) {
    eventForm.addEventListener("submit", saveEvent);
  }

  // Initial Render
  renderCalendar();
  renderAgenda();

  // Sync cloud events via Supabase (async)
  syncSupabaseEvents();
}

let calendarRealtimeChannel = null;

async function syncSupabaseEvents() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log("Supabase is not configured yet. Cloud events syncing is inactive.");
    return;
  }

  const user = getCurrentUser();

  try {
    // 1. Fetch existing cloud events (filtered by user_id if authenticated)
    let query = supabase.from('scheduler_events').select('*');
    if (user && user.id) {
      query = query.eq('user_id', user.id);
    }

    const { data: supabaseEvents, error } = await query;

    if (error) throw error;

    if (supabaseEvents && supabaseEvents.length > 0) {
      const formattedEvents = supabaseEvents.map(se => ({
        id: se.id,
        title: se.title,
        date: se.date,
        time: se.time || "19:00",
        endTime: se.end_time || "20:00",
        color: resolveEventColor(se),
        desc: se.desc || "",
        isExternal: true
      }));

      const existingKeys = new Set(events.map(e => `${e.title}_${e.date}`));
      formattedEvents.forEach(fe => {
        const key = `${fe.title}_${fe.date}`;
        if (!existingKeys.has(key)) {
          events.push(fe);
          existingKeys.add(key);
        }
      });

      renderCalendar();
      renderAgenda();
    }

    // 2. Subscribe to new event inserts in Realtime
    if (calendarRealtimeChannel) {
      try { supabase.removeChannel(calendarRealtimeChannel); } catch (e) {}
      calendarRealtimeChannel = null;
    }

    calendarRealtimeChannel = supabase
      .channel(`calendar-changes-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduler_events',
        },
        (payload) => {
          console.log(`[Realtime ${payload.eventType}] received from Supabase:`, payload);

          if (payload.eventType === 'INSERT') {
            const newSe = payload.new;
            if (events.some(e => e.id === newSe.id)) return;

            const formatted = {
              id: newSe.id,
              title: newSe.title,
              date: newSe.date,
              time: newSe.time || "19:00",
              endTime: newSe.end_time || "20:00",
              color: resolveEventColor(newSe),
              desc: newSe.desc || "",
              isExternal: true
            };

            events.push(formatted);
            renderCalendar();
            renderAgenda();
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              events = events.filter(e => e.id !== deletedId);
              saveEventsToStorage();
              renderCalendar();
              renderAgenda();
            }
          }
        }
      );

    calendarRealtimeChannel.subscribe();

  } catch (err) {
    console.error("Failed to sync Supabase events:", err);
  }
}

function loadEvents() {
  const saved = localStorage.getItem("desktop_scheduler_events");
  if (saved) {
    try {
      events = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load events", e);
      events = [];
    }
  } else {
    // Generate placeholder sample events
    const todayStr = formatDateString(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateString(tomorrow);

    events = [
      {
        id: "sample-1",
        title: "데스크탑 스케줄러 개발 시작",
        date: todayStr,
        time: "14:00",
        endTime: "15:30",
        color: "#3b82f6",
        desc: "Vite + Vanilla JS로 멋진 투명 글래스 디자인 완성하기"
      },
      {
        id: "sample-2",
        title: "일일 스프린트 미팅",
        date: todayStr,
        time: "16:30",
        endTime: "17:00",
        color: "#f59e0b",
        desc: "진행상황 요약 및 주간 플랜 조율"
      },
      {
        id: "sample-3",
        title: "운동 및 건강 관리",
        date: tomorrowStr,
        time: "09:00",
        endTime: "10:30",
        color: "#10b981",
        desc: "헬스장 1시간 유산소 및 코어 트레이닝"
      }
    ];
    saveEventsToStorage();
  }
}

function saveEventsToStorage() {
  localStorage.setItem("desktop_scheduler_events", JSON.stringify(events));
}

function changeMonth(direction) {
  currentViewMonth += direction;
  if (currentViewMonth < 0) {
    currentViewMonth = 11;
    currentViewYear--;
  } else if (currentViewMonth > 11) {
    currentViewMonth = 0;
    currentViewYear++;
  }
  renderCalendar();
}

// Render Calendar Grid cells
function renderCalendar() {
  const monthTitle = document.getElementById("current-month-year");
  const calendarGrid = document.getElementById("calendar-grid");
  
  if (!monthTitle || !calendarGrid) return;

  // Set header text: "2026.06"
  const displayMonth = String(currentViewMonth + 1).padStart(2, '0');
  monthTitle.textContent = `${currentViewYear}.${displayMonth}`;

  // Clear previous cells
  calendarGrid.innerHTML = "";

  // Get first day of the month (0 = Sun, 6 = Sat)
  const firstDayIndex = new Date(currentViewYear, currentViewMonth, 1).getDay();
  
  // Get last day of the current month
  const lastDayDate = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();
  
  // Get last day of the previous month
  const prevLastDayDate = new Date(currentViewYear, currentViewMonth, 0).getDate();

  // 1. Render Previous Month's trailing days
  for (let i = firstDayIndex; i > 0; i--) {
    const dayNum = prevLastDayDate - i + 1;
    const cellDate = new Date(currentViewYear, currentViewMonth - 1, dayNum);
    const cell = createDayCell(dayNum, cellDate, true);
    calendarGrid.appendChild(cell);
  }

  // 2. Render Current Month's days
  for (let i = 1; i <= lastDayDate; i++) {
    const cellDate = new Date(currentViewYear, currentViewMonth, i);
    const cell = createDayCell(i, cellDate, false);
    calendarGrid.appendChild(cell);
  }

  // 3. Render Next Month's leading days to fill grid (usually 42 cells total)
  const totalCellsRendered = firstDayIndex + lastDayDate;
  const remainingCells = 42 - totalCellsRendered;
  
  for (let i = 1; i <= remainingCells; i++) {
    const cellDate = new Date(currentViewYear, currentViewMonth + 1, i);
    const cell = createDayCell(i, cellDate, true);
    calendarGrid.appendChild(cell);
  }
}

// Create individual cell DOM node
function createDayCell(dayNumber, cellDate, isOtherMonth) {
  const cell = document.createElement("div");
  cell.className = "calendar-cell";
  cell.textContent = dayNumber;

  const dateStr = formatDateString(cellDate);
  cell.dataset.date = dateStr;

  if (isOtherMonth) {
    cell.classList.add("other-month");
  }

  // Check if cell is Today
  const todayStr = formatDateString(currentDate);
  if (dateStr === todayStr) {
    cell.classList.add("today");
  }

  // Check if cell is Selected
  const selectedStr = formatDateString(selectedDate);
  if (dateStr === selectedStr) {
    cell.classList.add("selected");
  }

  // Check for events on this day and add dots
  const dayEvents = events.filter(e => e.date === dateStr);
  if (dayEvents.length > 0) {
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "calendar-dots";
    
    // Draw up to 3 dots
    dayEvents.slice(0, 3).forEach(ev => {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.backgroundColor = ev.color;
      dotsContainer.appendChild(dot);
    });
    cell.appendChild(dotsContainer);

    // Create Tooltip for hovered calendar cell
    const tooltip = document.createElement("div");
    tooltip.className = "calendar-tooltip";
    
    // Sort events by time and format list
    const sortedEvents = [...dayEvents].sort((a, b) => a.time.localeCompare(b.time));
    const listContainer = document.createElement("ul");
    listContainer.className = "tooltip-event-list";
    
    sortedEvents.forEach(ev => {
      const li = document.createElement("li");
      
      const timeSpan = document.createElement("span");
      timeSpan.className = "tooltip-event-time";
      timeSpan.textContent = ev.time;
      timeSpan.style.color = ev.color; // Match dot color
      
      const titleSpan = document.createElement("span");
      titleSpan.className = "tooltip-event-title";
      titleSpan.textContent = ev.title;
      
      li.appendChild(timeSpan);
      li.appendChild(titleSpan);
      listContainer.appendChild(li);
    });
    
    tooltip.appendChild(listContainer);
    cell.appendChild(tooltip);
  }

  // Cell click event
  cell.addEventListener("click", () => {
    // Update selected date state
    selectedDate = cellDate;
    
    // Rerender cells to update selection highlight
    document.querySelectorAll(".calendar-cell").forEach(c => c.classList.remove("selected"));
    cell.classList.add("selected");
    
    // Update Agenda
    renderAgenda();
  });

  return cell;
}

// Render agenda items for selected date
function renderAgenda() {
  const agendaList = document.getElementById("agenda-list");
  const dateLabel = document.getElementById("agenda-date-label");

  if (!agendaList || !dateLabel) return;

  const selectedStr = formatDateString(selectedDate);
  const todayStr = formatDateString(currentDate);

  // Set Title Label
  if (selectedStr === todayStr) {
    dateLabel.textContent = "오늘";
  } else {
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    dateLabel.textContent = `${m}월 ${d}일`;
  }

  // Clear previous items
  agendaList.innerHTML = "";

  // Filter and sort events for this day (by time)
  const dayEvents = events
    .filter(e => e.date === selectedStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (dayEvents.length === 0) {
    agendaList.innerHTML = `
      <div class="agenda-empty">
        <i data-lucide="calendar"></i>
        <span>이 날에는 등록된 일정이 없습니다.</span>
      </div>
    `;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
    return;
  }

  // Render events
  dayEvents.forEach(ev => {
    const item = document.createElement("div");
    item.className = "agenda-item";
    item.style.borderLeftColor = ev.color;

    const displayTimeRange = ev.endTime ? `${ev.time} ~ ${ev.endTime}` : ev.time;

    item.innerHTML = `
      <div class="agenda-item-time">${displayTimeRange}</div>
      <div class="agenda-item-details">
        <div class="agenda-item-title">${escapeHTML(ev.title)}</div>
        ${ev.desc ? `<div class="agenda-item-desc">${escapeHTML(ev.desc)}</div>` : ""}
      </div>
    `;

    item.addEventListener("click", () => {
      openEventModal(ev);
    });

    agendaList.appendChild(item);
  });
}

// Open Event Modal (supports both Add and Edit modes)
function openEventModal(eventToEdit = null) {
  const modal = document.getElementById("event-modal");
  const modalTitle = document.getElementById("modal-title-text");
  
  const idInput = document.getElementById("event-id");
  const dateInput = document.getElementById("event-date");
  const titleInput = document.getElementById("event-title");
  const timeInput = document.getElementById("event-time");
  const endTimeInput = document.getElementById("event-end-time");
  const colorSelect = document.getElementById("event-color");
  const descInput = document.getElementById("event-desc");
  const deleteBtn = document.getElementById("delete-event-btn");

  if (!modal || !idInput || !dateInput || !titleInput || !timeInput || !endTimeInput || !colorSelect || !descInput || !deleteBtn) return;

  if (eventToEdit) {
    // Edit mode
    modalTitle.textContent = "일정 수정";
    idInput.value = eventToEdit.id;
    dateInput.value = eventToEdit.date;
    titleInput.value = eventToEdit.title;
    timeInput.value = eventToEdit.time;
    endTimeInput.value = eventToEdit.endTime || "";
    colorSelect.value = eventToEdit.color;
    descInput.value = eventToEdit.desc || "";
    deleteBtn.classList.remove("hidden");
  } else {
    // Add mode
    modalTitle.textContent = "일정 추가";
    idInput.value = "";
    dateInput.value = formatDateString(selectedDate);
    titleInput.value = "";
    
    // Default time is closest hour, end time is 1 hour later
    const now = new Date();
    const currentHour = now.getHours();
    const endHour = (currentHour + 1) % 24;
    
    const startHourStr = String(currentHour).padStart(2, '0');
    const endHourStr = String(endHour).padStart(2, '0');
    
    timeInput.value = `${startHourStr}:00`;
    endTimeInput.value = `${endHourStr}:00`;
    
    colorSelect.selectedIndex = 0;
    descInput.value = "";
    deleteBtn.classList.add("hidden");
  }

  hideEventModalError();
  modal.classList.remove("hidden");
  titleInput.focus();
}

function closeEventModal() {
  const modal = document.getElementById("event-modal");
  if (modal) modal.classList.add("hidden");
  
  hideEventModalError();
  
  const descInput = document.getElementById("event-desc");
  if (descInput) {
    descInput.style.width = "";
    descInput.style.height = "";
  }
  
  window.dispatchEvent(new Event('resize'));
}

// Submit handler to Save / Edit event
function saveEvent(e) {
  e.preventDefault();

  const id = document.getElementById("event-id").value;
  const date = document.getElementById("event-date").value;
  const title = document.getElementById("event-title").value.trim();
  const time = document.getElementById("event-time").value;
  const endTime = document.getElementById("event-end-time").value;
  const color = document.getElementById("event-color").value;
  const desc = document.getElementById("event-desc").value.trim();

  if (!title) return;

  // Validation: End time check removed to allow overnight schedules (e.g. 23:00 ~ 02:00) on the same date.


  const targetId = id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ("evt-" + Date.now()));

  if (id) {
    // Update existing event
    events = events.map(ev => {
      if (ev.id === id) {
        return { id, title, date, time, endTime, color, desc };
      }
      return ev;
    });
  } else {
    // Create new event
    const newEvent = {
      id: targetId,
      title,
      date,
      time,
      endTime,
      color,
      desc
    };
    events.push(newEvent);
  }

  saveEventsToStorage();
  closeEventModal();
  renderCalendar();
  renderAgenda();

  // Supabase Cloud DB Sync
  const supabase = getSupabaseClient();
  if (supabase) {
    const user = getCurrentUser();
    const dbEvent = {
      id: targetId,
      title,
      date,
      time,
      end_time: endTime || "10:00",
      color: color || "#3b82f6",
      desc: desc || "",
      ...(user?.id ? { user_id: user.id } : {})
    };

    if (id && !id.startsWith("event-")) {
      supabase.from('scheduler_events').update(dbEvent).eq('id', id).then(({ error }) => {
        if (error) console.warn("[Supabase Event Update Warning]", error);
      });
    } else {
      supabase.from('scheduler_events').insert([dbEvent]).then(({ error }) => {
        if (error) console.warn("[Supabase Event Insert Warning]", error);
      });
    }
  }
}

function deleteEvent(id) {
  const targetEvent = events.find(ev => ev.id === id);
  events = events.filter(ev => ev.id !== id);
  saveEventsToStorage();
  closeEventModal();
  renderCalendar();
  renderAgenda();

  // Supabase Cloud DB Delete Sync
  const supabase = getSupabaseClient();
  if (supabase) {
    const user = getCurrentUser();
    let query = supabase.from('scheduler_events').delete();
    
    if (id && !id.startsWith("event-")) {
      query = query.eq('id', id);
    } else if (targetEvent) {
      query = query.eq('title', targetEvent.title).eq('date', targetEvent.date);
    }

    if (user?.id) {
      query = query.eq('user_id', user.id);
    }

    query.then(({ error }) => {
      if (error) console.warn("[Supabase Event Delete Warning]", error);
      else console.log("[Supabase Event Deleted Successfully]", id);
    });
  }
}

// Helpers
function formatDateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showEventModalError(message) {
  const errorEl = document.getElementById("event-modal-error");
  const errorTextEl = document.getElementById("event-modal-error-text");
  if (errorEl && errorTextEl) {
    errorTextEl.textContent = message;
    errorEl.classList.remove("hidden");
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

function hideEventModalError() {
  const errorEl = document.getElementById("event-modal-error");
  if (errorEl) {
    errorEl.classList.add("hidden");
  }
}

/**
 * Smartly resolves dot color for existing/imported cloud events
 */
function resolveEventColor(se) {
  if (se && se.color && se.color !== '#8b5cf6') {
    return se.color;
  }

  const title = (se?.title || '').toLowerCase();
  if (title.includes('개발') || title.includes('업무') || title.includes('work') || title.includes('스케줄러')) {
    return '#3b82f6'; // 파랑 (업무)
  }
  if (title.includes('미팅') || title.includes('회의') || title.includes('스프린트') || title.includes('약속')) {
    return '#f59e0b'; // 노랑 (미팅)
  }
  if (title.includes('영어') || title.includes('공부') || title.includes('학습') || title.includes('study')) {
    return '#8b5cf6'; // 보라 (공부)
  }
  if (title.includes('운동') || title.includes('개인') || title.includes('휴식')) {
    return '#10b981'; // 초록 (개인)
  }

  // Hash palette for unknown items to ensure vibrant color distribution
  const palette = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}
