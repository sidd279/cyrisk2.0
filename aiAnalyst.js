/* =========================================================
   FILE: aiAnalyst.js
   TEAM MEMBER 3 — AI RISK ANALYST
   =========================================================
   PURPOSE:
   Provides a chat-style "AI analyst" that answers cyber risk
   questions in plain English WITHOUT needing an API key or
   internet connection. This is a RULE-BASED natural language
   generator: it detects the intent of a question using simple
   keyword matching, then plugs REAL calculated numbers (from
   riskEngine.js / optimizer.js / scenarioSimulator.js) into a
   pre-written explanation template.

   HARD RULE: this module must never invent a financial number.
   Every dollar figure it prints comes from a value that was
   already calculated elsewhere (asset.expectedAnnualLoss,
   asset.financialImpact, optimizer results, scenario results).

   HOW IT CONNECTS TO OTHER FILES:
     - riskEngine.js: supplies calculateAllRisk() / per-asset
       risk numbers used in almost every answer.
     - data.js: supplies loadAssets() / loadVulnerabilities()
       so the analyst can look up assets by name and list
       related vulnerabilities.
     - scenarioSimulator.js: supplies runScenario() so the
       analyst can answer "what happens if..." questions using
       the same simulation the Scenario Simulator UI uses.
     - optimizer.js: supplies runOptimization() so the analyst
       can answer budget/investment questions with real numbers.
     - app.js: wires the chat input box in index.html to
       askAI(question), which calls generateRiskExplanation().
   ========================================================= */

/**
 * Main entry point for the AI Risk Analyst. Detects the intent
 * behind a natural-language question and returns a plain-English
 * answer built entirely from real, already-calculated data.
 *
 * @param {string} question - the user's typed question
 * @param {Object} riskData - the output of calculateAllRisk()
 *   (an enterprise risk object containing perAssetRisk, totals, etc.)
 *   If omitted, this function will calculate it itself.
 * @returns {string} a natural-language answer (plain text, may
 *   contain simple line breaks for readability)
 */
function generateRiskExplanation(question, riskData) {
  const q = (question || "").toLowerCase().trim();
  const data = riskData || calculateAllRisk();

  if (!q) {
    return "Please type a question, for example: \"What is our highest financial cyber risk?\"";
  }

  // --- Intent 1: highest financial risk ---
  if (isHighestRiskQuestion(q)) {
    return answerHighestRisk(data);
  }

  // --- Intent 2: which vulnerabilities contribute most ---
  if (isVulnerabilityContributionQuestion(q)) {
    return answerVulnerabilityContribution(data);
  }

  // --- Intent 3: what should we fix first ---
  if (isFixFirstQuestion(q)) {
    return answerFixFirst(data);
  }

  // --- Intent 5: what-if / scenario questions (checked before the
  //     "why is X risky" check so phrases like "what happens if MFA
  //     is implemented" aren't mistaken for an asset lookup) ---
  const scenarioKey = detectScenarioKeyword(q);
  if (scenarioKey) {
    return answerScenarioQuestion(scenarioKey);
  }

  // --- Intent 4: "why is <asset> high-risk?" ---
  const matchedAsset = findAssetMentionedInQuestion(q, data);
  if (matchedAsset) {
    return answerWhyAssetIsRisky(matchedAsset, data);
  }

  // --- Intent 6: budget / investment questions ---
  if (isBudgetQuestion(q)) {
    return answerBudgetQuestion(q);
  }

  // --- Fallback: no confident match, guide the user ---
  return fallbackAnswer();
}

/* ---------------------------------------------------------
   INTENT DETECTION HELPERS
   --------------------------------------------------------- */

function isHighestRiskQuestion(q) {
  return (q.includes("highest") && (q.includes("risk") || q.includes("financial")));
}

function isVulnerabilityContributionQuestion(q) {
  return q.includes("vulnerab") && (q.includes("contribute") || q.includes("most") || q.includes("expected loss"));
}

function isFixFirstQuestion(q) {
  return q.includes("fix first") || q.includes("prioriti") || q.includes("what should we fix");
}

function isBudgetQuestion(q) {
  return q.includes("budget") || q.includes("invest") || q.includes("rosi");
}

/**
 * Detects whether the question refers to one of the known
 * what-if scenarios, and returns its scenario key if so.
 */
