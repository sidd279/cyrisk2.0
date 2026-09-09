/* =========================================================
   FILE: app.js
   TEAM MEMBER 5 — UI/UX AND INTEGRATION
   =========================================================
   PURPOSE:
   This is the "glue" file. It does NOT contain any risk,
   optimization, simulation, or AI logic itself — it only:
     1. Reads data using data.js / riskEngine.js / optimizer.js /
        scenarioSimulator.js / aiAnalyst.js function calls.
     2. Renders that data into the DOM (cards, tables, charts).
     3. Wires up buttons, forms, and the chat box to those
        same functions.

   This keeps a single source of truth: every number shown on
   screen came from riskEngine.js (directly or indirectly), so
   the dashboard can never show a value that contradicts the
   calculations.

   HOW IT CONNECTS TO OTHER FILES:
     - index.html loads this file LAST, after all the other
       scripts, so every function it calls already exists.
     - Uses global functions from data.js, riskEngine.js,
       optimizer.js, scenarioSimulator.js and aiAnalyst.js.
   ========================================================= */

/* ---------------------------------------------------------
   GLOBAL APP STATE
   --------------------------------------------------------- */
const chartInstances = {}; // keeps references so we can destroy/recreate charts
let lastOptimizerResult = null; // used by the dashboard "recommended investment" card

/* ---------------------------------------------------------
   INITIALIZATION
   --------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", function () {
  // Make sure sample data exists on first-ever visit
  loadAssets();
  loadVulnerabilities();
  loadInvestments();

  setupNavigation();
  setupAssetTableToolbar();
  setupAssetModal();
  setupOptimizer();
  setupChat();
  setupScenarioSimulator();
  setupResetButton();

  renderEverything();
});

/**
 * Re-renders every section of the app. Called after any action
 * that changes underlying data (add/edit/delete asset, reset, etc.)
 */
function renderEverything() {
  // Each section is rendered independently so that an unexpected error
  // in one (e.g. a chart failing to draw) never prevents the others
  // from showing up — important during a live demo.
  safeRun(renderDashboard);
  safeRun(renderAssetTable);
  safeRun(() => renderOptimizerResults(lastOptimizerResult));
  safeRun(renderScenarioCards);
}

function safeRun(fn) {
  try {
    fn();
  } catch (err) {
    console.error("Render step failed:", err);
  }
}

/* ---------------------------------------------------------
   NAVIGATION (sidebar tab switching)
   --------------------------------------------------------- */
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", function () {
      navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const targetId = item.getAttribute("data-target");
      document.querySelectorAll(".panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === targetId);
      });
    });
  });
}

/* ---------------------------------------------------------
   EXECUTIVE DASHBOARD
   --------------------------------------------------------- */
function renderDashboard() {
  const enterpriseRisk = calculateAllRisk(); // riskEngine.js

  document.getElementById("cardTotalEAL").textContent = formatCurrency(enterpriseRisk.totalExpectedAnnualLoss);
  document.getElementById("cardTotalExposure").textContent = formatCurrency(enterpriseRisk.totalFinancialExposure);
  document.getElementById("cardHighRiskCount").textContent = enterpriseRisk.highRiskAssetCount;

  if (enterpriseRisk.highestRiskAsset) {
    const top = enterpriseRisk.highestRiskAsset;
    document.getElementById("highestRiskSummary").textContent =
      `${top.assetName} (${top.assetType}) currently drives the highest Expected Annual Loss at ` +
      `${formatCurrency(top.expectedAnnualLoss)}, with a residual incident probability of ${formatPercent(top.residualProbability)}.`;
  } else {
    document.getElementById("highestRiskSummary").textContent = "No asset data available.";
  }

  // Recommended investment / risk reduction / ROSI cards reflect the
  // LAST optimizer run (default budget the first time the page loads).
  if (!lastOptimizerResult) {
    lastOptimizerResult = runOptimization(Number(document.getElementById("budgetInput").value) || 1000000);
  }
  const topInvestmentNames = lastOptimizerResult.selectedInvestments.map(i => i.name).join(", ") || "None";
  document.getElementById("cardRecommendedInvestment").textContent =
    lastOptimizerResult.selectedInvestments.length
      ? (lastOptimizerResult.selectedInvestments.length === 1 ? topInvestmentNames : lastOptimizerResult.selectedInvestments.length + " investments")
      : "None";
  document.getElementById("cardRiskReduction").textContent = formatCurrency(lastOptimizerResult.totalRiskReduction);
  document.getElementById("cardROSI").textContent = lastOptimizerResult.rosi + "%";

  renderRiskByAssetChart(enterpriseRisk.perAssetRisk);
  renderExposureDistributionChart(enterpriseRisk.perAssetRisk);
}

