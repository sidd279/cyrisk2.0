/* =========================================================
   FILE: scenarioSimulator.js
   TEAM MEMBER: Scenario Simulator
   =========================================================
   PURPOSE:
   Lets the user ask "what if" questions about their security
   posture, e.g. "what happens if we implement MFA?" or
   "what happens if we delay remediation by 30 days?".

   IMPORTANT: this module does NOT invent a separate risk
   model. It re-uses calculateEnterpriseRisk() from
   riskEngine.js on a modified copy of the asset data, so the
   "before" and "after" numbers are always consistent with the
   rest of the dashboard.

   HOW IT CONNECTS TO OTHER FILES:
     - riskEngine.js provides calculateEnterpriseRisk(), which
       this file calls twice: once on the original assets
       ("before") and once on a scenario-adjusted copy
       ("after").
     - data.js supplies the current assets via loadAssets().
     - app.js calls runScenario(scenarioKey) when the user
       clicks a scenario button, and renders the result in the
       Scenario Simulator section and the
       "Before vs After Risk" chart.
     - aiAnalyst.js calls simulateScenario() directly when the
       user asks a what-if question in the chat
       (e.g. "What happens if MFA is implemented?").
   ========================================================= */

/**
 * Catalog of supported scenarios. Each scenario has a unique key,
 * a human-readable label, a short description, and an "apply"
 * function that takes one asset and returns a MODIFIED COPY of it
 * (never mutates the original asset object).
 */
const SCENARIOS = {
  mfa: {
    key: "mfa",
    label: "Implement Multi-Factor Authentication (MFA)",
    description: "Strengthens access control on all assets by making stolen or guessed passwords far less useful to attackers.",
    apply: function (asset) {
      const updated = Object.assign({}, asset);
      // MFA primarily boosts control effectiveness (fewer successful logins)
      updated.controlEffectiveness = clamp01(asset.controlEffectiveness + 0.25);
      return updated;
    }
  },
  patchCritical: {
    key: "patchCritical",
    label: "Patch Critical Vulnerabilities",
    description: "Fixes the most severe known vulnerabilities (severity 4 or 5), directly lowering how easily assets can be exploited.",
    apply: function (asset) {
      const updated = Object.assign({}, asset);
      if (asset.vulnerabilitySeverity >= 4) {
        updated.vulnerabilitySeverity = clampScaleValue(asset.vulnerabilitySeverity - 2);
      }
      return updated;
    }
  },
  networkSegmentation: {
    key: "networkSegmentation",
    label: "Network Segmentation",
    description: "Isolates critical systems from general network traffic, reducing how exposed/reachable they are to attackers.",
    apply: function (asset) {
      const updated = Object.assign({}, asset);
      updated.exposure = clampScaleValue(asset.exposure - 2);
      return updated;
    }
  },
  delayRemediation: {
    key: "delayRemediation",
    label: "Delay Remediation by 30 Days",
    description: "Simulates the impact of leaving known issues unresolved for an extra month: vulnerabilities go stale and controls degrade slightly.",
    apply: function (asset) {
      const updated = Object.assign({}, asset);
      updated.vulnerabilitySeverity = clampScaleValue(asset.vulnerabilitySeverity + 1);
      updated.controlEffectiveness = clamp01(asset.controlEffectiveness - 0.1);
      return updated;
    }
  }
};

/**
 * Runs a what-if scenario against a given set of assets and
 * returns the before/after Expected Annual Loss comparison.
 *
 * @param {Array<Object>} assets - current asset data (from data.js)
 * @param {string} scenarioKey - one of the keys in SCENARIOS
 *   ("mfa", "patchCritical", "networkSegmentation", "delayRemediation")
 * @returns {Object} {
 *   scenarioKey, scenarioLabel, description,
 *   beforeEAL, afterEAL,
 *   riskReduction, percentageReduction,
 *   beforePerAsset, afterPerAsset
 * }
 */
function simulateScenario(assets, scenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    console.warn(`simulateScenario: unknown scenario "${scenarioKey}"`);
    return null;
  }

  // "Before" picture uses the risk engine untouched.
  const beforeResult = calculateEnterpriseRisk(assets);

  // "After" picture: apply the scenario's transformation to a COPY
  // of every asset, then re-run the exact same risk engine.
  const modifiedAssets = assets.map(scenario.apply);
  const afterResult = calculateEnterpriseRisk(modifiedAssets);

  const riskReduction = beforeResult.totalExpectedAnnualLoss - afterResult.totalExpectedAnnualLoss;
  const percentageReduction = beforeResult.totalExpectedAnnualLoss > 0
    ? (riskReduction / beforeResult.totalExpectedAnnualLoss) * 100
    : 0;

  return {
    scenarioKey: scenario.key,
    scenarioLabel: scenario.label,
    description: scenario.description,
    beforeEAL: round2(beforeResult.totalExpectedAnnualLoss),
    afterEAL: round2(afterResult.totalExpectedAnnualLoss),
    riskReduction: round2(riskReduction),
    percentageReduction: round2(percentageReduction),
    beforePerAsset: beforeResult.perAssetRisk,
    afterPerAsset: afterResult.perAssetRisk
  };
}

/**
 * Returns the list of scenarios available in the UI, in a simple
 * array form (useful for building buttons/dropdowns dynamically).
 * @returns {Array<Object>}
 */
function getAvailableScenarios() {
  return Object.values(SCENARIOS).map(s => ({
    key: s.key,
    label: s.label,
    description: s.description
  }));
}

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */

function clamp01(value) {
  const num = Number(value);
  if (isNaN(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

function clampScaleValue(value) {
  const num = Number(value);
  if (isNaN(num)) return 1;
  return Math.min(5, Math.max(1, num));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/* ---------------------------------------------------------
   "API REPLACEMENT" WRAPPER (see Section 11 of the spec)
   ---------------------------------------------------------
   runScenario() loads the current assets from data.js and runs
   the requested scenario, so app.js and aiAnalyst.js have one
   simple function to call instead of an HTTP endpoint.
   --------------------------------------------------------- */
function runScenario(scenarioKey) {
  const assets = loadAssets();
  return simulateScenario(assets, scenarioKey);
}
