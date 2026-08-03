/* FitPlan Fitness Tools — application layer.
   Tool registry + UI wiring + Food Nutrition Database + Meal Builder.
   Pure math lives in formulas.js (FitFormulas). */

(function () {
  'use strict';

  var F = window.FitFormulas;
  var esc = function (s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var el = function (id) { return document.getElementById(id); };

  /* ================= categories ================= */

  var CATS = [
    { id: 'all', label: 'All Tools' },
    { id: 'body', label: 'Body Analysis' },
    { id: 'weight', label: 'Weight Goal' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'workout', label: 'Workout Tools' },
    { id: 'health', label: 'Health Tools' },
    { id: 'food', label: 'Food & Meal' }
  ];

  /* ================= shared input schema ================= */

  var I = {
    weight: { kind: 'weight' },
    height: { kind: 'height' },
    age: { key: 'age', label: 'Age', type: 'number', min: 10, max: 120, unit: 'years' },
    sex: { key: 'sex', label: 'Sex', type: 'select', options: [{ v: 'male', label: 'Male' }, { v: 'female', label: 'Female' }] },
    activity: {
      key: 'activity', label: 'Activity level', type: 'select',
      options: Object.keys(F.ACTIVITY).map(function (k) { return { v: k, label: F.ACTIVITY[k].label }; })
    },
    weightKg: { key: 'weightKg', label: 'Weight', type: 'number', min: 20, max: 350, unit: 'kg' },
    heightCm: { key: 'heightCm', label: 'Height', type: 'number', min: 100, max: 260, unit: 'cm' }
  };

  var SEX = I.sex.options;
  var GOAL_OPTIONS = [
    { v: 'maintenance', label: 'Maintenance' },
    { v: 'fat-loss', label: 'Fat Loss' },
    { v: 'muscle-gain', label: 'Muscle Gain' },
    { v: 'recomp', label: 'Body Recomposition' }
  ];

  function fmtKgLb(kg, units) {
    return units === 'imperial' ? F.kgToLb(kg) : kg;
  }
  function kgUnit(units) { return units === 'imperial' ? 'lb' : 'kg'; }

  /* ================= tool registry ================= */

  var TOOLS = [];

  function define(t) { TOOLS.push(t); return t; }

  var activityMeta = function (metKey) { return F.MET[metKey]; };

  define({
    id: 'bmi', cat: 'body', icon: 'scale', featured: true,
    name: 'BMI Calculator', desc: 'Body Mass Index with WHO weight classification.',
    formula: 'BMI = weight (kg) ÷ height (m)² — WHO standard',
    inputs: [I.weight, I.height],
    calc: function (v, units) {
      var m = F.metric(v, units);
      if (!m) return { error: 'Enter a valid weight and height.' };
      var bmi = F.bmi(m.weightKg, m.heightCm);
      var cat = F.bmiCategory(bmi);
      var rng = F.healthyWeightRange(m.heightCm);
      var lo = F.round(fmtKgLb(rng[0], units), 0), hi = F.round(fmtKgLb(rng[1], units), 0);
      return {
        main: { value: F.fmt(bmi, 1), label: cat.label, tone: cat.tone },
        stats: [
          { label: 'Healthy weight range', value: lo + ' – ' + hi + ' ' + kgUnit(units) },
          { label: 'Weight status', value: cat.label, tone: cat.tone },
          { label: 'Height', value: F.metric_ ? '—' : (units === 'imperial' ? F.fmt(m.heightCm / 2.54, 1) + ' in' : F.fmt(m.heightCm, 0) + ' cm') }
        ],
        gauge: {
          min: 15, max: 40, value: bmi, unit: 'BMI',
          zones: [
            { from: 15, to: 18.5, tone: 'blue' }, { from: 18.5, to: 25, tone: 'green' },
            { from: 25, to: 30, tone: 'orange' }, { from: 30, to: 40, tone: 'red' }
          ]
        },
        formula: 'BMI = ' + F.fmt(m.weightKg, 1) + ' ÷ ' + F.fmt(m.heightCm / 100, 2) + '² = ' + F.fmt(bmi, 1),
        explanation: 'BMI is a simple height-to-weight ratio used by the WHO to screen for weight categories. It does not directly measure body fat, so athletes with high muscle mass may read "overweight" while remaining lean.',
        tips: [
          'Use waist-to-height and body fat tools alongside BMI for a fuller picture.',
          'A healthy range for your height is ' + lo + '–' + hi + ' ' + kgUnit(units) + '.',
          'Aim to lose or gain weight gradually with an adjustable diet plan.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  define({
    id: 'bmr', cat: 'body', icon: 'activity', featured: false,
    name: 'BMR Calculator', desc: 'Basal Metabolic Rate via the Mifflin-St Jeor equation.',
    formula: 'Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + (5 male / −161 female)',
    inputs: [I.weight, I.height, I.age, I.sex],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var age = parseFloat(v.age), sex = v.sex;
      if (!m || !isFinite(age)) return { error: 'Enter a valid weight, height, age and sex.' };
      var bmr = F.bmr(m.weightKg, m.heightCm, age, sex);
      return {
        main: { value: F.fmt(bmr, 0) + ' kcal', label: 'resting calories per day' },
        stats: [
          { label: 'Per kg bodyweight', value: F.fmt(bmr / m.weightKg, 1) + ' kcal' },
          { label: 'Body weight', value: F.fmt(fmtKgLb(m.weightKg, units), 1) + ' ' + kgUnit(units) }
        ],
        formula: 'BMR = 10×' + F.fmt(m.weightKg, 0) + ' + 6.25×' + F.fmt(m.heightCm, 0) + ' − 5×' + age + (sex === 'female' ? ' − 161' : ' + 5'),
        explanation: 'BMR is the energy your body needs at complete rest to keep organs functioning. It is the baseline your daily calorie target is built from — you should rarely eat below your BMR.',
        tips: [
          'BMR drops slightly with age, so recalculate every few years.',
          'Muscle is metabolically active — resistance training raises BMR over time.',
          'Combine with the TDEE tool for a maintenance calorie target.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  define({
    id: 'tdee', cat: 'body', icon: 'gauge', featured: true,
    name: 'TDEE Calculator', desc: 'Total daily energy expenditure — maintenance calories.',
    formula: 'TDEE = BMR × activity multiplier (Mifflin-St Jeor)',
    inputs: [I.weight, I.height, I.age, I.sex, I.activity],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var age = parseFloat(v.age);
      if (!m || !isFinite(age) || !v.activity) return { error: 'Enter valid inputs including activity level.' };
      var bmr = F.bmr(m.weightKg, m.heightCm, age, v.sex);
      var tdee = F.tdee(bmr, v.activity);
      return {
        main: { value: F.fmt(tdee, 0) + ' kcal', label: 'maintenance calories per day' },
        stats: [
          { label: 'BMR', value: F.fmt(bmr, 0) + ' kcal' },
          { label: 'Activity multiplier', value: '× ' + F.ACTIVITY[v.activity].mult },
          { label: 'Fat loss (−500 kcal)', value: F.fmt(tdee - 500, 0) + ' kcal' },
          { label: 'Muscle gain (+300 kcal)', value: F.fmt(tdee + 300, 0) + ' kcal' }
        ],
        formula: 'TDEE = ' + F.fmt(bmr, 0) + ' × ' + F.ACTIVITY[v.activity].mult + ' = ' + F.fmt(tdee, 0),
        explanation: 'TDEE is your true daily burn: BMR plus movement, exercise and digestion. Eating at this number holds your weight steady; a deficit or surplus shifts it in either direction.',
        tips: [
          'Track your weight for 2 weeks at maintenance to personalise the number.',
          'Re-calculate TDEE every ~5 kg of bodyweight change.',
          'Use the Macro Split tool to turn TDEE into protein, fat and carbs.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  define({
    id: 'body-fat', cat: 'body', icon: 'ruler', featured: false,
    name: 'Body Fat Percentage', desc: 'U.S. Navy method from simple tape measurements.',
    formula: 'U.S. Navy circumference method (log10)',
    inputs: [I.sex, I.weight, I.height,
      { key: 'waist', label: 'Waist', type: 'number', min: 30, max: 300, unit: 'auto', measure: true },
      { key: 'neck', label: 'Neck', type: 'number', min: 10, max: 150, unit: 'auto', measure: true },
      { key: 'hip', label: 'Hip (women only)', type: 'number', min: 30, max: 300, unit: 'auto', measure: true, showIf: 'female' }
    ],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var inPerUnit = units === 'imperial' ? 1 : 1 / 2.54;
      var waist = parseFloat(v.waist) * inPerUnit;
      var neck = parseFloat(v.neck) * inPerUnit;
      var heightIn = m.heightCm / 2.54;
      if (!m || !isFinite(waist) || !isFinite(neck)) return { error: 'Enter a valid weight, height, waist and neck.' };
      var hip = v.sex === 'female' ? (isFinite(parseFloat(v.hip)) ? parseFloat(v.hip) * inPerUnit : NaN) : 0;
      if (v.sex === 'female' && !isFinite(hip)) return { error: 'Hip measurement is required for women.' };
      if (v.sex === 'male' && waist <= neck) return { error: 'Waist must be larger than neck for this method.' };
      var bf = F.navyBodyFat(v.sex, waist, neck, hip, heightIn);
      var cat = F.bodyFatCategory(v.sex, bf);
      var fatMass = m.weightKg * bf / 100;
      var lbm = m.weightKg - fatMass;
      return {
        main: { value: F.fmt(bf, 1) + '%', label: 'estimated body fat', tone: cat.tone },
        stats: [
          { label: 'Category', value: cat.label, tone: cat.tone },
          { label: 'Fat mass', value: F.fmt(fmtKgLb(fatMass, units), 1) + ' ' + kgUnit(units) },
          { label: 'Lean mass', value: F.fmt(fmtKgLb(lbm, units), 1) + ' ' + kgUnit(units) }
        ],
        gauge: {
          min: 3, max: 45, value: bf, unit: '%',
          zones: [
            { from: 3, to: 14, tone: 'blue' }, { from: 14, to: 25, tone: 'green' },
            { from: 25, to: 32, tone: 'orange' }, { from: 32, to: 45, tone: 'red' }
          ]
        },
        formula: 'U.S. Navy: ' + (v.sex === 'female' ? '163.205·log₁₀(waist+hip−neck) − 97.684·log₁₀(height) − 78.387' : '86.010·log₁₀(waist−neck) − 70.041·log₁₀(height) + 36.76'),
        explanation: 'The U.S. Navy method estimates body fat from circumference measurements — it is within a few percent of DEXA for most people. Consistency in measuring matters more than absolute precision.',
        tips: [
          'Measure first thing in the morning, tape level and snug, not compressed.',
          'Take 3 measurements and average them for stability.',
          'Re-test monthly — changes beat absolute accuracy.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  define({
    id: 'lbm', cat: 'body', icon: 'user-round', featured: false,
    name: 'Lean Body Mass', desc: 'How much of you is muscle, bone and water.',
    formula: 'LBM = weight × (1 − body fat %)',
    inputs: [I.weight, { key: 'bodyFat', label: 'Body fat', type: 'number', min: 2, max: 60, unit: '%' }],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var bf = parseFloat(v.bodyFat);
      if (!m || !isFinite(bf)) return { error: 'Enter a valid weight and body fat.' };
      var lbm = F.lbm(m.weightKg, bf);
      var fatMass = m.weightKg - lbm;
      return {
        main: { value: F.fmt(fmtKgLb(lbm, units), 1) + ' ' + kgUnit(units), label: 'lean body mass' },
        stats: [
          { label: 'Fat mass', value: F.fmt(fmtKgLb(fatMass, units), 1) + ' ' + kgUnit(units) },
          { label: 'Body fat', value: F.fmt(bf, 1) + '%' },
          { label: 'Total weight', value: F.fmt(fmtKgLb(m.weightKg, units), 1) + ' ' + kgUnit(units) }
        ],
        bars: [
          { label: 'Lean mass', pct: Math.round((lbm / m.weightKg) * 100), color: 'var(--accent)' },
          { label: 'Fat mass', pct: Math.round((fatMass / m.weightKg) * 100), color: 'var(--orange)' }
        ],
        formula: 'LBM = ' + F.fmt(m.weightKg, 0) + ' × (1 − ' + F.fmt(bf, 0) + '%) = ' + F.fmt(fmtKgLb(lbm, units), 1) + ' ' + kgUnit(units),
        explanation: 'Lean body mass is everything except fat: muscle, bones, organs and water. Preserving LBM while losing weight is the key to a healthy recomposition.',
        tips: [
          'High protein (1.6–2.2 g/kg) protects LBM during a deficit.',
          'Resistance training signals your body to keep muscle.',
          'Re-measure monthly to confirm LBM is stable.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  define({
    id: 'ffmi', cat: 'body', icon: 'dumbbell', featured: false,
    name: 'FFMI Calculator', desc: 'Fat-free mass index — muscle status vs. height.',
    formula: 'FFMI = lean mass (kg) ÷ height (m)²',
    inputs: [I.weight, I.height, { key: 'bodyFat', label: 'Body fat', type: 'number', min: 2, max: 60, unit: '%' }],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var bf = parseFloat(v.bodyFat);
      if (!m || !isFinite(bf)) return { error: 'Enter a valid weight, height and body fat.' };
      var lbm = F.lbm(m.weightKg, bf);
      var ffmi = F.ffmi(lbm, m.heightCm);
      var adj = F.ffmiAdjusted(ffmi, m.heightCm);
      var note = adj < 18 ? 'Average build' : adj < 20 ? 'Above average' : adj < 22 ? 'Good muscle' : adj < 23 ? 'Very good' : 'Elite / exceptional';
      return {
        main: { value: F.fmt(ffmi, 2), label: note, tone: adj >= 23 ? 'gold' : adj >= 20 ? 'green' : 'blue' },
        stats: [
          { label: 'Adjusted FFMI (1.8 m)', value: F.fmt(adj, 2) },
          { label: 'Lean body mass', value: F.fmt(fmtKgLb(lbm, units), 1) + ' ' + kgUnit(units) },
          { label: 'Body fat', value: F.fmt(bf, 1) + '%' }
        ],
        formula: 'FFMI = ' + F.fmt(lbm, 1) + ' ÷ ' + F.fmt(m.heightCm / 100, 2) + '² = ' + F.fmt(ffmi, 2),
        explanation: 'FFMI normalises lean mass for height, like BMI does for total weight. It tracks how much muscle you carry. Values above ~25 are rare without pharmacological help.',
        tips: [
          'Focus on trends over months, not week-to-week noise.',
          'FFMI rises slowly with consistent training — be patient.',
          'Pair with the LBM tool to separate muscle from fat changes.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  define({
    id: 'ideal-weight', cat: 'body', icon: 'target', featured: false,
    name: 'Ideal Weight Calculator', desc: 'Devine formula plus a healthy BMI range.',
    formula: 'Devine: 50 + 2.3·(in − 60) male · 45.5 + 2.3·(in − 60) female',
    inputs: [I.height, I.sex],
    calc: function (v, units) {
      var m = F.metric(v, units);
      if (!m) return { error: 'Enter a valid height.' };
      var inches = m.heightCm / 2.54;
      var idealKg = F.devineIdeal(v.sex, inches);
      var rng = F.healthyWeightRange(m.heightCm);
      return {
        main: { value: F.fmt(fmtKgLb(idealKg, units), 0) + ' ' + kgUnit(units), label: 'Devine ideal weight' },
        stats: [
          { label: 'Healthy BMI range', value: F.fmt(fmtKgLb(rng[0], units), 0) + ' – ' + F.fmt(fmtKgLb(rng[1], units), 0) + ' ' + kgUnit(units) },
          { label: 'Sex formula', value: v.sex === 'female' ? 'Female base 45.5 kg' : 'Male base 50 kg' }
        ],
        gauge: {
          min: 0, max: 1, value: 0, unit: '', zones: [],
          range: { lo: fmtKgLb(rng[0], units), hi: fmtKgLb(rng[1], units) }
        },
        formula: 'Devine = ' + (v.sex === 'female' ? '45.5' : '50') + ' + 2.3 × (' + F.fmt(inches, 0) + ' − 60) = ' + F.fmt(fmtKgLb(idealKg, units), 0),
        explanation: 'The Devine formula gives a single "ideal" weight while the healthy BMI range (18.5–24.9) is a broader, healthier target. Most people are better served by a target within the range than a single number.',
        tips: [
          'Pick a target inside the healthy range based on your build.',
          'Muscular individuals can exceed ideal weight healthily.',
          'Aim to reach your target gradually — see the Weight Loss planner.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  define({
    id: 'healthy-weight', cat: 'body', icon: 'shield-check', featured: false,
    name: 'Healthy Weight Range', desc: 'BMI 18.5–24.9 weight band for your height.',
    formula: 'BMI 18.5–24.9 × height (m)² — WHO',
    inputs: [I.height],
    calc: function (v, units) {
      var m = F.metric(v, units);
      if (!m) return { error: 'Enter a valid height.' };
      var rng = F.healthyWeightRange(m.heightCm);
      return {
        main: { value: F.fmt(fmtKgLb(rng[0], units), 0) + ' – ' + F.fmt(fmtKgLb(rng[1], units), 0) + ' ' + kgUnit(units), label: 'healthy weight range' },
        stats: [
          { label: 'Lower bound (BMI 18.5)', value: F.fmt(fmtKgLb(rng[0], units), 0) + ' ' + kgUnit(units) },
          { label: 'Upper bound (BMI 24.9)', value: F.fmt(fmtKgLb(rng[1], units), 0) + ' ' + kgUnit(units) },
          { label: 'Height', value: units === 'imperial' ? F.fmt(m.heightCm / 2.54, 1) + ' in' : F.fmt(m.heightCm, 0) + ' cm' }
        ],
        formula: 'Range = 18.5 × h² to 24.9 × h²',
        explanation: 'A healthy weight for your height keeps BMI in the 18.5–24.9 band associated with the lowest disease risk. Staying in range, wherever you sit within it, is what matters most.',
        tips: [
          'Fitness, muscle mass and frame size matter — the range is a guide, not a rule.',
          'Track waist circumference too: < 94 cm (men) / < 80 cm (women).',
          'Use the Weight Loss / Gain planners to move toward the range safely.'
        ],
        recommend: recommendFor('body')
      };
    }
  });

  /* ---- weight goal ---- */

  function goalTool(id, name, icon, direction, headline) {
    return define({
      id: id, cat: 'weight', icon: icon, featured: false,
      name: name, desc: headline,
      formula: '1 kg bodyweight ≈ 7,700 kcal · TDEE from Mifflin-St Jeor',
      inputs: [I.sex, I.age, I.weight, I.height, I.activity,
        { key: 'targetWeight', label: 'Target weight', type: 'number', min: 20, max: 350, unit: 'auto', goal: true },
        { key: 'weeks', label: 'Target time', type: 'number', min: 1, max: 104, unit: 'weeks' }
      ],
      calc: function (v, units) {
        var m = F.metric(v, units);
        var age = parseFloat(v.age);
        if (!m || !isFinite(age)) return { error: 'Enter valid inputs.' };
        var tW = parseFloat(v.targetWeight) * (units === 'imperial' ? F.KG_PER_LB : 1);
        var weeks = parseFloat(v.weeks);
        if (!isFinite(tW) || !isFinite(weeks)) return { error: 'Enter a target weight and target time.' };
        if (direction === 'loss' && tW >= m.weightKg) return { error: 'For weight loss, the target weight must be below your current weight.' };
        if (direction === 'gain' && tW <= m.weightKg) return { error: 'For weight gain, the target weight must be above your current weight.' };

        var bmr = F.bmr(m.weightKg, m.heightCm, age, v.sex);
        var tdee = F.tdee(bmr, v.activity);
        var plan = F.goalPlan({ weightKg: m.weightKg, targetKg: tW, weeks: weeks, tdee: tdee, direction: direction });

        var verb = direction === 'loss' ? 'deficit' : 'surplus';
        var safety = null;
        if (plan.tooSteep) {
          safety = 'Your plan requires ' + F.fmt(plan.weeklyRate, 2) + ' kg/week — above the recommended safe rate (~' + plan.safeLimit + ' kg/week). Extend your timeline to protect muscle and avoid rebound.';
        } else if (!plan.safe) {
          safety = 'You are near the upper limit of the recommended safe rate (' + F.fmt(plan.weeklyRate, 2) + ' kg/week). A slightly longer timeline is easier to sustain.';
        }

        return {
          main: { value: F.fmt(plan.dailyTarget, 0) + ' kcal', label: 'daily calories for ' + direction + ' (' + verb + ' of ' + F.fmt(plan.kcalPerDay, 0) + ' kcal/day)' },
          stats: [
            { label: 'Maintenance (TDEE)', value: F.fmt(tdee, 0) + ' kcal' },
            { label: 'Daily ' + verb, value: F.fmt(plan.kcalPerDay, 0) + ' kcal' },
            { label: 'Weekly change', value: F.fmt(plan.weeklyRate, 2) + ' kg' },
            { label: 'Total energy for goal', value: F.fmt(plan.totalKcal, 0) + ' kcal' },
            { label: 'Estimated completion', value: plan.estDate }
          ],
          bars: [
            { label: 'Goal progress', pct: Math.min(100, Math.round((plan.deltaKg / m.weightKg) * 100)), color: 'var(--accent)', right: F.fmt(plan.deltaKg, 1) + ' kg' },
            { label: 'Weekly pace vs safe limit', pct: Math.min(100, Math.round((plan.weeklyRate / plan.safeLimit) * 100)), color: plan.safe ? 'var(--success)' : 'var(--orange)', right: F.fmt(plan.weeklyRate, 2) + ' kg/wk' }
          ],
          formula: verb + ' needed = ' + F.fmt(plan.totalKcal, 0) + ' kcal ÷ ' + plan.days + ' days = ' + F.fmt(plan.kcalPerDay, 0) + ' kcal/day · target = TDEE ' + (direction === 'loss' ? '−' : '+') + ' deficit',
          explanation: 'Burning or storing roughly 7,700 kcal changes body weight by 1 kg. This plan converts your target and timeline into a daily calorie target, then checks it against safe, sustainable rates of change.',
          safety: safety,
          tips: [
            'Weigh yourself weekly, same conditions, and adjust ±100–150 kcal every 2 weeks.',
            'Keep protein at 1.6–2.2 g/kg to protect muscle mass.',
            'Re-calculate your target every 5 kg as your TDEE shifts.'
          ],
          recommend: recommendFor('weight')
        };
      }
    });
  }

  goalTool('weight-loss', 'Weight Loss Planner', 'trending-down', 'loss', 'Daily calories to hit your target weight safely.');
  goalTool('weight-gain', 'Weight Gain Planner', 'trending-up', 'gain', 'Daily calories to build towards your target weight.');

  function defSurplusTool(id, name, icon, direction, verb) {
    return define({
      id: id, cat: 'weight', icon: icon, featured: false,
      name: name, desc: verb + ' per day and its weekly effect.',
      formula: 'Weekly change = kcal/day × 7 ÷ 7700',
      inputs: [
        { key: 'tdee', label: 'Maintenance (TDEE)', type: 'number', min: 800, max: 6000, unit: 'kcal' },
        { key: 'daily', label: 'Daily ' + verb, type: 'number', min: 50, max: 2500, unit: 'kcal' }
      ],
      calc: function (v) {
        var tdee = parseFloat(v.tdee), per = parseFloat(v.daily);
        if (!isFinite(tdee) || !isFinite(per)) return { error: 'Enter a valid TDEE and daily ' + verb + '.' };
        if (per > tdee * 0.5) return { error: verb.charAt(0).toUpperCase() + verb.slice(1) + ' above 50% of maintenance is unsafe — lower it.' };
        var weekly = per * 7 / 7700;
        var weeks = 5 / (weekly || 0.001);
        return {
          main: { value: F.fmt(per, 0) + ' kcal', label: 'daily ' + verb + ' · target ' + F.fmt(direction === 'loss' ? tdee - per : tdee + per, 0) + ' kcal' },
          stats: [
            { label: 'Weekly change', value: F.fmt(weekly, 2) + ' kg' },
            { label: '12-week projection', value: F.fmt(weekly * 12, 1) + ' kg' },
            { label: 'Time to move 5 kg', value: F.fmt(weeks, 0) + ' weeks' }
          ],
          bars: [
            { label: 'Weekly rate', pct: Math.min(100, Math.round((weekly / 1) * 100)), color: weekly <= 1 ? 'var(--success)' : 'var(--orange)', right: F.fmt(weekly, 2) + ' kg/wk' }
          ],
          formula: 'Weekly change = ' + per + ' × 7 ÷ 7700 = ' + F.fmt(weekly, 2) + ' kg',
          explanation: 'A consistent daily ' + verb + ' adds up quickly: every 7,700 kcal of surplus or deficit is one kg of bodyweight. Modest ' + verb + 's (300–500 kcal) are the most sustainable.',
          safety: per > 1000 ? 'A daily ' + verb + ' above ~1,000 kcal is aggressive and increases muscle loss / rebound risk. Consider a more moderate target.' : null,
          tips: [
            'Prefer a 300–500 kcal ' + verb + ' and let consistency do the work.',
            'Log your weight weekly to confirm the real-world rate.',
            'Re-calculate TDEE as your weight changes.'
          ],
          recommend: recommendFor('weight')
        };
      }
    });
  }

  defSurplusTool('calorie-deficit', 'Daily Calorie Deficit', 'minus-circle', 'loss', 'deficit');
  defSurplusTool('calorie-surplus', 'Daily Calorie Surplus', 'plus-circle', 'gain', 'surplus');

  define({
    id: 'goal-completion', cat: 'weight', icon: 'calendar-check', featured: false,
    name: 'Goal Completion Estimator', desc: 'When will you reach your target weight?',
    formula: 'Days = (kg change × 7700) ÷ daily kcal',
    inputs: [
      { key: 'weightKg', label: 'Current weight', type: 'number', min: 20, max: 350, unit: 'auto', goal: true },
      { key: 'targetWeight', label: 'Target weight', type: 'number', min: 20, max: 350, unit: 'auto', goal: true },
      { key: 'daily', label: 'Daily deficit / surplus', type: 'number', min: 50, max: 2500, unit: 'kcal' }
    ],
    calc: function (v, units) {
      var cur = parseFloat(v.weightKg) * (units === 'imperial' ? F.KG_PER_LB : 1);
      var tgt = parseFloat(v.targetWeight) * (units === 'imperial' ? F.KG_PER_LB : 1);
      var per = parseFloat(v.daily);
      if (!isFinite(cur) || !isFinite(tgt) || !isFinite(per) || cur === tgt) return { error: 'Enter a valid current weight, target weight and daily kcal.' };
      if (Math.abs(tgt - cur) * 7700 < per) return { error: 'That target is reached almost immediately — check your inputs.' };
      var c = F.completionFromDeficit({ weightKg: cur, targetKg: tgt, kcalPerDay: per });
      var safe = c.weeklyRate <= 1;
      return {
        main: { value: c.days + ' days', label: 'estimated time to target' },
        stats: [
          { label: 'Estimated completion date', value: c.estDate },
          { label: 'Total energy to move', value: F.fmt(c.totalKcal, 0) + ' kcal' },
          { label: 'Weekly rate', value: F.fmt(c.weeklyRate, 2) + ' kg' }
        ],
        bars: [
          { label: 'Weekly rate vs safe limit', pct: Math.min(100, Math.round((c.weeklyRate / 1) * 100)), color: safe ? 'var(--success)' : 'var(--orange)', right: F.fmt(c.weeklyRate, 2) + ' kg/wk' }
        ],
        formula: 'Days = ' + F.fmt(Math.abs(tgt - cur), 1) + ' kg × 7700 ÷ ' + per + ' = ' + c.days,
        explanation: 'Given a steady daily deficit or surplus, this estimates your target date using 7,700 kcal per kg of bodyweight.',
        safety: safe ? null : 'Your pace exceeds ~1 kg/week, which is faster than recommended. Slowing down reduces muscle loss and rebound.',
        tips: [
          'Keep the same daily target for at least 2 weeks before judging it.',
          'Aim for the middle of the safe range for the best adherence.',
          'Review weekly: small adjustments beat big overhauls.'
        ],
        recommend: recommendFor('weight')
      };
    }
  });

  /* ---- nutrition ---- */

  define({
    id: 'daily-calories', cat: 'nutrition', icon: 'flame', featured: true,
    name: 'Daily Calories', desc: 'Maintenance, cut and bulk targets from TDEE.',
    formula: 'TDEE = BMR × activity (Mifflin-St Jeor)',
    inputs: [I.weight, I.height, I.age, I.sex, I.activity],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var age = parseFloat(v.age);
      if (!m || !isFinite(age)) return { error: 'Enter valid inputs.' };
      var bmr = F.bmr(m.weightKg, m.heightCm, age, v.sex);
      var tdee = F.tdee(bmr, v.activity);
      return {
        main: { value: F.fmt(tdee, 0) + ' kcal', label: 'maintenance per day' },
        stats: [
          { label: 'Fat loss (−500)', value: F.fmt(tdee - 500, 0) + ' kcal', tone: 'green' },
          { label: 'Maintenance', value: F.fmt(tdee, 0) + ' kcal' },
          { label: 'Muscle gain (+300)', value: F.fmt(tdee + 300, 0) + ' kcal', tone: 'blue' }
        ],
        formula: 'TDEE = BMR × ' + F.ACTIVITY[v.activity].mult,
        explanation: 'Start with these three numbers. Most people lose on ~maintenance −500 kcal and gain on ~maintenance +300 kcal, but your real response depends on training and adherence.',
        tips: [
          'Pick one target and stay consistent for 2–3 weeks before adjusting.',
          'Adjust in ~100 kcal steps based on weekly scale trends.',
          'Convert the number into macros with the Macro Split tool.'
        ],
        recommend: recommendFor('nutrition')
      };
    }
  });

  define({
    id: 'protein', cat: 'nutrition', icon: 'egg', featured: false,
    name: 'Protein Calculator', desc: 'Daily protein for your goal, per kg bodyweight.',
    formula: '1.2–2.2 g/kg depending on goal (accepted sports-nutrition range)',
    inputs: [I.weight, { key: 'goal', label: 'Goal', type: 'select', options: GOAL_OPTIONS }, { key: 'calories', label: 'Daily calories (optional)', type: 'number', min: 800, max: 6000, unit: 'kcal', optional: true }],
    calc: function (v, units) {
      var m = F.metric(v, units);
      if (!m) return { error: 'Enter a valid weight.' };
      var r = F.proteinRange(m.weightKg, v.goal || 'maintenance');
      var lo = F.fmt(r[0], 0), hi = F.fmt(r[1], 0);
      var stats = [
        { label: 'Range', value: lo + ' – ' + hi + ' g' },
        { label: 'Per kg bodyweight', value: (F.PROTEIN_PER_KG[v.goal] || F.PROTEIN_PER_KG.maintenance).join('–') + ' g/kg' }
      ];
      if (isFinite(parseFloat(v.calories))) {
        var c = parseFloat(v.calories);
        stats.push({ label: 'Calories from protein', value: F.fmt(r[0] * 4 / c * 100, 0) + '–' + F.fmt(r[1] * 4 / c * 100, 0) + '% of ' + F.fmt(c, 0) + ' kcal' });
      }
      return {
        main: { value: lo + ' – ' + hi + ' g', label: 'protein per day' },
        stats: stats,
        formula: 'Maintenance 1.2–1.8 · Fat loss 1.6–2.2 · Muscle gain 1.6–2.2 g/kg',
        explanation: 'Protein is the anchor of any physique goal: it preserves muscle in a deficit and builds it in a surplus. Higher intakes within the range are fine and support satiety.',
        tips: [
          'Spread protein over 3–5 meals (20–40 g each) for best absorption.',
          'Include a protein source at every meal — eggs, chicken, paneer, dal, whey.',
          'Prioritise protein before filling remaining calories with carbs and fat.'
        ],
        recommend: recommendFor('nutrition')
      };
    }
  });

  define({
    id: 'fat', cat: 'nutrition', icon: 'droplet', featured: false,
    name: 'Fat Calculator', desc: 'Dietary fat from 20–35% of your calories.',
    formula: 'Fat g = calories × (20–35%) ÷ 9',
    inputs: [{ key: 'calories', label: 'Daily calories', type: 'number', min: 800, max: 6000, unit: 'kcal' }],
    calc: function (v) {
      var c = parseFloat(v.calories);
      if (!isFinite(c)) return { error: 'Enter a valid daily calorie target.' };
      var r = F.fatRangeFromCalories(c);
      return {
        main: { value: F.fmt(r[0], 0) + ' – ' + F.fmt(r[1], 0) + ' g', label: 'fat per day' },
        stats: [
          { label: '% of calories', value: '20–35%' },
          { label: 'Calories from fat', value: F.fmt(c * 0.2, 0) + ' – ' + F.fmt(c * 0.35, 0) + ' kcal' }
        ],
        formula: 'Fat g = ' + F.fmt(c, 0) + ' × 0.20 ÷ 9 to ' + F.fmt(c, 0) + ' × 0.35 ÷ 9',
        explanation: 'Fat supports hormones and vitamin absorption. 20–35% of calories covers everyone from cutting athletes to bulking lifters — the low end in a deficit, the high end in a surplus.',
        tips: [
          'Prefer unsaturated fats: nuts, seeds, olive oil, avocado, fish.',
          'Don\u2019t chase zero-fat — hormones and joints need dietary fat.',
          'One to two teaspoons of oil/ghee per meal easily fits your target.'
        ],
        recommend: recommendFor('nutrition')
      };
    }
  });

  define({
    id: 'carbs', cat: 'nutrition', icon: 'wheat', featured: false,
    name: 'Carb Calculator', desc: 'Remaining calories after protein and fat.',
    formula: 'Carbs g = (calories − protein·4 − fat·9) ÷ 4',
    inputs: [
      { key: 'calories', label: 'Daily calories', type: 'number', min: 800, max: 6000, unit: 'kcal' },
      { key: 'protein', label: 'Protein', type: 'number', min: 0, max: 400, unit: 'g' },
      { key: 'fat', label: 'Fat', type: 'number', min: 0, max: 300, unit: 'g' }
    ],
    calc: function (v) {
      var c = parseFloat(v.calories), p = parseFloat(v.protein), f = parseFloat(v.fat);
      if (!isFinite(c) || !isFinite(p) || !isFinite(f)) return { error: 'Enter a valid calories, protein and fat.' };
      var carbs = F.carbsFromRemainder(c, p, f);
      var pCal = p * 4, fCal = f * 9, cCal = carbs * 4;
      return {
        main: { value: F.fmt(carbs, 0) + ' g', label: 'carbohydrates per day' },
        stats: [
          { label: 'Protein calories', value: F.fmt(pCal, 0) + ' kcal' },
          { label: 'Fat calories', value: F.fmt(fCal, 0) + ' kcal' },
          { label: 'Carb calories', value: F.fmt(cCal, 0) + ' kcal' },
          { label: 'Carbs % of total', value: F.fmt(cCal / c * 100, 0) + '%' }
        ],
        formula: 'Carbs = (' + F.fmt(c, 0) + ' − ' + F.fmt(pCal, 0) + ' − ' + F.fmt(fCal, 0) + ') ÷ 4 = ' + F.fmt(carbs, 0),
        explanation: 'After protein and fat are set, carbs fill the rest. They fuel training and recovery — most active people do best keeping carbs as the largest macro by weight.',
        tips: [
          'Time more carbs around workouts when energy dips.',
          'Prioritise rice, oats, potatoes, fruit and whole grains.',
          'Adjust carbs up for training days, down for rest days.'
        ],
        recommend: recommendFor('nutrition')
      };
    }
  });

  define({
    id: 'macro-split', cat: 'nutrition', icon: 'pie-chart', featured: true,
    name: 'Macro Split Generator', desc: 'Complete protein, fat and carb targets.',
    formula: 'Protein by goal · Fat 20–35% · Carbs = remainder',
    inputs: [I.weight, { key: 'calories', label: 'Daily calories', type: 'number', min: 800, max: 6000, unit: 'kcal' }, { key: 'goal', label: 'Goal', type: 'select', options: GOAL_OPTIONS }],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var c = parseFloat(v.calories);
      if (!m || !isFinite(c)) return { error: 'Enter a valid weight and calorie target.' };
      var s = F.macroSplit({ calories: c, weightKg: m.weightKg, goal: v.goal || 'maintenance' });
      var goalNames = { maintenance: 'Maintenance', 'fat-loss': 'Fat Loss', 'muscle-gain': 'Muscle Gain', recomp: 'Recomposition' };
      return {
        main: { value: F.fmt(c, 0) + ' kcal', label: goalNames[v.goal] + ' split' },
        macros: {
          items: [
            { label: 'Protein', grams: s.protein.grams, calories: s.protein.calories, pct: s.protein.pct, color: '#0891b2' },
            { label: 'Fat', grams: s.fat.grams, calories: s.fat.calories, pct: s.fat.pct, color: '#f59e0b' },
            { label: 'Carbs', grams: s.carbs.grams, calories: s.carbs.calories, pct: s.carbs.pct, color: '#10b981' }
          ]
        },
        stats: [
          { label: 'Protein', value: s.protein.grams + ' g · ' + s.protein.pct + '%' },
          { label: 'Fat', value: s.fat.grams + ' g · ' + s.fat.pct + '%' },
          { label: 'Carbs', value: s.carbs.grams + ' g · ' + s.carbs.pct + '%' }
        ],
        formula: 'Protein = ' + s.protein.grams + ' g (goal-based) · Fat = ' + F.fmt(c * 0.25 / 9, 0) + ' g (25%) · Carbs = remainder (' + s.carbs.grams + ' g)',
        explanation: 'This is a complete, calorie-balanced macro plan: protein is set by goal and bodyweight, fat covers 20–35% for hormonal health, and carbs fuel the remainder.',
        tips: [
          'Keep protein fixed; move fat vs carbs to taste and performance.',
          'In a deficit, don\u2019t drop fat below ~0.5 g/kg.',
          'Re-check your split whenever your calorie target changes.'
        ],
        recommend: recommendFor('nutrition')
      };
    }
  });

  define({
    id: 'water', cat: 'nutrition', icon: 'glass-water', featured: false,
    name: 'Water Intake Calculator', desc: 'Daily hydration target from bodyweight.',
    formula: '30–35 ml per kg bodyweight + 350 ml per 30 min exercise',
    inputs: [I.weight, { key: 'exercise', label: 'Exercise per day', type: 'number', min: 0, max: 480, unit: 'minutes', optional: true }],
    calc: function (v, units) {
      var m = F.metric(v, units);
      if (!m) return { error: 'Enter a valid weight.' };
      var w = F.waterIntake(m.weightKg, isFinite(parseFloat(v.exercise)) ? parseFloat(v.exercise) : 0);
      var stats = [{ label: 'Base target', value: w.low + ' – ' + w.high + ' ml' }];
      if (w.extra > 0) stats.push({ label: 'With ' + v.exercise + ' min exercise', value: F.fmt(w.high + w.extra, 0) + ' ml' });
      stats.push({ label: 'Per kg bodyweight', value: '30–35 ml' });
      return {
        main: { value: F.fmt(w.low, 0) + ' – ' + F.fmt(w.high + w.extra, 0) + ' ml', label: 'water per day' },
        stats: stats,
        formula: 'Base = ' + F.fmt(m.weightKg, 0) + ' kg × 30–35 ml' + (w.extra ? ' + ' + w.extra + ' ml (exercise)' : ''),
        explanation: 'Water supports digestion, performance and recovery. The 30–35 ml/kg guideline covers most adults; add ~350 ml per 30 minutes of exercise.',
        tips: [
          'Keep a bottle visible and sip through the day rather than chugging.',
          'Urine pale-yellow is a good hydration signal.',
          'High-protein diets and hot climates raise your needs.'
        ],
        recommend: recommendFor('nutrition')
      };
    }
  });

  define({
    id: 'fiber', cat: 'nutrition', icon: 'leaf', featured: false,
    name: 'Fiber Calculator', desc: 'Daily fiber from calories and sex.',
    formula: '14 g per 1,000 kcal (Institute of Medicine) · 25–38 g/day adults',
    inputs: [{ key: 'calories', label: 'Daily calories', type: 'number', min: 800, max: 6000, unit: 'kcal' }, I.sex],
    calc: function (v) {
      var c = parseFloat(v.calories);
      if (!isFinite(c)) return { error: 'Enter a valid daily calorie target.' };
      var f = F.fiber(c, v.sex);
      return {
        main: { value: f.range[0] + ' – ' + f.range[1] + ' g', label: 'fiber per day' },
        stats: [
          { label: 'From 14 g / 1000 kcal', value: f.byKcal + ' g' },
          { label: 'Adult guideline', value: v.sex === 'female' ? '25 g' : '38 g' }
        ],
        formula: 'Fiber = calories ÷ 1000 × 14 = ' + f.byKcal + ' g',
        explanation: 'Fiber feeds gut bacteria, steadies blood sugar and improves satiety — most people eat half the recommended amount. Aim for the higher end of your range.',
        tips: [
          'Oats, whole grains, dal, vegetables and fruit are fiber stars.',
          'Add fiber gradually and increase water to avoid bloating.',
          'A 50 g bowl of oats or dal at a meal adds 6–10 g quickly.'
        ],
        recommend: recommendFor('nutrition')
      };
    }
  });

  /* ---- workout ---- */

  define({
    id: 'calories-burned', cat: 'workout', icon: 'flame', featured: false,
    name: 'Calories Burned', desc: 'Any activity — MET-based energy expenditure.',
    formula: 'kcal = MET × weight (kg) × hours (compendium of physical activities)',
    inputs: [
      I.weight,
      { key: 'activity', label: 'Activity', type: 'select', options: Object.keys(F.MET).map(function (k) { return { v: k, label: F.MET[k].label }; }) },
      { key: 'minutes', label: 'Duration', type: 'number', min: 1, max: 1440, unit: 'minutes' }
    ],
    calc: function (v, units) {
      var m = F.metric(v, units);
      var min = parseFloat(v.minutes);
      var meta = activityMeta(v.activity);
      if (!m || !isFinite(min) || !meta) return { error: 'Enter a valid weight, activity and duration.' };
      var kcal = F.metCalories(meta.met, m.weightKg, min);
      return {
        main: { value: F.fmt(kcal, 0) + ' kcal', label: 'estimated burn' },
        stats: [
          { label: 'MET value', value: meta.met },
          { label: 'Estimated intensity', value: F.activityIntensity(meta.met) },
          { label: 'Duration', value: min + ' min' }
        ],
        formula: 'kcal = ' + meta.met + ' × ' + F.fmt(m.weightKg, 0) + ' kg × ' + F.fmt(min / 60, 2) + ' h = ' + F.fmt(kcal, 0),
        explanation: 'METs are standardised effort units. Your burn depends on bodyweight and effort — the harder the effort and the heavier you are, the more you burn.',
        tips: [
          'Interval work raises total calories via recovery burn too.',
          'Choose activities you enjoy — adherence beats intensity.',
          'Pair this with the Daily Calories tool for a true target.'
        ],
        recommend: recommendFor('workout')
      };
    }
  });

  function activityTool(id, name, icon, metMap, label) {
    return define({
      id: id, cat: 'workout', icon: icon, featured: false,
      name: name, desc: 'Calories burned ' + label + '.',
      formula: 'kcal = MET × weight (kg) × hours',
      inputs: [
        I.weight,
        { key: 'intensity', label: 'Intensity', type: 'select', options: [{ v: 'light', label: 'Light' }, { v: 'moderate', label: 'Moderate' }, { v: 'vigorous', label: 'Vigorous' }] },
        { key: 'minutes', label: 'Duration', type: 'number', min: 1, max: 1440, unit: 'minutes' }
      ],
      calc: function (v, units) {
        var m = F.metric(v, units);
        var min = parseFloat(v.minutes);
        var met = metMap[v.intensity];
        if (!m || !isFinite(min) || !met) return { error: 'Enter a valid weight, intensity and duration.' };
        var kcal = F.metCalories(met, m.weightKg, min);
        var level = { light: 'Light effort', moderate: 'Moderate effort', vigorous: 'Vigorous effort' };
        return {
          main: { value: F.fmt(kcal, 0) + ' kcal', label: 'estimated burn' },
          stats: [
            { label: 'MET value', value: met },
            { label: 'Intensity', value: level[v.intensity] },
            { label: 'Duration', value: min + ' min' }
          ],
          formula: 'kcal = ' + met + ' × ' + F.fmt(m.weightKg, 0) + ' kg × ' + F.fmt(min / 60, 2) + ' h = ' + F.fmt(kcal, 0),
          explanation: 'Calories burned ' + label + ' scale with effort (MET) and bodyweight. Moderate-to-vigorous sessions earn the most meaningful burn per minute.',
          tips: [
            'Shoes and form matter more than pace for joints.',
            'A 30-minute moderate session most days beats weekly marathons.',
            'Log sessions in the Workout Plan generator for structure.'
          ],
          recommend: recommendFor('workout')
        };
      }
    });
  }

  activityTool('walking', 'Walking Calories', 'footprints', { light: 2.8, moderate: 3.5, vigorous: 4.5 }, 'while walking');
  activityTool('running', 'Running Calories', 'zap', { light: 8.3, moderate: 9.8, vigorous: 11.8 }, 'while running');
  activityTool('cycling', 'Cycling Calories', 'bike', { light: 4.0, moderate: 8.0, vigorous: 10.0 }, 'while cycling');
  activityTool('swimming', 'Swimming Calories', 'waves', { light: 6.0, moderate: 8.0, vigorous: 10.0 }, 'while swimming');

  define({
    id: 'pace', cat: 'workout', icon: 'timer', featured: false,
    name: 'Pace Calculator', desc: 'Pace, speed and race-time projections.',
    formula: 'Pace = time ÷ distance · speed = distance ÷ time',
    inputs: [
      { key: 'distance', label: 'Distance', type: 'number', min: 0.1, max: 500, unit: 'km' },
      { key: 'hours', label: 'Time — hours', type: 'number', min: 0, max: 24, unit: 'h', optional: true },
      { key: 'minutes', label: 'Time — minutes', type: 'number', min: 0, max: 1440, unit: 'min' }
    ],
    calc: function (v) {
      var d = parseFloat(v.distance);
      var h = isFinite(parseFloat(v.hours)) ? parseFloat(v.hours) : 0;
      var min = parseFloat(v.minutes);
      if (!isFinite(d) || !isFinite(min) || (h === 0 && min === 0)) return { error: 'Enter a valid distance and time.' };
      var totalMin = h * 60 + min;
      var p = F.paceFromTimeDistance(d, totalMin);
      if (!p) return { error: 'Distance must be greater than zero.' };
      var splitStats = Object.keys(p.splits).map(function (k) {
        var s = p.splits[k];
        var mm = Math.floor(s.minutes / 60), ss = s.minutes % 60;
        return { label: k, value: (mm > 0 ? mm + 'h ' : '') + ss + ' min' };
      });
      return {
        main: { value: p.paceMin + ':' + (p.paceSec < 10 ? '0' : '') + p.paceSec + ' /km', label: 'pace' },
        stats: [
          { label: 'Speed', value: F.fmt(p.speedKmh, 2) + ' km/h (' + F.fmt(p.speedMph, 2) + ' mph)' },
          { label: 'Total time', value: (h > 0 ? h + ' h ' : '') + min + ' min' }
        ].concat(splitStats),
        formula: 'Pace = ' + totalMin + ' min ÷ ' + d + ' km = ' + p.paceMin + ':' + p.paceSec + ' /km',
        explanation: 'Your pace converts directly to race-time projections for common distances — useful for pacing strategy and setting realistic goals.',
        tips: [
          'Negative splits (faster second half) are the safest race strategy.',
          'Re-test your pace on the same route for consistent comparisons.',
          'Use the Running Calories tool to pair effort with energy.'
        ],
        recommend: recommendFor('workout')
      };
    }
  });

  define({
    id: 'one-rep-max', cat: 'workout', icon: 'muscle', featured: false,
    name: 'One Rep Max Calculator', desc: 'Estimate your 1RM from a submaximal set.',
    formula: 'Epley: 1RM = weight × (1 + reps/30)',
    inputs: [
      { key: 'weightLifted', label: 'Weight lifted', type: 'number', min: 1, max: 500, unit: 'auto', goal: true },
      { key: 'reps', label: 'Reps completed', type: 'number', min: 1, max: 12, unit: 'reps' }
    ],
    calc: function (v, units) {
      var w = parseFloat(v.weightLifted) * (units === 'imperial' ? 1 : 1);
      var reps = parseFloat(v.reps);
      if (!isFinite(w) || !isFinite(reps)) return { error: 'Enter a valid weight and reps.' };
      var unit = v.weightLiftedUnit === 'lb' ? 'lb' : (units === 'imperial' ? 'lb' : 'kg');
      var one = F.epley1rm(w, reps);
      var stats = [];
      [3, 5, 8, 10].forEach(function (r) {
        stats.push({ label: r + ' RM (est.)', value: F.fmt(F.epley1rm(one, -r), 0) });
      });
      return {
        main: { value: F.fmt(one, 0) + ' ' + unit, label: 'estimated 1RM' },
        stats: stats,
        formula: '1RM = ' + F.fmt(w, 0) + ' × (1 + ' + reps + '/30) = ' + F.fmt(one, 0),
        explanation: 'The Epley formula estimates the most you could lift once from a clean, near-failure set of 1–12 reps. It is safest for loads above ~60% of your max.',
        tips: [
          'Stop a few reps short of failure when testing.',
          'Use the estimate to programme percentages: 65–85% for hypertrophy.',
          'Re-test every 6–8 weeks to track strength.'
        ],
        recommend: recommendFor('workout')
      };
    }
  });

  /* ---- health ---- */

  define({
    id: 'sleep', cat: 'health', icon: 'moon-star', featured: false,
    name: 'Sleep Recommendation', desc: 'Age-based sleep targets (National Sleep Foundation).',
    formula: 'National Sleep Foundation age guidelines',
    inputs: [I.age],
    calc: function (v) {
      var age = parseFloat(v.age);
      if (!isFinite(age)) return { error: 'Enter your age.' };
      var r = F.sleepForAge(age);
      return {
        main: { value: r.hours[0] + ' – ' + r.hours[1] + ' h', label: 'sleep per night (recommended)' },
        stats: [
          { label: 'Age group', value: r.label },
          { label: 'Guideline', value: 'National Sleep Foundation' }
        ],
        formula: 'Age ' + r.label + ' → ' + r.hours[0] + '–' + r.hours[1] + ' hours',
        explanation: 'Sleep is when muscle repairs and hormones reset. Falling consistently short of your band slows recovery, raises hunger and hurts performance.',
        tips: [
          'Fixed sleep and wake times beat weekend catch-up.',
          'Keep the room cool, dark and screen-free before bed.',
          'Training late can delay sleep — cool down and wind down first.'
        ],
        recommend: recommendFor('health')
      };
    }
  });

  define({
    id: 'bmi-guide', cat: 'health', icon: 'book-open', featured: false,
    name: 'Healthy BMI Guide', desc: 'WHO BMI categories and what they mean.',
    formula: 'WHO classification (kg/m²)',
    inputs: [I.weightKg, I.heightCm],
    calc: function (v) {
      var w = parseFloat(v.weightKg), h = parseFloat(v.heightCm);
      var table = {
        cols: ['Category', 'BMI', 'Risk'],
        rows: [
          [{ v: 'Underweight', tone: 'blue' }, { v: '< 18.5' }, { v: 'Higher — low weight' }],
          [{ v: 'Normal', tone: 'green' }, { v: '18.5 – 24.9' }, { v: 'Lowest risk' }],
          [{ v: 'Overweight', tone: 'orange' }, { v: '25 – 29.9' }, { v: 'Increased' }],
          [{ v: 'Obese', tone: 'red' }, { v: '≥ 30' }, { v: 'High' }]
        ]
      };
      var main = { value: 'WHO table', label: 'healthy BMI is 18.5–24.9' };
      if (isFinite(w) && isFinite(h) && h > 50) {
        var bmi = F.bmi(w, h);
        var cat = F.bmiCategory(bmi);
        main = { value: F.fmt(bmi, 1), label: 'your BMI — ' + cat.label, tone: cat.tone };
      }
      return {
        main: main,
        stats: [
          { label: 'Healthy range', value: '18.5 – 24.9' },
          { label: 'Your inputs', value: (isFinite(w) ? w + ' kg · ' : '') + (isFinite(h) ? h + ' cm' : 'not provided') }
        ],
        table: table,
        formula: 'BMI = weight (kg) ÷ height (m)²',
        explanation: 'BMI correlates with health risk across populations but can misclassify muscular people. Treat it as a screening tool, not a verdict.',
        tips: [
          'Combine BMI with waist circumference and body-fat estimates.',
          'Normal BMI + healthy waist is a strong health signal.',
          'Use the Weight planners to move toward your healthy range.'
        ],
        recommend: recommendFor('health')
      };
    }
  });

  define({
    id: 'bodyfat-guide', cat: 'health', icon: 'book-heart', featured: false,
    name: 'Healthy Body Fat Guide', desc: 'Reference ranges for men and women.',
    formula: 'American Council on Exercise reference ranges',
    inputs: [I.sex],
    calc: function (v) {
      var rows = F.BODYFAT_RANGES[v.sex === 'female' ? 'female' : 'male'].map(function (r) {
        return { cells: [{ v: r.label, tone: r.tone }, { v: r.range }] };
      });
      return {
        main: { value: v.sex === 'female' ? '14–24%' : '6–17%', label: 'typical healthy range (' + (v.sex === 'female' ? 'women' : 'men') + ')' },
        table: { cols: ['Category', 'Body fat %'], rows: rows },
        formula: 'ACE reference ranges',
        explanation: 'Body-fat needs differ by sex and age. These are general reference bands — below-essential fat is as risky as excess fat.',
        tips: [
          'Essential fat minimums: ~10% women, ~3% men.',
          'Fat distribution matters — visceral fat is the riskiest.',
          'Measure trends monthly, not daily.'
        ],
        recommend: recommendFor('health')
      };
    }
  });

  /* ---- recommendations ---- */

  function recommendFor(cat) {
    var out = [];
    if (cat === 'nutrition' || cat === 'weight' || cat === 'body') {
      out.push({ text: 'Turn your calorie target into a full week of meals', cta: 'View Diet Plans', href: 'Meal Plan.html' });
    }
    if (cat === 'body' || cat === 'workout' || cat === 'health') {
      out.push({ text: 'Structure training around your numbers', cta: 'View Workout Plans', href: 'Workout Plan.html' });
    }
    out.push({ text: 'Combine diet and training into one plan', cta: 'Start Your Transformation', href: 'Combo Plan.html' });
    return out;
  }

  /* ================= state ================= */

  var state = {
    cat: 'all',
    query: '',
    activeTool: null,
    units: 'metric',
    foods: [],
    foodLoaded: false,
    meal: []
  };

  /* ================= DOM helpers ================= */

  function byCat(id) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i];
    return CATS[0];
  }

  function toneClass(t) { return t === 'green' ? 't-green' : t === 'orange' ? 't-orange' : t === 'red' ? 't-red' : t === 'blue' ? 't-blue' : 't-gold'; }

  /* ================= tool grid ================= */

  function matchesQuery(tool) {
    var q = state.query.trim().toLowerCase();
    if (!q) return true;
    var hay = (tool.name + ' ' + tool.desc + ' ' + tool.id + ' ' + (tool.tags || '')).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function visibleTools() {
    return TOOLS.filter(function (t) {
      if (state.cat !== 'all' && t.cat !== state.cat) return false;
      return matchesQuery(t);
    });
  }

  function renderChips() {
    var wrap = el('catFilters');
    if (!wrap) return;
    wrap.innerHTML = CATS.map(function (c) {
      return '<button class="chip' + (state.cat === c.id ? ' on' : '') + '" data-cat="' + c.id + '">' +
        '<i data-lucide="' + catIcon(c.id) + '" style="width:14px;height:14px"></i> ' + esc(c.label) + '</button>';
    }).join('');
  }

  function catIcon(id) {
    return { all: 'layout-grid', body: 'dumbbell', weight: 'trending-down', nutrition: 'apple', workout: 'flame', health: 'heart-pulse', food: 'utensils-crossed' }[id] || 'calculator';
  }

  function renderGrid() {
    var grid = el('toolGrid');
    if (!grid) return;
    var list = visibleTools();
    if (list.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i data-lucide="search-x"></i><p>No tools match "' + esc(state.query) + '". Try "calorie", "protein" or "bmi".</p></div>';
      lucide && lucide.createIcons();
      return;
    }
    grid.innerHTML = list.map(function (t) {
      var icon = t.section ? t.icon : t.icon;
      return '<article class="tool-card js-reveal" data-cat="' + t.cat + '">' +
        '<div class="tool-card-top">' +
        '<span class="tool-icon"><i data-lucide="' + esc(icon) + '"></i></span>' +
        '<span class="tool-cat">' + esc(byCat(t.cat).label) + '</span>' +
        '</div>' +
        '<h3 class="tool-name">' + esc(t.name) + '</h3>' +
        '<p class="tool-desc">' + esc(t.desc) + '</p>' +
        '<div class="tool-actions">' +
        '<span class="tool-formula">' + esc(t.formula.split('—')[0].split('·')[0].slice(0, 42)) + '</span>' +
        '<button class="gbtn tool-open" data-tool="' + t.id + '" aria-label="Open ' + esc(t.name) + '">' +
        (t.section ? 'Open' : 'Open') + ' <i data-lucide="' + (t.section ? 'utensils-crossed' : 'arrow-right') + '" style="width:14px;height:14px"></i></button>' +
        '</div>' +
        '</article>';
    }).join('');
    if (window.lucide) lucide.createIcons();
    wireGridEvents(grid);
  }

  function wireGridEvents(grid) {
    grid.querySelectorAll('.tool-open').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-tool');
        var t = TOOLS.find(function (x) { return x.id === id; });
        if (t && t.section) {
          var target = el(id);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          openTool(id);
        }
      });
    });
  }

  function applyFilters() {
    renderGrid();
  }

  /* ================= workspace ================= */

  function hasBodyInputs(tool) {
    return tool.inputs.some(function (i) { return i.kind === 'weight' || i.kind === 'height'; });
  }

  function inputForMetric(i) {
    if (i.kind === 'weight') return { key: 'weightKg', label: 'Weight', min: 20, max: 350, unit: 'kg' };
    if (i.kind === 'height') return { key: 'heightCm', label: 'Height', min: 100, max: 260, unit: 'cm' };
    return null;
  }
  function inputForImperial(i) {
    if (i.kind === 'weight') return { key: 'weightLb', label: 'Weight', min: 44, max: 770, unit: 'lb' };
    if (i.kind === 'height') return { key: 'heightFt', label: 'Height', min: 3, max: 8, unit: 'ft' };
    return null;
  }

  function expandInputs(tool) {
    var out = [];
    tool.inputs.forEach(function (i) {
      if (i.kind === 'weight' || i.kind === 'height') {
        var met = inputForMetric(i);
        var imp = inputForImperial(i);
        if (i.kind === 'weight') {
          out.push({ key: 'weightKg', label: met.label, type: 'number', min: met.min, max: met.max, unit: 'kg', units: 'metric' });
          out.push({ key: 'weightLb', label: imp.label, type: 'number', min: imp.min, max: imp.max, unit: 'lb', units: 'imperial' });
        } else {
          out.push({ key: 'heightCm', label: met.label, type: 'number', min: met.min, max: met.max, unit: 'cm', units: 'metric' });
          out.push({ key: 'heightFt', label: 'Height (feet)', type: 'number', min: 3, max: 8, unit: 'ft', units: 'imperial' });
          out.push({ key: 'heightIn', label: 'Height (inches)', type: 'number', min: 0, max: 11, unit: 'in', units: 'imperial' });
        }
      } else {
        out.push(i);
      }
    });
    return out;
  }

  function showIf(input, v) {
    if (input.showIf && v.sex !== input.showIf) return false;
    return true;
  }

  function renderWorkspace(tool) {
    var ws = el('workspace');
    var expand = expandInputs(tool);
    var hasUnits = hasBodyInputs(tool);

    var html = '<div class="workspace-inner">';
    html += '<div class="workspace-head">';
    html += '<button class="btn ws-back" data-action="close" aria-label="Back to tools"><i data-lucide="arrow-left"></i> All tools</button>';
    html += '<div class="ws-title-row">';
    html += '<span class="tool-icon big"><i data-lucide="' + esc(tool.icon) + '"></i></span>';
    html += '<div><h2 class="ws-title">' + esc(tool.name) + '</h2><p class="ws-formula">' + esc(tool.formula) + '</p></div>';
    html += '</div>';
    if (hasUnits) {
      html += '<div class="unit-toggle" role="group" aria-label="Units">' +
        '<button type="button" class="unit-btn' + (state.units === 'metric' ? ' active' : '') + '" data-unit="metric">Metric</button>' +
        '<button type="button" class="unit-btn' + (state.units === 'imperial' ? ' active' : '') + '" data-unit="imperial">Imperial</button>' +
        '</div>';
    }
    html += '</div>';

    html += '<form class="ws-form" novalidate>';
    expand.forEach(function (i) {
      if (i.units && i.units !== state.units) return;
      if (i.optional === false || i.optional) { /* still render */ }
      html += '<div class="fg" data-fg="' + esc(i.key) + '">';
      html += '<label for="in_' + esc(i.key) + '">' + esc(i.label) + (i.optional ? ' <span class="opt">(optional)</span>' : '') + '</label>';
      if (i.type === 'select') {
        html += '<select id="in_' + esc(i.key) + '" data-key="' + esc(i.key) + '" class="ws-select">' +
          i.options.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.label) + '</option>'; }).join('') +
          '</select>';
      } else {
        html += '<div class="in-row">' +
          '<input id="in_' + esc(i.key) + '" type="number" inputmode="decimal" data-key="' + esc(i.key) + '" min="' + (i.min !== undefined ? i.min : '') + '" max="' + (i.max !== undefined ? i.max : '') + '" placeholder="0" />' +
          (i.unit ? '<span class="in-unit">' + esc(i.unit) + '</span>' : '') +
          '</div>';
      }
      html += '<span class="ferr"></span>';
      html += '</div>';
    });
    html += '<div class="ws-actions">';
    html += '<button type="submit" class="gbtn ws-calc"><i data-lucide="calculator" style="width:16px;height:16px"></i> Calculate</button>';
    html += '<button type="button" class="btn ws-clear" data-action="reset">Reset</button>';
    html += '</div>';
    html += '</form>';
    html += '<div class="result-dashboard" id="resultDash" hidden></div>';
    html += '</div>';
    ws.innerHTML = html;
    if (window.lucide) lucide.createIcons();

    ws.querySelectorAll('[data-action="close"]').forEach(function (b) {
      b.addEventListener('click', function () { closeWorkspace(); });
    });
    ws.querySelectorAll('[data-action="reset"]').forEach(function (b) {
      b.addEventListener('click', function () { el('resultDash').hidden = true; renderWorkspace(tool); });
    });
    ws.querySelectorAll('.unit-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.units = b.getAttribute('data-unit');
        renderWorkspace(tool);
      });
    });
    ws.querySelector('.ws-form').addEventListener('submit', function (e) {
      e.preventDefault();
      runTool(tool);
    });
    ws.querySelectorAll('.ws-select[data-key="sex"]').forEach(function (s) {
      s.addEventListener('change', function () { renderWorkspace(tool); });
    });

    ws.hidden = false;
    var first = ws.querySelector('input, select');
    if (first) setTimeout(function () { first.focus(); }, 60);
    ws.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openTool(id) {
    var t = TOOLS.find(function (x) { return x.id === id; });
    if (!t) return;
    state.activeTool = t;
    renderWorkspace(t);
  }

  function closeWorkspace() {
    var ws = el('workspace');
    ws.hidden = true;
    state.activeTool = null;
    el('tools').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function runTool(tool) {
    var form = el('workspace').querySelector('.ws-form');
    var values = {};
    var errors = {};

    form.querySelectorAll('[data-key]').forEach(function (n) {
      values[n.getAttribute('data-key')] = n.value;
    });

    // expand inputs again for validation metadata
    var expand = expandInputs(tool);
    expand.forEach(function (i) {
      if (i.units && i.units !== state.units) return;
      if (i.type === 'number' && !i.optional) {
        var raw = values[i.key];
        var num = parseFloat(raw);
        if (raw === '' || raw === undefined) errors[i.key] = i.label + ' is required';
        else if (!isFinite(num)) errors[i.key] = 'Enter a valid number';
        else if (i.min !== undefined && num < i.min) errors[i.key] = 'Minimum is ' + i.min;
        else if (i.max !== undefined && num > i.max) errors[i.key] = 'Maximum is ' + i.max;
      }
      if (i.type === 'select' && !values[i.key]) errors[i.key] = 'Select ' + i.label.toLowerCase();
    });

    // required weight/height checks
    if (!values.weightKg && !values.weightLb) errors.weightKg = 'Weight is required';
    if (!values.heightCm && !(values.heightFt && values.heightIn)) errors.heightCm = 'Height is required';

    form.querySelectorAll('[data-key]').forEach(function (n) {
      var k = n.getAttribute('data-key');
      var fg = n.closest('.fg');
      var errSpan = fg ? fg.querySelector('.ferr') : null;
      if (errors[k]) {
        n.classList.add('err');
        if (errSpan) { errSpan.textContent = errors[k]; errSpan.classList.add('on'); }
      } else {
        n.classList.remove('err');
        if (errSpan) { errSpan.textContent = ''; errSpan.classList.remove('on'); }
      }
    });

    if (Object.keys(errors).length) {
      var firstErr = form.querySelector('[data-key].err');
      if (firstErr) firstErr.focus();
      return;
    }

    var result;
    try {
      result = tool.calc(values, state.units);
    } catch (err) {
      result = { error: 'Something went wrong computing this result. Please check your inputs.' };
    }

    if (result && result.error) {
      renderError(result.error);
      return;
    }
    renderResult(tool, result, values);
  }

  /* ================= result rendering ================= */

  function renderError(msg) {
    var dash = el('resultDash');
    dash.hidden = false;
    dash.innerHTML = '<div class="ib ib-red"><h3>Check your inputs</h3><p>' + esc(msg) + '</p></div>';
    dash.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function gaugeHTML(g) {
    if (!g) return '';
    if (g.range) {
      // static healthy range card for ideal weight
      return '<div class="gauge-static"><span class="t-green">Healthy range:</span> ' + F.fmt(g.range.lo, 0) + ' – ' + F.fmt(g.range.hi, 0) + ' ' + kgUnit(state.units) + '</div>';
    }
    var total = g.max - g.min;
    var zones = (g.zones || []).map(function (z) {
      var w = Math.max(0, ((z.to - z.from) / total) * 100);
      var left = ((z.from - g.min) / total) * 100;
      return '<span class="gzone ' + toneClass(z.tone) + '" style="left:' + left + '%;width:' + w + '%"></span>';
    }).join('');
    var pos = Math.max(0, Math.min(100, ((g.value - g.min) / total) * 100));
    return '<div class="gauge">' +
      '<div class="gauge-track">' + zones +
      '<span class="gauge-marker" style="left:' + pos + '%"></span>' +
      '</div>' +
      '<div class="gauge-scale"><span>' + g.min + '</span><span>' + g.unit + '</span><span>' + g.max + '</span></div>' +
      '</div>';
  }

  function macrosHTML(m) {
    if (!m) return '';
    var bar = m.items.map(function (it) {
      return '<span class="mseg" style="width:' + it.pct + '%;background:' + it.color + '"></span>';
    }).join('');
    var legend = m.items.map(function (it) {
      return '<span class="mlegend"><i style="background:' + it.color + '"></i>' + esc(it.label) + ' <b>' + it.grams + ' g</b> · ' + it.calories + ' kcal · ' + it.pct + '%</span>';
    }).join('');
    return '<div class="macro-chart"><div class="mstack">' + bar + '</div><div class="mlegend-wrap">' + legend + '</div></div>';
  }

  function barsHTML(bars) {
    if (!bars || !bars.length) return '';
    return '<div class="pbars">' + bars.map(function (b) {
      return '<div class="pbar-row"><div class="pbar-label"><span>' + esc(b.label) + '</span><span class="pbar-right">' + esc(b.right || b.pct + '%') + '</span></div>' +
        '<div class="pbar"><span style="width:' + Math.max(0, Math.min(100, b.pct)) + '%;background:' + b.color + '"></span></div></div>';
    }).join('') + '</div>';
  }

  function statsHTML(stats) {
    if (!stats || !stats.length) return '';
    return '<div class="stat-grid">' + stats.map(function (s) {
      return '<div class="stat">' +
        '<span class="stat-val' + (s.tone ? ' ' + toneClass(s.tone) : '') + '">' + esc(s.value) + '</span>' +
        '<span class="stat-lbl">' + esc(s.label) + '</span></div>';
    }).join('') + '</div>';
  }

  function tableHTML(tbl) {
    if (!tbl) return '';
    return '<div class="result-table-wrap"><table class="result-table"><thead><tr>' +
      tbl.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      tbl.rows.map(function (r) {
        var cells = (r.cells || []).map(function (c) {
          return '<td class="' + (c.tone ? toneClass(c.tone) : '') + '">' + esc(c.v) + '</td>';
        }).join('');
        return '<tr>' + cells + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function recommendHTML(recs) {
    if (!recs || !recs.length) return '';
    return '<div class="rec-wrap"><div class="rec-title"><i data-lucide="sparkles" style="width:15px;height:15px"></i> Recommended for you</div>' +
      '<div class="rec-grid">' + recs.map(function (r) {
        return '<a class="rec-card" href="' + esc(r.href) + '">' +
          '<span class="rec-text">' + esc(r.text) + '</span>' +
          '<span class="rec-cta"><i data-lucide="arrow-right" style="width:14px;height:14px"></i> ' + esc(r.cta) + '</span></a>';
      }).join('') + '</div></div>';
  }

  function renderResult(tool, result, values) {
    var dash = el('resultDash');
    var main = result.main || { value: '—', label: 'result' };
    var html = '<div class="result-card js-reveal is-visible">';

    if (main) {
      html += '<div class="result-main">' +
        '<div class="rval ' + toneClass(main.tone || 'accent') + '">' + esc(main.value) + '</div>' +
        '<div class="rlbl">' + esc(main.label) + '</div>' +
        '</div>';
    }

    html += gaugeHTML(result.gauge);
    html += macrosHTML(result.macros);
    html += barsHTML(result.bars);
    html += statsHTML(result.stats);
    html += tableHTML(result.table);

    if (result.formula) html += '<div class="result-formula"><span class="f-tag">Formula</span><code>' + esc(result.formula) + '</code></div>';
    if (result.safety) html += '<div class="ib ib-red safety"><h3>Safety check</h3><p>' + esc(result.safety) + '</p></div>';
    if (result.explanation) html += '<p class="result-explain">' + esc(result.explanation) + '</p>';
    if (result.tips && result.tips.length) {
      html += '<div class="result-tips"><h3><i data-lucide="heart-pulse" style="width:15px;height:15px"></i> Health tips</h3><ul>' +
        result.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }
    html += recommendHTML(result.recommend);

    html += '<div class="result-actions">' +
      '<button type="button" class="btn ws-copy" id="copyBtn"><i data-lucide="copy" style="width:14px;height:14px"></i> Copy results</button>' +
      '</div>';

    html += '</div>';
    dash.innerHTML = html;
    dash.hidden = false;
    if (window.lucide) lucide.createIcons();

    el('copyBtn').addEventListener('click', function () {
      copyResult(tool, result);
    });
    dash.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function copyResult(tool, result) {
    var lines = ['FitPlan — ' + tool.name];
    if (result.formula) lines.push('Formula: ' + result.formula);
    if (result.main) lines.push(result.main.value + ' — ' + result.main.label);
    (result.stats || []).forEach(function (s) { lines.push(s.label + ': ' + s.value); });
    if (result.explanation) lines.push('\n' + result.explanation);
    (result.tips || []).forEach(function (t) { lines.push('• ' + t); });
    if (result.recommend) lines.push('\nRecommended: ' + result.recommend.map(function (r) { return r.cta; }).join(', '));
    lines.push('\nFitPlan — free fitness & nutrition tools');

    var text = lines.join('\n');
    function done() {
      var b = el('copyBtn');
      var old = b.innerHTML;
      b.innerHTML = '<i data-lucide="check" style="width:14px;height:14px"></i> Copied';
      if (window.lucide) lucide.createIcons();
      setTimeout(function () { b.innerHTML = old; if (window.lucide) lucide.createIcons(); }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
  }

  /* ================= food database ================= */

  var FALLBACK_FOODS = [
    { id: 'boiled-egg', name: 'Boiled Egg (whole)', source: 'USDA reference values', per100: { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, sugar: 1.1, sodium: 124, cholesterol: 373 }, units: [{ label: '1 large (50g)', g: 50 }, { label: '100g', g: 100 }] },
    { id: 'chicken-breast', name: 'Chicken Breast (raw)', source: 'USDA reference values', per100: { calories: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, sodium: 48, cholesterol: 73 }, units: [{ label: '100g', g: 100 }, { label: '1 breast (174g)', g: 174 }] },
    { id: 'white-rice', name: 'White Rice (cooked)', source: 'USDA reference values', per100: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1, cholesterol: 0 }, units: [{ label: '1 cup (158g)', g: 158 }, { label: '100g', g: 100 }] },
    { id: 'banana', name: 'Banana (raw)', source: 'USDA reference values', per100: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, sodium: 1, cholesterol: 0 }, units: [{ label: '1 medium (118g)', g: 118 }, { label: '100g', g: 100 }] }
  ];

  function loadFoods() {
    if (state.foodLoaded) return;
    state.foodLoaded = true;
    fetch('foods-data.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        state.foods = data.foods || [];
        state.foodMeta = { verified: data.last_verified, note: data.source_note };
      })
      .catch(function () {
        state.foods = FALLBACK_FOODS;
        state.foodMeta = { verified: null, note: 'Offline reference data' };
      })
      .then(function () {
        renderFoodDB();
        initMealBuilder();
      });
  }

  function foodRows(filtered) {
    var rows = filtered.map(function (f) {
      var grams = 100;
      var unitIndex = 0;
      return '<tr data-food="' + esc(f.id) + '">' +
        '<td class="food-name">' + esc(f.name) + '</td>' +
        '<td class="food-serving"><input type="number" inputmode="decimal" class="f-qty" value="1" min="0.1" step="any" data-key="qty" aria-label="Serving quantity for ' + esc(f.name) + '">' +
        '<select class="f-unit" data-key="unit" aria-label="Serving unit for ' + esc(f.name) + '">' +
        f.units.map(function (u, i) { return '<option value="' + i + '">' + esc(u.label) + '</option>'; }).join('') +
        '</select></td>' +
        '<td data-k="calories" class="num">' + F.fmt(f.per100.calories, 0) + '</td>' +
        '<td data-k="protein" class="num">' + F.fmt(f.per100.protein, 1) + '</td>' +
        '<td data-k="carbs" class="num">' + F.fmt(f.per100.carbs, 1) + '</td>' +
        '<td data-k="fat" class="num">' + F.fmt(f.per100.fat, 1) + '</td>' +
        '<td data-k="fiber" class="num">' + F.fmt(f.per100.fiber, 1) + '</td>' +
        '<td data-k="sugar" class="num">' + F.fmt(f.per100.sugar, 1) + '</td>' +
        '<td data-k="sodium" class="num">' + F.fmt(f.per100.sodium, 0) + '</td>' +
        '<td data-k="cholesterol" class="num">' + F.fmt(f.per100.cholesterol, 0) + '</td>' +
        '</tr>';
    }).join('');
    return rows;
  }

  function renderFoodDB() {
    var wrap = el('foodTable');
    var empty = el('foodEmpty');
    var q = (el('foodSearch').value || '').trim().toLowerCase();
    var filtered = state.foods.filter(function (f) {
      return !q || f.name.toLowerCase().indexOf(q) !== -1;
    });
    if (!filtered.length) {
      wrap.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    wrap.innerHTML = foodRows(filtered);
    var meta = el('foodMeta');
    if (meta) {
      var verified = state.foodMeta && state.foodMeta.verified;
      meta.textContent = verified
        ? 'Nutrition per selected serving · Source: USDA FoodData Central (+ ICMR-NIN for paneer, label data for whey) · Last verified ' + verified
        : 'Nutrition per selected serving · ' + (state.foodMeta ? state.foodMeta.note : '');
    }
    if (window.lucide) lucide.createIcons();
    wireFoodTable();
  }

  function wireFoodTable() {
    var table = el('foodTable');
    table.querySelectorAll('tr[data-food]').forEach(function (tr) {
      tr.querySelectorAll('.f-qty').forEach(function (inp) {
        inp.addEventListener('input', updateFoodRow);
      });
      tr.querySelectorAll('.f-unit').forEach(function (sel) {
        sel.addEventListener('change', updateFoodRow);
      });
    });
  }

  function updateFoodRow() {
    var tr = this.closest('tr');
    var food = state.foods.find(function (f) { return f.id === tr.getAttribute('data-food'); });
    if (!food) return;
    var qty = parseFloat(tr.querySelector('.f-qty').value) || 0;
    var unit = food.units[parseInt(tr.querySelector('.f-unit').value, 10) || 0];
    var factor = (qty * unit.g) / 100;
    ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'cholesterol'].forEach(function (k) {
      var cell = tr.querySelector('[data-k="' + k + '"]');
      if (cell) cell.textContent = F.fmt(food.per100[k] * factor, k === 'calories' || k === 'sodium' || k === 'cholesterol' ? 0 : 1);
    });
  }

  /* ================= meal builder ================= */

  function initMealBuilder() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('fitplan_meal') || 'null'); } catch (e) { saved = null; }
    state.meal = saved && saved.items ? saved.items : [];
    renderMealList();
    renderMealPicker();
  }

  function mealLookup(query) {
    var q = (query || '').toLowerCase().trim();
    if (!q) return [];
    return state.foods.filter(function (f) { return f.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 6);
  }

  function renderMealPicker() {
    var wrap = el('mealPicker');
    var list = el('mealSuggest');
    var q = el('mealSearch').value || '';
    var found = mealLookup(q);
    if (!found.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = found.map(function (f) {
      return '<button type="button" class="suggest" data-food="' + esc(f.id) + '">' +
        '<span>' + esc(f.name) + '</span>' +
        '<span class="suggest-meta">' + F.fmt(f.per100.calories, 0) + ' kcal / 100g</span>' +
        '</button>';
    }).join('');
    list.querySelectorAll('.suggest').forEach(function (b) {
      b.addEventListener('click', function () {
        addToMeal(b.getAttribute('data-food'));
      });
    });
  }

  function addToMeal(foodId) {
    var food = state.foods.find(function (f) { return f.id === foodId; });
    if (!food) return;
    var existing = state.meal.find(function (m) { return m.id === foodId; });
    if (existing) {
      existing.qty += 1;
    } else {
      state.meal.push({ id: foodId, qty: 1, unit: 0 });
    }
    renderMealList();
    el('mealSearch').value = '';
    renderMealPicker();
  }

  function mealTotals() {
    var t = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    state.meal.forEach(function (m) {
      var food = state.foods.find(function (f) { return f.id === m.id; });
      if (!food) return;
      var factor = (m.qty * (food.units[m.unit] ? food.units[m.unit].g : 100)) / 100;
      t.calories += food.per100.calories * factor;
      t.protein += food.per100.protein * factor;
      t.carbs += food.per100.carbs * factor;
      t.fat += food.per100.fat * factor;
      t.fiber += food.per100.fiber * factor;
    });
    return t;
  }

  function renderMealList() {
    var wrap = el('mealList');
    var empty = el('mealEmpty');
    var totals = mealTotals();
    if (!state.meal.length) {
      wrap.innerHTML = '';
      if (empty) empty.hidden = false;
    } else {
      if (empty) empty.hidden = true;
      wrap.innerHTML = state.meal.map(function (m, idx) {
        var food = state.foods.find(function (f) { return f.id === m.id; });
        if (!food) return '';
        var factor = (m.qty * (food.units[m.unit] ? food.units[m.unit].g : 100)) / 100;
        return '<div class="meal-item" data-idx="' + idx + '">' +
          '<div class="meal-name">' + esc(food.name) + '</div>' +
          '<div class="meal-controls">' +
          '<input type="number" inputmode="decimal" class="m-qty" value="' + m.qty + '" min="0.1" step="any" aria-label="Quantity">' +
          '<select class="m-unit" aria-label="Unit">' +
          food.units.map(function (u, i) { return '<option value="' + i + '"' + (i === m.unit ? ' selected' : '') + '>' + esc(u.label) + '</option>'; }).join('') +
          '</select>' +
          '<button type="button" class="m-remove" aria-label="Remove ' + esc(food.name) + '"><i data-lucide="x" style="width:14px;height:14px"></i></button>' +
          '</div>' +
          '<div class="meal-nutri"><span>' + F.fmt(food.per100.calories * factor, 0) + ' kcal</span><span>P ' + F.fmt(food.per100.protein * factor, 1) + 'g</span><span>C ' + F.fmt(food.per100.carbs * factor, 1) + 'g</span><span>F ' + F.fmt(food.per100.fat * factor, 1) + 'g</span></div>' +
          '</div>';
      }).join('');
    }
    renderMealTotals(totals);
    if (window.lucide) lucide.createIcons();
    wireMealList();
    saveMeal();
  }

  function renderMealTotals(t) {
    var wrap = el('mealTotals');
    if (!wrap) return;
    wrap.innerHTML = [
      { l: 'Calories', v: F.fmt(t.calories, 0) + ' kcal', tone: 't-accent' },
      { l: 'Protein', v: F.fmt(t.protein, 1) + ' g', tone: 't-blue' },
      { l: 'Carbs', v: F.fmt(t.carbs, 1) + ' g', tone: 't-green' },
      { l: 'Fat', v: F.fmt(t.fat, 1) + ' g', tone: 't-orange' },
      { l: 'Fiber', v: F.fmt(t.fiber, 1) + ' g', tone: 't-gold' }
    ].map(function (s) {
      return '<div class="stat"><span class="stat-val ' + s.tone + '">' + s.v + '</span><span class="stat-lbl">' + s.l + '</span></div>';
    }).join('');
  }

  function wireMealList() {
    el('mealList').querySelectorAll('.meal-item').forEach(function (item) {
      var idx = parseInt(item.getAttribute('data-idx'), 10);
      item.querySelector('.m-qty').addEventListener('input', function () {
        var v = parseFloat(this.value);
        if (isFinite(v) && v > 0) state.meal[idx].qty = v;
        renderMealList();
      });
      item.querySelector('.m-unit').addEventListener('change', function () {
        state.meal[idx].unit = parseInt(this.value, 10);
        renderMealList();
      });
      item.querySelector('.m-remove').addEventListener('click', function () {
        state.meal.splice(idx, 1);
        renderMealList();
      });
    });
  }

  function saveMeal() {
    try { localStorage.setItem('fitplan_meal', JSON.stringify({ items: state.meal, savedAt: Date.now() })); } catch (e) { /* noop */ }
  }

  function clearMeal() {
    state.meal = [];
    renderMealList();
  }

  /* ================= init ================= */

  function init() {
    renderChips();
    renderGrid();

    var catWrap = el('catFilters');
    if (catWrap) catWrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]');
      if (!b) return;
      state.cat = b.getAttribute('data-cat');
      renderChips();
      renderGrid();
    });

    ['toolSearch', 'heroSearch'].forEach(function (id) {
      var inp = el(id);
      if (!inp) return;
      inp.addEventListener('input', function () {
        state.query = this.value;
        renderGrid();
      });
    });

    var foodSearch = el('foodSearch');
    if (foodSearch) foodSearch.addEventListener('input', function () { renderFoodDB(); });

    var mealSearch = el('mealSearch');
    if (mealSearch) mealSearch.addEventListener('input', renderMealPicker);

    var clearBtn = el('mealClear');
    if (clearBtn) clearBtn.addEventListener('click', clearMeal);

    var saveBtn = el('mealSave');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var b = saveBtn;
      b.textContent = 'Meal saved — sync coming soon';
      b.disabled = true;
      setTimeout(function () { b.textContent = 'Save meal'; b.disabled = false; }, 2200);
    });

    // hero feature shortcuts
    document.querySelectorAll('[data-open-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-open-tool');
        if (id === 'meal-builder') { el('meal-builder').scrollIntoView({ behavior: 'smooth' }); }
        else if (id === 'food-db') { el('food-db').scrollIntoView({ behavior: 'smooth' }); }
        else openTool(id);
      });
    });

    loadFoods();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
