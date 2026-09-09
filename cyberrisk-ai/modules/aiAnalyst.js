/**
 * modules/aiAnalyst.js
 * ---------------------------------------------------------------
 * TEAM MEMBER 3 — AI RISK ANALYST
 *
 * Turns the numbers produced by modules/riskEngine.js (and, for
 * "what if" questions, modules/scenarioSimulator.js) into plain
 * English explanations and recommendations.
 *
 * CRITICAL RULE: this module NEVER invents financial figures. Every
 * number that appears in its answers is read directly from the
 * risk engine's output — this module only selects, ranks, and
 * narrates numbers that already exist.
 *
 * Two modes:
 *  1. LLM mode — if OPENAI_API_KEY is set in .env, the calculated
 *     numbers are handed to the model with strict instructions to
 *     narrate them only, never invent new ones.
 *  2. Rule-based fallback — always available, no API key required.
 *     This is the default and is what most hackathon demos should
 *     rely on, since it works with zero setup and zero internet
 *     dependency.
 * ---------------------------------------------------------------
 */

const riskEngine = require("./riskEngine");
const scenarioSimulator = require("./scenarioSimulator");

const currency = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/**
 * generateRiskExplanation(context, question)
 * ---------------------------------------------------------------
 * @param {Object} context - { assets, vulnerabilities, enterpriseRisk? }
 *   `assets` and `vulnerabilities` are the raw data arrays (data/*.json
 *   shape). `enterpriseRisk`, if already computed by the caller, is
 *   reused instead of being recalculated (keeps the numbers identical
 *   to whatever the dashboard is already showing).
 * @param {String} question - free-text business question
 * @returns {Promise<Object>} { answer: string, source: "llm"|"rule-based", data: {...} }
 */
async function generateRiskExplanation(context, question) {
  const assets = context.assets || [];
  const vulnerabilities = context.vulnerabilities || [];
  const enterpriseRisk = context.enterpriseRisk || riskEngine.calculateEnterpriseRisk(assets);

  const fullContext = { assets, vulnerabilities, enterpriseRisk };

  if (process.env.OPENAI_API_KEY) {
    try {
      const answer = await generateWithLLM(fullContext, question);
      return { answer, source: "llm" };
    } catch (err) {
      // Never let a missing/failing LLM call break the demo — fall back.
      console.warn("[aiAnalyst] LLM explanation failed, using rule-based fallback:", err.message);
    }
  }

  const answer = generateRuleBasedAnswer(fullContext, question);
  return { answer, source: "rule-based" };
}

/* ------------------------------------------------------------ *
 * RULE-BASED FALLBACK ENGINE (always available, no API key)
 * ------------------------------------------------------------ */

function generateRuleBasedAnswer(context, question) {
  const q = String(question || "").toLowerCase().trim();
  const { assets, vulnerabilities, enterpriseRisk } = context;

  if (!q) {
    return generateExecutiveSummary(context);
  }

  // "What is our highest financial cyber risk?"
  if (q.includes("highest") && (q.includes("risk") || q.includes("loss") || q.includes("exposure"))) {
    return answerHighestRisk(enterpriseRisk);
  }

  // "Which vulnerabilities contribute most to our expected losses?"
  if (q.includes("vulnerabilit") && (q.includes("contribute") || q.includes("most") || q.includes("losses"))) {
    return answerTopVulnerabilities(context);
  }

  // "What should we fix first?"
  if ((q.includes("fix") || q.includes("prioriti") || q.includes("remediate")) &&
      (q.includes("first") || q.includes("should"))) {
    return answerWhatToFixFirst(context);
  }

  // "What happens if MFA is implemented?" (or patch / segmentation / delay)
  const scenarioKey = detectScenarioKeyword(q);
  if (scenarioKey) {
    return answerScenarioQuestion(assets, scenarioKey);
  }

  // "Why is the banking server high-risk?" / "why is <asset name> high risk"
  if (q.includes("why") && (q.includes("high") || q.includes("risk"))) {
    const asset = findAssetMentionedInQuestion(assets, q);
    if (asset) {
      return answerWhyAssetIsHighRisk(asset);
    }
  }

  // Direct asset name lookup even without "why" (e.g. "tell me about the banking server")
  const mentionedAsset = findAssetMentionedInQuestion(assets, q);
  if (mentionedAsset) {
    return answerWhyAssetIsHighRisk(mentionedAsset);
  }

  if (q.includes("summary") || q.includes("overview") || q.includes("executive")) {
    return generateExecutiveSummary(context);
  }

  // Generic fallback — still 100% grounded in real numbers
  return (
    `I can answer questions about your calculated cyber risk, such as: ` +
    `"What is our highest financial cyber risk?", "Which vulnerabilities contribute most to our expected losses?", ` +
    `"What should we fix first?", "Why is the banking server high-risk?", or "What happens if MFA is implemented?". ` +
    `Right now, your total Expected Annual Loss (EAL) across ${enterpriseRisk.totalAssets} assets is ${currency(enterpriseRisk.totalEAL)}, ` +
    `with ${enterpriseRisk.highRiskAssetCount} asset(s) flagged as high-risk.`
  );
}

