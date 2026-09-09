/**
 * server.js
 * ---------------------------------------------------------------
 * SIH26105 — CyberRisk AI
 * Main Express server. This is the ONLY place that wires all five
 * modules together and exposes them to the frontend as HTTP APIs.
 *
 * server.js does not contain any risk math itself — it only reads
 * JSON data, hands it to the modules, and returns their results.
 * That keeps every formula defined exactly once, in
 * modules/riskEngine.js (and modules that build on top of it).
 * ---------------------------------------------------------------
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const riskEngine = require("./modules/riskEngine");
const aiAnalyst = require("./modules/aiAnalyst");
const optimizer = require("./modules/optimizer");
const scenarioSimulator = require("./modules/scenarioSimulator");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------------------------------------------ *
 * DATA ACCESS HELPERS
 * ------------------------------------------------------------
 * All sample data lives in /data as JSON files. Reading fresh on
 * every request keeps this prototype simple (no separate DB/cache
 * to keep in sync) and means the frontend can add/edit/delete
 * records through the API below WITHOUT touching riskEngine.js —
 * the risk engine only ever receives an array of asset objects, it
 * doesn't care where they came from.
 * ------------------------------------------------------------ */

const DATA_DIR = path.join(__dirname, "data");
const ASSETS_FILE = path.join(DATA_DIR, "assets.json");
const VULNS_FILE = path.join(DATA_DIR, "vulnerabilities.json");
const INVESTMENTS_FILE = path.join(DATA_DIR, "investments.json");

function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getAssets() {
  return readJSON(ASSETS_FILE);
}
function getVulnerabilities() {
  return readJSON(VULNS_FILE);
}
function getInvestments() {
  return readJSON(INVESTMENTS_FILE);
}

/* ------------------------------------------------------------ *
 * TEAM MEMBER 2 — DATA & CORE READ ENDPOINTS
 * ------------------------------------------------------------ */

// GET /api/assets — full asset list (frontend: Asset Risk Table)
app.get("/api/assets", (req, res) => {
  try {
    res.json(getAssets());
  } catch (err) {
    res.status(500).json({ error: "Failed to load assets", details: err.message });
  }
});

// POST /api/assets — add a new asset (lets the frontend "upload"/extend
// sample data without ever touching riskEngine.js)
app.post("/api/assets", (req, res) => {
  try {
    const assets = getAssets();
    const newAsset = req.body;

    if (!newAsset || !newAsset.id || !newAsset.name) {
      return res.status(400).json({ error: "Asset must include at least 'id' and 'name'." });
    }
    if (assets.some((a) => a.id === newAsset.id)) {
      return res.status(409).json({ error: `Asset with id ${newAsset.id} already exists.` });
    }

    assets.push(newAsset);
    writeJSON(ASSETS_FILE, assets);
    res.status(201).json(newAsset);
  } catch (err) {
    res.status(500).json({ error: "Failed to add asset", details: err.message });
  }
});

// PUT /api/assets/:id — edit an existing asset's fields
app.put("/api/assets/:id", (req, res) => {
  try {
    const assets = getAssets();
    const index = assets.findIndex((a) => a.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: `Asset ${req.params.id} not found.` });
    }

    assets[index] = { ...assets[index], ...req.body, id: assets[index].id };
    writeJSON(ASSETS_FILE, assets);
    res.json(assets[index]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update asset", details: err.message });
  }
});

