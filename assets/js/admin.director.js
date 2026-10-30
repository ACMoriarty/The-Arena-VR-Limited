/* ==========================================================================
   THE ARENA — Director's View
   Everything the Manager sees (via admin.dash.js) plus revenue, the cost
   register, manager accounts and settings.
   ========================================================================== */

(function () {
  'use strict';

  var Auth = window.ArenaAuth, D = window.ArenaData, UI = window.ArenaUI, Dash = window.ArenaDash;
  var $ = UI.$, $$ = UI.$$, money = UI.money, esc = UI.esc;

  /* ---------- guard ---------- */
  if (!Auth.requireRole('director', 'index.html')) return;


  $('#signOut').addEventListener('click', function () {
    Promise.resolve(Auth.signOut()).then(function () { location.href = 'index.html'; });
  });

  /* =====================================================================
     REVENUE + COSTS  (re-rendered whenever the filters change)
     ===================================================================== */
  Dash.onRender(function (list, sum, state) {
    /* ---- revenue KPIs ---- */
    var k = $('#kpiRevenue');
    if (k) {
      var margin = sum.revenue ? sum.profit / sum.revenue : 0;
      UI.kpis(k, [
        { label: 'Revenue', value: money(sum.revenue), accent: 'orange',
          sub: sum.bookings + ' paid bookings' },
        { label: 'Costs', value: money(sum.costs), accent: 'red',
          sub: 'From the cost register' },
        { label: sum.profit >= 0 ? 'Profit' : 'Loss', value: money(Math.abs(sum.profit)),
          accent: sum.profit >= 0 ? 'green' : 'red',
          sub: sum.revenue ? UI.pct(margin) + ' margin' : 'No revenue yet' },
        { label: 'Best line', value: sum.topLine ? sum.topLine.name : '—', accent: 'cyan',
          sub: sum.topLine ? money(sum.topLine.revenue) + ' earned' : '' }
      ]);
    }

    /* ---- revenue trend ---- */
    var cr = $('#chartRevenue');
    if (cr) {
      var days = Math.max(1, Math.round((new Date(state.to) - new Date(state.from)) / 86400000) + 1);
      var s = D.series(sum.byDay, Math.min(days, 90)).map(function (p) {
        return { label: p.label, value: p.value, short: p.label.slice(5),
                 tip: UI.dateLabel(p.label) + ': ' + money(p.value) };
      });
      UI.columnChart(cr, s, { title: 'Revenue per day', emptyText: 'No revenue in this period.' });
    }

    /* ---- best lines ---- */
    var cl = $('#chartRevLines');
    if (cl) {
      UI.barList(cl, sum.lines.map(function (l, i) {
        return { label: l.name, value: l.revenue, display: money(l.revenue),
                 color: UI.PALETTE[i % UI.PALETTE.length] };
      }), { emptyText: 'No revenue in this period.' });
    }

    var ca = $('#chartRevAreas');
    if (ca) {
      UI.barList(ca, sum.areas.slice(0, 8).map(function (a, i) {
        return { label: a.name, value: a.count, display: a.count + ' booking' + (a.count === 1 ? '' : 's'),
                 color: UI.PALETTE[i % UI.PALETTE.length] };
      }), { emptyText: 'No area data yet — it is collected on the booking form.' });
    }

    /* ---- line table ---- */
    var tl = $('#tableRevLines');
    if (tl) {
      UI.table(tl, [
        { label: 'Business line', raw: true, render: function (l) { return '<b>' + esc(l.name) + '</b>'; } },
        { label: 'Bookings', numeric: true, render: function (l) { return l.bookings; } },
        { label: 'Players', numeric: true, render: function (l) { return l.players; } },
        { label: 'Revenue', numeric: true, raw: true, render: function (l) {
            return '<b>' + esc(money(l.revenue)) + '</b>';
          } },
        { label: 'Avg. booking', numeric: true, render: function (l) {
            return money(l.bookings ? l.revenue / l.bookings : 0);
          } },
        { label: 'Share', numeric: true, render: function (l) {
            return sum.revenue ? UI.pct(l.revenue / sum.revenue) : '0%';
          } }
      ], sum.lines, { emptyText: 'No revenue in this period.' });
    }

    /* ---- top customers ---- */
    var tc = $('#tableTopCustomers');
    if (tc) {
      UI.table(tc, [
        { label: '#', numeric: true, render: function (c) { return sum.topCustomers.indexOf(c) + 1; } },
        { label: 'Customer', raw: true, render: function (c) {
            return '<b>' + esc(c.name) + '</b><span class="sub">' + esc(c.phone || c.email || '') + '</span>';
          } },
        { label: 'Area', render: function (c) { return c.area || 'Not given'; } },
        { label: 'Visits', numeric: true, render: function (c) { return c.visits; } },
        { label: 'Spend', numeric: true, raw: true, render: function (c) {
            return '<b>' + esc(money(c.spend)) + '</b>';
          } }
      ], sum.topCustomers.slice(0, 15), { emptyText: 'No customers in this period.' });
    }

    /* ---- P&L ---- */
    var kp = $('#kpiPnl');
    if (kp) {
      var salaries = (sum.costsByCategory.filter(function (c) { return c.id === 'salaries'; })[0] || {}).amount || 0;
      UI.kpis(kp, [
        { label: 'Revenue', value: money(sum.revenue), accent: 'orange' },
        { label: 'Total costs', value: money(sum.costs), accent: 'red' },
        { label: sum.profit >= 0 ? 'Net profit' : 'Net loss', value: money(Math.abs(sum.profit)),
          accent: sum.profit >= 0 ? 'green' : 'red' },
        { label: 'Salaries', value: money(salaries), accent: 'cyan',
          sub: sum.costs ? UI.pct(salaries / sum.costs) + ' of costs' : '' }
      ]);
    }

    var cp = $('#chartPnl');
    if (cp) {
      UI.barList(cp, [
        { label: 'Revenue', value: sum.revenue, display: money(sum.revenue), color: '#3BE07A' },
        { label: 'Costs', value: sum.costs, display: money(sum.costs), color: '#FF5A5A' },
        { label: sum.profit >= 0 ? 'Profit' : 'Loss', value: Math.abs(sum.profit),
          display: money(Math.abs(sum.profit)), color: sum.profit >= 0 ? '#FC4F15' : '#FF5A5A' }
      ], { emptyText: 'Nothing to compare yet.' });
    }

  });

  /* =====================================================================
     MANAGERS
     ===================================================================== */
  function renderManagers() {
    Auth.listManagers().then(function (list) {
      $('#mgCount').textContent = list.length + ' account' + (list.length === 1 ? '' : 's');
      UI.table($('#managersTable'), [
        { label: 'Name', raw: true, render: function (m) {
            return '<b>' + esc(m.name) + '</b><span class="sub">' + esc(m.email || '') + '</span>';
          } },
        { label: 'Created', render: function (m) { return UI.dateLabel(m.createdAt); } },
        { label: 'Status', raw: true, render: function (m) {
            return m.active === false
              ? '<span class="pill demo">Disabled</span>'
              : '<span class="pill paid">Active</span>';
          } },
        { label: '', raw: true, render: function (m) {
            return Auth.canResetManagerPassword()
              ? '<button class="linkbtn" data-reset-mgr="' + esc(m.id) + '">Reset password</button>'
              : '';
          } },
        { label: '', raw: true, render: function (m) {
            return m.active === false
              ? '<button class="linkbtn" data-on-mgr="' + esc(m.id) + '">Re-enable</button>'
              : '<button class="linkbtn" data-del-mgr="' + esc(m.id) + '">' +
                (Auth.cloudMode() ? 'Revoke access' : 'Delete') + '</button>';
          } }
      ], list, { emptyText: 'No manager accounts yet. Create one above.' });
    }).catch(function (e) {
      UI.empty($('#managersTable'), e.message || 'Could not load manager accounts.');
    });
  }

  $('#addManager').addEventListener('click', function () {
    var err = $('#mgErr');
    err.style.display = 'none';
    var name = $('#mgName').value.trim();
    var email = $('#mgEmail').value.trim();
    var pw = $('#mgPw').value;

    if (name.length < 2) { err.textContent = 'Enter the manager\'s name.'; err.style.display = 'block'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Enter a valid email address.'; err.style.display = 'block'; return; }
    if (pw.length < 8) { err.textContent = 'The password must be at least 8 characters.'; err.style.display = 'block'; return; }

    var btn = this;
    btn.disabled = true;
    Auth.addManager(name, email, pw).then(function (res) {
      if (!res.ok) { err.textContent = res.error; err.style.display = 'block'; return; }
      $('#mgName').value = $('#mgEmail').value = $('#mgPw').value = '';
      // in cloud mode the account is created disabled on purpose — say so,
      // otherwise the manager tries to sign in and is turned away
      UI.toast(Auth.cloudMode()
        ? 'Manager created — press Re-enable below to switch the account on'
        : 'Manager created — give them that password', 'good');
      renderManagers();
    }).finally(function () { btn.disabled = false; });
  });

  document.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-mgr]');
    if (del) {
      var msg = Auth.cloudMode()
        ? 'Revoke this manager\'s access? They will not be able to sign in on any device.'
        : 'Delete this manager? They will not be able to sign in again.';
      if (!confirm(msg)) return;
      Auth.removeManager(del.getAttribute('data-del-mgr')).then(function () {
        UI.toast(Auth.cloudMode() ? 'Access revoked' : 'Manager deleted');
        renderManagers();
      }).catch(function (err) { UI.toast(err.message || 'Could not update that account', 'bad'); });
      return;
    }

    var on = e.target.closest('[data-on-mgr]');
    if (on) {
      Auth.enableManager(on.getAttribute('data-on-mgr')).then(function () {
        UI.toast('Access restored', 'good');
        renderManagers();
      }).catch(function (err) { UI.toast(err.message || 'Could not update that account', 'bad'); });
      return;
    }

    var rst = e.target.closest('[data-reset-mgr]');
    if (rst) {
      var pw = prompt('New password for this manager (at least 8 characters):');
      if (pw === null) return;
      if (pw.length < 8) { UI.toast('Password too short — nothing changed', 'bad'); return; }
      Auth.resetManagerPassword(rst.getAttribute('data-reset-mgr'), pw).then(function () {
        UI.toast('Password updated', 'good');
        renderManagers();
      }).catch(function (err) { UI.toast(err.message || 'Could not reset that password', 'bad'); });
    }
  });

  /* =====================================================================
     SETTINGS
     ===================================================================== */
  $('#savePw').addEventListener('click', function () {
    var err = $('#pwErr');
    err.style.display = 'none';
    var cur = $('#curPw').value, a = $('#setPw').value, b = $('#setPw2').value;

    if (a.length < 8) { err.textContent = 'The new password must be at least 8 characters.'; err.style.display = 'block'; return; }
    if (a !== b) { err.textContent = 'The two new passwords do not match.'; err.style.display = 'block'; return; }

    var btn = this;
    btn.disabled = true;
    Auth.verifyDirector(cur).then(function (ok) {
      if (!ok) {
        err.textContent = 'Your current password is not right.';
        err.style.display = 'block';
        return;
      }
      return Auth.setDirectorPassword(a).then(function () {
        $('#curPw').value = $('#setPw').value = $('#setPw2').value = '';
        UI.toast('Director password updated', 'good');
      });
    }).finally(function () { btn.disabled = false; });
  });

  $('#exportCfg').addEventListener('click', function () {
    D.download('arena-admin-accounts.json', Auth.exportConfig());
    UI.toast('Accounts exported — keep the file safe', 'good');
  });

  $('#importCfgBtn').addEventListener('click', function () { $('#importCfg').click(); });
  $('#importCfg').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      if (Auth.importConfig(fr.result)) {
        UI.toast('Accounts imported — sign in again', 'good');
        setTimeout(function () { Auth.signOut(); location.href = 'index.html'; }, 1400);
      } else {
        UI.toast('That file could not be read', 'bad');
      }
    };
    fr.readAsText(f);
    this.value = '';
  });

  $('#exportAll').addEventListener('click', function () {
    var all = D.loadBookings();
    if (!all.length) { UI.toast('No bookings stored yet', 'bad'); return; }
    D.download('arena-all-bookings.csv', D.bookingsCsv(all));
    UI.toast('Exported ' + all.length + ' bookings', 'good');
  });

  $('#loadSample').addEventListener('click', function () {
    D.loadSample().then(function () {
      UI.toast(D.cloudOn()
        ? 'Sample bookings added on this device only'
        : 'Sample data loaded', 'good');
      Dash.renderAll();
    });
  });

  $('#clearSample').addEventListener('click', function () {
    D.clearSample().then(function () {
      UI.toast('Sample data removed');
      Dash.renderAll();
    });
  });

  $('#wipeData').addEventListener('click', function () {
    if (!confirm('Delete EVERY booking and expense stored in this browser?\n\nThis cannot be undone. Export first if you need a copy.')) return;
    if (!confirm('Last check — really delete all local booking and expense data?')) return;
    try {
      localStorage.removeItem('arena.bookings');
      localStorage.removeItem('arena.admin.expenses');
    } catch (e) { /* ignore */ }
    UI.toast(D.cloudOn()
      ? 'Local copies deleted — shared server data is untouched'
      : 'All local data deleted');
    Dash.reload();
  });

  /* =====================================================================
     GO
     ===================================================================== */
  Dash.actor = 'Director';

  // the activation step only exists in cloud mode
  var actHint = $('#activationHint');
  if (actHint && Auth.cloudMode()) actHint.style.display = '';

  UI.initShell(function (id) {
    if (id === 'managers') renderManagers();
  });
  Dash.mount();
  renderManagers();
}());