function detectScenarioKeyword(q) {
  if (q.includes("mfa") || q.includes("multi-factor") || q.includes("multi factor")) return "mfa";
  if (q.includes("patch")) return "patch";
  if (q.includes("segmentation") || q.includes("segment")) return "segmentation";
  if (q.includes("delay") || q.includes("30 day") || q.includes("postpone")) return "delay";
  return null;
}

function findAssetMentionedInQuestion(assets, q) {
  // Prefer the longest matching name to avoid partial-name false positives
  let bestMatch = null;
  for (const asset of assets) {
    const name = String(asset.name || "").toLowerCase();
    if (name && q.includes(name)) {
      if (!bestMatch || name.length > bestMatch.name.length) {
        bestMatch = asset;
      }
    }
  }
  return bestMatch;
}

function answerHighestRisk(enterpriseRisk) {
  const top = enterpriseRisk.topRiskContributor;
  if (!top) {
    return "No asset data is available yet to determine the highest financial cyber risk.";
  }

  return (
    `Your highest financial cyber risk is **${top.assetName}** (${top.assetType}), with an Expected Annual Loss (EAL) ` +
    `of ${currency(top.eal)} per year. This is driven by a financial impact of ${currency(top.financialImpact)} per incident ` +
    `(downtime + data loss + recovery costs) combined with a residual incident probability of ${(top.residualProbability * 100).toFixed(1)}% ` +
    `after accounting for existing controls (${(top.controlEffectiveness * 100).toFixed(0)}% effective). ` +
    `Across the whole portfolio, total Expected Annual Loss is ${currency(enterpriseRisk.totalEAL)}.`
  );
}

function answerTopVulnerabilities(context) {
  const { assets, vulnerabilities, enterpriseRisk } = context;
  const ealByAsset = {};
  enterpriseRisk.assets.forEach((r) => (ealByAsset[r.assetId] = r));

  // Weight each vulnerability's contribution by its own severity share
  // of its asset's total EAL — an explainable proxy, not a separate
  // financial model (the EAL numbers themselves come only from riskEngine).
  const scored = vulnerabilities.map((v) => {
    const assetRisk = ealByAsset[v.assetId];
    const sameAssetVulns = vulnerabilities.filter((x) => x.assetId === v.assetId);
    const severitySum = sameAssetVulns.reduce((s, x) => s + (Number(x.severity) || 0), 0) || 1;
    const share = (Number(v.severity) || 0) / severitySum;
    const estimatedContribution = assetRisk ? assetRisk.eal * share : 0;

    return {
      id: v.id,
      name: v.name,
      assetId: v.assetId,
      assetName: assetRisk ? assetRisk.assetName : v.assetId,
      severity: v.severity,
      estimatedEALContribution: Math.round((estimatedContribution + Number.EPSILON) * 100) / 100
    };
  });

  const ranked = scored.sort((a, b) => b.estimatedEALContribution - a.estimatedEALContribution).slice(0, 5);

  const lines = ranked
    .map(
      (v, i) =>
        `${i + 1}. ${v.name} (${v.assetName}, severity ${v.severity}/5) — est. contribution to EAL: ${currency(v.estimatedEALContribution)}`
    )
    .join("\n");

  return (
    `Based on vulnerability severity weighted against each affected asset's Expected Annual Loss, ` +
    `the top contributors to your expected losses are:\n\n${lines}\n\n` +
    `(Contribution estimates apportion each asset's EAL across its open vulnerabilities by relative severity — ` +
    `the underlying EAL figures come directly from the risk engine, not from this estimate.)`
  );
}

function answerWhatToFixFirst(context) {
  const { assets, vulnerabilities } = context;
  const topAssets = riskEngine.identifyTopRiskContributors(assets, 3);

  const recommendations = topAssets.map((a) => {
    const relatedVulns = vulnerabilities.filter((v) => v.assetId === a.assetId);
    const topVuln = [...relatedVulns].sort((x, y) => y.severity - x.severity)[0];
    return { asset: a, topVuln };
  });

  const lines = recommendations
    .map((r, i) => {
      const vulnText = r.topVuln
        ? `starting with "${r.topVuln.name}" (severity ${r.topVuln.severity}/5)`
        : "no open vulnerabilities are catalogued for it yet";
      return `${i + 1}. ${r.asset.assetName} — EAL ${currency(r.asset.eal)}/year, ${vulnText}.`;
    })
    .join("\n");

  return (
    `Prioritizing by Expected Annual Loss, you should fix these first:\n\n${lines}\n\n` +
    `Addressing these assets first gives you the largest expected reduction in annual financial risk per remediation effort.`
  );
}

