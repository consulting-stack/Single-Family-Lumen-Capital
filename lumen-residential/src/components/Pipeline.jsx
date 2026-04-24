import React, { useState } from 'react';
import { fmt$, fmtPct, fmtX } from '../utils/underwriting.js';

export default function Pipeline({ deals, onLoad, onDelete }) {
  const [expanded, setExpanded] = useState(null);

  if (!deals.length) {
    return (
      <div className="page">
        <div className="pipeline-empty">
          <div className="pipeline-empty-icon">📭</div>
          <div className="pipeline-empty-text">No deals saved yet.<br/>Analyze a deal → Save to Pipeline.</div>
        </div>
      </div>
    );
  }

  const verdictColor = { proceed: 'green', review: 'gold', stop: 'red' };
  const verdictLabel = { proceed: '🟢 PROCEED', review: '🟡 REVIEW', stop: '🔴 STOP' };

  return (
    <div className="page">
      <div style={{fontSize:11, color:'var(--gray-300)', marginBottom:10, fontFamily:'var(--font-mono)'}}>
        {deals.length} deal{deals.length !== 1 ? 's' : ''} in pipeline
      </div>

      {deals.map((deal, idx) => {
        const r   = deal.result;
        const f   = deal.form;
        const isX = expanded === idx;

        return (
          <div key={idx} className="deal-card" onClick={() => setExpanded(isX ? null : idx)}>
            <div className="deal-card-address">
              <span style={{fontSize:13, flex:1, paddingRight:8}}>
                {f.address || 'No address'}
              </span>
              <span className={`deal-chip ${verdictColor[r?.verdict] || ''}`}>
                {r ? verdictLabel[r.verdict] : '—'}
              </span>
            </div>

            <div className="deal-card-meta">
              <span className="deal-chip">{f.zip}</span>
              <span className="deal-chip">{f.beds}BR</span>
              <span className="deal-chip gold">{fmt$(parseFloat(f.purchasePrice))}</span>
              {r?.postRefiCF != null && (
                <span className={`deal-chip ${r.postRefiCF >= 200 ? 'green' : 'red'}`}>
                  {fmt$(r.postRefiCF)}/mo
                </span>
              )}
              {r?.dscr != null && (
                <span className={`deal-chip ${r.dscr >= 1.2 ? 'green' : 'red'}`}>
                  DSCR {fmtX(r.dscr)}
                </span>
              )}
            </div>

            {/* Expanded detail */}
            {isX && r && (
              <div style={{marginTop:12}} onClick={e => e.stopPropagation()}>
                <div className="divider" />
                <div className="metrics-grid" style={{marginTop:8}}>
                  {[
                    ['Purchase',   fmt$(parseFloat(f.purchasePrice))],
                    ['ARV',        fmt$(parseFloat(f.arv))],
                    ['% of ARV',   r.pctOfARV ? fmtPct(r.pctOfARV * 100) : '—'],
                    ['Seller Pmt', r.sellerPayment ? fmt$(r.sellerPayment)+'/mo' : '—'],
                    ['Hold CF',    fmt$(r.holdCF)+'/mo'],
                    ['DSCR',       fmtX(r.dscr)],
                    ['Post-Refi',  fmt$(r.postRefiCF)+'/mo'],
                    ['Gap',        r.refiGap != null ? fmt$(r.refiGap) : '—'],
                    ['Cash Needed',fmt$(r.totalCashNeeded)],
                    ['CoC',        r.coc != null ? fmtPct(r.coc) : '—'],
                  ].map(([l,v]) => (
                    <div key={l} className="metric-cell">
                      <div className="metric-label">{l}</div>
                      <div className="metric-value">{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{display:'flex', gap:6, marginTop:10}}>
                  <button
                    className="btn btn-secondary"
                    style={{flex:1, fontSize:12, padding:10}}
                    onClick={() => onLoad(deal)}
                  >
                    ✏️ Load & Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{flex:1}}
                    onClick={() => { if(confirm('Delete this deal?')) onDelete(idx); }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
