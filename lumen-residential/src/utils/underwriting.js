// ─────────────────────────────────────────────────────────────────────────────
// LUMEN RESIDENTIAL  —  Underwriting Utilities  v2.0
// Supports 3 acquisition modes:
//   seller_finance  — seller carries the note
//   sub2            — subject-to, take over existing mortgage + cure arrears
//   seller_finance_sub2 — cure arrears + seller carries a second note
// ─────────────────────────────────────────────────────────────────────────────

const CFG = {
  BUY_BOX_PCT:   0.72,
  MIN_DSCR:      1.20,
  MAX_REFI_LTV:  0.75,
  MIN_CF_MO:     200,
  MAX_GAP:       15000,
  APPRE_PCT:     0.03,
  STRESS_OCC:    0.75,
  STRESS_APPR:   0.90,
};

// Excel/Sheets PMT
function pmt(rate, nper, pv) {
  if (rate === 0) return pv / nper;
  return (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
}

// Remaining balance at elapsed years
function remainingBalance(principal, annualRate, termYears, yearsElapsed) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  const elapsed = Math.min(yearsElapsed * 12, n);
  const remaining = n - elapsed;
  if (remaining <= 0) return 0;
  if (r === 0) return principal * (remaining / n);
  const mp = pmt(r, n, principal);
  return mp * (1 - Math.pow(1 + r, -remaining)) / r;
}

