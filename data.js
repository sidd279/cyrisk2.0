/* =========================================================
   FILE: data.js
   TEAM MEMBER 2 — DATA MANAGEMENT
   =========================================================
   PURPOSE:
   This file is the single source of "raw" data for the whole
   prototype. It holds:
     - 10 synthetic (fake but realistic) enterprise IT assets
     - 15 synthetic vulnerabilities
     - 5 synthetic security investment options

   It also provides small helper functions so the rest of the
   app (app.js, riskEngine.js, optimizer.js, aiAnalyst.js,
   scenarioSimulator.js) can load, edit, add, delete and reset
   this data WITHOUT needing a backend or database.

   Persistence is done with the browser's built-in
   localStorage, so edits survive a page refresh.

   HOW IT CONNECTS TO OTHER FILES:
     - index.html loads this file first (before riskEngine.js)
       using <script src="data.js"></script>
     - riskEngine.js reads the "assets" array returned by
       loadAssets() and calculates risk for each asset.
     - optimizer.js reads the "investments" array returned by
       loadInvestments().
     - app.js calls addAsset(), updateAsset(), deleteAsset()
       and resetSampleData() when the user interacts with the
       Asset Risk Table UI.
   ========================================================= */

/* ---------------------------------------------------------
   1. SAMPLE (DEFAULT) ASSET DATA
   ---------------------------------------------------------
   Each asset represents a piece of IT infrastructure that
   could be affected by a cyber incident.

   Field meanings (all on a simple 1-5 scale unless noted):
     criticality           -> how important this asset is to the business
     vulnerabilitySeverity -> how severe the worst known vulnerability is
     exposure              -> how exposed/reachable the asset is
                               (e.g. internet-facing = high)
     controlEffectiveness  -> 0.0 - 1.0, how well existing
                               security controls reduce the
                               probability of a successful attack
                               (0 = no protection, 1 = perfect protection)
     downtimeCost          -> estimated cost (in currency units) if the
                               asset goes down for a typical incident
     dataLossCost          -> estimated cost of a data breach/loss event
     recoveryCost          -> estimated cost to investigate & recover
   --------------------------------------------------------- */
const DEFAULT_ASSETS = [
  {
    id: "A001",
    name: "Banking Server",
    type: "Server",
    criticality: 5,
    vulnerabilitySeverity: 5,
    exposure: 5,
    controlEffectiveness: 0.4,
    downtimeCost: 500000,
    dataLossCost: 1000000,
    recoveryCost: 200000
  },
  {
    id: "A002",
    name: "Customer Database",
    type: "Database",
    criticality: 5,
    vulnerabilitySeverity: 4,
    exposure: 3,
    controlEffectiveness: 0.5,
    downtimeCost: 300000,
    dataLossCost: 1200000,
    recoveryCost: 150000
  },
  {
    id: "A003",
    name: "Corporate Email Server",
    type: "Server",
    criticality: 4,
    vulnerabilitySeverity: 4,
    exposure: 5,
    controlEffectiveness: 0.5,
    downtimeCost: 150000,
    dataLossCost: 400000,
    recoveryCost: 80000
  },
  {
    id: "A004",
    name: "E-Commerce Web Application",
    type: "Web Application",
    criticality: 5,
    vulnerabilitySeverity: 5,
    exposure: 5,
    controlEffectiveness: 0.35,
    downtimeCost: 600000,
    dataLossCost: 900000,
    recoveryCost: 180000
  },
  {
    id: "A005",
    name: "Employee Laptop Fleet",
    type: "Endpoint",
    criticality: 3,
    vulnerabilitySeverity: 3,
    exposure: 4,
    controlEffectiveness: 0.45,
    downtimeCost: 80000,
    dataLossCost: 250000,
    recoveryCost: 60000
  },
  {
    id: "A006",
    name: "HR & Payroll System",
    type: "Application",
    criticality: 4,
    vulnerabilitySeverity: 3,
    exposure: 2,
    controlEffectiveness: 0.55,
    downtimeCost: 120000,
    dataLossCost: 500000,
    recoveryCost: 90000
  },
  {
    id: "A007",
    name: "Payment Gateway",
    type: "Application",
    criticality: 5,
    vulnerabilitySeverity: 5,
    exposure: 4,
    controlEffectiveness: 0.4,
    downtimeCost: 700000,
    dataLossCost: 1000000,
    recoveryCost: 220000
  },
  {
    id: "A008",
    name: "Cloud File Storage",
    type: "Cloud Service",
    criticality: 3,
    vulnerabilitySeverity: 3,
    exposure: 4,
    controlEffectiveness: 0.5,
    downtimeCost: 60000,
    dataLossCost: 350000,
    recoveryCost: 50000
  },
  {
    id: "A009",
    name: "Internal Wiki / Intranet",
    type: "Web Application",
    criticality: 2,
    vulnerabilitySeverity: 2,
    exposure: 2,
    controlEffectiveness: 0.6,
    downtimeCost: 20000,
    dataLossCost: 80000,
    recoveryCost: 25000
  },
  {
    id: "A010",
    name: "Backup & Disaster Recovery Server",
    type: "Server",
    criticality: 4,
    vulnerabilitySeverity: 2,
    exposure: 1,
    controlEffectiveness: 0.7,
    downtimeCost: 200000,
    dataLossCost: 600000,
    recoveryCost: 100000
  }
];

