// Application State Object
let state = {
  settings: {
    totalRecords: 3500,
    weeklyTarget: 300,
    startDate: "2026-06-01",
    dueDate: "2026-08-31",
    reviewer1Name: "Dr. Sarah Jenkins",
    reviewer2Name: "Dr. David Kim"
  },
  logs: []
};

// Cloud Database Endpoint (KVDB.io Bucket & Key)
const DB_URL = "https://kvdb.io/SHdLEPg2V5HvhTRvmNXXZ1/sr_tracker_serena130193";

// Chart Instances
let weeklyChartInstance = null;
let cumulativeChartInstance = null;

// Realistic Mock Data for first-time view
const mockLogs = [
  { id: "mock-1", reviewerId: "reviewer1", weekLabel: "Week 1 (Jun 01 - Jun 07)", screened: 220, notes: "Deduplicated articles database loaded." },
  { id: "mock-2", reviewerId: "reviewer2", weekLabel: "Week 1 (Jun 01 - Jun 07)", screened: 250, notes: "Completed initial search matches." },
  { id: "mock-3", reviewerId: "reviewer1", weekLabel: "Week 2 (Jun 08 - Jun 14)", screened: 310, notes: "PubMed abstracts screen complete." },
  { id: "mock-4", reviewerId: "reviewer2", weekLabel: "Week 2 (Jun 08 - Jun 14)", screened: 280, notes: "Scopus search abstracts filter completed." },
  { id: "mock-5", reviewerId: "reviewer1", weekLabel: "Week 3 (Jun 15 - Jun 21)", screened: 340, notes: "High screening rate achieved." },
  { id: "mock-6", reviewerId: "reviewer2", weekLabel: "Week 3 (Jun 15 - Jun 21)", screened: 390, notes: "Embase search matches resolved." },
  { id: "mock-7", reviewerId: "reviewer1", weekLabel: "Week 4 (Jun 22 - Jun 28)", screened: 410, notes: "Title reviews finalizing." },
  { id: "mock-8", reviewerId: "reviewer2", weekLabel: "Week 4 (Jun 22 - Jun 28)", screened: 380, notes: "Weekly sync meeting updates added." }
];

// Initialize the Application
document.addEventListener("DOMContentLoaded", async () => {
  loadState();
  initLucide();
  initFormSelectors();
  initWeekOptions();
  initSettingsFormValues();
  initTabNavigation();
  initEventListeners();
  initCharts();
  updateUI();
  
  // Sync with cloud database in background
  await syncWithCloud();
});

// Load state from LocalStorage or initialize with defaults
function loadState() {
  const savedState = localStorage.getItem("systematic_review_dashboard_state");
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      if (!state.settings.weeklyTarget) state.settings.weeklyTarget = 300;
      if (!state.settings.startDate) state.settings.startDate = "2026-06-01";
      if (!state.settings.dueDate) state.settings.dueDate = "2026-08-31";
    } catch (e) {
      console.error("Failed to parse local storage state.", e);
    }
  } else {
    state.logs = [...mockLogs];
    saveState();
  }
}

// Save state to LocalStorage and trigger background cloud save
function saveState() {
  localStorage.setItem("systematic_review_dashboard_state", JSON.stringify(state));
  saveStateToCloud();
}

// Re-initialize Lucide Icons
function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Populate Reviewer Dropdowns dynamically based on Settings
function initFormSelectors() {
  const logReviewerSelect = document.getElementById("log-reviewer");
  if (logReviewerSelect) {
    logReviewerSelect.innerHTML = `
      <option value="reviewer1">${state.settings.reviewer1Name}</option>
      <option value="reviewer2">${state.settings.reviewer2Name}</option>
    `;
  }
}

