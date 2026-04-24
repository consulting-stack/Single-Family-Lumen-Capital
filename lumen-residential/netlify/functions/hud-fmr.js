// netlify/functions/hud-fmr.js
// National HUD FMR lookup + state-aware property tax defaults
// HUD API token FREE at: https://www.huduser.gov/hudapi/public/register/
// Set HUD_TOKEN in Netlify env vars — without it, falls back to local table

const FMR_TABLE = {
  // Mississippi
  '39211': { name: 'N. Jackson, MS',    fmr: [710,  830,  1010, 1750, 1530], pha: 'JHA'  },
  '39208': { name: 'Pearl, MS',         fmr: [810,  950,  1155, 1620, 1740], pha: 'MRHA' },
  '39232': { name: 'Flowood, MS',       fmr: [815,  955,  1160, 2040, 1750], pha: 'MRHA' },
  '39042': { name: 'Brandon, MS',       fmr: [820,  960,  1170, 1590, 1760], pha: 'MRHA' },
  '39157': { name: 'Ridgeland, MS',     fmr: [920,  1080, 1310, 1730, 1980], pha: 'MRHA' },
  '39110': { name: 'Madison, MS',       fmr: [950,  1110, 1350, 2310, 2040], pha: 'MRHA' },
  '39218': { name: 'Richland, MS',      fmr: [790,  925,  1125, 1480, 1695], pha: 'MRHA' },
  '39073': { name: 'Florence, MS',      fmr: [790,  925,  1125, 1480, 1695], pha: 'MRHA' },
  // Houston core
  '77002': { name: 'Houston Downtown',  fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77004': { name: 'Houston Midtown',   fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77006': { name: 'Houston Montrose',  fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77007': { name: 'Houston Heights',   fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77008': { name: 'Houston Heights N', fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77009': { name: 'Houston Northside', fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77011': { name: 'Houston East End',  fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77012': { name: 'Houston East',      fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77016': { name: 'Houston NE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77017': { name: 'Houston SE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77021': { name: 'Houston South',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77022': { name: 'Houston Northside', fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77023': { name: 'Houston East End',  fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77026': { name: 'Fifth Ward TX',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77028': { name: 'Houston NE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77033': { name: 'Houston SE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77037': { name: 'Houston North',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77038': { name: 'Houston North',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77039': { name: 'Houston NE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77040': { name: 'Houston NW',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77044': { name: 'Houston East',      fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77045': { name: 'Houston SW',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77047': { name: 'Houston South',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77051': { name: 'Houston South',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77060': { name: 'Aldine TX',         fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77061': { name: 'Houston SE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77075': { name: 'Houston SE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77076': { name: 'Houston North',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77078': { name: 'Houston NE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77080': { name: 'Spring Branch TX',  fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77081': { name: 'Meyerland TX',      fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77082': { name: 'Houston West',      fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77083': { name: 'Houston SW',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77085': { name: 'Houston SW',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77086': { name: 'Houston North',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77087': { name: 'Houston SE',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77088': { name: 'Houston North',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77091': { name: 'Houston NW',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77093': { name: 'Houston North',     fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77099': { name: 'Alief TX',          fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  // Houston suburbs
  '77373': { name: 'Spring TX',         fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77379': { name: 'Klein TX',          fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77388': { name: 'Spring TX',         fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77396': { name: 'Humble TX',         fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77429': { name: 'Cypress TX',        fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77449': { name: 'Katy TX',           fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77477': { name: 'Stafford TX',       fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77478': { name: 'Sugar Land TX',     fmr: [960,  1090, 1320, 1750, 2100], pha: 'FBCHA'},
  '77489': { name: 'Missouri City TX',  fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77503': { name: 'Pasadena TX',       fmr: [920,  1040, 1260, 1680, 2010], pha: 'HHA'  },
  '77521': { name: 'Baytown TX',        fmr: [820,  940,  1140, 1510, 1820], pha: 'HHA'  },
};

// Auto-detect state from zip → property tax + insurance defaults
function getStateDefaults(zip) {
  const z = String(zip);
  if (['75','76','77','78','79'].some(p => z.startsWith(p)))
    return { state: 'TX', propTaxRate: 2.5, insuranceMonthly: 145, label: 'Texas' };
  if (['39','38'].some(p => z.startsWith(p)))
    return { state: 'MS', propTaxRate: 1.0, insuranceMonthly: 120, label: 'Mississippi' };
  if (['32','33','34'].some(p => z.startsWith(p)))
    return { state: 'FL', propTaxRate: 1.1, insuranceMonthly: 230, label: 'Florida' };
  if (['30','31'].some(p => z.startsWith(p)))
    return { state: 'GA', propTaxRate: 1.0, insuranceMonthly: 130, label: 'Georgia' };
  if (['37'].some(p => z.startsWith(p)))
    return { state: 'TN', propTaxRate: 0.7, insuranceMonthly: 125, label: 'Tennessee' };
  if (['35','36'].some(p => z.startsWith(p)))
    return { state: 'AL', propTaxRate: 0.4, insuranceMonthly: 130, label: 'Alabama' };
  if (['70','71'].some(p => z.startsWith(p)))
    return { state: 'LA', propTaxRate: 0.5, insuranceMonthly: 175, label: 'Louisiana' };
  return { state: 'US', propTaxRate: 1.2, insuranceMonthly: 135, label: 'National avg' };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { zip, beds } = event.queryStringParameters || {};
    if (!zip || !beds) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'zip and beds required' }) };
    }

    const bedIdx    = Math.min(Math.max(parseInt(beds), 0), 4);
    const stateInfo = getStateDefaults(zip);
    const hudToken  = process.env.HUD_TOKEN;
    let fmr = null, market = null, pha = null, source = 'fallback';

    // ── 1. Live HUD API (any US zip — requires free HUD_TOKEN) ────────────
    if (hudToken) {
      try {
        const url = `https://www.huduser.gov/hudapi/public/fmr/listFMRsByZip/${zip}?year=2025`;
        const res  = await fetch(url, { headers: { Authorization: `Bearer ${hudToken}` } });
        if (res.ok) {
          const data = await res.json();
          const bd   = data?.data?.basicdata?.[0] || data?.basicdata?.[0];
          if (bd) {
            const keys = ['efficiency','one_bedroom','two_bedroom','three_bedroom','four_bedroom'];
            const val  = bd[keys[bedIdx]];
            if (val) { fmr = parseInt(val); market = bd.metro_name || bd.county_name || `ZIP ${zip}`; pha = 'Local PHA'; source = 'HUD API'; }
          }
        }
      } catch (e) { /* fall through */ }
    }

    // ── 2. Local table fallback ───────────────────────────────────────────
    if (!fmr && FMR_TABLE[zip]) {
      const e = FMR_TABLE[zip];
      fmr = e.fmr[bedIdx]; market = e.name; pha = e.pha; source = 'Local table (FY2025)';
    }

    // ── 3. State-level estimate for unknown zips ──────────────────────────
    if (!fmr) {
      const est = { TX:[850,1000,1200,1600,1900], MS:[650,770,940,1250,1430], FL:[900,1050,1280,1700,2000],
                    GA:[820,960,1160,1540,1840],  TN:[780,910,1100,1460,1750], AL:[660,780,940,1250,1490],
                    LA:[700,820,990,1320,1570],   US:[800,940,1130,1500,1800] };
      const arr = est[stateInfo.state] || est.US;
      fmr = arr[bedIdx]; market = `${stateInfo.label} (state estimate)`; pha = 'Local PHA — verify';
      source = hudToken ? 'State estimate (zip not in HUD data)' : 'State estimate — add HUD_TOKEN for exact data';
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ fmr, payStd: Math.round(fmr * 1.10), market, pha, zip, beds: bedIdx, source, stateDefaults: stateInfo }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
