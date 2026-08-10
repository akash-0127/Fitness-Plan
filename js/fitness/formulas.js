/* FitPlan Fitness Tools — pure calculation utilities.
   No DOM access. Every function is unit-tested-friendly and reusable.
   Formulas follow accepted scientific standards (WHO, Mifflin-St Jeor,
   U.S. Navy, Devine, Epley, MET compendium, National Sleep Foundation). */

(function (global) {
  'use strict';

  var F = {};

  /* ---------------- units ---------------- */

  var KG_PER_LB = 0.45359237;
  var CM_PER_IN = 2.54;

  F.lbToKg = function (lb) { return lb * KG_PER_LB; };
  F.kgToLb = function (kg) { return kg / KG_PER_LB; };
  F.inToCm = function (inchs) { return inchs * CM_PER_IN; };
  F.cmToIn = function (cm) { return cm / CM_PER_IN; };

  // Normalize display-unit inputs to metric. Returns { weightKg, heightCm } or null.
  F.metric = function (input, units) {
    var weightKg = F.weightFrom(input, units);
    var heightCm = F.heightFrom(input, units);
    if (!weightKg || !heightCm || heightCm < 50 || heightCm > 260 || weightKg < 20 || weightKg > 350) return null;
    return { weightKg: weightKg, heightCm: heightCm };
  };

  // Extract only the weight (kg) from inputs, or null when missing.
  // Per-field unit: value in `input.weight` with unit flag in `input.weightUnit` (lb or kg).
  // Legacy fallback: `input.weightKg` / `input.weightLb` (used by older callers).
  F.weightFrom = function (input, units) {
    if (input && input.weight !== undefined && input.weight !== '') {
      var w = parseFloat(input.weight);
      if (isFinite(w) && w > 0) return (input.weightUnit === 'lb') ? F.lbToKg(w) : w;
      return null;
    }
    if (input) {
      var kg = parseFloat(input.weightKg);
      if (isFinite(kg) && kg > 0) return kg;
      var lb = parseFloat(input.weightLb);
      if (isFinite(lb) && lb > 0) return F.lbToKg(lb);
    }
    return null;
  };

  // Extract only the height (cm) from inputs, or null when missing.
  // Per-field unit: value in `input.height` with unit flag in `input.heightUnit` (in or cm).
  // Legacy fallback: `input.heightCm` / `input.heightFt` + `input.heightIn`.
  F.heightFrom = function (input, units) {
    if (input && input.height !== undefined && input.height !== '') {
      var h = parseFloat(input.height);
      if (isFinite(h) && h > 0) return (input.heightUnit === 'in') ? F.inToCm(h) : h;
      return null;
    }
    if (input) {
      var cm = parseFloat(input.heightCm);
      if (isFinite(cm) && cm > 0) return cm;
      var ft = parseFloat(input.heightFt);
      var inch = parseFloat(input.heightIn);
      if (isFinite(ft) && ft >= 0 && isFinite(inch) && inch >= 0) return F.inToCm(ft * 12 + inch);
    }
    return null;
  };

  /* ---------------- BMI (WHO standard) ---------------- */

  F.bmi = function (weightKg, heightCm) {
    var h = heightCm / 100;
    return weightKg / (h * h);
  };

  F.bmiCategory = function (bmi) {
    if (bmi < 18.5) return { label: 'Underweight', tone: 'blue' };
    if (bmi < 25) return { label: 'Normal weight', tone: 'green' };
    if (bmi < 30) return { label: 'Overweight', tone: 'orange' };
    return { label: 'Obese', tone: 'red' };
  };

  F.healthyWeightRange = function (heightCm) {
    var h = heightCm / 100;
    return [18.5 * h * h, 24.9 * h * h];
  };

  /* ---------------- BMR (Mifflin-St Jeor) ---------------- */

  F.bmr = function (weightKg, heightCm, age, sex) {
    var base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === 'female' ? base - 161 : base + 5;
  };

  F.ACTIVITY = {
    sedentary: { label: 'Sedentary (little or no exercise)', mult: 1.2 },
    light: { label: 'Lightly active (1–3 days/week)', mult: 1.375 },
    moderate: { label: 'Moderately active (3–5 days/week)', mult: 1.55 },
    active: { label: 'Very active (6–7 days/week)', mult: 1.725 },
    athlete: { label: 'Athlete (physical job / 2x training)', mult: 1.9 }
  };

  F.tdee = function (bmr, activityKey) {
    var a = F.ACTIVITY[activityKey] || F.ACTIVITY.sedentary;
    return bmr * a.mult;
  };

  /* ---------------- Body fat (U.S. Navy method, inches) ---------------- */

  F.navyBodyFat = function (sex, waistIn, neckIn, hipIn, heightIn) {
    if (sex === 'female') {
      return 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
    }
    return 86.010 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
  };

  F.bodyFatCategory = function (sex, bf) {
    if (sex === 'female') {
      if (bf < 10) return { label: 'Essential fat', tone: 'blue' };
      if (bf < 21) return { label: 'Athletes', tone: 'green' };
      if (bf < 25) return { label: 'Fitness', tone: 'green' };
      if (bf < 32) return { label: 'Acceptable', tone: 'orange' };
      return { label: 'Obese range', tone: 'red' };
    }
    if (bf < 2) return { label: 'Essential fat', tone: 'blue' };
    if (bf < 6) return { label: 'Athletes', tone: 'green' };
    if (bf < 14) return { label: 'Fitness', tone: 'green' };
    if (bf < 18) return { label: 'Acceptable', tone: 'orange' };
    return { label: 'Obese range', tone: 'red' };
  };

  /* ---------------- Lean body mass / FFMI ---------------- */

  F.lbm = function (weightKg, bodyFatPct) {
    return weightKg * (1 - bodyFatPct / 100);
  };

  F.ffmi = function (lbmKg, heightCm) {
    var h = heightCm / 100;
    return lbmKg / (h * h);
  };

  F.ffmiAdjusted = function (ffmi, heightCm) {
    return ffmi + 6.1 * (1.8 - heightCm / 100);
  };

  /* ---------------- Ideal weight (Devine) ---------------- */

  F.devineIdeal = function (sex, heightIn) {
    var base = sex === 'female' ? 45.5 : 50;
    var over = heightIn - 60;
    if (over < 0) over = 0;
    return base + 2.3 * over;
  };

  /* ---------------- Weight goal engine (1 kg bodyweight ≈ 7700 kcal) ---------------- */

  // direction: 'loss' | 'gain'
  F.goalPlan = function (opt) {
    var weightKg = opt.weightKg;
    var targetKg = opt.targetKg;
    var weeks = opt.weeks;
    var tdee = opt.tdee;
    var direction = opt.direction || 'loss';

    var delta = targetKg - weightKg; // positive = gain
    if (direction === 'loss') delta = -delta; // weight loss amount
    delta = Math.max(0, delta); // only plan for the direction requested

    var days = Math.max(1, weeks * 7);
    var totalKcal = delta * 7700;
    var kcalPerDay = totalKcal / days;

    var dailyTarget = direction === 'loss' ? tdee - kcalPerDay : tdee + kcalPerDay;
    var weeklyRate = delta / weeks;

    var est = new Date(Date.now() + days * 86400000);
    var estDate = est.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    // Safe-rate check: max ~1 kg/week for loss; ~0.5 kg/week gain recommended.
    var safeLimit = direction === 'loss' ? 1 : 0.5;
    var safe = weeklyRate <= safeLimit;
    var tooSteep = weeklyRate > (direction === 'loss' ? 1.5 : 1);

    return {
      deltaKg: delta,
      totalKcal: totalKcal,
      kcalPerDay: kcalPerDay,
      dailyTarget: dailyTarget,
      weeklyRate: weeklyRate,
      safe: safe,
      tooSteep: tooSteep,
      safeLimit: safeLimit,
      days: days,
      estDate: estDate
    };
  };

  F.completionFromDeficit = function (opt) {
    var deltaKg = Math.abs(opt.targetKg - opt.weightKg);
    var perDay = Math.abs(opt.kcalPerDay) || 1;
    var days = Math.ceil((deltaKg * 7700) / perDay);
    var est = new Date(Date.now() + days * 86400000);
    return {
      days: days,
      totalKcal: deltaKg * 7700,
      estDate: est.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
      weeklyRate: deltaKg / (days / 7)
    };
  };

  /* ---------------- Nutrition ---------------- */

  F.PROTEIN_PER_KG = {
    maintenance: [1.2, 1.8],
    'fat-loss': [1.6, 2.2],
    'muscle-gain': [1.6, 2.2],
    recomp: [1.6, 2.2]
  };

  F.proteinRange = function (weightKg, goal) {
    var r = F.PROTEIN_PER_KG[goal] || F.PROTEIN_PER_KG.maintenance;
    return [r[0] * weightKg, r[1] * weightKg];
  };

  F.fatRangeFromCalories = function (calories) {
    return [calories * 0.2 / 9, calories * 0.35 / 9];
  };

  F.carbsFromRemainder = function (calories, proteinG, fatG) {
    var remaining = calories - proteinG * 4 - fatG * 9;
    return Math.max(0, remaining / 4);
  };

  // Returns central protein/fat/carbs grams + calories + % of total.
  F.macroSplit = function (opt) {
    var calories = opt.calories;
    var weightKg = opt.weightKg;
    var goal = opt.goal || 'maintenance';

    var proteinG = Math.round(opt.proteinG || (F.PROTEIN_PER_KG[goal] ? F.PROTEIN_PER_KG[goal][0] : 1.6) * weightKg);
    var fatPct = goal === 'maintenance' ? 0.3 : 0.25;
    var fatG = Math.round((calories * fatPct) / 9);
    var carbG = Math.round(F.carbsFromRemainder(calories, proteinG, fatG));

    var proteinCal = proteinG * 4;
    var fatCal = fatG * 9;
    var carbCal = carbG * 4;

    return {
      protein: { grams: proteinG, calories: proteinCal, pct: Math.round((proteinCal / calories) * 100) },
      fat: { grams: fatG, calories: fatCal, pct: Math.round((fatCal / calories) * 100) },
      carbs: { grams: carbG, calories: carbCal, pct: Math.round((carbCal / calories) * 100) }
    };
  };

  F.waterIntake = function (weightKg, exerciseMin) {
    var low = Math.round(weightKg * 30);
    var high = Math.round(weightKg * 35);
    var extra = Math.floor((exerciseMin || 0) / 30) * 350;
    return { low: low, high: high, extra: extra };
  };

  F.fiber = function (calories, sex) {
    var byKcal = Math.round(calories * 14 / 1000);
    var bySex = sex === 'female' ? 25 : 38;
    return { byKcal: byKcal, range: [Math.min(byKcal, bySex), Math.max(byKcal, bySex)] };
  };

  /* ---------------- Workout ---------------- */

  // kcal = MET × weight(kg) × duration(hours)
  F.metCalories = function (met, weightKg, minutes) {
    return met * weightKg * (minutes / 60);
  };

  F.MET = {
    'walk-slow': { label: 'Walking — slow (2 mph)', met: 2.8 },
    'walk-moderate': { label: 'Walking — moderate (3 mph)', met: 3.5 },
    'walk-brisk': { label: 'Walking — brisk (4 mph)', met: 4.3 },
    'run-5': { label: 'Running — 5 mph (8 km/h)', met: 8.3 },
    'run-6': { label: 'Running — 6 mph (9.7 km/h)', met: 9.8 },
    'run-7': { label: 'Running — 7 mph (11.3 km/h)', met: 11.0 },
    'run-8': { label: 'Running — 8 mph (12.9 km/h)', met: 11.8 },
    'cycle-leisure': { label: 'Cycling — leisure (10 mph)', met: 4.0 },
    'cycle-mod': { label: 'Cycling — moderate (12–14 mph)', met: 8.0 },
    'cycle-vig': { label: 'Cycling — vigorous (14–16 mph)', met: 10.0 },
    'swim-light': { label: 'Swimming — light effort', met: 6.0 },
    'swim-mod': { label: 'Swimming — moderate effort', met: 8.0 },
    'swim-vig': { label: 'Swimming — vigorous effort', met: 10.0 },
    'lifting-mod': { label: 'Weight lifting — light/moderate', met: 3.5 },
    'lifting-vig': { label: 'Weight lifting — vigorous', met: 6.0 },
    hiit: { label: 'HIIT / circuit training', met: 8.0 },
    yoga: { label: 'Yoga / stretching', met: 2.5 },
    stairs: { label: 'Stairs climbing', met: 8.8 }
  };

  F.activityIntensity = function (met) {
    if (met < 3) return 'Light effort';
    if (met < 6) return 'Moderate effort';
    if (met < 9) return 'Vigorous effort';
    return 'Very vigorous effort';
  };

  // Epley: 1RM = weight × (1 + reps/30)
  F.epley1rm = function (weight, reps) {
    return weight * (1 + reps / 30);
  };

  F.percentOf1rm = function (reps) {
    // approximate %1RM by reps (standard load–reps curve)
    return Math.round(100 / (1 + reps / 30));
  };

  F.paceFromTimeDistance = function (distanceKm, minutes) {
    if (!distanceKm || distanceKm <= 0) return null;
    var pacePerKm = minutes / distanceKm;
    var speedKmh = distanceKm / (minutes / 60);
    var paceMin = Math.floor(pacePerKm);
    var paceSec = Math.round((pacePerKm - paceMin) * 60);
    if (paceSec === 60) { paceSec = 0; paceMin++; }
    var splits = {};
    var d = { '5K': 5, '10K': 10, 'Half marathon': 21.0975, 'Marathon': 42.195 };
    for (var k in d) {
      splits[k] = { minutes: Math.round(d[k] * pacePerKm) };
    }
    return {
      pacePerKm: pacePerKm,
      paceMin: paceMin,
      paceSec: paceSec,
      speedKmh: speedKmh,
      speedMph: speedKmh / 1.60934,
      splits: splits
    };
  };

  /* ---------------- Health ---------------- */

  F.SLEEP = [
    { min: 0, max: 3, label: '0–3 months', hours: [14, 17] },
    { min: 4, max: 11, label: '4–11 months', hours: [12, 15] },
    { min: 12, max: 23, label: '1–2 years', hours: [11, 14] },
    { min: 2, max: 5, label: '3–5 years', hours: [10, 13] },
    { min: 6, max: 13, label: '6–13 years', hours: [9, 11] },
    { min: 14, max: 17, label: '14–17 years', hours: [8, 10] },
    { min: 18, max: 64, label: '18–64 years', hours: [7, 9] },
    { min: 65, max: 130, label: '65+ years', hours: [7, 8] }
  ];

  F.sleepForAge = function (age) {
    for (var i = 0; i < F.SLEEP.length; i++) {
      var r = F.SLEEP[i];
      if (age >= r.min && age <= r.max) return r;
    }
    return F.SLEEP[6];
  };

  F.BODYFAT_RANGES = {
    female: [
      { label: 'Essential fat', range: '10–13%', tone: 'blue' },
      { label: 'Athletes', range: '14–20%', tone: 'green' },
      { label: 'Fitness', range: '21–24%', tone: 'green' },
      { label: 'Acceptable', range: '25–31%', tone: 'orange' },
      { label: 'Obese', range: '32%+', tone: 'red' }
    ],
    male: [
      { label: 'Essential fat', range: '2–5%', tone: 'blue' },
      { label: 'Athletes', range: '6–13%', tone: 'green' },
      { label: 'Fitness', range: '14–17%', tone: 'green' },
      { label: 'Acceptable', range: '18–24%', tone: 'orange' },
      { label: 'Obese', range: '25%+', tone: 'red' }
    ]
  };

  /* ---------------- helpers ---------------- */

  F.round = function (n, d) {
    var p = Math.pow(10, d === undefined ? 1 : d);
    return Math.round(n * p) / p;
  };

  F.validate = function (fields, values) {
    var errors = {};
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var raw = values[f.key];
      var num = parseFloat(raw);
      if (raw === '' || raw === undefined || raw === null) {
        errors[f.key] = f.label + ' is required';
      } else if (!isFinite(num)) {
        errors[f.key] = 'Enter a valid number';
      } else if (f.min !== undefined && num < f.min) {
        errors[f.key] = f.label + ' must be at least ' + f.min;
      } else if (f.max !== undefined && num > f.max) {
        errors[f.key] = f.label + ' must be at most ' + f.max;
      }
    }
    return errors;
  };

  F.addDays = function (days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  F.fmt = function (n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toLocaleString(undefined, { maximumFractionDigits: d === undefined ? 1 : d });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = F;
  global.FitFormulas = F;
})(typeof window !== 'undefined' ? window : global);
