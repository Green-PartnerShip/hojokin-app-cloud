const SYNC_INTERVAL_MS = 6000;
const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
const WEEKDAYS_FULL = ["日", "月", "火", "水", "木", "金", "土"];
const PRIORITY_META = {
  critical: { label: "最重要", weight: 0, icon: "badge-alert" },
  high: { label: "高め", weight: 1, icon: "arrow-up" },
  normal: { label: "普通", weight: 2, icon: "minus" },
  low: { label: "低め", weight: 3, icon: "arrow-down" },
};

const elements = {
  scopeLabel: document.querySelector("#scopeLabel"),
  criticalCount: document.querySelector("#criticalCount"),
  overdueCount: document.querySelector("#overdueCount"),
  todayCount: document.querySelector("#todayCount"),
  doneRate: document.querySelector("#doneRate"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  priorityFilter: document.querySelector("#priorityFilter"),
  focusList: document.querySelector("#focusList"),
  upcomingList: document.querySelector("#upcomingList"),
  viewKicker: document.querySelector("#viewKicker"),
  viewTitle: document.querySelector("#viewTitle"),
  visibleSummary: document.querySelector("#visibleSummary"),
  progressFill: document.querySelector("#progressFill"),
  workSummary: document.querySelector("#workSummary"),
  calendarArea: document.querySelector("#calendarArea"),
  dialog: document.querySelector("#taskDialog"),
  helpDialog: document.querySelector("#helpDialog"),
  quickHelp: document.querySelector("#quickHelp"),
  form: document.querySelector("#taskForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  deleteTaskButton: document.querySelector("#deleteTaskButton"),
  authOverlay: document.querySelector("#authOverlay"),
  loginForm: document.querySelector("#loginForm"),
  loginPassword: document.querySelector("#loginPassword"),
  authMessage: document.querySelector("#authMessage"),
  syncStatus: document.querySelector("#syncStatus"),
  logoutButton: document.querySelector("#logoutButton"),
};

const state = {
  tasks: [],
  anchorDate: startOfDay(new Date()),
  view: "day",
  query: "",
  status: "active",
  priority: "all",
  editingId: null,
  authenticated: false,
  lastUpdatedAt: null,
};

let quickHelpTimer = null;
let quickHelpTarget = null;
let quickHelpPoint = { x: 0, y: 0 };
let syncTimer = null;

function normalizeTask(task) {
  const categoryMap = {
    仕事: "社内",
    家事: "私用",
    学習: "社内",
  };

  return {
    id: task.id || createId(),
    title: task.title || "無題のタスク",
    project: task.project || "",
    owner: task.owner || "",
    date: task.date || toYmd(new Date()),
    time: task.time || "",
    category: categoryMap[task.category] || task.category || "その他",
    priority: PRIORITY_META[task.priority] ? task.priority : "normal",
    notes: task.notes || "",
    done: Boolean(task.done),
    createdAt: task.createdAt || Date.now(),
  };
}

function setSyncStatus(message, tone = "ok") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.classList.toggle("is-muted", tone === "muted");
  elements.syncStatus.classList.toggle("is-error", tone === "error");
}

function setAuthMessage(message = "") {
  elements.authMessage.textContent = message;
}

function showLogin(message = "") {
  state.authenticated = false;
  stopSync();
  document.body.classList.add("is-auth-locked");
  elements.authOverlay.hidden = false;
  elements.logoutButton.hidden = true;
  setSyncStatus("未ログイン", "muted");
  setAuthMessage(message);
  decorateIcons();
  setTimeout(() => elements.loginPassword.focus(), 0);
}

function showApp() {
  state.authenticated = true;
  document.body.classList.remove("is-auth-locked");
  elements.authOverlay.hidden = true;
  elements.logoutButton.hidden = false;
  setAuthMessage("");
}

function applyServerStore(store) {
  state.tasks = Array.isArray(store.tasks) ? store.tasks.map(normalizeTask) : [];
  state.lastUpdatedAt = store.updatedAt || null;
  render();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    showLogin(payload.message || "もう一度パスワードを入力してください。");
    throw new Error(payload.message || "認証が必要です。");
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || "通信に失敗しました。");
  }
  return payload;
}

async function loadTasksFromServer({ quiet = false } = {}) {
  if (!quiet) {
    setSyncStatus("読み込み中", "muted");
  }
  const store = await apiRequest("/api/tasks");
  applyServerStore(store);
  setSyncStatus("同期済み");
}

