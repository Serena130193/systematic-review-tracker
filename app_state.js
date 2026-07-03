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

// Cloud Database Endpoint (KVDB.io Bucket & Key via CORS Proxy)
const DB_URL = "https://corsproxy.io/?url=https://kvdb.io/SHdLEPg2V5HvhTRvmNXXZ1/sr_tracker_serena130193";

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
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
  
  try {
    const response = await fetch(DB_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.status === 404) {
      if (statusText) statusText.textContent = "Status: Initializing Cloud Database...";
      const result = await saveStateToCloud();
      if (result.success) {
        if (statusText) {
          statusText.textContent = "Status: Connected to Cloud Database (Active)";
          statusText.style.color = "#0d9488";
        }
      } else {
        throw new Error("Initialization failed: " + result.error);
      }
      return;
    }
    if (!response.ok) throw new Error("Server responded with HTTP " + response.status);
    
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
    
    let errMsg = err.message;
    if (err.name === 'AbortError') errMsg = "Connection timed out (8 seconds)";
    
    if (statusText) {
      statusText.textContent = "Status: Sync Offline (" + errMsg + ")";
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
      alert("Synchronization failed: Using local offline cache.\n" + errMsg);
    }
  }
}

async function saveStateToCloud() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
  
  try {
    const response = await fetch(DB_URL, {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify(state)
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return { success: false, error: "HTTP " + response.status };
    }
    return { success: true };
  } catch (err) {
    clearTimeout(timeoutId);
    let errMsg = err.message;
    if (err.name === 'AbortError') errMsg = "Write timed out";
    return { success: false, error: errMsg };
  }
}
