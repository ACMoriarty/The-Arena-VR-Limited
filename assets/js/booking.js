/* ==========================================================================
   THE ARENA — booking engine
   5-step wizard → Paystack Inline checkout.
   All prices, games, hours and the Paystack key come from arena.config.js.
   ========================================================================== */
(function () {
  'use strict';

  var A = window.ARENA;
  var U = window.ArenaUtil || {};
  var $ = U.$ || function (s, r) { return (r || document).querySelector(s); };
  var $$ = U.$$ || function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = U.money || function (n) { return '₦' + Number(n || 0).toLocaleString('en-NG'); };
  if (!A) return;

  /* ---------------------------------------------------------------------
     STATE
     --------------------------------------------------------------------- */
  var S = {
    kind: null,        // 'experience' | 'event'
    exp: null,         // experience object
    event: null,       // event object
    game: null,        // chosen game / playlist
    date: '',
    time: '',
    duration: 0,       // minutes
    players: 1,
    name: '', phone: '', email: '', area: '', note: '',
    step: 1
  };

  var LAST = 5;        // last input step; 6 is the confirmation screen

  /* ---------------------------------------------------------------------
     PRICING
     One place, so the rail, the review screen and Paystack can never drift.
     --------------------------------------------------------------------- */
  function priceBreakdown() {
    var out = { lines: [], total: 0 };

    if (S.kind === 'event' && S.event) {
      var n = S.players;
      var sub = S.event.entry * n;
      out.lines.push({
        label: S.event.name + ' entry',
        detail: money(S.event.entry) + ' × ' + n + (n === 1 ? ' player' : ' players'),
        amount: sub
      });
      out.total = sub;
    } else if (S.exp && S.duration) {
      var blocks = Math.max(1, Math.round(S.duration / S.exp.unit));
      var heads = S.exp.perRoom ? 1 : S.players;
      var sub2 = S.exp.price * blocks * heads;
      out.lines.push({
        label: S.exp.name,
        detail: money(S.exp.price) + ' × ' + blocks + ' × ' + (S.exp.perRoom ? '1 room' : heads + (heads === 1 ? ' player' : ' players')),
        amount: sub2
      });
      out.total = sub2;
    }

    var fee = A.booking.serviceFee || 0;
    if (fee > 0 && out.total > 0) {
      out.lines.push({ label: 'Booking fee', detail: 'Flat', amount: fee });
      out.total += fee;
    }
    return out;
  }

  /* ---------------------------------------------------------------------
     STEP 1 — experiences and events
     --------------------------------------------------------------------- */
  function buildStep1() {
    var wrap = $('#expOpts');
    wrap.innerHTML = A.experiences.map(function (x) {
      var cls = { cyan: 'cy', yellow: 'ye', blue: 'bl' }[x.accent] || '';
      var per = x.perRoom ? 'per room / ' + x.unitLabel : 'per player / ' + x.unitLabel;
      // a photo when we have one, otherwise the brand gradient behind the icon
      var thumb = x.image
        ? '<span class="opt-thumb"><img src="' + x.image + '" alt="" loading="lazy" decoding="async"></span>'
        : '<span class="opt-thumb empty">' + (U.icon ? U.icon(x.icon) : '') + '</span>';
      return '<button type="button" class="opt ' + cls + '" data-exp="' + x.id + '" aria-pressed="false">' +
               thumb +
               '<span class="opt-txt"><b>' + x.name + '</b><span>' + x.tag + ' · ' + x.games.length + ' titles</span></span>' +
               '<span class="opt-price"><b>' + money(x.price) + '</b><span>' + per + '</span></span>' +
             '</button>';
    }).join('');

    var evs = $('#eventOpts');
    var list = [A.events.fifa, A.events.karaoke];
    evs.innerHTML = list.map(function (e, i) {
      var next = U.nextEventDate ? U.nextEventDate(e) : null;
      var when = next ? next.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }) : e.cadence;
      return '<button type="button" class="opt ' + (i ? 'bl' : '') + '" data-event="' + e.id + '" aria-pressed="false">' +
               '<span class="opt-ico">' + (U.icon ? U.icon(i ? 'mic' : 'pad') : '') + '</span>' +
               '<span class="opt-txt"><b>' + e.name + '</b><span>' + e.cadence + ' · next ' + when + ', ' + e.time + '</span></span>' +
               '<span class="opt-price"><b>' + money(e.entry) + '</b><span>entry</span></span>' +
             '</button>';
    }).join('');

    // a missing photo falls back to the brand gradient rather than a broken image
    $$('.opt-thumb img', wrap).forEach(function (img) {
      img.addEventListener('error', function () {
        var box = img.parentNode;
        box.className = 'opt-thumb empty';
        box.innerHTML = U.icon ? U.icon('vr') : '';
      });
    });

    function clearAll() {
      $$('#expOpts .opt, #eventOpts .opt').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    }

    $('#expOpts').addEventListener('click', function (e) {
      var b = e.target.closest('[data-exp]');
      if (!b) return;
      clearAll(); b.setAttribute('aria-pressed', 'true');
      S.kind = 'experience';
      S.event = null;
      S.exp = A.experiences.filter(function (x) { return x.id === b.getAttribute('data-exp'); })[0];
      S.game = null;
      S.duration = S.exp.durations[0];
      enableNext(1, true);
      render();
    });

    evs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-event]');
      if (!b) return;
      clearAll(); b.setAttribute('aria-pressed', 'true');
      S.kind = 'event';
      S.exp = null;
      var id = b.getAttribute('data-event');
      S.event = (id === 'fifa') ? A.events.fifa : A.events.karaoke;
      S.game = null;
      S.duration = 0;
      // events happen on a fixed date — prefill it
      var d = U.nextEventDate ? U.nextEventDate(S.event) : null;
      if (d) {
        S.date = isoDate(d);
        S.time = pad(S.event.hour) + ':00';
      }
      enableNext(1, true);
      render();
    });
  }

  /* ---------------------------------------------------------------------
     STEP 2 — game / playlist choice
     --------------------------------------------------------------------- */
  function buildStep2() {
    var head = $('#gameHead'), sub = $('#gameSub'), grid = $('#gameOpts');

    if (S.kind === 'event') {
      if (S.event.id === 'fifa') {
        head.textContent = 'Your tournament setup';
        sub.textContent = 'Pick the side you want to play as in round one. You can change it between matches.';
        var teams = ['Real Madrid', 'Barcelona', 'Manchester City', 'Arsenal', 'Liverpool', 'Manchester United',
                     'Chelsea', 'Bayern Munich', 'PSG', 'Inter Milan', 'Al Nassr', 'Nigeria (Super Eagles)',
                     'Brazil', 'Argentina', 'Enyimba FC', 'Surprise me'];
        grid.innerHTML = teams.map(chip).join('');
      } else {
        head.textContent = 'Your opening number';
        sub.textContent = 'Tell us the genre you\'re opening with so the host can cue it up.';
        grid.innerHTML = A.experiences.filter(function (x) { return x.id === 'karaoke'; })[0]
          .games.map(chip).join('');
      }
    } else {
      head.textContent = S.exp.gamesLabel || 'Choose your game';
      sub.textContent = S.exp.gamesHint || ('Any of these ' + S.exp.games.length +
        ' titles can be loaded on ' + S.exp.name + ' before you arrive.');
      grid.innerHTML = S.exp.games.map(chip).join('');
    }

    if (S.game) {
      $$('.game-chip', grid).forEach(function (c) {
        if (c.getAttribute('data-game') === S.game) c.setAttribute('aria-pressed', 'true');
      });
      enableNext(2, true);
    }

    function chip(g) {
      return '<button type="button" class="game-chip opt" data-game="' + esc(g) + '" aria-pressed="false" ' +
             'style="justify-content:flex-start"><i class="hex"></i>' + esc(g) + '</button>';
    }

    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-game]');
      if (!b) return;
      $$('[data-game]', grid).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      S.game = b.getAttribute('data-game');
      enableNext(2, true);
      render();
    });
  }

  /* ---------------------------------------------------------------------
     STEP 3 — date, duration, slot, players
     --------------------------------------------------------------------- */
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function prettyDate(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function prettyTime(t) {
    if (!t) return '—';
    var p = t.split(':'), h = +p[0], m = p[1];
    var ap = h >= 12 ? 'pm' : 'am';
    var hh = h % 12 || 12;
    return hh + ':' + m + ap;
  }

  function buildStep3() {
    var dateEl = $('#bDate'), durEl = $('#bDur');
    var today = new Date();
    var max = new Date(); max.setDate(max.getDate() + (A.booking.maxDaysAhead || 30));
    dateEl.min = isoDate(today);
    dateEl.max = isoDate(max);
    if (!S.date) S.date = isoDate(today);
    dateEl.value = S.date;

    var isEvent = S.kind === 'event';
    $('#whenSub').textContent = isEvent
      ? 'This event runs on a fixed date and time — just tell us how many of you are entering.'
      : 'Choose a date, a start time, how long you\'re playing and how many of you.';

    // duration select (hidden for events)
    $('#fDur').style.display = isEvent ? 'none' : '';
    $('#fSlot').style.display = isEvent ? 'none' : '';
    dateEl.disabled = isEvent;

    if (!isEvent) {
      durEl.innerHTML = S.exp.durations.map(function (m) {
        var blocks = Math.max(1, Math.round(m / S.exp.unit));
        var per = S.exp.perRoom ? '' : ' / player';
        return '<option value="' + m + '">' + label(m) + ' — ' + money(S.exp.price * blocks) + per + '</option>';
      }).join('');
      if (!S.duration || S.exp.durations.indexOf(S.duration) === -1) S.duration = S.exp.durations[0];
      durEl.value = String(S.duration);
      buildSlots();
    }

    // players
    var perRoom = !isEvent && S.exp && S.exp.perRoom;
    $('#playersLabel').textContent = isEvent
      ? (S.event.id === 'fifa' ? 'How many are entering?' : 'How many are singing?')
      : (perRoom ? 'How many in your group?' : 'How many players?');
    $('#playersHint').textContent = isEvent
      ? 'Each entry is charged separately — ' + money(S.event.entry) + ' per person.'
      : (perRoom ? 'The room price covers the whole group. This just tells us how many chairs to set out.'
                 : 'Everyone in your group needs their own station for this session.');
    $('#qOut').textContent = String(S.players);

    function label(m) {
      if (m < 60) return m + ' minutes';
      var h = m / 60;
      return (h % 1 ? h.toFixed(1) : h) + (h === 1 ? ' hour' : ' hours');
    }
  }

  /* the opening window for a given yyyy-mm-dd, or null when we are closed */
  function dayWindow(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    var dow = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
    return (A.booking.schedule && A.booking.schedule[dow]) || null;
  }

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function dayName(iso) {
    var p = iso.split('-');
    return DAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()];
  }

  function buildSlots() {
    var wrap = $('#slots');
    if (!S.exp) { wrap.innerHTML = ''; return; }

    var win = dayWindow(S.date);
    if (!win) {                                  // closed that day
      S.time = '';
      wrap.innerHTML = '<p class="closed-note">We are closed on ' +
        dayName(S.date) + 's. Please choose another day.</p>';
      return;
    }

    var open = win.open, close = win.close, step = A.booking.slotMinutes;
    var isToday = S.date === isoDate(new Date());
    var now = new Date();
    var html = '';

    // a session must be able to finish before we close
    for (var mins = open * 60; mins + S.duration <= close * 60; mins += step) {
      var h = Math.floor(mins / 60), m = mins % 60;
      var val = pad(h) + ':' + pad(m);
      var past = isToday && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()));
      html += '<button type="button" class="slot" data-slot="' + val + '"' +
              (past ? ' disabled' : '') +
              ' aria-pressed="' + (S.time === val) + '">' + prettyTime(val) + '</button>';
    }
    wrap.innerHTML = html || '<p class="closed-note">No slots left for this day — try another date.</p>';

    if (S.time && !$('[data-slot="' + S.time + '"]:not([disabled])', wrap)) S.time = '';
  }

  /* ---------------------------------------------------------------------
     VALIDATION
     --------------------------------------------------------------------- */
  function bad(id, on) { $(id).classList.toggle('bad', !!on); return !on; }

  function validateStep(n) {
    if (n === 1) return !!(S.exp || S.event);
    if (n === 2) return !!S.game;
    if (n === 3) {
      var ok = bad('#fDate', !S.date || (S.kind !== 'event' && !dayWindow(S.date)));
      if (S.kind !== 'event') ok = bad('#fSlot', !S.time) && ok;
      return ok;
    }
    if (n === 4) {
      var okN = bad('#fName', S.name.trim().length < 2);
      var digits = S.phone.replace(/\D/g, '');
      var okP = bad('#fPhone', digits.length < 10 || digits.length > 14);
      var okE = bad('#fEmail', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.email.trim()));
      return okN && okP && okE;
    }
    return true;
  }

  function enableNext(step, on) {
    var b = $('.fstep[data-step="' + step + '"] [data-next]');
    if (b) b.disabled = !on;
  }

  /* ---------------------------------------------------------------------
     NAVIGATION
     --------------------------------------------------------------------- */
  function goto(n) {
    S.step = n;
    $$('.fstep').forEach(function (s) {
      s.classList.toggle('on', +s.getAttribute('data-step') === n);
    });
    $$('#stepper div').forEach(function (d) {
      var i = +d.getAttribute('data-s');
      d.classList.toggle('on', i === n);
      d.classList.toggle('done', i < n);
      // on phones the strip scrolls sideways — keep the live step visible
      if (i === n && d.parentNode.scrollWidth > d.parentNode.clientWidth) {
        d.parentNode.scrollTo({
          left: Math.max(0, d.offsetLeft - 16),
          behavior: U.reduce ? 'auto' : 'smooth'
        });
      }
    });
    $('#rail').style.display = n > LAST ? 'none' : '';
    if (n === 2) buildStep2();
    if (n === 3) buildStep3();
    if (n === 5) buildReview();
    render();
    // land just under the fixed header, with the stepper in view
    var anchor = $('#stepper') || $('.book-wrap');
    var navH = ($('#nav') ? $('#nav').offsetHeight : 72) + 22;
    var top = anchor.getBoundingClientRect().top + window.scrollY - navH;
    window.scrollTo({ top: Math.max(0, top), behavior: U.reduce ? 'auto' : 'smooth' });
  }

  /* ---------------------------------------------------------------------
     RAIL + REVIEW
     --------------------------------------------------------------------- */
  function summaryRows() {
    var rows = [];
    if (S.kind === 'event' && S.event) {
      rows.push(['Event', S.event.name]);
      rows.push(['Format', S.event.format]);
    } else if (S.exp) {
      rows.push(['Experience', S.exp.name]);
    } else {
      rows.push(['Experience', 'Not chosen yet']);
    }
    if (S.game) rows.push([S.kind === 'event' && S.event.id === 'karaoke' ? 'Opening set' : 'Game', S.game]);
    if (S.date) rows.push(['Date', prettyDate(S.date)]);
    if (S.kind === 'event') { if (S.event) rows.push(['Time', S.event.time]); }
    else if (S.time) rows.push(['Start', prettyTime(S.time)]);
    if (S.kind !== 'event' && S.duration) {
      rows.push(['Length', S.duration < 60 ? S.duration + ' mins' : (S.duration / 60) + ' hr' + (S.duration > 60 ? 's' : '')]);
    }
    rows.push([S.kind === 'event' ? 'Entries' : 'Players', String(S.players)]);
    if (S.name) rows.push(['Name', S.name]);
    if (S.phone) rows.push(['Phone', S.phone]);
    return rows;
  }

  function render() {
    var rows = summaryRows();
    $('#railRows').innerHTML = rows.map(function (r) {
      return '<div class="rail-row"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>';
    }).join('');

    var p = priceBreakdown();
    $('#railTotal').textContent = money(p.total);

    var note = $('#railNote');
    if (p.lines.length) {
      note.innerHTML = p.lines.map(function (l) { return esc(l.label) + ': ' + esc(l.detail); }).join('<br>');
    } else {
      note.textContent = 'Pick an experience to see your price.';
    }

    syncPaybar(p);
  }

  /* the phone-sized sticky bar mirrors whatever the current step's button does */
  function syncPaybar(p) {
    var bar = $('#paybar'), act = $('#pbAction');
    if (!bar || !act) return;

    if (S.step > LAST) { bar.style.display = 'none'; return; }
    bar.style.display = '';

    $('#pbTotal').textContent = money(p.total);

    var label, disabled = false;
    if (S.step === LAST) {
      label = 'Pay ' + money(p.total);
      disabled = p.total <= 0;
    } else {
      label = S.step === 4 ? 'Review & pay' : 'Continue';
      var stepBtn = $('.fstep[data-step="' + S.step + '"] [data-next]');
      disabled = !!(stepBtn && stepBtn.disabled);
    }
    act.querySelector('span').textContent = label;
    act.disabled = disabled;
  }

  function buildReview() {
    var p = priceBreakdown();
    var rows = summaryRows().slice(1);            // the header already names it
    if (S.email) rows.push(['Email', S.email]);
    if (S.note) rows.push(['Notes', S.note]);
    p.lines.forEach(function (l) {
      rows.push([l.label + ' charge', l.detail + ' = ' + money(l.amount)]);
    });

    var isEvent = S.kind === 'event';
    var title = isEvent ? S.event.name : (S.exp ? S.exp.name : '—');
    var sub = isEvent
      ? S.event.cadence + ' · ' + S.event.time
      : (S.exp ? S.exp.tag + ' · ' + (S.duration < 60 ? S.duration + ' minutes'
                                                      : (S.duration / 60) + ' hour' + (S.duration > 60 ? 's' : '')) : '');

    $('#tkIcon').innerHTML = U.icon
      ? U.icon(isEvent ? (S.event.id === 'fifa' ? 'pad' : 'mic') : S.exp.icon) : '';
    $('#tkTitle').textContent = title;
    $('#tkSub').textContent = sub;
    $('#reviewRows').innerHTML = rows.map(function (r) {
      return '<div class="tk-row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');
    $('#tkTotal').textContent = money(p.total);

    $('#payLabel').textContent = 'Pay ' + money(p.total);
    $('#payBtn').disabled = p.total <= 0;
  }

  /* ---------------------------------------------------------------------
     PAYMENT — Paystack Inline
     ---------------------------------------------------------------------
     Paystack expects the amount in KOBO, hence × 100.
     `metadata.custom_fields` is what shows up on your Paystack dashboard,
     so the desk can see the whole booking against the transaction.
     --------------------------------------------------------------------- */
  function reference() {
    return 'ARENA-' + Date.now().toString(36).toUpperCase() +
           '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function customField(label, value) {
    return { display_name: label, variable_name: label.toLowerCase().replace(/\W+/g, '_'), value: String(value) };
  }

  function pay() {
    if (!validateStep(4)) { goto(4); return; }
    var p = priceBreakdown();
    if (p.total <= 0) return;

    var ref = reference();
    var what = S.kind === 'event' ? S.event.name : S.exp.name;

    var fields = [
      customField('Booking', what),
      customField('Game', S.game || '—'),
      customField('Date', prettyDate(S.date)),
      customField('Time', S.kind === 'event' ? S.event.time : prettyTime(S.time)),
      customField('Players', S.players),
      customField('Phone', S.phone)
    ];
    if (S.kind !== 'event') fields.push(customField('Length', S.duration + ' mins'));
    if (S.note) fields.push(customField('Notes', S.note));

    var btn = $('#payBtn');
    btn.disabled = true;
    $('#payLabel').textContent = 'Opening checkout…';

    // ---- demo mode: no key configured yet ----
    var key = A.paystack.publicKey || '';
    var keyLooksReal = /^pk_(test|live)_[A-Za-z0-9]{10,}$/.test(key);
    if (A.paystack.demoMode || !keyLooksReal || typeof window.PaystackPop === 'undefined') {
      setTimeout(function () { success(ref, true); }, 700);
      return;
    }

    try {
      var handler = window.PaystackPop.setup({
        key: key,
        email: S.email,
        amount: Math.round(p.total * 100),           // kobo
        currency: A.paystack.currency || 'NGN',
        ref: ref,
        firstname: S.name.split(' ')[0] || S.name,
        lastname: S.name.split(' ').slice(1).join(' '),
        phone: S.phone,
        metadata: { custom_fields: fields },
        onClose: function () {
          btn.disabled = false;
          $('#payLabel').textContent = 'Pay ' + money(p.total);
        },
        callback: function (res) {
          success(res.reference || ref, false);
        }
      });
      handler.openIframe();
    } catch (err) {
      btn.disabled = false;
      $('#payLabel').textContent = 'Pay ' + money(p.total);
      alert('We could not open the payment window. Please try again, or message us on WhatsApp at ' +
            A.business.phone + ' and we will hold your slot.');
    }
  }

  function success(ref, demo) {
    var what = S.kind === 'event' ? S.event.name : S.exp.name;
    var when = prettyDate(S.date) + ' at ' + (S.kind === 'event' ? S.event.time : prettyTime(S.time));

    $('#refCode').textContent = ref;
    $('#doneMsg').textContent = (demo ? '[Demo booking — no payment was taken] ' : '') +
      what + (S.game ? ' · ' + S.game : '') + ' — ' + when + '. See you at 85 Boundary Road.';

    var msg = 'Hi The Arena! Booking confirmed.\n' +
      'Ref: ' + ref + '\n' +
      'Name: ' + S.name + '\n' +
      what + (S.game ? ' — ' + S.game : '') + '\n' +
      when + '\n' +
      (S.kind !== 'event' ? 'Length: ' + S.duration + ' mins\n' : '') +
      'Players: ' + S.players;
    $('#doneWa').href = 'https://wa.me/' + A.business.whatsapp + '?text=' + encodeURIComponent(msg);

    /* Record the booking.
       If cross-device sync is configured (arena.config.js -> cloud), it goes to
       the shared database so it appears on every admin dashboard, whatever
       device the customer booked from. A copy is always kept locally too, so
       the customer keeps their reference even if the network drops. */
    var p2 = priceBreakdown();
    var record = {
        ref: ref,
        at: new Date().toISOString(),
        kind: S.kind,
        lineId: S.kind === 'event' ? S.event.id : S.exp.id,
        line: what,
        game: S.game || '',
        date: S.date,
        time: S.kind === 'event' ? pad(S.event.hour) + ':00' : S.time,
        duration: S.kind === 'event' ? 0 : S.duration,
        players: S.players,
        amount: p2.total,
        status: demo ? 'demo' : 'paid',
        customer: {
          name: S.name, phone: S.phone, email: S.email, area: S.area || ''
        },
        note: S.note || ''
    };

    try {
      var log = JSON.parse(localStorage.getItem('arena.bookings') || '[]');
      log.push(record);
      localStorage.setItem('arena.bookings', JSON.stringify(log.slice(-500)));
    } catch (e) { /* private browsing — not important */ }

    if (window.ArenaCloud && window.ArenaCloud.configured()) {
      window.ArenaCloud.createBooking(record).catch(function (err) {
        // The customer has already paid — never block them on a sync problem.
        // The local copy above keeps the booking, and the reference still works.
        if (window.console) console.warn('Booking sync failed:', err && err.message);
      });
    }

    goto(6);
  }

  /* ---------------------------------------------------------------------
     WIRING
     --------------------------------------------------------------------- */
  buildStep1();

  $$('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!validateStep(S.step)) return;
      goto(Math.min(LAST, S.step + 1));
    });
  });
  $$('[data-prev]').forEach(function (b) {
    b.addEventListener('click', function () { goto(Math.max(1, S.step - 1)); });
  });

  $('#bDate').addEventListener('change', function () {
    S.date = this.value; buildSlots(); render();
  });
  $('#bDur').addEventListener('change', function () {
    S.duration = +this.value; buildSlots(); render();
  });
  $('#slots').addEventListener('click', function (e) {
    var b = e.target.closest('[data-slot]');
    if (!b || b.disabled) return;
    $$('[data-slot]', this).forEach(function (s) { s.setAttribute('aria-pressed', 'false'); });
    b.setAttribute('aria-pressed', 'true');
    S.time = b.getAttribute('data-slot');
    $('#fSlot').classList.remove('bad');
    render();
  });

  $('#qMinus').addEventListener('click', function () {
    S.players = Math.max(1, S.players - 1);
    $('#qOut').textContent = String(S.players); render();
  });
  $('#qPlus').addEventListener('click', function () {
    S.players = Math.min(A.booking.maxPlayers || 12, S.players + 1);
    $('#qOut').textContent = String(S.players); render();
  });

  var areaSel = $('#bArea');
  if (areaSel && A.business.areas) {
    areaSel.innerHTML = '<option value="">Prefer not to say</option>' +
      A.business.areas.map(function (a) { return '<option>' + esc(a) + '</option>'; }).join('');
    areaSel.addEventListener('change', function () { S.area = this.value; render(); });
  }

  [['#bName', 'name'], ['#bPhone', 'phone'], ['#bEmail', 'email'], ['#bNote', 'note']].forEach(function (p) {
    $(p[0]).addEventListener('input', function () {
      S[p[1]] = this.value;
      this.closest('.field').classList.remove('bad');
      render();
    });
  });

  $('#payBtn').addEventListener('click', pay);

  var pbAction = $('#pbAction');
  if (pbAction) {
    pbAction.addEventListener('click', function () {
      if (S.step === LAST) { pay(); return; }
      if (!validateStep(S.step)) return;
      goto(Math.min(LAST, S.step + 1));
    });
  }

  // demo-mode notice
  var keyOk = /^pk_(test|live)_[A-Za-z0-9]{10,}$/.test(A.paystack.publicKey || '');
  if (A.paystack.demoMode || !keyOk) $('#demoNote').style.display = 'flex';

  /* ---------------------------------------------------------------------
     DEEP LINKS  —  book.html?exp=ps5&game=EA%20FC%2026 | ?event=fifa
     --------------------------------------------------------------------- */
  (function () {
    var q = new URLSearchParams(location.search);
    var expId = q.get('exp'), evId = q.get('event'), game = q.get('game');

    if (evId) {
      var btn = $('[data-event="' + evId + '"]');
      if (btn) { btn.click(); goto(2); }
    } else if (expId) {
      var eb = $('[data-exp="' + expId + '"]');
      if (eb) {
        eb.click();
        goto(2);
        if (game) {
          var chip = $('#gameOpts [data-game="' + game.replace(/"/g, '&quot;') + '"]');
          if (chip) { chip.click(); goto(3); }
        }
      }
    }
  }());

  render();
}());
