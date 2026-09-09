/**
 * modules/riskEngine.js
 * ---------------------------------------------------------------
 * TEAM MEMBER 1 — RISK ENGINE
 *
 * This is the single source of truth for every risk / financial
 * calculation in the whole application. No other module (or the
 * frontend) is allowed to re-implement these formulas — they must
 * all call into this file instead. That keeps the numbers shown on
 * the dashboard, returned by the optimizer, explained by the AI
 * analyst, and produced by the scenario simulator perfectly
 * consistent with each other.
 *
 * All formulas are intentionally simple and explainable — this is
 * a hackathon prototype, not a production actuarial model.
 * ---------------------------------------------------------------
 */

/**
 * Clamp a number so it always stays inside [min, max].
 * Used to keep probabilities in the valid 0..1 range.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Financial Impact = Downtime Cost + Data Loss Cost + Recovery Cost
 *
 * This represents "if the bad thing happens, how much does it cost us
 * in one incident".
 */
function calculateFinancialImpact(asset) {
  const downtimeCost = Number(asset.downtimeCost) || 0;
  const dataLossCost = Number(asset.dataLossCost) || 0;
  const recoveryCost = Number(asset.recoveryCost) || 0;

  return downtimeCost + dataLossCost + recoveryCost;
}

/**
 * Probability (inherent, before controls) =
 *   0.02 x Vulnerability Severity
 * + 0.02 x Exposure Level
 * + 0.01 x Asset Criticality
 *
 * Severity / Exposure / Criticality are expected on a 1-5 scale, so the
 * theoretical max is (0.02*5)+(0.02*5)+(0.01*5) = 0.25, i.e. a 25% chance
 * of an incident in a year for the worst-case asset. The result is
 * clamped to [0, 1] regardless, in case input data is out of range.
 */
function calculateProbability(asset) {
  const severity = Number(asset.vulnerabilitySeverity) || 0;
  const exposure = Number(asset.exposure) || 0;
  const criticality = Number(asset.criticality) || 0;

  const probability = 0.02 * severity + 0.02 * exposure + 0.01 * criticality;

  return clamp(probability, 0, 1);
}

/**
 * Residual Probability = Probability x (1 - Control Effectiveness)
 *
 * Control Effectiveness is expected on a 0..1 scale (0 = no controls,
 * 1 = perfect controls). This represents how much the existing security
 * controls reduce the raw/inherent probability of an incident.
 */
function calculateResidualProbability(asset) {
  const probability = calculateProbability(asset);
  const controlEffectiveness = clamp(Number(asset.controlEffectiveness) || 0, 0, 1);

  return clamp(probability * (1 - controlEffectiveness), 0, 1);
}

/**
 * Risk Score = Severity x Exposure x Criticality
 *
 * A simple, unitless "how dangerous is this asset" score used for
 * ranking/sorting and for quick visual comparison. It is NOT a
 * financial figure (that's what EAL is for).
 */
function calculateRiskScore(asset) {
  const severity = Number(asset.vulnerabilitySeverity) || 0;
  const exposure = Number(asset.exposure) || 0;
  const criticality = Number(asset.criticality) || 0;

  return severity * exposure * criticality;
}

/**
 * calculateRisk(asset)
 * ---------------------------------------------------------------
 * The main per-asset calculation. Returns a full, explainable
 * breakdown of every intermediate value so the frontend and the AI
 * analyst can both show/explain "why" a number is what it is,
 * without recalculating anything themselves.
 *
 * Inherent Risk  = Probability (before controls) x Financial Impact
 * Residual Risk  = Residual Probability (after controls) x Financial Impact
 * EAL (Expected Annual Loss) = Residual Risk (this is the number we
 *   report as "the" expected annual loss, since it reflects the
 *   controls actually in place today).
 */
