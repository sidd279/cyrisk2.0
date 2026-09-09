# CyberRisk AI — SIH26105

**AI-Powered Continuous Cyber Risk Quantification and Investment Optimization Platform**

A pure front-end prototype: open `index.html` in Chrome and it runs. No backend, no Node.js, no Python, no database, no API key, and no build tools.

---

## Problem Statement

Organizations struggle to answer a simple but critical question:

> "If we have a fixed cybersecurity budget, which security investments will reduce the most estimated financial risk?"

Most tools either stop at qualitative risk labels ("High / Medium / Low") or require expensive, backend-heavy GRC platforms to get financial risk numbers. **CyberRisk AI** demonstrates an explainable, end-to-end workflow — from raw asset data to a plain-English AI explanation and a budget-constrained investment recommendation — using nothing but the browser.

All financial figures produced by this prototype are **synthetic Prototype Estimates**, clearly labeled throughout the UI, meant to demonstrate the *methodology*, not to be used for real financial decisions.

---

## Features

- **Executive Dashboard** — Total Expected Annual Loss (EAL), total financial exposure, high-risk asset count, recommended investment, estimated risk reduction, and ROSI, all calculated live from the underlying data.
- **Asset Risk Table** — 10 sample enterprise assets, fully editable in the browser (add, edit, delete, reset), automatically saved to `localStorage`. Every risk column is recalculated instantly.
- **Investment Optimizer** — Enter any budget and get the best combination of 5 candidate security investments using a 0/1 knapsack algorithm, plus ROSI for each option and the selected bundle.
- **AI Risk Analyst** — A rule-based (no API key, fully offline) chat assistant that answers cyber-risk questions using only numbers already produced by the risk engine — it never invents a financial figure.
- **Scenario Simulator** — Simulate implementing MFA, patching critical vulnerabilities, network segmentation, or delaying remediation by 30 days, and see the before/after Expected Annual Loss.
- **Charts** (Chart.js) — Risk by Asset, Financial Exposure Distribution, Investment vs Risk Reduction, and Before vs After Risk.
- **Data persistence** — All edits are saved with `localStorage`, so your changes survive a page refresh. "Reset Sample Data" restores the original synthetic data set at any time.

---

## Technology Used

