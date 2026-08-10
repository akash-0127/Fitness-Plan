/* ════════════════════════════════════════════════════════════════
   FitPlan Design System — shared progressive-enhancement JS
   Goal routing · deep links · count-ups · generic stepper/recap.
   Load after ui-enhancements.js. Safe to include on every page.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DS = window.FitPlanDS = window.FitPlanDS || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ── THEME ── */
  function ensureTheme() {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }
  if (typeof window.toggleTheme !== 'function') {
    window.toggleTheme = function () {
      var h = document.documentElement;
      var c = h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      h.setAttribute('data-theme', c);
      localStorage.setItem('theme', c);
    };
  }

  /* ── GOAL ROUTES ── */
  var GOAL_ROUTES = {
    'lose-fat':      { page: 'Meal Plan.html',     goal: 'fatloss' },
    'build-muscle':  { page: 'Workout Plan.html',  goal: 'muscle' },
    'get-stronger':  { page: 'Workout Plan.html',  goal: 'strength' },
    'improve-fitness': { page: 'Combo Plan.html',  goal: 'endurance' }
  };

  var ASK_ROUTES = [
    { keys: ['fat loss', 'lose fat', 'lose weight', 'weight loss', 'cut', 'slim', 'lean', 'belly', 'tummy'], goal: 'lose-fat' },
    { keys: ['muscle', 'muscle gain', 'bulk', 'bigger', 'mass', 'gain weight'], goal: 'build-muscle' },
    { keys: ['strong', 'stronger', 'strength', 'power', 'lift heavier'], goal: 'get-stronger' },
    { keys: ['fit', 'fitness', 'endurance', 'cardio', 'stamina', 'overall'], goal: 'improve-fitness' },
    { keys: ['calorie', 'calories', 'bmr', 'tdee', 'macro', 'protein', 'diet', 'food', 'nutrition', 'bmi'], page: 'fitness-tools.html', tool: 'macro-split' }
  ];

  function route(key) {
    var r = GOAL_ROUTES[key];
    if (r) location.href = r.page + '?goal=' + r.goal;
    return r;
  }
  DS.routeToGoal = route;

  /* ── GOAL CARDS (native <a>, but expose programmatic routing) ── */
  function initGoalCards() {
    $$('.goal-card[data-goal]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        var r = route(card.getAttribute('data-goal'));
        if (!r) return;
        e.preventDefault();
        location.href = r.page + '?goal=' + r.goal;
      });
    });
  }

  /* ── CONVERSATIONAL ASK BAR ── */
  function matchIntent(text) {
    var q = (text || '').toLowerCase().trim();
    if (!q) return null;
    var best = null, bestScore = 0;
    ASK_ROUTES.forEach(function (r) {
      var score = 0;
      r.keys.forEach(function (k) { if (q.indexOf(k) !== -1) score += k.length; });
      if (score > bestScore) { bestScore = score; best = r; }
    });
    return best;
  }

  function initAskBar() {
    var input = $('#goalAskInput');
    if (!input) return;
    var wrap = input.closest('.goal-ask');
    var btn = wrap ? $('.ask-btn', wrap) : null;
    var hints = wrap ? $$('.ask-hint', wrap) : [];
    var ferr = wrap ? $('.ferr', wrap) : null;

    function submit() {
      var r = matchIntent(input.value);
      if (r && r.page) location.href = r.page + '?tool=' + r.tool;
      else if (r && r.goal) route(r.goal);
      else if (ferr) ferr.classList.add('on');
      return !!r;
    }

    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); submit(); });
    if (wrap && wrap.tagName.toLowerCase() === 'form') {
      wrap.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    } else if (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    }
    hints.forEach(function (hint) {
      hint.addEventListener('click', function () {
        input.value = hint.textContent.trim();
        input.focus();
        if (ferr) ferr.classList.remove('on');
      });
    });
  }

  /* ── QUERY-PARAM DEEP LINKS ── */
  function initQueryParams() {
    var params = new URLSearchParams(location.search);
    var goal = params.get('goal');
    if (goal) {
      var chip = document.querySelector('[data-g="goal"][data-v="' + goal + '"]');
      if (chip) {
        setTimeout(function () {
          chip.click();
          var st = chip.closest('[data-ds-step]');
          if (st) {
            var root = st.closest('[data-ds="stepper"]');
            var steps = root ? $$('[data-ds-step]', root) : [];
            var idx = steps.indexOf(st);
            if (idx > -1 && DS.goStep) DS.goStep(idx);
          }
          var card = st || chip.closest('.card');
          if (card && card.scrollIntoView) {
            card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          }
        }, 150);
      }
    }
    var tool = params.get('tool');
    if (tool) {
      var btn = document.querySelector('[data-open-tool="' + tool + '"]');
      if (btn) {
        setTimeout(function () {
          btn.click();
          var sec = btn.closest('.ft-section');
          if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 200);
      }
    }
  }

  /* ── COUNT-UPS ── */
  function fmtCount(el, val) {
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    el.textContent = prefix + val.toFixed(decimals) + suffix;
  }
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-target')) || 0;
    if (reduceMotion) { fmtCount(el, target); return; }
    var dur = 1200, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      fmtCount(el, target * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCountUps() {
    var els = $$('.count-up[data-target]');
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { fmtCount(el, parseFloat(el.getAttribute('data-target')) || 0); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        animateCount(entry.target);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) {
      var inView = el.getBoundingClientRect().top < window.innerHeight;
      if (inView) { animateCount(el); return; }
      io.observe(el);
    });
  }

  /* ── GENERIC STEPPER (only activates on [data-ds="stepper"]) ── */
  function initStepper() {
    var root = document.querySelector('[data-ds="stepper"]');
    if (!root) return;
    var steps = $$('[data-ds-step]', root);
    if (steps.length < 2) return;

    var cur = 0;

    /* segments bar */
    var wsteps = document.createElement('div');
    wsteps.className = 'wsteps'; wsteps.id = 'dsSteps';
    var seg = document.createElement('div'); seg.className = 'wsteps-seg'; seg.setAttribute('aria-hidden', 'true');
    var lbls = document.createElement('div'); lbls.className = 'wsteps-lbls'; lbls.setAttribute('role', 'tablist');
    steps.forEach(function (s, i) {
      var b = document.createElement('div'); b.className = 'wseg' + (i === 0 ? ' on' : '');
      seg.appendChild(b);
      var t = document.createElement('button');
      t.type = 'button'; t.className = 'wstep' + (i === 0 ? ' on' : '');
      t.textContent = s.getAttribute('data-title') || ('Step ' + (i + 1));
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      t.addEventListener('click', function () { go(i, true); });
      lbls.appendChild(t);
    });
    wsteps.appendChild(seg); wsteps.appendChild(lbls);
    root.insertBefore(wsteps, root.firstChild);

    /* recap */
    var recap = document.createElement('div');
    recap.className = 'recap';
    recap.innerHTML = '<div class="recap-t">Your selections</div><div class="recap-g" aria-live="polite"></div>';
    wsteps.insertAdjacentElement('afterend', recap);
    var recapGrid = $('.recap-g', recap);

    /* nav */
    var nav = document.createElement('nav');
    nav.className = 'step-nav';
    var prev = document.createElement('button');
    prev.type = 'button'; prev.className = 'btn btn-ghost'; prev.textContent = '\u2190 Back';
    var next = document.createElement('button');
    next.type = 'button'; next.className = 'gbtn'; next.textContent = 'Continue \u2192';
    prev.addEventListener('click', function () { go(cur - 1); });
    next.addEventListener('click', function () { go(cur + 1); });
    nav.appendChild(prev); nav.appendChild(next);
    root.appendChild(nav);

    function stepValue(s) {
      var chips = $$('.chip.on', s).map(function (c) {
        return c.textContent.replace(/[^\w\s%.\-]/g, '').trim();
      }).filter(Boolean);
      if (chips.length) return chips.join(' \u00b7 ');
      var inp = s.querySelector('[data-recap]');
      return inp && inp.value ? inp.value.trim() : '\u2014';
    }

    function refreshRecap() {
      recapGrid.innerHTML = steps.map(function (s) {
        var v = stepValue(s).replace(/</g, '&lt;');
        return '<div class="recap-i"><div class="recap-l">' + (s.getAttribute('data-title') || 'Step') + '</div><div class="recap-v">' + v + '</div></div>';
      }).join('');
    }

    function go(i, manual) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      if (i === cur && !manual) return;
      cur = i;
      steps.forEach(function (s, k) {
        s.classList.toggle('step', k !== cur);
        s.classList.toggle('on', k === cur);
      });
      var tabs = $$('.wstep', lbls), segs = $$('.wseg', seg);
      tabs.forEach(function (t, k) {
        t.classList.toggle('on', k === cur);
        t.setAttribute('aria-selected', k === cur ? 'true' : 'false');
      });
      segs.forEach(function (s2, k) { s2.classList.toggle('on', k <= cur); });
      next.style.display = cur === steps.length - 1 ? 'none' : '';
      refreshRecap();
      if (manual && !reduceMotion) {
        var top = root.getBoundingClientRect().top + window.pageYOffset - 80;
        if (window.pageYOffset > top - 40) window.scrollTo({ top: top, behavior: 'smooth' });
      }
    }

    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('.chip')) refreshRecap();
    });

    DS.goStep = function (i) { go(i, true); };
    DS.nextStep = function () { go(cur + 1); };
    DS.prevStep = function () { go(cur - 1); };
    DS.getStep = function () { return cur; };

    steps.forEach(function (s) { s.setAttribute('tabindex', '-1'); });
    go(0, true);
  }

  /* ── INIT ── */
  function init() {
    ensureTheme();
    initGoalCards();
    initAskBar();
    initQueryParams();
    initCountUps();
    initStepper();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
