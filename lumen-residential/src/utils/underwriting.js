// ─────────────────────────────────────────────
// LUMEN RESIDENTIAL  —  Underwriting Utilities
// Mirrors all formulas from the Google Sheet
// ─────────────────────────────────────────────

const CFG = {
  BUY_BOX_PCT:   0.72,
  MIN_DSCR:      1.20,
  MAX_REFI_LTV:  0.75,
  MIN_CF_MO:     200,
  MAX_GAP:       15000,
  APPRE_PCT:     0.03,   // 3% annual appreciation
  // Stress test
  STRESS_OCC:    0.75,
  STRESS_APPR:   0.90,
};

// PMT function matching Excel/Sheets behavior
function pmt(rate, nper, pv) {
  if (rate === 0) return pv / nper;
  const r = rate;
  return (pv * r * Math.pow(1 + r, nper)) / (Math.pow(1 + r, nper) - 1);
}

// Remaining balance at a given payment number (PV of remaining payments)
function remainingBalance(principal, annualRate, termYears, yearsElapsed) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  const elapsed = Math.min(yearsElapsed * 12, n);
  const remaining = n - elapsed;
  if (remaining <= 0) return 0;
  if (r === 0) return principal * (remaining / n);
  const monthlyPmt = pmt(r, n, principal);
  return monthlyPmt * (1 - Math.pow(1 + r, -remaining)) / r;
}

export function fmt$(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const str = '$' + Math.round(abs).toLocaleString('en-US');
  return n < 0 ? '-' + str : str;
}

export function fmtPct(n, decimals = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(decimals) + '%';
}

export function fmtX(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(2) + '×';
}

