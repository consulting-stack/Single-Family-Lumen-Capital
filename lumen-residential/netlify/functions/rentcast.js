// netlify/functions/rentcast.js
// Proxies Rentcast API calls server-side so the API key stays private

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const key = process.env.RENTCAST_KEY;
  if (!key) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'RENTCAST_KEY not configured in Netlify environment variables.' }),
    };
  }

  try {
    const { address, beds } = event.queryStringParameters || {};

    if (!address) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'address is required' }) };
    }

    const result = {};

    // ── Rent AVM ──────────────────────────────────────────────────
    const rentUrl = 'https://api.rentcast.io/v1/avm/rent/long-term?' +
      'address=' + encodeURIComponent(address) +
      '&propertyType=Single+Family' +
      (beds ? '&bedrooms=' + beds : '');

    const rentRes  = await fetch(rentUrl, { headers: { 'X-Api-Key': key } });
    const rentData = await rentRes.json();

    if (rentData && rentData.rent) {
      result.rent          = Math.round(rentData.rent);
      result.rentRangeLow  = rentData.rentRangeLow  ? Math.round(rentData.rentRangeLow)  : null;
      result.rentRangeHigh = rentData.rentRangeHigh ? Math.round(rentData.rentRangeHigh) : null;
    }

    // ── Value AVM ─────────────────────────────────────────────────
    const avmUrl  = 'https://api.rentcast.io/v1/avm/value?address=' + encodeURIComponent(address);
    const avmRes  = await fetch(avmUrl, { headers: { 'X-Api-Key': key } });
    const avmData = await avmRes.json();

    if (avmData && avmData.price) {
      result.arv          = Math.round(avmData.price);
      result.arvRangeLow  = avmData.priceRangeLow  ? Math.round(avmData.priceRangeLow)  : null;
      result.arvRangeHigh = avmData.priceRangeHigh ? Math.round(avmData.priceRangeHigh) : null;
    }

    if (!result.rent && !result.arv) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Rentcast returned no data for this address. Verify address format.' }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Rentcast fetch failed: ' + err.message }),
    };
  }
};
