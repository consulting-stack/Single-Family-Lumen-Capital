import React, { useState } from 'react';

export default function ListingParser({ onParsed, toast }) {
  const [text, setText]       = useState('');
  const [parsed, setParsed]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleParse() {
    if (!text.trim() || text.trim().length < 30) {
      toast('Paste a listing first (need at least a few lines)', 'error');
      return;
    }
    setLoading(true);
    setParsed(null);
    try {
      const res  = await fetch('/.netlify/functions/parse-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (data.error) { toast(data.error, 'error'); }
      else {
        setParsed(data);
        toast('Listing parsed ✓', 'success');
      }
    } catch (e) {
      toast('Parse failed — check connection', 'error');
    }
    setLoading(false);
  }

  function handleUseThis() {
    if (!parsed) return;
    onParsed(parsed);
    toast('Fields populated → check Enter Deal tab', 'success');
  }

  function handleClear() {
    setText('');
    setParsed(null);
  }

  const fields = [
    { key: 'address',      label: 'Address' },
    { key: 'zip',          label: 'Zip Code' },
    { key: 'beds',         label: 'Bedrooms' },
    { key: 'yearBuilt',    label: 'Year Built' },
    { key: 'sqft',         label: 'Sq Footage' },
    { key: 'propType',     label: 'Property Type' },
    { key: 'status',       label: 'Status' },
    { key: 'purchasePrice','label': 'List Price' },
    { key: 'daysOnMarket', label: 'Days on Market' },
    { key: 'condition',    label: 'Condition Notes' },
  ];

  return (
    <div className="page">
      <div className="section-card">
        <div className="section-header">
          <span className="section-icon">📄</span>
          <span className="section-title">Paste MLS / Zillow Listing</span>
        </div>
        <div className="section-body">
          <div className="field full">
            <label>Listing Text</label>
            <textarea
              rows={9}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={
`Paste a full listing description here. Works with:

• MLS printout
• Zillow / Realtor.com description
• Amanda's exported CSV row
• Any text that has address, beds, price

The AI will extract address, zip, beds, year built,
sq footage, type, status, price, and condition notes.`
              }
            />
          </div>

          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-danger" onClick={handleClear} style={{flex:1}} disabled={loading}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={handleParse} disabled={loading || !text.trim()} style={{flex:3}}>
              {loading
                ? <><span className="spinner" />Parsing with AI…</>
                : '🤖 Parse Listing with AI'
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Extracted fields preview ─────── */}
      {parsed && (
        <div className="section-card">
          <div className="section-header">
            <span className="section-icon">✅</span>
            <span className="section-title">Extracted — Review Before Using</span>
          </div>
          <div className="section-body">
            {fields.map(({ key, label }) => {
              const val = parsed[key];
              if (!val && val !== 0) return null;
              return (
                <div key={key} className="extracted-field">
                  <span className="extracted-key">{label}</span>
                  <span className="extracted-val">{String(val)}</span>
                </div>
              );
            })}

            {parsed.confidence && (
              <div style={{
                marginTop:8, padding:'8px 10px',
                background:'var(--navy-900)',
                borderRadius:6, fontSize:11,
                color:'var(--gray-300)',
                fontFamily:'var(--font-mono)'
              }}>
                <span style={{color: parsed.confidence === 'HIGH' ? 'var(--green)' : parsed.confidence === 'MEDIUM' ? 'var(--yellow)' : 'var(--red)'}}>
                  {parsed.confidence === 'HIGH' ? '🟢' : parsed.confidence === 'MEDIUM' ? '🟡' : '🔴'}
                </span>
                {' '}Confidence: {parsed.confidence}
                {parsed.notes && <div style={{marginTop:4, lineHeight:1.5}}>{parsed.notes}</div>}
              </div>
            )}

            <button className="btn btn-primary" onClick={handleUseThis} style={{marginTop:4}}>
              Use This → Populate Enter Deal Form
            </button>
          </div>
        </div>
      )}

      {/* ── Tips ────────────────────────── */}
      <div className="section-card">
        <div className="section-header">
          <span className="section-icon">💡</span>
          <span className="section-title">Tips</span>
        </div>
        <div className="section-body" style={{gap:6}}>
          {[
            "Works best with full listing text — more context = higher confidence",
            "Paste Amanda's expired/withdrawn export rows directly — address + price + beds is enough",
            "AI extracts what's there. Always review before hitting Use This",
            "After populating, switch to Enter Deal → tap Acquisition tab to set seller terms",
            "Run Fetch HUD FMR and Rentcast after populating — those fields won't come from the listing",
          ].map((tip, i) => (
            <div key={i} style={{
              display:'flex', gap:8, alignItems:'flex-start',
              fontSize:12, color:'var(--gray-300)', lineHeight:1.5
            }}>
              <span style={{color:'var(--gold)', flexShrink:0, fontFamily:'var(--font-mono)', fontSize:10, marginTop:2}}>
                {String(i+1).padStart(2,'0')}
              </span>
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