function renderRiskByAssetChart(perAssetRisk) {
  const sorted = [...perAssetRisk].sort((a, b) => b.expectedAnnualLoss - a.expectedAnnualLoss);
  const labels = sorted.map(r => r.assetName);
  const values = sorted.map(r => r.expectedAnnualLoss);
  const colors = sorted.map(r => riskColor(r.expectedAnnualLoss, sorted[0].expectedAnnualLoss));

  renderChart("chartRiskByAsset", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Expected Annual Loss",
        data: values,
        backgroundColor: colors,
        borderRadius: 4
      }]
    },
    options: baseChartOptions({ indexAxis: "y" })
  });
}

function renderExposureDistributionChart(perAssetRisk) {
  const sorted = [...perAssetRisk].sort((a, b) => b.financialImpact - a.financialImpact);
  const labels = sorted.map(r => r.assetName);
  const values = sorted.map(r => r.financialImpact);

  renderChart("chartExposureDistribution", {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: palette(labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } } }
    }
  });
}

/* ---------------------------------------------------------
   ASSET RISK TABLE
   --------------------------------------------------------- */
function setupAssetTableToolbar() {
  document.getElementById("loadSampleBtn").addEventListener("click", function () {
    resetSampleData();
    renderEverything();
  });

  document.getElementById("addAssetBtn").addEventListener("click", function () {
    openAssetModal(null);
  });
}

function renderAssetTable() {
  const assets = loadAssets();
  const ranked = rankAssetsByRisk(assets); // riskEngine.js — includes rank + all computed fields
  const tbody = document.getElementById("assetTableBody");
  tbody.innerHTML = "";

  const maxEAL = ranked.length ? ranked[0].expectedAnnualLoss : 0;

  ranked.forEach(risk => {
    const asset = assets.find(a => a.id === risk.assetId);
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${risk.rank}</td>
      <td>${risk.assetId}</td>
      <td>${escapeHtml(risk.assetName)}</td>
      <td>${escapeHtml(asset.type || "")}</td>
      <td>${asset.criticality}</td>
      <td>${asset.vulnerabilitySeverity}</td>
      <td>${asset.exposure}</td>
      <td>${(asset.controlEffectiveness * 100).toFixed(0)}%</td>
      <td>${formatCurrency(risk.financialImpact)}</td>
      <td class="${riskClass(risk.expectedAnnualLoss, maxEAL)}">${formatCurrency(risk.expectedAnnualLoss)}</td>
      <td>${risk.riskScore}</td>
      <td>
        <button class="btn-icon" title="Edit" data-edit="${asset.id}">✏️</button>
        <button class="btn-icon" title="Delete" data-delete="${asset.id}">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openAssetModal(btn.getAttribute("data-edit")));
  });
  tbody.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete");
      if (confirm("Delete this asset? This cannot be undone.")) {
        deleteAsset(id);
        renderEverything();
      }
    });
  });
}

function riskClass(value, max) {
  if (max <= 0) return "";
  const ratio = value / max;
  if (ratio >= 0.66) return "risk-high";
  if (ratio >= 0.33) return "risk-medium";
  return "risk-low";
}

function riskColor(value, max) {
  if (max <= 0) return "#94a3b8";
  const ratio = value / max;
  if (ratio >= 0.66) return "#e5484d";
  if (ratio >= 0.33) return "#f5a524";
  return "#17b26a";
}

/* ---------------------------------------------------------
   ADD / EDIT ASSET MODAL
   --------------------------------------------------------- */
function setupAssetModal() {
  document.getElementById("assetModalCancel").addEventListener("click", closeAssetModal);
  document.getElementById("assetModalOverlay").addEventListener("click", function (e) {
    if (e.target === this) closeAssetModal();
  });
  document.getElementById("assetForm").addEventListener("submit", function (e) {
    e.preventDefault();
    saveAssetFromForm();
  });
}

