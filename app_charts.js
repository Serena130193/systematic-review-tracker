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
