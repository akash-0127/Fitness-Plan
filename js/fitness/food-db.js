/* FitPlan Food Nutrition Database — standalone page logic.
   Loads foods-data.json and renders a searchable, serving-adjustable table. */

(function () {
  'use strict';

  var F = window.FitFormulas;

  var FALLBACK_FOODS = [
    { id: 'boiled-egg', name: 'Boiled Egg (whole)', source: 'USDA reference values', per100: { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, sugar: 1.1, sodium: 124, cholesterol: 373 }, units: [{ label: '1 large (50g)', g: 50 }, { label: '100g', g: 100 }] },
    { id: 'chicken-breast', name: 'Chicken Breast (raw)', source: 'USDA reference values', per100: { calories: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0, sugar: 0, sodium: 48, cholesterol: 73 }, units: [{ label: '100g', g: 100 }, { label: '1 breast (174g)', g: 174 }] },
    { id: 'white-rice', name: 'White Rice (cooked)', source: 'USDA reference values', per100: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1, cholesterol: 0 }, units: [{ label: '1 cup (158g)', g: 158 }, { label: '100g', g: 100 }] },
    { id: 'banana', name: 'Banana (raw)', source: 'USDA reference values', per100: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, sodium: 1, cholesterol: 0 }, units: [{ label: '1 medium (118g)', g: 118 }, { label: '100g', g: 100 }] }
  ];

  var foods = [];
  var foodMeta = { verified: null, note: 'Loading nutrition data…' };

  var search = document.getElementById('foodSearch');
  var tbody = document.getElementById('foodTable');
  var empty = document.getElementById('foodEmpty');
  var meta = document.getElementById('foodMeta');

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function rowHTML(f) {
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
  }

  function render() {
    var q = (search.value || '').trim().toLowerCase();
    var filtered = foods.filter(function (f) {
      return !q || f.name.toLowerCase().indexOf(q) !== -1;
    });
    if (!filtered.length) {
      tbody.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      tbody.innerHTML = filtered.map(rowHTML).join('');
      wireTable();
    }
    if (meta) {
      meta.textContent = foodMeta.verified
        ? 'Nutrition per selected serving · Source: USDA FoodData Central (+ ICMR-NIN for paneer, label data for whey) · Last verified ' + foodMeta.verified
        : 'Nutrition per selected serving · ' + (foodMeta.note || '');
    }
  }

  function updateRow() {
    var tr = this.closest('tr');
    var food = foods.find(function (f) { return f.id === tr.getAttribute('data-food'); });
    if (!food) return;
    var qty = parseFloat(tr.querySelector('.f-qty').value) || 0;
    var unit = food.units[parseInt(tr.querySelector('.f-unit').value, 10) || 0];
    var factor = (qty * unit.g) / 100;
    ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'cholesterol'].forEach(function (k) {
      var cell = tr.querySelector('[data-k="' + k + '"]');
      if (cell) cell.textContent = F.fmt(food.per100[k] * factor, k === 'calories' || k === 'sodium' || k === 'cholesterol' ? 0 : 1);
    });
  }

  function wireTable() {
    tbody.querySelectorAll('tr[data-food]').forEach(function (tr) {
      tr.querySelectorAll('.f-qty').forEach(function (inp) {
        inp.addEventListener('input', updateRow);
      });
      tr.querySelectorAll('.f-unit').forEach(function (sel) {
        sel.addEventListener('change', updateRow);
      });
    });
  }

  function load() {
    fetch('foods-data.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        foods = data.foods || [];
        foodMeta = { verified: data.last_verified, note: data.source_note };
      })
      .catch(function () {
        foods = FALLBACK_FOODS;
        foodMeta = { verified: null, note: 'Offline reference data' };
      })
      .then(render);
  }

  search.addEventListener('input', render);
  load();
})();