function openAssetModal(assetId) {
  const overlay = document.getElementById("assetModalOverlay");
  const form = document.getElementById("assetForm");
  form.reset();

  if (assetId) {
    const asset = loadAssets().find(a => a.id === assetId);
    if (!asset) return;
    document.getElementById("assetModalTitle").textContent = "Edit Asset";
    document.getElementById("assetFormId").value = asset.id;
    document.getElementById("assetFormName").value = asset.name;
    document.getElementById("assetFormType").value = asset.type;
    document.getElementById("assetFormCriticality").value = asset.criticality;
    document.getElementById("assetFormSeverity").value = asset.vulnerabilitySeverity;
    document.getElementById("assetFormExposure").value = asset.exposure;
    document.getElementById("assetFormControl").value = asset.controlEffectiveness;
    document.getElementById("assetFormDowntime").value = asset.downtimeCost;
    document.getElementById("assetFormDataLoss").value = asset.dataLossCost;
    document.getElementById("assetFormRecovery").value = asset.recoveryCost;
  } else {
    document.getElementById("assetModalTitle").textContent = "Add New Asset";
    document.getElementById("assetFormId").value = "";
  }

  overlay.classList.add("active");
}

function closeAssetModal() {
  document.getElementById("assetModalOverlay").classList.remove("active");
}

function saveAssetFromForm() {
  const id = document.getElementById("assetFormId").value;
  const fields = {
    name: document.getElementById("assetFormName").value,
    type: document.getElementById("assetFormType").value,
    criticality: Number(document.getElementById("assetFormCriticality").value),
    vulnerabilitySeverity: Number(document.getElementById("assetFormSeverity").value),
    exposure: Number(document.getElementById("assetFormExposure").value),
    controlEffectiveness: Number(document.getElementById("assetFormControl").value),
    downtimeCost: Number(document.getElementById("assetFormDowntime").value),
    dataLossCost: Number(document.getElementById("assetFormDataLoss").value),
    recoveryCost: Number(document.getElementById("assetFormRecovery").value)
  };

  if (id) {
    updateAsset(id, fields);
  } else {
    addAsset(fields);
  }

  closeAssetModal();
  renderEverything();
}

/* ---------------------------------------------------------
   INVESTMENT OPTIMIZER
   --------------------------------------------------------- */
function setupOptimizer() {
  document.getElementById("optimizeBtn").addEventListener("click", function () {
    const budget = Number(document.getElementById("budgetInput").value) || 0;
    lastOptimizerResult = runOptimization(budget); // optimizer.js
    renderOptimizerResults(lastOptimizerResult);
    renderDashboard(); // dashboard cards depend on the optimizer result too
  });
}