function startSync() {
  stopSync();
  syncTimer = window.setInterval(() => {
    if (!state.authenticated || document.hidden) {
      return;
    }
    loadTasksFromServer({ quiet: true }).catch(() => {
      setSyncStatus("同期失敗", "error");
    });
  }, SYNC_INTERVAL_MS);
}

function stopSync() {
  if (syncTimer) {
    window.clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function loginWithPassword(password) {
  setAuthMessage("");
  setSyncStatus("確認中", "muted");
  await apiRequest("/api/login", {
    method: "POST",
    body: { password },
  });
  showApp();
  await loadTasksFromServer();
  startSync();
}

async function logout() {
  await apiRequest("/api/logout", { method: "POST" }).catch(() => {});
  state.tasks = [];
  render();
  showLogin("ログアウトしました。");
}

async function saveTaskToServer(taskData) {
  const path = state.editingId ? `/api/tasks/${encodeURIComponent(state.editingId)}` : "/api/tasks";
  const method = state.editingId ? "PUT" : "POST";
  const store = await apiRequest(path, { method, body: taskData });
  applyServerStore(store);
  setSyncStatus("保存済み");
}

async function deleteTaskFromServer(id) {
  const store = await apiRequest(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
  applyServerStore(store);
  setSyncStatus("削除済み");
}

async function toggleTaskDoneOnServer(id) {
  const store = await apiRequest(`/api/tasks/${encodeURIComponent(id)}/toggle`, { method: "POST" });
  applyServerStore(store);
  setSyncStatus("同期済み");
}

function sampleTasks() {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const later = addDays(today, 4);
  return [
    {
      id: createId(),
      title: "A社 提案書の最終確認",
      project: "A社 新規提案",
      owner: "自分",
      date: toYmd(today),
      time: "10:00",
      category: "提案",
      priority: "critical",
      notes: "送付前に金額・納期・前提条件を確認。",
      done: false,
      createdAt: Date.now() - 5000,
    },
    {
      id: createId(),
      title: "請求書の承認依頼",
      project: "月次請求",
      owner: "経理",
      date: toYmd(yesterday),
      time: "17:00",
      category: "請求",
      priority: "high",
      notes: "期限超過の見え方を確認するためのサンプルです。",
      done: false,
      createdAt: Date.now() - 4000,
    },
    {
      id: createId(),
      title: "週次レビュー",
      project: "営業定例",
      owner: "チーム",
      date: toYmd(tomorrow),
      time: "16:00",
      category: "社内",
      priority: "high",
      notes: "",
      done: false,
      createdAt: Date.now() - 3000,
    },
    {
      id: createId(),
      title: "問い合わせ一覧を確認",
      project: "サポート",
      owner: "自分",
      date: toYmd(today),
      time: "14:30",
      category: "顧客対応",
      priority: "normal",
      notes: "",
      done: false,
      createdAt: Date.now() - 2000,
    },
    {
      id: createId(),
      title: "来月の予定候補を洗い出す",
      project: "計画",
      owner: "",
      date: toYmd(later),
      time: "",
      category: "その他",
      priority: "low",
      notes: "",
      done: true,
      createdAt: Date.now() - 1000,
    },
  ].map(normalizeTask);
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseYmd(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toYmd(date) {
  const value = startOfDay(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, count) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + count);
  return next;
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function startOfWeek(date) {
  const day = (date.getDay() + 6) % 7;
  return addDays(date, -day);
}

function formatDate(date, options = {}) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS_FULL[date.getDay()];
  if (options.year) {
    return `${date.getFullYear()}年${month}月${day}日(${weekday})`;
  }
  return `${month}月${day}日(${weekday})`;
}

function formatCompactDate(value) {
  const date = parseYmd(value);
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS_FULL[date.getDay()]})`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isOverdue(task) {
  return !task.done && task.date < toYmd(new Date());
}

function isDueToday(task) {
  return !task.done && task.date === toYmd(new Date());
}

function filteredTasks() {
  const query = state.query.trim().toLowerCase();
  return state.tasks.filter((task) => {
    const querySource = `${task.title} ${task.notes} ${task.category} ${task.project} ${task.owner}`.toLowerCase();
    const queryMatch = !query || querySource.includes(query);
    const priorityMatch = state.priority === "all" || task.priority === state.priority;
    const statusMatch =
      state.status === "all" ||
      (state.status === "done" && task.done) ||
      (state.status === "active" && !task.done) ||
      (state.status === "overdue" && isOverdue(task)) ||
      (state.status === "today" && isDueToday(task));
    return queryMatch && priorityMatch && statusMatch;
  });
}

function tasksOn(date, source = filteredTasks()) {
  const ymd = toYmd(date);
  return source.filter((task) => task.date === ymd).sort(sortTasks);
}

function sortTasks(a, b) {
  if (a.done !== b.done) {
    return a.done ? 1 : -1;
  }
  const overdueCompare = Number(isOverdue(b)) - Number(isOverdue(a));
  if (overdueCompare !== 0) {
    return overdueCompare;
  }
  const priorityCompare = PRIORITY_META[a.priority].weight - PRIORITY_META[b.priority].weight;
  if (priorityCompare !== 0) {
    return priorityCompare;
  }
  const timeCompare = (a.time || "99:99").localeCompare(b.time || "99:99");
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.createdAt - b.createdAt;
}

function tasksInRange(start, end, source = state.tasks) {
  const startValue = toYmd(start);
  const endValue = toYmd(end);
  return source.filter((task) => task.date >= startValue && task.date <= endValue);
}

function visibleRange() {
  if (state.view === "day") {
    return [state.anchorDate, state.anchorDate];
  }
  if (state.view === "week") {
    const start = startOfWeek(state.anchorDate);
    return [start, addDays(start, 6)];
  }
  const start = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth(), 1);
  const end = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth() + 1, 0);
  return [start, end];
}

function render() {
  updateViewTabs();
  updateHeader();
  updateStats();
  renderWorkSummary();
  renderFocusList();
  renderUpcoming();
  renderCalendar();
  decorateIcons();
}

function decorateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function updateViewTabs() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.view === state.view));
  });
}

function updateHeader() {
  const [start, end] = visibleRange();
  const labels = {
    day: "1日",
    week: "1週間",
    month: "1か月",
  };
  elements.viewKicker.textContent = labels[state.view];

  if (state.view === "day") {
    const label = formatDate(state.anchorDate, { year: true });
    elements.viewTitle.textContent = label;
    elements.scopeLabel.textContent = `${label}の業務`;
    return;
  }

  if (state.view === "week") {
    const title = `${formatDate(start)} - ${formatDate(end)}`;
    elements.viewTitle.textContent = title;
    elements.scopeLabel.textContent = "週の業務";
    return;
  }

  const monthTitle = `${state.anchorDate.getFullYear()}年${state.anchorDate.getMonth() + 1}月`;
  elements.viewTitle.textContent = monthTitle;
  elements.scopeLabel.textContent = "月の業務";
}

function updateStats() {
  const today = startOfDay(new Date());
  const activeTasks = state.tasks.filter((task) => !task.done);
  const completed = state.tasks.filter((task) => task.done).length;
  const doneRate = state.tasks.length ? Math.round((completed / state.tasks.length) * 100) : 0;

  elements.criticalCount.textContent = activeTasks.filter((task) => task.priority === "critical").length;
  elements.overdueCount.textContent = activeTasks.filter(isOverdue).length;
  elements.todayCount.textContent = tasksInRange(today, today, activeTasks).length;
  elements.doneRate.textContent = `${doneRate}%`;
}

function renderWorkSummary() {
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 6);
  const activeTasks = state.tasks.filter((task) => !task.done);
  const tiles = [
    {
      label: "最重要",
      value: activeTasks.filter((task) => task.priority === "critical").length,
      icon: "badge-alert",
      tone: "critical",
    },
    {
      label: "期限超過",
      value: activeTasks.filter(isOverdue).length,
      icon: "alarm-clock",
      tone: "overdue",
    },
    {
      label: "本日対応",
      value: tasksInRange(today, today, activeTasks).length,
      icon: "calendar-check",
      tone: "today",
    },
    {
      label: "7日以内",
      value: tasksInRange(today, weekEnd, activeTasks).length,
      icon: "calendar-clock",
      tone: "week",
    },
  ];

  elements.workSummary.innerHTML = tiles
    .map(
      (tile) => `
        <div class="summary-tile tone-${tile.tone}">
          <span><i data-lucide="${tile.icon}"></i></span>
          <div>
            <strong>${tile.value}</strong>
            <p>${tile.label}</p>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderFocusList() {
  const focusTasks = filteredTasks()
    .filter((task) => !task.done && (task.priority === "critical" || task.priority === "high" || isOverdue(task)))
    .sort((a, b) => attentionWeight(a) - attentionWeight(b) || a.date.localeCompare(b.date) || sortTasks(a, b))
    .slice(0, 6);

  if (!focusTasks.length) {
    elements.focusList.innerHTML = `<div class="empty-state compact">重要案件はありません</div>`;
    return;
  }

  elements.focusList.innerHTML = focusTasks.map(renderMiniTask).join("");
}

function attentionWeight(task) {
  if (isOverdue(task) && task.priority === "critical") {
    return 0;
  }
  if (task.priority === "critical") {
    return 1;
  }
  if (isOverdue(task)) {
    return 2;
  }
  if (task.priority === "high") {
    return 3;
  }
  return 4;
}

function renderUpcoming() {
  const today = toYmd(new Date());
  const nextTasks = filteredTasks()
    .filter((task) => !task.done && task.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || sortTasks(a, b))
    .slice(0, 7);

  if (!nextTasks.length) {
    elements.upcomingList.innerHTML = `<div class="empty-state compact">未完了の予定はありません</div>`;
    return;
  }

  elements.upcomingList.innerHTML = nextTasks.map(renderMiniTask).join("");
}

function renderMiniTask(task) {
  const priority = PRIORITY_META[task.priority];
  const dueClass = isOverdue(task) ? "is-overdue" : isDueToday(task) ? "is-today" : "";
  const meta = [
    formatCompactDate(task.date),
    task.time || "時間なし",
    task.project || task.category,
  ].filter(Boolean);

  return `
    <button class="mini-task priority-${task.priority} ${dueClass}" type="button" data-action="edit" data-id="${task.id}" data-help="このタスクを編集します。重要度、担当、日付、メモ、完了状態などを確認・変更できます。">
      <span class="mini-priority"><i data-lucide="${priority.icon}"></i>${priority.label}</span>
      <strong>${escapeHtml(task.title)}</strong>
      <span>${escapeHtml(meta.join(" / "))}</span>
    </button>
  `;
}

function renderCalendar() {
  if (state.view === "day") {
    renderDay();
    return;
  }
  if (state.view === "week") {
    renderWeek();
    return;
  }
  renderMonth();
}

function updateVisibleSummary(tasks) {
  const completed = tasks.filter((task) => task.done).length;
  const active = tasks.length - completed;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  elements.visibleSummary.textContent = `未完了 ${active}件 / 完了 ${completed}件`;
  elements.progressFill.style.width = `${rate}%`;
}

function renderDay() {
  const dayTasks = tasksOn(state.anchorDate);
  updateVisibleSummary(dayTasks);

  const columns = [
    {
      title: "時間なし",
      subtitle: "終日",
      tasks: dayTasks.filter((task) => !task.time),
    },
    {
      title: "午前",
      subtitle: "00:00 - 11:59",
      tasks: dayTasks.filter((task) => task.time && task.time < "12:00"),
    },
    {
      title: "午後",
      subtitle: "12:00 - 23:59",
      tasks: dayTasks.filter((task) => task.time && task.time >= "12:00"),
    },
  ];

  elements.calendarArea.innerHTML = `
    <div class="day-board">
      ${columns.map((column) => renderColumn(column, state.anchorDate)).join("")}
    </div>
  `;
}

function renderWeek() {
  const start = startOfWeek(state.anchorDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const weekTasks = weekDays.flatMap((day) => tasksOn(day));
  updateVisibleSummary(weekTasks);

  elements.calendarArea.innerHTML = `
    <div class="week-board">
      ${weekDays
        .map((day) =>
          renderColumn(
            {
              title: formatDate(day),
              subtitle: isSameDay(day, new Date()) ? "今日" : `${tasksOn(day).length}件`,
              tasks: tasksOn(day),
            },
            day,
          ),
        )
        .join("")}
    </div>
  `;
}

function renderColumn(column, date) {
  return `
    <section class="${state.view === "week" ? "week-column" : "day-column"}">
      <div class="column-head">
        <div>
          <h3>${escapeHtml(column.title)}</h3>
          <span>${escapeHtml(column.subtitle)}</span>
        </div>
        <button class="add-date-button" type="button" data-action="open-new" data-date="${toYmd(date)}" aria-label="この日に追加" data-help="この日付を指定して新しいタスクを追加します。週表示や月表示で予定を見ながら登録できます。">
          <i data-lucide="plus"></i>
        </button>
      </div>
      <div class="task-list">
        ${column.tasks.length ? column.tasks.map(renderTaskCard).join("") : `<div class="empty-state">予定なし</div>`}
      </div>
    </section>
  `;
}

function renderMonth() {
  const firstDay = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth(), 1);
  const calendarStart = startOfWeek(firstDay);
  const days = Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
  const monthTasks = tasksInRange(
    firstDay,
    new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0),
    filteredTasks(),
  );
  updateVisibleSummary(monthTasks);

  elements.calendarArea.innerHTML = `
    <div class="month-wrap">
      <div class="month-weekdays">
        ${WEEKDAYS.map((day) => `<div>${day}</div>`).join("")}
      </div>
      <div class="month-grid">
        ${days.map(renderMonthCell).join("")}
      </div>
    </div>
  `;
}

function renderMonthCell(day) {
  const allTasks = tasksOn(day);
  const cellTasks = allTasks.slice(0, 4);
  const outside = day.getMonth() !== state.anchorDate.getMonth();
  const today = isSameDay(day, new Date());
  return `
    <section class="month-cell ${outside ? "is-outside" : ""} ${today ? "is-today" : ""}">
      <div class="month-day-head">
        <div>
          <h3>${day.getDate()}日</h3>
          <span>${allTasks.length}件</span>
        </div>
        <button class="add-date-button" type="button" data-action="open-new" data-date="${toYmd(day)}" aria-label="この日に追加" data-help="この日付を指定して新しいタスクを追加します。月全体を見ながら予定を配置できます。">
          <i data-lucide="plus"></i>
        </button>
      </div>
      <div class="month-tasks">
        ${cellTasks.map(renderMonthChip).join("")}
      </div>
      ${allTasks.length > 4 ? `<div class="more-count">+${allTasks.length - 4}件</div>` : ""}
    </section>
  `;
}

function renderMonthChip(task) {
  const priority = PRIORITY_META[task.priority];
  return `
    <button class="month-chip priority-${task.priority} ${task.done ? "is-done" : ""}" type="button" data-action="edit" data-id="${task.id}" data-help="この月表示のタスクを編集します。最重要タスクは赤系で表示され、月内でも見つけやすくなっています。">
      <i data-lucide="${task.done ? "check-circle-2" : priority.icon}"></i>
      <span>${escapeHtml(task.title)}</span>
    </button>
  `;
}

function renderTaskCard(task) {
  const priority = PRIORITY_META[task.priority];
  const dueClass = isOverdue(task) ? "is-overdue" : isDueToday(task) ? "is-today" : "";
  return `
    <article class="task-card priority-${task.priority} ${dueClass} ${task.done ? "is-done" : ""}">
      <button class="check-button" type="button" data-action="toggle-done" data-id="${task.id}" aria-label="完了を切り替え" data-help="このタスクの完了/未完了を切り替えます。完了にするとカードが薄くなり、完了率に反映されます。">
        <i data-lucide="${task.done ? "check-circle-2" : "circle"}"></i>
      </button>
      <div class="task-body">
        <div class="task-title-row">
          <button class="task-title-button" type="button" data-action="edit" data-id="${task.id}" data-help="このタスクの編集画面を開きます。案件、担当、日付、重要度、メモ、削除などを操作できます。">
            <i data-lucide="${priority.icon}"></i>
            <span>${escapeHtml(task.title)}</span>
          </button>
          <span class="due-badge ${dueClass}">${escapeHtml(formatDueLabel(task))}</span>
        </div>
        <div class="task-meta">
          ${task.time ? `<span>${task.time}</span>` : `<span>時間なし</span>`}
          ${task.project ? `<span class="pill project">${escapeHtml(task.project)}</span>` : ""}
          ${task.owner ? `<span class="pill owner">${escapeHtml(task.owner)}</span>` : ""}
          <span class="pill">${escapeHtml(task.category)}</span>
          <span class="pill priority-${task.priority}">${priority.label}</span>
        </div>
        ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ""}
      </div>
    </article>
  `;
}

function formatDueLabel(task) {
  if (task.done) {
    return "完了";
  }
  if (isOverdue(task)) {
    return "期限超過";
  }
  if (isDueToday(task)) {
    return "今日";
  }
  const tomorrow = toYmd(addDays(new Date(), 1));
  if (task.date === tomorrow) {
    return "明日";
  }
  return formatCompactDate(task.date);
}

function isSameDay(a, b) {
  return toYmd(a) === toYmd(startOfDay(b));
}

function openTaskDialog({ id = null, date = null } = {}) {
  const task = id ? state.tasks.find((item) => item.id === id) : null;
  state.editingId = id;
  elements.form.reset();
  elements.dialogTitle.textContent = task ? "タスク編集" : "タスク追加";
  elements.deleteTaskButton.classList.toggle("is-hidden", !task);

  elements.form.elements.title.value = task?.title || "";
  elements.form.elements.project.value = task?.project || "";
  elements.form.elements.owner.value = task?.owner || "";
  elements.form.elements.date.value = task?.date || date || toYmd(state.anchorDate);
  elements.form.elements.time.value = task?.time || "";
  setSelectValue(elements.form.elements.category, task?.category || "顧客対応");
  elements.form.elements.priority.value = task?.priority || "normal";
  elements.form.elements.notes.value = task?.notes || "";
  elements.form.elements.done.checked = Boolean(task?.done);

  elements.dialog.showModal();
  window.setTimeout(() => elements.form.elements.title.focus(), 0);
  decorateIcons();
}

function setSelectValue(select, value) {
  if (![...select.options].some((option) => option.value === value)) {
    const option = new Option(value, value);
    select.add(option);
  }
  select.value = value;
}

function closeTaskDialog() {
  elements.dialog.close();
  state.editingId = null;
}

function openHelpDialog() {
  hideQuickHelp();
  elements.helpDialog.showModal();
  decorateIcons();
}

function closeHelpDialog() {
  hideQuickHelp();
  elements.helpDialog.close();
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = elements.form;
  const submitButton = form.querySelector('button[type="submit"]');
  const taskData = {
    title: form.elements.title.value.trim(),
    project: form.elements.project.value.trim(),
    owner: form.elements.owner.value.trim(),
    date: form.elements.date.value,
    time: form.elements.time.value,
    category: form.elements.category.value,
    priority: form.elements.priority.value,
    notes: form.elements.notes.value.trim(),
    done: form.elements.done.checked,
  };

  if (!taskData.title) {
    form.elements.title.focus();
    return;
  }

  submitButton.disabled = true;
  setSyncStatus("保存中", "muted");
  try {
    await saveTaskToServer(taskData);
    closeTaskDialog();
  } catch (error) {
    setSyncStatus("保存失敗", "error");
    alert(error.message || "保存できませんでした。");
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteCurrentTask() {
  if (!state.editingId) {
    return;
  }
  elements.deleteTaskButton.disabled = true;
  setSyncStatus("削除中", "muted");
  try {
    await deleteTaskFromServer(state.editingId);
    closeTaskDialog();
  } catch (error) {
    setSyncStatus("削除失敗", "error");
    alert(error.message || "削除できませんでした。");
  } finally {
    elements.deleteTaskButton.disabled = false;
  }
}

function moveAnchor(direction) {
  if (state.view === "day") {
    state.anchorDate = addDays(state.anchorDate, direction);
  } else if (state.view === "week") {
    state.anchorDate = addDays(state.anchorDate, direction * 7);
  } else {
    state.anchorDate = addMonths(state.anchorDate, direction);
  }
  render();
}

function scheduleQuickHelp(target, x, y) {
  const message = target.dataset.help;
  if (!message) {
    return;
  }

  clearTimeout(quickHelpTimer);
  quickHelpTarget = target;
  quickHelpPoint = { x, y };
  quickHelpTimer = window.setTimeout(() => showQuickHelp(target), 560);
}

function showQuickHelp(target) {
  if (quickHelpTarget !== target || !target.isConnected) {
    return;
  }

  elements.quickHelp.textContent = target.dataset.help;
  elements.quickHelp.hidden = false;
  elements.quickHelp.style.left = "0px";
  elements.quickHelp.style.top = "0px";

  const tooltipRect = elements.quickHelp.getBoundingClientRect();
  const margin = 12;
  const x = Math.min(
    window.innerWidth - tooltipRect.width - margin,
    Math.max(margin, quickHelpPoint.x + 14),
  );
  const y = Math.min(
    window.innerHeight - tooltipRect.height - margin,
    Math.max(margin, quickHelpPoint.y + 18),
  );

  elements.quickHelp.style.left = `${x}px`;
  elements.quickHelp.style.top = `${y}px`;
}

function hideQuickHelp() {
  clearTimeout(quickHelpTimer);
  quickHelpTimer = null;
  quickHelpTarget = null;
  elements.quickHelp.hidden = true;
}

function findHelpTarget(event) {
  return event.target.closest("[data-help]");
}

document.addEventListener("click", async (event) => {
  hideQuickHelp();
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const action = actionTarget.dataset.action;
  const id = actionTarget.dataset.id;
  const date = actionTarget.dataset.date;

  if (action === "prev") {
    moveAnchor(-1);
  }
  if (action === "next") {
    moveAnchor(1);
  }
  if (action === "today") {
    state.anchorDate = startOfDay(new Date());
    render();
  }
  if (action === "open-new") {
    openTaskDialog({ date });
  }
  if (action === "edit" && id) {
    openTaskDialog({ id });
  }
  if (action === "toggle-done" && id) {
    actionTarget.disabled = true;
    setSyncStatus("同期中", "muted");
    try {
      await toggleTaskDoneOnServer(id);
    } catch (error) {
      setSyncStatus("同期失敗", "error");
      alert(error.message || "更新できませんでした。");
    } finally {
      actionTarget.disabled = false;
    }
  }
  if (action === "close-dialog") {
    closeTaskDialog();
  }
  if (action === "delete-task") {
    await deleteCurrentTask();
  }
  if (action === "open-help") {
    openHelpDialog();
  }
  if (action === "close-help") {
    closeHelpDialog();
  }
  if (action === "logout") {
    await logout();
  }
});

document.addEventListener("click", (event) => {
  const viewTarget = event.target.closest("[data-view]");
  if (!viewTarget) {
    return;
  }
  state.view = viewTarget.dataset.view;
  render();
});

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

elements.statusFilter.addEventListener("change", (event) => {
  state.status = event.target.value;
  render();
});

elements.priorityFilter.addEventListener("change", (event) => {
  state.priority = event.target.value;
  render();
});

elements.form.addEventListener("submit", handleSubmit);

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = elements.loginPassword.value;
  const submitButton = elements.loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await loginWithPassword(password);
    elements.loginPassword.value = "";
  } catch (error) {
    setAuthMessage(error.message || "ログインできませんでした。");
    setSyncStatus("未ログイン", "muted");
  } finally {
    submitButton.disabled = false;
  }
});

elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) {
    closeTaskDialog();
  }
});