- HTML5
- CSS3 (vanilla, no framework)
- Vanilla JavaScript (ES6+, no modules/bundlers)
- [Chart.js](https://www.chartjs.org/) via CDN (`<script>` tag only)
- Browser `localStorage` for persistence

No Node.js, Express, React, Angular, Vue, Python, PHP, MySQL, MongoDB, Firebase, Docker, backend servers, API keys, build tools, npm, or any other package manager are used or required.

---

## Project Structure

```
cyberrisk-ai/
│
├── index.html            # Page structure, all UI sections, modal, script tags
├── style.css              # Dark-blue & white dashboard theme
├── app.js                 # UI wiring / integration (renders data into the DOM)
├── data.js                # Sample assets, vulnerabilities, investments + localStorage CRUD
├── riskEngine.js           # Core risk formulas — the single source of truth
├── optimizer.js            # 0/1 knapsack budget optimizer + ROSI
├── aiAnalyst.js             # Rule-based natural-language risk explanations
├── scenarioSimulator.js     # "What-if" scenario engine (reuses riskEngine.js)
└── README.md
```

---

## How to Run Locally

1. Download or clone this folder.
2. Double-click `index.html` (or right-click → **Open with** → Google Chrome).
3. That's it — no server, no install, no terminal required.

> Tip: some browsers restrict `localStorage` for files opened directly via `file://` in certain security configurations. If you notice your edits aren't saving, try serving the folder with any simple static server (optional, not required) — for example VS Code's "Live Server" extension — or just use Chrome, which handles this correctly for local files in the default configuration.

---

## How to Deploy to GitHub Pages

1. Create a new GitHub repository and push this folder's contents to the `main` branch (the `index.html` file must sit at the repository root, or in the folder you configure below).
2. In your repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch".
4. Choose the `main` branch and the `/ (root)` folder, then click **Save**.
5. GitHub will publish your site at `https://<your-username>.github.io/<repository-name>/` within a minute or two.
6. No environment variables, secrets, or server configuration are needed — it is a fully static site.

---

## Demo Script (matches the required demo scenario)

1. Open the app — sample data loads automatically.
2. Go to **Executive Dashboard** — Total Expected Annual Loss is displayed immediately.
3. The highest financial risk asset is shown in the "Highest Financial Risk Asset" panel and on the Asset Risk Table (Rank #1).
4. Open **AI Risk Analyst** and ask: *"What is our highest financial cyber risk?"*
5. Go to **Investment Optimizer**, enter a budget of `1000000`, click **Optimize Budget**.
6. Review the recommended investment combination, total investment, estimated risk reduction, remaining budget, and ROSI.
7. Go to **Scenario Simulator** and click **Implement Multi-Factor Authentication (MFA)** (or ask the AI: *"What happens if MFA is implemented?"*).
8. Compare the Before vs After Expected Annual Loss chart and percentage reduction.

---

## Team Member Responsibilities

| # | Area | File(s) | Responsibility |
|---|------|---------|-----------------|
| 1 | Risk Engine | `riskEngine.js` | Financial impact, probability, residual risk, Expected Annual Loss, risk scoring and ranking — the single source of truth for all risk numbers. |
| 2 | Data Management | `data.js` | Synthetic asset/vulnerability/investment data, `localStorage` persistence, CRUD operations (add/edit/delete/reset). |
| 3 | AI Risk Analyst | `aiAnalyst.js` | Rule-based natural-language explanations of calculated risk data through a chat interface — no API key required. |
| 4 | Investment Optimization | `optimizer.js` | 0/1 knapsack budget optimizer and ROSI (Return on Security Investment) calculations. |
| 5 | UI/UX & Integration | `index.html`, `style.css`, `app.js` | Dashboard layout, styling, charts, and wiring every module together into one cohesive app. |

*(Scenario simulation in `scenarioSimulator.js` was built collaboratively as a shared extension of the risk engine.)*

---

## Limitations

- All data is **synthetic/fictional**, generated for demonstration purposes — it does not represent a real organization.
- The risk model is intentionally simple and explainable (linear weighted formulas) rather than a statistically calibrated actuarial model.
- The AI Risk Analyst is rule-based (keyword/intent matching), not a large language model — it can only answer the categories of questions it was designed for.
- The 0/1 knapsack optimizer assumes investments are independent (no synergy or conflict between controls) and binary (fully implemented or not at all).
- Data persistence is local to one browser (`localStorage`) — it is not shared across devices or users, and clearing browser data will remove it (use "Reset Sample Data" to restore the defaults at any time).
- No authentication, multi-user support, or audit logging is included, since this is a single-user, offline-capable prototype.

---

## Future Scope

- Replace the rule-based AI analyst with an LLM-powered assistant (with an optional, user-supplied API key) for open-ended questions.
- Support CSV/Excel import of real asset inventories and vulnerability scan results.
- Add Monte Carlo simulation for probabilistic (rather than point-estimate) financial risk ranges.
- Model interaction effects between investments (e.g. diminishing returns when multiple controls overlap).
- Multi-user accounts with a real backend and database for enterprise deployment.
- Exportable PDF/Excel executive reports generated directly from dashboard data.

---

## Acceptance Checklist

- [x] `index.html` opens directly in Chrome
- [x] No installation required
- [x] Sample data loads automatically
- [x] Risk calculations work (Financial Impact, Probability, Residual Probability, EAL, Risk Score)
- [x] EAL is displayed on the dashboard
- [x] Assets can be ranked by risk
- [x] Budget optimization works (0/1 knapsack)
- [x] ROSI is calculated
- [x] AI explanation works (rule-based, no API key)
- [x] Scenario simulation works (MFA, patching, segmentation, delay)
- [x] Charts display correctly (Chart.js via CDN)
- [x] Data can be edited (add/edit/delete assets)
- [x] Data persists using `localStorage`
- [x] GitHub Pages deployment is possible (fully static)
- [x] No major console errors
