/* =========================================================
   FILE: riskEngine.js
   TEAM MEMBER 1 — RISK ENGINE
   =========================================================
   PURPOSE:
   This is the SINGLE SOURCE OF TRUTH for every risk number
   shown anywhere in the dashboard. No other file is allowed
   to invent or duplicate a risk formula — they all call into
   the functions defined here.

   MODEL USED (explainable, prototype-grade):

     Financial Impact =
         Downtime Cost + Data Loss Cost + Recovery Cost

     Probability =
         0.02 * Vulnerability Severity
       + 0.02 * Exposure Level
       + 0.01 * Asset Criticality

     Residual Probability =
         Probability * (1 - Control Effectiveness)

     Expected Annual Loss (EAL) =
         Residual Probability * Financial Impact

     Risk Score =
         Severity * Exposure * Criticality

   All probability values are clamped between 0 and 1 so the
   model never produces nonsensical (>100%) chances.

   HOW IT CONNECTS TO OTHER FILES:
     - data.js supplies the raw asset objects.
     - app.js calls calculateAllRisk() (a thin wrapper, see
       bottom of file) to get computed risk for every asset
       and render the dashboard cards/tables/charts.
     - optimizer.js uses the enterprise EAL total as the
       "current risk" baseline before optimization.
     - scenarioSimulator.js re-uses calculateRisk() to compute
       "before" and "after" EAL when simulating a control change.
     - aiAnalyst.js reads the objects returned by these
       functions to write natural-language explanations
       (it never invents its own numbers).
   ========================================================= */

/**
 * Calculates full risk details for a single asset.
 * This is the core function of the entire prototype.
 *
 * @param {Object} asset - an asset object from data.js
 *   (must contain criticality, vulnerabilitySeverity, exposure,
 *    controlEffectiveness, downtimeCost, dataLossCost, recoveryCost)
 * @returns {Object} a risk result object:
 *   {
 *     assetId, assetName,
 *     financialImpact,
 *     probability,           // inherent (before controls), 0-1
 *     residualProbability,   // after controls, 0-1
 *     expectedAnnualLoss,    // EAL in currency units
 *     riskScore,             // severity * exposure * criticality
 *     inherentAnnualLoss     // EAL if controls were 0% effective
 *   }
 */
function calculateRisk(asset) {
  const financialImpact = calculateFinancialImpact(asset);

  // --- Probability (inherent, before controls) ---
  let probability =
    0.02 * asset.vulnerabilitySeverity +
    0.02 * asset.exposure +
    0.01 * asset.criticality;
  probability = clampProbabilityValue(probability);

  // --- Residual probability (after controls reduce it) ---
  const controlEffectiveness = clampProbabilityValue(asset.controlEffectiveness);
  let residualProbability = probability * (1 - controlEffectiveness);
  residualProbability = clampProbabilityValue(residualProbability);

  // --- Expected Annual Loss (the headline financial risk number) ---
  const expectedAnnualLoss = residualProbability * financialImpact;

  // --- Inherent Annual Loss: what the loss would be with NO controls ---
  // (useful context for the AI analyst / "why is this risky" explanations)
  const inherentAnnualLoss = probability * financialImpact;

  // --- Risk Score: a simple, unit-less ranking score (not currency) ---
  const riskScore =
    asset.vulnerabilitySeverity * asset.exposure * asset.criticality;

  return {
    assetId: asset.id,
    assetName: asset.name,
    assetType: asset.type,
    financialImpact: round2(financialImpact),
    probability: round4(probability),
    residualProbability: round4(residualProbability),
    expectedAnnualLoss: round2(expectedAnnualLoss),
    inherentAnnualLoss: round2(inherentAnnualLoss),
    riskScore: riskScore,
    controlEffectiveness: controlEffectiveness
  };
}

/**
 * Calculates the Financial Impact for a single asset.
 * Financial Impact = Downtime Cost + Data Loss Cost + Recovery Cost
 *
 * @param {Object} asset
 * @returns {number}
 */
function calculateFinancialImpact(asset) {
  const downtime = Number(asset.downtimeCost) || 0;
  const dataLoss = Number(asset.dataLossCost) || 0;
  const recovery = Number(asset.recoveryCost) || 0;
  return downtime + dataLoss + recovery;
}

