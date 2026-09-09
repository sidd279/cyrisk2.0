/* =========================================================
   FILE: optimizer.js
   TEAM MEMBER 4 — INVESTMENT OPTIMIZATION
   =========================================================
   PURPOSE:
   Given a fixed cybersecurity budget, this module figures out
   WHICH combination of security investments gives the biggest
   total risk reduction without going over budget. This directly
   answers the platform's core question:

     "If an organization has a fixed cybersecurity budget,
      which security investments will reduce the most
      estimated financial risk?"

   ALGORITHM:
   This is a classic 0/1 Knapsack problem:
     - "Weight" of each item  = investment cost
     - "Value" of each item   = risk reduction
     - Constraint             = total cost <= budget
     - Objective              = maximize total risk reduction

   Because investment costs are large currency values (e.g.
   300000), we scale them down to smaller "budget units" before
   running the dynamic-programming table, then scale back up.
   This keeps the DP table small and fast while still being an
   exact (not approximate) knapsack solution.

   HOW IT CONNECTS TO OTHER FILES:
     - data.js supplies the investments array (loadInvestments()).
     - app.js calls runOptimization(budget) when the user enters
       a budget and clicks "Optimize", then renders the result
       in the Investment Optimizer section and the
       "Investment vs Risk Reduction" chart.
     - aiAnalyst.js can reference the optimizer's output when
       answering budget-related questions.
   ========================================================= */

/**
 * Runs a 0/1 knapsack optimization to pick the best combination
 * of investments under a given budget.
 *
 * @param {number} budget - total amount available to spend
 * @param {Array<Object>} investments - array of
 *   { id, name, cost, riskReduction, description }
 * @returns {Object} {
 *   selectedInvestments: Array<Object>,  // chosen investments (full objects)
 *   totalInvestment: number,
 *   totalRiskReduction: number,
 *   remainingBudget: number,
 *   rosi: number,                         // ROSI % for the whole bundle
 *   allEvaluated: Array<Object>           // every investment + its own ROSI
 * }
 */
function optimizeBudget(budget, investments) {
  const safeBudget = Math.max(0, Number(budget) || 0);
  const items = (investments || []).filter(inv => Number(inv.cost) > 0);

  // Evaluate every individual investment's own ROSI (useful for display
  // even if it isn't picked by the knapsack, e.g. in an "all options" table).
  const allEvaluated = items.map(inv => ({
    ...inv,
    rosi: calculateROSI(inv.cost, inv.riskReduction)
  }));

  if (items.length === 0 || safeBudget <= 0) {
    return {
      selectedInvestments: [],
      totalInvestment: 0,
      totalRiskReduction: 0,
      remainingBudget: safeBudget,
      rosi: 0,
      allEvaluated: allEvaluated
    };
  }

  // --- Scale costs down to keep the DP table small & fast ---
  // Use a scale step based on the smallest cost so we don't lose
  // meaningful precision, but cap the table size for performance.
  const scaleStep = pickScaleStep(items, safeBudget);
  const scaledBudget = Math.floor(safeBudget / scaleStep);
  const scaledItems = items.map(inv => ({
    ...inv,
    scaledCost: Math.floor(inv.cost / scaleStep)
  }));

  const n = scaledItems.length;

  // dp[i][b] = best total risk reduction using the first i items
  //            with scaled budget b
  const dp = Array.from({ length: n + 1 }, () => new Array(scaledBudget + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const item = scaledItems[i - 1];
    for (let b = 0; b <= scaledBudget; b++) {
      // Option 1: don't take item i
      let best = dp[i - 1][b];
      // Option 2: take item i (if it fits)
      if (item.scaledCost <= b) {
        const candidate = dp[i - 1][b - item.scaledCost] + item.riskReduction;
        if (candidate > best) best = candidate;
      }
      dp[i][b] = best;
    }
  }

  // --- Backtrack to find which items were actually selected ---
  const selected = [];
  let remaining = scaledBudget;
  for (let i = n; i >= 1; i--) {
    if (dp[i][remaining] !== dp[i - 1][remaining]) {
      const item = scaledItems[i - 1];
      selected.push(item);
      remaining -= item.scaledCost;
    }
  }
  selected.reverse();

  const selectedInvestments = selected.map(s => {
    // Strip the temporary scaledCost field before returning to caller
    const { scaledCost, ...original } = s;
    return original;
  });

  const totalInvestment = selectedInvestments.reduce((sum, inv) => sum + inv.cost, 0);
  const totalRiskReduction = selectedInvestments.reduce((sum, inv) => sum + inv.riskReduction, 0);
  const remainingBudget = safeBudget - totalInvestment;
  const rosi = calculateROSI(totalInvestment, totalRiskReduction);

  return {
    selectedInvestments,
    totalInvestment: round2(totalInvestment),
    totalRiskReduction: round2(totalRiskReduction),
    remainingBudget: round2(remainingBudget),
    rosi: round2(rosi),
    allEvaluated: allEvaluated
  };
}

/**
 * Calculates Return on Security Investment (ROSI) as a percentage.
 *
 * ROSI = (Risk Reduction - Investment Cost) / Investment Cost * 100
 *
 * @param {number} investmentCost
 * @param {number} riskReduction
 * @returns {number} ROSI percentage (e.g. 100 means the investment
 *   returns double its cost in avoided risk)
 */
function calculateROSI(investmentCost, riskReduction) {
  const cost = Number(investmentCost);
  const reduction = Number(riskReduction);
  if (!cost || cost <= 0) return 0;
  return round2(((reduction - cost) / cost) * 100);
}

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */

/**
 * Picks a sensible scaling step so the knapsack DP table stays
 * small (a few thousand columns at most) regardless of whether
 * currency values are in the hundreds or in the millions.
 */
function pickScaleStep(items, budget) {
  const minCost = Math.min(budget, ...items.map(i => i.cost));
  // Aim for at most ~2000 columns in the DP table.
  const target = Math.max(1, Math.floor(budget / 2000));
  const step = Math.max(1, Math.min(minCost || 1, target || 1));
  return step;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/* ---------------------------------------------------------
   "API REPLACEMENT" WRAPPER (see Section 11 of the spec)
   ---------------------------------------------------------
   runOptimization() loads investments from data.js and runs
   the optimizer for a given budget, so app.js has one simple
   function to call (like hitting a "/optimize" endpoint would
   in a real backend).
   --------------------------------------------------------- */
function runOptimization(budget) {
  const investments = loadInvestments();
  return optimizeBudget(budget, investments);
}
