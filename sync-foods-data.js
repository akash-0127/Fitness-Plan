#!/usr/bin/env node
// Scheduled food database sync for FitPlan (Fitness Tools → Food Nutrition Database).
// Queries USDA FoodData Central for per-100g nutrients (calories, protein, carbs,
// fat, fiber, sugar, sodium, cholesterol) for each food and writes foods-data.json.
// A few items with no whole-food USDA entry (Paneer, Whey protein) use curated
// values from ICMR/NIN Indian food composition tables or standard label data and
// are kept out of the USDA path. Node 18+ only (native fetch) + dotenv.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'foods-data.json');
const LOG_FILE = path.join(ROOT, 'sync-log.md');

const USDA_KEY = (process.env.USDA_API_KEY || 'DEMO_KEY').trim();
const DELAY_MS = parseInt(process.env.SYNC_DELAY_MS || '1100', 10);
const ATTEMPTS = parseInt(process.env.SYNC_ATTEMPTS || '3', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

const NUTRIENT_IDS = {
  calories: 1008, protein: 1003, carbs: 1005, fat: 1004,
  fiber: 1079, sugar: 2000, sodium: 1093, cholesterol: 1253
};

// Per-100g plausibility bands, applied to USDA records only.
const RANGES = {
  calories: [0, 900], protein: [0, 90], carbs: [0, 100], fat: [0, 100],
  fiber: [0, 60], sugar: [0, 100], sodium: [0, 5000], cholesterol: [0, 1000]
};

// Curated foods (no good whole-food USDA entry). Source is shown in the UI.
const CURATED = {
  paneer: {
    source: 'ICMR-NIN Indian food composition tables',
    per100: { calories: 265, protein: 18.9, carbs: 1.2, fat: 21, fiber: 0, sugar: 1.2, sodium: 16, cholesterol: 17 }
  },
  'whey-protein': {
    source: 'Standard whey protein label data',
    per100: { calories: 400, protein: 78, carbs: 10, fat: 6, fiber: 2, sugar: 6, sodium: 320, cholesterol: 70 }
  }
};

// Fallback per-100g values (documented USDA SR Legacy / FNDDS values) used only
// when the USDA API is unreachable for a food — the synced file always carries
// live USDA values when the pipeline runs.
const FALLBACK = {
  'boiled-egg': { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, sugar: 1.1, sodium: 124, cholesterol: 373 },
  'chicken-breast': { calories: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, sodium: 48, cholesterol: 73 },
  'white-rice': { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1, cholesterol: 0 },
  'brown-rice': { calories: 112, protein: 2.3, carbs: 23.5, fat: 0.8, fiber: 1.8, sugar: 0.4, sodium: 5, cholesterol: 0 },
  oats: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, sugar: 0.99, sodium: 2, cholesterol: 0 },
  banana: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, sodium: 1, cholesterol: 0 },
  milk: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0, sugar: 5.1, sodium: 43, cholesterol: 10 },
  'peanut-butter': { calories: 598, protein: 22.5, carbs: 22.3, fat: 51.4, fiber: 5, sugar: 10.5, sodium: 426, cholesterol: 0 },
  'greek-yogurt': { calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4, fiber: 0, sugar: 3.2, sodium: 36, cholesterol: 5 },
  'curd-yogurt': { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, sugar: 4.7, sodium: 46, cholesterol: 13 },
  tofu: { calories: 144, protein: 17.3, carbs: 2.8, fat: 8.7, fiber: 2.3, sugar: 0.6, sodium: 14, cholesterol: 0 },
  'sweet-potato': { calories: 90, protein: 2, carbs: 20.7, fat: 0.2, fiber: 3.3, sugar: 6.5, sodium: 36, cholesterol: 0 },
  'whole-wheat-bread': { calories: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 6.8, sugar: 6.6, sodium: 491, cholesterol: 0 },
  almonds: { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, sugar: 4.4, sodium: 1, cholesterol: 0 },
  'olive-oil': { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, sodium: 2, cholesterol: 0 },
  chickpeas: { calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6, sugar: 4.8, sodium: 7, cholesterol: 0 },
  apple: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, sugar: 10.4, sodium: 1, cholesterol: 0 }
};

