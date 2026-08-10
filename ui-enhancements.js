/* Lightweight, progressively enhanced interactions for the static FitPlan pages. */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mainTarget() {
    return document.querySelector('main, .page-wrap, .wrap') || document.body;
  }

  function addSkipLink() {
    var target = mainTarget();
    if (!target.id) target.id = 'main-content';
    if (document.querySelector('.skip-link')) return;
    var link = document.createElement('a');
    link.className = 'skip-link';
    link.href = '#' + target.id;
    link.textContent = 'Skip to content';
    document.body.insertBefore(link, document.body.firstChild);
  }

  function improveClickableCards() {
    document.querySelectorAll('.plan-card[onclick], .chip, .dchip, .sc').forEach(function (item) {
      if (!item.hasAttribute('tabindex')) item.tabIndex = 0;
      if (!item.hasAttribute('role')) item.setAttribute('role', 'button');
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); }
      });
    });
  }

  function revealSections() {
    if (reduceMotion || !window.gsap || !window.ScrollTrigger) return;
    window.gsap.registerPlugin(window.ScrollTrigger);
    var selectors = '.card, .plan-card, .hook-box, .feature-card, .contact-card, .content-card, .footer';
    var elements = Array.prototype.slice.call(document.querySelectorAll(selectors));
    elements.forEach(function (element) {
      if (element.closest('.loading') || element.classList.contains('js-reveal')) return;
      if (element.closest('[data-ds="stepper"]')) return;
      element.classList.add('js-reveal');
      window.gsap.fromTo(element, { autoAlpha: 0, y: 18 }, {
        autoAlpha: 1, y: 0, duration: .58, ease: 'power2.out',
        scrollTrigger: { trigger: element, start: 'top 90%', once: true }
      });
      window.ScrollTrigger.create({ trigger: element, start: 'top 90%', once: true, onEnter: function () { element.classList.add('is-visible'); } });
    });
  }

  function replaceIconPlaceholders() {
    if (!window.lucide) return;
    document.querySelectorAll('[data-lucide]').forEach(function (icon) { icon.setAttribute('aria-hidden', 'true'); });
    window.lucide.createIcons({ attrs: { 'stroke-width': 2, 'aria-hidden': 'true' } });
  }

  function init() { addSkipLink(); improveClickableCards(); replaceIconPlaceholders(); revealSections(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