// ─────────────────────────────────────────────
// MAIN UNDERWRITE FUNCTION
// Takes raw form inputs, returns full analysis
// ─────────────────────────────────────────────
export function underwrite(f) {
  const r = {};

  // ── Acquisition ──────────────────────────────
  r.carryAmount    = (f.purchasePrice > 0 && f.downPayment >= 0) ? f.purchasePrice - f.downPayment : null;
  r.pctOfARV       = (f.purchasePrice > 0 && f.arv > 0) ? f.purchasePrice / f.arv : null;
  r.maxBuyPrice    = f.arv > 0 ? f.arv * CFG.BUY_BOX_PCT : null;
  r.buyBoxPass     = (f.purchasePrice > 0 && r.maxBuyPrice) ? f.purchasePrice <= r.maxBuyPrice : null;

  // Monthly seller payment (full amortization PMT)
  r.sellerPayment  = (r.carryAmount > 0 && f.sellerRate > 0 && f.carryTerm > 0)
    ? pmt(f.sellerRate / 100 / 12, f.carryTerm * 12, r.carryAmount)
    : null;

  // ── Startup costs ─────────────────────────────
  r.totalCashNeeded = (f.downPayment || 0) +
    (f.rehab || 0) +
    (f.closingCosts || 0) +
    (f.insurance || 120) * (f.holdingMonths || 2);

  // ── Rental income ─────────────────────────────
  r.egi = (f.selectedRent > 0 && f.vacancyRate >= 0)
    ? f.selectedRent * (1 - f.vacancyRate / 100)
    : null;

  // ── Expenses ──────────────────────────────────
  r.pmMonthly   = f.selectedRent > 0 ? f.selectedRent * (f.pmPct || 9) / 100 : null;
  r.maintMonthly = f.selectedRent > 0 ? f.selectedRent * (f.maintPct || 6) / 100 : null;
  r.taxMonthly  = f.propTax > 0 ? f.propTax / 12 : 0;
  r.hoa         = f.hoa || 0;
  r.utilities   = f.utilities || 0;
  r.insurance   = f.insurance || 120;

  r.totalOpEx = (r.pmMonthly || 0) +
    (r.maintMonthly || 0) +
    r.taxMonthly +
    r.insurance +
    r.utilities +
    r.hoa;

  // ── Hold period cash flow ─────────────────────
  r.holdCF = (r.egi !== null && r.sellerPayment !== null)
    ? r.egi - r.totalOpEx - r.sellerPayment
    : null;
  r.holdCFAnnual = r.holdCF !== null ? r.holdCF * 12 : null;
  r.coc = (r.holdCFAnnual !== null && r.totalCashNeeded > 0)
    ? (r.holdCFAnnual / r.totalCashNeeded) * 100
    : null;

  // ── DSCR Refi ─────────────────────────────────
  const balloon = f.balloonYears || f.carryTerm || 5;
  r.projectedARV = f.arv > 0 ? f.arv * Math.pow(1 + CFG.APPRE_PCT, balloon) : null;
  r.maxLoan      = r.projectedARV ? Math.round(r.projectedARV * CFG.MAX_REFI_LTV) : null;

  // P&I only (for cash flow — T+I+HOA already in OpEx)
  r.refiPI = (r.maxLoan && f.refiRate > 0 && f.refiTerm > 0)
    ? pmt(f.refiRate / 100 / 12, f.refiTerm * 12, r.maxLoan)
    : null;

  // Full PITI (lender uses for DSCR qualification)
  r.refiPITI = r.refiPI !== null
    ? r.refiPI + r.taxMonthly + r.insurance + r.hoa
    : null;

  // Seller carry payoff at balloon
  r.sellerPayoff = (r.carryAmount > 0 && f.sellerRate > 0 && f.carryTerm > 0)
    ? remainingBalance(r.carryAmount, f.sellerRate, f.carryTerm, balloon)
    : null;

  r.refiGap = (r.maxLoan !== null && r.sellerPayoff !== null)
    ? r.maxLoan - r.sellerPayoff
    : null;

  // DSCR = annual EGI / annual PITI (lender standard)
  r.dscr = (r.egi !== null && r.refiPITI > 0)
    ? (r.egi * 12) / (r.refiPITI * 12)
    : null;
  r.dscrPass = r.dscr !== null ? r.dscr >= CFG.MIN_DSCR : null;

  // ── Post-refi cash flow ───────────────────────
  r.postRefiCF = (r.egi !== null && r.refiPI !== null)
    ? r.egi - r.totalOpEx - r.refiPI
    : null;
  r.postRefiPass = r.postRefiCF !== null ? r.postRefiCF >= CFG.MIN_CF_MO : null;

  // ── Gap check ─────────────────────────────────
  r.gapPass = r.refiGap !== null ? r.refiGap >= -CFG.MAX_GAP : null;

  // ── Stress test ───────────────────────────────
  const stressRent = f.selectedRent * CFG.STRESS_OCC;
  const stressEGI  = stressRent * (1 - (f.vacancyRate || 4) / 100);
  const stressARV  = f.arv * CFG.STRESS_APPR;
  const stressLoan = Math.round(stressARV * 0.75);
  const stressPI   = (f.refiRate > 0 && f.refiTerm > 0 && stressLoan > 0)
    ? pmt(f.refiRate / 100 / 12, f.refiTerm * 12, stressLoan)
    : null;
  const stressPITI = stressPI ? stressPI + r.taxMonthly + r.insurance + r.hoa : null;

  r.stress = {
    egi:       stressEGI,
    holdCF:    r.sellerPayment ? stressEGI - r.totalOpEx - r.sellerPayment : null,
    dscr:      (stressEGI > 0 && stressPITI > 0) ? (stressEGI * 12) / (stressPITI * 12) : null,
    postRefiCF: stressPI ? stressEGI - r.totalOpEx - stressPI : null,
  };

  const s = r.stress;
  r.stressPass = (
    s.holdCF !== null    && s.holdCF >= 0 &&
    s.dscr !== null      && s.dscr >= 1.0 &&
    s.postRefiCF !== null && s.postRefiCF >= 0
  );

  // ── 5-point Scorecard ─────────────────────────
  r.scorecard = [
    {
      id: 'buybox',
      label: 'Buy Box  (≤ 72% ARV)',
      pass: r.buyBoxPass,
      value: r.pctOfARV !== null ? fmtPct(r.pctOfARV * 100) + ' of ARV' : null,
    },
    {
      id: 'dscr',
      label: 'DSCR  ≥ 1.20×',
      pass: r.dscrPass,
      value: r.dscr !== null ? fmtX(r.dscr) : null,
    },
    {
      id: 'cf',
      label: 'Post-Refi CF  ≥ $200/mo',
      pass: r.postRefiPass,
      value: r.postRefiCF !== null ? fmt$(r.postRefiCF) + '/mo' : null,
    },
    {
      id: 'gap',
      label: 'Refi Gap  ≤ $15K',
      pass: r.gapPass,
      value: r.refiGap !== null
        ? (r.refiGap >= 0 ? fmt$(r.refiGap) + ' surplus' : fmt$(Math.abs(r.refiGap)) + ' gap')
        : null,
    },
    {
      id: 'stress',
      label: 'Stress Test  (75% · flat · −10%)',
      pass: r.stressPass,
      value: r.stressPass !== null ? (r.stressPass ? 'Survives worst case' : 'Fails under stress') : null,
    },
  ];

  const passCount = r.scorecard.filter(s => s.pass === true).length;
  r.passCount = passCount;
  r.verdict = passCount === 5 ? 'proceed'
    : passCount >= 3          ? 'review'
    :                           'stop';

  return r;
}

export { CFG };