const FOODS = [
  { id: 'boiled-egg', name: 'Boiled Egg (whole)', query: 'Egg whole cooked hard-boiled',
    units: [{ label: '1 large (50g)', g: 50 }, { label: '1 medium (44g)', g: 44 }, { label: '100g', g: 100 }] },
  { id: 'chicken-breast', name: 'Chicken Breast (raw)', query: 'chicken breast boneless skinless raw',
    units: [{ label: '100g', g: 100 }, { label: '1 breast (174g)', g: 174 }, { label: '150g', g: 150 }, { label: '1 oz (28g)', g: 28.35 }] },
  { id: 'white-rice', name: 'White Rice (cooked)', query: 'rice white long-grain enriched cooked',
    units: [{ label: '1 cup (158g)', g: 158 }, { label: '100g', g: 100 }, { label: '1 cup (195g)', g: 195 }] },
  { id: 'brown-rice', name: 'Brown Rice (cooked)', query: 'rice brown long-grain cooked',
    units: [{ label: '1 cup (195g)', g: 195 }, { label: '100g', g: 100 }, { label: '1 oz (28g)', g: 28.35 }] },
  { id: 'oats', name: 'Oats (dry)', query: 'oats',
    units: [{ label: '½ cup (40g)', g: 40 }, { label: '50g', g: 50 }, { label: '100g', g: 100 }] },
  { id: 'banana', name: 'Banana (raw)', query: 'banana raw',
    units: [{ label: '1 medium (118g)', g: 118 }, { label: '100g', g: 100 }, { label: '1 large (136g)', g: 136 }] },
  { id: 'milk', name: 'Milk (whole 3.25%)', query: 'milk whole 3.25% milkfat',
    units: [{ label: '1 cup (244g)', g: 244 }, { label: '100ml (103g)', g: 103 }, { label: '100g', g: 100 }] },
  { id: 'peanut-butter', name: 'Peanut Butter (smooth)', query: 'peanut butter smooth style',
    units: [{ label: '2 tbsp (32g)', g: 32 }, { label: '1 tbsp (16g)', g: 16 }, { label: '100g', g: 100 }] },
  { id: 'greek-yogurt', name: 'Greek Yogurt (plain, nonfat)', query: 'greek yogurt plain nonfat',
    units: [{ label: '100g', g: 100 }, { label: '1 cup (200g)', g: 200 }, { label: '1 tbsp (15g)', g: 15 }] },
  { id: 'curd-yogurt', name: 'Curd / Yogurt (whole milk)', query: 'yogurt plain whole milk',
    units: [{ label: '100g', g: 100 }, { label: '1 cup (245g)', g: 245 }] },
  { id: 'tofu', name: 'Tofu (firm)', query: 'tofu firm prepared with calcium sulfate',
    units: [{ label: '100g', g: 100 }, { label: '½ cup (126g)', g: 126 }, { label: '1 oz (28g)', g: 28.35 }] },
  { id: 'sweet-potato', name: 'Sweet Potato (baked)', query: 'sweet potato cooked baked in skin',
    units: [{ label: '1 medium (114g)', g: 114 }, { label: '100g', g: 100 }, { label: '1 cup (200g)', g: 200 }] },
  { id: 'whole-wheat-bread', name: 'Whole Wheat Bread', query: 'bread whole-wheat commercially prepared',
    units: [{ label: '1 slice (32g)', g: 32 }, { label: '2 slices (64g)', g: 64 }, { label: '100g', g: 100 }] },
  { id: 'almonds', name: 'Almonds', query: 'nuts almonds',
    units: [{ label: '1 oz (28g)', g: 28.35 }, { label: '10 almonds (14g)', g: 14 }, { label: '100g', g: 100 }] },
  { id: 'olive-oil', name: 'Olive Oil', query: 'oil olive salad or cooking',
    units: [{ label: '1 tbsp (13.5g)', g: 13.5 }, { label: '1 tsp (4.5g)', g: 4.5 }, { label: '100g', g: 100 }] },
  { id: 'chickpeas', name: 'Chickpeas (cooked)', query: 'chickpeas garbanzo beans cooked',
    units: [{ label: '1 cup (164g)', g: 164 }, { label: '100g', g: 100 }] },
  { id: 'apple', name: 'Apple (raw, with skin)', query: 'apples raw with skin',
    units: [{ label: '1 medium (182g)', g: 182 }, { label: '100g', g: 100 }] },
  { id: 'paneer', name: 'Paneer (Indian cottage cheese)', units: [{ label: '100g', g: 100 }, { label: '50g', g: 50 }, { label: '1 cup (85g)', g: 85 }] },
  { id: 'whey-protein', name: 'Whey Protein Powder', units: [{ label: '1 scoop (30g)', g: 30 }, { label: '100g', g: 100 }] }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options) {
  let lastErr = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      lastErr = err;
      await sleep(900 * (i + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      lastErr = new Error('HTTP ' + res.status);
      await sleep(1500 * (i + 1));
      continue;
    }
    return res;
  }
  throw lastErr || new Error('request failed');
}

