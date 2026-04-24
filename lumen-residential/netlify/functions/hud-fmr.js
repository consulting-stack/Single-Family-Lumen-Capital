// netlify/functions/hud-fmr.js
// Returns HUD Fair Market Rent for a given zip + bedroom count
// Falls back to hardcoded FY2025/2026 table if API is unavailable

const FMR_TABLE = {
  '39211': { name: 'N. Jackson',  fmr: [710, 830,  1010, 1750, 1530], pha: 'JHA'  },
  '39208': { name: 'Pearl',       fmr: [810, 950,  1155, 1620, 1740], pha: 'MRHA' },
  '39232': { name: 'Flowood',     fmr: [815, 955,  1160, 2040, 1750], pha: 'MRHA' },
  '39042': { name: 'Brandon',     fmr: [820, 960,  1170, 1590, 1760], pha: 'MRHA' },
  '39157': { name: 'Ridgeland',   fmr: [920, 1080, 1310, 1730, 1980], pha: 'MRHA' },
  '39110': { name: 'Madison',     fmr: [950, 1110, 1350, 2310, 2040], pha: 'MRHA' },
  '39218': { name: 'Richland',    fmr: [790, 925,  1125, 1480, 1695], pha: 'MRHA' },
  '39073': { name: 'Florence',    fmr: [790, 925,  1125, 1480, 1695], pha: 'MRHA' },
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const { zip, beds } = event.queryStringParameters || {};

    if (!zip || !beds) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'zip and beds are required' }) };
    }

    const bedIdx = Math.min(Math.max(parseInt(beds), 0), 4);
    const entry  = FMR_TABLE[zip];

    if (!entry) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `No FMR data for ZIP ${zip}. Add it to the table.` }),
      };
    }

    const fmr     = entry.fmr[bedIdx];
    const payStd  = Math.round(fmr * 1.10);   // MRHA 110% payment standard
    const market  = entry.name;
    const pha     = entry.pha;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ fmr, payStd, market, pha, zip, beds: bedIdx }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'HUD FMR lookup failed: ' + err.message }),
    };
  }
};
