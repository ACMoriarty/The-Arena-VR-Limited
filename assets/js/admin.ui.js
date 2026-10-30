/* ==========================================================================
   THE ARENA — admin UI helpers
   KPI tiles, tables and charts. Charts are hand-rolled SVG so the dashboard
   has no external dependencies and works offline.
   ========================================================================== */

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function money(n) {
    return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
  }
  function compact(n) {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e6) return '₦' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'm';
    if (Math.abs(n) >= 1e3) return '₦' + Math.round(n / 1e3) + 'k';
    return '₦' + Math.round(n);
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pct(n) { return (Math.round(n * 1000) / 10) + '%'; }

  function dateLabel(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function timeLabel(t) {
    if (!t) return '—';
    var p = String(t).split(':'), h = +p[0];
    return (h % 12 || 12) + ':' + (p[1] || '00') + (h >= 12 ? 'pm' : 'am');
  }

  var PALETTE = ['#FC4F15', '#20E9F9', '#FFDE15', '#2424E6', '#B1DFEC', '#7C7CFF', '#FF8A5B', '#3BE07A'];

  /* =====================================================================
     KPI TILES
     ===================================================================== */
  function kpis(el, items) {
    el.innerHTML = items.map(function (k) {
      return '<div class="kpi' + (k.accent ? ' ' + k.accent : '') + '">' +
               '<span class="kpi-label">' + esc(k.label) + '</span>' +
               '<b class="kpi-value">' + esc(k.value) + '</b>' +
               (k.sub ? '<span class="kpi-sub">' + esc(k.sub) + '</span>' : '') +
             '</div>';
    }).join('');
  }

  /* =====================================================================
     COLUMN CHART — time series
     ===================================================================== */
  function columnChart(el, data, opts) {
    opts = opts || {};
    if (!data.length) { empty(el, opts.emptyText); return; }

    var W = 720, H = 220, padL = 46, padB = 26, padT = 12;
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var innerW = W - padL - 8, innerH = H - padB - padT;
    var bw = innerW / data.length;
    var barW = Math.max(2, Math.min(bw * 0.66, 26));

    var bars = data.map(function (d, i) {
      var h = max ? (d.value / max) * innerH : 0;
      var x = padL + i * bw + (bw - barW) / 2;
      var y = padT + innerH - h;
      return '<rect class="ch-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
             '" width="' + barW.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) +
             '" rx="' + Math.min(3, barW / 2) + '">' +
             '<title>' + esc(d.tip || (d.label + ': ' + money(d.value))) + '</title></rect>';
    }).join('');

    // 3 gridlines
    var grid = [0, 0.5, 1].map(function (f) {
      var y = padT + innerH - f * innerH;
      return '<line class="ch-grid" x1="' + padL + '" x2="' + (W - 8) + '" y1="' + y + '" y2="' + y + '"/>' +
             '<text class="ch-axis" x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end">' +
             compact(max * f) + '</text>';
    }).join('');

    // first / middle / last x labels only, so they never collide
    var idx = [0, Math.floor(data.length / 2), data.length - 1];
    var xlab = idx.filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (i) {
      var d = data[i];
      var x = padL + i * bw + bw / 2;
      return '<text class="ch-axis" x="' + x.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' +
             esc(d.short || String(d.label).slice(5)) + '</text>';
    }).join('');

    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(opts.title || 'Chart') + '" preserveAspectRatio="none">' + grid + bars + xlab + '</svg>';
  }

  /* =====================================================================
     BAR LIST — horizontal ranked bars
     ===================================================================== */
  function barList(el, data, opts) {
    opts = opts || {};
    if (!data.length) { empty(el, opts.emptyText); return; }
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    el.innerHTML = '<div class="barlist">' + data.map(function (d, i) {
      var w = (d.value / max) * 100;
      var c = d.color || PALETTE[i % PALETTE.length];
      return '<div class="barrow">' +
               '<span class="barlabel" title="' + esc(d.label) + '">' + esc(d.label) + '</span>' +
               '<span class="bartrack"><i style="width:' + w.toFixed(1) + '%;background:' + c + '"></i></span>' +
               '<span class="barvalue">' + esc(d.display || money(d.value)) + '</span>' +
             '</div>';
    }).join('') + '</div>';
  }

  /* =====================================================================
     DONUT
     ===================================================================== */
  function donut(el, data, opts) {
    opts = opts || {};
    var total = data.reduce(function (n, d) { return n + d.value; }, 0);
    if (!total) { empty(el, opts.emptyText); return; }

    var R = 62, r = 40, cx = 78, cy = 78, off = 0;
    var arcs = data.map(function (d, i) {
      var frac = d.value / total;
      var a0 = off * 2 * Math.PI - Math.PI / 2;
      off += frac;
      var a1 = off * 2 * Math.PI - Math.PI / 2;
      var large = frac > 0.5 ? 1 : 0;
      var p = function (rad, ang) { return [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]; };
      var s0 = p(R, a0), s1 = p(R, a1), i1 = p(r, a1), i0 = p(r, a0);
      var c = d.color || PALETTE[i % PALETTE.length];
      return '<path d="M' + s0 + 'A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + s1 +
             'L' + i1 + 'A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + i0 + 'Z" fill="' + c + '">' +
             '<title>' + esc(d.label + ': ' + money(d.value) + ' (' + pct(frac) + ')') + '</title></path>';
    }).join('');

    var legend = data.map(function (d, i) {
      var c = d.color || PALETTE[i % PALETTE.length];
      return '<li><i style="background:' + c + '"></i>' +
             '<span>' + esc(d.label) + '</span>' +
             '<b>' + esc(money(d.value)) + '</b></li>';
    }).join('');

    el.innerHTML = '<div class="donutwrap">' +
      '<svg viewBox="0 0 156 156" class="donut" role="img" aria-label="' + esc(opts.title || 'Breakdown') + '">' +
        arcs +
        '<text x="78" y="74" text-anchor="middle" class="donut-total">' + esc(compact(total)) + '</text>' +
        '<text x="78" y="90" text-anchor="middle" class="donut-cap">' + esc(opts.centreLabel || 'total') + '</text>' +
      '</svg>' +
      '<ul class="donutlegend">' + legend + '</ul></div>';
  }

  function empty(el, text) {
    el.innerHTML = '<p class="empty">' + esc(text || 'Nothing to show yet.') + '</p>';
  }

  /* =====================================================================
     TABLE
     ===================================================================== */
  function table(el, cols, rows, opts) {
    opts = opts || {};
    if (!rows.length) { empty(el, opts.emptyText); return; }
    el.innerHTML =
      '<div class="tablewrap"><table class="dtable">' +
        '<thead><tr>' + cols.map(function (c) {
          return '<th' + (c.numeric ? ' class="num"' : '') + '>' + esc(c.label) + '</th>';
        }).join('') + '</tr></thead>' +
        '<tbody>' + rows.map(function (r) {
          return '<tr>' + cols.map(function (c) {
            var v = c.render ? c.render(r) : r[c.key];
            return '<td' + (c.numeric ? ' class="num"' : '') + '>' + (c.raw ? v : esc(v)) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody>' +
      '</table></div>';
  }

  /* =====================================================================
     SHELL — sidebar nav + section switching
     ===================================================================== */
  function initShell(onSection) {
    var links = $$('.anav a[data-sec]');
    var current = null;

    function valid(id) {
      return links.some(function (a) { return a.getAttribute('data-sec') === id; });
    }

    function show(id) {
      if (!valid(id)) id = links[0].getAttribute('data-sec');
      current = id;
      $$('.asection').forEach(function (s) { s.hidden = s.id !== 'sec-' + id; });
      links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-sec') === id); });
      // replaceState keeps the URL shareable without stacking a history entry
      // for every section click (so Back leaves the console, as people expect)
      try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
      var t = $('#secTitle');
      var active = links.filter(function (a) { return a.getAttribute('data-sec') === id; })[0];
      if (t && active) t.textContent = active.getAttribute('data-title') || active.textContent.trim();
      if (onSection) onSection(id);
      var sb = $('.asidebar');
      if (sb) sb.classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
    }
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        show(a.getAttribute('data-sec'));
      });
    });
    show((location.hash || '').replace('#', ''));

    /* A hash-only change does not reload the page, so follow it manually.
       This makes shared links like director.html#revenue work even when the
       console is already open. */
    window.addEventListener('hashchange', function () {
      var id = (location.hash || '').replace('#', '');
      if (id && id !== current) show(id);
    });

    var burger = $('#aburger');
    if (burger) {
      burger.addEventListener('click', function () {
        $('.asidebar').classList.toggle('open');
      });
    }
    var scrim = $('#ascrim');
    if (scrim) scrim.addEventListener('click', function () { $('.asidebar').classList.remove('open'); });
    return { show: show };
  }

  /* toast */
  function toast(msg, kind) {
    var t = $('#atoast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'atoast show' + (kind ? ' ' + kind : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'atoast'; }, 3200);
  }

  window.ArenaUI = {
    $: $, $$: $$, money: money, compact: compact, esc: esc, pct: pct,
    dateLabel: dateLabel, timeLabel: timeLabel, PALETTE: PALETTE,
    kpis: kpis, columnChart: columnChart, barList: barList, donut: donut,
    table: table, empty: empty, initShell: initShell, toast: toast
  };
}());