elements.helpDialog.addEventListener("click", (event) => {
  if (event.target === elements.helpDialog) {
    closeHelpDialog();
  }
});

document.addEventListener("pointerover", (event) => {
  const target = findHelpTarget(event);
  if (!target) {
    return;
  }
  scheduleQuickHelp(target, event.clientX, event.clientY);
});

document.addEventListener("pointermove", (event) => {
  const target = findHelpTarget(event);
  if (!target) {
    if (quickHelpTarget) {
      hideQuickHelp();
    }
    return;
  }
  if (target !== quickHelpTarget) {
    scheduleQuickHelp(target, event.clientX, event.clientY);
    return;
  }
  scheduleQuickHelp(target, event.clientX, event.clientY);
});

document.addEventListener("pointerout", (event) => {
  const target = findHelpTarget(event);
  if (!target || target.contains(event.relatedTarget)) {
    return;
  }
  hideQuickHelp();
});

document.addEventListener("focusin", (event) => {
  const target = findHelpTarget(event);
  if (!target) {
    return;
  }
  const rect = target.getBoundingClientRect();
  scheduleQuickHelp(target, rect.left + rect.width / 2, rect.bottom);
});

document.addEventListener("focusout", (event) => {
  if (findHelpTarget(event)) {
    hideQuickHelp();
  }
});

document.addEventListener("scroll", hideQuickHelp, true);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.authenticated) {
    loadTasksFromServer({ quiet: true }).catch(() => setSyncStatus("同期失敗", "error"));
  }
});

async function initializeApp() {
  showLogin("");
  render();
  decorateIcons();
  try {
    const session = await apiRequest("/api/session");
    if (!session.configured) {
      showLogin("Renderの環境変数 APP_PASSWORD を設定してください。");
      return;
    }
    if (!session.authenticated) {
      showLogin("");
      return;
    }
    showApp();
    await loadTasksFromServer();
    startSync();
  } catch (error) {
    showLogin(error.message || "接続できませんでした。");
  }
}

initializeApp();