// DELETE /api/assets/:id
app.delete("/api/assets/:id", (req, res) => {
  try {
    const assets = getAssets();
    const filtered = assets.filter((a) => a.id !== req.params.id);

    if (filtered.length === assets.length) {
      return res.status(404).json({ error: `Asset ${req.params.id} not found.` });
    }

    writeJSON(ASSETS_FILE, filtered);
    res.json({ deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete asset", details: err.message });
  }
});

// GET /api/vulnerabilities
app.get("/api/vulnerabilities", (req, res) => {
  try {
    res.json(getVulnerabilities());
  } catch (err) {
    res.status(500).json({ error: "Failed to load vulnerabilities", details: err.message });
  }
});

// GET /api/investments
app.get("/api/investments", (req, res) => {
  try {
    res.json(getInvestments());
  } catch (err) {
    res.status(500).json({ error: "Failed to load investments", details: err.message });
  }
});

/* ------------------------------------------------------------ *
 * TEAM MEMBER 1 — RISK ENGINE ENDPOINTS
 * ------------------------------------------------------------ */

// GET /api/risk — full enterprise risk snapshot using current sample data
// (this is what the Executive Dashboard loads on page load)
app.get("/api/risk", (req, res) => {
  try {
    const assets = getAssets();
    const enterpriseRisk = riskEngine.calculateEnterpriseRisk(assets);
    const ranked = riskEngine.rankAssetsByRisk(assets);

    res.json({
      ...enterpriseRisk,
      rankedAssets: ranked
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate risk", details: err.message });
  }
});

// POST /api/risk/calculate — recalculate risk for a specific asset (or a
// custom asset payload sent from the frontend, e.g. from an "edit asset"
// form, before it's saved)
app.post("/api/risk/calculate", (req, res) => {
  try {
    const { asset, assetId } = req.body || {};

    let target = asset;
    if (!target && assetId) {
      target = getAssets().find((a) => a.id === assetId);
    }

    if (!target) {
      return res
        .status(400)
        .json({ error: "Provide either an 'asset' object or a known 'assetId' in the request body." });
    }

    res.json(riskEngine.calculateRisk(target));
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate risk", details: err.message });
  }
});

/* ------------------------------------------------------------ *
 * TEAM MEMBER 4 — INVESTMENT OPTIMIZATION ENDPOINT
 * ------------------------------------------------------------ */

// POST /api/optimize  { budget: 1000000 }
app.post("/api/optimize", (req, res) => {
  try {
    const { budget } = req.body || {};

    if (budget === undefined || budget === null || isNaN(Number(budget))) {
      return res.status(400).json({ error: "Request body must include a numeric 'budget'." });
    }

    const investments = getInvestments();
    const result = optimizer.optimizeBudget(Number(budget), investments);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to optimize budget", details: err.message });
  }
});

/* ------------------------------------------------------------ *
 * SCENARIO SIMULATOR ENDPOINT
 * ------------------------------------------------------------ */

// POST /api/scenario  { scenario: "mfa" | "patch" | "segmentation" | "delay" }
app.post("/api/scenario", (req, res) => {
  try {
    const { scenario } = req.body || {};

    if (!scenario) {
      return res.status(400).json({ error: "Request body must include a 'scenario' key." });
    }

    const assets = getAssets();
    const result = scenarioSimulator.simulateScenario(assets, scenario);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/scenario/options — lets the frontend populate the dropdown
// without hardcoding scenario names in app.js
app.get("/api/scenario/options", (req, res) => {
  res.json(scenarioSimulator.listScenarios());
});

/* ------------------------------------------------------------ *
 * TEAM MEMBER 3 — AI RISK ANALYST ENDPOINT
 * ------------------------------------------------------------ */

// POST /api/ai/analyze  { question: "..." }
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { question } = req.body || {};
    const assets = getAssets();
    const vulnerabilities = getVulnerabilities();
    const enterpriseRisk = riskEngine.calculateEnterpriseRisk(assets);

    const result = await aiAnalyst.generateRiskExplanation(
      { assets, vulnerabilities, enterpriseRisk },
      question || ""
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate AI explanation", details: err.message });
  }
});

/* ------------------------------------------------------------ *
 * FALLBACK: serve the SPA for any unmatched non-API route
 * ------------------------------------------------------------ */
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("=========================================================");
  console.log(" SIH26105 - CyberRisk AI");
  console.log(` Server running at: http://localhost:${PORT}`);
  console.log(
    process.env.OPENAI_API_KEY
      ? " AI Analyst mode: LLM (OPENAI_API_KEY detected)"
      : " AI Analyst mode: Rule-based fallback (no OPENAI_API_KEY set)"
  );
  console.log("=========================================================");
});
