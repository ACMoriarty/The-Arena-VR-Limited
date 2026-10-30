/* ==========================================================================
   THE ARENA — cloud backend (Supabase)
   --------------------------------------------------------------------------
   This is what makes bookings and accounts work ACROSS DEVICES.

   Without it, everything falls back to localStorage and behaves exactly as
   before: data stays in the browser it was created in. With it:

     • A booking made on a customer's phone appears on your laptop dashboard.
     • Manager logins work on any device.
     • Costs entered by the manager are visible to the Director immediately.
     • The password check becomes REAL — enforced by the server, not the page.

   Setup is two values in arena.config.js (`cloud.url` and `cloud.anonKey`)
   plus one SQL script. Both are in the README under "Cross-device setup".

   The anon key is meant to be public — it identifies the project, it does not
   grant access. Access is decided by Row Level Security policies in the
   database, which is why the SQL script matters.
   ========================================================================== */

(function () {
  'use strict';

  var CFG = (window.ARENA && window.ARENA.cloud) || {};
  var TOKEN_KEY = 'arena.cloud.session';

  function configured() {
    return !!(CFG.url && CFG.anonKey &&
              CFG.url.indexOf('http') === 0 &&
              CFG.anonKey.length > 20 &&
              CFG.url.indexOf('YOUR-PROJECT') === -1);
  }

  function base() { return String(CFG.url).replace(/\/+$/, ''); }

  /* ---------------------------------------------------------------------
     session
     --------------------------------------------------------------------- */
  function saveSession(s) {
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  function token() {
    var s = loadSession();
    return s && s.access_token ? s.access_token : null;
  }

  function headers(auth) {
    var h = {
      'apikey': CFG.anonKey,
      'Content-Type': 'application/json'
    };
    var t = auth === false ? null : token();
    h.Authorization = 'Bearer ' + (t || CFG.anonKey);
    return h;
  }

  function req(path, opts) {
    opts = opts || {};
    return fetch(base() + path, {
      method: opts.method || 'GET',
      headers: Object.assign(headers(opts.auth), opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).catch(function () {
      // DNS failure, no internet, wrong project URL — say something useful
      var e = new Error('Cannot reach the server. Check your internet connection, ' +
                        'or the cloud settings in arena.config.js.');
      e.status = 0;
      throw e;
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
        if (!r.ok) {
          var msg = (data && (data.msg || data.message || data.error_description ||
                              data.error || data.hint)) || ('Request failed (' + r.status + ')');
          var err = new Error(msg);
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------------------------------------------------------------------
     refresh an expired access token
     --------------------------------------------------------------------- */
  function refreshSession() {
    var s = loadSession();
    if (!s || !s.refresh_token) return Promise.resolve(false);
    return req('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', auth: false, body: { refresh_token: s.refresh_token }
    }).then(function (res) {
      if (res && res.access_token) {
        res.profile = s.profile;
        saveSession(res);
        return true;
      }
      return false;
    }).catch(function () { return false; });
  }

  /* retry once after refreshing, so an expired token is invisible to callers */
  function authed(path, opts) {
    return req(path, opts).catch(function (err) {
      if (err.status !== 401) throw err;
      return refreshSession().then(function (ok) {
        if (!ok) throw err;
        return req(path, opts);
      });
    });
  }

  /* =====================================================================
     AUTH
     ===================================================================== */
  function signIn(email, password) {
    return req('/auth/v1/token?grant_type=password', {
      method: 'POST', auth: false, body: { email: email, password: password }
    }).then(function (res) {
      if (!res || !res.access_token) throw new Error('Sign in failed.');
      saveSession(res);
      return profile().then(function (p) {
        var s = loadSession();
        s.profile = p;
        saveSession(s);
        return p;
      });
    });
  }

  function signOut() {
    var t = token();
    clearSession();
    if (!t) return Promise.resolve();
    return req('/auth/v1/logout', { method: 'POST' }).catch(function () { /* best effort */ });
  }

  /* the signed-in user's row in public.profiles (id, name, role, active) */
  function profile() {
    return authed('/rest/v1/profiles?select=*').then(function (rows) {
      var p = (rows && rows[0]) || null;
      if (!p) throw new Error('No profile found for this account. Ask the Director to set it up.');
      if (p.active === false) throw new Error('This account has been disabled.');
      return p;
    });
  }

  function cachedProfile() {
    var s = loadSession();
    return (s && s.profile) || null;
  }

  /* =====================================================================
     BOOKINGS
     ===================================================================== */

  /* Public insert — customers are not signed in, so this uses the anon key.
     The RLS policy in the README allows INSERT only, never SELECT. */
  function createBooking(b) {
    return req('/rest/v1/bookings', {
      method: 'POST',
      auth: false,
      headers: { 'Prefer': 'return=minimal' },
      body: {
        ref: b.ref, at: b.at, kind: b.kind, line_id: b.lineId, line: b.line,
        game: b.game, booking_date: b.date, booking_time: b.time || null,
        duration: b.duration, players: b.players, amount: b.amount, status: b.status,
        customer_name: b.customer.name, customer_phone: b.customer.phone,
        customer_email: b.customer.email, customer_area: b.customer.area,
        note: b.note
      }
    });
  }

  function listBookings() {
    return authed('/rest/v1/bookings?select=*&order=at.desc&limit=5000')
      .then(function (rows) {
        return (rows || []).map(function (r) {
          return {
            ref: r.ref, at: r.at, kind: r.kind, lineId: r.line_id, line: r.line,
            game: r.game || '', date: r.booking_date, time: r.booking_time || '',
            duration: r.duration || 0, players: r.players || 1, amount: r.amount || 0,
            status: r.status || 'paid',
            customer: {
              name: r.customer_name || '', phone: r.customer_phone || '',
              email: r.customer_email || '', area: r.customer_area || ''
            },
            note: r.note || '', sample: r.status === 'sample', remote: true
          };
        });
      });
  }

  function deleteBooking(ref) {
    return authed('/rest/v1/bookings?ref=eq.' + encodeURIComponent(ref), { method: 'DELETE' });
  }

  /* =====================================================================
     EXPENSES
     ===================================================================== */
  function listExpenses() {
    return authed('/rest/v1/expenses?select=*&order=expense_date.desc&limit=5000')
      .then(function (rows) {
        return (rows || []).map(function (r) {
          return {
            id: r.id, date: r.expense_date, category: r.category,
            description: r.description || '', amount: r.amount || 0,
            payee: r.payee || '', enteredBy: r.entered_by || '',
            createdAt: r.created_at, remote: true
          };
        });
      });
  }

  function createExpense(e) {
    return authed('/rest/v1/expenses', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: {
        expense_date: e.date, category: e.category, description: e.description,
        amount: e.amount, payee: e.payee, entered_by: e.enteredBy
      }
    });
  }

  function deleteExpense(id) {
    return authed('/rest/v1/expenses?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
  }

  /* =====================================================================
     MANAGER ACCOUNTS
     ===================================================================== */
  function listManagers() {
    return authed('/rest/v1/profiles?select=*&order=created_at.desc')
      .then(function (rows) { return rows || []; });
  }

  /* Creating a login uses the public signup endpoint. It returns a session
     for the new user which we deliberately throw away — the Director stays
     signed in as themselves. */
  function createManager(name, email, password) {
    var keep = loadSession();
    return req('/auth/v1/signup', {
      method: 'POST', auth: false,
      body: { email: email, password: password, data: { name: name, role: 'manager' } }
    }).then(function () {
      saveSession(keep);           // restore the Director's session
      return { ok: true };
    }).catch(function (err) {
      saveSession(keep);
      return { ok: false, error: err.message };
    });
  }

  /* We cannot delete an auth user from the browser (that needs the secret
     service key, which must never ship in a web page). Disabling the profile
     revokes all access via RLS, which is what "delete" means in practice. */
  function setManagerActive(id, active) {
    return authed('/rest/v1/profiles?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: { active: !!active }
    });
  }

  function ping() {
    return req('/rest/v1/', { auth: false })
      .then(function () { return true; })
      .catch(function (e) { return e.status === 401 || e.status === 404 ? true : false; });
  }

  window.ArenaCloud = {
    configured: configured,
    signIn: signIn,
    signOut: signOut,
    profile: profile,
    cachedProfile: cachedProfile,
    hasSession: function () { return !!token(); },
    createBooking: createBooking,
    listBookings: listBookings,
    deleteBooking: deleteBooking,
    listExpenses: listExpenses,
    createExpense: createExpense,
    deleteExpense: deleteExpense,
    listManagers: listManagers,
    createManager: createManager,
    setManagerActive: setManagerActive,
    ping: ping
  };
}());
