# CyberRisk AI — SIH26105 Prototype

AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform.

A working hackathon prototype that converts technical cybersecurity findings
(assets, vulnerabilities, exposure, existing controls) into **estimated
financial risk** (Expected Annual Loss), explains that risk in plain
English via an AI Risk Analyst, and recommends the best combination of
security investments under a fixed budget.

```
Technical Security Data
        ↓
Risk Quantification        (modules/riskEngine.js)
        ↓
Financial Exposure         (Expected Annual Loss per asset)
        ↓
AI Explanation              (modules/aiAnalyst.js)
        ↓
Investment Optimization    (modules/optimizer.js)
        ↓
Executive Dashboard        (public/)
```

All data in this prototype is **synthetic / sample data**, clearly labelled
as such. No real cybersecurity statistics or real company data are used.

---

## 1. Requirements

- Node.js 18+ (uses the built-in `fetch` API for the optional LLM call)
- npm

## 2. Setup & Run

```bash
cd cyberrisk-ai
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

The server reads `PORT` from `.env` (defaults to `3000`).

### Optional: enable real LLM explanations

By default, the AI Risk Analyst uses a **rule-based fallback engine** — no
API key needed, works fully offline, and is what most demos should use.

To use a real LLM (OpenAI) for the AI Analyst instead, add your key to `.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

If the key is missing, invalid, or the API call fails for any reason, the
app automatically falls back to the rule-based engine — the application
never breaks because of the AI layer.

---

## 3. Project Structure

```
cyberrisk-ai/
│
├── server.js                 Express server — wires every module into HTTP APIs
├── package.json
├── .env                       PORT + optional OPENAI_API_KEY
│
├── public/                    Frontend (vanilla HTML/CSS/JS, Chart.js)
│   ├── index.html              5-tab executive dashboard
│   ├── style.css                Dark-blue/white theme
│   └── app.js                    Talks to the backend only via fetch()
│
├── data/                      Synthetic sample data (JSON)
│   ├── assets.json              12 sample assets
│   ├── vulnerabilities.json     16 sample vulnerabilities
│   └── investments.json         6 sample security investments
│
└── modules/                   All business logic (CommonJS, no duplication)
    ├── riskEngine.js            Single source of truth for every risk formula
    ├── aiAnalyst.js              Explains riskEngine's numbers in plain English
    ├── optimizer.js              0/1 knapsack budget optimizer + ROSI
    └── scenarioSimulator.js      Before/after "what-if" simulations
```

**Integration rule:** every formula is defined exactly once, in
`modules/riskEngine.js`. `optimizer.js`, `aiAnalyst.js`, and
`scenarioSimulator.js` all call into it rather than re-implementing any
calculation, and the frontend never hardcodes a number — everything comes
from an API response.

---

## 4. Risk Model (explainable prototype formulas)

**Financial Impact** = Downtime Cost + Data Loss Cost + Recovery Cost

**Probability** (inherent, before controls, clamped to [0,1]):

```
Probability = 0.02 × Vulnerability Severity
            + 0.02 × Exposure Level
            + 0.01 × Asset Criticality
```

**Residual Probability** (after existing controls):

```
Residual Probability = Probability × (1 − Control Effectiveness)
```

**Expected Annual Loss (EAL)**:

```
EAL = Residual Probability × Financial Impact
```

**Risk Score** (unitless ranking score):

```
Risk Score = Severity × Exposure × Criticality
```

**ROSI** (Return on Security Investment):

```
ROSI = (Risk Reduction − Investment Cost) / Investment Cost × 100
```

**Investment Optimizer** — a 0/1 knapsack: select the subset of
investments that maximizes total Risk Reduction subject to
`Total Cost <= Budget`.

**Scenario Simulator** — clones the asset list, nudges realistic inputs
(control effectiveness, vulnerability severity, exposure), and re-runs
`riskEngine.calculateEnterpriseRisk()` on both versions to produce a
before/after comparison. It never uses a second risk formula.

---

## 5. API Reference

| Method | Endpoint               | Description |
|--------|-------------------------|--------------|
| GET    | `/api/assets`            | List all assets |
| POST   | `/api/assets`             | Add a new asset (no riskEngine changes needed) |
| PUT    | `/api/assets/:id`          | Edit an asset |
| DELETE | `/api/assets/:id`           | Remove an asset |
| GET    | `/api/vulnerabilities`     | List all vulnerabilities |
| GET    | `/api/investments`          | List all investments |
| GET    | `/api/risk`                   | Full enterprise risk snapshot + ranked assets |
| POST   | `/api/risk/calculate`          | Calculate risk for one asset (`{ asset }` or `{ assetId }`) |
| POST   | `/api/optimize`                  | `{ budget }` → best investment combination |
| POST   | `/api/scenario`                    | `{ scenario: "mfa"\|"patch"\|"segmentation"\|"delay" }` |
| GET    | `/api/scenario/options`              | List available scenario keys/labels |
| POST   | `/api/ai/analyze`                      | `{ question }` → AI explanation grounded in real numbers |

Example:

```bash
curl -X POST http://localhost:3000/api/optimize \
  -H "Content-Type: application/json" \
  -d '{"budget": 1000000}'
```

```json
{
  "selectedInvestments": [ /* ... */ ],
  "totalCost": 950000,
  "riskReduction": 2100000,
  "remainingBudget": 50000,
  "rosi": 121.05
}
```

---

## 6. Demo Script

1. Open the dashboard — sample enterprise data loads automatically.
2. **Executive Dashboard** tab shows Total EAL, Total Financial Exposure,
   and the number of high-risk assets, calculated live from `/api/risk`.
3. **Asset Risk Table** tab shows every asset ranked by Expected Annual
   Loss — the highest-risk asset (e.g. Payment Gateway API / Banking
   Server) is at the top.
4. **AI Risk Analyst** tab — click "What is our highest financial cyber
   risk?" to see the AI explain the top risk contributor using the exact
   numbers from the risk engine.
5. **Investment Optimizer** tab — enter budget `₹10,00,000` and click
   Optimize. See the recommended investment combination, total
   investment, estimated risk reduction, remaining budget, and ROSI.
6. Back in **AI Risk Analyst**, ask "What happens if MFA is implemented?"
7. **Scenario Simulator** tab — select "Implement Multi-Factor
   Authentication (MFA)" and click Simulate to see the before/after EAL
   chart.

---

## 7. Notes for the Team

- All modules use `require("./modules/xyz")` (CommonJS) and export plain
  functions — no classes, no build step, no bundler needed.
- Data is stored as JSON files under `/data` and read fresh on every
  request, so editing/adding/removing assets through the API (or by hand
  in the JSON files) takes effect immediately without restarting the
  server or touching any calculation code.
- If you add a new investment or asset field, only `data/*.json` needs to
  change — `riskEngine.js` reads fields by name and will pick up new
  assets automatically as long as they follow the same schema.
- No React/Angular/Docker/Kubernetes — plain Express + vanilla JS, runs
  directly with `npm start`.