// Fill Settings Form fields with current values
function initSettingsFormValues() {
  document.getElementById("setting-total-records").value = state.settings.totalRecords;
  document.getElementById("setting-weekly-target").value = state.settings.weeklyTarget || 300;
  document.getElementById("setting-start-date").value = state.settings.startDate || "2026-06-01";
  document.getElementById("setting-due-date").value = state.settings.dueDate || "2026-08-31";
  document.getElementById("setting-reviewer1-name").value = state.settings.reviewer1Name;
  document.getElementById("setting-reviewer2-name").value = state.settings.reviewer2Name;
  
  const statusText = document.getElementById("cloud-connection-status");
  if (statusText) {
    statusText.textContent = "Status: Connected to Cloud Database (Active)";
    statusText.style.color = "#0d9488";
  }
  
  document.getElementById("reviewer1-name-display").textContent = state.settings.reviewer1Name;
  document.getElementById("reviewer2-name-display").textContent = state.settings.reviewer2Name;
}

// Set up Tab Switching Logic
function initTabNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.getAttribute("data-tab");
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-tab") === tabId) btn.classList.add("active");
  });

  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.remove("active");
  });
  
  const activeView = document.getElementById(`tab-${tabId}`);
  if (activeView) activeView.classList.add("active");

  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");
  
  if (tabId === "dashboard") {
    pageTitle.textContent = "Dashboard Overview";
    pageSubtitle.textContent = "Track, analyze, and compare reviewer progress";
    updateCharts();
  } else if (tabId === "logs") {
    pageTitle.textContent = "Weekly screening logs";
    pageSubtitle.textContent = "Manage reviewer outputs and update counts";
  } else if (tabId === "settings") {
    pageTitle.textContent = "Project Configuration";
    pageSubtitle.textContent = "Adjust team members, targets, and database syncs";
  }
}

// Attach Form and Action Event Listeners
function initEventListeners() {
  document.getElementById("log-form").addEventListener("submit", handleLogSubmit);
  document.getElementById("settings-form").addEventListener("submit", handleSettingsSubmit);
  
  const syncBtn = document.getElementById("btn-force-sync");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => syncWithCloud(true));
  }
  
  document.getElementById("btn-export").addEventListener("click", exportData);
  
  const importTrigger = document.getElementById("btn-trigger-import");
  const importInput = document.getElementById("import-file-input");
  importTrigger.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", handleImportFile);

  document.getElementById("btn-cancel-edit").addEventListener("click", cancelLogEdit);
}

