import React, { useState, useCallback, useEffect } from 'react';
import QuickEntryForm from './components/QuickEntryForm.jsx';
import ListingParser from './components/ListingParser.jsx';
import Pipeline from './components/Pipeline.jsx';

const STORAGE_KEY = 'lumen_res_pipeline_v1';

function loadPipeline() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function savePipeline(deals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

export default function App() {
  const [mainTab, setMainTab]   = useState('entry');   // entry | parse | pipeline
  const [deals, setDeals]       = useState(loadPipeline);
  const [toast, setToastState]  = useState(null);
  const [formSeed, setFormSeed] = useState(null);      // data from parser → form

  // Toast helper
  const showToast = useCallback((msg, type = '') => {
    setToastState({ msg, type });
    setTimeout(() => setToastState(null), 2800);
  }, []);

  // Save deal to pipeline
  function handleSave(deal) {
    const updated = [deal, ...deals];
    setDeals(updated);
    savePipeline(updated);
  }

  // Load deal back into form
  function handleLoad(deal) {
    setFormSeed(deal.form);
    setMainTab('entry');
    showToast('Deal loaded into form', 'success');
  }

  // Delete from pipeline
  function handleDelete(idx) {
    const updated = deals.filter((_, i) => i !== idx);
    setDeals(updated);
    savePipeline(updated);
    showToast('Deal removed', '');
  }

  // Parsed listing → pre-fill form
  function handleParsed(data) {
    setFormSeed(data);
    setMainTab('entry');
  }

  const tabs = [
    { id: 'entry',    icon: '📋', label: 'Enter Deal' },
    { id: 'parse',    icon: '🤖', label: 'Paste Listing' },
    { id: 'pipeline', icon: '📂', label: `Pipeline${deals.length ? ` (${deals.length})` : ''}` },
  ];

  return (
    <div className="app-shell">
      {/* ── Header ─────────────────────── */}
      <div className="app-header">
        <div className="header-brand">
          <div className="header-logo">🏠</div>
          <div>
            <div className="header-title">LUMEN RESIDENTIAL</div>
            <div className="header-sub">DEAL UNDERWRITER  ·  SELLER FINANCE + S8</div>
          </div>
        </div>
        <div className="tab-bar" style={{marginTop:10}}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${mainTab === t.id ? 'active' : ''}`}
              onClick={() => setMainTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────── */}
      {mainTab === 'entry' && (
        <QuickEntryForm
          key={formSeed ? JSON.stringify(formSeed) : 'blank'}
          initialValues={formSeed}
          onSave={handleSave}
          toast={showToast}
        />
      )}
      {mainTab === 'parse' && (
        <ListingParser onParsed={handleParsed} toast={showToast} />
      )}
      {mainTab === 'pipeline' && (
        <Pipeline deals={deals} onLoad={handleLoad} onDelete={handleDelete} />
      )}

      {/* ── Toast ──────────────────────── */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
