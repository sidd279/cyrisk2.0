/**
 * modules/optimizer.js
 * ---------------------------------------------------------------
 * TEAM MEMBER 4 — INVESTMENT OPTIMIZATION
 *
 * Given a fixed budget and a catalog of possible security
 * investments (each with a cost and an estimated risk reduction in
 * currency terms), pick the combination of investments that
 * maximizes total risk reduction without exceeding the budget.
 *
 * This is a classic 0/1 knapsack problem:
 *   - "0/1" because each investment is either fully selected or not
 *     selected at all (you can't buy half of "Enable MFA").
 *   - "knapsack" because we're packing items (investments) into a
 *     bag with limited capacity (the budget) to maximize value
 *     (risk reduction).
 * ---------------------------------------------------------------
 */

/**
 * optimizeBudget(budget, investments)
 * ---------------------------------------------------------------
 * Dynamic-programming 0/1 knapsack.
 *
 * Costs are in rupees and can be large (lakhs/crores), so instead of
 * building a DP table indexed by every rupee (which would be huge),
 * we scale down to a manageable number of "budget units". This keeps
 * the algorithm fast for a hackathon demo while still being a true
 * optimal 0/1 knapsack over the scaled values.
 *
 * Returns:
 * {
 *   selectedInvestments: [...],
 *   totalCost: number,
 *   riskReduction: number,
 *   remainingBudget: number,
 *   rosi: number   // Return on Security Investment, %, for the whole bundle
 * }
 */
function optimizeBudget(budget, investments) {
  const safeBudget = Math.max(0, Math.floor(Number(budget) || 0));
  // Only keep items with a valid positive cost. Items that individually
  // exceed the budget are still included here — the DP naturally excludes
  // them since they'll never fit in any capacity slot.
  const items = (investments || []).filter((inv) => Number(inv.cost) > 0);

  if (safeBudget <= 0 || items.length === 0) {
    return {
      selectedInvestments: [],
      totalCost: 0,
      riskReduction: 0,
      remainingBudget: safeBudget,
      rosi: 0
    };
  }

  // Scale costs down to at most ~2000 units so the DP table stays small
  // and fast, regardless of whether budgets are in thousands or crores.
  const maxUnits = 2000;
  const scale = safeBudget > maxUnits ? safeBudget / maxUnits : 1;
  const scaledBudget = Math.floor(safeBudget / scale);

  const scaledCosts = items.map((inv) => Math.max(0, Math.floor(Number(inv.cost) / scale)));

  const n = items.length;

  // dp[i][w] = max risk reduction achievable using the first i items
  // with capacity w (scaled units)
  const dp = Array.from({ length: n + 1 }, () => new Array(scaledBudget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const cost = scaledCosts[i - 1];
    const value = Number(items[i - 1].riskReduction) || 0;

    for (let w = 0; w <= scaledBudget; w++) {
      // Option 1: don't take item i
      dp[i][w] = dp[i - 1][w];

      // Option 2: take item i, if it fits
      if (cost <= w) {
        const candidate = dp[i - 1][w - cost] + value;
        if (candidate > dp[i][w]) {
          dp[i][w] = candidate;
        }
      }
    }
  }

  // Backtrack to find which items were selected
  const selected = [];
  let w = scaledBudget;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(items[i - 1]);
      w -= scaledCosts[i - 1];
    }
  }
  selected.reverse();

  const totalCost = selected.reduce((sum, inv) => sum + (Number(inv.cost) || 0), 0);
  const riskReduction = selected.reduce((sum, inv) => sum + (Number(inv.riskReduction) || 0), 0);
  const remainingBudget = safeBudget - totalCost;
  const rosi = calculateROSI(totalCost, riskReduction);

  return {
    selectedInvestments: selected,
    totalCost: round2(totalCost),
    riskReduction: round2(riskReduction),
    remainingBudget: round2(remainingBudget),
    rosi: round2(rosi)
  };
}

/**
 * calculateROSI(investmentCost, riskReduction)
 * ---------------------------------------------------------------
 * Return on Security Investment, expressed as a percentage:
 *
 *   ROSI = (Risk Reduction - Investment Cost) / Investment Cost x 100
 *
 * A ROSI of 100% means the investment returns double its cost in
 * avoided risk; 0% means it exactly breaks even.
 */
function calculateROSI(investmentCost, riskReduction) {
  const cost = Number(investmentCost) || 0;
  const reduction = Number(riskReduction) || 0;

  if (cost <= 0) return 0;

  return round2(((reduction - cost) / cost) * 100);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = {
  optimizeBudget,
  calculateROSI
};