/**
 * Calculates enterprise-wide (aggregate) risk across ALL assets.
 * This powers the Executive Dashboard summary cards.
 *
 * @param {Array<Object>} assets - array of asset objects
 * @returns {Object} {
 *   totalExpectedAnnualLoss,
 *   totalFinancialExposure,   // sum of financial impact across all assets
 *   totalInherentAnnualLoss,
 *   highRiskAssetCount,       // assets with EAL above the high-risk threshold
 *   perAssetRisk,             // array of calculateRisk() results
 *   highestRiskAsset          // the single riskiest asset's result object
 * }
 */
function calculateEnterpriseRisk(assets) {
  const perAssetRisk = assets.map(calculateRisk);

  const totalExpectedAnnualLoss = perAssetRisk.reduce(
    (sum, r) => sum + r.expectedAnnualLoss, 0
  );
  const totalFinancialExposure = perAssetRisk.reduce(
    (sum, r) => sum + r.financialImpact, 0
  );
  const totalInherentAnnualLoss = perAssetRisk.reduce(
    (sum, r) => sum + r.inherentAnnualLoss, 0
  );

  // A "high-risk" asset is defined (for this prototype) as one whose
  // Expected Annual Loss is at or above 15% of the total EAL, OR
  // whose absolute EAL exceeds 150,000 - whichever is more lenient.
  // This keeps the threshold meaningful even with small or large
  // enterprise data sets.
  const relativeThreshold = totalExpectedAnnualLoss * 0.15;
  const absoluteThreshold = 150000;
  const highRiskThreshold = Math.min(relativeThreshold, absoluteThreshold) || absoluteThreshold;

  const highRiskAssetCount = perAssetRisk.filter(
    r => r.expectedAnnualLoss >= highRiskThreshold
  ).length;

  const ranked = rankAssetsByRisk(assets);
  const highestRiskAsset = ranked.length > 0 ? ranked[0] : null;

  return {
    totalExpectedAnnualLoss: round2(totalExpectedAnnualLoss),
    totalFinancialExposure: round2(totalFinancialExposure),
    totalInherentAnnualLoss: round2(totalInherentAnnualLoss),
    highRiskAssetCount: highRiskAssetCount,
    highRiskThreshold: round2(highRiskThreshold),
    perAssetRisk: perAssetRisk,
    highestRiskAsset: highestRiskAsset
  };
}

/**
 * Ranks assets from highest to lowest risk based on
 * Expected Annual Loss (the financial risk measure).
 *
 * @param {Array<Object>} assets
 * @returns {Array<Object>} calculateRisk() results, sorted descending
 *   by expectedAnnualLoss, each annotated with a "rank" field (1 = highest).
 */
function rankAssetsByRisk(assets) {
  const results = assets.map(calculateRisk);
  results.sort((a, b) => b.expectedAnnualLoss - a.expectedAnnualLoss);
  results.forEach((r, index) => {
    r.rank = index + 1;
  });
  return results;
}

/**
 * Identifies the top N risk contributors (assets driving the most
 * expected loss). Useful for "what should we fix first" style answers.
 *
 * @param {Array<Object>} assets
 * @param {number} topN
 * @returns {Array<Object>}
 */
function identifyTopRiskContributors(assets, topN) {
  const n = topN || 3;
  return rankAssetsByRisk(assets).slice(0, n);
}

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */

/** Clamps any probability-like number strictly between 0 and 1. */
function clampProbabilityValue(value) {
  const num = Number(value);
  if (isNaN(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

/* ---------------------------------------------------------
   "API REPLACEMENT" WRAPPER (see Section 11 of the spec)
   ---------------------------------------------------------
   calculateAllRisk() acts like a REST endpoint would in a
   real backend: it loads the current assets from data.js and
   returns the fully calculated enterprise risk picture in one
   call. app.js uses this as its main entry point instead of
   making an HTTP request.
   --------------------------------------------------------- */
function calculateAllRisk() {
  const assets = loadAssets();
  return calculateEnterpriseRisk(assets);
}
