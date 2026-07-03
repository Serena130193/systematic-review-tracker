// Application State Object
let state = {
  settings: {
    totalRecords: 3500,
    weeklyTarget: 300,
    startDate: "2026-06-01", // Default to match mock data
    dueDate: "2026-08-31", // Default to match mock data (13 weeks)
    reviewer1Name: "Dr. Sarah Jenkins",
    reviewer2Name: "Dr. David Kim"
  },
  logs: []
};

// Cloud Database Endpoint (KVDB.io Bucket & Key)
const DB_URL = "https://kvdb.io/8y834r2bN2u7jB92u6jQ1g/sr_tracker_serena130193";

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
      // Backwards compatibility for settings defaults
      if (!state.settings.weeklyTarget) {
        state.settings.weeklyTarget = 300;
      }
      if (!state.settings.startDate) {
        state.settings.startDate = "2026-06-01";
      }
      if (!state.settings.dueDate) {
        state.settings.dueDate = "2026-08-31";
      }
    } catch (e) {
      console.error("Failed to parse local storage state. Reverting to defaults.", e);
    }
  } else {
    // Populate with mock logs on first launch so the dashboard is immediately visual
    state.logs = [...mockLogs];
    saveState();
  }
}

// Save state to LocalStorage and trigger background cloud save
function saveState() {
  localStorage.setItem("systematic_review_dashboard_state", JSON.stringify(state));
  saveStateToCloud(); // Run asynchronously in the background
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
  
  // Update reviewer names in dashboard card displays
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
  // Toggle navigation button styles
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
    }
  });

  // Toggle views visibility
  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.remove("active");
  });
  
  const activeView = document.getElementById(`tab-${tabId}`);
  if (activeView) {
    activeView.classList.add("active");
  }

  // Update Page Title and Subtitle dynamically
  const pageTitle = document.getElementById("page-title");
  const pageSubtitle = document.getElementById("page-subtitle");
  
  if (tabId === "dashboard") {
    pageTitle.textContent = "Dashboard Overview";
    pageSubtitle.textContent = "Track, analyze, and compare reviewer progress";
    // Redraw charts to ensure responsive canvas fitting
    updateCharts();
  } else if (tabId === "logs") {
    pageTitle.textContent = "Weekly screening logs";
    pageSubtitle.textContent = "Manage reviewer outputs and update counts";
  } else if (tabId === "settings") {
    pageTitle.textContent = "Project Configuration";
    pageSubtitle.textContent = "Adjust team members, targets, and data transfers";
  }
}

// Attach Form and Action Event Listeners
function initEventListeners() {
  // Logs Submit Form
  document.getElementById("log-form").addEventListener("submit", handleLogSubmit);
  
  // Settings Submit Form
  document.getElementById("settings-form").addEventListener("submit", handleSettingsSubmit);
  
  // Cloud Database Force Sync Button
  const syncBtn = document.getElementById("btn-force-sync");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => syncWithCloud(true));
  }
  
  // Export Data Trigger
  document.getElementById("btn-export").addEventListener("click", exportData);
  
  // Import Data Triggers
  const importTrigger = document.getElementById("btn-trigger-import");
  const importInput = document.getElementById("import-file-input");
  
  importTrigger.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", handleImportFile);

  // Cancel edit button
  document.getElementById("btn-cancel-edit").addEventListener("click", cancelLogEdit);
}

