import React, { useState, useCallback, useEffect } from 'react';
import { underwrite, fmt$, fmtPct, fmtX } from '../utils/underwriting.js';

const MODE_LABELS = {
  seller_finance:      { icon: '📝', label: 'Seller Finance',     short: 'SF'   },
  sub2:                { icon: '🔑', label: 'Subject-To (Sub2)',   short: 'Sub2' },
  seller_finance_sub2: { icon: '🔗', label: 'SF + Sub2 Hybrid',   short: 'SF+S2'},
};

const DEFAULTS = {
  acquisitionMode: 'seller_finance',
  address: '', zip: '', beds: '3', yearBuilt: '',
  sqft: '', propType: 'SFR', status: 'Vacant',
  purchasePrice: '', arv: '', arvSource: '',
  // Seller finance
  downPayment: '0', sellerRate: '5', carryTerm: '30', balloonYears: '5',
  // Sub2 fields
  existingLoanBalance: '', existingPITI: '', arrears: '', cureCosts: '',
  sellerCarry2nd: '',
  // Shared
  rehab: '', closingCosts: '', holdingMonths: '2', hoa: '0',
  strategy: 'Section 8', hudFmr: '', mktRent: '',
  selectedRent: '', vacancyRate: '4',
  pmPct: '9', maintPct: '6',
  propTax: '', insurance: '120', utilities: '0',
  refiRate: '7.5', refiTerm: '30',
};