/* ---------------------------------------------------------
   2. SAMPLE VULNERABILITY DATA (15 vulnerabilities)
   ---------------------------------------------------------
   These are descriptive/contextual records used mainly by
   the AI Risk Analyst and the Asset table to explain WHY an
   asset is risky. They are linked to assets via assetId.
   severity is on a 1-5 scale (5 = critical).
   --------------------------------------------------------- */
const DEFAULT_VULNERABILITIES = [
  { id: "V001", assetId: "A001", name: "Outdated TLS configuration", severity: 5, category: "Encryption", description: "Banking Server accepts deprecated TLS versions vulnerable to downgrade attacks." },
  { id: "V002", assetId: "A001", name: "Weak admin password policy", severity: 4, category: "Access Control", description: "No enforced complexity or rotation policy for privileged accounts." },
  { id: "V003", assetId: "A002", name: "Unpatched database engine", severity: 5, category: "Patch Management", description: "Customer Database runs a version with known remote code execution CVEs." },
  { id: "V004", assetId: "A002", name: "Excessive user privileges", severity: 3, category: "Access Control", description: "Several service accounts have unnecessary write access to production data." },
  { id: "V005", assetId: "A003", name: "Missing multi-factor authentication", severity: 4, category: "Access Control", description: "Email accounts can be accessed with password only, enabling phishing takeover." },
  { id: "V006", assetId: "A003", name: "Outdated mail server software", severity: 3, category: "Patch Management", description: "Mail transfer agent has not been patched in over 12 months." },
  { id: "V007", assetId: "A004", name: "SQL Injection in checkout flow", severity: 5, category: "Application Security", description: "Unsanitized input allows attackers to query the underlying database directly." },
  { id: "V008", assetId: "A004", name: "Cross-Site Scripting (XSS)", severity: 4, category: "Application Security", description: "Product review form does not sanitize HTML input." },
  { id: "V009", assetId: "A005", name: "No endpoint detection & response", severity: 3, category: "Endpoint Security", description: "Laptops lack EDR agents, delaying detection of malware." },
  { id: "V010", assetId: "A005", name: "Unencrypted local storage", severity: 3, category: "Data Protection", description: "Local disks are not encrypted, risking data loss if devices are stolen." },
  { id: "V011", assetId: "A006", name: "Legacy authentication protocol", severity: 3, category: "Access Control", description: "HR system still supports basic authentication over HTTP internally." },
  { id: "V012", assetId: "A007", name: "Improper session management", severity: 4, category: "Application Security", description: "Payment Gateway sessions do not expire after inactivity." },
  { id: "V013", assetId: "A007", name: "Third-party API without rate limiting", severity: 4, category: "Application Security", description: "Payment API can be abused for card-testing / brute force attacks." },
  { id: "V014", assetId: "A008", name: "Publicly accessible storage bucket", severity: 4, category: "Cloud Configuration", description: "Misconfigured cloud storage permissions expose files to the public internet." },
  { id: "V015", assetId: "A009", name: "Outdated CMS plugins", severity: 2, category: "Patch Management", description: "Intranet wiki runs plugins with known but low-severity issues." }
];

/* ---------------------------------------------------------
   3. SAMPLE SECURITY INVESTMENT DATA (5 investments)
   ---------------------------------------------------------
   Each investment is a candidate control the organization
   could purchase/implement. cost and riskReduction are in
   the same currency units as the financial fields above.
   These numbers are prototype estimates used to feed the
   Investment Optimizer (optimizer.js).
   --------------------------------------------------------- */
