/**
 * public/app.js
 * ---------------------------------------------------------------
 * TEAM MEMBER 5 — UI/UX AND INTEGRATION
 *
 * Vanilla JS frontend. Every number shown on screen comes from a
 * fetch() call to the backend — nothing here is hardcoded. This
 * file is only responsible for: tab switching, calling the API,
 * and rendering the response into the DOM / Chart.js charts.
 * ---------------------------------------------------------------
 */

const fmtCurrency = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const fmtPercent = (n) => `${Number(n || 0).toFixed(1)}%`;

/* ------------------------------------------------------------ *
 * TAB SWITCHING
 * ------------------------------------------------------------ */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

/* ------------------------------------------------------------ *
 * CHART.JS GLOBAL THEME
 * ------------------------------------------------------------ */
if (window.Chart) {
  Chart.defaults.color = "#c6cfe6";
  Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
  Chart.defaults.font.family = "Segoe UI, Roboto, sans-serif";
}

const charts = {}; // keep references so we can destroy/redraw on refresh

function renderChart(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, config);
}

/* ------------------------------------------------------------ *
 * DASHBOARD
 * ------------------------------------------------------------ */
async function loadDashboard() {
  try {
    const [risk, investments] = await Promise.all([
      fetchJSON("/api/risk"),
      fetchJSON("/api/investments")
    ]);

    document.getElementById("statEAL").textContent = fmtCurrency(risk.totalEAL);
    document.getElementById("statExposure").textContent = fmtCurrency(risk.totalFinancialExposure);
    document.getElementById("statHighRisk").textContent = risk.highRiskAssetCount;

    // Executive summary text (rule-based/LLM, grounded in risk data)
    const analysis = await postJSON("/api/ai/analyze", { question: "" });
    document.getElementById("execSummary").textContent = analysis.answer;

    // Default "recommended investment" preview uses a ₹10,00,000 budget,
    // matching the official demo script — the Optimizer tab lets the
    // user change this.
    const optResult = await postJSON("/api/optimize", { budget: 1000000 });
    const topPick = optResult.selectedInvestments[0];
    document.getElementById("statRecommended").textContent = topPick ? topPick.name : "—";
    document.getElementById("statRiskReduction").textContent = fmtCurrency(optResult.riskReduction);
    document.getElementById("statROSI").textContent = fmtPercent(optResult.rosi);

    // Chart: Risk by Asset (EAL)
    const ranked = risk.rankedAssets.slice(0, 10);
    renderChart("chartRiskByAsset", {
      type: "bar",
      data: {
        labels: ranked.map((a) => a.assetName),
        datasets: [
          {
            label: "Expected Annual Loss (₹)",
            data: ranked.map((a) => a.eal),
            backgroundColor: "#2f6fed",
            borderRadius: 6
          }
        ]
      },
      options: baseChartOptions({ indexAxis: "y" })
    });

    // Chart: Financial Exposure Distribution (by asset type)
    const byType = {};
    risk.assets.forEach((a) => {
      byType[a.assetType] = (byType[a.assetType] || 0) + a.financialImpact;
    });
    renderChart("chartExposureDistribution", {
      type: "doughnut",
      data: {
        labels: Object.keys(byType),
        datasets: [
          {
            data: Object.values(byType),
            backgroundColor: ["#2f6fed", "#35d0e0", "#5b8cf5", "#3ddc97", "#ffb84d", "#ff5d73", "#8b7bf7"]
          }
        ]
      },
      options: baseChartOptions({})
    });

    setStatus("ok", "Data loaded");
  } catch (err) {
    console.error(err);
    setStatus("error", "Failed to load dashboard data");
  }
}

/* ------------------------------------------------------------ *
 * ASSET RISK TABLE
 * ------------------------------------------------------------ */
