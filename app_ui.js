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

// Helper: Format Date to short month + day (e.g. Jun 01)
function formatDateLabel(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[date.getMonth()];
  const d = String(date.getDate()).padStart(2, '0');
  return `${m} ${d}`;
}