export default function QuickEntryForm({ onSave, toast, initialValues }) {
  const [form, setForm]     = useState(() => initialValues ? { ...DEFAULTS, ...initialValues } : DEFAULTS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState({});
  const [tab, setTab]       = useState('property');

  const mode = form.acquisitionMode;

  useEffect(() => {
    const f = parseForm(form);
    if (f.purchasePrice > 0 || f.arv > 0 || f.selectedRent > 0 ||
        f.existingLoanBalance > 0 || f.existingPITI > 0) {
      setResult(underwrite(f));
    } else {
      setResult(null);
    }
  }, [form]);

  function parseForm(f) {
    return {
      acquisitionMode:     f.acquisitionMode,
      purchasePrice:       parseFloat(f.purchasePrice)       || 0,
      arv:                 parseFloat(f.arv)                 || 0,
      downPayment:         parseFloat(f.downPayment)         || 0,
      sellerRate:          parseFloat(f.sellerRate)          || 0,
      carryTerm:           parseFloat(f.carryTerm)           || 0,
      balloonYears:        parseFloat(f.balloonYears)        || 5,
      existingLoanBalance: parseFloat(f.existingLoanBalance) || 0,
      existingPITI:        parseFloat(f.existingPITI)        || 0,
      arrears:             parseFloat(f.arrears)             || 0,
      cureCosts:           parseFloat(f.cureCosts)           || 0,
      sellerCarry2nd:      parseFloat(f.sellerCarry2nd)      || 0,
      rehab:               parseFloat(f.rehab)               || 0,
      closingCosts:        parseFloat(f.closingCosts)        || 0,
      holdingMonths:       parseFloat(f.holdingMonths)       || 2,
      hoa:                 parseFloat(f.hoa)                 || 0,
      selectedRent:        parseFloat(f.selectedRent)        || 0,
      vacancyRate:         parseFloat(f.vacancyRate)         || 4,
      pmPct:               parseFloat(f.pmPct)               || 9,
      maintPct:            parseFloat(f.maintPct)            || 6,
      propTax:             parseFloat(f.propTax)             || 0,
      insurance:           parseFloat(f.insurance)           || 120,
      utilities:           parseFloat(f.utilities)           || 0,
      refiRate:            parseFloat(f.refiRate)            || 7.5,
      refiTerm:            parseFloat(f.refiTerm)            || 30,
    };
  }

  const set = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const inp = (k, extra = {}) => ({ value: form[k], onChange: e => set(k, e.target.value), ...extra });

  // When zip changes, auto-update insurance + propTax defaults
  function handleZipChange(zip) {
    set('zip', zip);
    if (zip.length === 5) {
      const z = zip;
      if (['75','76','77','78','79'].some(p => z.startsWith(p))) {
        if (!form.propTax)    set('propTax', '');      // user enters — remind them TX is high
        if (!form.insurance)  set('insurance', '145');
      }
    }
  }

  async function fetchHUD() {
    const zip  = form.zip.trim();
    const beds = form.beds;
    if (!zip || zip.length < 5) { toast('Enter a 5-digit zip first', 'error'); return; }
    if (!beds) { toast('Enter bedrooms first', 'error'); return; }
    setLoading(p => ({ ...p, hud: true }));
    try {
      const res  = await fetch(`/.netlify/functions/hud-fmr?zip=${zip}&beds=${beds}`);
      const data = await res.json();
      if (data.fmr) {
        set('hudFmr', String(data.fmr));
        if (!form.selectedRent) set('selectedRent', String(data.fmr));
        // Auto-apply state defaults for insurance
        if (data.stateDefaults) {
          if (!form.insurance || form.insurance === '120')
            set('insurance', String(data.stateDefaults.insuranceMonthly));
        }
        toast(`HUD FMR ${fmt$(data.fmr)}/mo — ${data.market} (${data.source})`, 'success');
      } else { toast(data.error || 'No FMR data', 'error'); }
    } catch { toast('HUD fetch failed', 'error'); }
    setLoading(p => ({ ...p, hud: false }));
  }

  async function fetchRentcast() {
    if (!form.address) { toast('Enter address first', 'error'); return; }
    setLoading(p => ({ ...p, rc: true }));
    try {
      const res  = await fetch(`/.netlify/functions/rentcast?address=${encodeURIComponent(form.address)}&beds=${form.beds}`);
      const data = await res.json();
      if (data.rent) set('mktRent', String(data.rent));
      if (data.arv)  { set('arv', String(data.arv)); set('arvSource', 'Rentcast AVM'); }
      if (data.rent || data.arv) toast('Rentcast → filled', 'success');
      else toast(data.error || 'No Rentcast data', 'error');
    } catch { toast('Rentcast fetch failed', 'error'); }
    setLoading(p => ({ ...p, rc: false }));
  }

  function handleSave() {
    if (!form.address) { toast('Enter address first', 'error'); return; }
    const parsed = parseForm(form);
    onSave({ form, parsed, result: result || underwrite(parsed), savedAt: new Date().toISOString() });
    toast('Deal saved to pipeline ✓', 'success');
  }

  const sections = [
    { id: 'property',    icon: '🏠', label: 'Property'   },
    { id: 'acquisition', icon: '💰', label: 'Acquisition'},
    { id: 'rental',      icon: '📋', label: 'Rental'     },
    { id: 'expenses',    icon: '📊', label: 'Expenses'   },
  ];

  return (
    <div className="page">
      {/* ── Mode selector ────────────────────── */}
      <div className="section-card" style={{marginBottom:10}}>
        <div className="section-header">
          <span className="section-icon">⚡</span>
          <span className="section-title">Acquisition Strategy</span>
        </div>
        <div style={{padding:'10px 14px', display:'flex', flexDirection:'column', gap:6}}>
          {Object.entries(MODE_LABELS).map(([key, { icon, label }]) => (
            <button
              key={key}
              onClick={() => set('acquisitionMode', key)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px',
                background: mode === key ? 'var(--navy-600)' : 'var(--navy-900)',
                border: `1px solid ${mode === key ? 'var(--gold)' : 'var(--navy-500)'}`,
                borderRadius:6, cursor:'pointer', textAlign:'left',
              }}
            >
              <span style={{fontSize:18}}>{icon}</span>
              <div>
                <div style={{fontSize:13, fontWeight:600, color: mode === key ? 'var(--gold)' : 'var(--white)', fontFamily:'var(--font-ui)'}}>
                  {label}
                </div>
                <div style={{fontSize:10, color:'var(--gray-300)', fontFamily:'var(--font-mono)'}}>
                  {key === 'seller_finance'      && 'Negotiate w/ motivated seller — they carry the note'}
                  {key === 'sub2'                && 'Cure arrears + take title subject-to existing mortgage'}
                  {key === 'seller_finance_sub2' && 'Cure arrears + seller carries equity as 2nd note'}
                </div>
              </div>
              {mode === key && <span style={{marginLeft:'auto', color:'var(--gold)'}}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sub-section tabs ─────────────────── */}
      <div style={{display:'flex', gap:4, marginBottom:10}}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setTab(s.id)} style={{
            flex:1, padding:'8px 4px',
            background: tab === s.id ? 'var(--navy-600)' : 'var(--navy-800)',
            border: `1px solid ${tab === s.id ? 'var(--gold)' : 'var(--navy-600)'}`,
            borderRadius:6, cursor:'pointer',
            color: tab === s.id ? 'var(--gold)' : 'var(--gray-300)',
            fontSize:9, fontWeight:600, fontFamily:'var(--font-ui)',
            letterSpacing:'0.04em', textAlign:'center',
            display:'flex', flexDirection:'column', alignItems:'center', gap:3
          }}>
            <span style={{fontSize:14}}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── PROPERTY ─────────────────────────── */}
      {tab === 'property' && (
        <>
          <div className="section-card">
            <div className="section-header"><span className="section-icon">🏠</span><span className="section-title">Property Info</span></div>
            <div className="section-body">
              <div className="field-row full">
                <div className="field">
                  <label>Address</label>
                  <input {...inp('address')} placeholder="123 Main St, Houston TX" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Zip Code</label>
                  <input
                    value={form.zip}
                    onChange={e => handleZipChange(e.target.value)}
                    placeholder="e.g. 77026"
                    inputMode="numeric"
                    maxLength={5}
                  />
                  <span className="field-hint">Any US zip — auto-detects state defaults</span>
                </div>
                <div className="field">
                  <label>Bedrooms</label>
                  <select {...inp('beds')}>
                    {[2,3,4,5].map(n => <option key={n} value={n}>{n} BR</option>)}
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Year Built</label>
                  <input {...inp('yearBuilt')} placeholder="1998" inputMode="numeric" />
                </div>
                <div className="field">
                  <label>Sq Footage</label>
                  <input {...inp('sqft')} placeholder="1400" inputMode="numeric" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Property Type</label>
                  <select {...inp('propType')}><option>SFR</option><option>Duplex</option><option>Triplex</option></select>
                </div>
                <div className="field">
                  <label>Current Status</label>
                  <select {...inp('status')}><option>Vacant</option><option>Occupied</option><option>Owner-Occupied</option></select>
                </div>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setTab('acquisition')}>Next → Acquisition Terms</button>
        </>
      )}

      {/* ── ACQUISITION ──────────────────────── */}
      {tab === 'acquisition' && (
        <>
          <div className="section-card">
            <div className="section-header">
              <span className="section-icon">{MODE_LABELS[mode].icon}</span>
              <span className="section-title">{MODE_LABELS[mode].label} — Terms</span>
            </div>
            <div className="section-body">

              {/* ARV always needed */}
              <div className="field-row">
                <div className="field">
                  <label>ARV Estimate ($)</label>
                  <input {...inp('arv')} placeholder="165000" inputMode="numeric" />
                  <span className="field-hint">{form.arvSource || 'Tap Rentcast below'}</span>
                </div>
                <div className="field">
                  <label>Est. Rehab ($)</label>
                  <input {...inp('rehab')} placeholder="0" inputMode="numeric" />
                </div>
              </div>
              <button className="btn btn-api" onClick={fetchRentcast} disabled={loading.rc}>
                {loading.rc ? <><span className="spinner"/>Fetching…</> : '⚡ Fetch Rentcast AVM + Market Rent'}
              </button>

              <div className="divider"/>

              {/* ── Seller Finance fields ── */}
              {(mode === 'seller_finance') && (
                <>
                  <div className="field-row">
                    <div className="field">
                      <label>Purchase Price ($)</label>
                      <input {...inp('purchasePrice')} placeholder="120000" inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Down Payment ($)</label>
                      <input {...inp('downPayment')} placeholder="0" inputMode="numeric" />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Seller Rate (%)</label>
                      <input {...inp('sellerRate')} placeholder="5.0" inputMode="decimal" />
                    </div>
                    <div className="field">
                      <label>Carry Term (yrs)</label>
                      <input {...inp('carryTerm')} placeholder="30" inputMode="numeric" />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Balloon In (yrs)</label>
                      <input {...inp('balloonYears')} placeholder="5" inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Closing Costs ($)</label>
                      <input {...inp('closingCosts')} placeholder="3000" inputMode="numeric" />
                    </div>
                  </div>
                </>
              )}

              {/* ── Sub2 fields ── */}
              {(mode === 'sub2') && (
                <>
                  <InfoBanner icon="🔑" text="Cure arrears → take title subject-to existing mortgage. Existing lender stays on loan. You get the deed and cash flow on their rate." />
                  <div className="field-row">
                    <div className="field">
                      <label>Existing Loan Balance ($)</label>
                      <input {...inp('existingLoanBalance')} placeholder="98000" inputMode="numeric" />
                      <span className="field-hint">What seller owes today</span>
                    </div>
                    <div className="field">
                      <label>Existing PITI / mo ($)</label>
                      <input {...inp('existingPITI')} placeholder="850" inputMode="numeric" />
                      <span className="field-hint">Their full payment you take over</span>
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Arrears to Cure ($)</label>
                      <input {...inp('arrears')} placeholder="5400" inputMode="numeric" />
                      <span className="field-hint">Back payments owed</span>
                    </div>
                    <div className="field">
                      <label>Cure Costs ($)</label>
                      <input {...inp('cureCosts')} placeholder="1500" inputMode="numeric" />
                      <span className="field-hint">Attorney, late fees, filing</span>
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Balloon / Refi In (yrs)</label>
                      <input {...inp('balloonYears')} placeholder="5" inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Closing Costs ($)</label>
                      <input {...inp('closingCosts')} placeholder="1500" inputMode="numeric" />
                    </div>
                  </div>
                </>
              )}

              {/* ── SF + Sub2 Hybrid ── */}
              {(mode === 'seller_finance_sub2') && (
                <>
                  <InfoBanner icon="🔗" text="Cure arrears on existing mortgage (1st lien stays). Seller carries remaining equity as a 2nd note. Two payments during hold period." />
                  <div className="field-row">
                    <div className="field">
                      <label>Existing Loan Balance ($)</label>
                      <input {...inp('existingLoanBalance')} placeholder="80000" inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Existing PITI / mo ($)</label>
                      <input {...inp('existingPITI')} placeholder="720" inputMode="numeric" />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Arrears ($)</label>
                      <input {...inp('arrears')} placeholder="4300" inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Cure Costs ($)</label>
                      <input {...inp('cureCosts')} placeholder="1200" inputMode="numeric" />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Seller 2nd Note ($)</label>
                      <input {...inp('sellerCarry2nd')} placeholder="30000" inputMode="numeric" />
                      <span className="field-hint">Equity seller carries</span>
                    </div>
                    <div className="field">
                      <label>2nd Note Rate (%)</label>
                      <input {...inp('sellerRate')} placeholder="5.0" inputMode="decimal" />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>2nd Note Term (yrs)</label>
                      <input {...inp('carryTerm')} placeholder="10" inputMode="numeric" />
                    </div>
                    <div className="field">
                      <label>Balloon In (yrs)</label>
                      <input {...inp('balloonYears')} placeholder="5" inputMode="numeric" />
                    </div>
                  </div>
                </>
              )}

              {/* Live buy box */}
              {result && result.buyBoxPass !== null && (
                <div className={`score-item ${result.buyBoxPass ? 'pass' : 'fail'}`} style={{marginTop:4}}>
                  <span className="score-badge">{result.buyBoxPass ? '✅' : '❌'}</span>
                  <span className="score-label">Buy Box</span>
                  <span className="score-val">{result.pctOfARV ? fmtPct(result.pctOfARV * 100) + ' of ARV' : ''}</span>
                </div>
              )}
              {result && (
                <div style={{fontSize:11, color:'var(--gray-300)', textAlign:'center', fontFamily:'var(--font-mono)'}}>
                  Cash to close: <strong style={{color:'var(--gold)'}}>{fmt$(result.totalCashNeeded)}</strong>
                  {'  '}·{'  '}
                  Hold pmt: <strong style={{color:'var(--white)'}}>{result.holdPayment ? fmt$(result.holdPayment) + '/mo' : '—'}</strong>
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setTab('rental')}>Next → Rental Income</button>
        </>
      )}

      {/* ── RENTAL ───────────────────────────── */}
      {tab === 'rental' && (
        <>
          <div className="section-card">
            <div className="section-header"><span className="section-icon">📋</span><span className="section-title">Rental Income</span></div>
            <div className="section-body">
              <div className="field-row">
                <div className="field">
                  <label>Strategy</label>
                  <select {...inp('strategy')}><option>Section 8</option><option>Market Rate</option><option>Both / Flex</option></select>
                </div>
                <div className="field">
                  <label>Vacancy Rate (%)</label>
                  <input {...inp('vacancyRate')} placeholder="4" inputMode="decimal" />
                  <span className="field-hint">S8=4%  MR=8%</span>
                </div>
              </div>
              <button className="btn btn-api" onClick={fetchHUD} disabled={loading.hud}>
                {loading.hud ? <><span className="spinner"/>Fetching…</> : '🏛️ Fetch HUD FMR  (any US zip)'}
              </button>
              <div className="field-row">
                <div className="field">
                  <label>HUD FMR ($)</label>
                  <input {...inp('hudFmr')} placeholder="auto-filled" inputMode="numeric" style={{background:'var(--navy-700)', borderColor:'var(--blue-400)'}}/>
                </div>
                <div className="field">
                  <label>Market Rent ($)</label>
                  <input {...inp('mktRent')} placeholder="auto-filled" inputMode="numeric" style={{background:'var(--navy-700)', borderColor:'var(--blue-400)'}}/>
                </div>
              </div>
              <div className="field-row full">
                <div className="field">
                  <label>YOUR SELECTED RENT ($)</label>
                  <input {...inp('selectedRent')} placeholder="Enter target rent" inputMode="numeric"
                    style={{background:'var(--navy-600)', borderColor:'var(--gold)', fontSize:16, fontWeight:600, color:'var(--gold)'}}/>
                  <span className="field-hint">This drives all calculations</span>
                </div>
              </div>
              {result && result.egi !== null && (
                <div style={{fontSize:12, color:'var(--gray-300)', fontFamily:'var(--font-mono)', textAlign:'center', padding:'6px 0'}}>
                  EGI: <span style={{color:'var(--white)', fontWeight:600}}>{fmt$(result.egi)}/mo</span>
                  {'  '}·{'  '}
                  Hold CF: <span style={{color: result.holdCF >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600}}>{fmt$(result.holdCF)}/mo</span>
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setTab('expenses')}>Next → Expenses</button>
        </>
      )}

      {/* ── EXPENSES ─────────────────────────── */}
      {tab === 'expenses' && (
        <>
          <div className="section-card">
            <div className="section-header"><span className="section-icon">📊</span><span className="section-title">Operating Expenses</span></div>
            <div className="section-body">
              {(mode === 'sub2' || mode === 'seller_finance_sub2') && (
                <InfoBanner icon="ℹ️" text="T+I is embedded in your existing PITI — enter prop tax and insurance separately so post-refi cash flow calculates correctly after you refinance." />
              )}
              <div className="field-row">
                <div className="field">
                  <label>PM Rate (%)</label>
                  <input {...inp('pmPct')} placeholder="9" inputMode="decimal" />
                </div>
                <div className="field">
                  <label>Maint Reserve (%)</label>
                  <input {...inp('maintPct')} placeholder="6" inputMode="decimal" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Annual Prop Tax ($)</label>
                  <input {...inp('propTax')} placeholder={form.zip?.startsWith('77') ? 'TX ~2.5%' : '1800'} inputMode="numeric" />
                  {form.zip?.startsWith('77') && <span className="field-hint" style={{color:'var(--yellow)'}}>⚠️ Harris Co. ~2.5% — enter actual</span>}
                </div>
                <div className="field">
                  <label>Insurance /mo ($)</label>
                  <input {...inp('insurance')} placeholder="120" inputMode="numeric" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Utilities /mo ($)</label>
                  <input {...inp('utilities')} placeholder="0" inputMode="numeric" />
                </div>
                <div className="field">
                  <label>HOA /mo ($)</label>
                  <input {...inp('hoa')} placeholder="0" inputMode="numeric" />
                </div>
              </div>
              {result && (
                <div style={{fontSize:12, color:'var(--gray-300)', fontFamily:'var(--font-mono)', textAlign:'center'}}>
                  Total OpEx: <span style={{color:'var(--white)', fontWeight:600}}>{fmt$(result.totalOpEx)}/mo</span>
                </div>
              )}
            </div>
          </div>
          <div className="section-card">
            <div className="section-header"><span className="section-icon">🔄</span><span className="section-title">DSCR Refi Assumptions</span></div>
            <div className="section-body">
              <div className="field-row">
                <div className="field">
                  <label>Refi Rate (%)</label>
                  <input {...inp('refiRate')} placeholder="7.5" inputMode="decimal" />
                </div>
                <div className="field">
                  <label>Refi Term (yrs)</label>
                  <input {...inp('refiTerm')} placeholder="30" inputMode="numeric" />
                </div>
              </div>
            </div>
          </div>
          {result && <Scorecard result={result} mode={mode} />}
          <div style={{display:'flex', gap:8, marginTop:4}}>
            <button className="btn btn-danger" onClick={() => setForm(DEFAULTS)} style={{flex:1}}>Reset</button>
            <button className="btn btn-primary" onClick={handleSave} style={{flex:3}}>💾 Save to Pipeline</button>
          </div>
        </>
      )}
    </div>
  );
}

function InfoBanner({ icon, text }) {
  return (
    <div style={{
      background:'var(--navy-700)', border:'1px solid var(--navy-500)',
      borderRadius:6, padding:'8px 10px', fontSize:11,
      color:'var(--gray-300)', lineHeight:1.6, display:'flex', gap:8,
    }}>
      <span style={{flexShrink:0}}>{icon}</span>
      {text}
    </div>
  );
}

function Scorecard({ result, mode }) {
  if (!result) return null;
  const icons = { true:'✅', false:'❌', null:'⏳' };
  const vClass = { proceed:'verdict-proceed', review:'verdict-review', stop:'verdict-stop' };
  const vText  = { proceed:'🟢 PROCEED — All 5 filters pass', review:`🟡 REVIEW — ${result.passCount} of 5 pass`, stop:`🔴 DO NOT PROCEED — ${result.passCount} of 5 pass` };

  return (
    <div className="section-card" style={{marginTop:10}}>
      <div className="section-header"><span className="section-icon">🎯</span><span className="section-title">Deal Scorecard</span></div>
      <div className="section-body">
        <div className="metrics-grid" style={{marginBottom:10}}>
          {[
            ['Hold CF',     fmt$(result.holdCF),      result.holdCF >= 0 ? 'pos' : 'neg'],
            ['Post-Refi CF',fmt$(result.postRefiCF),  result.postRefiCF >= 200 ? 'pos' : 'neg'],
            ['DSCR',        fmtX(result.dscr),         result.dscr >= 1.2 ? 'pos' : 'neg'],
            ['Gap/Surplus', result.refiGap !== null ? (result.refiGap >= 0 ? '+' : '') + fmt$(result.refiGap) : '—',
                            result.refiGap >= 0 ? 'pos' : result.refiGap >= -15000 ? 'gold' : 'neg'],
            ['Cash Needed', fmt$(result.totalCashNeeded), 'gold'],
            ['CoC Return',  result.coc !== null ? fmtPct(result.coc) : '—', result.coc >= 8 ? 'pos' : 'gold'],
          ].map(([l,v,c]) => (
            <div key={l} className="metric-cell">
              <div className="metric-label">{l}</div>
              <div className={`metric-value ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="scorecard-grid">
          {result.scorecard.map(item => (
            <div key={item.id} className={`score-item ${item.pass === true ? 'pass' : item.pass === false ? 'fail' : 'pending'}`}>
              <span className="score-badge">{icons[String(item.pass)]}</span>
              <span className="score-label">{item.label}</span>
              {item.value && <span className="score-val">{item.value}</span>}
            </div>
          ))}
        </div>
        <div className={`verdict-banner ${vClass[result.verdict]}`} style={{marginTop:10}}>
          {vText[result.verdict]}
        </div>
      </div>
    </div>
  );
}