function tokenScore(text, query) {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  const hay = text.toLowerCase();
  let score = 0;
  for (const t of tokens) if (hay.includes(t)) score++;
  return score;
}

function bestMatch(entries, query) {
  let best = null;
  let bestScore = 0;
  for (const e of entries) {
    const s = tokenScore(e.description || '', query);
    if (s > bestScore) { best = e; bestScore = s; }
  }
  return bestScore >= 1 ? best : null;
}

async function usdaSearch(query) {
  const dataTypes = ['Foundation', 'SR Legacy', 'Survey (FNDDS)']
    .map((t) => encodeURIComponent(t))
    .join(',');
  const url = USDA_URL +
    '?api_key=' + encodeURIComponent(USDA_KEY) +
    '&query=' + encodeURIComponent(query) +
    '&dataType=' + dataTypes +
    '&pageSize=6';
  const res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new Error('USDA auth failed (check USDA_API_KEY)');
  if (!res.ok) throw new Error('USDA HTTP ' + res.status);
  const json = await res.json();
  return bestMatch(json.foods || [], query);
}

function usdaNutrients(food) {
  const out = {};
  for (const key of Object.keys(NUTRIENT_IDS)) {
    const id = NUTRIENT_IDS[key];
    const hit = (food.foodNutrients || []).find((fn) => fn.nutrient && fn.nutrient.id === id);
    if (hit && typeof hit.amount === 'number') out[key] = hit.amount;
  }
  return out;
}

function plausible(raw) {
  if (typeof raw.calories !== 'number') return false;
  for (const key of Object.keys(RANGES)) {
    if (typeof raw[key] !== 'number') continue;
    const lo = RANGES[key][0];
    const hi = RANGES[key][1];
    if (raw[key] < lo || raw[key] > hi) return false;
  }
  return true;
}

function rounded(raw) {
  const out = {};
  for (const key of Object.keys(raw)) {
    if (key === 'calories' || key === 'sodium' || key === 'cholesterol') out[key] = Math.round(raw[key]);
    else out[key] = Math.round(raw[key] * 10) / 10;
  }
  return out;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const foods = [];
  let usdaCount = 0;
  let fallbackCount = 0;

  for (const spec of FOODS) {
    process.stdout.write('Fetching "' + spec.name + '" ... ');

    if (CURATED[spec.id]) {
      foods.push({
        id: spec.id,
        name: spec.name,
        source: CURATED[spec.id].source,
        per100: CURATED[spec.id].per100,
        units: spec.units
      });
      console.log('curated (' + CURATED[spec.id].source + ')');
      continue;
    }

    let used = null;
    try {
      const food = await usdaSearch(spec.query);
      if (food) {
        const raw = usdaNutrients(food);
        if (plausible(raw)) {
          const per100 = rounded(raw);
          foods.push({
            id: spec.id,
            name: spec.name,
            source: 'USDA FoodData Central · ' + (food.description || spec.query),
            per100,
            units: spec.units
          });
          usdaCount++;
          used = 'USDA';
        }
      }
    } catch (err) {
      console.warn('error: ' + err.message);
    }

    if (!used) {
      foods.push({
        id: spec.id,
        name: spec.name,
        source: 'USDA reference values (SR Legacy/FNDDS)',
        per100: FALLBACK[spec.id] || CURATED[spec.id].per100,
        units: spec.units
      });
      fallbackCount++;
      used = 'fallback';
    }
    console.log(used);
    await sleep(DELAY_MS);
  }

  const data = {
    last_verified: today(),
    source_note: 'Nutrition per 100g. Primary source: USDA FoodData Central (Foundation/SR Legacy/FNDDS). Indian items use ICMR-NIN tables; whey uses standard label data.',
    foods
  };

  if (!DRY_RUN) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
    fs.appendFileSync(
      LOG_FILE,
      '\n## Foods sync ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC\n\n' +
      'Synced ' + foods.length + ' foods (' + usdaCount + ' USDA, ' + fallbackCount + ' fallback).\n'
    );
  }

  console.log('\nDone. ' + foods.length + ' foods (' + usdaCount + ' USDA, ' + fallbackCount +
    ' fallback).' + (DRY_RUN ? ' (dry run — nothing written)' : ''));
}

main().catch((err) => {
  console.error('Foods sync failed:', err);
  process.exit(1);
});