function detectScenarioKeyword(q) {
  const mentionsWhatIf = q.includes("what happens if") || q.includes("what if") || q.includes("what would happen");

  if (q.includes("mfa") || q.includes("multi-factor") || q.includes("multi factor")) {
    return "mfa";
  }
  if (q.includes("patch")) {
    return "patchCritical";
  }
  if (q.includes("segment")) {
    return "networkSegmentation";
  }
  if (q.includes("delay")) {
    return "delayRemediation";
  }
  // If the question is clearly a "what if" question but doesn't name
  // a specific control, default to no match so the fallback can help.
  if (mentionsWhatIf) {
    return null;
  }
  return null;
}

/**
 * Looks for any asset's name (or id) mentioned inside the question.
 * Returns the matching per-asset risk object, or null.
 */
function findAssetMentionedInQuestion(q, data) {
  const perAssetRisk = data.perAssetRisk || [];
  let bestMatch = null;

  perAssetRisk.forEach(asset => {
    const nameLower = asset.assetName.toLowerCase();
    const idLower = asset.assetId.toLowerCase();
    if (q.includes(nameLower) || q.includes(idLower)) {
      bestMatch = asset;
    } else {
      // Also try matching on individual significant words of the asset
      // name (e.g. "banking server" -> question mentions just "banking")
      const words = nameLower.split(" ").filter(w => w.length > 3);
      if (words.some(w => q.includes(w))) {
        bestMatch = bestMatch || asset;
      }
    }
  });

  return bestMatch;
}

/* ---------------------------------------------------------
   ANSWER BUILDERS (each uses ONLY real calculated numbers)
   --------------------------------------------------------- */

function answerHighestRisk(data) {
  const top = data.highestRiskAsset;
  if (!top) {
    return "I don't have enough asset data yet to determine the highest financial risk. Try loading sample data first.";
  }
  return (
    `Our highest financial cyber risk is currently the "${top.assetName}" ` +
    `(${top.assetType}), with an Expected Annual Loss (EAL) of ` +
    `${formatCurrency(top.expectedAnnualLoss)} (Prototype Estimate).\n\n` +
    `This is driven by a residual incident probability of ${formatPercent(top.residualProbability)} ` +
    `and a total financial impact of ${formatCurrency(top.financialImpact)} if an incident occurred ` +
    `(covering downtime, data loss, and recovery costs).`
  );
}

function answerVulnerabilityContribution(data) {
  const vulnerabilities = loadVulnerabilities();
  const perAssetRisk = data.perAssetRisk || [];

  // Attribute each asset's EAL to its associated vulnerabilities so we
  // can show which vulnerabilities sit on the highest-loss assets.
  const scored = vulnerabilities.map(v => {
    const assetRisk = perAssetRisk.find(a => a.assetId === v.assetId);
    return {
      vulnerability: v,
      assetName: assetRisk ? assetRisk.assetName : "Unknown Asset",
      assetEAL: assetRisk ? assetRisk.expectedAnnualLoss : 0
    };
  });

  scored.sort((a, b) => (b.vulnerability.severity - a.vulnerability.severity) || (b.assetEAL - a.assetEAL));

  const top3 = scored.slice(0, 3);
  const lines = top3.map((s, i) =>
    `${i + 1}. "${s.vulnerability.name}" on ${s.assetName} (severity ${s.vulnerability.severity}/5, ` +
    `sitting on an asset with ${formatCurrency(s.assetEAL)} in Expected Annual Loss)`
  );

  return (
    `The vulnerabilities contributing most to our expected losses are:\n\n` +
    lines.join("\n") +
    `\n\nThese are ranked by severity and by the financial exposure of the asset they affect (Prototype Estimates).`
  );
}

function answerFixFirst(data) {
  const top = identifyTopRiskContributors(loadAssets(), 3);
  const lines = top.map((r, i) =>
    `${i + 1}. ${r.assetName} — Expected Annual Loss of ${formatCurrency(r.expectedAnnualLoss)}`
  );
  return (
    `Based on Expected Annual Loss, you should prioritize remediation in this order:\n\n` +
    lines.join("\n") +
    `\n\nFixing the top item first typically yields the largest reduction in overall financial risk, ` +
    `since it currently represents the biggest share of total expected loss (Prototype Estimates).`
  );
}

