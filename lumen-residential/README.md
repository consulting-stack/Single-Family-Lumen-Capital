# 🏠 Lumen Residential Underwriter

**Seller Finance + Section 8 Acquisition Tool**  
Mobile-first React PWA — works on phone, tablet, desktop.

---

## Deploy in 5 Steps

### Step 1 — Push to GitHub
1. Create a new repo on GitHub (name it `lumen-residential` or anything you want)
2. Upload this entire folder to the repo (drag and drop on GitHub, or use GitHub Desktop)

### Step 2 — Connect to Netlify
1. Go to [netlify.com](https://netlify.com) → Log in (use GitHub login)
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** → select your `lumen-residential` repo
4. Build settings auto-detected from `netlify.toml` — leave as-is
5. Click **Deploy site**

### Step 3 — Set Environment Variables (API Keys)
In Netlify → Site settings → **Environment variables**, add these:

| Variable         | Value              | Where to get it |
|------------------|--------------------|-----------------|
| `RENTCAST_KEY`   | Your Rentcast key  | rentcast.io → API dashboard |
| `ANTHROPIC_KEY`  | Your Anthropic key | console.anthropic.com → API Keys |

> **Note:** HUD FMR data is hardcoded for your target markets (no key needed). Update annually.

### Step 4 — Redeploy
After adding environment variables:  
Netlify → Deploys → **Trigger deploy** → Deploy site

### Step 5 — Add to Phone Home Screen
1. Open the Netlify URL on your phone (e.g. `lumen-residential.netlify.app`)
2. iPhone: tap **Share → Add to Home Screen**  
3. Android: tap **⋮ → Add to Home Screen**

Done. It opens like a native app with no browser chrome.

---

## Workflow

```
Amanda pulls expired/withdrawn MLS list
         ↓
[Paste Listing tab] → paste any listing text → AI extracts fields
         ↓
[Enter Deal tab] auto-populated → review + adjust seller terms
         ↓
Tap "Fetch HUD FMR" + "Fetch Rentcast AVM"
         ↓
Enter Selected Rent → watch scorecard update live
         ↓
5/5 green → Save to Pipeline
         ↓
[Pipeline tab] → all your deals, tap to expand / load / delete
```

---

## Tabs

### 📋 Enter Deal
Four sub-sections: Property → Acquisition → Rental → Expenses  
Live scorecard updates as you type. All 5 filters shown in real time.

### 🤖 Paste Listing
Paste any MLS text, Zillow description, or Amanda's CSV row.  
Claude extracts address, zip, beds, year built, price, type, status.  
Hit **Use This** → populates the Enter Deal form automatically.

### 📂 Pipeline
All saved deals. Tap to expand key metrics.  
Load any deal back into the form for editing.  
Data stored in device localStorage (offline-capable).

---

## 5-Filter Scorecard

| # | Filter | Threshold |
|---|--------|-----------|
| 1 | Buy Box | Purchase ≤ 72% of ARV |
| 2 | DSCR | ≥ 1.20× (PITI-based) |
| 3 | Post-Refi CF | ≥ $200/month |
| 4 | Refi Gap | ≤ $15,000 shortfall |
| 5 | Stress Test | 75% occ · flat rents · ARV −10% — all 3 simultaneous |

---

## Target Markets (HUD FMR pre-loaded)

| Zip   | Market     | 3BR FMR  | PHA  |
|-------|------------|----------|------|
| 39211 | N. Jackson | $1,750   | JHA  |
| 39208 | Pearl      | $1,620   | MRHA |
| 39232 | Flowood    | $2,040   | MRHA |
| 39042 | Brandon    | $1,590   | MRHA |
| 39157 | Ridgeland  | $1,730   | MRHA |
| 39110 | Madison    | $2,310   | MRHA |

---

## Coming Next (Phase 2)
- Pre-Screen Filter (30-second pass/fail before full underwrite)
- HAP Coverage Check (HAP must cover PITI)
- Seller Finance Pitch Generator (auto-drafted outreach per deal)

---

## Local Dev (optional)
```bash
npm install
npm run dev
# App runs at http://localhost:5173
# API calls need Netlify CLI for local function testing:
# npm install -g netlify-cli
# netlify dev  (runs at http://localhost:8888)
```
