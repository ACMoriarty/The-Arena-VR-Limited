/* ==========================================================================
   THE ARENA — site behaviour
   Home page: hex canvas, nav, reveals, zone cards, game picker, countdowns.
   Everything reads from window.ARENA (assets/js/arena.config.js).
   ========================================================================== */
(function () {
  'use strict';

  var A = window.ARENA;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- shared helpers (also used by book.js) ---------- */
  var money = function (n) {
    return '₦' + Number(n || 0).toLocaleString('en-NG');
  };
  window.ArenaUtil = { money: money, $: $, $$: $$, reduce: reduce };

  /* ======================================================================
     PRELOADER
     ====================================================================== */
  (function () {
    var pl = $('#preloader');
    if (!pl) return;
    var bar = $('.pl-bar i', pl), pct = 0;
    var tick = setInterval(function () {
      pct = Math.min(100, pct + Math.random() * 16 + 5);
      if (bar) bar.style.width = pct + '%';
      if (pct >= 100) clearInterval(tick);
    }, 120);
    var hide = function () {
      setTimeout(function () {
        if (bar) bar.style.width = '100%';
        pl.classList.add('done');
        setTimeout(function () { pl.remove(); }, 800);
      }, reduce ? 0 : 480);
    };
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
    setTimeout(hide, 3500); // never trap the user behind a stalled asset
  }());

  /* ======================================================================
     NAV + DRAWER
     ====================================================================== */
  (function () {
    var nav = $('#nav'), burger = $('#burger'), drawer = $('#drawer');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('stuck', window.scrollY > 24); };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    if (!burger || !drawer) return;
    var toggle = function (open) {
      nav.classList.toggle('open', open);
      drawer.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', function () {
      toggle(!drawer.classList.contains('open'));
    });
    $$('a', drawer).forEach(function (a) {
      a.addEventListener('click', function () { toggle(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') toggle(false);
    });
  }());

  /* ======================================================================
     REVEAL ON SCROLL
     ====================================================================== */
  (function () {
    var els = $$('[data-reveal]');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var d = parseInt(en.target.getAttribute('data-delay') || '0', 10);
        setTimeout(function () { en.target.classList.add('in'); }, d);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }());

  /* ======================================================================
     HERO — animated hexagon field
     A slow-drifting honeycomb that lights individual cells in brand colours
     and reacts to the pointer. Pure canvas, no libraries, no assets.
     ====================================================================== */
  (function () {
    var cv = document.getElementById('hexfield');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = 1, cells = [], t = 0, raf = 0;
    var mouse = { x: -9999, y: -9999 };
    var COLORS = ['252,79,21', '32,233,249', '255,222,21'];
    var R = 46;                       // hex radius

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cells = [];
      var hw = Math.sqrt(3) * R;        // horizontal spacing (pointy-top)
      var vh = R * 1.5;                 // vertical spacing
      for (var row = -1; row * vh < H + R * 2; row++) {
        for (var col = -1; col * hw < W + hw * 2; col++) {
          var x = col * hw + (row % 2 ? hw / 2 : 0);
          var y = row * vh;
          cells.push({
            x: x, y: y,
            seed: Math.random() * Math.PI * 2,
            speed: 0.35 + Math.random() * 0.9,
            c: COLORS[(Math.random() * COLORS.length) | 0],
            base: Math.random() * 0.05
          });
        }
      }
    }

    function hexPath(x, y, r) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30);
        var px = x + r * Math.cos(a), py = y + r * Math.sin(a);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    }

    function frame() {
      t += 0.006;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        // slow breathing pulse, offset per cell
        var pulse = (Math.sin(t * c.speed + c.seed) + 1) / 2;
        var a = c.base + pulse * 0.16;

        // pointer proximity lights the neighbourhood up
        var dx = c.x - mouse.x, dy = c.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 52900) {                       // within 230px
          a += (1 - Math.sqrt(d2) / 230) * 0.55;
        }

        if (a <= 0.02) continue;
        ctx.strokeStyle = 'rgba(' + c.c + ',' + a.toFixed(3) + ')';
        hexPath(c.x, c.y, R - 4);
        ctx.stroke();

        // a few cells get a filled core
        if (a > 0.42) {
          ctx.fillStyle = 'rgba(' + c.c + ',' + ((a - 0.42) * 0.5).toFixed(3) + ')';
          hexPath(c.x, c.y, (R - 4) * 0.34);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      build();
      if (reduce) {                             // one static pass, no loop
        t = 1; ctx.clearRect(0, 0, W, H);
        cells.forEach(function (c) {
          ctx.strokeStyle = 'rgba(' + c.c + ',0.07)';
          hexPath(c.x, c.y, R - 4); ctx.stroke();
        });
        return;
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(start, 180);
    });
    window.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }, { passive: true });
    window.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });

    // pause when the hero scrolls away — saves battery on phones
    if ('IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { raf = requestAnimationFrame(frame); }
        else cancelAnimationFrame(raf);
      }, { threshold: 0 }).observe(cv);
    }
    start();
  }());

  /* ======================================================================
     ZONE CARDS
     ====================================================================== */
  var ICONS = {
    vr: '<path d="M3 9.5A2.5 2.5 0 0 1 5.5 7h13A2.5 2.5 0 0 1 21 9.5v4a2.5 2.5 0 0 1-2.5 2.5h-2.2a2 2 0 0 1-1.6-.8l-.9-1.2a2 2 0 0 0-3.2 0l-.9 1.2a2 2 0 0 1-1.6.8H5.5A2.5 2.5 0 0 1 3 13.5z"/>',
    moto: '<circle cx="5.5" cy="17" r="3.2"/><circle cx="18.5" cy="17" r="3.2"/><path d="M8.6 17h6.2l-3.4-6H8m6.4 0h2.8l1.3 6M6 8h3.5"/>',
    pad:  '<path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 3.6l.8 4A3.2 3.2 0 0 1 18.6 19c-1 0-1.8-.5-2.4-1.3L15 16H9l-1.2 1.7A2.9 2.9 0 0 1 5.4 19a3.2 3.2 0 0 1-3.1-3.4l.8-4A4.5 4.5 0 0 1 7.5 8z"/><path d="M7 11v3M5.5 12.5h3M16 11.5h.01M18 13.5h.01"/>',
    headset: '<path d="M4 12a8 8 0 0 1 16 0"/><rect x="2.5" y="12" width="4" height="7" rx="2"/><rect x="17.5" y="12" width="4" height="7" rx="2"/>',
    mic:  '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7"/>'
  };

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.pad) + '</svg>';
  }
  window.ArenaUtil.icon = icon;

  (function () {
    var wrap = $('#zones');
    if (!wrap || !A) return;

    wrap.innerHTML = A.experiences.map(function (x, i) {
      var per = x.perRoom ? 'per room / ' + x.unitLabel : 'per player / ' + x.unitLabel;
      return '' +
      '<article class="zone" data-reveal data-delay="' + (i * 90) + '">' +
        '<div class="zone-fallback"></div>' +
        // no photo yet? fall back to the branded gradient rather than a broken image
        (x.image
          ? '<div class="zone-media"><img src="' + x.image + '" alt="' + x.name + ' at The Arena" loading="lazy" decoding="async" onerror="this.closest(\'.zone-media\').remove()"></div>'
          : '') +
        '<span class="zone-num">0' + (i + 1) + '</span>' +
        '<div class="zone-body">' +
          '<div class="zone-meta">' +
            '<span class="tag"><i class="dot"></i>' + x.tag + '</span>' +
            '<span class="tag">' + x.games.length + ' titles</span>' +
          '</div>' +
          '<h3>' + x.name + '</h3>' +
          '<p>' + x.blurb + '</p>' +
          '<div class="zone-foot">' +
            '<div class="zone-price">' + money(x.price) + '<small>' + per + '</small></div>' +
            '<a class="btn btn-ghost btn-sm" href="book.html?exp=' + x.id + '"><span>Book &amp; choose game</span></a>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    // re-observe the freshly injected cards
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          var d = parseInt(en.target.getAttribute('data-delay') || '0', 10);
          setTimeout(function () { en.target.classList.add('in'); }, d);
          io.unobserve(en.target);
        });
      }, { threshold: 0.1 });
      $$('.zone', wrap).forEach(function (el) { io.observe(el); });
    } else {
      $$('.zone', wrap).forEach(function (el) { el.classList.add('in'); });
    }
  }());

  /* ======================================================================
     GAME PICKER TABS
     ====================================================================== */
  (function () {
    var tabs = $('#pickerTabs'), panels = $('#pickerPanels');
    if (!tabs || !panels || !A) return;
    var accents = { orange: '', cyan: 'cy', yellow: 'ye', blue: '' };

    tabs.innerHTML = A.experiences.map(function (x, i) {
      return '<button role="tab" data-tab="' + x.id + '" aria-selected="' + (i === 0) + '">' + x.name + '</button>';
    }).join('');

    panels.innerHTML = A.experiences.map(function (x, i) {
      var head = x.gamesLabel
        ? '<p class="mono" style="margin-bottom:6px">' + x.gamesLabel + '</p><p class="lead" style="font-size:14.5px;margin-bottom:20px">' + (x.gamesHint || '') + '</p>'
        : '<p class="mono" style="margin-bottom:20px">' + x.games.length + ' titles ready to load on ' + x.name + '</p>';
      var chips = x.games.map(function (g) {
        return '<a class="game-chip ' + (accents[x.accent] || '') + '" href="book.html?exp=' + x.id +
               '&game=' + encodeURIComponent(g) + '"><i class="hex"></i>' + g + '</a>';
      }).join('');
      return '<div class="picker-panel' + (i === 0 ? ' on' : '') + '" data-panel="' + x.id + '">' +
             head + '<div class="game-grid">' + chips + '</div>' +
             '<p class="lead" style="font-size:13.5px;margin-top:20px;color:var(--ink-3)">Not listed? Ask at the desk or message us — the library changes often.</p>' +
             '</div>';
    }).join('');

    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      $$('[data-tab]', tabs).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      $$('.picker-panel', panels).forEach(function (p) {
        p.classList.toggle('on', p.getAttribute('data-panel') === b.getAttribute('data-tab'));
      });
    });
  }());

  /* ======================================================================
     EVENT DATES + COUNTDOWNS
     ====================================================================== */
  function nextWeekly(weekday, hour) {
    var now = new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
    var delta = (weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + delta);
    if (d <= now) d.setDate(d.getDate() + 7);
    return d;
  }

  function lastWeekdayOfMonth(year, month, weekday, hour) {
    var d = new Date(year, month + 1, 0, hour, 0, 0, 0);      // last day of month
    d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
    return d;
  }

  function nextMonthlyLast(weekday, hour) {
    var now = new Date();
    var d = lastWeekdayOfMonth(now.getFullYear(), now.getMonth(), weekday, hour);
    if (d <= now) d = lastWeekdayOfMonth(now.getFullYear(), now.getMonth() + 1, weekday, hour);
    return d;
  }

  window.ArenaUtil.nextEventDate = function (ev) {
    return ev.nth === 'last' ? nextMonthlyLast(ev.weekday, ev.hour) : nextWeekly(ev.weekday, ev.hour);
  };

  (function () {
    if (!A) return;
    var targets = {
      fifa: window.ArenaUtil.nextEventDate(A.events.fifa),
      karaoke: window.ArenaUtil.nextEventDate(A.events.karaoke)
    };
    var boxes = $$('[data-countdown]');
    if (!boxes.length) return;

    var pad = function (n) { return n < 10 ? '0' + n : String(n); };

    function tick() {
      boxes.forEach(function (box) {
        var target = targets[box.getAttribute('data-countdown')];
        if (!target) return;
        var ms = Math.max(0, target - new Date());
        var s = Math.floor(ms / 1000);
        $('[data-d]', box).textContent = pad(Math.floor(s / 86400));
        $('[data-h]', box).textContent = pad(Math.floor(s / 3600) % 24);
        $('[data-m]', box).textContent = pad(Math.floor(s / 60) % 60);
        $('[data-s]', box).textContent = pad(s % 60);
      });
    }
    tick();
    setInterval(tick, 1000);
  }());

  /* ======================================================================
     FILL CONTENT FROM CONFIG
     ====================================================================== */
  (function () {
    if (!A) return;
    var b = A.business, ev = A.events;
    var set = function (sel, val) { var el = $(sel); if (el) el.textContent = val; };
    var wa = 'https://wa.me/' + b.whatsapp + '?text=' +
             encodeURIComponent('Hi The Arena! I would like to book a session.');

    // hero stats
    var totalGames = A.experiences.reduce(function (n, x) { return n + x.games.length; }, 0);
    set('#statGames', totalGames + '+');
    var lowest = Math.min.apply(null, A.experiences.map(function (x) { return x.price; }));
    set('#statFrom', money(lowest));

    // events
    if ($('#fifaCadence')) {
      set('#fifaCadence', ev.fifa.cadence);
      set('#fifaTime', ev.fifa.time);
      set('#fifaFormat', ev.fifa.format + ' · ' + ev.fifa.slots + ' places · ' + ev.fifa.prize + '.');
      var fp = $('#fifaPrice');
      if (fp) fp.innerHTML = money(ev.fifa.entry) + '<small>Entry per player</small>';
      var fb = $('#fifaBullets');
      if (fb) fb.innerHTML = ev.fifa.bullets.map(function (t) { return '<li>' + t + '</li>'; }).join('');

      set('#karCadence', ev.karaoke.cadence);
      set('#karTime', ev.karaoke.time);
      set('#karFormat', ev.karaoke.format + ' · ' + ev.karaoke.slots + ' places · ' + ev.karaoke.prize + '.');
      var kp = $('#karPrice');
      if (kp) kp.innerHTML = money(ev.karaoke.entry) + '<small>Entry per singer</small>';
      var kb = $('#karBullets');
      if (kb) kb.innerHTML = ev.karaoke.bullets.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    }

    // visit rows
    var rows = $('#infoRows');
    if (rows) {
      var html = '' +
        '<div class="info-row"><dt>Address</dt><dd>' + b.address + '<br>' + b.state + '</dd></div>' +
        '<div class="info-row"><dt>Phone</dt><dd><a href="tel:' + b.phoneIntl + '">' + b.phone + '</a></dd></div>' +
        '<div class="info-row"><dt>WhatsApp</dt><dd><a href="' + wa + '" target="_blank" rel="noopener">' + b.phone + '</a></dd></div>' +
        '<div class="info-row"><dt>Email</dt><dd><a href="mailto:' + b.email + '">' + b.email + '</a></dd></div>';
      html += b.hours.map(function (h, i) {
        return '<div class="info-row"><dt>' + (i === 0 ? 'Opening hours' : '') + '</dt><dd>' + h.days + ' &middot; ' + h.time + '</dd></div>';
      }).join('');
      rows.innerHTML = html;
    }

    // footer
    var fp2 = $('#footPlay');
    if (fp2) fp2.innerHTML = A.experiences.map(function (x) {
      return '<li><a href="book.html?exp=' + x.id + '">' + x.name + '</a></li>';
    }).join('');

    var fc = $('#footContact');
    if (fc) fc.innerHTML = '' +
      '<li><a href="tel:' + b.phoneIntl + '">' + b.phone + '</a></li>' +
      '<li><a href="' + wa + '" target="_blank" rel="noopener">WhatsApp us</a></li>' +
      '<li><a href="mailto:' + b.email + '">' + b.email + '</a></li>' +
      '<li>' + b.address + '</li>';

    var soc = $('#socials');
    if (soc) soc.innerHTML = '' +
      '<a href="' + b.instagram + '" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4 1 .5.4.8.8 1 1.4.2.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-1 1.4-.4.5-.8.8-1.4 1-.4.2-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-1-.5-.4-.8-.8-1-1.4-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.4.4-.5.8-.8 1.4-1 .4-.2 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm6.9-11.1a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z"/></svg></a>' +
      '<a href="' + b.tiktok + '" target="_blank" rel="noopener" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V9.5a5.9 5.9 0 0 0-.8-.1 5.8 5.8 0 1 0 5.8 5.8V8.9a7 7 0 0 0 4.2 1.4V7.2a4.1 4.1 0 0 1-4.3-4.1V2z"/></svg></a>' +
      '<a href="' + b.x + '" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24"><path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.5 3h6.3l4.4 5.8zm-1.1 16.1h1.7L7.7 4.8H5.9z"/></svg></a>';

    // contact links
    var wab = $('#waBtn'), waf = $('#waFloat'), cb = $('#callBtn'), np = $('#navPhone');
    if (wab) wab.href = wa;
    if (waf) waf.href = wa;
    if (cb) { cb.href = 'tel:' + b.phoneIntl; $('span', cb).textContent = 'Call ' + b.phone; }
    if (np) np.href = 'tel:' + b.phoneIntl;

    /* live open/closed badge, driven by booking.schedule */
    var st = $('#openStatus');
    if (st && A.booking && A.booking.schedule) {
      var now = new Date();
      var win = A.booking.schedule[now.getDay()];
      var tag = $('#openTag');
      var fmt = function (h) {
        var ap = h >= 12 ? 'pm' : 'am';
        return (h % 12 || 12) + ap;
      };
      if (win && now.getHours() >= win.open && now.getHours() < win.close) {
        st.textContent = 'Open now until ' + fmt(win.close) + ' · Boundary Road, GRA';
      } else if (win) {
        st.textContent = 'Today ' + fmt(win.open) + ' – ' + fmt(win.close) + ' · Boundary Road, GRA';
        if (tag) tag.classList.remove('live');
      } else {
        st.textContent = 'Closed today · Open Tuesday from 10am';
        if (tag) tag.classList.remove('live');
      }
    }

    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  }());

}());
