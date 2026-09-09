/**
 * modules/scenarioSimulator.js
 * ---------------------------------------------------------------
 * SCENARIO SIMULATOR
 *
 * Lets the user ask "what if?" questions about the security
 * posture (e.g. "what happens if we implement MFA everywhere?")
 * and see the before/after Expected Annual Loss.
 *
 * IMPORTANT: this module does NOT invent a second risk formula. It
 * clones the asset list, adjusts the relevant inputs (control
 * effectiveness, vulnerability severity, exposure, or probability
 * window), and then re-runs the exact same modules/riskEngine.js
 * calculations on both the "before" and "after" versions. That is
 * the only way risk is ever computed in this app.
 * ---------------------------------------------------------------
 */

const riskEngine = require("./riskEngine");

// Supported scenario identifiers and a short human-readable label for each.
const SCENARIOS = {
  mfa: "Implement Multi-Factor Authentication (MFA)",
  patch: "Patch Critical Vulnerabilities",
  segmentation: "Network Segmentation",
  delay: "Delay Remediation by 30 Days"
};

/**
 * Apply a scenario's effect to a single (cloned) asset. Each scenario
 * nudges realistic, explainable inputs — never the output numbers
 * directly.
 */
function applyScenarioToAsset(asset, scenario) {
  const modified = { ...asset };

  switch (scenario) {
    case "mfa":
      // MFA primarily strengthens access controls -> boosts control
      // effectiveness. Effect is larger for assets with weaker existing
      // controls (diminishing returns as you approach 1.0).
      modified.controlEffectiveness = riskEngine.clamp(
        (Number(asset.controlEffectiveness) || 0) + 0.3,
        0,
        0.95
      );
      break;

    case "patch":
      // Patching critical vulnerabilities directly lowers the
      // vulnerability severity input (but not below a small residual
      // baseline of 1, since no system is ever 100% vulnerability-free).
      modified.vulnerabilitySeverity = Math.max(
        1,
        (Number(asset.vulnerabilitySeverity) || 0) - 2
      );
      break;

    case "segmentation":
      // Network segmentation reduces how exposed/reachable an asset is
      // from the broader network / internet.
      modified.exposure = Math.max(1, (Number(asset.exposure) || 0) - 2);
      break;

    case "delay":
      // Delaying remediation by 30 days means vulnerabilities stay open
      // longer and controls effectively degrade in relative value — we
      // model this as increased exposure (more time for an attacker to
      // find and use the opening) and a reduction in control
      // effectiveness (patches/mitigations that were "in progress" are
      // assumed not yet applied).
      modified.exposure = Math.min(5, (Number(asset.exposure) || 0) + 1);
      modified.controlEffectiveness = riskEngine.clamp(
        (Number(asset.controlEffectiveness) || 0) - 0.1,
        0,
        1
      );
      break;

    default:
      // Unknown scenario: no change applied (before === after)
      break;
  }

  return modified;
}

/**
 * simulateScenario(assets, scenario)
 * ---------------------------------------------------------------
 * @param {Array} assets - the full asset list (data/assets.json shape)
 * @param {String} scenario - one of "mfa" | "patch" | "segmentation" | "delay"
 *
 * Returns a before/after comparison using riskEngine.calculateEnterpriseRisk
 * for both states, plus the per-asset deltas.
 */
function simulateScenario(assets, scenario) {
  const key = String(scenario || "").toLowerCase().trim();

  if (!SCENARIOS[key]) {
    const validKeys = Object.keys(SCENARIOS).join(", ");
    throw new Error(`Unknown scenario "${scenario}". Valid options are: ${validKeys}`);
  }

  const before = riskEngine.calculateEnterpriseRisk(assets);

  const modifiedAssets = assets.map((asset) => applyScenarioToAsset(asset, key));
  const after = riskEngine.calculateEnterpriseRisk(modifiedAssets);

  const ealBefore = before.totalEAL;
  const ealAfter = after.totalEAL;
  const riskReduction = round2(ealBefore - ealAfter);
  const percentReduction = ealBefore > 0 ? round2((riskReduction / ealBefore) * 100) : 0;

  // Per-asset breakdown of how much each asset's EAL changed
  const assetDeltas = before.assets.map((beforeAsset) => {
    const afterAsset = after.assets.find((a) => a.assetId === beforeAsset.assetId);
    return {
      assetId: beforeAsset.assetId,
      assetName: beforeAsset.assetName,
      ealBefore: beforeAsset.eal,
      ealAfter: afterAsset ? afterAsset.eal : beforeAsset.eal,
      ealReduction: round2(beforeAsset.eal - (afterAsset ? afterAsset.eal : beforeAsset.eal))
    };
  });

  return {
    scenario: key,
    scenarioLabel: SCENARIOS[key],
    before: {
      totalEAL: ealBefore,
      totalFinancialExposure: before.totalFinancialExposure,
      highRiskAssetCount: before.highRiskAssetCount
    },
    after: {
      totalEAL: ealAfter,
      totalFinancialExposure: after.totalFinancialExposure,
      highRiskAssetCount: after.highRiskAssetCount
    },
    riskReduction,
    percentReduction,
    assetDeltas: assetDeltas.sort((a, b) => b.ealReduction - a.ealReduction)
  };
}

function listScenarios() {
  return Object.entries(SCENARIOS).map(([key, label]) => ({ key, label }));
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = {
  simulateScenario,
  listScenarios
};