const DEFAULT_INVESTMENTS = [
  {
    id: "I001",
    name: "Enable Multi-Factor Authentication (MFA)",
    cost: 300000,
    riskReduction: 600000,
    description: "Protect privileged accounts and email/payment logins from credential-based attacks."
  },
  {
    id: "I002",
    name: "Critical Vulnerability Patch Management Program",
    cost: 400000,
    riskReduction: 750000,
    description: "Establish continuous patching for servers, databases and web applications."
  },
  {
    id: "I003",
    name: "Network Segmentation",
    cost: 350000,
    riskReduction: 500000,
    description: "Isolate critical systems (banking server, payment gateway) from general network traffic."
  },
  {
    id: "I004",
    name: "Endpoint Detection & Response (EDR)",
    cost: 250000,
    riskReduction: 380000,
    description: "Deploy EDR agents across the laptop fleet to detect and contain malware faster."
  },
  {
    id: "I005",
    name: "Employee Security Awareness Training",
    cost: 100000,
    riskReduction: 220000,
    description: "Reduce successful phishing and social engineering attempts through regular training."
  }
];

/* ---------------------------------------------------------
   4. localStorage KEYS
   --------------------------------------------------------- */
const STORAGE_KEYS = {
  ASSETS: "cyberrisk_ai_assets",
  VULNERABILITIES: "cyberrisk_ai_vulnerabilities",
  INVESTMENTS: "cyberrisk_ai_investments"
};

/* ---------------------------------------------------------
   5. CORE DATA FUNCTIONS (globally accessible)
   ---------------------------------------------------------
   These act as the "API layer" of the app since there is no
   real backend. app.js and other modules call these instead
   of touching localStorage directly.
   --------------------------------------------------------- */

/**
 * Loads assets from localStorage. If nothing is saved yet,
 * seeds localStorage with DEFAULT_ASSETS and returns those.
 * @returns {Array<Object>} array of asset objects
 */
function loadAssets() {
  const stored = localStorage.getItem(STORAGE_KEYS.ASSETS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Could not parse stored assets, falling back to defaults.", e);
    }
  }
  // Nothing valid stored yet -> seed with defaults
  saveAssets(DEFAULT_ASSETS);
  return JSON.parse(JSON.stringify(DEFAULT_ASSETS));
}

/**
 * Saves the full assets array to localStorage.
 * @param {Array<Object>} assets
 */
function saveAssets(assets) {
  localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));
}

/**
 * Loads vulnerabilities from localStorage (seeding defaults on first run).
 * @returns {Array<Object>}
 */
function loadVulnerabilities() {
  const stored = localStorage.getItem(STORAGE_KEYS.VULNERABILITIES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Could not parse stored vulnerabilities, falling back to defaults.", e);
    }
  }
  saveVulnerabilities(DEFAULT_VULNERABILITIES);
  return JSON.parse(JSON.stringify(DEFAULT_VULNERABILITIES));
}

/**
 * Saves vulnerabilities array to localStorage.
 * @param {Array<Object>} vulnerabilities
 */
function saveVulnerabilities(vulnerabilities) {
  localStorage.setItem(STORAGE_KEYS.VULNERABILITIES, JSON.stringify(vulnerabilities));
}

/**
 * Loads investments from localStorage (seeding defaults on first run).
 * @returns {Array<Object>}
 */
function loadInvestments() {
  const stored = localStorage.getItem(STORAGE_KEYS.INVESTMENTS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Could not parse stored investments, falling back to defaults.", e);
    }
  }
  saveInvestments(DEFAULT_INVESTMENTS);
  return JSON.parse(JSON.stringify(DEFAULT_INVESTMENTS));
}

/**
 * Saves investments array to localStorage.
 * @param {Array<Object>} investments
 */
function saveInvestments(investments) {
  localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments));
}

/**
 * Adds a new asset to the stored assets array.
 * @param {Object} newAsset - must include at least a "name" field.
 *   Any missing numeric fields default to safe values.
 * @returns {Array<Object>} the updated assets array
 */
