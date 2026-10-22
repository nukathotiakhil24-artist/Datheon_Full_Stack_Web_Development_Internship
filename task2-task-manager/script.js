"use strict";

const STORAGE_KEY = "datheon_tasks_v1";

// ---------- State ----------
let tasks = loadFromLocalStorage();
const filters = { status: "all", category: "all", search: "" };
let editingId = null;
let dragId = null;

// ---------- DOM ----------
const $ = (selector) => document.querySelector(selector);
const form = $("#task-form");
const taskInput = $("#task-input");
const categorySelect = $("#category-select");
const searchInput = $("#search-input");
const statusFilters = $("#status-filters");
const categoryFilter = $("#category-filter");
const taskList = $("#task-list");
const emptyState = $("#empty-state");
const statsEl = $("#stats");
const progressBar = $("#progress-bar");
const clearCompletedBtn = $("#clear-completed");

// ---------- Persistence ----------
function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error("Could not save tasks:", err);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Could not load tasks:", err);
    return [];
  }
}

// ---------- CRUD ----------
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addTask(text, category) {
  const title = text.trim();
  if (!title) return;
  tasks.push({
    id: createId(),
    text: title,
    category,
    completed: false,
    createdAt: Date.now(),
  });
  saveToLocalStorage();
  render();
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveToLocalStorage();
  render();
}

function updateTaskText(id, text) {
  const title = text.trim();
  const task = tasks.find((t) => t.id === id);
  if (!task || !title) return;
  task.text = title;
  saveToLocalStorage();
}

function deleteTask(id, element) {
  const remove = () => {
    tasks = tasks.filter((t) => t.id !== id);
    saveToLocalStorage();
    render();
  };
  if (element) {
    element.classList.add("removing");
    setTimeout(remove, 250);
  } else {
    remove();
  }
}

function clearCompleted() {
  tasks = tasks.filter((t) => !t.completed);
  saveToLocalStorage();
  render();
}

function reorderTasks(fromId, toId) {
  const from = tasks.findIndex((t) => t.id === fromId);
  const to = tasks.findIndex((t) => t.id === toId);
  if (from === -1 || to === -1 || from === to) return;
  const [moved] = tasks.splice(from, 1);
  tasks.splice(to, 0, moved);
  saveToLocalStorage();
  render();
}

// ---------- Filtering ----------
function getVisibleTasks() {
  const query = filters.search.trim().toLowerCase();
  return tasks.filter((t) => {
    const statusOk =
      filters.status === "all" ||
      (filters.status === "active" && !t.completed) ||
      (filters.status === "completed" && t.completed);
    const categoryOk = filters.category === "all" || t.category === filters.category;
    const searchOk = !query || t.text.toLowerCase().includes(query);
    return statusOk && categoryOk && searchOk;
  });
}

// ---------- Rendering ----------
function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task-item" + (task.completed ? " completed" : "");
  li.dataset.id = task.id;
  li.draggable = editingId !== task.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", "Mark task complete");
  checkbox.dataset.action = "toggle";
  li.appendChild(checkbox);

  if (editingId === task.id) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit-input";
    input.value = task.text;
    input.maxLength = 120;
    input.dataset.role = "edit";
    li.appendChild(input);
  } else {
    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;
    text.dataset.action = "edit-text";
    li.appendChild(text);
  }

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = task.category;
  li.appendChild(badge);

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "icon-btn";
  editBtn.title = "Edit";
  editBtn.setAttribute("aria-label", "Edit task");
  editBtn.dataset.action = "edit";
  editBtn.textContent = "✎";
  li.appendChild(editBtn);

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "icon-btn delete";
  delBtn.title = "Delete";
  delBtn.setAttribute("aria-label", "Delete task");
  delBtn.dataset.action = "delete";
  delBtn.textContent = "✕";
  li.appendChild(delBtn);

  return li;
}

function render() {
  const visible = getVisibleTasks();
  taskList.replaceChildren(...visible.map(createTaskElement));
  emptyState.hidden = visible.length > 0;

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  statsEl.textContent = total ? `${done} of ${total} completed` : "No tasks yet";
  progressBar.style.width = total ? `${(done / total) * 100}%` : "0%";

  if (editingId) {
    const input = taskList.querySelector('[data-role="edit"]');
    if (input) {
      input.focus();
      input.select();
    }
  }
}

// ---------- Editing helpers ----------
function startEditing(id) {
  editingId = id;
  render();
}

function finishEditing(save, value) {
  if (editingId === null) return;
  const id = editingId;
  editingId = null;
  if (save) updateTaskText(id, value);
  render();
}

// ---------- Events ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  addTask(taskInput.value, categorySelect.value);
  taskInput.value = "";
  taskInput.focus();
});

searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  render();
});

categoryFilter.addEventListener("change", () => {
  filters.category = categoryFilter.value;
  render();
});

statusFilters.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  filters.status = btn.dataset.filter;
  statusFilters.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip === btn);
  });
  render();
});

clearCompletedBtn.addEventListener("click", clearCompleted);

taskList.addEventListener("click", (e) => {
  const li = e.target.closest(".task-item");
  if (!li) return;
  const id = li.dataset.id;
  const action = e.target.dataset.action;
  if (action === "delete") deleteTask(id, li);
  else if (action === "edit") startEditing(id);
});

taskList.addEventListener("change", (e) => {
  if (e.target.dataset.action !== "toggle") return;
  const li = e.target.closest(".task-item");
  if (li) toggleTask(li.dataset.id);
});

taskList.addEventListener("dblclick", (e) => {
  if (e.target.dataset.action !== "edit-text") return;
  const li = e.target.closest(".task-item");
  if (li) startEditing(li.dataset.id);
});

taskList.addEventListener("keydown", (e) => {
  if (e.target.dataset.role !== "edit") return;
  if (e.key === "Enter") finishEditing(true, e.target.value);
  else if (e.key === "Escape") finishEditing(false);
});

taskList.addEventListener(
  "blur",
  (e) => {
    if (e.target.dataset && e.target.dataset.role === "edit") {
      finishEditing(true, e.target.value);
    }
  },
  true
);

// Drag and drop reordering
taskList.addEventListener("dragstart", (e) => {
  const li = e.target.closest(".task-item");
  if (!li) return;
  dragId = li.dataset.id;
  li.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragId);
});

taskList.addEventListener("dragover", (e) => {
  const li = e.target.closest(".task-item");
  if (!li || !dragId) return;
  e.preventDefault();
  taskList.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
  if (li.dataset.id !== dragId) li.classList.add("drag-over");
});

taskList.addEventListener("drop", (e) => {
  const li = e.target.closest(".task-item");
  if (!li || !dragId) return;
  e.preventDefault();
  reorderTasks(dragId, li.dataset.id);
});

taskList.addEventListener("dragend", () => {
  dragId = null;
  taskList.querySelectorAll(".dragging, .drag-over").forEach((el) => {
    el.classList.remove("dragging", "drag-over");
  });
});

// ---------- Init ----------
render();