function renderOptimizerResults(result) {
  if (!result) return;

  document.getElementById("optTotalInvestment").textContent = formatCurrency(result.totalInvestment);
  document.getElementById("optRiskReduction").textContent = formatCurrency(result.totalRiskReduction);
  document.getElementById("optRemainingBudget").textContent = formatCurrency(result.remainingBudget);
  document.getElementById("optROSI").textContent = result.rosi + "%";

  const tbody = document.getElementById("investmentTableBody");
  tbody.innerHTML = "";
  const selectedIds = new Set(result.selectedInvestments.map(i => i.id));

  result.allEvaluated.forEach(inv => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(inv.name)}</td>
      <td>${formatCurrency(inv.cost)}</td>
      <td>${formatCurrency(inv.riskReduction)}</td>
      <td>${inv.rosi}%</td>
      <td>${selectedIds.has(inv.id) ? "✅ Selected" : "—"}</td>
    `;
    tbody.appendChild(tr);
  });

  renderInvestmentChart(result.allEvaluated, selectedIds);
}

function renderInvestmentChart(investments, selectedIds) {
  const labels = investments.map(i => i.name);
  const costs = investments.map(i => i.cost);
  const reductions = investments.map(i => i.riskReduction);

  renderChart("chartInvestmentVsReduction", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Cost", data: costs, backgroundColor: "#94a3b8", borderRadius: 4 },
        { label: "Risk Reduction", data: reductions, backgroundColor: "#2f6fed", borderRadius: 4 }
      ]
    },
    options: baseChartOptions({ indexAxis: "y" })
  });
}

/* ---------------------------------------------------------
   AI RISK ANALYST (chat interface)
   --------------------------------------------------------- */
function setupChat() {
  const sendBtn = document.getElementById("chatSendBtn");
  const input = document.getElementById("chatInput");

  sendBtn.addEventListener("click", handleChatSend);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleChatSend();
  });

  document.querySelectorAll("#chatSuggestions .chip").forEach(chip => {
    chip.addEventListener("click", function () {
      const question = chip.getAttribute("data-question");
      appendChatMessage(question, "user");
      const answer = askAI(question); // aiAnalyst.js
      appendChatMessage(answer, "bot");
    });
  });
}

function handleChatSend() {
  const input = document.getElementById("chatInput");
  const question = input.value.trim();
  if (!question) return;

  appendChatMessage(question, "user");
  const answer = askAI(question); // aiAnalyst.js
  appendChatMessage(answer, "bot");
  input.value = "";
}

function appendChatMessage(text, sender) {
  const chatWindow = document.getElementById("chatWindow");
  const msg = document.createElement("div");
  msg.className = `chat-message ${sender}`;
  msg.textContent = text;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* ---------------------------------------------------------
   SCENARIO SIMULATOR
   --------------------------------------------------------- */
function setupScenarioSimulator() {
  // Scenario cards are rendered dynamically; click handlers are
  // attached inside renderScenarioCards() since the cards are
  // (re)created there.
}

function renderScenarioCards() {
  const grid = document.getElementById("scenarioGrid");
  grid.innerHTML = "";

  getAvailableScenarios().forEach(scenario => { // scenarioSimulator.js
    const card = document.createElement("div");
    card.className = "scenario-card";
    card.innerHTML = `<h4>${escapeHtml(scenario.label)}</h4><p>${escapeHtml(scenario.description)}</p>`;
    card.addEventListener("click", () => runScenarioAndRender(scenario.key));
    grid.appendChild(card);
  });
}

function runScenarioAndRender(scenarioKey) {
  const result = runScenario(scenarioKey); // scenarioSimulator.js
  if (!result) return;

  document.getElementById("scenarioResult").style.display = "block";
  document.getElementById("scenarioResultTitle").textContent = result.scenarioLabel;
  document.getElementById("scenarioResultDescription").textContent = result.description;
  document.getElementById("scenarioBeforeEAL").textContent = formatCurrency(result.beforeEAL);
  document.getElementById("scenarioAfterEAL").textContent = formatCurrency(result.afterEAL);
  document.getElementById("scenarioReduction").textContent = formatCurrency(result.riskReduction);
  document.getElementById("scenarioPercentReduction").textContent = result.percentageReduction + "%";

  renderChart("chartBeforeAfter", {
    type: "bar",
    data: {
      labels: ["Before", "After"],
      datasets: [{
        label: "Expected Annual Loss",
        data: [result.beforeEAL, result.afterEAL],
        backgroundColor: ["#e5484d", "#17b26a"],
        borderRadius: 4
      }]
    },
    options: baseChartOptions({})
  });

  document.getElementById("scenarioResult").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ---------------------------------------------------------
   RESET SAMPLE DATA (sidebar button)
   --------------------------------------------------------- */
function setupResetButton() {
  document.getElementById("resetDataBtn").addEventListener("click", function () {
    if (confirm("Reset ALL data back to the original sample data set? Your edits will be lost.")) {
      resetSampleData();
      lastOptimizerResult = null;
      renderEverything();
    }
  });
}

/* ---------------------------------------------------------
   CHART.JS HELPERS
   --------------------------------------------------------- */
function renderChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // Defensive: if Chart.js failed to load (e.g. no internet connection
  // to the CDN during a live demo), don't let that break the rest of
  // the dashboard. Every number on the page already comes from the
  // tables/cards, so charts are a nice-to-have, not a hard dependency.
  if (typeof Chart === "undefined") {
    console.warn(`Chart.js is not available — skipping chart "${canvasId}". Check your internet connection (Chart.js loads from a CDN).`);
    const container = ctx.closest(".chart-box");
    if (container && !container.querySelector(".chart-fallback-note")) {
      const note = document.createElement("p");
      note.className = "muted chart-fallback-note";
      note.textContent = "Chart unavailable offline — Chart.js could not be loaded from the CDN.";
      container.appendChild(note);
    }
    return;
  }

  try {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }
    chartInstances[canvasId] = new Chart(ctx, config);
  } catch (err) {
    console.error(`Failed to render chart "${canvasId}":`, err);
  }
}

function baseChartOptions(extra) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { font: { size: 11 } } }
    },
    scales: {
      x: { ticks: { font: { size: 10 } } },
      y: { ticks: { font: { size: 10 } } }
    }
  }, extra);
}

function palette(count) {
  const base = ["#2f6fed", "#4c8dff", "#17b26a", "#f5a524", "#e5484d", "#7c5cff", "#0d1f3c", "#94a3b8", "#1a3a6b", "#2fb1ed"];
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(base[i % base.length]);
  }
  return colors;
}

/* ---------------------------------------------------------
   MISC HELPERS
   --------------------------------------------------------- */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str == null ? "" : str);
  return div.innerHTML;
}