function answerWhyAssetIsRisky(assetRisk, data) {
  const relatedVulns = getVulnerabilitiesForAsset(assetRisk.assetId);
  const worstVuln = relatedVulns.slice().sort((a, b) => b.severity - a.severity)[0];

  let vulnSentence = "";
  if (worstVuln) {
    vulnSentence = ` Its most severe known issue is "${worstVuln.name}" (severity ${worstVuln.severity}/5).`;
  }

  return (
    `The "${assetRisk.assetName}" is high-risk because it combines high business criticality, ` +
    `meaningful vulnerability exposure, and significant potential financial impact.` +
    vulnSentence +
    `\n\nIts calculated residual probability of an incident is ${formatPercent(assetRisk.residualProbability)}, ` +
    `and its total financial impact (downtime + data loss + recovery) is ${formatCurrency(assetRisk.financialImpact)}. ` +
    `Together these produce an Expected Annual Loss of ${formatCurrency(assetRisk.expectedAnnualLoss)} (Prototype Estimate).`
  );
}

function answerScenarioQuestion(scenarioKey) {
  const result = runScenario(scenarioKey);
  if (!result) {
    return "I couldn't run that scenario. Try asking about MFA, patching, network segmentation, or delaying remediation.";
  }
  return (
    `If we ${result.scenarioLabel.toLowerCase()}, here's what our model predicts:\n\n` +
    `Before: ${formatCurrency(result.beforeEAL)} in total Expected Annual Loss\n` +
    `After: ${formatCurrency(result.afterEAL)} in total Expected Annual Loss\n\n` +
    `That's a risk reduction of ${formatCurrency(result.riskReduction)}, or ${formatPercent(result.percentageReduction / 100)} ` +
    `of current total risk (Prototype Estimate, based on the same risk model used across this dashboard).`
  );
}

function answerBudgetQuestion(q) {
  // Try to extract a number from the question to use as a budget,
  // otherwise fall back to a sensible default so the answer is still useful.
  const numberMatch = q.match(/[\d,]{4,}/);
  const budget = numberMatch ? Number(numberMatch[0].replace(/,/g, "")) : 1000000;

  const result = runOptimization(budget);
  if (!result || result.selectedInvestments.length === 0) {
    return (
      `With a budget of ${formatCurrency(budget)}, I couldn't fit any investments. ` +
      `Try increasing the budget or use the Investment Optimizer panel to test different amounts.`
    );
  }

  const names = result.selectedInvestments.map(inv => inv.name).join(", ");
  return (
    `With a budget of ${formatCurrency(budget)}, the recommended investment combination is: ${names}.\n\n` +
    `Total investment: ${formatCurrency(result.totalInvestment)}\n` +
    `Estimated risk reduction: ${formatCurrency(result.totalRiskReduction)}\n` +
    `Remaining budget: ${formatCurrency(result.remainingBudget)}\n` +
    `ROSI: ${result.rosi}% (Prototype Estimate)\n\n` +
    `You can test other budgets directly in the Investment Optimizer panel.`
  );
}

function fallbackAnswer() {
  return (
    `I'm a rule-based risk analyst focused on this dashboard's data. Try asking me:\n\n` +
    `- "What is our highest financial cyber risk?"\n` +
    `- "Which vulnerabilities contribute most to our expected losses?"\n` +
    `- "What should we fix first?"\n` +
    `- "Why is the [asset name] high-risk?"\n` +
    `- "What happens if MFA is implemented?"\n` +
    `- "What can we do with a budget of 1000000?"`
  );
}

/* ---------------------------------------------------------
   FORMATTING HELPERS
   --------------------------------------------------------- */

function formatCurrency(value) {
  const num = Number(value) || 0;
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPercent(fraction) {
  const num = Number(fraction) || 0;
  return (num * 100).toFixed(1) + "%";
}

/* ---------------------------------------------------------
   "API REPLACEMENT" WRAPPER (see Section 11 of the spec)
   ---------------------------------------------------------
   askAI() is the function app.js calls from the chat UI. It
   loads the latest calculated risk data and delegates to
   generateRiskExplanation(), so the chat box never has to know
   about riskEngine.js directly.
   --------------------------------------------------------- */
function askAI(question) {
  const riskData = calculateAllRisk();
  return generateRiskExplanation(question, riskData);
}