export function fmt$(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const str = '$' + Math.round(abs).toLocaleString('en-US');
  return n < 0 ? '-' + str : str;
}
export function fmtPct(n, d = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(d) + '%';
}
export function fmtX(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(2) + '×';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN UNDERWRITE — handles all 3 acquisition modes
// ─────────────────────────────────────────────────────────────────────────────
export function underwrite(f) {
  const r   = {};
  const mode = f.acquisitionMode || 'seller_finance';

  // ── Monthly payment & cash-to-close vary by mode ─────────────────────────

  if (mode === 'seller_finance') {
    // Classic: seller carries the full purchase note
    r.carryAmount   = Math.max(0, (f.purchasePrice || 0) - (f.downPayment || 0));
    r.sellerPayment = (r.carryAmount > 0 && f.sellerRate > 0 && f.carryTerm > 0)
      ? pmt(f.sellerRate / 100 / 12, f.carryTerm * 12, r.carryAmount) : null;
    r.holdPayment   = r.sellerPayment;
    r.totalCashNeeded = (f.downPayment || 0) + (f.rehab || 0) + (f.closingCosts || 0)
                      + (f.insurance || 120) * (f.holdingMonths || 2);
    r.existingLoanBalance = null;

  } else if (mode === 'sub2') {
    // Subject-To: cure arrears, take over existing mortgage as-is
    // Monthly payment = existing PITI (entered by user — already includes T+I)
    r.carryAmount     = 0;
    r.sellerPayment   = null;
    r.existingPITI    = f.existingPITI || 0;   // full existing payment entered by user
    r.existingLoanBalance = f.existingLoanBalance || 0;
    r.arrears         = f.arrears || 0;         // back payments owed
    r.cureCosts       = f.cureCosts || 0;       // attorney, late fees, misc
    r.holdPayment     = r.existingPITI;
    r.totalCashNeeded = r.arrears + r.cureCosts + (f.rehab || 0) + (f.closingCosts || 0);
    // For DSCR refi, payoff target = remaining loan balance at balloon
    // Sub2 loan balance calculated from existing loan terms if provided, else use entered balance
    r.sub2PayoffAtBalloon = f.existingLoanBalance || 0;

  } else if (mode === 'seller_finance_sub2') {
    // Hybrid: cure arrears (sub2 first lien), seller carries a 2nd note on equity
    r.arrears         = f.arrears || 0;
    r.cureCosts       = f.cureCosts || 0;
    r.existingPITI    = f.existingPITI || 0;   // existing 1st mortgage payment
    r.existingLoanBalance = f.existingLoanBalance || 0;
    // Seller 2nd note
    r.carryAmount   = f.sellerCarry2nd || 0;
    r.sellerPayment = (r.carryAmount > 0 && f.sellerRate > 0 && f.carryTerm > 0)
      ? pmt(f.sellerRate / 100 / 12, f.carryTerm * 12, r.carryAmount) : null;
    r.holdPayment   = (r.existingPITI || 0) + (r.sellerPayment || 0);
    r.totalCashNeeded = r.arrears + r.cureCosts + (f.rehab || 0) + (f.closingCosts || 0);
    r.sub2PayoffAtBalloon = f.existingLoanBalance || 0;
  }

  // ── ARV / buy box ─────────────────────────────────────────────────────────
  r.pctOfARV    = (f.purchasePrice > 0 && f.arv > 0) ? f.purchasePrice / f.arv : null;
  r.maxBuyPrice = f.arv > 0 ? f.arv * CFG.BUY_BOX_PCT : null;
  r.buyBoxPass  = (f.purchasePrice > 0 && r.maxBuyPrice) ? f.purchasePrice <= r.maxBuyPrice : null;

  // Sub2: purchase price is what you're taking over + arrears paid — still apply buy box
  if (mode === 'sub2' || mode === 'seller_finance_sub2') {
    const effectiveIn = (f.existingLoanBalance || 0) + (r.arrears || 0) + (r.cureCosts || 0);
    r.pctOfARV   = (effectiveIn > 0 && f.arv > 0) ? effectiveIn / f.arv : null;
    r.buyBoxPass = r.pctOfARV !== null ? r.pctOfARV <= CFG.BUY_BOX_PCT : null;
  }

  // ── Rental income ─────────────────────────────────────────────────────────
  r.egi = (f.selectedRent > 0 && f.vacancyRate >= 0)
    ? f.selectedRent * (1 - f.vacancyRate / 100) : null;

  // ── Operating expenses ────────────────────────────────────────────────────
  // For sub2: existing PITI already includes T+I — track separately to avoid double-count
  // User enters propTax + insurance as standalone values (same as seller finance)
  // Sub2 monthly PITI is entered separately and used for DSCR; T+I portions pulled from OpEx
  r.pmMonthly    = f.selectedRent > 0 ? f.selectedRent * (f.pmPct || 9) / 100 : 0;
  r.maintMonthly = f.selectedRent > 0 ? f.selectedRent * (f.maintPct || 6) / 100 : 0;
  r.taxMonthly   = f.propTax > 0 ? f.propTax / 12 : 0;
  r.hoa          = f.hoa || 0;
  r.utilities    = f.utilities || 0;
  r.insurance    = f.insurance || 120;

  // For sub2/hybrid: T+I already embedded in existingPITI — strip from OpEx to avoid double-count
  const tiEmbedded = (mode === 'sub2' || mode === 'seller_finance_sub2');
  r.totalOpEx = r.pmMonthly + r.maintMonthly + r.hoa + r.utilities +
    (tiEmbedded ? 0 : r.taxMonthly + r.insurance);

  // ── Hold period cash flow ─────────────────────────────────────────────────
  r.holdCF = (r.egi !== null && r.holdPayment !== null)
    ? r.egi - r.totalOpEx - r.holdPayment : null;
  r.holdCFAnnual = r.holdCF !== null ? r.holdCF * 12 : null;
  r.coc = (r.holdCFAnnual !== null && r.totalCashNeeded > 0)
    ? (r.holdCFAnnual / r.totalCashNeeded) * 100 : null;

  // ── DSCR Refi ─────────────────────────────────────────────────────────────
  const balloon    = f.balloonYears || f.carryTerm || 5;
  r.projectedARV   = f.arv > 0 ? f.arv * Math.pow(1 + CFG.APPRE_PCT, balloon) : null;
  r.maxLoan        = r.projectedARV ? Math.round(r.projectedARV * CFG.MAX_REFI_LTV) : null;
  r.refiPI         = (r.maxLoan && f.refiRate > 0 && f.refiTerm > 0)
    ? pmt(f.refiRate / 100 / 12, f.refiTerm * 12, r.maxLoan) : null;
  // PITI for lender DSCR calc (post-refi: new loan covers T+I fresh)
  r.refiPITI = r.refiPI !== null
    ? r.refiPI + r.taxMonthly + r.insurance + r.hoa : null;

  // Payoff at balloon — depends on mode
  if (mode === 'seller_finance') {
    r.payoffAtBalloon = (r.carryAmount > 0 && f.sellerRate > 0 && f.carryTerm > 0)
      ? remainingBalance(r.carryAmount, f.sellerRate, f.carryTerm, balloon) : null;
  } else if (mode === 'sub2') {
    r.payoffAtBalloon = r.sub2PayoffAtBalloon || null;
  } else if (mode === 'seller_finance_sub2') {
    const sub2Payoff    = r.sub2PayoffAtBalloon || 0;
    const sellerPayoff2 = (r.carryAmount > 0 && f.sellerRate > 0 && f.carryTerm > 0)
      ? remainingBalance(r.carryAmount, f.sellerRate, f.carryTerm, balloon) : 0;
    r.payoffAtBalloon = sub2Payoff + sellerPayoff2;
  }

  r.refiGap = (r.maxLoan !== null && r.payoffAtBalloon !== null)
    ? r.maxLoan - r.payoffAtBalloon : null;
  r.dscr = (r.egi !== null && r.refiPITI > 0)
    ? (r.egi * 12) / (r.refiPITI * 12) : null;
  r.dscrPass     = r.dscr !== null ? r.dscr >= CFG.MIN_DSCR : null;
  r.postRefiCF   = (r.egi !== null && r.refiPI !== null)
    ? r.egi - r.totalOpEx - r.refiPI - (tiEmbedded ? 0 : 0) : null;
  // Post-refi: new loan covers T+I, so add them back to OpEx if they were stripped
  if (tiEmbedded && r.refiPI !== null && r.egi !== null) {
    r.postRefiCF = r.egi - (r.totalOpEx + r.taxMonthly + r.insurance) - r.refiPI;
  }
  r.postRefiPass = r.postRefiCF !== null ? r.postRefiCF >= CFG.MIN_CF_MO : null;
  r.gapPass      = r.refiGap !== null ? r.refiGap >= -CFG.MAX_GAP : null;

  // ── Stress test ───────────────────────────────────────────────────────────
  const stressRent = (f.selectedRent || 0) * CFG.STRESS_OCC;
  const stressEGI  = stressRent * (1 - (f.vacancyRate || 4) / 100);
  const stressARV  = (f.arv || 0) * CFG.STRESS_APPR;
  const stressLoan = Math.round(stressARV * 0.75);
  const stressPI   = (f.refiRate > 0 && f.refiTerm > 0 && stressLoan > 0)
    ? pmt(f.refiRate / 100 / 12, f.refiTerm * 12, stressLoan) : null;
  const stressPITI = stressPI ? stressPI + r.taxMonthly + r.insurance + r.hoa : null;
  const sHoldPmt   = r.holdPayment || 0;

  r.stress = {
    egi:        stressEGI,
    holdCF:     stressEGI - r.totalOpEx - sHoldPmt,
    dscr:       (stressEGI > 0 && stressPITI > 0) ? (stressEGI * 12) / (stressPITI * 12) : null,
    postRefiCF: stressPI ? stressEGI - (tiEmbedded ? r.totalOpEx + r.taxMonthly + r.insurance : r.totalOpEx) - stressPI : null,
  };
  const s = r.stress;
  r.stressPass = s.holdCF >= 0 && s.dscr >= 1.0 && s.postRefiCF >= 0;

  // ── 5-point Scorecard ─────────────────────────────────────────────────────
  r.scorecard = [
    { id:'buybox', label:'Buy Box  (≤ 72% ARV)',        pass: r.buyBoxPass,     value: r.pctOfARV ? fmtPct(r.pctOfARV * 100) + ' of ARV' : null },
    { id:'dscr',   label:'DSCR  ≥ 1.20×',               pass: r.dscrPass,       value: r.dscr ? fmtX(r.dscr) : null },
    { id:'cf',     label:'Post-Refi CF  ≥ $200/mo',     pass: r.postRefiPass,   value: r.postRefiCF !== null ? fmt$(r.postRefiCF) + '/mo' : null },
    { id:'gap',    label:'Refi Gap  ≤ $15K',             pass: r.gapPass,        value: r.refiGap !== null ? (r.refiGap >= 0 ? fmt$(r.refiGap) + ' surplus' : fmt$(Math.abs(r.refiGap)) + ' gap') : null },
    { id:'stress', label:'Stress Test  (75%·flat·−10%)', pass: r.stressPass,     value: r.stressPass !== null ? (r.stressPass ? 'Survives' : 'Fails') : null },
  ];

  const passCount  = r.scorecard.filter(s => s.pass === true).length;
  r.passCount      = passCount;
  r.verdict        = passCount === 5 ? 'proceed' : passCount >= 3 ? 'review' : 'stop';
  r.acquisitionMode = mode;

  return r;
}

export { CFG };