function calculateRisk(asset) {
  const financialImpact = calculateFinancialImpact(asset);
  const probability = calculateProbability(asset);
  const residualProbability = calculateResidualProbability(asset);
  const riskScore = calculateRiskScore(asset);

  const inherentRisk = probability * financialImpact;
  const residualRisk = residualProbability * financialImpact;
  const eal = residualRisk; // Expected Annual Loss uses the residual (post-control) probability

  const riskReducedByControls = inherentRisk - residualRisk;

  return {
    assetId: asset.id,
    assetName: asset.name,
    assetType: asset.type || "Unknown",
    financialImpact: round2(financialImpact),
    probability: round4(probability),
    residualProbability: round4(residualProbability),
    controlEffectiveness: clamp(Number(asset.controlEffectiveness) || 0, 0, 1),
    riskScore: round2(riskScore),
    inherentRisk: round2(inherentRisk),
    residualRisk: round2(residualRisk),
    eal: round2(eal),
    riskReducedByControls: round2(riskReducedByControls),
    // raw inputs echoed back for transparency / debugging in the UI
    inputs: {
      criticality: asset.criticality,
      vulnerabilitySeverity: asset.vulnerabilitySeverity,
      exposure: asset.exposure,
      controlEffectiveness: asset.controlEffectiveness,
      downtimeCost: asset.downtimeCost,
      dataLossCost: asset.dataLossCost,
      recoveryCost: asset.recoveryCost
    }
  };
}

/**
 * calculateEnterpriseRisk(assets)
 * ---------------------------------------------------------------
 * Aggregates calculateRisk() across the whole asset portfolio to
 * produce the numbers shown on the Executive Dashboard cards:
 * total EAL, total financial exposure, high-risk asset count,
 * and the single highest-risk asset (the "top risk contributor").
 */
function calculateEnterpriseRisk(assets) {
  const perAsset = assets.map(calculateRisk);

  const totalEAL = perAsset.reduce((sum, r) => sum + r.eal, 0);
  const totalFinancialExposure = perAsset.reduce((sum, r) => sum + r.financialImpact, 0);
  const totalInherentRisk = perAsset.reduce((sum, r) => sum + r.inherentRisk, 0);

  // "High risk" threshold: an asset whose EAL is at or above 15% of its
  // own financial impact, OR whose riskScore is in the top band (>=60).
  // This is a simple, explainable prototype rule — tune freely.
  const highRiskAssets = perAsset.filter(
    (r) => r.riskScore >= 60 || (r.financialImpact > 0 && r.eal / r.financialImpact >= 0.15)
  );

  const ranked = [...perAsset].sort((a, b) => b.eal - a.eal);
  const topRiskContributor = ranked[0] || null;

  return {
    totalAssets: assets.length,
    totalEAL: round2(totalEAL),
    totalFinancialExposure: round2(totalFinancialExposure),
    totalInherentRisk: round2(totalInherentRisk),
    highRiskAssetCount: highRiskAssets.length,
    highRiskAssets: highRiskAssets.map((r) => r.assetId),
    topRiskContributor,
    assets: perAsset
  };
}

/**
 * rankAssetsByRisk(assets)
 * ---------------------------------------------------------------
 * Returns assets sorted from highest to lowest Expected Annual Loss,
 * with an added `rank` field (1 = highest risk).
 */
function rankAssetsByRisk(assets) {
  const perAsset = assets.map(calculateRisk);
  const ranked = [...perAsset].sort((a, b) => b.eal - a.eal);

  return ranked.map((r, index) => ({ rank: index + 1, ...r }));
}

/**
 * identifyTopRiskContributors(assets, limit = 5)
 * ---------------------------------------------------------------
 * Convenience helper for the AI analyst / dashboard: top N assets
 * by EAL, used to answer "what should we fix first" style questions.
 */
function identifyTopRiskContributors(assets, limit = 5) {
  return rankAssetsByRisk(assets).slice(0, limit);
}

// --- small rounding helpers to keep JSON responses readable ---
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function round4(n) {
  return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
}

module.exports = {
  calculateRisk,
  calculateEnterpriseRisk,
  rankAssetsByRisk,
  calculateFinancialImpact,
  identifyTopRiskContributors,
  // exported for reuse by scenarioSimulator.js so formulas are never duplicated
  calculateProbability,
  calculateResidualProbability,
  calculateRiskScore,
  clamp
};