function answerWhyAssetIsHighRisk(asset) {
  const r = riskEngine.calculateRisk(asset);
  return (
    `${r.assetName} is high-risk because it combines a high financial impact with a high residual probability of incident.\n\n` +
    `- Financial impact per incident: ${currency(r.financialImpact)} (downtime ${currency(asset.downtimeCost)} + ` +
    `data loss ${currency(asset.dataLossCost)} + recovery ${currency(asset.recoveryCost)})\n` +
    `- Inputs: criticality ${asset.criticality}/5, vulnerability severity ${asset.vulnerabilitySeverity}/5, exposure ${asset.exposure}/5\n` +
    `- Existing controls are only ${(asset.controlEffectiveness * 100).toFixed(0)}% effective, leaving a residual incident ` +
    `probability of ${(r.residualProbability * 100).toFixed(1)}% per year\n` +
    `- Resulting Expected Annual Loss: ${currency(r.eal)}/year (risk score: ${r.riskScore})`
  );
}

function answerScenarioQuestion(assets, scenarioKey) {
  const result = scenarioSimulator.simulateScenario(assets, scenarioKey);

  return (
    `Simulating "${result.scenarioLabel}":\n\n` +
    `- Before: Total EAL = ${currency(result.before.totalEAL)}/year, ${result.before.highRiskAssetCount} high-risk asset(s)\n` +
    `- After: Total EAL = ${currency(result.after.totalEAL)}/year, ${result.after.highRiskAssetCount} high-risk asset(s)\n` +
    `- Risk Reduction: ${currency(result.riskReduction)}/year (${result.percentReduction}% reduction)\n\n` +
    `Top affected asset: ${result.assetDeltas[0] ? result.assetDeltas[0].assetName : "N/A"} ` +
    `(EAL reduced by ${result.assetDeltas[0] ? currency(result.assetDeltas[0].ealReduction) : currency(0)}).`
  );
}

/**
 * generateExecutiveSummary(context)
 * ---------------------------------------------------------------
 * A short, board-ready summary of the current risk posture. Used
 * both as the default AI answer and directly by the dashboard.
 */
function generateExecutiveSummary(context) {
  const assets = context.assets || [];
  const enterpriseRisk = context.enterpriseRisk || riskEngine.calculateEnterpriseRisk(assets);
  const top = enterpriseRisk.topRiskContributor;

  return (
    `Executive Summary: Across ${enterpriseRisk.totalAssets} monitored assets, total financial exposure is ` +
    `${currency(enterpriseRisk.totalFinancialExposure)}, with a calculated Expected Annual Loss (EAL) of ` +
    `${currency(enterpriseRisk.totalEAL)}/year under current controls. ${enterpriseRisk.highRiskAssetCount} asset(s) ` +
    `are flagged as high-risk. The single largest contributor is ${top ? top.assetName : "N/A"} at ` +
    `${top ? currency(top.eal) : currency(0)}/year. Recommended next step: review the Investment Optimizer to see ` +
    `which security investments deliver the greatest risk reduction within your available budget.`
  );
}

/* ------------------------------------------------------------ *
 * OPTIONAL LLM MODE (used only if OPENAI_API_KEY is set)
 * ------------------------------------------------------------ */

async function generateWithLLM(context, question) {
  const { enterpriseRisk } = context;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const topAssets = enterpriseRisk.assets
    .slice()
    .sort((a, b) => b.eal - a.eal)
    .slice(0, 5)
    .map((a) => ({
      name: a.assetName,
      eal: a.eal,
      financialImpact: a.financialImpact,
      residualProbability: a.residualProbability,
      riskScore: a.riskScore
    }));

  const systemPrompt =
    "You are a cybersecurity risk analyst. You must ONLY use the numeric facts provided in the " +
    "JSON data below. Never invent, estimate, or hallucinate financial figures, probabilities, or " +
    "statistics that are not present in the data. Answer concisely in plain business English, " +
    "formatted for an executive audience, using Indian Rupee (₹) formatting for money.";

  const dataSummary = JSON.stringify(
    {
      totalEAL: enterpriseRisk.totalEAL,
      totalFinancialExposure: enterpriseRisk.totalFinancialExposure,
      highRiskAssetCount: enterpriseRisk.highRiskAssetCount,
      topAssets
    },
    null,
    2
  );

  const userPrompt = `Calculated risk data:\n${dataSummary}\n\nQuestion: ${question}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 400
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned status ${response.status}`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("OpenAI API returned an empty response");
  }

  return text.trim();
}

module.exports = {
  generateRiskExplanation,
  generateExecutiveSummary
};
