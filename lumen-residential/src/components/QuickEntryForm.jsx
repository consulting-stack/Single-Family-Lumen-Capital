import React, { useState, useCallback, useEffect } from 'react';
import { underwrite, fmt$, fmtPct, fmtX } from '../utils/underwriting.js';

const ZIPS = {
  '39211': 'N. Jackson',
  '39208': 'Pearl',
  '39232': 'Flowood',
  '39042': 'Brandon',
  '39157': 'Ridgeland',
  '39110': 'Madison',
  '39218': 'Richland',
  '39073': 'Florence',
};

const DEFAULTS = {
  address: '', zip: '39211', beds: '3', yearBuilt: '',
  sqft: '', propType: 'SFR', status: 'Vacant',
  purchasePrice: '', arv: '', arvSource: '',
  downPayment: '0', sellerRate: '5', carryTerm: '30',
  balloonYears: '5', rehab: '', closingCosts: '',
  holdingMonths: '2', hoa: '0',
  strategy: 'Section 8', hudFmr: '', mktRent: '',
  selectedRent: '', vacancyRate: '4',
  pmPct: '9', maintPct: '6',
  propTax: '', insurance: '120', utilities: '0',
  refiRate: '7.5', refiTerm: '30',
};

export default function QuickEntryForm({ onSave, toast, initialValues }) {
  const [form, setForm]       = useState(() => initialValues ? { ...DEFAULTS, ...initialValues } : DEFAULTS);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState({});
  const [tab, setTab]         = useState('property'); // property | acquisition | rental | expenses

  // Live recalculate on every form change
  useEffect(() => {
    const f = parseForm(form);
    if (f.purchasePrice > 0 || f.arv > 0 || f.selectedRent > 0) {
      setResult(underwrite(f));
    } else {
      setResult(null);
    }
  }, [form]);

  function parseForm(f) {
    return {
      purchasePrice:  parseFloat(f.purchasePrice)  || 0,
      arv:            parseFloat(f.arv)            || 0,
      downPayment:    parseFloat(f.downPayment)    || 0,
      sellerRate:     parseFloat(f.sellerRate)     || 0,
      carryTerm:      parseFloat(f.carryTerm)      || 0,
      balloonYears:   parseFloat(f.balloonYears)   || 5,
      rehab:          parseFloat(f.rehab)          || 0,
      closingCosts:   parseFloat(f.closingCosts)   || 0,
      holdingMonths:  parseFloat(f.holdingMonths)  || 2,
      hoa:            parseFloat(f.hoa)            || 0,
      selectedRent:   parseFloat(f.selectedRent)   || 0,
      vacancyRate:    parseFloat(f.vacancyRate)     || 4,
      pmPct:          parseFloat(f.pmPct)          || 9,
      maintPct:       parseFloat(f.maintPct)       || 6,
      propTax:        parseFloat(f.propTax)        || 0,
      insurance:      parseFloat(f.insurance)      || 120,
      utilities:      parseFloat(f.utilities)      || 0,
      refiRate:       parseFloat(f.refiRate)        || 7.5,
      refiTerm:       parseFloat(f.refiTerm)        || 30,
    };
  }

  const set = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const inp = (k, extra = {}) => ({
    value: form[k],
    onChange: e => set(k, e.target.value),
    ...extra,
  });

  // Fetch HUD FMR
  async function fetchHUD() {
    if (!form.zip || !form.beds) { toast('Enter zip + beds first', 'error'); return; }
    setLoading(p => ({ ...p, hud: true }));
    try {
      const res = await fetch(`/.netlify/functions/hud-fmr?zip=${form.zip}&beds=${form.beds}`);
      const data = await res.json();
      if (data.fmr) {
        set('hudFmr', String(data.fmr));
        if (!form.selectedRent) set('selectedRent', String(data.fmr));
        toast(`HUD FMR: ${fmt$(data.fmr)}/mo → filled`, 'success');
      } else {
        toast(data.error || 'No FMR data found', 'error');
      }
    } catch { toast('HUD fetch failed', 'error'); }
    setLoading(p => ({ ...p, hud: false }));
  }

  // Fetch Rentcast AVM
  async function fetchRentcast() {
    if (!form.address) { toast('Enter address first', 'error'); return; }
    setLoading(p => ({ ...p, rc: true }));
    try {
      const res = await fetch(`/.netlify/functions/rentcast?address=${encodeURIComponent(form.address)}&beds=${form.beds}`);
      const data = await res.json();
      if (data.rent) { set('mktRent', String(data.rent)); }
      if (data.arv)  { set('arv', String(data.arv)); set('arvSource', 'Rentcast AVM'); }
      if (data.rent || data.arv) toast('Rentcast → filled', 'success');
      else toast(data.error || 'No Rentcast data', 'error');
    } catch { toast('Rentcast fetch failed', 'error'); }
    setLoading(p => ({ ...p, rc: false }));
  }

  function handleSave() {
    if (!form.address) { toast('Enter address first', 'error'); return; }
    const parsed = parseForm(form);
    const uw = result || underwrite(parsed);
    onSave({ form, parsed, result: uw, savedAt: new Date().toISOString() });
    toast('Deal saved to pipeline ✓', 'success');
  }

  function handleReset() {
    setForm(DEFAULTS);
    setResult(null);
  }

  const sections = [
    { id: 'property',    label: 'Property',    icon: '🏠' },
    { id: 'acquisition', label: 'Acquisition', icon: '💰' },
    { id: 'rental',      label: 'Rental',      icon: '📋' },
    { id: 'expenses',    label: 'Expenses',    icon: '📊' },
  ];

  return (
    <div className="page">
      {/* Mini section tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:10 }}>
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            style={{
              flex:1, padding:'8px 4px',
              background: tab === s.id ? 'var(--navy-600)' : 'var(--navy-800)',
              border: `1px solid ${tab === s.id ? 'var(--gold)' : 'var(--navy-600)'}`,
              borderRadius:6, cursor:'pointer',
              color: tab === s.id ? 'var(--gold)' : 'var(--gray-300)',
              fontSize:9, fontWeight:600, fontFamily:'var(--font-ui)',
              letterSpacing:'0.04em', textAlign:'center',
              display:'flex', flexDirection:'column', alignItems:'center', gap:3
            }}
          >
            <span style={{fontSize:14}}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── PROPERTY ─────────────────────── */}
      {tab === 'property' && (
        <>
          <div className="section-card">
            <div className="section-header">
              <span className="section-icon">🏠</span>
              <span className="section-title">Property Info</span>
            </div>
            <div className="section-body">
              <div className="field-row full">
                <div className="field">
                  <label>Address</label>
                  <input {...inp('address')} placeholder="123 Main St, Pearl MS" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Zip Code</label>
                  <select {...inp('zip')}>
                    {Object.entries(ZIPS).map(([z, m]) => (
                      <option key={z} value={z}>{z} — {m}</option>
                    ))}
                  </select>
                  <span className="field-hint">{ZIPS[form.zip] || ''}</span>
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
                  <select {...inp('propType')}>
                    <option>SFR</option>
                    <option>Duplex</option>
                    <option>Triplex</option>
                  </select>
                </div>
                <div className="field">
                  <label>Current Status</label>
                  <select {...inp('status')}>
                    <option>Vacant</option>
                    <option>Occupied</option>
                    <option>Owner-Occupied</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setTab('acquisition')}>
            Next → Acquisition Terms
          </button>
        </>
      )}

      {/* ── ACQUISITION ──────────────────── */}
      {tab === 'acquisition' && (
        <>
          <div className="section-card">
            <div className="section-header">
              <span className="section-icon">💰</span>
              <span className="section-title">Acquisition Terms</span>
            </div>
            <div className="section-body">
              <div className="field-row">
                <div className="field">
                  <label>Purchase Price ($)</label>
                  <input {...inp('purchasePrice')} placeholder="120000" inputMode="numeric" />
                </div>
                <div className="field">
                  <label>ARV Estimate ($)</label>
                  <input {...inp('arv')} placeholder="165000" inputMode="numeric" />
                  <span className="field-hint">{form.arvSource || 'Tap Rentcast →'}</span>
                </div>
              </div>
              <button className="btn btn-api" onClick={fetchRentcast} disabled={loading.rc}>
                {loading.rc ? <><span className="spinner" />Fetching…</> : '⚡ Fetch Rentcast AVM + Market Rent'}
              </button>
              <div className="field-row">
                <div className="field">
                  <label>Down Payment ($)</label>
                  <input {...inp('downPayment')} placeholder="0" inputMode="numeric" />
                </div>
                <div className="field">
                  <label>Seller Rate (%)</label>
                  <input {...inp('sellerRate')} placeholder="5.0" inputMode="decimal" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Carry Term (yrs)</label>
                  <input {...inp('carryTerm')} placeholder="30" inputMode="numeric" />
                </div>
                <div className="field">
                  <label>Balloon In (yrs)</label>
                  <input {...inp('balloonYears')} placeholder="5" inputMode="numeric" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Est. Rehab ($)</label>
                  <input {...inp('rehab')} placeholder="0" inputMode="numeric" />
                </div>
                <div className="field">
                  <label>Closing Costs ($)</label>
                  <input {...inp('closingCosts')} placeholder="3000" inputMode="numeric" />
                </div>
              </div>

              {/* Live buy box check */}
              {result && result.buyBoxPass !== null && (
                <div className={`score-item ${result.buyBoxPass ? 'pass' : 'fail'}`} style={{marginTop:4}}>
                  <span className="score-badge">{result.buyBoxPass ? '✅' : '❌'}</span>
                  <span className="score-label">Buy Box</span>
                  <span className="score-val">{result.pctOfARV ? fmtPct(result.pctOfARV * 100) + ' of ARV' : ''}</span>
                </div>
              )}
              {result && result.maxBuyPrice > 0 && (
                <div style={{fontSize:11, color:'var(--gray-300)', textAlign:'center', fontFamily:'var(--font-mono)'}}>
                  Max offer: {fmt$(result.maxBuyPrice)}  ·  Seller pmt: {result.sellerPayment ? fmt$(result.sellerPayment) + '/mo' : '—'}
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setTab('rental')}>
            Next → Rental Income
          </button>
        </>
      )}

      {/* ── RENTAL ───────────────────────── */}
      {tab === 'rental' && (
        <>
          <div className="section-card">
            <div className="section-header">
              <span className="section-icon">📋</span>
              <span className="section-title">Rental Income</span>
            </div>
            <div className="section-body">
              <div className="field-row">
                <div className="field">
                  <label>Strategy</label>
                  <select {...inp('strategy')}>
                    <option>Section 8</option>
                    <option>Market Rate</option>
                    <option>Both / Flex</option>
                  </select>
                </div>
                <div className="field">
                  <label>Vacancy Rate (%)</label>
                  <input {...inp('vacancyRate')} placeholder="4" inputMode="decimal" />
                  <span className="field-hint">S8=4%  MR=8%</span>
                </div>
              </div>

              <button className="btn btn-api" onClick={fetchHUD} disabled={loading.hud}>
                {loading.hud ? <><span className="spinner" />Fetching…</> : '🏛️ Fetch HUD FMR (auto-fills by zip + beds)'}
              </button>

              <div className="field-row">
                <div className="field">
                  <label>HUD FMR ($)</label>
                  <input {...inp('hudFmr')} placeholder="auto-filled" inputMode="numeric" style={{background:'var(--navy-700)', borderColor:'var(--blue-400)'}} />
                </div>
                <div className="field">
                  <label>Market Rent ($)</label>
                  <input {...inp('mktRent')} placeholder="auto-filled" inputMode="numeric" style={{background:'var(--navy-700)', borderColor:'var(--blue-400)'}} />
                </div>
              </div>

              <div className="field-row full">
                <div className="field">
                  <label>YOUR SELECTED RENT ($)</label>
                  <input
                    {...inp('selectedRent')}
                    placeholder="Enter target rent"
                    inputMode="numeric"
                    style={{
                      background:'var(--navy-600)',
                      borderColor:'var(--gold)',
                      fontSize:16,
                      fontWeight:600,
                      color:'var(--gold)'
                    }}
                  />
                  <span className="field-hint">This drives all calculations</span>
                </div>
              </div>

              {result && result.egi !== null && (
                <div style={{fontSize:12, color:'var(--gray-300)', fontFamily:'var(--font-mono)', textAlign:'center', padding:'6px 0'}}>
                  EGI: <span style={{color:'var(--white)', fontWeight:600}}>{fmt$(result.egi)}/mo</span>
                  {'  '}·{'  '}
                  Hold CF: <span style={{color: result.holdCF >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600}}>
                    {fmt$(result.holdCF)}/mo
                  </span>
                </div>
              )}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => setTab('expenses')}>
            Next → Expenses
          </button>
        </>
      )}

      {/* ── EXPENSES ─────────────────────── */}
      {tab === 'expenses' && (
        <>
          <div className="section-card">
            <div className="section-header">
              <span className="section-icon">📊</span>
              <span className="section-title">Operating Expenses</span>
            </div>
            <div className="section-body">
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
                  <input {...inp('propTax')} placeholder="1800" inputMode="numeric" />
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
                <div style={{fontSize:12, color:'var(--gray-300)', fontFamily:'var(--font-mono)', textAlign:'center', padding:'6px 0'}}>
                  Total OpEx: <span style={{color:'var(--white)', fontWeight:600}}>{fmt$(result.totalOpEx)}/mo</span>
                </div>
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">
              <span className="section-icon">🔄</span>
              <span className="section-title">DSCR Refi Assumptions</span>
            </div>
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

          {/* Full Scorecard */}
          {result && <Scorecard result={result} />}

          <div style={{display:'flex', gap:8, marginTop:4}}>
            <button className="btn btn-danger" onClick={handleReset} style={{flex:1}}>
              Reset
            </button>
            <button className="btn btn-primary" onClick={handleSave} style={{flex:3}}>
              💾 Save to Pipeline
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inline Scorecard component ──────────────────────────────────
function Scorecard({ result }) {
  if (!result) return null;

  const icons = { true: '✅', false: '❌', null: '⏳' };
  const verdictClass = { proceed: 'verdict-proceed', review: 'verdict-review', stop: 'verdict-stop' };
  const verdictText  = {
    proceed: '🟢 PROCEED — All 5 filters pass',
    review:  `🟡 REVIEW — ${result.passCount} of 5 pass`,
    stop:    `🔴 DO NOT PROCEED — ${result.passCount} of 5 pass`,
  };

  return (
    <div className="section-card" style={{marginTop:10}}>
      <div className="section-header">
        <span className="section-icon">🎯</span>
        <span className="section-title">Deal Scorecard</span>
      </div>
      <div className="section-body">
        <div className="metrics-grid" style={{marginBottom:10}}>
          <div className="metric-cell">
            <div className="metric-label">Hold CF / mo</div>
            <div className={`metric-value ${result.holdCF >= 0 ? 'pos' : 'neg'}`}>{fmt$(result.holdCF)}</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Post-Refi CF</div>
            <div className={`metric-value ${result.postRefiCF >= 200 ? 'pos' : 'neg'}`}>{fmt$(result.postRefiCF)}</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">DSCR</div>
            <div className={`metric-value ${result.dscr >= 1.2 ? 'pos' : 'neg'}`}>{fmtX(result.dscr)}</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Gap / Surplus</div>
            <div className={`metric-value ${result.refiGap >= 0 ? 'pos' : result.refiGap >= -15000 ? 'gold' : 'neg'}`}>
              {result.refiGap !== null ? (result.refiGap >= 0 ? '+' : '') + fmt$(result.refiGap) : '—'}
            </div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">Cash Needed</div>
            <div className="metric-value gold">{fmt$(result.totalCashNeeded)}</div>
          </div>
          <div className="metric-cell">
            <div className="metric-label">CoC Return</div>
            <div className={`metric-value ${result.coc >= 8 ? 'pos' : 'gold'}`}>
              {result.coc !== null ? fmtPct(result.coc) : '—'}
            </div>
          </div>
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

        <div className={`verdict-banner ${verdictClass[result.verdict]}`} style={{marginTop:10}}>
          {verdictText[result.verdict]}
        </div>
      </div>
    </div>
  );
}
