/* ============================================================================
   FITPLAN · AKASH LIFTSUP — PREMIUM EMAIL TEMPLATE SYSTEM
   Shared across Meal Plan / Workout Plan / Combo Plan.
   Generates one branded, email-safe HTML document per plan type.

   Usage (after the page has rendered the premium plan):
     var html = PE.build('meal');     // Meal Plan page
     var html = PE.build('workout');  // Workout Plan page
     var html = PE.build('combo');    // Combo Plan page

   Email-safe: table-based layout, inline CSS, media query, ~680px max width,
   no JS / external CSS / frameworks / external fonts.
   ============================================================================ */
(function (window) {
  'use strict';

  var PE = {};
  window.PE = PE;

  /* ----------------------------------------------------------------------
     Design tokens
     ---------------------------------------------------------------------- */
  var C = {
    bg:     '#F5F5F3',   /* page background        */
    card:   '#FFFFFF',   /* cards                  */
    text:   '#111111',   /* primary text           */
    muted:  '#666666',   /* secondary text         */
    border: '#E5E5E5',   /* borders                */
    accent: '#B7FF3C',   /* brand accent (sparing) */
    dark:   '#111111'    /* dark surfaces          */
  };

  var FONT = "Arial, Helvetica, sans-serif";

  /* ----------------------------------------------------------------------
     Small utilities
     ---------------------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function txt(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function stripIcon(s) {
    /* remove leading decorative emoji/icon run (e.g. "🕐 7:30 AM") */
    return String(s || '').replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}\u{2705}]*\s*/u, '').trim();
  }

  function fmtDate() {
    return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function clientName() {
    return val('cName') || 'Client';
  }

  function state() {
    return window.S || {};
  }

  function metrics() {
    return typeof window.calcMetrics === 'function' ? window.calcMetrics() : null;
  }

  function hasContent(sel) {
    var el = document.querySelector(sel);
    return !!(el && txt(el));
  }

  var GOAL_LABEL = {
    fatloss: 'Fat Loss',
    muscle: 'Muscle Gain',
    musclegain: 'Muscle Gain',
    recomp: 'Body Recomposition',
    maintenance: 'Maintenance',
    strength: 'Strength',
    endurance: 'Endurance'
  };

  var DIET_LABEL = {
    veg_dairy: 'Vegetarian',
    veg_nodairy: 'Vegetarian (Lactose-Free)',
    eggetarian: 'Eggetarian',
    egge_nodairy: 'Eggetarian (Lactose-Free)',
    nonveg: 'Non-Vegetarian',
    nonveg_nodairy: 'Non-Vegetarian (LF)',
    vegan: 'Vegan',
    pescatarian: 'Pescatarian',
    keto: 'Keto'
  };

  /* ----------------------------------------------------------------------
     Email-safe primitives
     ---------------------------------------------------------------------- */
  function shell(title, bodyHtml) {
    return '<!DOCTYPE html>\n' +
      '<html lang="en">\n<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<meta http-equiv="X-UA-Compatible" content="IE=edge">\n' +
      '<title>' + esc(title) + '</title>\n' +
      '<style>\n' +
      '  body{margin:0;padding:0;background-color:' + C.bg + ';}\n' +
      '  @media only screen and (max-width:600px){\n' +
      '    .pe-main{width:100% !important;}\n' +
      '    .pe-pad{padding-left:16px !important;padding-right:16px !important;}\n' +
      '    .pe-stack{display:block !important;width:100% !important;}\n' +
      '    .pe-stack td{display:block !important;width:100% !important;box-sizing:border-box;}\n' +
      '    .pe-tbl thead{display:none !important;}\n' +
      '    .pe-tbl tbody{display:block !important;width:100% !important;}\n' +
      '    .pe-tbl tr{display:block !important;width:100% !important;border:1px solid ' + C.border + ';border-radius:10px;margin-bottom:10px;}\n' +
      '    .pe-tbl td{display:block !important;width:100% !important;box-sizing:border-box;padding:7px 12px !important;border-bottom:1px dashed ' + C.border + ' !important;}\n' +
      '    .pe-tbl td:last-child{border-bottom:0 !important;}\n' +
      '    .pe-tbl td::before{content:attr(data-l);display:block;font-size:9px;font-weight:700;color:' + C.muted + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;}\n' +
      '  }\n' +
      '</style>\n' +
      '</head>\n' +
      '<body style="margin:0;padding:0;background-color:' + C.bg + ';font-family:' + FONT + ';">\n' +
      bodyHtml +
      '\n</body>\n</html>';
  }

  function container(inner) {
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + C.bg + ';">\n' +
      '<tr><td align="center" style="padding:24px 10px;">\n' +
      '<table role="presentation" width="680" cellpadding="0" cellspacing="0" class="pe-main" style="max-width:680px;width:100%;background-color:' + C.card + ';border:1px solid ' + C.border + ';border-radius:16px;overflow:hidden;">\n' +
      inner +
      '\n</table>\n</td></tr>\n</table>';
  }

  /* Branded header — same for all three plan types */
  function header(planType, goalLabel) {
    var s = state();
    var phone = val('phone');
    var email = val('email');
    var contact = [];
    if (phone) contact.push('Phone · ' + esc(phone));
    if (email) contact.push('Email · ' + esc(email));
    return '<tr><td style="background-color:' + C.dark + ';padding:34px 40px 30px 40px;">\n' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>\n' +
      '<td>\n' +
      '<div style="color:' + C.accent + ';font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Akash Liftsup</div>\n' +
      '<div style="color:#FFFFFF;font-size:15px;font-weight:700;letter-spacing:2px;margin-top:3px;text-transform:uppercase;">Personalised Fitness</div>\n' +
      '</td>\n' +
      '<td align="right" style="vertical-align:top;">\n' +
      '<span style="display:inline-block;background-color:#1F1F1F;color:' + C.accent + ';font-size:9px;font-weight:800;letter-spacing:2px;padding:5px 11px;border-radius:999px;text-transform:uppercase;">Premium Plan</span>\n' +
      '</td>\n' +
      '</tr></table>\n' +
      '<div style="height:1px;background:#2C2C2C;margin:20px 0;"></div>\n' +
      '<div style="color:#FFFFFF;font-size:25px;font-weight:800;line-height:1.2;">' + esc(clientName()) + '</div>\n' +
      '<div style="color:' + C.accent + ';font-size:12px;font-weight:800;letter-spacing:3px;margin-top:7px;text-transform:uppercase;">' + esc(planType) + '</div>\n' +
      '<div style="color:#CCCCCC;font-size:12px;margin-top:5px;">Primary Goal · ' + esc(goalLabel) + '</div>\n' +
      '<div style="color:#8A8A8A;font-size:11px;margin-top:16px;">Prepared on ' + fmtDate() + '</div>\n' +
      (contact.length ? '<div style="color:#6E6E6E;font-size:10px;margin-top:6px;">' + contact.join(' &nbsp;·&nbsp; ') + '</div>' : '') +
      '</td></tr>';
  }

  /* Numbered section block */
  function section(num, title, subtitle, bodyHtml) {
    var h =
      '<tr><td class="pe-pad" style="padding:30px 40px 4px 40px;">\n' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>\n' +
      '<td width="4" style="background-color:' + C.accent + ';border-radius:2px;">&nbsp;</td>\n' +
      '<td style="padding-left:14px;">\n' +
      (num ? '<div style="font-size:10px;font-weight:800;letter-spacing:2px;color:' + C.muted + ';text-transform:uppercase;">Section ' + pad(num) + '</div>' : '') +
      '<div style="font-size:16px;font-weight:800;color:' + C.text + ';margin-top:2px;letter-spacing:0.2px;">' + esc(title) + '</div>\n' +
      (subtitle ? '<div style="font-size:12px;color:' + C.muted + ';margin-top:4px;line-height:1.55;">' + esc(subtitle) + '</div>' : '') +
      '</td></tr></table>\n' +
      '</td></tr>\n' +
      (bodyHtml ? '<tr><td class="pe-pad" style="padding:14px 40px 6px 40px;">' + bodyHtml + '</td></tr>' : '');
    return h;
  }

  /* Grid of labelled stats (at-a-glance) */
  function statsGrid(items, cols) {
    cols = cols || 3;
    var h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
    for (var i = 0; i < items.length; i += cols) {
      h += '<tr>';
      for (var j = 0; j < cols; j++) {
        var it = items[i + j];
        if (!it) { h += '<td class="pe-stack" width="' + (100 / cols) + '%" style="padding:0 0 10px 0;"></td>'; continue; }
        h += '<td class="pe-stack" width="' + (100 / cols) + '%" style="padding:0 6px 10px 0;vertical-align:top;">' +
          '<div style="background-color:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:10px;padding:12px 13px;">' +
          '<div style="font-size:9px;font-weight:800;letter-spacing:1.2px;color:' + C.muted + ';text-transform:uppercase;">' + esc(it.l) + '</div>' +
          '<div style="font-size:15px;font-weight:800;color:' + C.text + ';margin-top:4px;line-height:1.25;">' + esc(it.v) + '</div>' +
          '</div></td>';
      }
      h += '</tr>';
    }
    h += '</table>';
    return h;
  }

  function card(innerHtml, accent) {
    return '<div style="border:1px solid ' + C.border + ';border-radius:12px;background-color:' + C.card + ';padding:16px 18px;margin-bottom:12px;' +
      (accent ? 'border-left:4px solid ' + C.accent + ';' : '') + '">' + innerHtml + '</div>';
  }

  /* Proper data table with mobile card fallback */
  function dataTable(headers, rows, alignRightLast) {
    var h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="pe-tbl" style="width:100%;border-collapse:collapse;border:1px solid ' + C.border + ';border-radius:10px;overflow:hidden;margin-bottom:12px;">';
    h += '<thead><tr style="background-color:' + C.dark + ';">';
    for (var hi = 0; hi < headers.length; hi++) {
      h += '<th style="color:#FFFFFF;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:9px 12px;text-align:' + (alignRightLast && hi === headers.length - 1 ? 'right' : 'left') + ';border:0;">' + esc(headers[hi]) + '</th>';
    }
    h += '</tr></thead><tbody>';
    for (var ri = 0; ri < rows.length; ri++) {
      var r = rows[ri];
      var bg = ri % 2 === 0 ? '#FFFFFF' : '#FAFAF8';
      h += '<tr style="background-color:' + bg + ';">';
      for (var ci = 0; ci < headers.length; ci++) {
        var cell = esc(r[ci] == null ? '' : r[ci]);
        var cellHtml = (ci === 0)
          ? '<div style="font-weight:700;color:' + C.text + ';">' + cell + '</div>'
          : '<div style="color:' + C.muted + ';">' + cell + '</div>';
        h += '<td data-l="' + esc(headers[ci]) + '" style="padding:9px 12px;font-size:12px;border-bottom:1px solid ' + C.border + ';border-top:0;text-align:' + (alignRightLast && ci === headers.length - 1 ? 'right' : 'left') + ';vertical-align:top;">' + cellHtml + '</td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table>';
    return h;
  }

  function badge(text, dark) {
    return '<span style="display:inline-block;background-color:' + (dark ? C.dark : '#EDEDE9') + ';color:' + (dark ? C.accent : C.text) + ';font-size:9px;font-weight:800;padding:3px 10px;border-radius:999px;letter-spacing:1px;text-transform:uppercase;">' + esc(text) + '</span>';
  }

  function numberedList(items) {
    var h = '';
    for (var i = 0; i < items.length; i++) {
      h += '<div style="padding:7px 0;border-bottom:1px dashed ' + C.border + ';font-size:12px;line-height:1.6;color:' + C.text + ';">' +
        '<span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;background-color:' + C.accent + ';color:' + C.dark + ';font-size:10px;font-weight:800;margin-right:8px;">' + (i + 1) + '</span>' +
        esc(items[i]) +
        '</div>';
    }
    return h;
  }

  function bulletList(items) {
    var h = '';
    for (var i = 0; i < items.length; i++) {
      h += '<div style="padding:5px 0;font-size:12px;line-height:1.6;color:' + C.text + ';">' +
        '<span style="color:' + C.accent + ';font-weight:800;margin-right:8px;">&#10003;</span>' + esc(items[i]) +
        '</div>';
    }
    return h;
  }

  /* ----------------------------------------------------------------------
     DOM extractors (meal plan content — parsed after renderPlan('premium'))
     ---------------------------------------------------------------------- */
  function clean(el) {
    return stripIcon(txt(el));
  }

  function mealSlots(selector) {
    var root = document.querySelector(selector);
    if (!root) return '';
    var tls = root.querySelectorAll('.tl');
    var h = '';
    for (var i = 0; i < tls.length; i++) {
      var tl = tls[i];
      var hd = tl.querySelector('.mslot-hd');
      var time = clean(hd && hd.querySelector('.tl-time'));
      var name = clean(hd && hd.querySelector('.tl-name'));
      var macro = clean(hd && hd.querySelector('.tl-macro'));
      var opts = tl.querySelectorAll('.mopt');
      var optHtml = '';
      for (var j = 0; j < opts.length; j++) {
        var o = txt(opts[j]);
        if (!o) continue;
        optHtml += '<div style="padding:6px 0;border-bottom:1px dashed ' + C.border + ';font-size:12px;line-height:1.55;color:' + C.text + ';">' +
          '<span style="color:' + C.muted + ';font-weight:700;margin-right:7px;">' + (j + 1) + '.</span>' + esc(o) +
          '</div>';
      }
      h += card(
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="vertical-align:top;">' +
        '<div style="font-size:10px;font-weight:800;color:' + C.muted + ';text-transform:uppercase;letter-spacing:1px;">' + esc(time) + '</div>' +
        '<div style="font-size:14px;font-weight:800;color:' + C.text + ';margin-top:3px;">' + esc(name) + '</div>' +
        '</td>' +
        '<td align="right" style="vertical-align:top;white-space:nowrap;">' +
        '<span style="font-size:11px;font-weight:700;color:#8A8A8A;white-space:normal;">' + esc(macro) + '</span>' +
        '</td></tr></table>' +
        (optHtml ? '<div style="margin-top:10px;">' + optHtml + '</div>' : '')
      );
    }
    return h;
  }

  function siTable(selector, itemLabel) {
    var root = document.querySelector(selector);
    if (!root) return '';
    var sis = root.querySelectorAll('.si');
    var rows = [];
    for (var i = 0; i < sis.length; i++) {
      var si = sis[i];
      var t = txt(si.querySelector('.si-t'));
      var dose = txt(si.querySelector('.si-dose'));
      var d = txt(si.querySelector('.si-d'));
      if (!t) continue;
      rows.push([t, dose || '—', d || '—']);
    }
    if (!rows.length) return '';
    return dataTable([itemLabel || 'Item', 'Dose', 'Details'], rows);
  }

  function carbCycling() {
    var tbl = document.querySelector('#carbCycleWrap table.ctbl');
    if (!tbl) return '';
    var headers = [];
    var thead = tbl.querySelector('thead');
    if (thead) {
      var ths = thead.querySelectorAll('th');
      for (var i = 0; i < ths.length; i++) headers.push(txt(ths[i]));
    }
    if (!headers.length) return '';
    var rows = [];
    var trs = tbl.querySelectorAll('tbody tr');
    for (var r = 0; r < trs.length; r++) {
      var tds = trs[r].querySelectorAll('td');
      var row = [];
      for (var c = 0; c < tds.length; c++) {
        row.push(txt(tds[c]));
      }
      rows.push(row);
    }
    if (!rows.length) return '';
    /* weekly average from the rendered table */
    var kcalSum = 0, kcalCount = 0;
    var kcalIdx = headers.indexOf('Calories');
    for (var k = 0; k < rows.length; k++) {
      if (kcalIdx >= 0 && rows[k][kcalIdx]) {
        var kcal = parseInt(rows[k][kcalIdx], 10);
        if (!isNaN(kcal)) { kcalSum += kcal; kcalCount++; }
      }
    }
    var avg = kcalCount ? Math.round(kcalSum / kcalCount) : null;
    return dataTable(headers, rows, false) +
      (avg ? '<div style="font-size:11px;color:' + C.muted + ';padding:2px 2px 0 2px;">Weekly average · ' + avg + ' kcal / day. Protein is held constant every day.</div>' : '');
  }

  function swaps() {
    var root = document.getElementById('outSwaps');
    if (!root) return '';
    var lis = root.querySelectorAll('li');
    var items = [];
    for (var i = 0; i < lis.length; i++) {
      var t = txt(lis[i]);
      if (t) items.push(t);
    }
    return items.length ? card('<div style="font-size:13px;font-weight:800;color:' + C.text + ';margin-bottom:6px;">Smart Food Swaps</div>' + bulletList(items)) : '';
  }

  function prepGuide() {
    var s = state();
    var steps = (window.PREP_GUIDE || {})[s.diet] || (window.PREP_GUIDE || {}).veg_dairy || [];
    var h = '';
    for (var i = 0; i < steps.length; i++) {
      var g = steps[i];
      h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ' + C.border + ';border-radius:10px;margin-bottom:8px;"><tr>' +
        '<td width="38" style="padding:12px;vertical-align:top;">' +
        '<div style="width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background-color:' + C.dark + ';color:' + C.accent + ';font-size:12px;font-weight:800;">' + esc(g.step || (i + 1)) + '</div></td>' +
        '<td style="padding:12px 12px 12px 0;vertical-align:top;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td><div style="font-size:13px;font-weight:800;color:' + C.text + ';">' + esc(g.title || '') + '</div></td>' +
        '<td align="right" style="white-space:nowrap;"><span style="font-size:9px;font-weight:800;color:' + C.muted + ';background-color:' + C.bg + ';border:1px solid ' + C.border + ';padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;">' + esc(g.time || '') + '</span></td>' +
        '</tr></table>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:4px;">' + esc(g.desc || '') + '</div>' +
        '</td></tr></table>';
    }

    /* storage chips — parsed from the rendered storage guide block */
    var pg = document.getElementById('outPrepGuide');
    var storage = [];
    if (pg) {
      var sg = null;
      var kids = pg.children;
      for (var k = 0; k < kids.length; k++) {
        if ((kids[k].textContent || '').indexOf('Storage Guide') > -1) { sg = kids[k]; break; }
      }
      if (sg) {
        var chips = sg.querySelectorAll('div[style*="border-radius:var(--rs)"]');
        for (var c = 0; c < chips.length; c++) {
          var divs = chips[c].querySelectorAll('div');
          if (divs.length >= 2) storage.push([txt(divs[0]), txt(divs[1])]);
        }
      }
    }

    var html = h;
    if (storage.length) {
      html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>';
      for (var s2 = 0; s2 < storage.length; s2++) {
        if (s2 > 0 && s2 % 2 === 0) html += '</tr><tr>';
        html += '<td class="pe-stack" width="50%" style="padding:0 6px 8px 0;vertical-align:top;">' +
          '<div style="border:1px solid ' + C.border + ';border-radius:10px;padding:9px 12px;background-color:' + C.card + ';">' +
          '<div style="font-size:11px;font-weight:800;color:' + C.text + ';">' + esc(storage[s2][0]) + '</div>' +
          '<div style="font-size:10px;color:' + C.muted + ';margin-top:2px;">' + esc(storage[s2][1]) + '</div>' +
          '</div></td>';
      }
      html += '</tr></table>';
    }
    return html;
  }

  function progressTracking() {
    var key = mealGoalKey();
    var pd = (window.PROGRESS_DATA || {})[key] || (window.PROGRESS_DATA || {}).maintenance;
    if (!pd) return '';
    var h = '';
    h += card(
      '<div style="font-size:13px;font-weight:800;color:' + C.text + ';margin-bottom:8px;">What to Track</div>' +
      numberedList(pd.metrics || [])
    );
    h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td class="pe-stack" width="50%" style="padding:0 6px 8px 0;vertical-align:top;">' +
      card('<div style="font-size:11px;font-weight:800;color:' + C.text + ';text-transform:uppercase;letter-spacing:1px;">Frequency</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:6px;">' + esc(pd.frequency || '') + '</div>') +
      '</td>' +
      '<td class="pe-stack" width="50%" style="padding:0 0 8px 0;vertical-align:top;">' +
      card('<div style="font-size:11px;font-weight:800;color:' + C.text + ';text-transform:uppercase;letter-spacing:1px;">Eat More If&hellip;</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:6px;">' + esc(pd.signals_more || '') + '</div>') +
      '</td></tr>' +
      '<tr><td class="pe-stack" width="50%" style="padding:0 6px 0 0;vertical-align:top;">' +
      card('<div style="font-size:11px;font-weight:800;color:' + C.text + ';text-transform:uppercase;letter-spacing:1px;">Eat Less If&hellip;</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:6px;">' + esc(pd.signals_less || '') + '</div>') +
      '</td>' +
      '<td class="pe-stack" width="50%" style="padding:0 0 0 0;vertical-align:top;">' +
      card('<div style="font-size:11px;font-weight:800;color:' + C.text + ';text-transform:uppercase;letter-spacing:1px;">Plateau Buster</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:6px;">' + esc(pd.plateau || '') + '</div>') +
      '</td></tr></table>';
    return h;
  }

  function premiumStrategies(m) {
    var key = mealGoalKey();
    var pd = (window.PREMIUM_DATA || {})[key] || (window.PREMIUM_DATA || {}).maintenance;
    if (!pd) return '';
    var h = '';
    if (pd.title) {
      h += card(
        '<div style="font-size:11px;font-weight:800;color:' + C.muted + ';text-transform:uppercase;letter-spacing:1.5px;margin-bottom:3px;">' + esc(pd.title) + '</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;">Master one strategy at a time before adding the next.</div>',
        true
      );
    }
    var strs = pd.strategies || [];
    for (var i = 0; i < strs.length; i++) {
      h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ' + C.border + ';border-radius:10px;margin-bottom:8px;"><tr>' +
        '<td width="34" style="padding:12px 0 12px 14px;vertical-align:top;">' +
        '<span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background-color:' + C.dark + ';color:' + C.accent + ';font-size:10px;font-weight:800;">' + (i + 1) + '</span></td>' +
        '<td style="padding:12px 14px 12px 10px;vertical-align:top;">' +
        '<div style="font-size:13px;font-weight:800;color:' + C.text + ';">' + esc(strs[i].h || '') + '</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:4px;">' + esc(strs[i].b || '') + '</div>' +
        '</td></tr></table>';
    }
    if (m) {
      h += card(
        '<div style="font-size:11px;font-weight:800;color:' + C.muted + ';text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Your Premium Weekly Numbers</div>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td class="pe-stack" width="25%" style="padding:0 4px 6px 0;"><div style="background-color:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;padding:8px;"><div style="font-size:9px;color:' + C.muted + ';font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Training</div><div style="font-size:13px;font-weight:800;color:' + C.text + ';margin-top:2px;">' + m.tgt + ' kcal</div></div></td>' +
        '<td class="pe-stack" width="25%" style="padding:0 4px 6px 0;"><div style="background-color:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;padding:8px;"><div style="font-size:9px;color:' + C.muted + ';font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Rest</div><div style="font-size:13px;font-weight:800;color:' + C.text + ';margin-top:2px;">' + m.tgtRest + ' kcal</div></div></td>' +
        '<td class="pe-stack" width="25%" style="padding:0 4px 6px 0;"><div style="background-color:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;padding:8px;"><div style="font-size:9px;color:' + C.muted + ';font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Refeed</div><div style="font-size:13px;font-weight:800;color:' + C.text + ';margin-top:2px;">' + m.tdee + ' kcal</div></div></td>' +
        '<td class="pe-stack" width="25%" style="padding:0 0 6px 0;"><div style="background-color:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;padding:8px;"><div style="font-size:9px;color:' + C.muted + ';font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Protein</div><div style="font-size:13px;font-weight:800;color:' + C.text + ';margin-top:2px;">' + m.protG + ' g</div></div></td>' +
        '</tr></table>'
      );
    }
    return h;
  }

  function mealGoalKey() {
    var g = state().goal;
    return ['fatloss', 'musclegain', 'recomp', 'maintenance', 'strength', 'endurance'].indexOf(g) >= 0 ? g : 'maintenance';
  }

  function cheatRule(goal) {
    if (goal === 'fatloss') return 'One cheat meal per week (not a full day). Keep it under 700 kcal over budget, hit protein first, Sunday is recommended. No cheat in the first 3 weeks.';
    if (goal === 'musclegain' || goal === 'muscle') return '1-2 cheat meals per week allowed. Choose calorie-dense foods wisely (pizza over chips). Still hit your protein on cheat day. Dirty bulking is a myth.';
    return 'Flexible approach — 80% clean eating, 20% flexibility. Plan your cheat rather than reacting to cravings.';
  }

  /* ----------------------------------------------------------------------
     Meal plan email
     ---------------------------------------------------------------------- */
  function mealContent() {
    var s = state();
    var m = metrics();
    var html = '';

    var targets = [];
    if (m) {
      targets.push({ l: 'Training Day', v: m.tgt + ' kcal' });
      targets.push({ l: 'Rest Day', v: m.tgtRest + ' kcal' });
      targets.push({ l: 'Protein', v: m.protG + ' g' });
      targets.push({ l: 'Carbs · Training', v: m.carbG + ' g' });
      targets.push({ l: 'Carbs · Rest', v: m.carbGRest + ' g' });
      targets.push({ l: 'Fat', v: m.fatG + ' g' });
    }
    var hydration = '';
    if (m) {
      var wl = Math.round(m.wt * 0.033 * 10) / 10;
      var wh = Math.round(m.wt * 0.04 * 10) / 10;
      hydration = 'Drink ' + wl + '-' + wh + ' L daily (minimum ' + Math.round(m.wt * 35) + ' ml). Wake up with 500 ml warm water, 500 ml before training, 500 ml after training.';
    }
    var cheat = cheatRule(s.goal);

    html += section('01', 'Your Nutrition Targets', 'Your daily energy and macro split, built around your goal.',
      statsGrid(targets, 3) +
      (hydration ? card(
        '<div style="font-size:12px;font-weight:800;color:' + C.text + ';">Hydration Protocol</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:5px;">' + esc(hydration) + '</div>'
      ) : '') +
      card(
        '<div style="font-size:12px;font-weight:800;color:' + C.text + ';">Cheat Meal Rule</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:5px;">' + esc(cheat) + '</div>'
      )
    );

    html += section('02', 'Training Day Meal Plan', 'Full fuel. Higher carbs to power your sessions.', mealSlots('#outMeals'));

    html += section('03', 'Rest Day Meal Plan', 'Carbs reduced, protein held constant for recovery.', mealSlots('#outRestMeals'));

    var addOns = '';
    var seeds = siTable('#outSeeds', 'Power Seed');
    var swapsHtml = swaps();
    if (seeds) addOns += seeds;
    if (swapsHtml) addOns += swapsHtml;
    if (addOns) html += section('04', 'Daily Nutrition Add-Ons', 'Small daily additions that compound your results.', addOns);

    var supps = siTable('#outSupps', 'Supplement');
    if (supps) html += section('05', 'Supplement Protocol', 'A targeted stack for your goal.', supps);

    if (hasContent('#carbCycleWrap table.ctbl')) {
      html += section('06', 'Weekly Nutrition Overview', 'Your week at a glance — training, rest and refeed days.', carbCycling());
    }

    if (hasContent('#outPrepGuide')) {
      html += section('07', 'Meal Prep Guide', 'A Sunday batch-cook system that saves time every day.', prepGuide());
    }

    html += section('08', 'Progress Tracking', 'Simple, consistent measures of what is actually working.', progressTracking());

    if (hasContent('#premiumContent')) {
      html += section('09', 'Premium Nutrition Strategies', 'Advanced protocols to take your results to the next level.', premiumStrategies(m));
    }

    return html;
  }

  /* ----------------------------------------------------------------------
     Workout plan email
     ---------------------------------------------------------------------- */
  function workoutMeta() {
    var s = state();
    var splitList = (window.SPLITS || {})[s.days] || (window.SPLITS || {})['4'] || [];
    var sel = null;
    for (var i = 0; i < splitList.length; i++) {
      if (splitList[i].v === s.split) { sel = splitList[i]; break; }
    }
    if (!sel) sel = splitList[0] || null;
    var rr = (window.RR || {})[s.goal] || (window.RR || {}).fatloss || {};
    return {
      splitName: sel ? sel.n : '—',
      splitDays: sel ? sel.s : '—',
      splitDesc: sel ? sel.d : '',
      rr: rr
    };
  }

  function premiumWorkoutDays() {
    var s = state();
    if (typeof window.getWDs !== 'function') return [];
    var advDays = String(Math.min(6, parseInt(s.days, 10) + 1));
    var sp = s.split === 'fullbody' ? 'ppl' : s.split;
    return window.getWDs(s.goal, s.training, s.gender, advDays, sp) || [];
  }

  var LL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  var DL_LABEL = { '45': '45 min', '60': '60 min', '90': '90 min' };
  var TL_LABEL = { morning: 'Morning', evening: 'Evening', flexible: 'Flexible' };

  function workoutContent() {
    var s = state();
    var wk = workoutMeta();
    var html = '';

    html += section('01', 'Your Training Targets', 'The framework for every session in this plan.',
      statsGrid([
        { l: 'Goal', v: GOAL_LABEL[s.goal] || '—' },
        { l: 'Training Days', v: (s.days || '—') + ' days/week' },
        { l: 'Level', v: LL_LABEL[s.level] || '—' },
        { l: 'Session Length', v: DL_LABEL[s.duration] || (s.duration ? s.duration + ' min' : '—') },
        { l: 'Split', v: wk.splitName },
        { l: 'Location', v: (s.training || s.location) === 'gym' ? 'Gym' : 'Home' },
        { l: 'Rep Range', v: wk.rr.s || '—' },
        { l: 'Rest Between Sets', v: wk.rr.rest || '—' },
        { l: 'Intensity', v: wk.rr.intensity || '—' }
      ], 3) +
      card(
        '<div style="font-size:12px;font-weight:800;color:' + C.text + ';">Training Parameters</div>' +
        '<div style="font-size:12px;color:' + C.muted + ';line-height:1.7;margin-top:6px;">' +
        '<div><strong style="color:' + C.text + ';">Split:</strong> ' + esc(wk.splitName) + ' — ' + esc(wk.splitDays) + '</div>' +
        '<div style="margin-top:4px;"><strong style="color:' + C.text + ';">Tempo:</strong> 3-1-2 (premium tempo prescription)</div>' +
        '<div style="margin-top:4px;"><strong style="color:' + C.text + ';">Deload:</strong> Every 6th week, reduce volume by 40%</div>' +
        '<div style="margin-top:4px;"><strong style="color:' + C.text + ';">Overload:</strong> ' + esc(s.goal === 'strength' ? 'Add 2.5/5 kg per session' : 'Add reps first, then weight') + '</div>' +
        '</div>'
      )
    );

    /* Premium protocol callout */
    if (window.PREM_NOTES && (window.PREM_NOTES[s.goal] || window.PREM_NOTES.fatloss)) {
      var pn = window.PREM_NOTES[s.goal] || window.PREM_NOTES.fatloss;
      html += section('02', 'Premium Training Protocol', 'The non-negotiables that separate this plan from a basic routine.',
        card('<div style="font-size:12px;color:' + C.text + ';line-height:1.7;">' + esc(pn) + '</div>', true)
      );
    }

    /* Weekly split grid */
    var wds = premiumWorkoutDays();
    if (wds.length) {
      var splitRows = '';
      for (var i = 0; i < wds.length; i++) {
        if (i > 0 && i % 2 === 0) splitRows += '</tr><tr>';
        splitRows += '<td class="pe-stack" width="50%" style="padding:0 5px 10px 0;vertical-align:top;">' +
          '<div style="border:1px solid ' + C.border + ';border-radius:10px;padding:11px 14px;">' +
          '<div style="font-size:9px;font-weight:800;color:' + C.muted + ';text-transform:uppercase;letter-spacing:1.5px;">' + esc(wds[i].day || '') + '</div>' +
          '<div style="font-size:13px;font-weight:800;color:' + C.text + ';margin-top:3px;">' + esc((wds[i].focus || '').replace(/^\s*[-–]\s*/, '')) + '</div>' +
          '</div></td>';
      }
      html += section('03', 'Weekly Training Split', 'Which muscle groups you train, and when.',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + splitRows + '</table>'
      );
    }

    /* Workout details — one premium card per day */
    if (wds.length) {
      var det = '';
      for (var d = 0; d < wds.length; d++) {
        var w = wds[d];
        var exes = w.exercises || [];
        var rows = [];
        for (var e = 0; e < exes.length; e++) {
          rows.push([
            exes[e].name || '',
            exes[e].sets || '—',
            exes[e].rest || '—',
            exes[e].note || '—'
          ]);
        }
        var inner =
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
          '<td><div style="font-size:9px;font-weight:800;color:' + C.muted + ';text-transform:uppercase;letter-spacing:1.5px;">Day ' + pad(d + 1) + '</div>' +
          '<div style="font-size:15px;font-weight:800;color:' + C.text + ';margin-top:3px;">' + esc((w.focus || '').replace(/^\s*[-–]\s*/, '')) + '</div></td>' +
          '<td align="right" style="vertical-align:top;">' + badge(w.day || '') + '</td>' +
          '</tr></table>' +
          (w.warmup ? '<div style="font-size:11px;color:' + C.muted + ';margin-top:8px;line-height:1.5;"><strong style="color:' + C.text + ';">Warm-Up:</strong> ' + esc(w.warmup) + '</div>' : '') +
          '<div style="margin-top:10px;">' +
          dataTable(['Exercise', 'Sets', 'Rest', 'Note'], rows) +
          '</div>' +
          (w.finisher ? '<div style="font-size:11px;color:' + C.muted + ';margin-top:2px;line-height:1.5;"><strong style="color:' + C.text + ';">Finisher:</strong> ' + esc(w.finisher) + '</div>' : '');
        det += card(inner);
      }
      html += section('04', 'Workout Details', 'Every session, exercise by exercise.', det);
    }

    /* Progression strategy — 8-week periodization */
    var period = (window.PERIOD || {})[s.goal] || (window.PERIOD || {}).fatloss || [];
    if (period.length) {
      var pRows = [];
      for (var pi = 0; pi < period.length; pi++) {
        pRows.push([period[pi].w || '', period[pi].t || '', period[pi].d || '', period[pi].c || '—']);
      }
      html += section('05', 'Progression Strategy', 'How load builds week by week across the block.',
        dataTable(['Week', 'Type', 'Load Details', 'Cardio'], pRows) +
        card('<div style="font-size:12px;color:' + C.text + ';line-height:1.7;">Log every set, weight and rep. Progression is earned in the notebook before it shows in the mirror. Deload weeks are recovery, not optional.</div>', true)
      );
    }

    /* Cardio / conditioning */
    var cardioList = [];
    if (typeof window.getCardio === 'function') cardioList = window.getCardio(s.goal, s.cardio) || [];
    if (cardioList.length) {
      var ch = '';
      for (var ci = 0; ci < cardioList.length; ci++) {
        ch += card(
          '<div style="font-size:12px;font-weight:800;color:' + C.text + ';">' + esc(cardioList[ci].t || '') + '</div>' +
          '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:5px;">' + esc(cardioList[ci].d || '') + '</div>'
        );
      }
      html += section('06', 'Cardio & Conditioning', 'Heart health and work capacity without stealing recovery.', ch);
    }

    /* Warm-up & recovery */
    var stretch = window.STRETCH || [];
    var recov = window.RECOV || [];
    if (stretch.length || recov.length) {
      var sHtml = '';
      if (stretch.length) {
        var sItems = [];
        for (var si = 0; si < stretch.length; si++) sItems.push(stretch[si].d + ' — ' + stretch[si].x);
        sHtml += card('<div style="font-size:12px;font-weight:800;color:' + C.text + ';margin-bottom:6px;">Daily Stretching & Mobility</div>' + bulletList(sItems));
      }
      if (recov.length) {
        var rHtml = '';
        for (var ri = 0; ri < recov.length; ri++) {
          rHtml += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ' + C.border + ';border-radius:10px;margin-bottom:8px;"><tr>' +
            '<td width="36" align="center" style="padding:12px 0 12px 12px;vertical-align:top;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background-color:' + C.bg + ';border:1px solid ' + C.border + ';font-size:12px;">' + esc(recov[ri].ic || '') + '</span></td>' +
            '<td style="padding:12px;vertical-align:top;">' +
            '<div style="font-size:12px;font-weight:800;color:' + C.text + ';">' + esc(recov[ri].t || '') + '</div>' +
            '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:3px;">' + esc(recov[ri].d || '') + '</div>' +
            '</td></tr></table>';
        }
        sHtml += rHtml;
      }
      html += section('07', 'Warm-Up, Mobility & Recovery', 'Preparation and recovery are part of the training itself.', sHtml);
    }

    /* Rules & avoid */
    var rules = (window.RULES || {})[s.goal] || (window.RULES || {}).fatloss || [];
    var avoid = (window.AVOID || {})[s.goal] || (window.AVOID || {}).fatloss || [];
    if (rules.length || avoid.length) {
      var left = card('<div style="font-size:12px;font-weight:800;color:' + C.text + ';margin-bottom:6px;">Training Rules</div>' + bulletList(rules));
      var right = card('<div style="font-size:12px;font-weight:800;color:' + C.text + ';margin-bottom:6px;">Strictly Avoid</div>' +
        avoid.map(function (a) {
          return '<div style="padding:5px 0;font-size:12px;line-height:1.6;color:' + C.text + ';"><span style="color:#C0392B;font-weight:800;margin-right:8px;">&#10007;</span>' + esc(a) + '</div>';
        }).join(''));
      html += section('08', 'Training Rules & Avoid List', 'The guardrails that keep every session effective.',
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td class="pe-stack" width="50%" style="padding:0 6px 0 0;vertical-align:top;">' + left + '</td>' +
        '<td class="pe-stack" width="50%" style="padding:0 0 0 0;vertical-align:top;">' + right + '</td>' +
        '</tr></table>'
      );
    }

    return html;
  }

  /* ----------------------------------------------------------------------
     Combo plan email — nutrition first, then training
     ---------------------------------------------------------------------- */
  function comboContent() {
    var s = state();
    var m = metrics();
    var html = '';

    /* NUTRITION */
    var targets = [];
    if (m) {
      targets.push({ l: 'Training Day', v: m.tgt + ' kcal' });
      targets.push({ l: 'Rest Day', v: m.tgtRest + ' kcal' });
      targets.push({ l: 'Protein', v: m.protG + ' g' });
      targets.push({ l: 'Carbs · Training', v: m.carbG + ' g' });
      targets.push({ l: 'Carbs · Rest', v: m.carbGRest + ' g' });
      targets.push({ l: 'Fat', v: m.fatG + ' g' });
    }
    html += section('01', 'Your Nutrition Targets', 'Daily energy and macros for training and rest days.', statsGrid(targets, 3));

    html += section('02', 'Training Day Meal Plan', 'Full fuel for your training sessions.', mealSlots('#outMeals'));
    html += section('03', 'Rest Day Meal Plan', 'Carbs reduced, protein constant.', mealSlots('#outRestMeals'));

    var addOns = '';
    var seeds = siTable('#outSeeds', 'Power Seed');
    var swapsHtml = swaps();
    if (seeds) addOns += seeds;
    if (swapsHtml) addOns += swapsHtml;
    if (addOns) html += section('04', 'Daily Nutrition Add-Ons', 'Small daily additions that compound.', addOns);

    var supps = siTable('#outSupps', 'Supplement');
    if (supps) html += section('05', 'Supplement Protocol', 'A targeted stack for your goal.', supps);

    if (hasContent('#carbCycleWrap table.ctbl')) {
      html += section('06', 'Weekly Nutrition Overview', 'Training, rest and refeed days across the week.', carbCycling());
    }

    if (hasContent('#outPrepGuide')) {
      html += section('07', 'Meal Prep Guide', 'Batch cooking that saves time every day.', prepGuide());
    }

    /* TRAINING */
    var wk = workoutMeta();
    html += section('08', 'Your Training Targets', 'The framework for every session.',
      statsGrid([
        { l: 'Training Days', v: (s.days || '—') + ' days/week' },
        { l: 'Level', v: LL_LABEL[s.level] || '—' },
        { l: 'Session Length', v: DL_LABEL[s.duration] || (s.duration ? s.duration + ' min' : '—') },
        { l: 'Split', v: wk.splitName },
        { l: 'Location', v: (s.training || s.location) === 'gym' ? 'Gym' : 'Home' },
        { l: 'Rep Range', v: wk.rr.s || '—' }
      ], 3)
    );

    var wds = premiumWorkoutDays();
    if (wds.length) {
      var det = '';
      for (var d = 0; d < wds.length; d++) {
        var w = wds[d];
        var rows = [];
        var exes = w.exercises || [];
        for (var e = 0; e < exes.length; e++) {
          rows.push([exes[e].name || '', exes[e].sets || '—', exes[e].rest || '—', exes[e].note || '—']);
        }
        var inner =
          '<div style="font-size:9px;font-weight:800;color:' + C.muted + ';text-transform:uppercase;letter-spacing:1.5px;">Day ' + pad(d + 1) + '</div>' +
          '<div style="font-size:15px;font-weight:800;color:' + C.text + ';margin-top:3px;">' + esc((w.focus || '').replace(/^\s*[-–]\s*/, '')) + '</div>' +
          (w.warmup ? '<div style="font-size:11px;color:' + C.muted + ';margin-top:8px;line-height:1.5;"><strong style="color:' + C.text + ';">Warm-Up:</strong> ' + esc(w.warmup) + '</div>' : '') +
          '<div style="margin-top:10px;">' + dataTable(['Exercise', 'Sets', 'Rest', 'Note'], rows) + '</div>' +
          (w.finisher ? '<div style="font-size:11px;color:' + C.muted + ';margin-top:2px;line-height:1.5;"><strong style="color:' + C.text + ';">Finisher:</strong> ' + esc(w.finisher) + '</div>' : '');
        det += card(inner);
      }
      html += section('09', 'Workout Details', 'Every session, exercise by exercise.', det);
    }

    var period = (window.PERIOD || {})[s.goal] || (window.PERIOD || {}).fatloss || [];
    if (period.length) {
      var pRows = [];
      for (var pi = 0; pi < period.length; pi++) {
        pRows.push([period[pi].w || '', period[pi].t || '', period[pi].d || '', period[pi].c || '—']);
      }
      html += section('10', 'Progression Strategy', 'How load builds week by week.',
        dataTable(['Week', 'Type', 'Load Details', 'Cardio'], pRows)
      );
    }

    var cardioList = [];
    if (typeof window.getCardio === 'function') cardioList = window.getCardio(s.goal, s.cardio) || [];
    if (cardioList.length) {
      var ch = '';
      for (var ci = 0; ci < cardioList.length; ci++) {
        ch += card(
          '<div style="font-size:12px;font-weight:800;color:' + C.text + ';">' + esc(cardioList[ci].t || '') + '</div>' +
          '<div style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin-top:5px;">' + esc(cardioList[ci].d || '') + '</div>'
        );
      }
      html += section('11', 'Cardio & Conditioning', 'Heart health and work capacity.', ch);
    }

    var premStrats = premiumStrategies(m);
    if (premStrats) html += section('12', 'Premium Nutrition Strategies', 'Advanced protocols to take your results to the next level.', premStrats);

    html += section('13', 'Progress Tracking', 'Simple, consistent measures of what is working.', progressTracking());

    return html;
  }

  /* ----------------------------------------------------------------------
     Coach note + footer (shared)
     ---------------------------------------------------------------------- */
  function coachSection() {
    var note = '';
    var outNote = document.getElementById('outNote');
    if (outNote) note = txt(outNote).replace(/^Akash says[^:]*:/i, '').trim();
    var fallback = 'Stay consistent, track weekly, and trust the process. Small daily wins build the body you are after.';
    return section('', 'A Note From Akash', 'Personal coaching touch to close this plan.',
      card(
        '<div style="font-size:13px;line-height:1.75;color:' + C.text + ';">"' + esc(note || fallback) + '"</div>' +
        '<div style="margin-top:16px;padding-top:14px;border-top:1px solid ' + C.border + ';">' +
        '<div style="font-size:13px;font-weight:800;color:' + C.text + ';">Akash Singh</div>' +
        '<div style="font-size:11px;color:' + C.muted + ';margin-top:2px;">Personalised Fitness &amp; Nutrition Coach</div>' +
        '</div>',
        true
      )
    );
  }

  function footer() {
    return '<tr><td style="background-color:' + C.dark + ';padding:28px 40px;text-align:center;">' +
      '<div style="color:#FFFFFF;font-size:14px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">Akash Liftsup</div>' +
      '<div style="color:#9A9A9A;font-size:11px;margin-top:4px;letter-spacing:1px;">Personalised Fitness &amp; Nutrition</div>' +
      '<div style="height:1px;background:#2C2C2C;margin:16px 0;"></div>' +
      '<div style="color:#6E6E6E;font-size:10px;line-height:1.7;">This plan was prepared personally for ' + esc(clientName()) + ' and is intended for personal use only.<br>Follow the protocol as written — progress is built one consistent week at a time.</div>' +
      '</td></tr>';
  }

  /* ----------------------------------------------------------------------
     Summary (shared) — "Your Plan at a Glance"
     ---------------------------------------------------------------------- */
  function summary(type) {
    var s = state();
    var items;
    if (type === 'meal') {
      var m = metrics();
      items = [
        { l: 'Goal', v: GOAL_LABEL[s.goal] || '—' },
        { l: 'Calories', v: m ? m.tgt + ' kcal' : '—' },
        { l: 'Protein', v: m ? m.protG + ' g' : '—' },
        { l: 'Diet', v: DIET_LABEL[s.diet] || '—' },
        { l: 'Training', v: (s.tdays || '—') + ' days/week' },
        { l: 'Body Fat', v: m ? m.bf + ' %' : '—' }
      ];
    } else if (type === 'workout') {
      var wk = workoutMeta();
      items = [
        { l: 'Goal', v: GOAL_LABEL[s.goal] || '—' },
        { l: 'Training Days', v: (s.days || '—') + ' days/week' },
        { l: 'Split', v: wk.splitName },
        { l: 'Session Length', v: DL_LABEL[s.duration] || (s.duration ? s.duration + ' min' : '—') },
        { l: 'Level', v: LL_LABEL[s.level] || '—' },
        { l: 'Location', v: (s.training || s.location) === 'gym' ? 'Gym' : 'Home' }
      ];
    } else { /* combo */
      var mc = metrics();
      var wkc = workoutMeta();
      items = [
        { l: 'Goal', v: GOAL_LABEL[s.goal] || '—' },
        { l: 'Calories', v: mc ? mc.tgt + ' kcal' : '—' },
        { l: 'Protein', v: mc ? mc.protG + ' g' : '—' },
        { l: 'Diet', v: DIET_LABEL[s.diet] || '—' },
        { l: 'Training', v: (s.days || s.tdays || '—') + ' days/week' },
        { l: 'Split', v: wkc.splitName }
      ];
    }
    return section('', 'Your Plan at a Glance', 'A snapshot of the key numbers in this plan.', statsGrid(items, 3));
  }

  /* ----------------------------------------------------------------------
     Public API
     ---------------------------------------------------------------------- */
  PE.build = function (type) {
    var s = state();
    var goalLabel = GOAL_LABEL[s.goal] || s.goal || '—';
    var planType = type === 'workout'
      ? 'Premium Workout Plan'
      : type === 'combo' ? 'Premium Combo Plan' : 'Premium Meal Plan';

    var inner = header(planType, goalLabel);
    inner += summary(type === 'workout' ? 'workout' : (type === 'combo' ? 'combo' : 'meal'));
    inner += type === 'workout' ? workoutContent() : (type === 'combo' ? comboContent() : mealContent());
    inner += coachSection();
    inner += footer();

    return shell(planType + ' — ' + clientName(), container(inner));
  };

})(window);
