#!/usr/bin/env node
// Scheduled nutrition data sync for FitPlan.
// Reads current nutrition-data.json, queries USDA FoodData Central for each
// food item, falls back to Open Food Facts for Indian/branded items, and only
// updates a value when the verified source differs by more than the threshold.
// Writes updated JSON (fresh last_verified) and appends a summary to sync-log.md.
// Node 18+ only (native fetch) + dotenv.

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'nutrition-data.json');
const LOG_FILE = path.join(ROOT, 'sync-log.md');

const USDA_KEY = (process.env.USDA_API_KEY || '').trim();
const THRESHOLD = parseFloat(process.env.SYNC_THRESHOLD || '0.15');
const DELAY_MS = parseInt(process.env.SYNC_DELAY_MS || '800', 10);
const ATTEMPTS = parseInt(process.env.SYNC_ATTEMPTS || '3', 10);
const DRY_RUN = process.argv.includes('--dry-run');

const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const OFF_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

const FIELD_NAMES = { p: 'protein g', c: 'carbs g', f: 'fat g', k: 'kcal' };
const USDA_NUTRIENT_IDS = { p: 1003, f: 1004, c: 1005, k: 1008 };

// Known search query per item name (item names are the stable key).
const QUERY = {
  'Chicken breast (grilled)': 'chicken breast grilled',
  'Eggs (whole)': 'whole egg raw',
  'Egg whites': 'egg white raw',
  'Fish (rohu/tilapia)': 'tilapia raw',
  'Tuna (canned in water)': 'tuna canned in water',
  'Paneer': 'paneer',
  'Curd/Yogurt': 'plain yogurt',
  'Tofu (firm)': 'firm tofu',
  'Toor/Masoor dal (cooked)': 'pigeon peas cooked',
  'Rajma (cooked)': 'kidney beans cooked',
  'Chana/Chickpea (cooked)': 'chickpeas cooked',
  'Moong dal (cooked)': 'mung beans cooked',
  'Greek yogurt': 'greek yogurt plain',
  'Tempeh': 'tempeh',
  'Edamame': 'edamame',
  'Brown rice (cooked 150g)': 'brown rice cooked',
  'White rice (cooked 150g)': 'white rice cooked',
  'Roti (2 medium, ~70g)': 'roti',
  'Oats (dry 50g)': 'oats',
  'Sweet potato (150g, boiled)': 'sweet potato cooked',
  'Banana (1 medium, 120g)': 'banana raw',
  'Whole wheat bread (2 slices)': 'whole wheat bread',
  'Poha (cooked 150g)': 'poha flattened rice',
  'Upma (cooked 150g)': 'upma semolina',
  'Makhana (30g)': 'fox nuts',
  'Roasted chana (30g)': 'roasted chickpeas',
  'Quinoa (cooked 150g)': 'quinoa cooked',
  'Almonds (20g)': 'almonds',
  'Walnuts (20g)': 'walnuts',
  'Peanut butter (15g)': 'peanut butter',
  'Ghee (1 tsp, 5g)': 'ghee butter oil',
  'Olive oil (1 tsp, 5g)': 'olive oil',
  'Coconut oil (1 tsp, 5g)': 'coconut oil',
  'Avocado (50g)': 'avocado'
};

