/**
 * Spoonacular API integration — fetches real recipes with per-serving nutrition.
 *
 * Requires API_KEYS.spoonacular to be set in api-config.js.
 * Free tier: 150 requests/day — https://spoonacular.com/food-api
 */
var Spoonacular = (function () {
  var BASE = 'https://api.spoonacular.com';

  var DIET_MAP = {
    veg_dairy: 'vegetarian',
    vegan: 'vegan',
    pescatarian: 'pescetarian',
    veg_nodairy: 'vegetarian',
    keto: 'paleo'
  };

  var EXCLUDE_MAP = {
    eggetarian: 'beef,pork,chicken,lamb,fish,shrimp',
    egge_nodairy: 'beef,pork,chicken,lamb,fish,shrimp'
  };

  function search(diet, maxCal, count) {
    if (!API_KEYS || !API_KEYS.spoonacular) return Promise.resolve(null);
    var url = BASE + '/recipes/complexSearch?number=' + (count || 15) +
      '&addRecipeNutrition=true&fillIngredients=true&instructionsRequired=true';
    var d = DIET_MAP[diet] || '';
    if (d) url += '&diet=' + encodeURIComponent(d);
    var ex = EXCLUDE_MAP[diet] || '';
    if (ex) url += '&exclude=' + encodeURIComponent(ex);
    if (maxCal) url += '&maxCalories=' + Math.round(maxCal * 1.3);
    url += '&apiKey=' + API_KEYS.spoonacular;
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var results = d.results || [];
        return results.map(function (r) {
          var nuts = {};
          if (r.nutrition && r.nutrition.nutrients) {
            r.nutrition.nutrients.forEach(function (n) {
              var k = n.name.toLowerCase();
              if (k === 'calories') nuts.cal = Math.round(n.amount);
              else if (k === 'protein') nuts.prot = Math.round(n.amount);
              else if (k === 'carbohydrates') nuts.carb = Math.round(n.amount);
              else if (k === 'fat') nuts.fat = Math.round(n.amount);
            });
          }
          return {
            id: r.id,
            title: r.title || 'Recipe',
            cal: nuts.cal || 0,
            prot: nuts.prot || 0,
            carb: nuts.carb || 0,
            fat: nuts.fat || 0,
            time: r.readyInMinutes || 0,
            image: r.image || '',
            url: r.sourceUrl || ''
          };
        });
      })
      .catch(function () { return null; });
  }

  function pick(recipes, targetCal, targetProt) {
    if (!recipes || !recipes.length) return null;
    var scored = recipes.map(function (r) {
      var calDiff = Math.abs(r.cal - targetCal);
      return { r: r, score: calDiff };
    });
    scored.sort(function (a, b) { return a.score - b.score; });
    return scored[0].r;
  }

  return { search: search, pick: pick };
})();
