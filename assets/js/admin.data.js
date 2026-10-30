/* ==========================================================================
   THE ARENA — admin data layer
   --------------------------------------------------------------------------
   Two modes, chosen automatically:

     CLOUD  — arena.config.js has cloud.url + cloud.anonKey filled in.
              Bookings and costs are shared by every device. A booking made on
              a customer's phone shows up on your laptop dashboard.

     LOCAL  — nothing configured. Falls back to this browser's localStorage,
              which means each browser only sees its own data.

   Everything downstream (charts, tables, totals) reads from an in-memory
   cache, so the rest of the console does not care which mode is active.
   ========================================================================== */

(function () {
  'use strict';

  var BOOKINGS_KEY = 'arena.bookings';
  var EXPENSES_KEY = 'arena.admin.expenses';

  var A = window.ARENA || {};
  var Cloud = window.ArenaCloud;

  function cloudOn() { return !!(Cloud && Cloud.configured()); }

  /* in-memory cache the whole console renders from */
  var cache = { bookings: [], expenses: [], source: 'local', error: null };

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* =====================================================================
     NORMALISERS
     ===================================================================== */
  function normaliseBooking(b) {
    return {
      ref: b.ref || '—',
      at: b.at || new Date().toISOString(),
      kind: b.kind || 'experience',
      lineId: b.lineId || 'unknown',
      line: b.line || b.what || 'Unknown',
      game: b.game || '',
      date: b.date || (b.at || '').slice(0, 10),
      time: b.time || '',
      duration: +b.duration || 0,
      players: +b.players || 1,
      amount: +b.amount || 0,
      status: b.status || 'paid',
      customer: b.customer || { name: '', phone: '', email: '', area: '' },
      note: b.note || '',
      sample: !!b.sample,
      remote: !!b.remote
    };
  }

  function localBookings() {
    var raw = read(BOOKINGS_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(normaliseBooking);
  }

  function localExpenses() {
    var raw = read(EXPENSES_KEY, []);
    return Array.isArray(raw) ? raw : [];
  }

  function sortBookings(list) {
    return list.sort(function (x, y) { return (y.at || '').localeCompare(x.at || ''); });
  }
  function sortExpenses(list) {
    return list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }

  /* =====================================================================
     REFRESH — the single entry point that fills the cache
     ===================================================================== */
  function refresh() {
    if (!cloudOn()) {
      cache.source = 'local';
      cache.error = null;
      cache.bookings = sortBookings(localBookings());
      cache.expenses = sortExpenses(localExpenses());
      return Promise.resolve(cache);
    }

    cache.source = 'cloud';
    return Promise.all([
      Cloud.listBookings(),
      Cloud.listExpenses()
    ]).then(function (res) {
      cache.error = null;
      // local sample rows stay visible alongside real cloud data
      var samples = localBookings().filter(function (b) { return b.sample; });
      cache.bookings = sortBookings(res[0].map(normaliseBooking).concat(samples));
      cache.expenses = sortExpenses(res[1]);
      return cache;
    }).catch(function (err) {
      // fall back to whatever this browser has, and say so
      cache.error = err.message || 'Could not reach the server.';
      cache.source = 'local-fallback';
      cache.bookings = sortBookings(localBookings());
      cache.expenses = sortExpenses(localExpenses());
      return cache;
    });
  }

  /* =====================================================================
     BOOKINGS
     ===================================================================== */
  function loadBookings() { return cache.bookings; }

  function deleteBooking(ref) {
    if (cache.source === 'cloud') {
      return Cloud.deleteBooking(ref).then(refresh);
    }
    write(BOOKINGS_KEY, localBookings().filter(function (b) { return b.ref !== ref; }));
    return refresh();
  }

  /* =====================================================================
     EXPENSES / COST REGISTER
     ===================================================================== */
  var EXPENSE_CATEGORIES = [
    { id: 'salaries',    label: 'Salaries & wages' },
    { id: 'fuel',        label: 'Fuel & diesel' },
    { id: 'internet',    label: 'Internet & data' },
    { id: 'maintenance', label: 'Maintenance & repairs' },
    { id: 'rent',        label: 'Rent' },
    { id: 'utilities',   label: 'Power & utilities' },
    { id: 'marketing',   label: 'Marketing' },
    { id: 'stock',       label: 'Stock & consumables' },
    { id: 'other',       label: 'Other' }
  ];

  function loadExpenses() { return cache.expenses; }

  function addExpense(e) {
    var rec = {
      date: e.date,
      category: e.category,
      description: e.description || '',
      amount: +e.amount || 0,
      payee: e.payee || '',
      enteredBy: e.enteredBy || ''
    };

    if (cache.source === 'cloud') {
      return Cloud.createExpense(rec).then(refresh);
    }

    var list = localExpenses();
    rec.id = 'exp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    rec.createdAt = new Date().toISOString();
    list.push(rec);
    write(EXPENSES_KEY, list);
    return refresh();
  }

  function deleteExpense(id) {
    if (cache.source === 'cloud') {
      return Cloud.deleteExpense(id).then(refresh);
    }
    write(EXPENSES_KEY, localExpenses().filter(function (x) { return x.id !== id; }));
    return refresh();
  }

  /* =====================================================================
     DATE FILTERING
     ===================================================================== */
  function inRange(iso, from, to) {
    if (!iso) return false;
    var d = String(iso).slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  /* =====================================================================
     AGGREGATIONS
     ===================================================================== */
  function summarise(bookings, expenses) {
    var revenue = 0, players = 0;
    var byLine = {}, byArea = {}, byCustomer = {}, byDay = {}, byHour = {}, byWeekday = {};

    bookings.forEach(function (b) {
      revenue += b.amount;
      players += b.players;

      var L = byLine[b.lineId] || (byLine[b.lineId] = { id: b.lineId, name: b.line, bookings: 0, revenue: 0, players: 0 });
      L.bookings++; L.revenue += b.amount; L.players += b.players;

      var area = (b.customer && b.customer.area) || 'Not given';
      byArea[area] = (byArea[area] || 0) + 1;

      var key = ((b.customer && (b.customer.email || b.customer.phone)) || 'unknown').toLowerCase();
      var C = byCustomer[key] || (byCustomer[key] = {
        key: key,
        name: (b.customer && b.customer.name) || 'Unknown',
        email: (b.customer && b.customer.email) || '',
        phone: (b.customer && b.customer.phone) || '',
        area: (b.customer && b.customer.area) || '',
        visits: 0, spend: 0, lines: {}, first: b.at, last: b.at
      });
      C.visits++; C.spend += b.amount;
      C.lines[b.line] = (C.lines[b.line] || 0) + 1;
      if (b.at < C.first) C.first = b.at;
      if (b.at > C.last) C.last = b.at;

      var day = (b.date || b.at || '').slice(0, 10);
      byDay[day] = (byDay[day] || 0) + b.amount;

      if (b.time) {
        var h = parseInt(b.time.split(':')[0], 10);
        if (!isNaN(h)) byHour[h] = (byHour[h] || 0) + 1;
      }
      if (day) {
        var p = day.split('-');
        var wd = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
        if (!isNaN(wd)) byWeekday[wd] = (byWeekday[wd] || 0) + 1;
      }
    });

    var customers = Object.keys(byCustomer).map(function (k) { return byCustomer[k]; });
    var repeat = customers.filter(function (c) { return c.visits > 1; }).length;

    var costs = 0, byCategory = {};
    (expenses || []).forEach(function (e) {
      costs += e.amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    var lines = Object.keys(byLine).map(function (k) { return byLine[k]; })
                  .sort(function (a, b) { return b.revenue - a.revenue; });

    return {
      bookings: bookings.length,
      revenue: revenue,
      players: players,
      avgOrder: bookings.length ? revenue / bookings.length : 0,
      customers: customers.length,
      repeatCustomers: repeat,
      repeatRate: customers.length ? repeat / customers.length : 0,
      lines: lines,
      topLine: lines[0] || null,
      areas: Object.keys(byArea).map(function (k) { return { name: k, count: byArea[k] }; })
                .sort(function (a, b) { return b.count - a.count; }),
      topCustomers: customers.slice().sort(function (a, b) { return b.spend - a.spend; }),
      byDay: byDay,
      byHour: byHour,
      byWeekday: byWeekday,
      costs: costs,
      costCount: (expenses || []).length,
      costsByCategory: EXPENSE_CATEGORIES.map(function (c) {
        return { id: c.id, label: c.label, amount: byCategory[c.id] || 0 };
      }).filter(function (c) { return c.amount > 0; })
        .sort(function (a, b) { return b.amount - a.amount; }),
      profit: revenue - costs
    };
  }

  function series(byDay, days) {
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = daysAgo(i);
      out.push({ label: d, value: byDay[d] || 0 });
    }
    return out;
  }

  /* =====================================================================
     SAMPLE DATA  (local only — never written to the shared database)
     ===================================================================== */
  function generateSample() {
    var names = ['Osaz Igbinedion', 'Ada Okonkwo', 'Efe Obaseki', 'Tari Briggs', 'Zainab Yusuf',
                 'Chuka Eze', 'Ivie Omoregie', 'Daniel Ojo', 'Ngozi Umeh', 'Femi Adeyemi',
                 'Blessing Uwa', 'Kelvin Idahosa', 'Amaka Nwosu', 'Seyi Bakare', 'Ruth Aigbe'];
    var areas = (A.business && A.business.areas) || ['GRA', 'Ugbowo', 'Ikpoba Hill'];
    var exps = (A.experiences || []).map(function (x) {
      return { id: x.id, name: x.name, price: x.price, unit: x.unit, games: x.games, perRoom: !!x.perRoom };
    });
    if (!exps.length) return [];

    var out = [];
    var people = names.map(function (n) {
      return {
        name: n,
        email: n.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com',
        phone: '080' + (30000000 + Math.floor(Math.random() * 9999999)),
        area: areas[Math.floor(Math.random() * areas.length)]
      };
    });

    for (var i = 0; i < 140; i++) {
      var back = Math.floor(Math.random() * 60);
      var d = new Date(); d.setDate(d.getDate() - back);
      var dow = d.getDay();
      var win = (A.booking && A.booking.schedule && A.booking.schedule[dow]);
      if (!win) continue;                                   // closed that day

      var p = people[Math.floor(Math.pow(Math.random(), 1.7) * people.length)];
      var x = exps[Math.floor(Math.pow(Math.random(), 1.4) * exps.length)];
      var blocks = 1 + Math.floor(Math.random() * 3);
      var heads = x.perRoom ? (2 + Math.floor(Math.random() * 5)) : (1 + Math.floor(Math.random() * 3));
      var amount = x.price * blocks * (x.perRoom ? 1 : heads);
      var hour = win.open + Math.floor(Math.random() * Math.max(1, win.close - win.open));
      var iso = d.toISOString().slice(0, 10);

      out.push({
        ref: 'SAMPLE-' + (1000 + i),
        at: iso + 'T' + ('0' + hour).slice(-2) + ':00:00.000Z',
        kind: 'experience', lineId: x.id, line: x.name,
        game: x.games[Math.floor(Math.random() * x.games.length)],
        date: iso, time: ('0' + hour).slice(-2) + ':00',
        duration: blocks * x.unit, players: heads, amount: amount, status: 'paid',
        customer: { name: p.name, phone: p.phone, email: p.email, area: p.area },
        note: '', sample: true
      });
    }

    var evs = [(A.events || {}).fifa, (A.events || {}).karaoke].filter(Boolean);
    evs.forEach(function (ev) {
      for (var j = 0; j < 14; j++) {
        var back = Math.floor(Math.random() * 55);
        var d2 = new Date(); d2.setDate(d2.getDate() - back);
        var p2 = people[Math.floor(Math.random() * people.length)];
        var iso2 = d2.toISOString().slice(0, 10);
        out.push({
          ref: 'SAMPLE-EV-' + ev.id + '-' + j,
          at: iso2 + 'T18:00:00.000Z',
          kind: 'event', lineId: ev.id, line: ev.name, game: '',
          date: iso2, time: ('0' + ev.hour).slice(-2) + ':00',
          duration: 0, players: 1, amount: ev.entry, status: 'paid',
          customer: { name: p2.name, phone: p2.phone, email: p2.email, area: p2.area },
          note: '', sample: true
        });
      }
    });

    return out;
  }

  function sampleExpenses() {
    var out = [];
    var plan = [
      ['salaries', 'Monthly staff salaries', 450000],
      ['fuel', 'Diesel for generator', 120000],
      ['internet', 'Fibre + backup data', 45000],
      ['maintenance', 'VR headset servicing', 60000],
      ['rent', 'Premises rent', 250000],
      ['utilities', 'Electricity', 80000]
    ];
    for (var m = 0; m < 2; m++) {
      var d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(1);
      plan.forEach(function (row, k) {
        out.push({
          id: 'exp_sample_' + m + '_' + k,
          date: d.toISOString().slice(0, 10),
          category: row[0], description: row[1],
          amount: row[2] + Math.floor(Math.random() * 30000),
          payee: '', enteredBy: 'Sample data',
          createdAt: new Date().toISOString(), sample: true
        });
      });
    }
    return out;
  }

  function loadSample() {
    write(BOOKINGS_KEY, localBookings().filter(function (b) { return !b.sample; })
      .concat(generateSample()));
    // sample costs only make sense in local mode — never pollute the shared register
    if (!cloudOn()) {
      write(EXPENSES_KEY, localExpenses().filter(function (e) { return !e.sample; })
        .concat(sampleExpenses()));
    }
    return refresh();
  }

  function clearSample() {
    write(BOOKINGS_KEY, localBookings().filter(function (b) { return !b.sample; }));
    write(EXPENSES_KEY, localExpenses().filter(function (e) { return !e.sample; }));
    return refresh();
  }

  function hasSample() {
    return cache.bookings.some(function (b) { return b.sample; });
  }

  /* =====================================================================
     CSV EXPORT
     ===================================================================== */
  function csv(rows) {
    return rows.map(function (r) {
      return r.map(function (cell) {
        var v = cell === null || cell === undefined ? '' : String(cell);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function bookingsCsv(list) {
    var rows = [['Reference', 'Booked at', 'Date', 'Time', 'Type', 'Line', 'Game',
                 'Minutes', 'Players', 'Amount (NGN)', 'Status',
                 'Customer', 'Phone', 'Email', 'Area', 'Notes']];
    list.forEach(function (b) {
      rows.push([b.ref, b.at, b.date, b.time, b.kind, b.line, b.game, b.duration,
                 b.players, b.amount, b.status, b.customer.name, b.customer.phone,
                 b.customer.email, b.customer.area, b.note]);
    });
    return csv(rows);
  }

  function expensesCsv(list) {
    var rows = [['Date', 'Category', 'Description', 'Payee', 'Entered by', 'Amount (NGN)']];
    list.forEach(function (e) {
      rows.push([e.date, e.category, e.description, e.payee, e.enteredBy || '', e.amount]);
    });
    return csv(rows);
  }

  window.ArenaData = {
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    cloudOn: cloudOn,
    refresh: refresh,
    status: function () { return { source: cache.source, error: cache.error }; },
    loadBookings: loadBookings,
    deleteBooking: deleteBooking,
    loadExpenses: loadExpenses,
    addExpense: addExpense,
    deleteExpense: deleteExpense,
    inRange: inRange,
    daysAgo: daysAgo,
    summarise: summarise,
    series: series,
    loadSample: loadSample,
    clearSample: clearSample,
    hasSample: hasSample,
    bookingsCsv: bookingsCsv,
    expensesCsv: expensesCsv,
    download: download
  };
}());