// Compute Statistics and Update Dashboard DOM elements
function updateUI() {
  const logs = state.logs;
  const settings = state.settings;
  
  const r1Logs = logs.filter(l => l.reviewerId === "reviewer1");
  const r2Logs = logs.filter(l => l.reviewerId === "reviewer2");
  
  const r1Total = r1Logs.reduce((sum, item) => sum + parseInt(item.screened || 0), 0);
  const r2Total = r2Logs.reduce((sum, item) => sum + parseInt(item.screened || 0), 0);
  
  const averageScreened = Math.round((r1Total + r2Total) / 2);
  const totalRecords = settings.totalRecords || 1; 
  
  const completionPct = Math.min(100, Math.round((averageScreened / totalRecords) * 100));
  const r1Pct = Math.min(100, Math.round((r1Total / totalRecords) * 100));
  const r2Pct = Math.min(100, Math.round((r2Total / totalRecords) * 100));
  
  const remainingRecords = Math.max(0, totalRecords - averageScreened);
  const remainingPct = Math.round((remainingRecords / totalRecords) * 100);

  const uniqueWeeks = [...new Set(logs.map(l => l.weekLabel))];
  const numWeeks = uniqueWeeks.length || 1;
  const weeklyVelocity = Math.round(averageScreened / numWeeks);
  
  document.getElementById("val-total-screened").textContent = averageScreened.toLocaleString();
  document.getElementById("desc-total-screened").textContent = `${completionPct}% of total database`;
  document.getElementById("val-total-records").textContent = totalRecords.toLocaleString();
  
  const today = new Date();
  const due = new Date(settings.dueDate || "2026-08-31");
  today.setHours(0,0,0,0);
  due.setHours(0,0,0,0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  const weeksRemaining = Math.ceil(diffDays / 7);
  
  let weeksLeftStr = "";
  if (weeksRemaining > 1) {
    weeksLeftStr = ` ΓÇó ${weeksRemaining} wks left`;
  } else if (weeksRemaining === 1) {
    weeksLeftStr = ` ΓÇó 1 wk left`;
  } else if (weeksRemaining === 0) {
    weeksLeftStr = ` ΓÇó Due this week`;
  } else {
    weeksLeftStr = ` ΓÇó ${Math.abs(weeksRemaining)} wks overdue`;
  }
  
  document.getElementById("val-remaining-records").textContent = remainingRecords.toLocaleString();
  document.getElementById("desc-remaining-records").textContent = `${remainingPct}% left to screen${weeksLeftStr}`;
  
  document.getElementById("val-weekly-velocity").textContent = weeklyVelocity.toLocaleString();
  document.getElementById("desc-weekly-velocity").textContent = `Avg vs. ${settings.weeklyTarget || 300} goal`;

  document.getElementById("txt-completion-pct").textContent = `${completionPct}%`;
  document.getElementById("bar-completion-pct").style.width = `${completionPct}%`;
  
  document.getElementById("val-r1-screened").textContent = r1Total.toLocaleString();
  document.getElementById("val-r1-pct").textContent = `${r1Pct}%`;
  document.getElementById("bar-r1-pct").style.width = `${r1Pct}%`;
  const r1Weeks = r1Logs.length || 1;
  document.getElementById("val-r1-avg").textContent = Math.round(r1Total / r1Weeks).toLocaleString();
  
  document.getElementById("val-r2-screened").textContent = r2Total.toLocaleString();
  document.getElementById("val-r2-pct").textContent = `${r2Pct}%`;
  document.getElementById("bar-r2-pct").style.width = `${r2Pct}%`;
  const r2Weeks = r2Logs.length || 1;
  document.getElementById("val-r2-avg").textContent = Math.round(r2Total / r2Weeks).toLocaleString();
  
  renderLogsTable();
  updateCharts();
}

// Populate the Weekly History Logs Table
function renderLogsTable() {
  const tableBody = document.getElementById("logs-table-body");
  const emptyState = document.getElementById("logs-empty-state");
  
  tableBody.innerHTML = "";
  if (state.logs.length === 0) {
    emptyState.style.display = "flex";
    return;
  }
  
  emptyState.style.display = "none";
  
  // Sort logs chronologically by extracting week number
  const sortedLogs = [...state.logs].sort((a, b) => {
    const wA = parseInt(a.weekLabel.match(/\d+/)) || 0;
    const wB = parseInt(b.weekLabel.match(/\d+/)) || 0;
    if (wA !== wB) return wA - wB;
    return a.reviewerId.localeCompare(b.reviewerId);
  });
  
  sortedLogs.forEach(log => {
    const tr = document.createElement("tr");
    const reviewerName = log.reviewerId === "reviewer1" ? state.settings.reviewer1Name : state.settings.reviewer2Name;
    
    tr.innerHTML = `
      <td>${log.weekLabel}</td>
      <td>
        <span class="reviewer-badge ${log.reviewerId === 'reviewer1' ? 'badge-r1' : 'badge-r2'}">
          ${reviewerName}
        </span>
      </td>
      <td style="font-weight: 600;">${parseInt(log.screened).toLocaleString()}</td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">${log.notes || "-"}</td>
      <td class="actions-col">
        <button class="action-btn btn-edit" onclick="editLog('${log.id}')" title="Edit Log">
          <i data-lucide="edit-2"></i>
        </button>
        <button class="action-btn btn-delete" onclick="deleteLog('${log.id}')" title="Delete Log">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
  initLucide();
}

// Initialize Week selection options based on Start & Due dates
function initWeekOptions() {
  const select = document.getElementById("log-week");
  if (!select) return;
  
  select.innerHTML = "";
  const start = new Date(state.settings.startDate);
  const due = new Date(state.settings.dueDate);
  
  const diffDays = Math.ceil((due - start) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.max(1, Math.ceil(diffDays / 7));
  
  let currentStart = new Date(start);
  for (let i = 1; i <= totalWeeks; i++) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 6);
    
    const label = `Week ${i} (${formatDateLabel(currentStart)} - ${formatDateLabel(currentEnd)})`;
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    select.appendChild(option);
    
    currentStart.setDate(currentStart.getDate() + 7);
  }
  
  // Auto-select current week based on today's date
  const today = new Date();
  today.setHours(0,0,0,0);
  let selectedIdx = 0;
  
  let tempStart = new Date(start);
  for (let i = 0; i < totalWeeks; i++) {
    let tempEnd = new Date(tempStart);
    tempEnd.setDate(tempEnd.getDate() + 6);
    tempEnd.setHours(23,59,59,999);
    
    if (today >= tempStart && today <= tempEnd) {
      selectedIdx = i;
      break;
    }
    tempStart.setDate(tempStart.getDate() + 7);
  }
  
  select.selectedIndex = selectedIdx;
}

// Form Handlers
function handleLogSubmit(e) {
  e.preventDefault();
  
  const weekLabel = document.getElementById("log-week").value;
  const reviewerId = document.getElementById("log-reviewer").value;
  const screened = parseInt(document.getElementById("log-screened").value);
  const notes = document.getElementById("log-notes").value.trim();
  const editId = document.getElementById("log-edit-id").value;
  
  if (isNaN(screened) || screened < 0) {
    alert("Please enter a valid screening number.");
    return;
  }
  
  if (editId) {
    const idx = state.logs.findIndex(l => l.id === editId);
    if (idx !== -1) {
      state.logs[idx] = { id: editId, weekLabel, reviewerId, screened, notes };
    }
    document.getElementById("log-edit-id").value = "";
    document.getElementById("btn-submit-log").querySelector("span").textContent = "Submit Entry";
    document.getElementById("btn-cancel-edit").style.display = "none";
  } else {
    const exists = state.logs.some(l => l.weekLabel === weekLabel && l.reviewerId === reviewerId);
    if (exists) {
      if (!confirm(`Reviewer already has a log for this week. Overwrite it?`)) return;
      state.logs = state.logs.filter(l => !(l.weekLabel === weekLabel && l.reviewerId === reviewerId));
    }
    
    const newLog = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      weekLabel,
      reviewerId,
      screened,
      notes
    };
    state.logs.push(newLog);
  }
  
  saveState();
  updateUI();
  
  document.getElementById("log-screened").value = "";
  document.getElementById("log-notes").value = "";
}

function handleSettingsSubmit(e) {
  e.preventDefault();
  
  const totalRecords = parseInt(document.getElementById("setting-total-records").value);
  const weeklyTarget = parseInt(document.getElementById("setting-weekly-target").value);
  const startDate = document.getElementById("setting-start-date").value;
  const dueDate = document.getElementById("setting-due-date").value;
  const reviewer1Name = document.getElementById("setting-reviewer1-name").value.trim();
  const reviewer2Name = document.getElementById("setting-reviewer2-name").value.trim();
  
  if (new Date(dueDate) <= new Date(startDate)) {
    alert("Due date must be after the start date.");
    return;
  }
  
  state.settings = { totalRecords, weeklyTarget, startDate, dueDate, reviewer1Name, reviewer2Name };
  
  saveState();
  initFormSelectors();
  initWeekOptions();
  initSettingsFormValues();
  updateUI();
  
  alert("Settings updated successfully!");
  switchTab("dashboard");
}

// Edit & Delete Logs
window.editLog = function(id) {
  const log = state.logs.find(l => l.id === id);
  if (!log) return;
  
  switchTab("logs");
  
  document.getElementById("log-week").value = log.weekLabel;
  document.getElementById("log-reviewer").value = log.reviewerId;
  document.getElementById("log-screened").value = log.screened;
  document.getElementById("log-notes").value = log.notes || "";
  document.getElementById("log-edit-id").value = log.id;
  
  document.getElementById("btn-submit-log").querySelector("span").textContent = "Save Changes";
  document.getElementById("btn-cancel-edit").style.display = "inline-flex";
};

window.deleteLog = function(id) {
  if (!confirm("Are you sure you want to delete this log?")) return;
  state.logs = state.logs.filter(l => l.id !== id);
  saveState();
  updateUI();
};

function cancelLogEdit() {
  document.getElementById("log-edit-id").value = "";
  document.getElementById("log-screened").value = "";
  document.getElementById("log-notes").value = "";
  document.getElementById("btn-submit-log").querySelector("span").textContent = "Submit Entry";
  document.getElementById("btn-cancel-edit").style.display = "none";
}

// Chart.js Initialization
function initCharts() {
  const ctxWeekly = document.getElementById("weeklyChart");
  const ctxCumulative = document.getElementById("cumulativeChart");
  
  if (!ctxWeekly || !ctxCumulative) return;
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { boxWidth: 12, font: { family: "Inter", size: 11 } } },
      tooltip: { padding: 10 }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "rgba(0, 0, 0, 0.05)" }, beginAtZero: true }
    }
  };
  
  weeklyChartInstance = new Chart(ctxWeekly, {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: chartOptions
  });
  
  cumulativeChartInstance = new Chart(ctxCumulative, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: chartOptions
  });
}

// Redraw / Update Charts
function updateCharts() {
  if (!weeklyChartInstance || !cumulativeChartInstance) return;
  
  const logs = state.logs;
  const settings = state.settings;
  
  // Compile list of unique weeks logged or generated
  const start = new Date(settings.startDate);
  const due = new Date(settings.dueDate);
  const diffDays = Math.ceil((due - start) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.max(1, Math.ceil(diffDays / 7));
  
  const labels = [];
  const r1Data = [];
  const r2Data = [];
  const r1Cum = [];
  const r2Cum = [];
  const targetTrajectory = [];
  const ceiling = [];
  
  let currentStart = new Date(start);
  let r1Sum = 0;
  let r2Sum = 0;
  
  for (let i = 1; i <= totalWeeks; i++) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 6);
    const weekLabel = `Week ${i} (${formatDateLabel(currentStart)} - ${formatDateLabel(currentEnd)})`;
    
    labels.push(`Wk ${i}`);
    
    const r1Log = logs.find(l => l.weekLabel === weekLabel && l.reviewerId === "reviewer1");
    const r2Log = logs.find(l => l.weekLabel === weekLabel && l.reviewerId === "reviewer2");
    
    const r1Val = r1Log ? parseInt(r1Log.screened) : 0;
    const r2Val = r2Log ? parseInt(r2Log.screened) : 0;
    
    r1Data.push(r1Val);
    r2Data.push(r2Val);
    
    r1Sum += r1Val;
    r2Sum += r2Val;
    
    // Only plot cumulative if data has actually been logged up to this week
    const hasLogThisWeek = r1Log || r2Log;
    const isFutureWeek = i > Math.max(
      ...logs.map(l => parseInt(l.weekLabel.match(/\d+/)) || 0), 
      0
    );
    
    if (isFutureWeek) {
      r1Cum.push(null);
      r2Cum.push(null);
    } else {
      r1Cum.push(r1Sum);
      r2Cum.push(r2Sum);
    }
    
    targetTrajectory.push(Math.min(settings.totalRecords, i * (settings.weeklyTarget || 300)));
    ceiling.push(settings.totalRecords);
    
    currentStart.setDate(currentStart.getDate() + 7);
  }
  
  // Update Weekly Chart
  weeklyChartInstance.data.labels = labels;
  weeklyChartInstance.data.datasets = [
    { label: settings.reviewer1Name, data: r1Data, backgroundColor: "#3b82f6", borderRadius: 4 },
    { label: settings.reviewer2Name, data: r2Data, backgroundColor: "#10b981", borderRadius: 4 },
    { label: "Weekly Goal", data: Array(labels.length).fill(settings.weeklyTarget || 300), type: "line", borderColor: "#f59e0b", borderDash: [5, 5], fill: false, pointStyle: "none", order: -1 }
  ];
  weeklyChartInstance.update();
  
  // Update Cumulative Chart
  cumulativeChartInstance.data.labels = labels;
  cumulativeChartInstance.data.datasets = [
    { label: settings.reviewer1Name, data: r1Cum, borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", fill: true, tension: 0.1 },
    { label: settings.reviewer2Name, data: r2Cum, borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", fill: true, tension: 0.1 },
    { label: "Target Path", data: targetTrajectory, borderColor: "#84cc16", borderDash: [4, 4], fill: false, tension: 0, pointStyle: "none" },
    { label: "Ceiling", data: ceiling, borderColor: "#ef4444", borderDash: [2, 2], fill: false, tension: 0, pointStyle: "none" }
  ];
  cumulativeChartInstance.update();
}

// Backup Triggers
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `systematic_review_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function handleImportFile(e) {
  const fileReader = new FileReader();
  const file = e.target.files[0];
  if (!file) return;
  
  fileReader.onload = function(event) {
    try {
      const importedState = JSON.parse(event.target.result);
      if (importedState && importedState.settings && importedState.logs) {
        state = importedState;
        saveState();
        initFormSelectors();
        initWeekOptions();
        initSettingsFormValues();
        updateUI();
        alert("Backup data successfully imported!");
      } else {
        alert("Invalid file format. Backup must contain settings and logs.");
      }
    } catch (err) {
      alert("Failed to parse JSON backup file.");
    }
  };
  fileReader.readAsText(file);
}

// Helper: Format Date to short month + day (e.g. Jun 01)
function formatDateLabel(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[date.getMonth()];
  const d = String(date.getDate()).padStart(2, '0');
  return `${m} ${d}`;
}

// Cloud database syncing methods
async function syncWithCloud(showSuccessAlert = false) {
  const statusText = document.getElementById("cloud-connection-status");
  const badgeValue = document.getElementById("cloud-badge-value");
  const badge = document.getElementById("cloud-status-badge");
  
  if (statusText) {
    statusText.textContent = "Status: Syncing with cloud...";
    statusText.style.color = "var(--text-muted)";
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
  
  try {
    const response = await fetch(DB_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.status === 404) {
      if (statusText) statusText.textContent = "Status: Initializing Cloud Database...";
      const success = await saveStateToCloud();
      if (success && statusText) {
        statusText.textContent = "Status: Connected to Cloud Database (Active)";
        statusText.style.color = "#0d9488";
      }
      return;
    }
    if (!response.ok) throw new Error("Failed to fetch cloud database.");
    
    const cloudState = await response.json();
    if (cloudState && cloudState.settings && cloudState.logs) {
      state = cloudState;
      localStorage.setItem("systematic_review_dashboard_state", JSON.stringify(state));
      initFormSelectors();
      initWeekOptions();
      initSettingsFormValues();
      updateUI();
      
      if (statusText) {
        statusText.textContent = "Status: Connected to Cloud Database (Active)";
        statusText.style.color = "#0d9488";
      }
      if (badge) {
        badge.style.backgroundColor = "#f0fdf4";
        badge.style.borderColor = "#bbf7d0";
        badge.style.color = "#166534";
      }
      if (badgeValue) {
        badgeValue.textContent = "Active";
        badgeValue.style.color = "#15803d";
      }
      if (showSuccessAlert) {
        alert("Dashboard database successfully synchronized with the cloud!");
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Cloud synchronization failed:", err);
    if (statusText) {
      statusText.textContent = "Status: Sync Offline (Using Local Cache)";
      statusText.style.color = "var(--accent)";
    }
    if (badge) {
      badge.style.backgroundColor = "#fef2f2";
      badge.style.borderColor = "#fecaca";
      badge.style.color = "#991b1b";
    }
    if (badgeValue) {
      badgeValue.textContent = "Offline";
      badgeValue.style.color = "#b91c1c";
    }
    if (showSuccessAlert) {
      alert("Synchronization failed: Using local offline cache.\n" + err.message);
    }
  }
}

async function saveStateToCloud() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
  
  try {
    const response = await fetch(DB_URL, {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify(state)
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("Failed to write state updates to cloud database:", err);
    return false;
  }
}