function addAsset(newAsset) {
  const assets = loadAssets();

  const asset = {
    id: newAsset.id || generateAssetId(assets),
    name: newAsset.name || "Unnamed Asset",
    type: newAsset.type || "Other",
    criticality: clampScale(newAsset.criticality, 3),
    vulnerabilitySeverity: clampScale(newAsset.vulnerabilitySeverity, 3),
    exposure: clampScale(newAsset.exposure, 3),
    controlEffectiveness: clampProbability(newAsset.controlEffectiveness, 0.5),
    downtimeCost: toNonNegativeNumber(newAsset.downtimeCost, 0),
    dataLossCost: toNonNegativeNumber(newAsset.dataLossCost, 0),
    recoveryCost: toNonNegativeNumber(newAsset.recoveryCost, 0)
  };

  assets.push(asset);
  saveAssets(assets);
  return assets;
}

/**
 * Updates an existing asset (by id) with new field values.
 * @param {string} assetId
 * @param {Object} updatedFields - partial object of fields to overwrite
 * @returns {Array<Object>} the updated assets array
 */
function updateAsset(assetId, updatedFields) {
  const assets = loadAssets();
  const index = assets.findIndex(a => a.id === assetId);
  if (index === -1) {
    console.warn(`updateAsset: no asset found with id ${assetId}`);
    return assets;
  }

  const merged = Object.assign({}, assets[index], updatedFields);

  // Re-validate numeric fields so bad input never breaks calculations
  merged.criticality = clampScale(merged.criticality, assets[index].criticality);
  merged.vulnerabilitySeverity = clampScale(merged.vulnerabilitySeverity, assets[index].vulnerabilitySeverity);
  merged.exposure = clampScale(merged.exposure, assets[index].exposure);
  merged.controlEffectiveness = clampProbability(merged.controlEffectiveness, assets[index].controlEffectiveness);
  merged.downtimeCost = toNonNegativeNumber(merged.downtimeCost, assets[index].downtimeCost);
  merged.dataLossCost = toNonNegativeNumber(merged.dataLossCost, assets[index].dataLossCost);
  merged.recoveryCost = toNonNegativeNumber(merged.recoveryCost, assets[index].recoveryCost);

  assets[index] = merged;
  saveAssets(assets);
  return assets;
}

/**
 * Deletes an asset by id.
 * @param {string} assetId
 * @returns {Array<Object>} the updated assets array
 */
function deleteAsset(assetId) {
  const assets = loadAssets().filter(a => a.id !== assetId);
  saveAssets(assets);
  return assets;
}

/**
 * Resets assets, vulnerabilities and investments back to the
 * original sample data set. Used by the "Reset Sample Data" button.
 */
function resetSampleData() {
  saveAssets(DEFAULT_ASSETS);
  saveVulnerabilities(DEFAULT_VULNERABILITIES);
  saveInvestments(DEFAULT_INVESTMENTS);
}

/* ---------------------------------------------------------
   6. SMALL VALIDATION / UTILITY HELPERS
   --------------------------------------------------------- */

/**
 * Generates the next sequential asset id (e.g. A011, A012...).
 * @param {Array<Object>} existingAssets
 * @returns {string}
 */
function generateAssetId(existingAssets) {
  let max = 0;
  existingAssets.forEach(a => {
    const num = parseInt(String(a.id).replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > max) max = num;
  });
  const next = max + 1;
  return "A" + String(next).padStart(3, "0");
}

/**
 * Clamps a 1-5 style rating field. Falls back to fallbackValue
 * if the input is not a valid number.
 */
function clampScale(value, fallbackValue) {
  const num = Number(value);
  if (isNaN(num)) return fallbackValue;
  return Math.min(5, Math.max(1, num));
}

/**
 * Clamps a 0-1 probability/effectiveness field.
 */
function clampProbability(value, fallbackValue) {
  const num = Number(value);
  if (isNaN(num)) return fallbackValue;
  return Math.min(1, Math.max(0, num));
}

/**
 * Ensures a currency/cost field is a non-negative number.
 */
function toNonNegativeNumber(value, fallbackValue) {
  const num = Number(value);
  if (isNaN(num) || num < 0) return fallbackValue;
  return num;
}

/**
 * Returns the vulnerabilities that belong to a specific asset.
 * Used by the AI Risk Analyst to explain "why" an asset is risky.
 * @param {string} assetId
 * @returns {Array<Object>}
 */
function getVulnerabilitiesForAsset(assetId) {
  return loadVulnerabilities().filter(v => v.assetId === assetId);
}