async function loadAssetTable() {
  const tbody = document.getElementById("assetTableBody");
  tbody.innerHTML = `<tr><td colspan="7" class="muted">Loading assets…</td></tr>`;

  try {
    const risk = await fetchJSON("/api/risk");
    const rows = risk.rankedAssets
      .map((a) => {
        const badge = riskBadge(a.riskScore);
        return `<tr>
          <td>#${a.rank}</td>
          <td>${a.assetName}</td>
          <td>${a.assetType}</td>
          <td>${fmtCurrency(a.financialImpact)}</td>
          <td>${(a.residualProbability * 100).toFixed(1)}%</td>
          <td>${fmtCurrency(a.eal)}</td>
          <td><span class="badge ${badge.cls}">${a.riskScore} · ${badge.label}</span></td>
        </tr>`;
      })
      .join("");

    tbody.innerHTML = rows || `<tr><td colspan="7" class="muted">No assets found.</td></tr>`;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Failed to load assets.</td></tr>`;
  }
}

function riskBadge(riskScore) {
  if (riskScore >= 60) return { cls: "high", label: "High" };
  if (riskScore >= 30) return { cls: "medium", label: "Medium" };
  return { cls: "low", label: "Low" };
}

document.getElementById("refreshAssetsBtn").addEventListener("click", loadAssetTable);

/* ------------------------------------------------------------ *
 * INVESTMENT OPTIMIZER
 * ------------------------------------------------------------ */
async function loadInvestmentTable(selectedIds = []) {
  const tbody = document.getElementById("investmentTableBody");
  try {
    const investments = await fetchJSON("/api/investments");
    tbody.innerHTML = investments
      .map((inv) => {
        const rosi = (((inv.riskReduction - inv.cost) / inv.cost) * 100).toFixed(1);
        const isSelected = selectedIds.includes(inv.id);
        return `<tr style="${isSelected ? "background:rgba(61,220,151,0.08)" : ""}">
          <td>${isSelected ? "✅" : "—"}</td>
          <td>${inv.name}</td>
          <td class="muted">${inv.description}</td>
          <td>${fmtCurrency(inv.cost)}</td>
          <td>${fmtCurrency(inv.riskReduction)}</td>
          <td>${fmtPercent(rosi)}</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load investments.</td></tr>`;
  }
}

document.getElementById("optimizeBtn").addEventListener("click", async () => {
  const budget = Number(document.getElementById("budgetInput").value || 0);
  const btn = document.getElementById("optimizeBtn");
  btn.disabled = true;
  btn.textContent = "Optimizing…";

  try {
    const result = await postJSON("/api/optimize", { budget });

    document.getElementById("optimizeResultCards").style.display = "grid";
    document.getElementById("optTotalCost").textContent = fmtCurrency(result.totalCost);
    document.getElementById("optRiskReduction").textContent = fmtCurrency(result.riskReduction);
    document.getElementById("optRemaining").textContent = fmtCurrency(result.remainingBudget);
    document.getElementById("optROSI").textContent = fmtPercent(result.rosi);

    const selectedIds = result.selectedInvestments.map((i) => i.id);
    await loadInvestmentTable(selectedIds);

    renderChart("chartInvestmentVsReduction", {
      type: "bar",
      data: {
        labels: result.selectedInvestments.map((i) => i.name),
        datasets: [
          { label: "Cost (₹)", data: result.selectedInvestments.map((i) => i.cost), backgroundColor: "#5b8cf5" },
          {
            label: "Risk Reduction (₹)",
            data: result.selectedInvestments.map((i) => i.riskReduction),
            backgroundColor: "#3ddc97"
          }
        ]
      },
      options: baseChartOptions({})
    });
  } catch (err) {
    console.error(err);
    alert("Failed to optimize budget. See console for details.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Optimize";
  }
});

/* ------------------------------------------------------------ *
 * AI RISK ANALYST
 * ------------------------------------------------------------ */
async function askAI(question) {
  const box = document.getElementById("aiAnswerBox");
  const sourceEl = document.getElementById("aiAnswerSource");
  const textEl = document.getElementById("aiAnswerText");

  box.style.display = "block";
  sourceEl.textContent = "Thinking…";
  textEl.textContent = "";

  try {
    const result = await postJSON("/api/ai/analyze", { question });
    sourceEl.textContent = result.source === "llm" ? "AI Analyst · LLM" : "AI Analyst · Rule-based engine";
    textEl.textContent = result.answer;
  } catch (err) {
    console.error(err);
    sourceEl.textContent = "Error";
    textEl.textContent = "Failed to reach the AI Risk Analyst. See console for details.";
  }
}

document.getElementById("askBtn").addEventListener("click", () => {
  const input = document.getElementById("questionInput");
  if (input.value.trim()) askAI(input.value.trim());
});

document.getElementById("questionInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.value.trim()) askAI(e.target.value.trim());
});

document.querySelectorAll("#quickQuestions .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.getElementById("questionInput").value = chip.textContent;
    askAI(chip.textContent);
  });
});

/* ------------------------------------------------------------ *
 * SCENARIO SIMULATOR
 * ------------------------------------------------------------ */
document.getElementById("simulateBtn").addEventListener("click", async () => {
  const scenario = document.getElementById("scenarioSelect").value;
  const btn = document.getElementById("simulateBtn");
  btn.disabled = true;
  btn.textContent = "Simulating…";

  try {
    const result = await postJSON("/api/scenario", { scenario });

    document.getElementById("simResultCards").style.display = "grid";
    document.getElementById("simBefore").textContent = fmtCurrency(result.before.totalEAL);
    document.getElementById("simAfter").textContent = fmtCurrency(result.after.totalEAL);
    document.getElementById("simReduction").textContent = fmtCurrency(result.riskReduction);
    document.getElementById("simPercent").textContent = fmtPercent(result.percentReduction);

    renderChart("chartBeforeAfter", {
      type: "bar",
      data: {
        labels: ["Total Expected Annual Loss"],
        datasets: [
          { label: "Before", data: [result.before.totalEAL], backgroundColor: "#ff5d73" },
          { label: "After", data: [result.after.totalEAL], backgroundColor: "#3ddc97" }
        ]
      },
      options: baseChartOptions({})
    });
  } catch (err) {
    console.error(err);
    alert("Failed to run scenario simulation. See console for details.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simulate";
  }
});

/* ------------------------------------------------------------ *
 * HELPERS
 * ------------------------------------------------------------ */
function baseChartOptions(overrides) {
  return Object.assign(
    {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#c6cfe6" } }
      },
      scales: {
        x: { ticks: { color: "#94a1c4" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#94a1c4" }, grid: { color: "rgba(255,255,255,0.05)" } }
      }
    },
    overrides
  );
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed with status ${res.status}`);
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `POST ${url} failed with status ${res.status}`);
  }
  return res.json();
}

function setStatus(kind, message) {
  const el = document.getElementById("dataStatus");
  el.textContent = message;
  el.className = "status-pill " + (kind === "ok" ? "ok" : kind === "error" ? "error" : "");
}

/* ------------------------------------------------------------ *
 * INITIAL LOAD
 * ------------------------------------------------------------ */
(async function init() {
  await Promise.all([loadDashboard(), loadAssetTable(), loadInvestmentTable()]);
})();