// Compute Statistics and Update Dashboard DOM elements
function updateUI() {
  const logs = state.logs;
  const settings = state.settings;
  
  // Calculate Reviewer 1 & 2 Screened Counts
  const r1Logs = logs.filter(l => l.reviewerId === "reviewer1");
  const r2Logs = logs.filter(l => l.reviewerId === "reviewer2");
  
  const r1Total = r1Logs.reduce((sum, item) => sum + parseInt(item.screened || 0), 0);
  const r2Total = r2Logs.reduce((sum, item) => sum + parseInt(item.screened || 0), 0);
  
  // Total Screened (Maximum of either reviewer, or sum? Let's check: 
  // In systematic reviews, screening is usually done independently by both reviewers. 
  // The progress is the maximum checked or the union. Usually, reviewers screen the SAME list of records.
  // Therefore, progress is tracked per reviewer, and the overall team progress corresponds to how much has been screened 
  // by BOTH or at least by the primary. Since they screen the same pool of articles, the progress toward completion 
  // is represented by the average of their efforts or the progress of the slower reviewer, or just showing them side by side.
  // For the 'Total Screened' metric in the card, we will show the average/common screening count or simply the maximum completed 
  // by either reviewer to represent screening progress, with clear indicators of how much each reviewer has screened.
  // Let's use the average of the two, or the maximum. Let's use the average of both reviewers as the 'Team Progress' metric, 
  // or simply display the maximum of the two to show 'Total records touched at least once' (if they divide), 
  // or the average. Let's use the average of both reviewers, since they are screening the same dataset. 
  // Actually, to make it clear, we will show the average screened as the team progress card, but we will make it explicit in the card description.
  // Let's check how systematic review works: reviewers screen the same articles, and then resolve conflicts.
  // So if Reviewer 1 screened 1000 and Reviewer 2 screened 1200, the overall completed consensus is limited by the minimum, 
  // and the maximum shows what has been looked at. Let's show the Average of Reviewer 1 and Reviewer 2.
  const averageScreened = Math.round((r1Total + r2Total) / 2);
  
  // Total Records
  const totalRecords = settings.totalRecords || 1; // avoid divide by zero
  
  // Percentages
  const completionPct = Math.min(100, Math.round((averageScreened / totalRecords) * 100));
  const r1Pct = Math.min(100, Math.round((r1Total / totalRecords) * 100));
  const r2Pct = Math.min(100, Math.round((r2Total / totalRecords) * 100));
  
  // Remaining
  const remainingRecords = Math.max(0, totalRecords - averageScreened);
  const remainingPct = Math.round((remainingRecords / totalRecords) * 100);

  // Velocity (Average screened per week)
  // Let's determine how many unique weeks have logs
  const uniqueWeeks = [...new Set(logs.map(l => l.weekLabel))];
  const numWeeks = uniqueWeeks.length || 1;
  const weeklyVelocity = Math.round(averageScreened / numWeeks);
  
  // Update Metrics Cards in DOM
  document.getElementById("val-total-screened").textContent = averageScreened.toLocaleString();
  document.getElementById("desc-total-screened").textContent = `${completionPct}% of total database`;
  
  document.getElementById("val-total-records").textContent = totalRecords.toLocaleString();
  
  // Calculate weeks remaining dynamically
  const today = new Date();
  const due = new Date(settings.dueDate || "2026-08-31");
  today.setHours(0,0,0,0);
  due.setHours(0,0,0,0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  const weeksRemaining = Math.ceil(diffDays / 7);
  
  let weeksLeftStr = "";
  if (weeksRemaining > 1) {
    weeksLeftStr = ` • ${weeksRemaining} wks left`;
  } else if (weeksRemaining === 1) {
    weeksLeftStr = ` • 1 wk left`;
  } else if (weeksRemaining === 0) {
    weeksLeftStr = ` • Due this week`;
  } else {
    weeksLeftStr = ` • ${Math.abs(weeksRemaining)} wks overdue`;
  }
  
  document.getElementById("val-remaining-records").textContent = remainingRecords.toLocaleString();
  document.getElementById("desc-remaining-records").textContent = `${remainingPct}% left to screen${weeksLeftStr}`;
  
  // Show actual vs expected velocity
  document.getElementById("val-weekly-velocity").textContent = weeklyVelocity.toLocaleString();
  document.getElementById("desc-weekly-velocity").textContent = `Avg vs. ${settings.weeklyTarget || 300} goal`;

  // Update Progress Completion Bars
  document.getElementById("txt-completion-pct").textContent = `${completionPct}%`;
  document.getElementById("bar-completion-pct").style.width = `${completionPct}%`;
  
  // Update Reviewer Specific Cards
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
  
  // Update Logs Table & Empty State
  renderLogsTable();
  
  // Update Chart.js drawings
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
  
  // Sort logs by week Label (optional, we keep insertion order or sort by date/week label)
  // Let's sort alphabetically by week label or order of input. Let's keep it sorted by week title or newest first
  const displayLogs = [...state.logs].reverse(); // newest first
  
  displayLogs.forEach(log => {
    const reviewerName = log.reviewerId === "reviewer1" ? state.settings.reviewer1Name : state.settings.reviewer2Name;
    const tr = document.createElement("tr");
    
    tr.innerHTML = `
      <td><strong>${escapeHTML(log.weekLabel)}</strong></td>
      <td>
        <span class="reviewer-indicator ${log.reviewerId}"></span>
        ${escapeHTML(reviewerName)}
      </td>
      <td><strong>${parseInt(log.screened).toLocaleString()}</strong> articles</td>
      <td class="text-dark">${escapeHTML(log.notes || '-')}</td>
      <td class="actions-col">
        <button class="btn-icon edit" onclick="editLog('${log.id}')" title="Edit entry">
          <i data-lucide="edit-3"></i>
        </button>
        <button class="btn-icon delete" onclick="deleteLog('${log.id}')" title="Delete entry">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
  
  initLucide(); // render icons inside table rows
}

// Add or Edit Log form submission handler
function handleLogSubmit(e) {
  e.preventDefault();
  
  const logId = document.getElementById("edit-log-id").value;
  const reviewerId = document.getElementById("log-reviewer").value;
  const weekLabel = document.getElementById("log-week").value.trim();
  const screened = parseInt(document.getElementById("log-screened").value);
  const notes = document.getElementById("log-notes").value.trim();
  
  if (!reviewerId || !weekLabel || isNaN(screened)) {
    alert("Please fill in all required fields with valid values.");
    return;
  }
  
  if (logId) {
    // Edit existing log
    const index = state.logs.findIndex(l => l.id === logId);
    if (index !== -1) {
      state.logs[index] = { ...state.logs[index], reviewerId, weekLabel, screened, notes };
    }
  } else {
    // Add new log
    const newLog = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      reviewerId,
      weekLabel,
      screened,
      notes
    };
    state.logs.push(newLog);
  }
  
  saveState();
  updateUI();
  
  // Clear and reset form
  document.getElementById("log-form").reset();
  cancelLogEdit(); // Reset edit state if editing
  
  // Show visual feedback & auto-switch back to dashboard
  setTimeout(() => {
    switchTab("dashboard");
  }, 300);
}

// Edit existing log - Populate form
window.editLog = function(id) {
  const log = state.logs.find(l => l.id === id);
  if (!log) return;
  
  // Open logs tab
  switchTab("logs");
  
  // Populate form fields
  document.getElementById("edit-log-id").value = log.id;
  document.getElementById("log-reviewer").value = log.reviewerId;
  document.getElementById("log-week").value = log.weekLabel;
  document.getElementById("log-screened").value = log.screened;
  document.getElementById("log-notes").value = log.notes || "";
  
  // Toggle form action button states
  document.getElementById("btn-submit-text").textContent = "Update Log Entry";
  document.getElementById("btn-cancel-edit").style.display = "inline-flex";
};

// Cancel log editing state
function cancelLogEdit() {
  document.getElementById("edit-log-id").value = "";
  document.getElementById("btn-submit-text").textContent = "Add Log Entry";
  document.getElementById("btn-cancel-edit").style.display = "none";
  document.getElementById("log-form").reset();
  initFormSelectors();
  initWeekOptions(); // Reset week select dropdown to current week
}

// Delete Log entry from database
window.deleteLog = function(id) {
  if (!confirm("Are you sure you want to delete this weekly progress entry?")) {
    return;
  }
  
  state.logs = state.logs.filter(l => l.id !== id);
  saveState();
  updateUI();
};

// Settings Submission handler
function handleSettingsSubmit(e) {
  e.preventDefault();
  
  const totalRecords = parseInt(document.getElementById("setting-total-records").value);
  const weeklyTarget = parseInt(document.getElementById("setting-weekly-target").value);
  const startDate = document.getElementById("setting-start-date").value;
  const dueDate = document.getElementById("setting-due-date").value;
  const reviewer1Name = document.getElementById("setting-reviewer1-name").value.trim();
  const reviewer2Name = document.getElementById("setting-reviewer2-name").value.trim();
  
  if (isNaN(totalRecords) || totalRecords < 1 || isNaN(weeklyTarget) || weeklyTarget < 1 || !startDate || !dueDate || !reviewer1Name || !reviewer2Name) {
    alert("Please enter a valid total records pool, weekly target, project dates, and reviewer names.");
    return;
  }
  
  // Validate that Due Date is after Start Date
  if (new Date(dueDate) <= new Date(startDate)) {
    alert("Project Target Due Date must be after the Project Start Date.");
    return;
  }
  
  state.settings = {
    totalRecords,
    weeklyTarget,
    startDate,
    dueDate,
    reviewer1Name,
    reviewer2Name
  };
  
  saveState();
  initFormSelectors();
  initWeekOptions(); // Regenerate week dropdown options based on new start/due dates
  initSettingsFormValues();
  updateUI();
  
  alert("Settings updated successfully!");
  
  // Switch to dashboard to see updated settings
  switchTab("dashboard");
}

// Setup and Draw Visual Charts (Chart.js)
function initCharts() {
  // Chart.js Default Typography and styling configs for Light Theme
  Chart.defaults.color = '#475569'; /* Slate 600 */
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.scale.grid.color = 'rgba(0, 0, 0, 0.05)'; /* Very soft grid lines */
  
  // 1. Weekly Velocity Chart Configuration (Bar Chart with Line Target Overlay)
  const weeklyCtx = document.getElementById("weeklyVelocityChart").getContext("2d");
  weeklyChartInstance = new Chart(weeklyCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Reviewer 1',
          data: [],
          backgroundColor: '#2563eb', // Royal Blue
          borderRadius: 4,
          borderWidth: 0,
        },
        {
          label: 'Reviewer 2',
          data: [],
          backgroundColor: '#0ea5e9', // Sky Blue
          borderRadius: 4,
          borderWidth: 0,
        },
        {
          label: 'Weekly Target',
          data: [],
          type: 'line',
          borderColor: '#f59e0b', // Amber Target Line
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: -1 // Draw line on top of bars
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 12 }
        },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#0f172a',
          bodyColor: '#475569',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          padding: 8,
          titleFont: { weight: 'bold' }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Articles Screened' } }
      }
    }
  });

  // 2. Cumulative Progress Timeline Configuration (Line Chart)
  const cumulativeCtx = document.getElementById("cumulativeProgressChart").getContext("2d");
  cumulativeChartInstance = new Chart(cumulativeCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Reviewer 1 Cumulative',
          data: [],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.03)',
          fill: true,
          tension: 0.15,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#2563eb'
        },
        {
          label: 'Reviewer 2 Cumulative',
          data: [],
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.03)',
          fill: true,
          tension: 0.15,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#0ea5e9'
        },
        {
          label: 'Expected Target Trajectory',
          data: [],
          borderColor: '#10b981', // Emerald green
          borderDash: [4, 4],
          borderWidth: 1.5,
          fill: false,
          pointRadius: 0,
          tension: 0
        },
        {
          label: 'Total Available Pool',
          data: [],
          borderColor: '#94a3b8', // Slate grey ceiling
          borderDash: [6, 6],
          borderWidth: 1.5,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 12 }
        },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#0f172a',
          bodyColor: '#475569',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          padding: 8
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Cumulative Articles' } }
      }
    }
  });
}

// Recalculate datasets and update Chart drawings
function updateCharts() {
  if (!weeklyChartInstance || !cumulativeChartInstance) return;

  const logs = state.logs;
  const settings = state.settings;
  
  // Update reviewer labels in the charts legends
  weeklyChartInstance.data.datasets[0].label = settings.reviewer1Name;
  weeklyChartInstance.data.datasets[1].label = settings.reviewer2Name;
  
  cumulativeChartInstance.data.datasets[0].label = `${settings.reviewer1Name} (Cumulative)`;
  cumulativeChartInstance.data.datasets[1].label = `${settings.reviewer2Name} (Cumulative)`;

  // Find all unique weeks logged, in sorting order (chronological inputs)
  const uniqueWeeks = [];
  logs.forEach(log => {
    if (!uniqueWeeks.includes(log.weekLabel)) {
      uniqueWeeks.push(log.weekLabel);
    }
  });
  
  // Sort uniqueWeeks chronologically by parsing week number
  uniqueWeeks.sort((a, b) => {
    const matchA = a.match(/Week (\d+)/);
    const matchB = b.match(/Week (\d+)/);
    const numA = matchA ? parseInt(matchA[1]) : 0;
    const numB = matchB ? parseInt(matchB[1]) : 0;
    return numA - numB;
  });
  
  // Prepare data for Weekly Bar Chart
  const r1WeeklyData = [];
  const r2WeeklyData = [];
  const weeklyTargetLine = [];
  
  uniqueWeeks.forEach(week => {
    const r1Log = logs.find(l => l.weekLabel === week && l.reviewerId === "reviewer1");
    const r2Log = logs.find(l => l.weekLabel === week && l.reviewerId === "reviewer2");
    
    r1WeeklyData.push(r1Log ? parseInt(r1Log.screened) : 0);
    r2WeeklyData.push(r2Log ? parseInt(r2Log.screened) : 0);
    weeklyTargetLine.push(settings.weeklyTarget || 300);
  });
  
  weeklyChartInstance.data.labels = uniqueWeeks;
  weeklyChartInstance.data.datasets[0].data = r1WeeklyData;
  weeklyChartInstance.data.datasets[1].data = r2WeeklyData;
  weeklyChartInstance.data.datasets[2].data = weeklyTargetLine; // Dotted weekly target line
  weeklyChartInstance.update();

  // Prepare data for Cumulative Line Chart
  const r1CumulativeData = [];
  const r2CumulativeData = [];
  const targetTrajectoryData = [];
  const poolData = [];
  
  let r1Sum = 0;
  let r2Sum = 0;
  let accumulatedWeeklyTarget = 0;
  
  uniqueWeeks.forEach(week => {
    const r1Log = logs.find(l => l.weekLabel === week && l.reviewerId === "reviewer1");
    const r2Log = logs.find(l => l.weekLabel === week && l.reviewerId === "reviewer2");
    
    r1Sum += r1Log ? parseInt(r1Log.screened) : 0;
    r2Sum += r2Log ? parseInt(r2Log.screened) : 0;
    
    // Target increases weekly by the weeklyTarget, up to the total ceiling
    accumulatedWeeklyTarget += (settings.weeklyTarget || 300);
    
    r1CumulativeData.push(r1Sum);
    r2CumulativeData.push(r2Sum);
    targetTrajectoryData.push(Math.min(settings.totalRecords, accumulatedWeeklyTarget));
    poolData.push(settings.totalRecords);
  });
  
  // Set labels and data
  cumulativeChartInstance.data.labels = uniqueWeeks;
  cumulativeChartInstance.data.datasets[0].data = r1CumulativeData;
  cumulativeChartInstance.data.datasets[1].data = r2CumulativeData;
  cumulativeChartInstance.data.datasets[2].data = targetTrajectoryData; // Diagonal target line
  cumulativeChartInstance.data.datasets[3].data = poolData; // Horizontal pool ceiling
  cumulativeChartInstance.update();
}

// Download local state as JSON file
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute("download", `systematic_review_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Parse and Import JSON File into app state
function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedState = JSON.parse(event.target.result);
      
      // Simple structure validation checks
      if (!importedState.settings || !Array.isArray(importedState.logs)) {
        alert("Invalid file format. The imported JSON file must contain settings and logs.");
        return;
      }
      
      if (confirm("Importing this file will overwrite your current logs and settings. Do you want to continue?")) {
        state = importedState;
        saveState();
        initSettingsFormValues();
        initFormSelectors();
        updateUI();
        alert("Data successfully imported!");
        switchTab("dashboard");
      }
    } catch (err) {
      alert("Failed to parse JSON file. Ensure it is a valid backup file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
  
  // Reset file input value so it triggers again on same file
  e.target.value = "";
}

// Helper to escape HTML tags and script injections
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Generate the select options for weeks dropdown
function initWeekOptions() {
  const logWeekSelect = document.getElementById("log-week");
  if (!logWeekSelect) return;
  
  const weeks = generateWeeksList(state.settings.startDate || "2026-06-01", state.settings.dueDate || "2026-08-31");
  logWeekSelect.innerHTML = "";
  weeks.forEach(w => {
    const option = document.createElement("option");
    option.value = w.label;
    option.textContent = w.label;
    logWeekSelect.appendChild(option);
  });
  
  // Automatically pre-select the week matching today's date
  const currentWeekLabel = getCurrentWeekLabel(weeks);
  logWeekSelect.value = currentWeekLabel;
}

// Helper to generate dynamic list of weeks between start and due dates
function generateWeeksList(startDateStr, dueDateStr) {
  const weeks = [];
  const start = new Date(startDateStr);
  const due = new Date(dueDateStr);
  
  // Calculate difference in days and convert to weeks (rounded up)
  const diffTime = Math.abs(due - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const numWeeks = Math.max(1, Math.ceil(diffDays / 7));
  
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (i * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startStr = formatDateLabel(weekStart);
    const endStr = formatDateLabel(weekEnd);
    const label = `Week ${i + 1} (${startStr} - ${endStr})`;
    
    weeks.push({
      index: i + 1,
      label: label,
      startDate: weekStart,
      endDate: weekEnd
    });
  }
  return weeks;
}

// Find week matching today's date, or default past last week to last week
function getCurrentWeekLabel(weeks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const w of weeks) {
    const wStart = new Date(w.startDate);
    wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(w.endDate);
    wEnd.setHours(23, 59, 59, 999);
    
    if (today >= wStart && today <= wEnd) {
      return w.label;
    }
  }
  
  // If today is past the last week in our list, default to the last week
  if (weeks.length > 0) {
    const lastWeek = weeks[weeks.length - 1];
    const lastEnd = new Date(lastWeek.endDate);
    lastEnd.setHours(23, 59, 59, 999);
    if (today > lastEnd) {
      return lastWeek.label;
    }
  }
  
  // Default to Week 1
  return weeks[0] ? weeks[0].label : "";
}

// Format Date to short month + day (e.g. Jun 01)
function formatDateLabel(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[date.getMonth()];
  const d = String(date.getDate()).padStart(2, '0');
  return `${m} ${d}`// Cloud database syncing methods
async function syncWithCloud(showSuccessAlert = false) {
  const statusText = document.getElementById("cloud-connection-status");
  const badgeValue = document.getElementById("cloud-badge-value");
  const badge = document.getElementById("cloud-status-badge");
  
  if (statusText) {
    statusText.textContent = "Status: Syncing with cloud...";
    statusText.style.color = "var(--text-muted)";
  }
  
  try {
    const response = await fetch(DB_URL);
    if (response.status === 404) {
      // New database setup. Initialize the cloud database with current local state
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
      
      // Save locally
      localStorage.setItem("systematic_review_dashboard_state", JSON.stringify(state));
      
      // Hydrate the screen components
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
  try {
    const response = await fetch(DB_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(state)
    });
    return response.ok;
  } catch (err) {
    console.error("Failed to write state updates to cloud database:", err);
    return false;
  }
}
