/* FitPlan Blogs — approved posts + submission flow */
(function () {
  'use strict';

  /* ── CONFIG ──
     Paste your Google Apps Script web app URL here (the /exec link from the
     deployment in blog-approvals.gs). Until then, the form stays disabled. */
  var BLOG_APP_URL = 'https://script.google.com/macros/s/AKfycbx1nZ7FtKeQDsGfPR5-ETTKQK5TQKdu1w8g2muQRRZW4qvotM58gZyIVyrs2YXJNAgoBA/exec';

  var CAT_LABELS = { lifestyle: 'Lifestyle', health: 'Health', workout: 'Workout', recipes: 'Recipes' };
  var CAT_ORDER = ['lifestyle', 'health', 'workout', 'recipes'];

  var posts = [];
  var active = 'All';

  var grid = document.getElementById('blogGrid');
  var chipsWrap = document.getElementById('blogChips');
  var emptyEl = document.getElementById('blogEmpty');
  var metaEl = document.getElementById('blogMeta');
  var modal = document.getElementById('blogModal');
  var modalBody = document.getElementById('blogModalBody');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(d) {
    if (!d) return '';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function catBadge(cat) {
    return '<span class="blog-cat cat-' + esc(cat) + '">' + esc(CAT_LABELS[cat] || cat) + '</span>';
  }

  /* ── CATEGORY CHIPS ── */
  function renderChips() {
    if (!chipsWrap) return;
    var cats = ['All'].concat(CAT_ORDER.filter(function (c) {
      return posts.some(function (p) { return p.category === c; });
    }));
    chipsWrap.innerHTML = cats.map(function (c) {
      var count = c === 'All' ? posts.length : posts.filter(function (p) { return p.category === c; }).length;
      return '<button class="chip' + (active === c ? ' on' : '') + '" data-cat="' + esc(c) + '" type="button">' +
        esc(c === 'All' ? 'All' : CAT_LABELS[c]) + ' <span class="chip-count">' + count + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(chipsWrap.querySelectorAll('.chip'), function (chip) {
      chip.addEventListener('click', function () {
        active = chip.getAttribute('data-cat');
        renderChips();
        renderPosts();
      });
    });
  }

  /* ── POST CARDS ── */
  function byDateDesc(a, b) {
    return (b.date || '').localeCompare(a.date || '');
  }

  function cardHtml(p) {
    return '<article class="blog-card" data-id="' + esc(p.id) + '" tabindex="0" role="button" aria-label="Read: ' + esc(p.title) + '">' +
      '<div class="blog-card-top">' + catBadge(p.category) +
        (p.readTime ? '<span class="blog-read">' + esc(p.readTime) + '</span>' : '') +
      '</div>' +
      '<h3 class="blog-title">' + esc(p.title) + '</h3>' +
      '<p class="blog-excerpt">' + esc(p.excerpt) + '</p>' +
      '<div class="blog-card-bottom">' +
        '<span class="blog-author"><i data-lucide="user" style="width:12px;height:12px"></i> ' + esc(p.author || 'Anonymous') + '</span>' +
        '<span class="blog-date">' + fmtDate(p.date) + '</span>' +
      '</div>' +
    '</article>';
  }

  function renderPosts() {
    if (!grid) return;
    var sorted = posts.slice().sort(byDateDesc);
    if (metaEl) {
      if (active === 'All') {
        var lbl = posts.length + (posts.length === 1 ? ' post' : ' posts');
        if (posts.length) lbl += ' — latest 2 per category';
        metaEl.textContent = lbl;
      } else {
        var n = sorted.filter(function (p) { return p.category === active; }).length;
        metaEl.textContent = n + (n === 1 ? ' post' : ' posts') + ' in ' + (CAT_LABELS[active] || active);
      }
    }

    if (!posts.length) {
      grid.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var html = '';
    if (active === 'All') {
      var perCat = {};
      sorted.forEach(function (p) {
        if (!perCat[p.category]) perCat[p.category] = [];
        if (perCat[p.category].length < 2) perCat[p.category].push(p);
      });
      CAT_ORDER.forEach(function (c) {
        var catPosts = perCat[c];
        if (!catPosts || !catPosts.length) return;
        html += '<div class="blog-cat-group"><div class="blog-cat-head"><span class="blog-cat-name">' + esc(CAT_LABELS[c] || c) + '</span></div>' +
          catPosts.map(cardHtml).join('') +
        '</div>';
      });
    } else {
      html = sorted.filter(function (p) { return p.category === active; }).map(cardHtml).join('');
    }
    grid.innerHTML = html;

    Array.prototype.forEach.call(grid.querySelectorAll('.blog-card'), function (card) {
      function open() { openPost(card.getAttribute('data-id')); }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  /* ── POST MODAL ── */
  function openPost(id) {
    var p = null;
    for (var i = 0; i < posts.length; i++) { if (String(posts[i].id) === String(id)) { p = posts[i]; break; } }
    if (!p || !modal || !modalBody) return;
    var paras = String(p.content || '').split(/\n\s*\n/).map(function (chunk) {
      return '<p>' + esc(chunk).replace(/\n/g, '<br/>') + '</p>';
    }).join('');
    modalBody.innerHTML =
      '<div class="blog-modal-head">' + catBadge(p.category) +
        (p.readTime ? '<span class="blog-read">' + esc(p.readTime) + '</span>' : '') +
      '</div>' +
      '<h2 class="blog-modal-title">' + esc(p.title) + '</h2>' +
      '<div class="blog-modal-meta">By <strong>' + esc(p.author || 'Anonymous') + '</strong> · ' + fmtDate(p.date) + '</div>' +
      '<div class="blog-modal-body">' + paras + '</div>';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && !modal.hidden) closeModal(); });
  }

  /* ── SUBMISSION → EMAIL (Web3Forms) ── */
  var formEl = document.getElementById('blogForm');
  var successEl = document.getElementById('blogSuccess');
  var errorEl = document.getElementById('blogError');
  var charCount = document.getElementById('blogCharCount');

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (formEl) {
    var titleEl = document.getElementById('blogTitle');
    var catEl = document.getElementById('blogCat');
    var authorEl = document.getElementById('blogAuthor');
    var emailEl = document.getElementById('blogEmail');
    var contentEl = document.getElementById('blogContent');
    var submitBtn = formEl.querySelector('button[type="submit"]');
    var botcheckEl = document.getElementById('blogBotcheck');

    if (contentEl && charCount) {
      contentEl.addEventListener('input', function () {
        var n = contentEl.value.trim().length;
        charCount.textContent = n + (n === 1 ? ' character' : ' characters');
      });
    }

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = titleEl ? titleEl.value.trim() : '';
      var cat = catEl ? catEl.value : 'lifestyle';
      var author = authorEl ? authorEl.value.trim() : '';
      var email = emailEl ? emailEl.value.trim() : '';
      var content = contentEl ? contentEl.value.trim() : '';
      if (!title || !content) return;

      if (BLOG_APP_URL.indexOf('PASTE_YOUR') === 0) {
        showError('Blog submissions aren\'t configured yet. Please contact the site owner to enable posting.');
        return;
      }
      if (errorEl) errorEl.hidden = true;
      if (successEl) successEl.hidden = true;

      var fd = new FormData();
      fd.append('title', title);
      fd.append('category', cat);
      fd.append('author', author || 'Anonymous');
      fd.append('email', email);
      fd.append('blog_content', content);
      if (botcheckEl && botcheckEl.checked) fd.append('botcheck', botcheckEl.value);

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      fetch(BLOG_APP_URL, { method: 'POST', body: fd })
        .then(function (r) {
          return r.text().then(function (t) {
            var d = null;
            try { d = JSON.parse(t); } catch (e) {}
            return { ok: r.ok, data: d };
          });
        })
        .then(function (res) {
          if (res.data && res.data.success) {
            if (successEl) successEl.hidden = false;
            formEl.reset();
            if (charCount) charCount.textContent = '';
            if (successEl) successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (res.data && res.data.error) {
            showError('The blog system reported an error: ' + res.data.error);
          } else {
            showError('We couldn\'t send your post. The blog system didn\'t respond properly — please try again or message us on Telegram for help.');
          }
        })
        .catch(function () {
          showError('Network error — your post was not sent. Check your connection and try again.');
        })
        .then(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send for approval →'; }
        });
    });
  }

  /* ── BOOT ── */
  function boot() {
    renderChips();
    renderPosts();
  }

  fetch('blogs-data.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      posts = (data && data.posts) || [];
      boot();
    })
    .catch(function () {
      if (grid) grid.innerHTML = '';
      if (emptyEl) {
        emptyEl.hidden = false;
        var msg = $('.empty p', emptyEl);
        if (msg) msg.textContent = 'Could not load blog posts right now. Please try again later.';
      }
    });
})();