// Items with no good USDA entry (Indian dishes/ingredients). These are the only
// items that fall back to Open Food Facts; every other item uses USDA and keeps
// its current value when USDA has no match.
const SKIP_USDA = new Set([
  'Paneer', 'Makhana (30g)', 'Poha (cooked 150g)',
  'Upma (cooked 150g)', 'Roti (2 medium, ~70g)'
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry transient failures (Open Food Facts rate-limits with 503/429).
async function fetchWithRetry(url, options) {
  let lastErr = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      lastErr = err;
      await sleep(800 * (i + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      lastErr = new Error('HTTP ' + res.status);
      await sleep(800 * (i + 1));
      continue;
    }
    return res;
  }
  throw lastErr || new Error('request failed');
}

// Reject obviously inconsistent records (e.g. energy not matching macros) so a
// malformed source never overwrites good data.
function consistent(macros) {
  if (typeof macros.p === 'number' && typeof macros.c === 'number' &&
      typeof macros.f === 'number' && typeof macros.k === 'number') {
    const est = macros.p * 4 + macros.c * 4 + macros.f * 9;
    return Math.abs(est - macros.k) <= Math.max(30, macros.k * 0.25);
  }
  return true;
}

// Plausibility band for per-100g values, applied BEFORE serving scaling. Blocks
// grossly wrong Open Food Facts entries (wrong product or wrong units) without
// ever rejecting legitimate USDA records.
const PER_100G_RANGES = { p: [0, 50], c: [0, 95], f: [0, 100], k: [15, 900] };

function plausible(raw) {
  for (const key of Object.keys(PER_100G_RANGES)) {
    if (typeof raw[key] !== 'number') continue;
    const lo = PER_100G_RANGES[key][0];
    const hi = PER_100G_RANGES[key][1];
    if (raw[key] < lo || raw[key] > hi) return false;
  }
  return Object.keys(raw).length >= 3;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Serving size is embedded in the item name (e.g. "Oats (dry 50g)" = 50g serving,
// "Whole wheat bread (2 slices)" ~ 60g). Protein items are per 100g raw. Returns a
// multiplier to convert per-100g source values to the item's serving basis.
function servingFactor(name) {
  let grams = null;
  let m = name.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (m) {
    grams = parseFloat(m[1]);
  } else {
    m = name.match(/(\d+)\s*slices?/i);
    if (m) grams = parseInt(m[1], 10) * 30;
  }
  return grams == null ? 1 : grams / 100;
}

function cleanName(name) {
  let s = name.toLowerCase();
  s = s.replace(/\(.*?\)/g, ' ');
  s = s.replace(/\d+(?:\.\d+)?\s*(?:g|gms|grams?|kg|tsp|tbsp|slices?|cups?|medium|large|small)\b/gi, ' ');
  s = s.replace(/[~,]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function tokenScore(text, query) {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  const hay = text.toLowerCase();
  let score = 0;
  for (const t of tokens) if (hay.includes(t)) score++;
  return score;
}

function bestMatch(entries, query, textOf) {
  let best = null;
  let bestScore = 0;
  for (const e of entries) {
    const s = tokenScore(textOf(e), query);
    if (s > bestScore) {
      best = e;
      bestScore = s;
    }
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
    '&pageSize=8';
  const res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new Error('USDA auth failed (check USDA_API_KEY)');
  if (!res.ok) throw new Error('USDA HTTP ' + res.status);
  const json = await res.json();
  const foods = json.foods || [];
  return bestMatch(foods, query, (f) => f.description || '');
}

function usdaMacros(food) {
  const out = {};
  for (const key of Object.keys(USDA_NUTRIENT_IDS)) {
    const id = USDA_NUTRIENT_IDS[key];
    const hit = (food.foodNutrients || []).find((fn) => fn.nutrient && fn.nutrient.id === id);
    if (hit && typeof hit.amount === 'number') out[key] = hit.amount;
  }
  return out;
}

function identityToken(query) {
  const toks = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  return toks.length ? toks[0] : null;
}

// State/processing words pollute Open Food Facts search ("raw"/"grilled" match
// protein bars and ready meals). Search the base ingredient instead.
const OFF_STATE_WORDS = new Set([
  'raw', 'cooked', 'grilled', 'boiled', 'roasted', 'baked', 'fried',
  'steamed', 'sauteed', 'sauted', 'fresh', 'toasted'
]);

function offQueryFor(item) {
  const q = (QUERY[item.n] || cleanName(item.n)).split(' ').filter(Boolean);
  while (q.length && OFF_STATE_WORDS.has(q[q.length - 1])) q.pop();
  return q.join(' ');
}

async function offSearch(query) {
  const url = OFF_URL +
    '?action=process&search_terms=' + encodeURIComponent(query) +
    '&json=1&page_size=8&fields=product_name,product_name_en,nutriments';
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'FitPlanNutritionSync/1.0 (fitplan nutrition data sync)' }
  });
  if (!res.ok) throw new Error('OFF HTTP ' + res.status);
  const json = await res.json();
  const products = json.products || [];
  // Trust OFF's relevance ordering, but only accept a product whose name shares
  // the query's identity token — avoids the API surfacing irrelevant brands first.
  const idTok = identityToken(query);
  if (idTok) {
    for (const p of products) {
      const name = (p.product_name || p.product_name_en || '').toLowerCase();
      if (name.includes(idTok)) return p;
    }
  }
  return bestMatch(products, query, (p) => p.product_name || p.product_name_en || '');
}

function offMacros(product) {
  const n = product.nutriments || {};
  const out = {};
  if (typeof n.proteins_100g === 'number') out.p = n.proteins_100g;
  if (typeof n.fat_100g === 'number') out.f = n.fat_100g;
  if (typeof n.carbohydrates_100g === 'number') out.c = n.carbohydrates_100g;
  if (typeof n['energy-kcal_100g'] === 'number') out.k = n['energy-kcal_100g'];
  else if (typeof n.energy_100g === 'number') out.k = n.energy_100g / 4.184;
  return out;
}

function scaleToServing(raw, factor) {
  const out = {};
  for (const key of ['p', 'c', 'f', 'k']) {
    if (typeof raw[key] === 'number') out[key] = raw[key] * factor;
  }
  return out;
}

async function verifyItem(item) {
  const query = QUERY[item.n] || cleanName(item.n);
  const factor = servingFactor(item.n);

  if (USDA_KEY && !SKIP_USDA.has(item.n)) {
    try {
      const food = await usdaSearch(query);
      if (food) {
        const raw = usdaMacros(food);
        const scaled = scaleToServing(raw, factor);
        if (plausible(raw) && consistent(scaled)) return { macros: scaled, source: 'USDA' };
      }
    } catch (err) {
      console.warn('  USDA error for "' + item.n + '": ' + err.message);
    }
  }

  // Open Food Facts is user-submitted and noisy — it can silently corrupt good
  // values (cooked vs dry densities, branded products). Restrict it to the
  // Indian/branded items in SKIP_USDA that USDA cannot cover; standard
  // ingredients simply keep their current value when USDA has no match.
  if (SKIP_USDA.has(item.n)) {
    try {
      const product = await offSearch(offQueryFor(item));
      if (product) {
        const raw = offMacros(product);
        const scaled = scaleToServing(raw, factor);
        if (plausible(raw) && consistent(scaled)) return { macros: scaled, source: 'Open Food Facts' };
      }
    } catch (err) {
      console.warn('  Open Food Facts error for "' + item.n + '": ' + err.message);
    }
  }

  return { macros: null, source: null };
}

function diff(item, macros) {
  const changes = {};
  for (const key of ['p', 'c', 'f', 'k']) {
    if (typeof macros[key] !== 'number') continue;
    const oldVal = typeof item[key] === 'number' ? item[key] : null;
    const newVal = Math.round(macros[key] * 10) / 10;
    if (oldVal === null) {
      changes[key] = newVal;
      continue;
    }
    if (oldVal === 0) {
      if (newVal > 0) changes[key] = newVal;
      continue;
    }
    if (Math.abs(newVal - oldVal) > Math.abs(oldVal) * THRESHOLD) changes[key] = newVal;
  }
  return changes;
}

function appendLog(changes, sourcesUsed, syncedCount) {
  let text = '\n## Sync ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC\n\n';
  text += 'Verified ' + syncedCount + ' items (sources: ' +
    (sourcesUsed.length ? sourcesUsed.join(', ') : 'none reachable') +
    ') · threshold ' + Math.round(THRESHOLD * 100) + '%\n';
  if (changes.length === 0) {
    text += '\nNo changes this run.\n';
  } else {
    for (const c of changes) {
      text += '\n- ' + c.name + ' [' + FIELD_NAMES[c.key] + ']: ' + c.old + ' -> ' + c.next + ' (' + c.source + ')';
    }
    text += '\n';
  }
  fs.appendFileSync(LOG_FILE, text);
}

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('nutrition-data.json not found at ' + DATA_FILE);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!data.PROTEINS || !Array.isArray(data.CARBS) || !Array.isArray(data.FATS)) {
    console.error('nutrition-data.json is malformed (expected PROTEINS, CARBS, FATS)');
    process.exit(1);
  }

  const items = [];
  for (const group of ['nonveg', 'veg', 'vegan']) {
    for (let i = 0; i < data.PROTEINS[group].length; i++) {
      items.push({ group, index: i, item: data.PROTEINS[group][i] });
    }
  }
  for (let i = 0; i < data.CARBS.length; i++) items.push({ index: i, item: data.CARBS[i] });
  for (let i = 0; i < data.FATS.length; i++) items.push({ index: i, item: data.FATS[i] });

  if (!USDA_KEY) console.warn('WARN: USDA_API_KEY not set — using Open Food Facts only.');

  const changes = [];
  const sourcesUsed = new Set();
  let syncedCount = 0;

  for (const t of items) {
    process.stdout.write('Checking "' + t.item.n + '" ... ');
    const { macros, source } = await verifyItem(t.item);
    if (!macros || !source) {
      console.log('skipped (no source match)');
      await sleep(DELAY_MS);
      continue;
    }
    console.log(source);
    syncedCount++;
    sourcesUsed.add(source);
    const d = diff(t.item, macros);
    for (const key of Object.keys(d)) {
      changes.push({ name: t.item.n, key, old: t.item[key], next: d[key], source });
      t.item[key] = d[key];
    }
    await sleep(DELAY_MS);
  }

  data.last_verified = today();

  if (!DRY_RUN) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
    appendLog(changes, Array.from(sourcesUsed), syncedCount);
  }

  console.log('\nDone. Verified ' + syncedCount + ' items, ' + changes.length + ' value change(s).' +
    (DRY_RUN ? ' (dry run — nothing written)' : ''));
  for (const c of changes) {
    console.log('  ' + c.name + ' [' + FIELD_NAMES[c.key] + ']: ' + c.old + ' -> ' + c.next + ' (' + c.source + ')');
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
