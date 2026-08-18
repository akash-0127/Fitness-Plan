/**
 * Wger.de API integration — fetches real exercises with muscle/equipment data.
 *
 * Requires API_KEYS.wger to be set in api-config.js.
 * Sign up free at https://wger.de → https://wger.de/user/api-token/
 */
var Wger = (function () {
  var BASE = 'https://wger.de/api/v2';

  /* Wger muscle IDs */
  var M = {
    biceps: 1, frontDelts: 2, sideDelts: 3, chest: 4,
    lats: 5, adductors: 6, glutes: 7, hamstrings: 8,
    calves: 9, traps: 10, abs: 11, obliques: 13,
    triceps: 14, forearm: 15
  };

  /* Wger equipment IDs */
  var E = { barbell: 1, dumbbell: 2, bench: 3, cable: 4, machine: 5, bodyweight: 6 };

  /* Maps user equipment choice → Wger equipment IDs */
  var EQUIP_MAP = {
    gym_full: [E.barbell, E.dumbbell, E.bench, E.cable, E.machine],
    gym_basic: [E.barbell, E.dumbbell, E.bench],
    home: [E.dumbbell, E.bodyweight],
    resistance_band: [E.bodyweight],
    dumbbell_only: [E.dumbbell],
    barbell_only: [E.barbell]
  };

  /* Maps split + day focus → muscle IDs */
  var SPLIT_MUSCLES = {
    ppl: {
      push: [M.chest, M.frontDelts, M.sideDelts, M.triceps],
      pull: [M.lats, M.biceps, M.traps, M.forearm],
      legs: [M.adductors, M.hamstrings, M.glutes, M.calves]
    },
    upper_lower: {
      upper: [M.chest, M.lats, M.frontDelts, M.sideDelts, M.biceps, M.triceps],
      lower: [M.adductors, M.hamstrings, M.glutes, M.calves]
    },
    fullbody: {
      full: [M.chest, M.lats, M.frontDelts, M.biceps, M.triceps, M.adductors, M.hamstrings, M.glutes, M.abs]
    },
    bro: {
      chest: [M.chest], back: [M.lats, M.traps], shoulders: [M.frontDelts, M.sideDelts],
      arms: [M.biceps, M.triceps, M.forearm], legs: [M.adductors, M.hamstrings, M.glutes, M.calves]
    },
    push_pull_legs: {
      push: [M.chest, M.frontDelts, M.sideDelts, M.triceps],
      pull: [M.lats, M.biceps, M.traps, M.forearm],
      legs: [M.adductors, M.hamstrings, M.glutes, M.calves]
    }
  };

  /* Maps day index → focus label for PPL-style splits */
  function dayFocus(split, dayIdx, totalDays) {
    if (split === 'ppl' || split === 'push_pull_legs') {
      var seq = ['push', 'pull', 'legs'];
      return seq[dayIdx % 3];
    }
    if (split === 'upper_lower') return dayIdx % 2 === 0 ? 'upper' : 'lower';
    if (split === 'fullbody') return 'full';
    if (split === 'bro') {
      var bro = ['chest', 'back', 'shoulders', 'arms', 'legs'];
      return bro[dayIdx % bro.length];
    }
    return 'full';
  }

  function getMuscleIds(split, dayIdx, totalDays) {
    var focus = dayFocus(split, dayIdx, totalDays);
    var splitKey = (split === 'push_pull_legs') ? 'ppl' : split;
    return (SPLIT_MUSCLES[splitKey] || SPLIT_MUSCLES.fullbody)[focus] || SPLIT_MUSCLES.fullbody.full;
  }

  function getEquipIds(training) {
    return EQUIP_MAP[training] || EQUIP_MAP.gym_full;
  }

  function fetchExercises(muscleIds, equipIds) {
    if (!API_KEYS || !API_KEYS.wger) return Promise.resolve(null);
    var url = BASE + '/exercise/?language=2&limit=50&status=2';
    if (muscleIds && muscleIds.length) url += '&muscles=' + muscleIds.join(',');
    if (equipIds && equipIds.length) url += '&equipment=' + equipIds.join(',');
    url += '&format=json';
    return fetch(url, {
      headers: { 'Authorization': 'Token ' + API_KEYS.wger }
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        return (d.results || []).map(function (e) {
          return {
            id: e.id,
            name: e.name || '',
            desc: (e.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 120),
            muscles: e.muscles || [],
            equipment: e.equipment || [],
            image: (e.images && e.images[0] && e.images[0].image) || ''
          };
        });
      })
      .catch(function () { return null; });
  }

  /* Assign sets/rest/note based on goal */
  var GOAL_PARAMS = {
    fatloss:    { sets: '3-4x12-15', rest: '45s',  note: 'High reps, short rest — fat burn focus' },
    musclegain: { sets: '4x8-12',    rest: '90s',  note: 'Moderate-heavy, progressive overload' },
    recomp:     { sets: '3-4x10-12', rest: '60s',  note: 'Balanced intensity — recomp focus' },
    strength:   { sets: '4-5x4-6',   rest: '120s', note: 'Heavy compound — strength focus' },
    endurance:  { sets: '3x15-20',   rest: '30s',  note: 'Light weight, high reps — endurance' },
    maintenance:{ sets: '3x10-12',   rest: '60s',  note: 'Moderate intensity — maintain form' }
  };

  function mapToExercise(apiEx, goal) {
    var gp = GOAL_PARAMS[goal] || GOAL_PARAMS.maintenance;
    return {
      name: apiEx.name,
      sets: gp.sets,
      rest: gp.rest,
      note: gp.note
    };
  }

  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MUSCLE_LABELS = {
    push: 'Chest, Shoulders, Triceps', pull: 'Back, Biceps',
    legs: 'Quads, Hamstrings, Glutes, Calves', upper: 'Chest, Back, Shoulders, Arms',
    lower: 'Quads, Hamstrings, Glutes, Calves', full: 'Full Body',
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Biceps, Triceps'
  };
  var WARMUP = {
    push: '5 min treadmill + arm circles + band pull-aparts + shoulder dislocates',
    pull: '5 min rowing + band pull-aparts + cat-cow + dead hangs',
    legs: '5 min bike + bodyweight squats + leg swings + hip circles',
    upper: '5 min rowing + arm circles + band pull-aparts + cat-cow',
    lower: '5 min bike + bodyweight squats + leg swings + hip circles',
    full: '5 min light cardio + full-body dynamic stretches',
    chest: '5 min treadmill + push-ups + chest openers',
    back: '5 min rowing + band pull-aparts + cat-cow',
    shoulders: '5 min treadmill + arm circles + band external rotations',
    arms: '5 min bike + light curls + tricep extensions'
  };
  var FINISHER = {
    fatloss: '10 min HIIT finisher: 30s max effort / 30s rest × 10 rounds',
    musclegain: '5 min cooldown + foam rolling + static stretching',
    recomp: '8 min moderate HIIT: 40s work / 20s rest × 8 rounds',
    strength: '5 min cooldown + mobility work',
    endurance: '10 min steady-state cardio cooldown',
    maintenance: '5 min cooldown + light stretching'
  };

  function fetchAll(training, goal, split, totalDays) {
    if (!API_KEYS || !API_KEYS.wger) return Promise.resolve(null);
    var equipIds = getEquipIds(training);
    var splitKey = (split === 'push_pull_legs') ? 'ppl' : split;
    var allMuscles = [];
    var focusMap = SPLIT_MUSCLES[splitKey] || SPLIT_MUSCLES.fullbody;
    Object.keys(focusMap).forEach(function (k) {
      focusMap[k].forEach(function (m) { if (allMuscles.indexOf(m) < 0) allMuscles.push(m); });
    });
    return fetchExercises(allMuscles, equipIds).then(function (all) {
      if (!all || !all.length) return null;
      var result = [];
      for (var d = 0; d < totalDays; d++) {
        var muscleIds = getMuscleIds(split, d, totalDays);
        var focus = dayFocus(split, d, totalDays);
        var dayExes = all.filter(function (e) {
          return muscleIds.some(function (m) { return e.muscles.indexOf(m) >= 0; });
        });
        if (dayExes.length < 3) dayExes = all.slice(d * 4, d * 4 + 6);
        var shuffled = dayExes.sort(function () { return 0.5 - Math.random(); });
        var picked = shuffled.slice(0, Math.min(6, shuffled.length));
        var focusLabel = focus.charAt(0).toUpperCase() + focus.slice(1);
        result.push({
          day: DAY_NAMES[d] || 'Day ' + (d + 1),
          focus: focusLabel + ' — ' + (MUSCLE_LABELS[focus] || 'Full Body'),
          warmup: WARMUP[focus] || WARMUP.full,
          exercises: picked.map(function (e) { return mapToExercise(e, goal); }),
          finisher: FINISHER[goal] || FINISHER.maintenance
        });
      }
      return result;
    }).catch(function () { return null; });
  }

  return {
    M: M, E: E,
    getMuscleIds: getMuscleIds,
    getEquipIds: getEquipIds,
    fetchExercises: fetchExercises,
    fetchAll: fetchAll
  };
})();
