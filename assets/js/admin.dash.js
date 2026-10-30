/* ==========================================================================
   THE ARENA — shared dashboard rendering
   Used by both the Manager's View and the Director's View. Each section only
   renders if its container exists on the page, so the Director's extra
   sections simply add to this.
   ========================================================================== */

(function () {
  'use strict';

  var UI = window.ArenaUI, D = window.ArenaData, A = window.ARENA || {};
  var $ = UI.$, $$ = UI.$$;
  var money = UI.money, esc = UI.esc;

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var state = {
    from: D.daysAgo(29),
    to: new Date().toISOString().slice(0, 10),
    line: 'all',
    search: '',
    preset: 30
  };

  function filtered() {
    return D.loadBookings().filter(function (b) {
      if (!D.inRange(b.date || b.at, state.from, state.to)) return false;
      if (state.line !== 'all' && b.lineId !== state.line) return false;
      if (state.search) {
        var q = state.search.toLowerCase();
        var hay = [b.ref, b.line, b.game, b.customer.name, b.customer.phone,
                   b.customer.email, b.customer.area].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function filteredExpenses() {
    return D.loadExpenses().filter(function (e) { return D.inRange(e.date, state.from, state.to); });
  }

  /* =====================================================================
     FILTER BAR
     ===================================================================== */
  function mountFilters() {
    var host = $('#filterBar');
    if (!host) return;

    var lineOpts = '<option value="all">All categories</option>' +
      (A.experiences || []).map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>';
      }).join('') +
      Object.keys(A.events || {}).map(function (k) {
        var e = A.events[k];
        return '<option value="' + esc(e.id) + '">' + esc(e.name) + '</option>';
      }).join('');

    host.innerHTML =
      '<div class="chipbar" id="presets">' +
        [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last year'], [0, 'All time']]
          .map(function (p) {
            return '<button type="button" data-days="' + p[0] + '" aria-pressed="' +
                   (state.preset === p[0]) + '">' + p[1] + '</button>';
          }).join('') +
      '</div>' +
      '<div class="filters" style="margin-top:12px">' +
        '<div class="field"><label for="fFrom">From</label><input type="date" id="fFrom" value="' + state.from + '"></div>' +
        '<div class="field"><label for="fTo">To</label><input type="date" id="fTo" value="' + state.to + '"></div>' +
        '<div class="field"><label for="fLine">Category</label><select id="fLine">' + lineOpts + '</select></div>' +
        '<div class="field grow"><label for="fSearch">Search</label>' +
          '<input type="search" id="fSearch" placeholder="Name, phone, email, reference, game…"></div>' +
      '</div>';

    $('#presets').addEventListener('click', function (e) {
      var b = e.target.closest('[data-days]');
      if (!b) return;
      var days = +b.getAttribute('data-days');
      state.preset = days;
      state.to = new Date().toISOString().slice(0, 10);
      state.from = days ? D.daysAgo(days - 1) : '2000-01-01';
      $('#fFrom').value = state.from;
      $('#fTo').value = state.to;
      $$('#presets button').forEach(function (x) {
        x.setAttribute('aria-pressed', String(+x.getAttribute('data-days') === days));
      });
      renderAll();
    });

    $('#fFrom').addEventListener('change', function () { state.from = this.value; state.preset = -1; renderAll(); });
    $('#fTo').addEventListener('change', function () { state.to = this.value; state.preset = -1; renderAll(); });
    $('#fLine').addEventListener('change', function () { state.line = this.value; renderAll(); });

    var t;
    $('#fSearch').addEventListener('input', function () {
      var v = this.value;
      clearTimeout(t);
      t = setTimeout(function () { state.search = v; renderAll(); }, 220);
    });
  }

  /* =====================================================================
     OVERVIEW
     ===================================================================== */
  function renderOverview(list, sum) {
    var el = $('#kpiOverview');
    if (el) {
      UI.kpis(el, [
        { label: 'Bookings', value: sum.bookings.toLocaleString('en-NG'), accent: 'orange',
          sub: sum.players.toLocaleString('en-NG') + ' players in total' },
        { label: 'Customers', value: sum.customers.toLocaleString('en-NG'), accent: 'cyan',
          sub: sum.repeatCustomers + ' came back more than once' },
        { label: 'Busiest line', value: sum.topLine ? sum.topLine.name : '—', accent: 'yellow',
          sub: sum.topLine ? sum.topLine.bookings + ' bookings' : 'No data yet' },
        { label: 'Avg. booking', value: money(sum.avgOrder), accent: 'green',
          sub: 'Per booking in this period' }
      ]);
    }

    var days = Math.max(1, Math.round((new Date(state.to) - new Date(state.from)) / 86400000) + 1);
    var span = Math.min(days, 90);

    var c1 = $('#chartVolume');
    if (c1) {
      var byDayCount = {};
      list.forEach(function (b) {
        var d = (b.date || b.at).slice(0, 10);
        byDayCount[d] = (byDayCount[d] || 0) + 1;
      });
      var s = D.series(byDayCount, span).map(function (p) {
        return { label: p.label, value: p.value, short: p.label.slice(5),
                 tip: UI.dateLabel(p.label) + ': ' + p.value + ' booking' + (p.value === 1 ? '' : 's') };
      });
      UI.columnChart(c1, s, { title: 'Bookings per day', emptyText: 'No bookings in this period.' });
    }

    var c2 = $('#chartLines');
    if (c2) {
      UI.barList(c2, sum.lines.map(function (l, i) {
        return { label: l.name, value: l.bookings, display: l.bookings + ' bookings',
                 color: UI.PALETTE[i % UI.PALETTE.length] };
      }), { emptyText: 'No bookings in this period.' });
    }

    var c3 = $('#chartWeekday');
    if (c3) {
      var wd = WEEKDAYS.map(function (name, i) {
        return { label: name.slice(0, 3), value: sum.byWeekday[i] || 0, short: name.slice(0, 3),
                 tip: name + ': ' + (sum.byWeekday[i] || 0) + ' bookings' };
      });
      UI.columnChart(c3, wd, { title: 'Bookings by weekday', emptyText: 'No bookings yet.' });
    }
  }

  /* =====================================================================
     BOOKINGS TABLE
     ===================================================================== */
  function renderBookings(list) {
    var el = $('#bookingsTable');
    if (!el) return;

    var count = $('#bookingsCount');
    if (count) {
      count.textContent = list.length + ' booking' + (list.length === 1 ? '' : 's') +
        ' · ' + money(list.reduce(function (n, b) { return n + b.amount; }, 0));
    }

    UI.table(el, [
      { label: 'Reference', raw: true, render: function (b) {
          return '<b>' + esc(b.ref) + '</b><span class="sub">' + esc(UI.dateLabel(b.at)) + '</span>';
        } },
      { label: 'Session', raw: true, render: function (b) {
          return '<b>' + esc(b.line) + '</b>' +
                 (b.game ? '<span class="sub">' + esc(b.game) + '</span>' : '');
        } },
      { label: 'When', raw: true, render: function (b) {
          return esc(UI.dateLabel(b.date)) + '<span class="sub">' + esc(UI.timeLabel(b.time)) +
                 (b.duration ? ' · ' + b.duration + ' mins' : '') + '</span>';
        } },
      { label: 'Customer', raw: true, render: function (b) {
          return '<b>' + esc(b.customer.name || '—') + '</b><span class="sub">' +
                 esc(b.customer.phone || '') + (b.customer.area ? ' · ' + esc(b.customer.area) : '') + '</span>';
        } },
      { label: 'Players', numeric: true, render: function (b) { return b.players; } },
      { label: 'Amount', numeric: true, raw: true, render: function (b) {
          return '<b>' + esc(money(b.amount)) + '</b>';
        } },
      { label: 'Status', raw: true, render: function (b) {
          var cls = b.sample ? 'sample' : (b.status === 'demo' ? 'demo' : 'paid');
          var txt = b.sample ? 'Sample' : (b.status === 'demo' ? 'Demo' : 'Paid');
          return '<span class="pill ' + cls + '">' + txt + '</span>' +
                 (b.kind === 'event' ? ' <span class="pill event">Event</span>' : '');
        } }
    ], list, { emptyText: 'No bookings match these filters.' });
  }

  /* =====================================================================
     CUSTOMERS
     ===================================================================== */
  function renderCustomers(sum) {
    var el = $('#customersTable');
    if (!el) return;

    var k = $('#kpiCustomers');
    if (k) {
      var avgSpend = sum.customers ? sum.revenue / sum.customers : 0;
      UI.kpis(k, [
        { label: 'Unique customers', value: sum.customers.toLocaleString('en-NG'), accent: 'cyan' },
        { label: 'Repeat customers', value: sum.repeatCustomers.toLocaleString('en-NG'), accent: 'orange',
          sub: UI.pct(sum.repeatRate) + ' of everyone' },
        { label: 'Avg. visits each', value: sum.customers ? (sum.bookings / sum.customers).toFixed(1) : '0', accent: 'yellow' },
        { label: 'Avg. spend each', value: money(avgSpend), accent: 'green' }
      ]);
    }

    UI.table(el, [
      { label: 'Customer', raw: true, render: function (c) {
          return '<b>' + esc(c.name) + '</b><span class="sub">' + esc(c.email || '—') + '</span>';
        } },
      { label: 'Phone', render: function (c) { return c.phone || '—'; } },
      { label: 'Area', render: function (c) { return c.area || 'Not given'; } },
      { label: 'Favourite', render: function (c) {
          var best = Object.keys(c.lines).sort(function (a, b) { return c.lines[b] - c.lines[a]; })[0];
          return best || '—';
        } },
      { label: 'Visits', numeric: true, render: function (c) { return c.visits; } },
      { label: 'Spend', numeric: true, raw: true, render: function (c) {
          return '<b>' + esc(money(c.spend)) + '</b>';
        } },
      { label: 'Last seen', render: function (c) { return UI.dateLabel(c.last); } }
    ], sum.topCustomers, { emptyText: 'No customers in this period.' });
  }

  /* =====================================================================
     ENGAGEMENT
     ===================================================================== */
  function renderEngagement(list, sum) {
    var k = $('#kpiEngagement');
    if (k) {
      var oneOff = sum.customers - sum.repeatCustomers;
      var avgParty = sum.bookings ? sum.players / sum.bookings : 0;
      var busiestHour = Object.keys(sum.byHour).sort(function (a, b) {
        return sum.byHour[b] - sum.byHour[a];
      })[0];
      var busiestDay = Object.keys(sum.byWeekday).sort(function (a, b) {
        return sum.byWeekday[b] - sum.byWeekday[a];
      })[0];
      UI.kpis(k, [
        { label: 'Repeat rate', value: UI.pct(sum.repeatRate), accent: 'orange',
          sub: sum.repeatCustomers + ' returning vs ' + oneOff + ' one-off' },
        { label: 'Avg. group size', value: avgParty.toFixed(1), accent: 'cyan', sub: 'Players per booking' },
        { label: 'Busiest hour', value: busiestHour !== undefined ? UI.timeLabel(busiestHour + ':00') : '—',
          accent: 'yellow', sub: busiestHour !== undefined ? sum.byHour[busiestHour] + ' bookings start then' : '' },
        { label: 'Busiest day', value: busiestDay !== undefined ? WEEKDAYS[busiestDay] : '—',
          accent: 'green', sub: busiestDay !== undefined ? sum.byWeekday[busiestDay] + ' bookings' : '' }
      ]);
    }

    var ch = $('#chartHours');
    if (ch) {
      var hours = [];
      for (var h = 8; h <= 22; h++) {
        hours.push({ label: h + ':00', short: (h % 12 || 12) + (h >= 12 ? 'p' : 'a'),
                     value: sum.byHour[h] || 0,
                     tip: UI.timeLabel(h + ':00') + ': ' + (sum.byHour[h] || 0) + ' bookings' });
      }
      UI.columnChart(ch, hours, { title: 'Start times', emptyText: 'No bookings yet.' });
    }

    var ca = $('#chartAreas');
    if (ca) {
      UI.barList(ca, sum.areas.slice(0, 10).map(function (a, i) {
        return { label: a.name, value: a.count, display: a.count + ' booking' + (a.count === 1 ? '' : 's'),
                 color: UI.PALETTE[i % UI.PALETTE.length] };
      }), { emptyText: 'No area data yet — it is collected on the booking form.' });
    }

    var cg = $('#chartGames');
    if (cg) {
      var byGame = {};
      list.forEach(function (b) { if (b.game) byGame[b.game] = (byGame[b.game] || 0) + 1; });
      var games = Object.keys(byGame).map(function (g) { return { label: g, value: byGame[g] }; })
        .sort(function (a, b) { return b.value - a.value; }).slice(0, 10);
      UI.barList(cg, games.map(function (g, i) {
        return { label: g.label, value: g.value, display: g.value + '×',
                 color: UI.PALETTE[i % UI.PALETTE.length] };
      }), { emptyText: 'No game data yet.' });
    }
  }

  /* =====================================================================
     EXPORTS
     ===================================================================== */
  function mountExports() {
    var b = $('#exportBookings');
    if (b) b.addEventListener('click', function () {
      var list = filtered();
      if (!list.length) { UI.toast('Nothing to export for these filters', 'bad'); return; }
      D.download('arena-bookings-' + state.from + '-to-' + state.to + '.csv', D.bookingsCsv(list));
      UI.toast('Downloaded ' + list.length + ' bookings', 'good');
    });

    var c = $('#exportCustomers');
    if (c) c.addEventListener('click', function () {
      var sum = D.summarise(filtered(), []);
      if (!sum.topCustomers.length) { UI.toast('No customers to export', 'bad'); return; }
      var rows = [['Name', 'Email', 'Phone', 'Area', 'Visits', 'Total spend (NGN)', 'First seen', 'Last seen']];
      sum.topCustomers.forEach(function (x) {
        rows.push([x.name, x.email, x.phone, x.area, x.visits, x.spend, x.first, x.last]);
      });
      D.download('arena-customers-' + state.to + '.csv',
        rows.map(function (r) {
          return r.map(function (v) {
            v = String(v === null || v === undefined ? '' : v);
            return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
          }).join(',');
        }).join('\n'));
      UI.toast('Downloaded ' + sum.topCustomers.length + ' customers', 'good');
    });
  }

  /* =====================================================================
     COST REGISTER  —  shared by the Manager and Director views
     The Manager records costs as they are incurred; the Director sees the
     same register plus the profit picture. Both write to the same place.
     ===================================================================== */
  function mountExpenseForm() {
    var cat = $('#exCat');
    if (!cat) return;                       // this page has no cost section

    cat.innerHTML = D.EXPENSE_CATEGORIES.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>';
    }).join('');
    $('#exDate').value = new Date().toISOString().slice(0, 10);

    $('#addExpense').addEventListener('click', function () {
      var err = $('#exErr');
      err.style.display = 'none';
      var amt = parseFloat($('#exAmt').value);
      var date = $('#exDate').value;
      if (!date) { err.textContent = 'Pick a date.'; err.style.display = 'block'; return; }
      if (!(amt > 0)) { err.textContent = 'Enter an amount greater than zero.'; err.style.display = 'block'; return; }

      var btn = this;
      btn.disabled = true;
      D.addExpense({
        date: date,
        category: cat.value,
        description: $('#exDesc').value.trim(),
        payee: $('#exPayee').value.trim(),
        amount: amt,
        enteredBy: window.ArenaDash.actor || ''
      }).then(function () {
        $('#exDesc').value = ''; $('#exPayee').value = ''; $('#exAmt').value = '';
        UI.toast('Expense recorded', 'good');
        renderAll();
      }).catch(function (e) {
        err.textContent = e.message || 'Could not save that expense.';
        err.style.display = 'block';
      }).finally(function () { btn.disabled = false; });
    });

    var exp = $('#exportExpenses');
    if (exp) exp.addEventListener('click', function () {
      var list = filteredExpenses();
      if (!list.length) { UI.toast('No expenses to export', 'bad'); return; }
      D.download('arena-expenses-' + state.from + '-to-' + state.to + '.csv', D.expensesCsv(list));
      UI.toast('Downloaded ' + list.length + ' entries', 'good');
    });

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-exp]');
      if (!b) return;
      if (!confirm('Delete this expense? This cannot be undone.')) return;
      D.deleteExpense(b.getAttribute('data-del-exp')).then(function () {
        UI.toast('Expense deleted');
        renderAll();
      }).catch(function (err) {
        UI.toast(err.message || 'Could not delete that entry', 'bad');
      });
    });
  }

  function renderCosts(sum) {
    var ex = filteredExpenses();

    var k = $('#kpiCosts');
    if (k) {
      var top = sum.costsByCategory[0];
      UI.kpis(k, [
        { label: 'Total recorded', value: money(sum.costs), accent: 'red',
          sub: ex.length + ' entr' + (ex.length === 1 ? 'y' : 'ies') + ' in this period' },
        { label: 'Biggest category', value: top ? top.label : '—', accent: 'orange',
          sub: top ? money(top.amount) : 'Nothing recorded yet' },
        { label: 'Categories used', value: String(sum.costsByCategory.length), accent: 'yellow' },
        { label: 'Average entry', value: money(ex.length ? sum.costs / ex.length : 0), accent: 'cyan' }
      ]);
    }

    var split = $('#chartCostSplit');
    if (split) {
      UI.donut(split, sum.costsByCategory.map(function (c) {
        return { label: c.label, value: c.amount };
      }), { centreLabel: 'costs', emptyText: 'No expenses recorded in this period.' });
    }

    var count = $('#expenseCount');
    if (count) {
      count.textContent = ex.length + ' entr' + (ex.length === 1 ? 'y' : 'ies') + ' \u00b7 ' + money(sum.costs);
    }

    var table = $('#expensesTable');
    if (table) {
      var labels = {};
      D.EXPENSE_CATEGORIES.forEach(function (c) { labels[c.id] = c.label; });
      UI.table(table, [
        { label: 'Date', render: function (e) { return UI.dateLabel(e.date); } },
        { label: 'Category', raw: true, render: function (e) {
            return '<b>' + esc(labels[e.category] || e.category) + '</b>' +
                   (e.sample ? ' <span class="pill sample">Sample</span>' : '');
          } },
        { label: 'Description', raw: true, render: function (e) {
            return esc(e.description || '—') +
                   (e.payee ? '<span class="sub">' + esc(e.payee) + '</span>' : '');
          } },
        { label: 'Entered by', render: function (e) { return e.enteredBy || '—'; } },
        { label: 'Amount', numeric: true, raw: true, render: function (e) {
            return '<b>' + esc(money(e.amount)) + '</b>';
          } },
        { label: '', raw: true, render: function (e) {
            return '<button class="linkbtn" data-del-exp="' + esc(e.id) + '">Delete</button>';
          } }
      ], ex, { emptyText: 'No expenses recorded in this period.' });
    }
  }

  /* =====================================================================
     DATA SOURCE BANNER — always say where these numbers came from
     ===================================================================== */
  function renderStatus() {
    var el = $('#dataSource');
    if (!el) return;
    var st = D.status();

    if (st.source === 'cloud') {
      el.className = 'cfg-note ok';
      el.innerHTML = '<span>&#9729;</span><span><b>Shared across devices.</b> ' +
        'You are seeing every booking and cost, whichever device it came from.</span>';
    } else if (st.source === 'local-fallback') {
      el.className = 'cfg-note bad';
      el.innerHTML = '<span>&#9888;</span><span><b>Cannot reach the server.</b> ' +
        esc(st.error || '') + ' Showing this device&rsquo;s data only &mdash; anything ' +
        'recorded now may not sync.</span>';
    } else {
      el.className = 'cfg-note';
      el.innerHTML = '<span>&#9888;</span><span><b>This device only.</b> ' +
        'Cross-device sync is not set up, so you are seeing bookings and costs stored ' +
        'in <b>this browser</b>. See &ldquo;Cross-device setup&rdquo; in the README.</span>';
    }
    el.style.display = 'flex';
  }

  /* =====================================================================
     RENDER ALL
     ===================================================================== */
  var extraRenderers = [];

  function renderAll() {
    var list = filtered();
    var sum = D.summarise(list, filteredExpenses());

    renderOverview(list, sum);
    renderBookings(list);
    renderCustomers(sum);
    renderEngagement(list, sum);
    renderCosts(sum);
    extraRenderers.forEach(function (fn) { fn(list, sum, state); });

    renderStatus();
    var banner = $('#sampleBanner');
    if (banner) banner.style.display = D.hasSample() ? 'flex' : 'none';
  }

  window.ArenaDash = {
    state: state,
    actor: '',
    filtered: filtered,
    filteredExpenses: filteredExpenses,
    renderAll: renderAll,
    reload: function () { return D.refresh().then(renderAll); },
    onRender: function (fn) { extraRenderers.push(fn); },
    mount: function () {
      mountFilters();
      mountExports();
      mountExpenseForm();
      renderAll();                        // paint at once with whatever we have
      return D.refresh().then(renderAll); // then fill in from the server
    }
  };
}());
