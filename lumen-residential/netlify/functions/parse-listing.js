// netlify/functions/parse-listing.js
// Calls Claude API to extract structured data from a pasted MLS/Zillow listing
// API key stays server-side — never exposed to the browser

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const key = process.env.ANTHROPIC_KEY;
  if (!key) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'ANTHROPIC_KEY not configured in Netlify environment variables.' }),
    };
  }

  try {
    const { text } = JSON.parse(event.body || '{}');
    if (!text || text.trim().length < 10) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No listing text provided.' }) };
    }

    const prompt = `You are a real estate data extraction assistant. Extract property information from the listing text below and return ONLY a valid JSON object with these exact keys. Do not include any explanation or markdown.

Required fields (use null if not found):
- address: full street address as a string (e.g. "123 Main St")
- city: city name
- zip: 5-digit zip code as string
- beds: number of bedrooms as integer
- baths: number of bathrooms as float or null
- yearBuilt: year as integer or null
- sqft: square footage as integer or null
- propType: "SFR", "Duplex", "Triplex", or "Condo" — default to "SFR" if unclear
- status: "Vacant", "Occupied", or "Owner-Occupied" — use "Vacant" if expired/withdrawn listing
- purchasePrice: list price as integer (no $ or commas) or null
- daysOnMarket: integer or null
- condition: one-sentence summary of condition if mentioned, or null
- confidence: "HIGH" if address + price + beds all found, "MEDIUM" if 2 of 3, "LOW" if fewer
- notes: any important flags (expired date, price drops, distress signals, HOA, etc.) or null

Listing text:
${text.substring(0, 4000)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Claude API error: ' + (data.error?.message || 'Unknown') }),
      };
    }

    const raw = data.content?.[0]?.text || '';

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);

    // Normalize types
    if (parsed.purchasePrice) parsed.purchasePrice = String(parsed.purchasePrice);
    if (parsed.beds)          parsed.beds          = String(parsed.beds);
    if (parsed.yearBuilt)     parsed.yearBuilt     = String(parsed.yearBuilt);
    if (parsed.sqft)          parsed.sqft          = String(parsed.sqft);

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Parse failed: ' + err.message }),
    };
  }
};
